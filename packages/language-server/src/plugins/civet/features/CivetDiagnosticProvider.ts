import { Document } from '../../../lib/documents';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../ls-config';
import { Diagnostic, Range } from 'vscode-languageserver';
import { CivetPlugin, getCivetTagInfo, adjustTsPositionForLeadingNewline, civetContentPositionToSvelteDocRelative } from '../CivetPlugin';
import { remapPosition as civetRemapPosition } from '../civetUtils';
import * as ts from 'typescript';

export class CivetDiagnosticsProvider implements DiagnosticsProvider {
    constructor(
        private readonly lsAndTSDocResolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager,
        private readonly plugin: CivetPlugin
    ) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        // Ensure the document is compiled and cached by the plugin
        // await this.plugin.handleDocumentChange(document); // This should be called by CivetPlugin before calling this provider

        const cached = this.plugin.compiledCivetCache.get(document.uri);
        if (!cached || !cached.compiledTsCode) {
            // If there's no compiled version, we can't get TS diagnostics for it.
            // Or, if the script isn't Civet, it might be handled by a generic TS provider elsewhere.
            return [];
        }

        if (!this.plugin.civetLanguageServiceHost) {
            console.warn("[CivetDiagnosticsProvider] civetLanguageServiceHost is not available.");
            return [];
        }

        // Get diagnostics from the TypeScript language service for the compiled code
        const tsDiagnostics = this.plugin.civetLanguageServiceHost.getSemanticDiagnostics(document.uri);
        // const tsSyntaxDiagnostics = this.plugin.civetLanguageServiceHost.getSyntacticDiagnostics(document.uri); // Potentially add later
        // const allTsDiagnostics = [...tsDiagnostics, ...tsSyntaxDiagnostics];
        // For now, let's focus on semantic diagnostics for simplicity

        if (!tsDiagnostics || tsDiagnostics.length === 0) {
            return [];
        }

        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            console.error(`[CivetDiagnosticsProvider] No valid civetTagInfo for ${document.uri} when mapping diagnostics.`);
            return [];
        }
        const scriptStartPosition = civetTagInfo.startPos;
        const { originalContentLineOffset, rawSourcemapLines, compiledTsCode } = cached;
        const hostTsCode = this.plugin.civetLanguageServiceHost.getScriptInfo(document.uri)?.code || compiledTsCode;

        const offsetToPositionInTs = (offset: number) => {
            let line = 0;
            let character = 0;
            for (let i = 0; i < offset && i < hostTsCode.length; i++) {
                if (hostTsCode[i] === '\n') {
                    line++;
                    character = 0;
                } else {
                    character++;
                }
            }
            return { line, character };
        };

        const mappedDiagnostics: Diagnostic[] = [];
        for (const tsDiag of tsDiagnostics) {
            if (tsDiag.start === undefined || tsDiag.length === undefined) continue;

            const tsStartPosUnadjusted = offsetToPositionInTs(tsDiag.start);
            const tsEndPosUnadjusted = offsetToPositionInTs(tsDiag.start + tsDiag.length);

            const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, hostTsCode);
            const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, hostTsCode);

            let remappedContentStart = civetRemapPosition(tsStartPos, rawSourcemapLines);
            let remappedContentEnd = civetRemapPosition(tsEndPos, rawSourcemapLines);

            if (originalContentLineOffset > 0) {
                remappedContentStart = { line: remappedContentStart.line + originalContentLineOffset, character: remappedContentStart.character };
                remappedContentEnd = { line: remappedContentEnd.line + originalContentLineOffset, character: remappedContentEnd.character };
            }

            const svelteDocStart = civetContentPositionToSvelteDocRelative(remappedContentStart, scriptStartPosition);
            const svelteDocEnd = civetContentPositionToSvelteDocRelative(remappedContentEnd, scriptStartPosition);
            
            let finalStart = svelteDocStart;
            let finalEnd = svelteDocEnd;

            if (finalStart.line > finalEnd.line || (finalStart.line === finalEnd.line && finalStart.character > finalEnd.character)) {
                console.warn(`[CivetDiagnosticsProvider] Invalid mapped range for diagnostic. Using start position for range.`);
                finalEnd = finalStart;
            }
            
            const messageText = typeof tsDiag.messageText === 'string' ? tsDiag.messageText : tsDiag.messageText.messageText;

            mappedDiagnostics.push({
                range: Range.create(finalStart, finalEnd),
                message: messageText,
                severity: tsDiag.category === ts.DiagnosticCategory.Error ? 1 :
                          tsDiag.category === ts.DiagnosticCategory.Warning ? 2 :
                          tsDiag.category === ts.DiagnosticCategory.Suggestion ? 4 : // LSP Suggestion is 3, but TS Suggestion seems to map better to 4 (Hint for older LSPs) or 3 if client supports it well.
                          tsDiag.category === ts.DiagnosticCategory.Message ? 4 : undefined, // ts.DiagnosticCategory.Message could be Info (4)
                code: tsDiag.code,
                source: tsDiag.source || 'civet-ts',
                // reportsUnnecessary: (tsDiag as any).reportsUnnecessary, // If you need to map this
                // reportsDeprecated: (tsDiag as any).reportsDeprecated, // If you need to map this
            });
        }

        return mappedDiagnostics;
    }
} 