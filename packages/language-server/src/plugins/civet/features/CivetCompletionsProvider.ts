import { Document } from '../../../lib/documents';
import { CompletionList, Position } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../ls-config';
import { CompletionsProviderImpl } from '../../typescript/features/CompletionProvider';

export class CivetCompletionsProvider {
    private readonly tsCompletionProvider: CompletionsProviderImpl;

    constructor(
        private readonly resolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager
    ) {
        this.tsCompletionProvider = new CompletionsProviderImpl(resolver, configManager);
    }

    async getCompletions(
        document: Document,
        position: Position
    ): Promise<CompletionList | null> {
        // Delegate to TypeScript-based completions
        return this.tsCompletionProvider.getCompletions(
            document,
            position
        );
    }
} 