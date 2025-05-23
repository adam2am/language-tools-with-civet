import { Document } from '../../../lib/documents';
import { DefinitionsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { DefinitionLink, Position } from 'vscode-languageserver';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin'; // Removed MappingPosition from here
import { convertDefinitions } from '../util';

export class CivetDefinitionsProvider implements DefinitionsProvider {
    constructor(
        private readonly lsAndTSDocResolver: LSAndTSDocResolver,
        private readonly plugin: CivetPlugin
    ) {}

    async getDefinitions(document: Document, position: Position): Promise<DefinitionLink[]> {
        const cached = this.plugin.getCompiledData(document.uri);
        const host = this.plugin.civetLanguageServiceHost;
        const civetTagInfo = getCivetTagInfo(document);
        if (!cached?.compiledTsCode || !cached.rawSourcemapLines || !host || !civetTagInfo?.startPos) {
            return [];
        }
        return convertDefinitions(
            document,
            position,
            host,
            cached.compiledTsCode,
            cached.rawSourcemapLines,
            cached.originalContentLineOffset,
            civetTagInfo.startPos
        );
    }
} 