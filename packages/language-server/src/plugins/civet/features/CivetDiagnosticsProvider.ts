import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { LSConfigManager } from '../../../ls-config';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../../typescript/LSAndTSDocResolver';
import { CivetPlugin, getCivetTagInfo } from '../CivetPlugin';
import {
    remapRange,
    type RawVLQSourcemapLines,
    svelteDocPositionToCivetContentRelative,
    civetContentPositionToSvelteDocRelative,
    adjustTsPositionForLeadingNewline,
    flattenDiagnosticMessageText
} from '../util';
import * as ts from 'typescript';

export class CivetDiagnosticsProvider implements DiagnosticsProvider {
    constructor(
        private readonly resolver: LSAndTSDocResolver,
        private readonly configManager: LSConfigManager,
        private readonly plugin: CivetPlugin
    ) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        const cached = this.plugin.compiledCivetCache.get(document.uri);
        if (!cached || !cached.compiledTsCode || !cached.rawSourcemapLines) {
            return []; // No cache or no compiled code/sourcemap, no diagnostics
        }

        const { compiledTsCode, rawSourcemapLines, originalContentLineOffset } = cached;

        if (!this.plugin.civetLanguageServiceHost) {
            console.warn("[CivetDiagnosticsProvider] civetLanguageServiceHost not available.");
            return [];
        }

        const tsDiagnostics = this.plugin.civetLanguageServiceHost.getSemanticDiagnostics(document.uri);

        if (!tsDiagnostics || tsDiagnostics.length === 0) {
            return [];
        }

        const civetTagInfo = getCivetTagInfo(document);
        if (!civetTagInfo || !civetTagInfo.startPos) {
            console.error(`[CivetDiagnosticsProvider] No valid civetTagInfo for ${document.uri}`);
            return []; 
        }
        const scriptStartPosition = civetTagInfo.startPos;

        // Create a temporary Document-like object for the generated TS code to use for range conversion
        // This is a bit of a hack; ideally, the TS service host would give us line/char directly
        // or we'd have a more direct offset-to-Position for the *generated* code within the host.
        const tsDoc = { 
            getText: () => compiledTsCode, 
            positionAt: (offset: number) => {
                let line = 0;
                let character = 0;
                for (let i = 0; i < offset && i < compiledTsCode.length; i++) {
                    if (compiledTsCode[i] === '\n') {
                        line++;
                        character = 0;
                    } else {
                        character++;
                    }
                }
                return { line, character };
            }
        };

        return tsDiagnostics.map(diag => {
            if (diag.start === undefined || diag.length === undefined) {
                // Should not happen with semantic diagnostics, but guard anyway
                return {
                    message: flattenDiagnosticMessageText(diag.messageText),
                    range: Range.create(0,0,0,0), // Default to top of file
                    severity: diag.category === ts.DiagnosticCategory.Error ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
                    source: 'civet'
                } as Diagnostic;
            }

            const tsStartPosUnadjusted = tsDoc.positionAt(diag.start);
            const tsEndPosUnadjusted = tsDoc.positionAt(diag.start + diag.length);

            const tsStartPos = adjustTsPositionForLeadingNewline(tsStartPosUnadjusted, compiledTsCode);
            const tsEndPos = adjustTsPositionForLeadingNewline(tsEndPosUnadjusted, compiledTsCode);
            
            const remappedCivetRange = remapRange({ start: tsStartPos, end: tsEndPos }, rawSourcemapLines as RawVLQSourcemapLines);

            let effectiveCivetScriptStartPos = scriptStartPosition;
            if (originalContentLineOffset > 0) {
                effectiveCivetScriptStartPos = { 
                   line: scriptStartPosition.line + originalContentLineOffset, 
                   character: (remappedCivetRange.start.line === 0 && scriptStartPosition.line + originalContentLineOffset === scriptStartPosition.line) ? scriptStartPosition.character : 0
               }; 
           }

            const svelteDocRange = {
                start: civetContentPositionToSvelteDocRelative(remappedCivetRange.start, effectiveCivetScriptStartPos),
                end: civetContentPositionToSvelteDocRelative(remappedCivetRange.end, effectiveCivetScriptStartPos)
            };
            
            return {
                message: flattenDiagnosticMessageText(diag.messageText),
                range: svelteDocRange,
                severity: diag.category === ts.DiagnosticCategory.Error ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
                code: diag.code,
                source: 'civet'
            };
        });
    }
} 