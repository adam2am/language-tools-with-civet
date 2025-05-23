import { Document, TagInformation } from '../../../lib/documents';
import { DefinitionsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { DefinitionLink, Position, Range } from 'vscode-languageserver';
import { CivetPlugin, MappingPosition, getCivetTagInfo, svelteDocPositionToCivetContentRelative, adjustTsPositionForLeadingNewline, civetContentPositionToSvelteDocRelative } from '../CivetPlugin'; // Reference to the main plugin
import { remapPosition as civetRemapPosition, forwardMap as civetForwardMap } from '../civetUtils';

export class CivetDefinitionsProvider implements DefinitionsProvider {
    constructor(
        private readonly lsAndTSDocResolver: LSAndTSDocResolver,
        private readonly plugin: CivetPlugin
    ) {}

    async getDefinitions(document: Document, position: Position): Promise<DefinitionLink[]> {
        console.log(`[CivetDefinitionsProvider] getDefinitions called for ${document.uri} at position ${JSON.stringify(position)}`);
        const cached = this.plugin.compiledCivetCache.get(document.uri);
        console.log(`[CivetDefinitionsProvider] cache hit: ${!!cached}`);
        if (!cached || !cached.compiledTsCode) {
            console.log(`[CivetDefinitionsProvider] No compiled TS code in cache for ${document.uri}`);
            return [];
        }

        const civetTagInfo = getCivetTagInfo(document);
        console.log(`[CivetDefinitionsProvider] civetTagInfo: ${civetTagInfo ? 'found' : 'null'}`);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            console.error(`[CivetDefinitionsProvider] No valid civetTagInfo for ${document.uri}`);
            return [];
        }
        const scriptStartPosition = civetTagInfo.startPos;
        console.log(`[CivetDefinitionsProvider] scriptStartPosition: ${JSON.stringify(scriptStartPosition)}`);

        let civetContentPosition = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
        console.log(`[CivetDefinitionsProvider] initial civetContentPosition: ${JSON.stringify(civetContentPosition)}`);
        const { originalContentLineOffset, rawSourcemapLines, compiledTsCode } = cached;
        if (originalContentLineOffset > 0) {
            civetContentPosition = {
                line: Math.max(0, civetContentPosition.line - originalContentLineOffset),
                character: civetContentPosition.character
            };
            console.log(`[CivetDefinitionsProvider] after line offset adjustment: ${JSON.stringify(civetContentPosition)}`);
        }

        if (!rawSourcemapLines) {
            console.warn(`[CivetDefinitionsProvider] rawSourcemapLines missing for ${document.uri}`);
            return [];
        }
        console.log(`[CivetDefinitionsProvider] rawSourcemapLines length: ${rawSourcemapLines.length}`);
        
        const tsPosition = civetForwardMap(rawSourcemapLines, civetContentPosition);
        console.log(`[CivetDefinitionsProvider] mapped tsPosition: ${JSON.stringify(tsPosition)}`);

        if (!this.plugin.civetLanguageServiceHost) {
            console.warn("[CivetDefinitionsProvider] civetLanguageServiceHost is not available.");
            return [];
        }

        const tsDefinitions = this.plugin.civetLanguageServiceHost.getDefinitions(document.uri, tsPosition);
        console.log(`[CivetDefinitionsProvider] tsDefinitions count: ${tsDefinitions?.length || 0}`);
        if (!tsDefinitions || tsDefinitions.length === 0) {
            return [];
        }

        const definitionLinks: DefinitionLink[] = [];
        const hostTsCode = this.plugin.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || compiledTsCode;

        const offsetToPosition = (offset: number): Position => {
            let line = 0;
            let character = 0;
            const currentHostTsCode = hostTsCode || "";
            for (let i = 0; i < offset && i < currentHostTsCode.length; i++) {
                if (currentHostTsCode[i] === '\n') {
                    line++;
                    character = 0;
                } else {
                    character++;
                }
            }
            return { line, character };
        };

        for (const tsDef of tsDefinitions) {
            console.log(`[CivetDefinitionsProvider] processing tsDef: ${JSON.stringify(tsDef)}`);
            if (tsDef.textSpan && hostTsCode) {
                const tsStartPosUnadjusted = offsetToPosition(tsDef.textSpan.start);
                const tsEndPosUnadjusted = offsetToPosition(tsDef.textSpan.start + tsDef.textSpan.length);
                console.log(`[CivetDefinitionsProvider] tsStartPosUnadjusted: ${JSON.stringify(tsStartPosUnadjusted)}, tsEndPosUnadjusted: ${JSON.stringify(tsEndPosUnadjusted)}`);

                const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
                const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);
                console.log(`[CivetDefinitionsProvider] tsStartPos: ${JSON.stringify(tsStartPos)}, tsEndPos: ${JSON.stringify(tsEndPos)}`);

                let remappedContentStart = civetRemapPosition(tsStartPos, rawSourcemapLines);
                let remappedContentEnd = civetRemapPosition(tsEndPos, rawSourcemapLines);
                console.log(`[CivetDefinitionsProvider] remappedContentStart: ${JSON.stringify(remappedContentStart)}, remappedContentEnd: ${JSON.stringify(remappedContentEnd)}`);

                if (originalContentLineOffset > 0) {
                    remappedContentStart = { line: remappedContentStart.line + originalContentLineOffset, character: remappedContentStart.character };
                    remappedContentEnd = { line: remappedContentEnd.line + originalContentLineOffset, character: remappedContentEnd.character };
                    console.log(`[CivetDefinitionsProvider] after offset remappedContentStart: ${JSON.stringify(remappedContentStart)}, remappedContentEnd: ${JSON.stringify(remappedContentEnd)}`);
                }

                const svelteDocTargetStart = civetContentPositionToSvelteDocRelative(remappedContentStart, scriptStartPosition);
                const svelteDocTargetEnd = civetContentPositionToSvelteDocRelative(remappedContentEnd, scriptStartPosition);
                console.log(`[CivetDefinitionsProvider] svelteDocTargetStart: ${JSON.stringify(svelteDocTargetStart)}, svelteDocTargetEnd: ${JSON.stringify(svelteDocTargetEnd)}`);
                const targetRange = Range.create(svelteDocTargetStart, svelteDocTargetEnd);
                
                const originSelectionRange = Range.create(position, { line: position.line, character: position.character + (tsDef.name?.length || 1) });

                definitionLinks.push({
                    targetUri: tsDef.fileName === document.uri ? document.uri : tsDef.fileName,
                    targetRange: tsDef.fileName === document.uri ? targetRange : Range.create(offsetToPosition(tsDef.textSpan.start), offsetToPosition(tsDef.textSpan.start + tsDef.textSpan.length)),
                    targetSelectionRange: tsDef.fileName === document.uri ? targetRange : Range.create(offsetToPosition(tsDef.textSpan.start), offsetToPosition(tsDef.textSpan.start + tsDef.textSpan.length)),
                    originSelectionRange: originSelectionRange
                });
            }
        }
        console.log(`[CivetDefinitionsProvider] definitionLinks: ${JSON.stringify(definitionLinks)}`);
        return definitionLinks;
    }
} 