import { Document } from '../../lib/documents';
import * as civet from '@danielx/civet';
import { TagInformation } from '../../lib/documents/utils';
import {
    DiagnosticsProvider,
    HoverProvider,
    CompletionsProvider,
    CodeActionsProvider,
    SelectionRangeProvider
} from '../interfaces';
import { LSConfigManager } from '../../ls-config';
import {
    Diagnostic,
    CompletionList,
    Hover,
    CodeAction,
    CodeActionContext,
    Range,
    Position,
    WorkspaceEdit
} from 'vscode-languageserver';
import { HoverProviderImpl } from '../typescript/features/HoverProvider';
import { DiagnosticsProviderImpl } from '../typescript/features/DiagnosticsProvider';
import { CompletionsProviderImpl } from '../typescript/features/CompletionProvider';
import { CodeActionsProviderImpl } from '../typescript/features/CodeActionsProvider';
import { LSAndTSDocResolver } from '../typescript/LSAndTSDocResolver';
import { SelectionRangeProviderImpl } from '../typescript/features/SelectionRangeProvider';
import { CivetLanguageServiceHost, SourceMapLinesEntry } from '../../typescriptServiceHost';



// Remaining critical TODOs in CivetPlugin.ts's handleDocumentChange method:
// CivetSourceMapping interface verification: The placeholder CivetSourceMapping interface needs its property names (sourceLine, sourceColumn, generatedLine, generatedColumn) and indexing (0-based vs 1-based) to be verified against the actual structure provided by @danielx/civet's compileResult.sourceMap.lines. This is crucial for transformCivetSourcemapLines to work correctly.
// Line/Column Indexing: The transformCivetSourcemapLines function currently assumes Civet provides 0-indexed lines and SourceMapLinesEntry expects 1-indexed lines (hence + 1). This also needs verification. Columns are assumed to be 0-indexed in both.
// Extracting Civet Script Content: The line const civetCode = document.getText(); is a placeholder. We need a robust way to get only the content of the <script lang="civet"> ... </script> tag from the full Svelte Document object. The SveltePlugin or Document class itself might have utilities for this (e.g., document.getScriptText()). If not, a reliable parsing step (e.g., using a simple regex or a more robust Svelte parser if available in the context) is needed.


// Removed CivetSourceMapping interface as it's not used.

/**
 * Transforms the Civet compiler's sourcemap line structure (decoded VLQ segments per line)
 * into the flat SourceMapLinesEntry[] expected by CivetLanguageServiceHost.
 * Civet's `sourceMap.lines` provides `MappingItem[][]` where `MappingItem` is
 * `[generatedColumn, sourceFileIndex, sourceLine, sourceColumn, nameIndex?]`.
 * All line/column numbers from Civet are 0-indexed.
 * `SourceMapLinesEntry` expects 1-indexed lines and 0-indexed columns.
 */
export function transformCivetSourcemapLines(decodedMappings: number[][][]): SourceMapLinesEntry[] {
    const transformed: SourceMapLinesEntry[] = [];
    if (!decodedMappings) return transformed;

    decodedMappings.forEach((lineSegments, generatedLineIndex) => {
        if (!lineSegments) return;
        for (const segment of lineSegments) {
            if (!segment || segment.length < 4) continue; // Ensure segment has enough elements

            // segment is [generatedColumn, sourceFileIndex, originalSourceLine, originalSourceColumn, nameIndex?]
            // All are 0-indexed from Civet.
            const generatedColumn = segment[0];
            // const sourceFileIndex = segment[1]; // Not directly used in SourceMapLinesEntry
            const originalSourceLine = segment[2];
            const originalSourceColumn = segment[3];

            transformed.push({
                originalLine: originalSourceLine + 1,      // Convert 0-indexed to 1-indexed
                originalColumn: originalSourceColumn,        // Already 0-indexed
                generatedLine: generatedLineIndex + 1,     // Convert 0-indexed to 1-indexed
                generatedColumn: generatedColumn,          // Already 0-indexed
            });
        }
    });
    return transformed;
}

export class CivetPlugin implements
    DiagnosticsProvider,
    HoverProvider,
    CompletionsProvider,
    CodeActionsProvider,
    SelectionRangeProvider {
    __name = 'civet';

    private hoverProvider: HoverProviderImpl;
    private diagnosticsProvider: DiagnosticsProviderImpl;
    private completionsProvider: CompletionsProviderImpl;
    private codeActionsProvider: CodeActionsProviderImpl;
    private selectionRangeProvider: SelectionRangeProviderImpl;
    private compiledCivetCache = new Map<string, { version: number, compiledTsCode: string, sourcemapLines: SourceMapLinesEntry[] }>();

    constructor(
        private configManager: LSConfigManager, 
        private lsAndTSDocResolver: LSAndTSDocResolver,
        private civetLanguageServiceHost: CivetLanguageServiceHost
    ) {
        this.hoverProvider = new HoverProviderImpl(this.lsAndTSDocResolver);
        this.diagnosticsProvider = new DiagnosticsProviderImpl(this.lsAndTSDocResolver, this.configManager);
        this.completionsProvider = new CompletionsProviderImpl(this.lsAndTSDocResolver, this.configManager);
        this.codeActionsProvider = new CodeActionsProviderImpl(this.lsAndTSDocResolver, this.completionsProvider, this.configManager);
        this.selectionRangeProvider = new SelectionRangeProviderImpl(this.lsAndTSDocResolver);
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return [];
        }
        return this.diagnosticsProvider.getDiagnostics(document);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        return this.hoverProvider.doHover(document, position);
    }

    async getCompletions(
        document: Document,
        position: Position,
        _?: any,
        _token?: any
    ): Promise<CompletionList | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        return this.completionsProvider.getCompletions(document, position);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return [];
        }
        return this.codeActionsProvider.getCodeActions(document, range, context);
    }

    async executeCommand(
        document: Document,
        command: string,
        _args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        // Delegate to TS code-actions executeCommand
        const res = this.codeActionsProvider.executeCommand
            ? await this.codeActionsProvider.executeCommand(document, command, _args)
            : null;
        if (res == null) {
            console.warn(`Needed implemetation for CivetPlugin.executeCommand: no result for command ${command}`);
        }
        return res;
    }

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<any> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        // Delegate to TS selection-range provider
        const res = await this.selectionRangeProvider.getSelectionRange(document, position);
        if (res == null) {
            console.warn(`Needed implemetation for CivetPlugin.getSelectionRange: no range for position ${position.line},${position.character}`);
        }
        return res;
    }

    public async handleDocumentChange(document: Document): Promise<void> {
        // Determine which script tag (instance or module) is the Civet script.
        let civetTagInfo: TagInformation | null = null;
        const scriptLang = document.scriptInfo?.attributes['lang'] || document.scriptInfo?.attributes['type'];
        const moduleScriptLang = document.moduleScriptInfo?.attributes['lang'] || document.moduleScriptInfo?.attributes['type'];
    
        // Prioritize instance script, then check module script if instance isn't 'civet'.
        // A more sophisticated check might be needed if a file can have non-Civet instance script AND a Civet module script.
        if (scriptLang === 'civet') {
            civetTagInfo = document.scriptInfo;
        } else if (document.scriptInfo?.attributes['lang'] === undefined && !scriptLang && document.getLanguageAttribute('script') === 'civet') {
            // Fallback for default language being civet on instance script
            civetTagInfo = document.scriptInfo;
        } else if (moduleScriptLang === 'civet') {
            civetTagInfo = document.moduleScriptInfo;
        } else if (document.moduleScriptInfo?.attributes['lang'] === undefined && !moduleScriptLang && document.getLanguageAttribute('script') === 'civet') {
            // Fallback for default language being civet on module script, assuming getLanguageAttribute reflects combined logic
            // This path assumes getLanguageAttribute might return 'civet' if module script is the one set to civet.
            civetTagInfo = document.moduleScriptInfo; 
        }
    
        if (!civetTagInfo) {
            return;
        }
    
        const svelteFileVersion = document.version;
    
        const cached = this.compiledCivetCache.get(document.uri);

        // The TagInformation interface has a `content: string` field
        const civetCode = civetTagInfo.content; 
    
        if (cached && cached.version === svelteFileVersion /* && cached.source === civetCode */) {
            this.civetLanguageServiceHost.updateCivetFile(document.uri, cached.compiledTsCode, cached.sourcemapLines);
            return;
        }
    
        try {
            const compileResult = civet.compile(civetCode, {
                js: false, 
                sourceMap: true,
                inlineMap: false, 
                filename: document.uri, 
                sync: true
            });
    
            const compiledTsCode = compileResult.code;
            let finalSourcemapLines: SourceMapLinesEntry[] = [];
    
            if (compileResult.sourceMap && compileResult.sourceMap.lines) {
                // No longer casting, direct pass-through of the expected number[][][] structure
                finalSourcemapLines = transformCivetSourcemapLines(compileResult.sourceMap.lines);
            } else {
                console.warn(`Civet compiler for ${document.uri} did not produce sourceMap.lines structure.`);
            }
            
            this.civetLanguageServiceHost.updateCivetFile(document.uri, compiledTsCode, finalSourcemapLines);
    
            this.compiledCivetCache.set(document.uri, {
                version: svelteFileVersion,
                // source: civetCode, // Optional: cache raw source for more robust cache check
                compiledTsCode,
                sourcemapLines: finalSourcemapLines
            });
    
        } catch (error) {
            console.error(`Error compiling Civet script in ${document.uri} (lang: ${civetTagInfo.attributes['lang']}):`, error);
            if (cached && cached.version === svelteFileVersion) {
                this.compiledCivetCache.delete(document.uri);
            }
        }
    }
} 