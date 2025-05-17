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

        // Initial Svelte position to TSX position/offset for potential direct use or definition lookup
        const tsxGeneratedPositionForInitialHover = tsDoc.getGeneratedPosition(position);
        const tsxOffsetForInitialHoverOrDefLookup = tsDoc.offsetAt(tsxGeneratedPositionForInitialHover);

        Logger.debug('[CivetHoverProvider.doHover] Initial mapping:', {
            originalSveltePosition: position,
            mappedTsxPosition: tsxGeneratedPositionForInitialHover,
            mappedTsxOffset: tsxOffsetForInitialHoverOrDefLookup,
            filePath: tsDoc.filePath,
        });

        const svelteOffsetForWrapper = document.offsetAt(position); // Svelte offset of the user's cursor

        // Determine if hover is in template/markup (outside the civet <script> block)
        const rawOffsetOriginal = document.offsetAt(position); // Same as svelteOffsetForWrapper
        const scriptInfo = document.scriptInfo || document.moduleScriptInfo;

        if (scriptInfo && (rawOffsetOriginal < scriptInfo.container.start || rawOffsetOriginal > scriptInfo.container.end)) {
            // TEMPLATE HOVER LOGIC: Try to get definition, then get QuickInfo for the definition's location.
            Logger.debug('[CivetHoverProvider.doHover] Template hover path. Initial Svelte offset:', svelteOffsetForWrapper, 'Corresponding TSX offset for def lookup:', tsxOffsetForInitialHoverOrDefLookup);
            
            // Call getDefinitionAtPosition with SVELTE offset, as the wrapper expects it.
            const definitions = lang.getDefinitionAtPosition(tsDoc.filePath, svelteOffsetForWrapper);

            if (definitions && definitions.length) {
                const def = definitions[0]; // def.textSpan.start is a TSX offset
                Logger.debug('[CivetHoverProvider.doHover] Template hover: Raw definition from TS (TSX coords):', {
                    fileName: def.fileName, // Should be TSX file path
                    textSpan: def.textSpan  // TSX text span
                });

                // To get QuickInfo for this definition, we need its location as a SVELTE offset.
                // The definition's textSpan is in TSX coordinates. Map it back to Svelte.
                const tsxDefPositionStart = tsDoc.positionAt(def.textSpan.start);
                const svelteDefPositionMapped = tsDoc.getOriginalPosition(tsxDefPositionStart);

                if (svelteDefPositionMapped.line === -1) {
                    Logger.debug('[CivetHoverProvider.doHover] Template hover: Failed to map TSX definition position back to Svelte for QuickInfo. TSX Def Start:', def.textSpan.start);
                    return null;
                }
                const svelteDefOffsetForQuickInfo = document.offsetAt(svelteDefPositionMapped);

                Logger.debug('[CivetHoverProvider.doHover] Template hover: Mapped TSX def offset', def.textSpan.start, 'to Svelte offset', svelteDefOffsetForQuickInfo, 'for QuickInfo lookup at definition site.');

                const infoAtDef = lang.getQuickInfoAtPosition(tsDoc.filePath, svelteDefOffsetForQuickInfo); // Call wrapper with SVELTE offset

                if (!infoAtDef) {
                    Logger.debug('[CivetHoverProvider.doHover] Template hover: No QuickInfo (infoAtDef is null/undefined) at definition site. Svelte Def Offset used:', svelteDefOffsetForQuickInfo, 'Definition was (TSX coords):', def);
                    return null;
                }
                if (!infoAtDef.textSpan) { // textSpan is in TSX coordinates
                    Logger.debug('[CivetHoverProvider.doHover] Template hover: QuickInfo found, but textSpan is missing. Svelte Def Offset used:', svelteDefOffsetForQuickInfo, 'Info:', infoAtDef);
                    return null;
                }
                
                const contents = ['```typescript', ts.displayPartsToString(infoAtDef.displayParts), '```']
                    .concat(getMarkdownDocumentation(infoAtDef.documentation, infoAtDef.tags) ? ['---', getMarkdownDocumentation(infoAtDef.documentation, infoAtDef.tags)!] : [])
                    .join('\\n');
                
                // The hover range should be the original hover position in the template, not the definition's range.
                // However, svelte2tsx often maps template identifiers to a broad range.
                // For now, let's use the original mapped range of the identifier being hovered.
                // Or, map the QuickInfo's textSpan (which is for the definition in TSX) back to Svelte.
                // Let's try mapping the definition's QuickInfo span back to the original Svelte doc.
                const finalHoverRangeSvelte = mapObjWithRangeToOriginal(tsDoc, { range: convertRange(tsDoc, infoAtDef.textSpan) })?.range 
                    || { start: position, end: { line: position.line, character: position.character + (def.name?.length || 1) }};


                Logger.debug('[CivetHoverProvider.doHover] Template hover: QuickInfo from def site (TSX span):', infoAtDef.textSpan, 'Mapped to Svelte range:', finalHoverRangeSvelte);
                return { contents, range: finalHoverRangeSvelte };

            } else {
                Logger.debug('[CivetHoverProvider.doHover] Template hover: No definitions found by getDefinitionAtPosition. Svelte offset used:', svelteOffsetForWrapper, 'TSX offset for def lookup was:', tsxOffsetForInitialHoverOrDefLookup);
                
                Logger.debug('[CivetHoverProvider.doHover] Template hover: Attempting fallback to direct QuickInfo at original Svelte hover position. Svelte offset:', svelteOffsetForWrapper);
                const infoAtHover = lang.getQuickInfoAtPosition(tsDoc.filePath, svelteOffsetForWrapper); // Call wrapper with SVELTE offset

                if (!infoAtHover) {
                    Logger.debug('[CivetHoverProvider.doHover] Template hover fallback: No QuickInfo (infoAtHover is null/undefined) at Svelte offset:', svelteOffsetForWrapper);
                    return null;
                }
                if (!infoAtHover.textSpan) { // textSpan is in TSX coordinates
                    Logger.debug('[CivetHoverProvider.doHover] Template hover fallback: QuickInfo found, but textSpan is missing. Svelte offset:', svelteOffsetForWrapper, 'Info:', infoAtHover);
                    return null;
                }

                Logger.debug('[CivetHoverProvider.doHover] Template hover fallback: Raw QuickInfo from TS (TSX coords):', {
                    textSpan: infoAtHover.textSpan,
                    displayPartsLength: infoAtHover.displayParts?.length,
                });

                const declaration = ts.displayPartsToString(infoAtHover.displayParts);
                const documentation = getMarkdownDocumentation(infoAtHover.documentation, infoAtHover.tags);
                const contents = ['```typescript', declaration, '```']
                    .concat(documentation ? ['---', documentation] : [])
                    .join('\\n');
                
                // infoAtHover.textSpan is in TSX. Map it to original Svelte document.
                const svelteRange = mapObjWithRangeToOriginal(tsDoc, { range: convertRange(tsDoc, infoAtHover.textSpan) })?.range;

                if (!svelteRange) {
                    Logger.debug('[CivetHoverProvider.doHover] Template hover fallback: Failed to map QuickInfo TSX textSpan back to Svelte range. TSX span:', infoAtHover.textSpan);
                    // Fallback to a small range at the original hover position if mapping fails
                    const fallbackRange = { start: position, end: { line: position.line, character: position.character + 1 }};
                    return { contents, range: fallbackRange };
                }
                
                Logger.debug('[CivetHoverProvider.doHover] Template hover fallback: Mapped hover. Svelte range:', svelteRange);
                return { contents, range: svelteRange };
            }
        } else {
            // SCRIPT HOVER LOGIC (or fallback if not clearly in template)
            Logger.debug('[CivetHoverProvider.doHover] Script hover path. Calling getQuickInfoAtPosition with Svelte offset:', svelteOffsetForWrapper);
            
            // Call wrapper with Svelte file path and SVELTE offset
            const info = lang.getQuickInfoAtPosition(tsDoc.filePath, svelteOffsetForWrapper); 

            if (!info) {
                Logger.debug('[CivetHoverProvider.doHover] Script hover: No QuickInfo (info is null/undefined) at Svelte offset:', svelteOffsetForWrapper);
                return null;
            }
            if (!info.textSpan) { // textSpan is in TSX coordinates
                Logger.debug('[CivetHoverProvider.doHover] Script hover: QuickInfo found, but textSpan is missing. Svelte offset:', svelteOffsetForWrapper, 'Info:', info);
            return null;
        }

            Logger.debug('[CivetHoverProvider.doHover] Script hover: Raw QuickInfo from TS (TSX coords):', {
            textSpan: info.textSpan,
                displayPartsLength: info.displayParts?.length,
        });

        const declaration = ts.displayPartsToString(info.displayParts);
        const documentation = getMarkdownDocumentation(info.documentation, info.tags);
        const contentsScript = ['```typescript', declaration, '```']
            .concat(documentation ? ['---', documentation] : [])
                .join('\\n');
            
            // info.textSpan is in TSX. Map it to original Svelte document.
            const svelteRange = mapObjWithRangeToOriginal(tsDoc, { range: convertRange(tsDoc, info.textSpan) })?.range;

            if (!svelteRange) {
                Logger.debug('[CivetHoverProvider.doHover] Script hover: Failed to map QuickInfo TSX textSpan back to Svelte range. TSX span:', info.textSpan);
                // Fallback to a small range at the original hover position if mapping fails
                const fallbackRange = { start: position, end: { line: position.line, character: position.character + 1 }};
                return { contents: contentsScript, range: fallbackRange };
            }
            
            Logger.debug('[CivetHoverProvider.doHover] Script hover: Mapped hover. Svelte range:', svelteRange);
            return { contents: contentsScript, range: svelteRange };
        }
    }
} 