import { Document } from '../../../lib/documents';
import { CodeActionsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../ls-config';
import { CodeActionsProviderImpl } from '../../typescript/features/CodeActionsProvider';
import { CompletionsProviderImpl } from '../../typescript/features/CompletionProvider';
import {
    CodeAction,
    CodeActionContext,
    Range
} from 'vscode-languageserver';

export class CivetCodeActionsProvider implements CodeActionsProvider {
    private tsProvider: CodeActionsProviderImpl;
    constructor(
        private readonly lsAndTSDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager
    ) {
        this.tsProvider = new CodeActionsProviderImpl(
            this.lsAndTSDocResolver,
            new CompletionsProviderImpl(this.lsAndTSDocResolver, this.configManager),
            this.configManager
        );
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        if (document.getLanguageAttribute('script') !== 'civet') {
        return [];
        }
        return this.tsProvider.getCodeActions(document, range, context);
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[]
    ): Promise<any> {
        return this.tsProvider.executeCommand
            ? this.tsProvider.executeCommand(document, command, args)
            : null;
    }

    async resolveCodeAction(
        document: Document,
        codeAction: CodeAction,
        cancellationToken?: any
    ): Promise<CodeAction> {
        if (this.tsProvider.resolveCodeAction) {
            return this.tsProvider.resolveCodeAction(document, codeAction, cancellationToken);
        }
        return codeAction;
    }
}