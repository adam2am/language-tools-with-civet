import { Document } from '../../../lib/documents';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../ls-config';
import { DiagnosticsProviderImpl } from '../../typescript/features/DiagnosticsProvider';
import { Diagnostic } from 'vscode-languageserver';

export class CivetDiagnosticsProvider implements DiagnosticsProvider {
    private tsProvider: DiagnosticsProviderImpl;

    constructor(
        private readonly lsAndTSDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager
    ) {
        this.tsProvider = new DiagnosticsProviderImpl(this.lsAndTSDocResolver, this.configManager);
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return [];
        }
        return this.tsProvider.getDiagnostics(document);
    }
} 