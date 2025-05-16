import ts from 'typescript';
import { Document, mapObjWithRangeToOriginal } from '../../../lib/documents';
import { HoverProvider } from '../../interfaces';
import { Hover, Position } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { getMarkdownDocumentation } from '../../typescript/previewer';
import { convertRange } from '../../typescript/utils';
import { Logger } from '../../../logger';
import { DocumentMapper } from '../../../lib/documents';

export class CivetHoverProvider implements HoverProvider {
    constructor(private readonly lsAndTSDocResolver: LSAndTSDocResolver) { }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        const { lang, tsDoc } = await this.lsAndTSDocResolver.getLSAndTSDoc(document);

        const generatedPosition = tsDoc.getGeneratedPosition(position);
        const offset = tsDoc.offsetAt(generatedPosition);

        Logger.debug('[CivetHoverProvider.doHover]', {
            originalPosition: position,
            generatedPosition,
            offsetInGenerated: offset,
            filePath: tsDoc.filePath,
        });

        // Determine if hover is in template/markup (outside the civet <script> block)
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
                // Get hover info at definition location
                const defOffset = def.textSpan.start;
                const infoAtDef = lang.getQuickInfoAtPosition(tsDoc.filePath, defOffset);
                if (!infoAtDef || !infoAtDef.textSpan) {
                    Logger.debug('[CivetHoverProvider.doHover] No QuickInfo at definition location for template hover. Definition was:', def);
                    return null;
                }
                const defGeneratedRange = convertRange(tsDoc, infoAtDef.textSpan);
                Logger.debug('[CivetHoverProvider.doHover] Generated (TSX) definition range:', defGeneratedRange);
                const contents = ['```typescript', ts.displayPartsToString(infoAtDef.displayParts), '```']
                    .concat(getMarkdownDocumentation(infoAtDef.documentation, infoAtDef.tags) ? ['---', getMarkdownDocumentation(infoAtDef.documentation, infoAtDef.tags)!] : [])
                    .join('\n');
                const hoverInfoForMapping = { range: defGeneratedRange, contents };
                Logger.debug('[CivetHoverProvider.doHover] Object to be mapped to original (definition):', hoverInfoForMapping);
                const mappedHoverDef = mapObjWithRangeToOriginal(tsDoc, hoverInfoForMapping);
                Logger.debug('[CivetHoverProvider.doHover] Mapped hover (definition):', mappedHoverDef);
                return mappedHoverDef;
            } else {
                Logger.debug('[CivetHoverProvider.doHover] No definitions found by getDefinitionAtPosition for template hover at offset:', offset);
                return null; // Explicitly return null if no definitions found
            }
        }
        // Get QuickInfo for script positions and fallback
        const info = lang.getQuickInfoAtPosition(tsDoc.filePath, offset);
        if (!info || !info.textSpan) {
            Logger.debug('[CivetHoverProvider.doHover] No QuickInfo at position.');
            return null;
        }

        // Unified hover mapping for script-only positions
        Logger.debug('[CivetHoverProvider.doHover] Raw QuickInfo from TS:', {
            textSpan: info.textSpan,
            displayParts: info.displayParts,
        });
        const declaration = ts.displayPartsToString(info.displayParts);
        const documentation = getMarkdownDocumentation(info.documentation, info.tags);
        const contentsScript = ['```typescript', declaration, '```']
            .concat(documentation ? ['---', documentation] : [])
            .join('\n');
        const generatedRangeScript = convertRange(tsDoc, info.textSpan);
        Logger.debug('[CivetHoverProvider.doHover] Generated (TSX) range:', generatedRangeScript);
        const hoverInfoScript = { range: generatedRangeScript, contents: contentsScript };
        Logger.debug('[CivetHoverProvider.doHover] Object to be mapped to original:', hoverInfoScript);
        const mappedHoverScript = mapObjWithRangeToOriginal(tsDoc, hoverInfoScript);
        Logger.debug('[CivetHoverProvider.doHover] Mapped hover:', mappedHoverScript);
        return mappedHoverScript;
    }
} 