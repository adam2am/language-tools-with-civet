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
        const lang = origLang;
        const origGetDef = lang.getDefinitionAtPosition.bind(lang);
        lang.getDefinitionAtPosition = (fileName: string, position: number) => {
            Logger.debug('[TS Debug] getDefinitionAtPosition', fileName, position);
            const defs = origGetDef(fileName, position);
            Logger.debug('[TS Debug] returned definitions:', defs);
            if ((!defs || defs.length === 0) && typeof position === 'number') {
                try {
                    const program = origLang.getProgram();
                    if (program) {
                        const sourceFile = program.getSourceFile(fileName);
                        if (sourceFile) {
                            const fullText = sourceFile.getFullText();
                            const start = Math.max(0, position - 50);
                            const snippet = fullText.substring(start, position + 50);
                            Logger.debug('[TS Debug] Text around position:\n' + snippet);
                            
                            let node: ts.Node | undefined = sourceFile;
                            // Simplified node finding logic
                            sourceFile.forEachChild(function iterate(child) {
                                if (child.pos <= position && position < child.end) {
                                    node = child;
                                    ts.forEachChild(child, iterate);
                                }
                            });

                            if (node && node !== sourceFile) {
                                Logger.debug('[TS Debug] Node kind:', ts.SyntaxKind[node.kind], 'text:', node.getText(sourceFile));
                                const checker = program.getTypeChecker();
                                const symbol = checker.getSymbolAtLocation(node);
                                Logger.debug('[TS Debug] Symbol at node:', symbol?.getName(), symbol);
                            } else if (node === sourceFile) {
                                Logger.debug('[TS Debug] Could not find specific node at position', position, '; node is SourceFile.');
                            } else {
                                Logger.debug('[TS Debug] No node found at position', position);
                            }
                            // Fallback: if defs empty and node is not Identifier, try nearest identifier on same line
                            if ((!defs || defs.length === 0) && node && node.kind !== ts.SyntaxKind.Identifier) {
                                const lineStarts = sourceFile.getLineStarts();
                                // find line number
                                let lineNumber = lineStarts.findIndex((ls) => ls > position) - 1;
                                if (lineNumber < 0) lineNumber = 0;
                                const lineStartOff = lineStarts[lineNumber];
                                const lineEndOff = lineStarts[lineNumber + 1] ?? fullText.length;
                                const lineText = fullText.substring(lineStartOff, lineEndOff);
                                const relativePos = position - lineStartOff;
                                const identifierRegex = /[A-Za-z_$][A-Za-z0-9_$]*/g;
                                let match: RegExpExecArray | null;
                                let fallbackOffset: number | null = null;
                                while ((match = identifierRegex.exec(lineText))) {
                                    const start = match.index;
                                    const end = start + match[0].length;
                                    if (start <= relativePos && relativePos <= end) {
                                        fallbackOffset = lineStartOff + start + Math.floor(match[0].length / 2);
                                        break;
                                    }
                                    if (start > relativePos) {
                                        fallbackOffset = lineStartOff + start + Math.floor(match[0].length / 2);
                                        break;
                                    }
                                }
                                if (fallbackOffset !== null) {
                                    Logger.debug('[TS Hack] retrying getDefinitionAtPosition at', fallbackOffset);
                                    const retryDefs = origGetDef(fileName, fallbackOffset);
                                    Logger.debug('[TS Hack] retry returned definitions:', retryDefs);
                                    if (retryDefs && retryDefs.length > 0) {
                                        return retryDefs;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    Logger.error('[TS Debug] error introspecting AST at position', position, e);
                }
            }
            return defs;
        };
        return {
            tsDoc,
            lang,
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
