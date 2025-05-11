import { Document } from '../../lib/documents';
import {
    DiagnosticsProvider,
    HoverProvider,
    CompletionsProvider,
    CodeActionsProvider,
    SelectionRangeProvider
} from '../interfaces';
import { LSConfigManager } from '../../ls-config';
import {
    Diagnostic,
    CompletionList,
    Hover,
    CodeAction,
    CodeActionContext,
    Range,
    Position,
    WorkspaceEdit
} from 'vscode-languageserver';

export class CivetPlugin implements
    DiagnosticsProvider,
    HoverProvider,
    CompletionsProvider,
    CodeActionsProvider,
    SelectionRangeProvider {
    __name = 'civet';

    constructor(private configManager: LSConfigManager) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        return [];
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        return null;
    }

    async getCompletions(
        document: Document,
        position: Position,
        _?: any,
        _token?: any
    ): Promise<CompletionList | null> {
        return null;
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        return [];
    }

    async executeCommand(
        document: Document,
        command: string,
        _args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        return null;
    }

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<any> {
        return null;
    }
} 