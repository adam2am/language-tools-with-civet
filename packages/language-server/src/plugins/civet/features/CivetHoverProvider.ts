import ts from 'typescript';
import { Document, mapObjWithRangeToOriginal } from '../../../lib/documents';
import { HoverProvider } from '../../interfaces';
import { Hover, Position } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { getMarkdownDocumentation } from '../../typescript/previewer';
import { convertRange } from '../../typescript/utils';
import { Logger } from '../../../logger';

export class CivetHoverProvider implements HoverProvider {
    constructor(private readonly lsAndTSDocResolver: LSAndTSDocResolver) { }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        const { lang, tsDoc } = await this.lsAndTSDocResolver.getLSAndTSDoc(document);

        const generatedPosition = tsDoc.getGeneratedPosition(position);
        const offset = tsDoc.offsetAt(tsDoc.getGeneratedPosition(position));

        Logger.debug('[CivetHoverProvider.doHover]', {
            originalPosition: position,
            generatedPosition,
            offsetInGenerated: offset,
            filePath: tsDoc.filePath,
        });

        const info = lang.getQuickInfoAtPosition(tsDoc.filePath, offset);
        if (!info || !info.textSpan) {
            Logger.debug('[CivetHoverProvider.doHover] No QuickInfo at position.');
            return null;
        }
        // Determine if hover is in markup (outside the civet <script> block)
        const rawOffsetOriginal = document.offsetAt(position);
        const scriptInfo = document.scriptInfo || document.moduleScriptInfo;
        if (scriptInfo && (rawOffsetOriginal < scriptInfo.container.start || rawOffsetOriginal > scriptInfo.container.end)) {
            // Hovering in template/markup; map hover to the Civet declaration using definitions
            const definitions = lang.getDefinitionAtPosition(tsDoc.filePath, offset);
            if (definitions && definitions.length) {
                const def = definitions[0];
                Logger.debug('[CivetHoverProvider.doHover] Raw definition from TS:', {
                    fileName: def.fileName,
                    textSpan: def.textSpan
                });
                const defGeneratedRange = convertRange(tsDoc, def.textSpan);
                Logger.debug('[CivetHoverProvider.doHover] Generated (TSX) definition range:', defGeneratedRange);
                const hoverInfoForMapping = { range: defGeneratedRange, contents: [] as any };
                // reuse contents from QuickInfo
                hoverInfoForMapping.contents = ['```typescript', ts.displayPartsToString(info.displayParts), '```']
                    .concat(getMarkdownDocumentation(info.documentation, info.tags) ? ['---', getMarkdownDocumentation(info.documentation, info.tags)!] : [])
                    .join('\n');
                Logger.debug('[CivetHoverProvider.doHover] Object to be mapped to original (definition):', hoverInfoForMapping);
                const mappedHoverDef = mapObjWithRangeToOriginal(tsDoc, hoverInfoForMapping);
                Logger.debug('[CivetHoverProvider.doHover] Mapped hover (definition):', mappedHoverDef);
                return mappedHoverDef;
            }
        }
        Logger.debug('[CivetHoverProvider.doHover] Raw QuickInfo from TS:', {
            textSpan: info.textSpan,
            displayParts: info.displayParts,
        });

        const declaration = ts.displayPartsToString(info.displayParts);
        const documentation = getMarkdownDocumentation(info.documentation, info.tags);
        const contents = ['```typescript', declaration, '```']
            .concat(documentation ? ['---', documentation] : [])
            .join('\n');

        const generatedRange = convertRange(tsDoc, info.textSpan);
        Logger.debug('[CivetHoverProvider.doHover] Generated (TSX) range:', generatedRange);

        const hoverInfoForMapping = {
            range: generatedRange,
            contents
        };
        Logger.debug('[CivetHoverProvider.doHover] Object to be mapped to original:', hoverInfoForMapping);

        const mappedHover = mapObjWithRangeToOriginal(tsDoc, hoverInfoForMapping);

        Logger.debug('[CivetHoverProvider.doHover] Mapped hover:', mappedHover);

        return mappedHover;
    }
} 