import { Document } from '../../../lib/documents';
import { HoverProvider } from '../../interfaces';
import { Hover, Position, Range, MarkupKind } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { CivetPlugin, MappingPosition, getCivetTagInfo, svelteDocPositionToCivetContentRelative, adjustTsPositionForLeadingNewline, civetContentPositionToSvelteDocRelative } from '../CivetPlugin';
import { remapPosition as civetRemapPosition, forwardMap as civetForwardMap } from '../civetUtils';

export class CivetHoverProvider implements HoverProvider { 
    constructor(
        private readonly lsAndTSDocResolver: LSAndTSDocResolver, 
        private readonly plugin: CivetPlugin
    ) {}

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        const cached = this.plugin.compiledCivetCache.get(document.uri);
        if (!cached || !cached.compiledTsCode) {
            return null;
        }

        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            return null;
        }
        const scriptStartPosition = civetTagInfo.startPos;

        let civetContentPosition = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
        const { originalContentLineOffset, rawSourcemapLines, compiledTsCode } = cached;

        if (originalContentLineOffset > 0) {
            civetContentPosition = {
                line: Math.max(0, civetContentPosition.line - originalContentLineOffset),
                character: civetContentPosition.character
            };
        }

        if (!rawSourcemapLines) return null;

        const tsPosition = civetForwardMap(rawSourcemapLines, civetContentPosition);

        if (!this.plugin.civetLanguageServiceHost) {
            return null;
        }

        const quickInfo = this.plugin.civetLanguageServiceHost.getQuickInfo(document.uri, tsPosition);
        if (!quickInfo) {
            return null;
        }

        const contents = quickInfo.displayParts ? quickInfo.displayParts.map(dp => dp.text).join('') : '';
        let documentation = '';
        if (quickInfo.documentation) {
            documentation = quickInfo.documentation.map(doc => doc.text).join('\n');
        }
        
        const hoverContents = {
            kind: MarkupKind.Markdown,
            value: [contents, documentation].filter(s => s.length > 0).join('\n\n---\n\n')
        };

        let remappedRange: Range | undefined = undefined;
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

        if (hostTsCode && quickInfo.textSpan) {
            const tsStartPosUnadjusted = offsetToPosition(quickInfo.textSpan.start);
            const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
            
            let remappedContentStart = civetRemapPosition(tsStartPos, rawSourcemapLines);
            if (originalContentLineOffset > 0) {
                remappedContentStart = { line: remappedContentStart.line + originalContentLineOffset, character: remappedContentStart.character };
            }

            const tsEndPosUnadjusted = offsetToPosition(quickInfo.textSpan.start + quickInfo.textSpan.length);
            const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);
            let remappedContentEnd = civetRemapPosition(tsEndPos, rawSourcemapLines);
            if (originalContentLineOffset > 0) {
                remappedContentEnd = { line: remappedContentEnd.line + originalContentLineOffset, character: remappedContentEnd.character };
            }
            
            const svelteDocStart = civetContentPositionToSvelteDocRelative(remappedContentStart, scriptStartPosition);
            const svelteDocEnd = civetContentPositionToSvelteDocRelative(remappedContentEnd, scriptStartPosition);
            
            remappedRange = Range.create(svelteDocStart, svelteDocEnd);
        }
            
        return { contents: hoverContents, range: remappedRange };
    }
} 