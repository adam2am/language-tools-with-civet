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
import { CivetHoverProvider } from './features/CivetHoverProvider';
import { CivetDiagnosticsProvider } from './features/CivetDiagnosticProvider';
import { CivetCompletionsProvider } from './features/CivetCompletionsProvider';
import { CivetCodeActionsProvider } from './features/CivetCodeActionsProvider';
import { LSAndTSDocResolver } from '../typescript/LSAndTSDocResolver';
// import { CivetCodeActionsProvider } from './features/CivetDiagnosticsProvider';
// Import other feature providers here as they are created


export class CivetPlugin implements
    DiagnosticsProvider,
    HoverProvider,
    CompletionsProvider,
    CodeActionsProvider,
    SelectionRangeProvider {
    __name = 'civet';

    private hoverProvider: CivetHoverProvider;
    private diagnosticsProvider: CivetDiagnosticsProvider;
    private completionsProvider: CivetCompletionsProvider;
    private codeActionsProvider: CivetCodeActionsProvider;

    constructor(private configManager: LSConfigManager, private lsAndTsDocResolver: LSAndTSDocResolver) {
        this.hoverProvider = new CivetHoverProvider(this.lsAndTsDocResolver);
        this.diagnosticsProvider = new CivetDiagnosticsProvider(this.lsAndTsDocResolver, this.configManager);
        this.completionsProvider = new CivetCompletionsProvider(this.lsAndTsDocResolver, this.configManager);
        this.codeActionsProvider = new CivetCodeActionsProvider(this.lsAndTsDocResolver, this.configManager);
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return [];
        }
        return this.diagnosticsProvider.getDiagnostics(document);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        return this.hoverProvider.doHover(document, position);
    }

    async getCompletions(
        document: Document,
        position: Position,
        _?: any,
        _token?: any
    ): Promise<CompletionList | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        return this.completionsProvider.getCompletions(document, position);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return [];
        }
        return this.codeActionsProvider.getCodeActions(document, range, context);
    }

    async executeCommand(
        document: Document,
        command: string,
        _args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        // TODO: Delegate or handle Civet-specific commands
        console.warn('CivetPlugin.executeCommand not yet implemented. Returning null.');
        return null;
    }

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<any> {
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }
        // TODO: Delegate to CivetSelectionRangeProvider
        console.warn('CivetSelectionRangeProvider not yet implemented. Returning null.');
        return null;
    }
} 