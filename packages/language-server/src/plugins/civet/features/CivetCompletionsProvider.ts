import { Document } from '../../../lib/documents';
import { CompletionList, Position, Range, CompletionItem, CompletionItemKind, TextEdit, CompletionContext } from 'vscode-languageserver';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../ls-config';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin';
import { convertCompletions } from '../util';
import { CompletionsProvider } from '../../interfaces';

export class CivetCompletionsProvider implements CompletionsProvider {
    constructor(
        private readonly resolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager,
        private readonly plugin: CivetPlugin
    ) {}

    async getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<CompletionList | null> {
        // Delegate full mapping to util
        const cached = this.plugin.compiledCivetCache.get(document.uri);
        const civetTagInfo = getCivetTagInfo(document);
        return cached && cached.compiledTsCode && cached.rawSourcemapLines && civetTagInfo && civetTagInfo.startPos
            ? convertCompletions(
                document,
                position,
                completionContext,
                this.plugin.civetLanguageServiceHost!,
                cached.compiledTsCode,
                cached.rawSourcemapLines,
                cached.originalContentLineOffset,
                civetTagInfo.startPos
              )
            : null;
    }
    
    // Add resolveCompletion if your TS provider has it and it needs similar mapping
    // async resolveCompletion?(document: Document, item: CompletionItem): Promise<CompletionItem> {
    //     // Delegate to a TS resolveCompletion, potentially with mapping if needed
    //     // This is more complex if it involves additional text edits that need mapping
    //     return item;
    // }
} 