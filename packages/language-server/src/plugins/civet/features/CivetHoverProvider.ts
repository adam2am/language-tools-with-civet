import { Document } from '../../../lib/documents';
import { Position, Hover, MarkupKind } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin';
import {
    remapPosition,
    forwardMapRaw,
    svelteDocPositionToCivetContentRelative,
    adjustTsPositionForLeadingNewline,
    civetContentPositionToSvelteDocRelative,
    type RawVLQSourcemapLines,
    type MappingPosition
} from '../util';
import { HoverProvider } from '../../interfaces';
import * as ts from 'typescript';

export class CivetHoverProvider implements HoverProvider {
    constructor(
        private readonly resolver: LSAndTSDocResolver,
        private readonly plugin: CivetPlugin
    ) {}

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        const cached = this.plugin.compiledCivetCache.get(document.uri);
        if (!cached || !cached.compiledTsCode || !cached.rawSourcemapLines) {
            return null;
        }

        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            return null;
        }
        const scriptStartPosition = civetTagInfo.startPos;

        let civetContentPosition = svelteDocPositionToCivetContentRelative(
            position,
            scriptStartPosition
        );

        const { compiledTsCode, originalContentLineOffset, rawSourcemapLines } = cached;

        if (originalContentLineOffset > 0) {
            civetContentPosition = {
                line: Math.max(0, civetContentPosition.line - originalContentLineOffset),
                character: civetContentPosition.character
            };
        }

        const tsPosition = forwardMapRaw(rawSourcemapLines, civetContentPosition);

        if (!this.plugin.civetLanguageServiceHost) {
            return null;
        }

        const quickInfo = this.plugin.civetLanguageServiceHost.getQuickInfo(
            document.uri,
            tsPosition
        );

        if (!quickInfo || !quickInfo.displayParts) {
            return null;
        }

        const displayString = ts.displayPartsToString(quickInfo.displayParts);
        let documentation = ts.displayPartsToString(quickInfo.documentation);
        if (quickInfo.tags) {
            documentation += '\n\n' + quickInfo.tags.map((tag) => `*@${tag.name}* ${tag.text?.map(part => part.text).join('')}`).join('\n');
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
        
        const tsStartPosUnadjusted = offsetToPositionInTs(quickInfo.textSpan.start);
        const tsEndPosUnadjusted = offsetToPositionInTs(quickInfo.textSpan.start + quickInfo.textSpan.length);

        const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
        const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);

        const remappedCivetStart = remapPosition(tsStartPos, rawSourcemapLines);
        const remappedCivetEnd = remapPosition(tsEndPos, rawSourcemapLines);

        let effectiveCivetScriptStartPos = scriptStartPosition;
        if (originalContentLineOffset > 0) {
            effectiveCivetScriptStartPos = { 
               line: scriptStartPosition.line + originalContentLineOffset, 
               character: (remappedCivetStart.line === 0 && scriptStartPosition.line + originalContentLineOffset === scriptStartPosition.line) ? scriptStartPosition.character : 0
           }; 
       }

        const hoverRange = {
            start: civetContentPositionToSvelteDocRelative(remappedCivetStart, effectiveCivetScriptStartPos),
            end: civetContentPositionToSvelteDocRelative(remappedCivetEnd, effectiveCivetScriptStartPos),
        };

        const contents: Hover['contents'] = {
            kind: MarkupKind.Markdown,
            value: [
                '```typescript',
                displayString,
                '```',
                documentation
            ].join('\n')
        };

        return {
            contents,
            range: hoverRange
        };
    }
} 