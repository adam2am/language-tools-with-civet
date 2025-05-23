import { Document } from '../../../lib/documents';
import { CompletionList, Position, Range, CompletionItem, CompletionItemKind, TextEdit, CompletionContext } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../ls-config';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin';
import 
{ forwardMapRaw, 
    remapPosition, 
    svelteDocPositionToCivetContentRelative, 
    civetContentPositionToSvelteDocRelative, 
    adjustTsPositionForLeadingNewline, 
    type RawVLQSourcemapLines, 
    type MappingPosition } from '../util';
import { scriptElementKindToCompletionItemKind } from '../../typescript/utils';
import * as ts from 'typescript';
import { CompletionsProvider } from '../../interfaces';

export class CivetCompletionsProvider implements CompletionsProvider {
    constructor(
        private readonly resolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager,
        private readonly plugin: CivetPlugin
    ) {}

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<CompletionList | null> {
        const cached = this.plugin.compiledCivetCache.get(document.uri);
        if (!cached || !cached.compiledTsCode) {
            console.log(`[CivetCompletionsProvider] No cache/TS code for ${document.uri}`);
            // Fallback to TS provider if not a civet script or no cache.
            // This part might need adjustment based on how non-civet scripts should be handled.
            // For now, assuming direct TS handling if not a fully processed Civet script.
            // const tsProvider = new CompletionsProviderImpl(this.resolver, this.configManager); // Original fallback
            // return tsProvider.getCompletions(document, position, completionContext);
            return null; 
        }

        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            console.error(`[CivetCompletionsProvider] No valid civetTagInfo for ${document.uri}`);
            return null;
        }
        const scriptStartPosition = civetTagInfo.startPos;

        let civetContentPosition = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
        const { compiledTsCode, originalContentLineOffset, rawSourcemapLines } = cached;

        if (!rawSourcemapLines) {
            console.warn(`[CivetCompletionsProvider] rawSourcemapLines missing for ${document.uri}`);
            return null;
        }

        if (originalContentLineOffset > 0) {
            civetContentPosition = {
                line: Math.max(0, civetContentPosition.line - originalContentLineOffset),
                character: civetContentPosition.character
            };
        }
        
        const tsPosition = forwardMapRaw(rawSourcemapLines, civetContentPosition);

        if (!this.plugin.civetLanguageServiceHost) {
            console.warn("[CivetCompletionsProvider] civetLanguageServiceHost is not available.");
            return null;
        }

        const options: ts.GetCompletionsAtPositionOptions = {
            triggerCharacter: completionContext?.triggerCharacter as ts.CompletionsTriggerCharacter,
            triggerKind: completionContext?.triggerKind as ts.CompletionTriggerKind,
            includeExternalModuleExports: true,
            includeInsertTextCompletions: true,
        };

        const tsCompletions = this.plugin.civetLanguageServiceHost.getCompletions(document.uri, tsPosition, options);
        if (!tsCompletions || !tsCompletions.entries) {
            return null;
        }

        const hostTsCode = this.plugin.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || compiledTsCode;
        const offsetToPositionInTs = (offset: number): Position => {
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

        const items: CompletionItem[] = tsCompletions.entries.map(tsEntry => {
            const completionItem: CompletionItem = {
                label: tsEntry.name,
                kind: scriptElementKindToCompletionItemKind(tsEntry.kind),
            };

            if (tsEntry.replacementSpan) {
                const tsStartPosUnadjusted = offsetToPositionInTs(tsEntry.replacementSpan.start);
                const tsEndPosUnadjusted = offsetToPositionInTs(tsEntry.replacementSpan.start + tsEntry.replacementSpan.length);
                
                const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
                const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);

                let remappedContentStart = remapPosition(tsStartPos, rawSourcemapLines);
                let remappedContentEnd = remapPosition(tsEndPos, rawSourcemapLines);
                
                let effectiveCivetScriptStartPos = scriptStartPosition;
                if (originalContentLineOffset > 0) {
                     effectiveCivetScriptStartPos = { 
                        line: scriptStartPosition.line + originalContentLineOffset, 
                        character: (remappedContentStart.line === 0 && scriptStartPosition.line + originalContentLineOffset === scriptStartPosition.line) ? scriptStartPosition.character : 0
                    }; 
                }
                
                const svelteDocStart = civetContentPositionToSvelteDocRelative(remappedContentStart, effectiveCivetScriptStartPos);
                const svelteDocEnd = civetContentPositionToSvelteDocRelative(remappedContentEnd, effectiveCivetScriptStartPos);
                const svelteDocRange = Range.create(svelteDocStart, svelteDocEnd);
                
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
    
    // Add resolveCompletion if your TS provider has it and it needs similar mapping
    // async resolveCompletion?(document: Document, item: CompletionItem): Promise<CompletionItem> {
    //     // Delegate to a TS resolveCompletion, potentially with mapping if needed
    //     // This is more complex if it involves additional text edits that need mapping
    //     return item;
    // }
} 