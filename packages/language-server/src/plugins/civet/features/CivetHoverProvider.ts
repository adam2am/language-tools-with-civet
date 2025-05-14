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
        const declaration = ts.displayPartsToString(info.displayParts);
        const documentation = getMarkdownDocumentation(info.documentation, info.tags);
        const contents = ['```typescript', declaration, '```']
            .concat(documentation ? ['---', documentation] : [])
            .join('\n');

        const mappedHover = mapObjWithRangeToOriginal(tsDoc, {
            range: convertRange(tsDoc, info.textSpan),
            contents
        });

        Logger.debug('[CivetHoverProvider.doHover] Mapped hover:', mappedHover);

        return mapObjWithRangeToOriginal(tsDoc, {
            range: convertRange(tsDoc, info.textSpan),
            contents
        });
    }
} 