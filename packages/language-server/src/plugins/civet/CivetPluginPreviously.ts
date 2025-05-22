// import { Document } from '../../lib/documents';
// import {
//     DiagnosticsProvider,
//     HoverProvider,
//     CompletionsProvider,
//     CodeActionsProvider,
//     SelectionRangeProvider
// } from '../interfaces';
// import { LSConfigManager } from '../../ls-config';
// import {
//     Diagnostic,
//     CompletionList,
//     Hover,
//     CodeAction,
//     CodeActionContext,
//     Range,
//     Position,
//     WorkspaceEdit
// } from 'vscode-languageserver';
// import { CivetHoverProvider } from './features/CivetHoverProvider';
// import { CivetDiagnosticsProvider } from './features/CivetDiagnosticProvider';
// import { CivetCompletionsProvider } from './features/CivetCompletionsProvider';
// import { CivetCodeActionsProvider } from './features/CivetCodeActionsProvider';
// import { LSAndTSDocResolver } from '../typescript/LSAndTSDocResolver';
// import { SelectionRangeProviderImpl } from '../typescript/features/SelectionRangeProvider';
// // import { CivetCodeActionsProvider } from './features/CivetDiagnosticsProvider';
// // Import other feature providers here as they are created


// export class CivetPlugin implements
//     DiagnosticsProvider,
//     HoverProvider,
//     CompletionsProvider,
//     CodeActionsProvider,
//     SelectionRangeProvider {
//     __name = 'civet';

//     private hoverProvider: CivetHoverProvider;
//     private diagnosticsProvider: CivetDiagnosticsProvider;
//     private completionsProvider: CivetCompletionsProvider;
//     private codeActionsProvider: CivetCodeActionsProvider;
//     private selectionRangeProvider: SelectionRangeProviderImpl;

//     constructor(private configManager: LSConfigManager, private lsAndTSDocResolver: LSAndTSDocResolver) {
//         this.hoverProvider = new CivetHoverProvider(this.lsAndTSDocResolver);
//         this.diagnosticsProvider = new CivetDiagnosticsProvider(this.lsAndTSDocResolver, this.configManager);
//         this.completionsProvider = new CivetCompletionsProvider(this.lsAndTSDocResolver, this.configManager);
//         this.codeActionsProvider = new CivetCodeActionsProvider(this.lsAndTSDocResolver, this.configManager);
//         this.selectionRangeProvider = new SelectionRangeProviderImpl(this.lsAndTSDocResolver);
//     }

//     async getDiagnostics(document: Document): Promise<Diagnostic[]> {
//         if (document.getLanguageAttribute('script') !== 'civet') {
//             return [];
//         }
//         return this.diagnosticsProvider.getDiagnostics(document);
//     }

//     async doHover(document: Document, position: Position): Promise<Hover | null> {
//         if (document.getLanguageAttribute('script') !== 'civet') {
//             return null;
//         }
//         return this.hoverProvider.doHover(document, position);
//     }

//     async getCompletions(
//         document: Document,
//         position: Position,
//         _?: any,
//         _token?: any
//     ): Promise<CompletionList | null> {
//         if (document.getLanguageAttribute('script') !== 'civet') {
//             return null;
//         }
//         return this.completionsProvider.getCompletions(document, position);
//     }

//     async getCodeActions(
//         document: Document,
//         range: Range,
//         context: CodeActionContext
//     ): Promise<CodeAction[]> {
//         if (document.getLanguageAttribute('script') !== 'civet') {
//             return [];
//         }
//         return this.codeActionsProvider.getCodeActions(document, range, context);
//     }

//     async executeCommand(
//         document: Document,
//         command: string,
//         _args?: any[]
//     ): Promise<WorkspaceEdit | string | null> {
//         if (document.getLanguageAttribute('script') !== 'civet') {
//             return null;
//         }
//         // Delegate to TS code-actions executeCommand
//         const res = this.codeActionsProvider.executeCommand
//             ? await this.codeActionsProvider.executeCommand(document, command, _args)
//             : null;
//         if (res == null) {
//             console.warn(`Needed implemetation for CivetPlugin.executeCommand: no result for command ${command}`);
//         }
//         return res;
//     }

//     async getSelectionRange(
//         document: Document,
//         position: Position
//     ): Promise<any> {
//         if (document.getLanguageAttribute('script') !== 'civet') {
//             return null;
//         }
//         // Delegate to TS selection-range provider
//         const res = await this.selectionRangeProvider.getSelectionRange(document, position);
//         if (res == null) {
//             console.warn(`Needed implemetation for CivetPlugin.getSelectionRange: no range for position ${position.line},${position.character}`);
//         }
//         return res;
//     }
// } 