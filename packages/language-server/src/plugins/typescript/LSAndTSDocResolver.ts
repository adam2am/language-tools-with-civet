import { dirname, join } from 'path';
import ts from 'typescript';
import {
    PublishDiagnosticsParams,
    RelativePattern,
    TextDocumentContentChangeEvent
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../lib/documents';
import { LSConfigManager } from '../../ls-config';
import {
    createGetCanonicalFileName,
    debounceSameArg,
    GetCanonicalFileName,
    normalizePath,
    pathToUrl,
    urlToPath
} from '../../utils';
import { DocumentSnapshot, SvelteDocumentSnapshot } from './DocumentSnapshot';
import {
    getService,
    getServiceForTsconfig,
    forAllServices,
    LanguageServiceContainer,
    LanguageServiceDocumentContext
} from './service';
import { createProjectService } from './serviceCache';
import { GlobalSnapshotsManager, SnapshotManager } from './SnapshotManager';
import { isSubPath } from './utils';
import { FileMap, FileSet } from '../../lib/documents/fileCollection';
import { Logger } from '../../logger';

interface LSAndTSDocResolverOptions {
    notifyExceedSizeLimit?: () => void;
    /**
     * True, if used in the context of svelte-check
     */
    isSvelteCheck?: boolean;

    /**
     * This should only be set via svelte-check. Makes sure all documents are resolved to that tsconfig. Has to be absolute.
     */
    tsconfigPath?: string;

    onProjectReloaded?: () => void;
    reportConfigError?: (diagnostic: PublishDiagnosticsParams) => void;
    watch?: boolean;
    tsSystem?: ts.System;
    watchDirectory?: (patterns: RelativePattern[]) => void;
    nonRecursiveWatchPattern?: string;
}

export class LSAndTSDocResolver {
    constructor(
        private readonly docManager: DocumentManager,
        private readonly workspaceUris: string[],
        private readonly configManager: LSConfigManager,
        private readonly options?: LSAndTSDocResolverOptions
    ) {
        // Enable debug logging for Civet diagnostics
        Logger.setDebug(true);

        docManager.on(
            'documentChange',
            debounceSameArg(
                this.updateSnapshot.bind(this),
                (newDoc, prevDoc) => newDoc.uri === prevDoc?.uri,
                1000
            )
        );

        // New files would cause typescript to rebuild its type-checker.
        // Open it immediately to reduce rebuilds in the startup
        // where multiple files and their dependencies
        // being loaded in a short period of times
        docManager.on('documentOpen', (document) => {
            if (document.openedByClient) {
                this.getOrCreateSnapshot(document);
            } else {
                this.updateSnapshot(document);
            }
            docManager.lockDocument(document.uri);
        });

        this.getCanonicalFileName = createGetCanonicalFileName(
            (options?.tsSystem ?? ts.sys).useCaseSensitiveFileNames
        );

        this.tsSystem = this.wrapWithPackageJsonMonitoring(this.options?.tsSystem ?? ts.sys);
        this.globalSnapshotsManager = new GlobalSnapshotsManager(this.tsSystem);
        this.userPreferencesAccessor = { preferences: this.getTsUserPreferences() };
        const projectService = createProjectService(this.tsSystem, this.userPreferencesAccessor);

        configManager.onChange(() => {
            const newPreferences = this.getTsUserPreferences();
            const autoImportConfigChanged =
                newPreferences.includePackageJsonAutoImports !==
                this.userPreferencesAccessor.preferences.includePackageJsonAutoImports;

            this.userPreferencesAccessor.preferences = newPreferences;

            if (autoImportConfigChanged) {
                forAllServices((service) => {
                    service.onAutoImportProviderSettingsChanged();
                });
            }
        });

        this.packageJsonWatchers = new FileMap(this.tsSystem.useCaseSensitiveFileNames);
        this.watchedDirectories = new FileSet(this.tsSystem.useCaseSensitiveFileNames);

        // workspaceUris are already watched during initialization
        for (const root of this.workspaceUris) {
            const rootPath = urlToPath(root);
            if (rootPath) {
                this.watchedDirectories.add(rootPath);
            }
        }

        this.lsDocumentContext = {
            isSvelteCheck: !!this.options?.isSvelteCheck,
            ambientTypesSource: this.options?.isSvelteCheck ? 'svelte-check' : 'svelte2tsx',
            createDocument: this.createDocument,
            transformOnTemplateError: !this.options?.isSvelteCheck,
            globalSnapshotsManager: this.globalSnapshotsManager,
            notifyExceedSizeLimit: this.options?.notifyExceedSizeLimit,
            extendedConfigCache: this.extendedConfigCache,
            onProjectReloaded: this.options?.onProjectReloaded,
            watchTsConfig: !!this.options?.watch,
            tsSystem: this.tsSystem,
            projectService,
            watchDirectory: this.options?.watchDirectory
                ? this.watchDirectory.bind(this)
                : undefined,
            nonRecursiveWatchPattern: this.options?.nonRecursiveWatchPattern,
            reportConfigError: this.options?.reportConfigError
        };
    }

    /**
     * Create a svelte document -> should only be invoked with svelte files.
     */
    private createDocument = (fileName: string, content: string) => {
        const uri = pathToUrl(fileName);
        const document = this.docManager.openDocument(
            {
                text: content,
                uri
            },
            /* openedByClient */ false
        );
        this.docManager.lockDocument(uri);
        return document;
    };

    private tsSystem: ts.System;
    private globalSnapshotsManager: GlobalSnapshotsManager;
    private extendedConfigCache = new Map<string, ts.ExtendedConfigCacheEntry>();
    private getCanonicalFileName: GetCanonicalFileName;

    private userPreferencesAccessor: { preferences: ts.UserPreferences };
    private readonly packageJsonWatchers: FileMap<ts.FileWatcher>;
    private lsDocumentContext: LanguageServiceDocumentContext;
    private readonly watchedDirectories: FileSet;

    async getLSAndTSDoc(document: Document): Promise<{
        tsDoc: SvelteDocumentSnapshot;
        lang: ts.LanguageService;
        userPreferences: ts.UserPreferences;
        lsContainer: LanguageServiceContainer;
    }> {
        const { tsDoc, lsContainer, userPreferences } = await this.getLSAndTSDocWorker(document);

        // Wrap the language service to log definition lookups
        const origLang = lsContainer.getService();
        const lang = { ...origLang }; // Clone to override methods safely

        const svelteFilePath = document.getFilePath()!;
        const tsxFilePath = tsDoc.filePath;

        const origGetDef = origLang.getDefinitionAtPosition.bind(origLang);
        lang.getDefinitionAtPosition = (fileName: string, position: number) => {
            // fileName is the Svelte file path, position is offset in Svelte file
            console.log('WRAPPER HIT: getDefinitionAtPosition. Incoming Svelte fileName:', fileName, 'Incoming Svelte position:', position, 'Target TSX filePath:', tsxFilePath);
            
            const svelteLineCharPos = document.positionAt(position); // Convert Svelte offset to Line/Char
            const tsxPosition = tsDoc.getGeneratedPosition(svelteLineCharPos); // Map Svelte Line/Char to TSX Line/Char
            const tsxOffset = tsDoc.offsetAt(tsxPosition); // Convert TSX Line/Char to TSX offset

            Logger.debug(
                '[LSResolver] getDefinitionAtPosition: Svelte input:', {fileName, position, line: svelteLineCharPos.line, char: svelteLineCharPos.character }, 
                'Mapped to TSX:', {tsxFilePath, tsxOffset, line: tsxPosition.line, char: tsxPosition.character}
            );

            const defs = origGetDef(tsxFilePath, tsxOffset);
            Logger.debug('[LSResolver] Initial getDefinitionAtPosition result (from TSX):', defs);

            // Check defs here to satisfy linter for the disabled block below
            const اولیهDefsExist = !!defs && defs.length > 0;
            // Effectively disable fallback by changing condition to always false
            if (false && ! اولیهDefsExist && typeof tsxOffset === 'number') { // Fallback disabled, using اولیهDefsExist to satisfy linter
                Logger.debug('[LSResolver] Initial getDefinitionAtPosition failed on TSX. Trying fallbacks. Fallback uses TSX offset:', tsxOffset);
                const program = origLang.getProgram()!;
                    if (program) {
                    const sourceFile = program.getSourceFile(tsxFilePath)!;
                        if (sourceFile) {
                        try {
                            const loc = sourceFile.getLineAndCharacterOfPosition(tsxOffset);
                            const fullText = tsDoc.getText(0, tsDoc.getLength());
                            const lines = fullText.split(/\r?\n/);
                            const lineText = lines[loc.line] || '';
                            const prefix = lineText.slice(0, loc.character);
                            const suffix = lineText.slice(loc.character);
                            const prefixMatch = /[A-Za-z_]\w*$/.exec(prefix);
                            const suffixMatch = /^[A-Za-z_]\w*/.exec(suffix);
                            let candidateOffsetInTsx: number | undefined;
                            if (prefixMatch && prefixMatch[0].length > 0) {
                                const startCol = loc.character - prefixMatch![0].length;
                                candidateOffsetInTsx = sourceFile.getPositionOfLineAndCharacter(loc.line, startCol);
                            } else if (suffixMatch && suffixMatch![0].length > 0) {
                                const startCol = loc.character + (suffixMatch! .index ?? 0);
                                candidateOffsetInTsx = sourceFile.getPositionOfLineAndCharacter(loc.line, startCol);
                            }
                            if (candidateOffsetInTsx !== undefined) {
                                Logger.debug('[LSResolver TextFallback] Retry getDefinitionAtPosition at TSX offset:', candidateOffsetInTsx);
                                const textRetryDefs = origGetDef(tsxFilePath, candidateOffsetInTsx!);
                                if (textRetryDefs && textRetryDefs!.length > 0) {
                                    Logger.debug('[LSResolver TextFallback] Text-based fallback found definitions:', textRetryDefs);
                                    return textRetryDefs;
                                }
                            }
                        } catch (e: any) {
                            Logger.debug('[LSResolver TextFallback] Error:', e.message);
                                    }

                        // AST-based fallback (operates on TSX AST)
                        Logger.debug('[LSResolver ASTFallback] Trying AST-based fallback for position (TSX offset):', tsxOffset);
                        let closestNode: ts.Node | undefined;
                        let closestDistance = Infinity;

                        function findNodeAtPositionRecursive(node: ts.Node | undefined) {
                            if (!node) return; // Guard for undefined
                                        if (ts.isIdentifier(node)) {
                                const distance = Math.abs(node.getStart(sourceFile) - tsxOffset); 
                                if (distance < closestDistance) {
                                    closestDistance = distance;
                                    closestNode = node;
                                }
                                        }
                            ts.forEachChild(node, findNodeAtPositionRecursive);
                                    }
                        findNodeAtPositionRecursive(sourceFile);

                        if (closestNode) {
                            const nodeStartInTsx = closestNode!.getStart(sourceFile);
                            Logger.debug('[LSResolver ASTFallback] Found closest node in TSX:', closestNode!.getText(sourceFile), 'kind:', ts.SyntaxKind[closestNode!.kind], 'at TSX offset:', nodeStartInTsx);
                            const astRetryDefs = origGetDef(tsxFilePath, nodeStartInTsx);
                            Logger.debug('[LSResolver ASTFallback] Retry with AST candidate returned:', astRetryDefs!);
                            if (astRetryDefs && astRetryDefs!.length > 0) return astRetryDefs!;
                        } else {
                            Logger.debug('[LSResolver ASTFallback] No close node found for TSX offset:', tsxOffset);
                        }
                    }
                }
            }
            // Definitions are in TSX coordinates. They need to be mapped back to Svelte by the caller of getLSAndTSDoc if necessary.
            return defs;
        };

        const origGetQuickInfo = origLang.getQuickInfoAtPosition.bind(origLang);
        lang.getQuickInfoAtPosition = (fileName: string, position: number) => {
            // fileName is the Svelte file path, position is offset in Svelte file
            console.log('WRAPPER HIT: getQuickInfoAtPosition. Incoming Svelte fileName:', fileName, 'Incoming Svelte position:', position, 'Target TSX filePath:', tsxFilePath);

            const svelteLineCharPos = document.positionAt(position);
            const tsxPosition = tsDoc.getGeneratedPosition(svelteLineCharPos);
            const tsxOffset = tsDoc.offsetAt(tsxPosition);

            Logger.debug(
                '[LSResolver] getQuickInfoAtPosition: Svelte input:', {fileName, position, line: svelteLineCharPos.line, char: svelteLineCharPos.character }, 
                'Mapped to TSX:', {tsxFilePath, tsxOffset, line: tsxPosition.line, char: tsxPosition.character}
            );

            const quickInfo = origGetQuickInfo(tsxFilePath, tsxOffset);
            Logger.debug('[LSResolver] Initial getQuickInfoAtPosition result (from TSX):', quickInfo ? { text: quickInfo.displayParts?.map(dp => dp.text).join(''), kind: quickInfo.kind } : null);
            
            // Effectively disable fallback by changing condition to always false
            if (false && !quickInfo && typeof tsxOffset === 'number') { // Fallback disabled
                Logger.debug('[LSResolver] Initial getQuickInfoAtPosition failed on TSX. Fallback uses TSX offset:', tsxOffset);
                // Text-based fallback (operates on TSX content)
                const program = origLang.getProgram?.()!;
                if (program) {
                    const sourceFile = program.getSourceFile(tsxFilePath)!;
                    if (sourceFile) {
                        try {
                            const loc = sourceFile.getLineAndCharacterOfPosition(tsxOffset);
                            const fullText = tsDoc.getText(0, tsDoc.getLength());
                            const lines = fullText.split(/\r?\n/);
                            const lineText = lines[loc.line] || '';
                            const prefix = lineText.slice(0, loc.character);
                            const suffix = lineText.slice(loc.character);
                            const prefixMatch = /[A-Za-z_]\w*$/.exec(prefix);
                            const suffixMatch = /^[A-Za-z_]\w*/.exec(suffix);
                            let candidateOffsetInTsx: number | undefined;
                            if (prefixMatch) {
                                const startCol = loc.character - prefixMatch![0].length;
                                candidateOffsetInTsx = sourceFile.getPositionOfLineAndCharacter(loc.line, startCol);
                            } else if (suffixMatch) {
                                const startCol = loc.character + (suffixMatch! .index ?? 0);
                                candidateOffsetInTsx = sourceFile.getPositionOfLineAndCharacter(loc.line, startCol);
                            }
                            if (candidateOffsetInTsx !== undefined) {
                                Logger.debug('[LSResolver TextFallback] Retry QuickInfo at TSX offset:', candidateOffsetInTsx);
                                const retryQuickInfo = origGetQuickInfo(tsxFilePath, candidateOffsetInTsx!);
                                if (retryQuickInfo) {
                                    Logger.debug('[LSResolver TextFallback] Retry QuickInfo returned:', retryQuickInfo);
                                    return retryQuickInfo;
                                }
                            }
                        } catch (e: any) {
                            Logger.debug('[LSResolver TextFallback] Error:', e.message);
                                                }
                        // AST-based fallback
                        Logger.debug('[LSResolver ASTFallback] Trying AST-based fallback for TSX offset:', tsxOffset);
                        let closestNode: ts.Node | undefined;
                        let closestDistance = Infinity;
                        function findNode(node: ts.Node | undefined) {
                            if (!node) return; // Guard for undefined node
                            if (ts.isIdentifier(node)) {
                                const distance = Math.abs(node.getStart(sourceFile) - tsxOffset);
                                if (distance < closestDistance) {
                                    closestDistance = distance;
                                    closestNode = node;
                                }
                            }
                            ts.forEachChild(node, findNode);
                        }
                        findNode(sourceFile);
                        if (closestNode) {
                            const nodeOffset = closestNode!.getStart(sourceFile);
                            Logger.debug('[LSResolver ASTFallback] Retry QuickInfo at TSX offset (AST):', nodeOffset);
                            const astQuickInfo = origGetQuickInfo(tsxFilePath, nodeOffset);
                            if (astQuickInfo) {
                                Logger.debug('[LSResolver ASTFallback] Retry AST QuickInfo returned:', astQuickInfo);
                                return astQuickInfo;
                            }
                        } else {
                            Logger.debug('[LSResolver ASTFallback] No identifier found near TSX offset:', tsxOffset);
                }
            }
                }
            }
            // QuickInfo contains a textSpan in TSX coordinates. It needs to be mapped back by the caller.
            return quickInfo;
        };

        return {
            tsDoc,
            lang, // return the wrapped version
            userPreferences,
            lsContainer
        };
    }

    /**
     * Retrieves the LS for operations that don't need cross-files information.
     * can save some time by not synchronizing languageService program
     */
    async getLsForSyntheticOperations(document: Document): Promise<{
        tsDoc: SvelteDocumentSnapshot;
        lang: ts.LanguageService;
        userPreferences: ts.UserPreferences;
    }> {
        const { tsDoc, lsContainer, userPreferences } = await this.getLSAndTSDocWorker(document);

        return { tsDoc, userPreferences, lang: lsContainer.getService(/* skipSynchronize */ true) };
    }

    private async getLSAndTSDocWorker(document: Document) {
        const lsContainer = await this.getTSService(document.getFilePath() || '');
        const tsDoc = await this.getOrCreateSnapshot(document);
        const userPreferences = this.getUserPreferences(tsDoc);

        return { tsDoc, lsContainer, userPreferences };
    }

    /**
     * Retrieves and updates the snapshot for the given document or path from
     * the ts service it primarily belongs into.
     * The update is mirrored in all other services, too.
     */
    async getOrCreateSnapshot(document: Document): Promise<SvelteDocumentSnapshot>;
    async getOrCreateSnapshot(pathOrDoc: string | Document): Promise<DocumentSnapshot>;
    async getOrCreateSnapshot(pathOrDoc: string | Document) {
        const filePath = typeof pathOrDoc === 'string' ? pathOrDoc : pathOrDoc.getFilePath() || '';
        const tsService = await this.getTSService(filePath);
        return tsService.updateSnapshot(pathOrDoc);
    }
    private async updateSnapshot(document: Document) {
        const filePath = document.getFilePath();
        if (!filePath) {
            return;
        }
        // ensure no new service is created
        await this.updateExistingFile(filePath, (service) => service.updateSnapshot(document));
    }

    /**
     * Updates snapshot path in all existing ts services and retrieves snapshot
     */
    async updateSnapshotPath(oldPath: string, newPath: string): Promise<void> {
        const document = this.docManager.get(pathToUrl(oldPath));
        const isOpenedInClient = document?.openedByClient;
        for (const snapshot of this.globalSnapshotsManager.getByPrefix(oldPath)) {
            await this.deleteSnapshot(snapshot.filePath);
        }

        if (isOpenedInClient) {
            this.docManager.openClientDocument({
                uri: pathToUrl(newPath),
                text: document!.getText()
            });
        } else {
            // This may not be a file but a directory, still try
            await this.getOrCreateSnapshot(newPath);
        }
    }

    /**
     * Deletes snapshot in all existing ts services
     */
    async deleteSnapshot(filePath: string) {
        await forAllServices((service) => service.deleteSnapshot(filePath));
        const uri = pathToUrl(filePath);
        if (this.docManager.get(uri)) {
            // Guard this call, due to race conditions it may already have been closed;
            // also this may not be a Svelte file
            this.docManager.closeDocument(uri);
        }
        this.docManager.releaseDocument(uri);
    }

    async invalidateModuleCache(filePaths: string[]) {
        await forAllServices((service) => service.invalidateModuleCache(filePaths));
    }

    /**
     * Updates project files in all existing ts services
     */
    async updateProjectFiles(watcherNewFiles: string[]) {
        await forAllServices((service) => service.scheduleProjectFileUpdate(watcherNewFiles));
    }

    /**
     * Updates file in all ts services where it exists
     */
    async updateExistingTsOrJsFile(
        path: string,
        changes?: TextDocumentContentChangeEvent[]
    ): Promise<void> {
        await this.updateExistingFile(path, (service) => service.updateTsOrJsFile(path, changes));
    }

    async updateExistingSvelteFile(path: string): Promise<void> {
        const newDocument = this.createDocument(path, this.tsSystem.readFile(path) ?? '');
        await this.updateExistingFile(path, (service) => {
            service.updateSnapshot(newDocument);
        });
    }

    private async updateExistingFile(
        path: string,
        cb: (service: LanguageServiceContainer) => void
    ) {
        path = normalizePath(path);
        // Only update once because all snapshots are shared between
        // services. Since we don't have a current version of TS/JS
        // files, the operation wouldn't be idempotent.
        let didUpdate = false;
        await forAllServices((service) => {
            if (service.hasFile(path) && !didUpdate) {
                didUpdate = true;
                cb(service);
            }
        });
    }

    async getTSService(filePath?: string): Promise<LanguageServiceContainer> {
        if (this.options?.tsconfigPath) {
            return this.getTSServiceByConfigPath(
                this.options.tsconfigPath,
                dirname(this.options.tsconfigPath)
            );
        }
        if (!filePath) {
            throw new Error('Cannot call getTSService without filePath and without tsconfigPath');
        }
        return getService(filePath, this.workspaceUris, this.lsDocumentContext);
    }

    async getTSServiceByConfigPath(
        tsconfigPath: string,
        workspacePath: string
    ): Promise<LanguageServiceContainer> {
        return getServiceForTsconfig(tsconfigPath, workspacePath, this.lsDocumentContext);
    }

    private getUserPreferences(tsDoc: DocumentSnapshot): ts.UserPreferences {
        const configLang =
            tsDoc.scriptKind === ts.ScriptKind.TS || tsDoc.scriptKind === ts.ScriptKind.TSX
                ? 'typescript'
                : 'javascript';

        const nearestWorkspaceUri = this.workspaceUris.find((workspaceUri) =>
            isSubPath(workspaceUri, tsDoc.filePath, this.getCanonicalFileName)
        );

        return this.configManager.getTsUserPreferences(
            configLang,
            nearestWorkspaceUri ? urlToPath(nearestWorkspaceUri) : null
        );
    }

    private getTsUserPreferences() {
        return this.configManager.getTsUserPreferences('typescript', null);
    }

    private wrapWithPackageJsonMonitoring(sys: ts.System): ts.System {
        if (!sys.watchFile || !this.options?.watch) {
            return sys;
        }

        const watchFile = sys.watchFile;
        return {
            ...sys,
            readFile: (path, encoding) => {
                if (path.endsWith('package.json') && !this.packageJsonWatchers.has(path)) {
                    this.packageJsonWatchers.set(
                        path,
                        watchFile(path, this.onPackageJsonWatchChange.bind(this), 3_000)
                    );
                }

                return sys.readFile(path, encoding);
            }
        };
    }

    private onPackageJsonWatchChange(path: string, onWatchChange: ts.FileWatcherEventKind) {
        const dir = dirname(path);
        const projectService = this.lsDocumentContext.projectService;
        const packageJsonCache = projectService?.packageJsonCache;
        const normalizedPath = projectService?.toPath(path);

        if (onWatchChange === ts.FileWatcherEventKind.Deleted) {
            this.packageJsonWatchers.get(path)?.close();
            this.packageJsonWatchers.delete(path);
            packageJsonCache?.delete(normalizedPath);
        } else {
            packageJsonCache?.addOrUpdate(normalizedPath);
        }

        forAllServices((service) => {
            service.onPackageJsonChange(path);
        });
        if (!path.includes('node_modules')) {
            return;
        }

        setTimeout(() => {
            this.updateSnapshotsInDirectory(dir);
            const realPath =
                this.tsSystem.realpath &&
                this.getCanonicalFileName(normalizePath(this.tsSystem.realpath?.(dir)));

            // pnpm
            if (realPath && realPath !== dir) {
                this.updateSnapshotsInDirectory(realPath);
                const realPkgPath = join(realPath, 'package.json');
                forAllServices((service) => {
                    service.onPackageJsonChange(realPkgPath);
                });
            }
        }, 500);
    }

    private updateSnapshotsInDirectory(dir: string) {
        this.globalSnapshotsManager.getByPrefix(dir).forEach((snapshot) => {
            this.globalSnapshotsManager.updateTsOrJsFile(snapshot.filePath);
        });
    }

    private watchDirectory(patterns: RelativePattern[]) {
        if (!this.options?.watchDirectory || patterns.length === 0) {
            return;
        }

        for (const pattern of patterns) {
            const uri = typeof pattern.baseUri === 'string' ? pattern.baseUri : pattern.baseUri.uri;
            for (const watched of this.watchedDirectories) {
                if (isSubPath(watched, uri, this.getCanonicalFileName)) {
                    return;
                }
            }
        }
        this.options.watchDirectory(patterns);
    }
}
