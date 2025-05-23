import { Document } from '../../../lib/documents';
import { CodeActionsProvider, CompletionsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../ls-config';
import { CodeAction, CodeActionContext, Range, WorkspaceEdit, TextEdit, Position } from 'vscode-languageserver';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin';
import { remapPosition, 
    forwardMapRaw, 
    svelteDocPositionToCivetContentRelative, 
    adjustTsPositionForLeadingNewline, 
    civetContentPositionToSvelteDocRelative, 
    type RawVLQSourcemapLines, 
    type MappingPosition } from '../util';
import { CodeActionsProviderImpl } from '../../typescript/features/CodeActionsProvider';
import { CompletionsProviderImpl } from '../../typescript/features/CompletionProvider'; // Required by CodeActionsProviderImpl
import * as ts from 'typescript';

export class CivetCodeActionsProvider implements CodeActionsProvider {
    private tsProvider: CodeActionsProviderImpl;

    constructor(
        private readonly lsAndTSDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager,
        private readonly plugin: CivetPlugin // Inject CivetPlugin
    ) {
        // The underlying TS provider needs a completions provider. 
        // For Civet, this should ideally be the CivetCompletionsProvider if actions depend on it.
        // However, the TS CodeActionsProviderImpl expects a CompletionsProviderImpl from TS features.
        // This might indicate a deeper architectural consideration if Civet completions are needed for TS code actions.
        // For now, we use the direct TS CompletionsProviderImpl, assuming code actions are based on raw TS analysis.
        const tsCompletionsProvider = new CompletionsProviderImpl(this.lsAndTSDocResolver, this.configManager);
        this.tsProvider = new CodeActionsProviderImpl(
            this.lsAndTSDocResolver,
            tsCompletionsProvider, 
            this.configManager
        );
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[]> {
        const cached = this.plugin.getCompiledData(document.uri);
        if (!cached || !cached.compiledTsCode) {
            return [];
        }

        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
        return [];
        }
        const scriptStartPosition = civetTagInfo.startPos;
        const { originalContentLineOffset, rawSourcemapLines, compiledTsCode } = cached;
        const hostTsCode = this.plugin.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || compiledTsCode;

        // 1. Map Svelte range to Civet content range
        const civetContentStart = svelteDocPositionToCivetContentRelative(range.start, scriptStartPosition);
        const civetContentEnd = svelteDocPositionToCivetContentRelative(range.end, scriptStartPosition);

        // 2. Adjust for original content offset (if any lines were stripped)
        const adjustedCivetStart: MappingPosition = originalContentLineOffset > 0 ? 
            { line: Math.max(0, civetContentStart.line - originalContentLineOffset), character: civetContentStart.character } : 
            civetContentStart;
        const adjustedCivetEnd: MappingPosition = originalContentLineOffset > 0 ? 
            { line: Math.max(0, civetContentEnd.line - originalContentLineOffset), character: civetContentEnd.character } : 
            civetContentEnd;

        if (!rawSourcemapLines) return [];

        // 3. Map adjusted Civet content range to TS range
        const tsStart = forwardMapRaw(rawSourcemapLines, adjustedCivetStart);
        const tsEnd = forwardMapRaw(rawSourcemapLines, adjustedCivetEnd);
        const tsRange = Range.create(tsStart, tsEnd);

        // 4. Get code actions from the TS provider using the mapped TS range
        const tsCodeActions = await this.tsProvider.getCodeActions(document, tsRange, context);

        // 5. Map edits in these actions back to Svelte/Civet ranges
        const mappedCodeActions: CodeAction[] = [];
        for (const action of tsCodeActions) {
            if (action.edit) {
                const mappedEdit = await this.mapWorkspaceEditToCivet(action.edit, document.uri, scriptStartPosition, originalContentLineOffset, rawSourcemapLines, hostTsCode);
                if (mappedEdit) {
                    mappedCodeActions.push({ ...action, edit: mappedEdit });
                }
            } else {
                mappedCodeActions.push(action); // Action without edits needs no mapping
            }
        }
        return mappedCodeActions;
    }

    private async mapWorkspaceEditToCivet(
        tsEdit: WorkspaceEdit,
        docUri: string, 
        scriptStartPosition: Position,
        originalContentLineOffset: number,
        rawSourcemapLines: number[][][],
        hostTsCode: string
    ): Promise<WorkspaceEdit | undefined> {
        const changes: { [uri: string]: TextEdit[] } = {};
        let hasMappedChanges = false;

        if (tsEdit.changes) {
            for (const uri in tsEdit.changes) {
                if (uri !== docUri) { // Only map changes for the current Civet document
                    changes[uri] = tsEdit.changes[uri]; // Keep changes for other files as is
                    hasMappedChanges = true; // Or consider if these should be filtered out / handled
                    continue;
                }
                const mappedTextEdits: TextEdit[] = [];
                for (const tsTextEdit of tsEdit.changes[uri]) {
                    const tsRange = tsTextEdit.range;

                    const remappedStartPos = remapPosition(tsRange.start, rawSourcemapLines);
                    const remappedEndPos = remapPosition(tsRange.end, rawSourcemapLines);

                    let finalSvelteStart = civetContentPositionToSvelteDocRelative(
                        originalContentLineOffset > 0 ? { line: remappedStartPos.line + originalContentLineOffset, character: remappedStartPos.character } : remappedStartPos,
                        scriptStartPosition
                    );
                    let finalSvelteEnd = civetContentPositionToSvelteDocRelative(
                        originalContentLineOffset > 0 ? { line: remappedEndPos.line + originalContentLineOffset, character: remappedEndPos.character } : remappedEndPos,
                        scriptStartPosition
                    );
                    
                    // Basic range validation (start before end)
                    if (finalSvelteStart.line > finalSvelteEnd.line || 
                        (finalSvelteStart.line === finalSvelteEnd.line && finalSvelteStart.character > finalSvelteEnd.character)) {
                        console.warn(`[CivetCodeActions] Skipping edit due to invalid mapped range: ${JSON.stringify({start: finalSvelteStart, end: finalSvelteEnd})}`);
                        continue; // Skip this edit if mapping is problematic
                    }

                    mappedTextEdits.push(TextEdit.replace(Range.create(finalSvelteStart, finalSvelteEnd), tsTextEdit.newText));
                    hasMappedChanges = true;
                }
                if (mappedTextEdits.length > 0) {
                    changes[uri] = mappedTextEdits;
                }
            }
        }
        return hasMappedChanges ? { changes } : undefined;
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        // Command execution might also involve edits. If the command is from TS and returns a WorkspaceEdit,
        // it will need similar mapping to mapWorkspaceEditToCivet.
        // For now, assuming TS provider handles commands that don't need remapping or are simple.
        if (this.tsProvider.executeCommand) {
            const result = await this.tsProvider.executeCommand(document, command, args);
            // TODO: If result is WorkspaceEdit, map it back to Civet coordinates.
            // This is a complex step similar to mapWorkspaceEditToCivet and needs careful handling.
            if (result && typeof result !== 'string' && (result as WorkspaceEdit).changes) {
                console.warn("[CivetCodeActionsProvider] executeCommand returned a WorkspaceEdit. Mapping edits back to Civet coordinates.");
                 const cached = this.plugin.getCompiledData(document.uri);
                 const civetTagInfo = getCivetTagInfo(document);
                 if(cached && civetTagInfo && civetTagInfo.startPos && cached.rawSourcemapLines) {
                    const hostTsCode = this.plugin.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || cached.compiledTsCode;
                    const mappedEdit = await this.mapWorkspaceEditToCivet(result as WorkspaceEdit, document.uri, civetTagInfo.startPos, cached.originalContentLineOffset, cached.rawSourcemapLines, hostTsCode);
                    return mappedEdit === undefined ? null : mappedEdit; // Ensure null is returned if mappedEdit is undefined
                 }
                 console.warn("[CivetCodeActionsProvider] executeCommand: Could not get necessary info to map edits. Returning unmapped edits (if any).");
                 return result as WorkspaceEdit; // Or null if it should not be returned unmapped
            }
            return result;
        }
        return null;
    }

    async resolveCodeAction(
        document: Document,
        codeAction: CodeAction
        // cancellationToken?: any // TS provider doesn't use token here
    ): Promise<CodeAction> {
        if (this.tsProvider.resolveCodeAction) {
            // Resolve the code action using the TS provider.
            const resolvedAction = await this.tsProvider.resolveCodeAction(document, codeAction /*, cancellationToken */);
            // If the resolved action has edits, they need to be mapped.
            if (resolvedAction.edit) {
                const cached = this.plugin.getCompiledData(document.uri);
                const civetTagInfo = getCivetTagInfo(document);
                if (cached && civetTagInfo && civetTagInfo.startPos && cached.rawSourcemapLines) {
                    const hostTsCode = this.plugin.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || cached.compiledTsCode;
                    const mappedEdit = await this.mapWorkspaceEditToCivet(resolvedAction.edit, document.uri, civetTagInfo.startPos, cached.originalContentLineOffset, cached.rawSourcemapLines, hostTsCode);
                    if (mappedEdit) {
                        return { ...resolvedAction, edit: mappedEdit };
                    }
                }
                // If mapping fails, return the action with unmapped edits (or handle error)
                console.warn("[CivetCodeActionsProvider] resolveCodeAction: Could not map edits for resolved action.");
            }
            return resolvedAction;
        }
        return codeAction; // Return original if no resolver or no edits
    }
}