import { Diagnostic } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { LSConfigManager } from '../../../ls-config';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin';
import { convertDiagnostics } from '../util';

export class CivetDiagnosticsProvider implements DiagnosticsProvider {
    constructor(
        private readonly resolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager,
        private readonly plugin: CivetPlugin
    ) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        const cached = this.plugin.compiledCivetCache.get(document.uri);
        const host = this.plugin.civetLanguageServiceHost;
        const civetTagInfo = getCivetTagInfo(document);
        if (!cached?.compiledTsCode || !cached.rawSourcemapLines || !host || !civetTagInfo?.startPos) {
            return [];
        }
        return convertDiagnostics(
            document,
            host,
            cached.compiledTsCode,
            cached.rawSourcemapLines,
            cached.originalContentLineOffset,
            civetTagInfo.startPos
        );
    }
} 