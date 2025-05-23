import { Document } from '../../../lib/documents';
import { Position, Hover } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin';
import { convertHover } from '../util';
import { HoverProvider } from '../../interfaces';

export class CivetHoverProvider implements HoverProvider {
    constructor(
        private readonly resolver: LSAndTSDocResolver,
        private readonly plugin: CivetPlugin
    ) {}

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        const cached = this.plugin.getCompiledData(document.uri);
        const civetTagInfo = getCivetTagInfo(document);
        return cached && civetTagInfo && civetTagInfo.startPos
            ? convertHover(
                document,
                position,
                this.plugin.civetLanguageServiceHost!,
                cached.compiledTsCode,
                cached.rawSourcemapLines,
                cached.originalContentLineOffset,
                civetTagInfo.startPos
              )
            : null;
    }
} 