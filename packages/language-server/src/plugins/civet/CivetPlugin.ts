import { Document, TagInformation } from '../../lib/documents';
import * as civet from '@danielx/civet';
import {
    DiagnosticsProvider,
    HoverProvider,
    CompletionsProvider,
    CodeActionsProvider,
    SelectionRangeProvider,
    DefinitionsProvider
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
    WorkspaceEdit,
    DefinitionLink,
    CompletionContext
} from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../typescript/LSAndTSDocResolver';
import { SelectionRangeProviderImpl } from '../typescript/features/SelectionRangeProvider';
import { CivetLanguageServiceHost, SourceMapLinesEntry } from '../../typescriptServiceHost';
import * as ts from 'typescript';
import { forwardMap as civetForwardMap } from './civetUtils';

import { CivetDiagnosticsProvider } from './features/CivetDiagnosticProvider';
import { CivetHoverProvider } from './features/CivetHoverProvider';
import { CivetCompletionsProvider } from './features/CivetCompletionsProvider';
import { CivetCodeActionsProvider } from './features/CivetCodeActionsProvider';
import { CivetDefinitionsProvider } from './features/CivetDefinitionsProvider';

/**
 * Transforms the Civet compiler's sourcemap line structure (decoded VLQ segments per line)
 * into the flat SourceMapLinesEntry[] expected by CivetLanguageServiceHost.
 */
export function transformCivetSourcemapLines(decodedMappings: number[][][]): SourceMapLinesEntry[] {
    const transformed: SourceMapLinesEntry[] = [];
    if (!decodedMappings) return transformed;

    decodedMappings.forEach((lineSegments, generatedLineIndex) => {
        if (!lineSegments) return;

        for (const segment of lineSegments) {
            if (!segment || segment.length < 4) { 
                continue; 
            }
            const generatedColumn = segment[0]; 
            const originalSourceLine = segment[2];
            const originalSourceColumn = segment[3];
            
            if (originalSourceLine < 0 ) {
                continue;
            }
            const clampedOriginalSourceColumn = Math.max(0, originalSourceColumn);

            transformed.push({
                originalLine: originalSourceLine + 1,      
                originalColumn: clampedOriginalSourceColumn, 
                generatedLine: generatedLineIndex + 1,     
                generatedColumn: generatedColumn,          
            });
        }
    });
    return transformed;
}

export interface MappingPosition { 
    line: number; 
    character: number; 
}

// This is EXPORTED because CivetLanguageServiceHost also needs to remap positions from TS to Civet
// For now, its main use is within CivetPlugin for LSP features -> NOW USED BY PROVIDERS
export function remapPosition(sourcemapLines: SourceMapLinesEntry[], generatedPosition: MappingPosition): MappingPosition {
    if (!sourcemapLines || sourcemapLines.length === 0) {
        return generatedPosition;
    }

    const generatedLine1Indexed = generatedPosition.line + 1;
    let bestMatch: SourceMapLinesEntry | null = null;

    for (const entry of sourcemapLines) {
        if (entry.generatedLine === generatedLine1Indexed && entry.generatedColumn <= generatedPosition.character) {
            if (!bestMatch || 
                entry.generatedColumn > bestMatch.generatedColumn || 
                (entry.generatedColumn === bestMatch.generatedColumn && entry.originalColumn < bestMatch.originalColumn)) {
                bestMatch = entry;
            }
        }
    }

    if (bestMatch) {
        const charOffset = generatedPosition.character - bestMatch.generatedColumn;
        const result = {
            line: bestMatch.originalLine - 1, 
            character: bestMatch.originalColumn + charOffset
        };
        return result;
    }
    
    const lineMatches = sourcemapLines.filter(entry => entry.generatedLine === generatedLine1Indexed);
    if (lineMatches.length > 0) {
        lineMatches.sort((a, b) => a.generatedColumn - b.generatedColumn);
        const fallbackResult = {
            line: lineMatches[0].originalLine - 1,
            character: lineMatches[0].originalColumn
        };
        console.warn(`[remapPosition] WARN: No direct char match. Fallback to line match. Generated: ${JSON.stringify(generatedPosition)} -> Result: ${JSON.stringify(fallbackResult)}`);
        return fallbackResult;
    }

    console.warn(`[remapPosition] WARN: No mapping found for ${JSON.stringify(generatedPosition)}. Returning generatedPosition.`);
    return generatedPosition; 
}

export function getCivetTagInfo(document: Document): TagInformation | null {
    let civetTagInfo: TagInformation | null = null;
    const scriptInfo = document.scriptInfo;
    const moduleScriptInfo = document.moduleScriptInfo;

    const getLang = (attrs: Record<string, string | boolean>) => attrs['lang'] || attrs['type'];

    if (scriptInfo) {
        const scriptLang = getLang(scriptInfo.attributes);
        if (scriptLang === 'civet' || (scriptLang === undefined && document.getLanguageAttribute('script') === 'civet')) {
            civetTagInfo = scriptInfo;
        }
    }
    if (!civetTagInfo && moduleScriptInfo) {
        const moduleScriptLang = getLang(moduleScriptInfo.attributes);
        if (moduleScriptLang === 'civet' || (moduleScriptLang === undefined && document.getLanguageAttribute('script') === 'civet')) {
            civetTagInfo = moduleScriptInfo;
        }
    }
    
    if (civetTagInfo && typeof civetTagInfo.start !== 'number') {
        console.error(`[CivetPlugin] getCivetTagInfo: Found civetTagInfo for ${document.uri} but it's missing start offset.`);
        return null;
    }

    if (civetTagInfo && !civetTagInfo.startPos) {
        if (typeof civetTagInfo.start === 'number' && typeof document.positionAt === 'function') {
            civetTagInfo.startPos = document.positionAt(civetTagInfo.start);
        } else {
            console.error(`[CivetPlugin] getCivetTagInfo: Cannot derive startPos for ${document.uri}. Missing start offset or positionAt method.`);
            return null; 
        }
    }
    if (civetTagInfo && !civetTagInfo.startPos) { 
        console.error(`[CivetPlugin] getCivetTagInfo: Critical - startPos still missing on civetTagInfo for ${document.uri}.`);
        return null;
    }
    return civetTagInfo;
}

export function adjustTsPositionForLeadingNewline(tsPosition: Position, tsHostCode: string): Position {
    if (tsHostCode.startsWith('\n') && tsPosition.line > 0) {
        return { line: tsPosition.line - 1, character: tsPosition.character };
    }
    return tsPosition;
}

export function svelteDocPositionToCivetContentRelative(svelteDocPos: Position, scriptStartPosition: Position): MappingPosition {
    const contentRelativeLine = svelteDocPos.line - scriptStartPosition.line;
    let contentRelativeChar = svelteDocPos.character;
    if (svelteDocPos.line === scriptStartPosition.line) {
        contentRelativeChar = svelteDocPos.character - scriptStartPosition.character;
    }
    contentRelativeChar = Math.max(0, contentRelativeChar); 
    return { line: contentRelativeLine, character: contentRelativeChar };
}

export function civetContentPositionToSvelteDocRelative(contentRelativePos: MappingPosition, scriptStartPosition: Position): Position {
    const svelteDocLine = contentRelativePos.line + scriptStartPosition.line;
    let svelteDocChar = contentRelativePos.character;
    if (contentRelativePos.line === 0) { 
        svelteDocChar = contentRelativePos.character + scriptStartPosition.character;
    }
    return { line: svelteDocLine, character: svelteDocChar };
}

export class CivetPlugin implements
    DiagnosticsProvider,
    HoverProvider,
    CompletionsProvider,
    CodeActionsProvider,
    SelectionRangeProvider,
    DefinitionsProvider {
    __name = 'civet';

    private diagnosticsProvider: CivetDiagnosticsProvider;
    private hoverProvider: CivetHoverProvider;
    private completionsProvider: CivetCompletionsProvider;
    private codeActionsProvider: CivetCodeActionsProvider;
    private definitionsProvider: CivetDefinitionsProvider;
    private selectionRangeProvider: SelectionRangeProviderImpl;

    public compiledCivetCache = new Map<string, { version: number, compiledTsCode: string, sourcemapLines: SourceMapLinesEntry[], rawSourcemapLines: number[][][], originalContentLineOffset: number }>();
    public civetLanguageServiceHost: CivetLanguageServiceHost;

    constructor(
        private configManager: LSConfigManager, 
        private lsAndTSDocResolver: LSAndTSDocResolver,
        civetLanguageServiceHost: CivetLanguageServiceHost
    ) {
        this.civetLanguageServiceHost = civetLanguageServiceHost;
        
        this.diagnosticsProvider = new CivetDiagnosticsProvider(this.lsAndTSDocResolver, this.configManager, this);
        this.hoverProvider = new CivetHoverProvider(this.lsAndTSDocResolver, this);
        this.completionsProvider = new CivetCompletionsProvider(this.lsAndTSDocResolver, this.configManager, this);
        this.codeActionsProvider = new CivetCodeActionsProvider(this.lsAndTSDocResolver, this.configManager, this);
        this.definitionsProvider = new CivetDefinitionsProvider(this.lsAndTSDocResolver, this);
        this.selectionRangeProvider = new SelectionRangeProviderImpl(this.lsAndTSDocResolver);
    }

    private async ensureDocumentProcessed(document: Document): Promise<boolean> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return false;
        }
        await this.handleDocumentChange(document);
        const cached = this.compiledCivetCache.get(document.uri);
        if (!cached || !cached.compiledTsCode) {
            return false;
        }
        return true;
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!await this.ensureDocumentProcessed(document)) return [];
        return this.diagnosticsProvider.getDiagnostics(document);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (!await this.ensureDocumentProcessed(document)) return null;
        return this.hoverProvider.doHover(document, position);
    }

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<CompletionList | null> {
        if (!await this.ensureDocumentProcessed(document)) return null;
                return this.completionsProvider.getCompletions(document, position, completionContext);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        if (!await this.ensureDocumentProcessed(document)) return [];
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
        return this.codeActionsProvider.executeCommand(document, command, _args);
    }

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<any> {
        if (!await this.ensureDocumentProcessed(document)) return null;
        return this.selectionRangeProvider.getSelectionRange(document, position);
    }

    async getDefinitions(document: Document, position: Position): Promise<DefinitionLink[]> {
        if (!await this.ensureDocumentProcessed(document)) return [];
        return this.definitionsProvider.getDefinitions(document, position);
    }

    public async handleDocumentChange(document: Document): Promise<void> {
        const civetTagInfo = getCivetTagInfo(document);

        if (!civetTagInfo || !civetTagInfo.startPos) {
            this.compiledCivetCache.delete(document.uri);
            this.civetLanguageServiceHost.updateCivetFile(document.uri, "", []);
            return;
        }
        
        const currentVersion = document.version;
        const cached = this.compiledCivetCache.get(document.uri);

        if (cached && cached.version === currentVersion) {
            this.civetLanguageServiceHost.updateCivetFile(document.uri, cached.compiledTsCode, cached.sourcemapLines);
            return;
        }
        
        const civetCode = civetTagInfo.content;
        let civetCodeForCompilation = civetCode;
        let originalContentLineOffset = 0;

        const firstLineEndIndex = civetCodeForCompilation.indexOf('\n');
        if (firstLineEndIndex !== -1) {
            const firstLine = civetCodeForCompilation.substring(0, firstLineEndIndex);
            if (firstLine.trim() === '') {
                const potentialCodeAfterFirstLine = civetCodeForCompilation.substring(firstLineEndIndex + 1);
                if (potentialCodeAfterFirstLine.trim() !== '') { 
                    civetCodeForCompilation = potentialCodeAfterFirstLine;
                    originalContentLineOffset = 1;
                }
            }
        }

        if (!civetCodeForCompilation.trim()) {
            this.compiledCivetCache.delete(document.uri);
            this.civetLanguageServiceHost.updateCivetFile(document.uri, "", []);
            return;
        }
        
        try {
            const compileResult = civet.compile(civetCodeForCompilation, {
                js: false, 
                sourceMap: true,
                inlineMap: false, 
                filename: document.uri, 
                sync: true
            });
    
            const compiledTsCode = compileResult.code;
            let finalSourcemapLines: SourceMapLinesEntry[] = [];
            let rawSourcemapForCache: number[][][] = [];
    
            if (compileResult.sourceMap && compileResult.sourceMap.lines) {
                finalSourcemapLines = transformCivetSourcemapLines(compileResult.sourceMap.lines);
                rawSourcemapForCache = compileResult.sourceMap.lines;
            } else {
                console.warn(`[CivetPlugin] No sourcemap lines found in compileResult for ${document.uri}`);
            }
            
            this.civetLanguageServiceHost.updateCivetFile(document.uri, compiledTsCode, finalSourcemapLines);
            this.compiledCivetCache.set(document.uri, { 
                version: currentVersion, 
                compiledTsCode, 
                sourcemapLines: finalSourcemapLines,
                rawSourcemapLines: rawSourcemapForCache,
                originalContentLineOffset
            });

        } catch (e: any) {
            console.error(`[CivetPlugin] Error during Civet compilation or processing for ${document.uri}:`, e.message, e.stack);
            this.compiledCivetCache.delete(document.uri);
            this.civetLanguageServiceHost.updateCivetFile(document.uri, "", []);
        }
    }
} 