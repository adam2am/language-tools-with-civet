import { Document } from '../../lib/documents';
import * as civet from '@danielx/civet';
import { TagInformation } from '../../lib/documents/utils';
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
    Location,
    DefinitionLink,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    CompletionContext
} from 'vscode-languageserver';
import { HoverProviderImpl } from '../typescript/features/HoverProvider';
import { DiagnosticsProviderImpl } from '../typescript/features/DiagnosticsProvider';
import { CompletionsProviderImpl } from '../typescript/features/CompletionProvider';
import { CodeActionsProviderImpl } from '../typescript/features/CodeActionsProvider';
import { LSAndTSDocResolver } from '../typescript/LSAndTSDocResolver';
import { SelectionRangeProviderImpl } from '../typescript/features/SelectionRangeProvider';
import { CivetLanguageServiceHost, SourceMapLinesEntry } from '../../typescriptServiceHost';
import { scriptElementKindToCompletionItemKind } from '../typescript/utils';
import * as ts from 'typescript';
import { remapPosition as civetRemapPosition, forwardMap as civetForwardMap } from './civetUtils';



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

    // console.log("[transformCivetSourcemapLines] Input decodedMappings (first 5 lines):", JSON.stringify(decodedMappings.slice(0,5), null, 2));

    decodedMappings.forEach((lineSegments, generatedLineIndex) => {
        if (!lineSegments) return;
        
        // let currentGeneratedColumn = 0; // Not needed if segments are absolute

        for (const segment of lineSegments) {
            if (!segment || segment.length < 4) { // segment: [genCol, srcFileIdx, origLine, origCol, nameIdx?]
                // console.log(`[transformCivetSourcemapLines] Skipping invalid segment on genLine ${generatedLineIndex}: ${JSON.stringify(segment)}`);
                continue; 
            }

            const generatedColumn = segment[0]; 
            // const sourceFileIndex = segment[1]; // Not directly used
            const originalSourceLine = segment[2]; // Assumed absolute 0-indexed
            const originalSourceColumn = segment[3]; // Assumed absolute 0-indexed
            
            // Basic validation: originalSourceLine and originalSourceColumn should not be negative.
            // Civet might sometimes produce negative originalSourceColumn for the very first mapping of a file (e.g. -1)
            // which should effectively be 0. Let's clamp it.
            if (originalSourceLine < 0 ) {
                // console.warn(\`[transformCivetSourcemapLines] Encountered negative originalSourceLine (\${originalSourceLine}) for generated line \${generatedLineIndex}, segment \${JSON.stringify(segment)}. Skipping segment.\`);
                continue;
            }
            const clampedOriginalSourceColumn = Math.max(0, originalSourceColumn);


            transformed.push({
                originalLine: originalSourceLine + 1,      // Convert 0-indexed to 1-indexed
                originalColumn: clampedOriginalSourceColumn, // Use clamped 0-indexed value
                generatedLine: generatedLineIndex + 1,     // Convert 0-indexed to 1-indexed
                generatedColumn: generatedColumn,          // Already 0-indexed
            });
            // currentGeneratedColumn = generatedColumn; // Not needed if segments are absolute
        }
    });
    // console.log("[transformCivetSourcemapLines] Transformed (first 20 entries):", JSON.stringify(transformed.slice(0,20), null, 2));
    return transformed;
}

// Helper type for Position, assuming 0-indexed lines and characters for internal use with these mappers
// VSCode LSP types are 0-indexed, so this aligns well.
interface MappingPosition {
    line: number; // 0-indexed
    character: number; // 0-indexed
}

// Local remapPosition - kept as it uses SourceMapLinesEntry[] from cache which is already transformed
// This is EXPORTED because CivetLanguageServiceHost also needs to remap positions from TS to Civet
// when providing diagnostics, for example. Or it would if it were doing that yet.
// For now, its main use is within CivetPlugin for LSP features.
export function remapPosition(sourcemapLines: SourceMapLinesEntry[], generatedPosition: MappingPosition): MappingPosition {
    console.log(`[remapPosition] Input: generatedPosition=${JSON.stringify(generatedPosition)}`);
    if (!sourcemapLines || sourcemapLines.length === 0) {
        // console.log("[remapPosition] No sourcemap lines or empty. Returning generatedPosition."); // Less verbose
        return generatedPosition;
    }

    const generatedLine1Indexed = generatedPosition.line + 1;
    let bestMatch: SourceMapLinesEntry | null = null;
    // console.log(`[remapPosition] Searching for generatedLine1Indexed=${generatedLine1Indexed}, generatedPosition.character=${generatedPosition.character}`); // Less verbose

    for (const entry of sourcemapLines) {
        // This per-entry log is very verbose, comment out for general use
        // console.log(`[remapPosition] Checking entry: ${JSON.stringify(entry)}`);
        if (entry.generatedLine === generatedLine1Indexed && entry.generatedColumn <= generatedPosition.character) {
            if (!bestMatch || 
                entry.generatedColumn > bestMatch.generatedColumn || 
                (entry.generatedColumn === bestMatch.generatedColumn && entry.originalColumn < bestMatch.originalColumn)) { // Prefer smaller original column if generated are same
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
        // console.log(`[remapPosition] Best match found: ${JSON.stringify(bestMatch)}. Calculated offset: ${charOffset}. Result: ${JSON.stringify(result)}`); // Less verbose
        return result;
    }
    
    // console.log("[remapPosition] No best match with character awareness. Attempting fallback for line."); // Less verbose
    const lineMatches = sourcemapLines.filter(entry => entry.generatedLine === generatedLine1Indexed);
    if (lineMatches.length > 0) {
        lineMatches.sort((a, b) => a.generatedColumn - b.generatedColumn);
        const fallbackResult = {
            line: lineMatches[0].originalLine - 1,
            character: lineMatches[0].originalColumn
        };
        console.log(`[remapPosition] WARN: No direct char match. Fallback to line match. Generated: ${JSON.stringify(generatedPosition)} -> First segment on line: ${JSON.stringify(lineMatches[0])}. Result: ${JSON.stringify(fallbackResult)}`);
        return fallbackResult;
    }

    console.log(`[remapPosition] WARN: No mapping found for ${JSON.stringify(generatedPosition)}. Returning generatedPosition.`);
    return generatedPosition; 
}

// Helper function to get the active Civet TagInformation
// Extracted from handleDocumentChange
function getCivetTagInfo(document: Document): TagInformation | null {
    let civetTagInfo: TagInformation | null = null;
    const scriptLang = document.scriptInfo?.attributes['lang'] || document.scriptInfo?.attributes['type'];
    const moduleScriptLang = document.moduleScriptInfo?.attributes['lang'] || document.moduleScriptInfo?.attributes['type'];

    if (scriptLang === 'civet') {
        civetTagInfo = document.scriptInfo;
    } else if (document.scriptInfo?.attributes['lang'] === undefined && !scriptLang && document.getLanguageAttribute('script') === 'civet') {
        civetTagInfo = document.scriptInfo;
    } else if (moduleScriptLang === 'civet') {
        civetTagInfo = document.moduleScriptInfo;
    } else if (document.moduleScriptInfo?.attributes['lang'] === undefined && !moduleScriptLang && document.getLanguageAttribute('script') === 'civet') {
        civetTagInfo = document.moduleScriptInfo;
    }
    
    // Ensure startPos is available, as it's crucial for mapping
    if (civetTagInfo && !civetTagInfo.startPos) {
        console.warn(`[CivetPlugin] getCivetTagInfo: Found civetTagInfo for ${document.uri} but it's missing startPos.`);
        // Attempt to derive from start offset if available and document.positionAt is a function
        if (typeof civetTagInfo.start === 'number' && typeof document.positionAt === 'function') {
            civetTagInfo.startPos = document.positionAt(civetTagInfo.start);
            console.log(`[CivetPlugin] getCivetTagInfo: Derived startPos for ${document.uri}: ${JSON.stringify(civetTagInfo.startPos)}`);
        } else {
            console.error(`[CivetPlugin] getCivetTagInfo: Cannot derive startPos for ${document.uri}.`);
            return null; // Or handle this case as appropriate
        }
    }
    if (civetTagInfo && !civetTagInfo.startPos) { // Double check after potential derivation
        console.error(`[CivetPlugin] getCivetTagInfo: Critical - startPos still missing on civetTagInfo for ${document.uri}. Aborting operation.`);
        return null;
    }

    return civetTagInfo;
}

// Helper to adjust TS Position if the host's code had a leading newline
function adjustTsPositionForLeadingNewline(tsPosition: Position, tsHostCode: string): Position {
    if (tsHostCode.startsWith('\n') && tsPosition.line > 0) {
        // console.log(`[adjustTsPositionForLeadingNewline] Adjusting tsPosition from ${JSON.stringify(tsPosition)} due to leading newline.`);
        return { line: tsPosition.line - 1, character: tsPosition.character };
    }
    return tsPosition;
}

// Helper to convert Svelte document Position to Civet content-relative MappingPosition
function svelteDocPositionToCivetContentRelative(svelteDocPos: Position, scriptStartPosition: Position): MappingPosition {
    const contentRelativeLine = svelteDocPos.line - scriptStartPosition.line;
    let contentRelativeChar = svelteDocPos.character;
    if (svelteDocPos.line === scriptStartPosition.line) {
        contentRelativeChar = svelteDocPos.character - scriptStartPosition.character;
    }
    // Ensure character is not negative, can happen if mapping is slightly off or at the very start
    contentRelativeChar = Math.max(0, contentRelativeChar); 
    return { line: contentRelativeLine, character: contentRelativeChar };
}

// Helper to convert Civet content-relative MappingPosition back to Svelte document Position
function civetContentPositionToSvelteDocRelative(contentRelativePos: MappingPosition, scriptStartPosition: Position): Position {
    const svelteDocLine = contentRelativePos.line + scriptStartPosition.line;
    let svelteDocChar = contentRelativePos.character;
    if (contentRelativePos.line === 0) { // Mapped to the first line of Civet content
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

    private hoverProvider: HoverProviderImpl;
    private diagnosticsProvider: DiagnosticsProviderImpl;
    private completionsProvider: CompletionsProviderImpl;
    private codeActionsProvider: CodeActionsProviderImpl;
    private selectionRangeProvider: SelectionRangeProviderImpl;
    private compiledCivetCache = new Map<string, { version: number, compiledTsCode: string, sourcemapLines: SourceMapLinesEntry[], rawSourcemapLines: number[][][], originalContentLineOffset: number }>();

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
        // TODO: Phase 2 - Diagnostics should also use the CivetLanguageServiceHost
        // This will require mapping diagnostic ranges from TS to Svelte/Civet.
        return this.diagnosticsProvider.getDiagnostics(document);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        console.log(`[CivetPlugin] doHover called: uri=${document.uri}, svelteDocPosition=${JSON.stringify(position)}`);
        await this.handleDocumentChange(document);

        const cached = this.compiledCivetCache.get(document.uri);
        console.log(`[CivetPlugin] doHover cached entry present: ${!!cached}`);
        if (!cached || !cached.sourcemapLines || !cached.compiledTsCode) {
        if (document.getLanguageAttribute('script') !== 'civet') {
                console.log(`[CivetPlugin] doHover fallback to original hover provider (no cache/sourcemap/TS code)`);
                return this.hoverProvider.doHover(document, position);
            }
            console.log(`[CivetPlugin] doHover no result for Civet script (no cache/sourcemap)`);
            return null;
        }
        
        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            console.error(`[CivetPlugin] doHover: Could not get valid civetTagInfo with startPos for ${document.uri}. Aborting hover.`);
            return null;
        }
        const scriptStartPosition = civetTagInfo.startPos;
        console.log(`[CivetPlugin] doHover scriptStartPosition=${JSON.stringify(scriptStartPosition)}`);

        let civetContentPosition = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
        console.log(`[CivetPlugin] doHover initial civetContentPosition=${JSON.stringify(civetContentPosition)}`);

        const { sourcemapLines, originalContentLineOffset, compiledTsCode, rawSourcemapLines } = cached;

        if (originalContentLineOffset > 0) {
            civetContentPosition = { 
                line: Math.max(0, civetContentPosition.line - originalContentLineOffset), 
                character: civetContentPosition.character 
            };
            console.log(`[CivetPlugin] doHover adjusted civetContentPosition for stripped lines=${JSON.stringify(civetContentPosition)}`);
        }

        console.log(`[CivetPlugin] doHover sourcemapLines count=${sourcemapLines.length}`);
        const tsPosition = civetForwardMap(rawSourcemapLines, civetContentPosition);
        console.log(`[CivetPlugin] doHover mapped tsPosition=${JSON.stringify(tsPosition)}`);

        if (!this.civetLanguageServiceHost) {
            console.warn("[CivetPlugin] doHover: civetLanguageServiceHost is not available.");
            return null;
        }

        const quickInfo = this.civetLanguageServiceHost.getQuickInfo(document.uri, tsPosition);
        console.log(`[CivetPlugin] doHover quickInfo:`, quickInfo);

        if (quickInfo) {
            const contents = quickInfo.displayParts ? quickInfo.displayParts.map(dp => dp.text).join('') : '';
            let documentation = '';
            if (quickInfo.documentation) {
                documentation = quickInfo.documentation.map(doc => doc.text).join('\n');
            }
            
            const hoverContents = {
                kind: 'markdown' as const,
                value: [contents, documentation].filter(s => s.length > 0).join('\n\n---\n\n')
            };

            let remappedRange: Range | undefined = undefined;
            const tsScriptInfo = this.civetLanguageServiceHost.getScriptInfo(document.uri);
            if (tsScriptInfo && quickInfo.textSpan) {
                const hostTsCode = tsScriptInfo.code;
                console.log(`[doHover-DEBUG] hostTsCode (first 70 chars for offset check): '${hostTsCode.substring(0,70).replace(/\n/g, '\\n')}'`);
                console.log(`[doHover-DEBUG] quickInfo.textSpan: ${JSON.stringify(quickInfo.textSpan)}`);

                const offsetToPosition = (offset: number): Position => {
                    let line = 0;
                    let character = 0;
                    for (let i = 0; i < offset && i < hostTsCode.length; i++) {
                        if (hostTsCode[i] === '\n') {
                            line++;
                            character = 0;
                        } else {
                            character++;
                        }
                    }
                    return { line, character };
                };

                const tsStartPosUnadjusted = offsetToPosition(quickInfo.textSpan.start);
                console.log(`[doHover-DEBUG] tsStartPosUnadjusted from offsetToPosition(${quickInfo.textSpan.start}): ${JSON.stringify(tsStartPosUnadjusted)}`);
                const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
                console.log(`[doHover-DEBUG] tsStartPos adjusted for leading newline: ${JSON.stringify(tsStartPos)}`);
                
                let remappedContentStart = civetRemapPosition(cached.rawSourcemapLines, tsStartPos);
                if (originalContentLineOffset > 0) {
                    remappedContentStart = { line: remappedContentStart.line + originalContentLineOffset, character: remappedContentStart.character };
                    console.log(`[CivetPlugin] doHover adjusted remappedContentStart for stripped lines: ${JSON.stringify(remappedContentStart)}`);
                }

                const tsEndPosUnadjusted = offsetToPosition(quickInfo.textSpan.start + quickInfo.textSpan.length);
                const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);
                let remappedContentEnd = civetRemapPosition(cached.rawSourcemapLines, tsEndPos);
                if (originalContentLineOffset > 0) {
                    remappedContentEnd = { line: remappedContentEnd.line + originalContentLineOffset, character: remappedContentEnd.character };
                    console.log(`[CivetPlugin] doHover adjusted remappedContentEnd for stripped lines: ${JSON.stringify(remappedContentEnd)}`);
                }
                
                const svelteDocStart = civetContentPositionToSvelteDocRelative(remappedContentStart, scriptStartPosition);
                const svelteDocEnd = civetContentPositionToSvelteDocRelative(remappedContentEnd, scriptStartPosition);
                
                remappedRange = Range.create(svelteDocStart, svelteDocEnd);
                console.log(`[CivetPlugin] doHover remappedRange (Svelte doc relative): ${JSON.stringify(remappedRange)}`);
            }
            
            return { contents: hoverContents, range: remappedRange };
        }

        return null;
    }

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<CompletionList | null> {
        console.log(`[CivetPlugin] getCompletions called: uri=${document.uri}, svelteDocPosition=${JSON.stringify(position)}, context=${JSON.stringify(completionContext)}`);
        await this.handleDocumentChange(document);

        const cached = this.compiledCivetCache.get(document.uri);
        console.log(`[CivetPlugin] getCompletions cached entry present: ${!!cached}`);
        if (!cached || !cached.compiledTsCode) { // Check compiledTsCode as rawSourcemapLines might exist with no code
            console.log(`[CivetPlugin] getCompletions fallback logic (no cache/TS code)`);
            if (document.getLanguageAttribute('script') !== 'civet') {
                return this.completionsProvider.getCompletions(document, position, completionContext);
            }
            return null;
        }
        
        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            console.error(`[CivetPlugin] getCompletions: Could not get valid civetTagInfo with startPos for ${document.uri}. Aborting completions.`);
            return null;
        }
        const scriptStartPosition = civetTagInfo.startPos;
        console.log(`[CivetPlugin] getCompletions scriptStartPosition=${JSON.stringify(scriptStartPosition)}`);

        let civetContentPosition = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
        console.log(`[CivetPlugin] getCompletions initial civetContentPosition=${JSON.stringify(civetContentPosition)}`);

        const { compiledTsCode, originalContentLineOffset, rawSourcemapLines } = cached; // Ensure rawSourcemapLines is destructured

        if (!rawSourcemapLines) { // Explicit check for rawSourcemapLines
            console.warn(`[CivetPlugin] getCompletions: rawSourcemapLines missing from cache for ${document.uri}. Cannot map position.`);
            return null;
        }

        if (originalContentLineOffset > 0) {
            civetContentPosition = { 
                line: Math.max(0, civetContentPosition.line - originalContentLineOffset), 
                character: civetContentPosition.character 
            };
            console.log(`[CivetPlugin] getCompletions adjusted civetContentPosition for stripped lines=${JSON.stringify(civetContentPosition)}`);
        }
        
        const tsPosition = civetForwardMap(rawSourcemapLines, civetContentPosition); // USE IMPORTED civetForwardMap
        console.log(`[CivetPlugin] getCompletions mapped tsPosition=${JSON.stringify(tsPosition)}`);

        if (!this.civetLanguageServiceHost) {
            console.warn("[CivetPlugin] getCompletions: civetLanguageServiceHost is not available.");
            return null;
        }

        const options: ts.GetCompletionsAtPositionOptions = {
            triggerCharacter: completionContext?.triggerCharacter as ts.CompletionsTriggerCharacter,
        };

        const tsCompletions = this.civetLanguageServiceHost.getCompletions(document.uri, tsPosition, options);
        console.log(`[CivetPlugin] getCompletions tsCompletions:`, tsCompletions);

        if (!tsCompletions || !tsCompletions.entries) {
            console.log(`[CivetPlugin] getCompletions no tsEntries, returning null`);
            return null;
        }

        const offsetToPositionInTs = (offset: number): Position => {
            let line = 0;
            let character = 0;
            const hostTsCode = this.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || compiledTsCode;
            for (let i = 0; i < offset && i < hostTsCode.length; i++) {
                if (hostTsCode[i] === '\n') {
                    line++;
                    character = 0;
                } else {
                    character++;
                }
            }
            return { line, character };
        };

        const items: CompletionItem[] = tsCompletions.entries.map(tsEntry => {
            const completionItem: CompletionItem = {
                label: tsEntry.name,
                kind: scriptElementKindToCompletionItemKind(tsEntry.kind),
            };

            if (tsEntry.replacementSpan) {
                const tsStartPosUnadjusted = offsetToPositionInTs(tsEntry.replacementSpan.start);
                const tsEndPosUnadjusted = offsetToPositionInTs(tsEntry.replacementSpan.start + tsEntry.replacementSpan.length);
                
                const hostTsCode = this.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || compiledTsCode;
                const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
                const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);

                let remappedContentStart = civetRemapPosition(cached.rawSourcemapLines, tsStartPos);
                let remappedContentEnd = civetRemapPosition(cached.rawSourcemapLines, tsEndPos);

                if (originalContentLineOffset > 0) {
                    remappedContentStart = { line: remappedContentStart.line + originalContentLineOffset, character: remappedContentStart.character };
                    remappedContentEnd = { line: remappedContentEnd.line + originalContentLineOffset, character: remappedContentEnd.character };
                    console.log(`[CivetPlugin] getCompletions adjusted remapped spans for ${tsEntry.name}: start=${JSON.stringify(remappedContentStart)}, end=${JSON.stringify(remappedContentEnd)}`);
                }

                const svelteDocStart = civetContentPositionToSvelteDocRelative(remappedContentStart, scriptStartPosition);
                const svelteDocEnd = civetContentPositionToSvelteDocRelative(remappedContentEnd, scriptStartPosition);
                const svelteDocRange = Range.create(svelteDocStart, svelteDocEnd);
                console.log(`[CivetPlugin] getCompletions remappedRange for ${tsEntry.name} (Svelte doc relative): ${JSON.stringify(svelteDocRange)}`);

                completionItem.textEdit = TextEdit.replace(svelteDocRange, tsEntry.name); 
            } else {
                completionItem.insertText = tsEntry.name;
            }
            
            if (tsEntry.data) {
                completionItem.data = tsEntry.data;
            }

            return completionItem;
        });

        return CompletionList.create(items, tsCompletions.isGlobalCompletion);
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
        const civetTagInfo = getCivetTagInfo(document);

        if (!civetTagInfo || !civetTagInfo.startPos) {
            // console.log(`[CivetPlugin] No Civet script tag with startPos found in ${document.uri}, or startPos missing.`);
            this.compiledCivetCache.delete(document.uri); // Ensure cache is cleared if no valid tag
            this.civetLanguageServiceHost.updateCivetFile(document.uri, "", []); // Clear host by updating with empty content
            return;
        }
        
        const currentVersion = document.version;
        const cached = this.compiledCivetCache.get(document.uri);

        if (cached && cached.version === currentVersion) {
            // console.log(`[CivetPlugin] Using cached compilation for ${document.uri} version ${currentVersion}`);
            this.civetLanguageServiceHost.updateCivetFile(document.uri, cached.compiledTsCode, cached.sourcemapLines);
            return;
        }
        
        console.log(`[CivetPlugin] handleDocumentChange: uri=${document.uri}, version=${currentVersion}`);
        
        const civetCode = civetTagInfo.content;
        let civetCodeForCompilation = civetCode;
        let originalContentLineOffset = 0;

        const firstLineEndIndex = civetCodeForCompilation.indexOf('\n');
        if (firstLineEndIndex !== -1) {
            const firstLine = civetCodeForCompilation.substring(0, firstLineEndIndex);
            if (firstLine.trim() === '') {
                const potentialCodeAfterFirstLine = civetCodeForCompilation.substring(firstLineEndIndex + 1);
                if (potentialCodeAfterFirstLine.trim() !== '') { // Ensure there's actual code after the blank line
                    civetCodeForCompilation = potentialCodeAfterFirstLine;
                    originalContentLineOffset = 1;
                    console.log(`[CivetPlugin] Stripped leading blank line from Civet content for compilation. Offset for mapping: ${originalContentLineOffset}`);
                }
            }
        }
        
        // console.log(`[CivetPlugin] extracted civetCode (first 100 chars): ${civetCode.substring(0,100)}`);
        console.log(`[CivetPlugin] civetCodeForCompilation (first 100 chars): ${civetCodeForCompilation.substring(0,100)}`);


        if (!civetCodeForCompilation.trim()) {
            console.log(`[CivetPlugin] Civet code for compilation is empty for ${document.uri}. Clearing cache and host entry.`);
            this.compiledCivetCache.delete(document.uri);
            this.civetLanguageServiceHost.updateCivetFile(document.uri, "", []); // Clear host
            return;
        }
        
        try {
            console.log(`[CivetPlugin] compiling Civet code for ${document.uri} (using code with length ${civetCodeForCompilation.length})`);
            const compileResult = civet.compile(civetCodeForCompilation, {
                js: false, 
                sourceMap: true,
                inlineMap: false, 
                filename: document.uri, 
                sync: true
            });
    
            const compiledTsCode = compileResult.code;
            // Log a snippet of compiled code
            const tsSnippet = compiledTsCode.split('\n').slice(0, 15).join('\n');
            console.log(`[CivetPlugin] compiledTsCode (up to 15 lines/500 chars):\n${tsSnippet.length > 500 ? tsSnippet.substring(0,500) + '...' : tsSnippet}`);
            
            if (compileResult.sourceMap && compileResult.sourceMap.lines) {
                // Log a snippet of raw sourcemap
                const rawMapSnippet = compileResult.sourceMap.lines.slice(0, 10);
                console.log(`[CivetPlugin] Raw compileResult.sourceMap.lines (first 10 generated lines):`, JSON.stringify(rawMapSnippet, null, 2));
            }

            let finalSourcemapLines: SourceMapLinesEntry[] = [];
    
            if (compileResult.sourceMap && compileResult.sourceMap.lines) {
                finalSourcemapLines = transformCivetSourcemapLines(compileResult.sourceMap.lines);
                // console.log(`[CivetPlugin] transform sourcemap lines count=${compileResult.sourceMap.lines.length}`);
                // console.log(`[CivetPlugin] transformed sourcemap entries count=${finalSourcemapLines.length}`);
            } else {
                console.warn(`[CivetPlugin] No sourcemap lines found in compileResult for ${document.uri}`);
            }
            
            console.log(`[CivetPlugin] updating host and cache for ${document.uri}`);
            this.civetLanguageServiceHost.updateCivetFile(document.uri, compiledTsCode, finalSourcemapLines);
            this.compiledCivetCache.set(document.uri, { 
                version: currentVersion, 
                compiledTsCode, 
                sourcemapLines: finalSourcemapLines,
                rawSourcemapLines: compileResult.sourceMap.lines,
                originalContentLineOffset // Store the offset
            });

        } catch (e: any) {
            console.error(`[CivetPlugin] Error during Civet compilation or processing for ${document.uri}:`, e.message, e.stack);
            // Clear cache and host entry on error to prevent serving stale/bad data
            this.compiledCivetCache.delete(document.uri);
            this.civetLanguageServiceHost.updateCivetFile(document.uri, "", []); // Clear host on error
        }
    }

    async getDefinitions(document: Document, position: Position): Promise<DefinitionLink[]> {
        console.log(`[CivetPlugin] getDefinitions called: uri=${document.uri}, svelteDocPosition=${JSON.stringify(position)}`);
        await this.handleDocumentChange(document);

        const cached = this.compiledCivetCache.get(document.uri);
        console.log(`[CivetPlugin] getDefinitions cached entry present: ${!!cached}`);
        if (!cached || !cached.sourcemapLines) {
            console.log(`[CivetPlugin] getDefinitions no sourcemap lines, fallback/empty`);
            // Fallback logic for non-civet or no sourcemap should be here if necessary
            return []; 
        }
        
        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            console.error(`[CivetPlugin] getDefinitions: Could not get valid civetTagInfo with startPos for ${document.uri}. Aborting definitions.`);
            return [];
        }
        const scriptStartPosition = civetTagInfo.startPos;
        console.log(`[CivetPlugin] getDefinitions scriptStartPosition=${JSON.stringify(scriptStartPosition)}`);

        let civetContentPosition = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
        console.log(`[CivetPlugin] getDefinitions initial civetContentPosition=${JSON.stringify(civetContentPosition)}`);

        const { sourcemapLines, originalContentLineOffset, rawSourcemapLines } = cached;

        if (originalContentLineOffset > 0) {
            civetContentPosition = { 
                line: Math.max(0, civetContentPosition.line - originalContentLineOffset), 
                character: civetContentPosition.character 
            };
            console.log(`[CivetPlugin] getDefinitions adjusted civetContentPosition for stripped lines=${JSON.stringify(civetContentPosition)}`);
        }

        console.log(`[CivetPlugin] getDefinitions sourcemapLines count=${sourcemapLines.length}`);
        const tsPosition = civetForwardMap(rawSourcemapLines, civetContentPosition);
        console.log(`[CivetPlugin] getDefinitions mapped tsPosition=${JSON.stringify(tsPosition)}`);

        if (!this.civetLanguageServiceHost) {
            console.warn("[CivetPlugin] getDefinitions: civetLanguageServiceHost is not available.");
            return [];
        }

        const tsDefinitions = this.civetLanguageServiceHost.getDefinitions(document.uri, tsPosition);
        console.log(`[CivetPlugin] getDefinitions tsDefinitions:`, tsDefinitions);

        if (tsDefinitions && tsDefinitions.length > 0) {
            const definitionLinks: DefinitionLink[] = [];
            const tsScriptInfo = this.civetLanguageServiceHost.getScriptInfo(document.uri);
            const hostTsCode = tsScriptInfo?.code;

            if (!hostTsCode) {
                console.warn(`[CivetPlugin] getDefinitions: Could not get TS code from host for ${document.uri} to map textSpans.`);
                return [];
            }

            const offsetToPosition = (offset: number): Position => {
                let line = 0;
                let character = 0;
                for (let i = 0; i < offset && i < hostTsCode.length; i++) {
                    if (hostTsCode[i] === '\n') {
                        line++;
                        character = 0;
                    } else {
                        character++;
                    }
                }
                return { line, character };
            };

            for (const tsDef of tsDefinitions) {
                if (tsDef.textSpan) { 
                    const tsStartPosUnadjusted = offsetToPosition(tsDef.textSpan.start);
                    const tsEndPosUnadjusted = offsetToPosition(tsDef.textSpan.start + tsDef.textSpan.length);
                    
                    const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
                    const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);

                    let remappedContentStart = civetRemapPosition(cached.rawSourcemapLines, tsStartPos);
                    let remappedContentEnd = civetRemapPosition(cached.rawSourcemapLines, tsEndPos);

                    if (originalContentLineOffset > 0) {
                        remappedContentStart = { line: remappedContentStart.line + originalContentLineOffset, character: remappedContentStart.character };
                        remappedContentEnd = { line: remappedContentEnd.line + originalContentLineOffset, character: remappedContentEnd.character };
                        console.log(`[CivetPlugin] getDefinitions adjusted remapped spans for ${tsDef.name}: start=${JSON.stringify(remappedContentStart)}, end=${JSON.stringify(remappedContentEnd)}`);
                    }

                    const svelteDocTargetStart = civetContentPositionToSvelteDocRelative(remappedContentStart, scriptStartPosition);
                    const svelteDocTargetEnd = civetContentPositionToSvelteDocRelative(remappedContentEnd, scriptStartPosition);
                    const targetRange = Range.create(svelteDocTargetStart, svelteDocTargetEnd);
                    console.log(`[CivetPlugin] getDefinitions remapped targetRange for ${tsDef.name} (Svelte doc relative): ${JSON.stringify(targetRange)}`);
                    
                    // For originSelectionRange, use the original svelteDocPosition, potentially adjusted for identifier length
                    // This ensures the "link" originates from where the user clicked.
                    // A more accurate originSelectionRange would map the identifier at 'position' using forward/remap.
                    // For now, a small range around 'position' is a reasonable approximation.
                    const approxIdentifierLength = tsDef.name?.length || 1;
                    const originSelectionRange = Range.create(position, { line: position.line, character: position.character + approxIdentifierLength });

                    definitionLinks.push({
                        targetUri: document.uri, 
                        targetRange: targetRange,
                        targetSelectionRange: targetRange,
                        originSelectionRange: originSelectionRange 
                    });
                }
            }
            return definitionLinks;
        }
        return [];
    }
} 