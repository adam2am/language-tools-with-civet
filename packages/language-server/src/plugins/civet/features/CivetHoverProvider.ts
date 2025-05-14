import { Document, SourceMapDocumentMapper } from '../../../lib/documents';
import { HoverProvider } from '../../interfaces';
import { Hover, Position, Range } from 'vscode-languageserver';
import { dirname, resolve } from 'path';
import ts from 'typescript';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { DocumentSnapshot, SvelteDocumentSnapshot, SvelteSnapshotOptions } from '../../typescript/DocumentSnapshot';
import { getMarkdownDocumentation } from '../../typescript/previewer';
import { urlToPath } from '../../../utils';

export class CivetHoverProvider implements HoverProvider {
    constructor() { }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        // This check might be redundant if CivetPlugin already filters
        // but good for a standalone provider
        if (document.getLanguageAttribute('script') !== 'civet') {
            return null;
        }

        const scriptInfo = document.scriptInfo || document.moduleScriptInfo;
        if (!scriptInfo || !scriptInfo.content) {
            return null;
        }

        try {
            const civetPkgIndex = require.resolve('svelte-preprocess-with-civet');
            const civetPkgDir = dirname(civetPkgIndex);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { transformer: civetTransformer } = require(resolve(civetPkgDir, 'transformers', 'civet.js'));

            const filePath = document.getFilePath() || 'untitled.civet';
            const civetResult = civetTransformer({
                content: scriptInfo.content,
                filename: filePath,
                options: { sourceMap: true },
                attributes: scriptInfo.attributes
            });

            if (!civetResult || !civetResult.map) {
                console.error('Civet transformation failed or did not produce a source map.');
                return null;
            }

            const tsCode = civetResult.code;
            const civetMap = new TraceMap(civetResult.map);

            const tsFileName = filePath + '.ts';
            const svelteOptions: SvelteSnapshotOptions = {
                parse: undefined,
                version: '0.0.0',
                transformOnTemplateError: false,
                typingsNamespace: 'svelteHTML'
            };
            const tempDocForSnapshot = new Document(urlToPath(document.uri) + '.ts', tsCode);
            const tsDoc = new SvelteDocumentSnapshot(
                tempDocForSnapshot,
                null,
                ts.ScriptKind.TS,
                svelteOptions.version,
                tsCode,
                0,
                { has: () => false },
                undefined,
                undefined,
                undefined
            );

            const servicesHost: ts.LanguageServiceHost = {
                getScriptFileNames: () => [tsFileName],
                getScriptVersion: () => tsDoc.version.toString(),
                getScriptSnapshot: (fileName) => {
                    if (fileName === tsFileName) return tsDoc;
                    return undefined;
                },
                getCurrentDirectory: () => dirname(filePath),
                getCompilationSettings: () => ({ allowNonTsExtensions: true, jsx: ts.JsxEmit.Preserve }),
                getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
                fileExists: ts.sys.fileExists,
                readFile: ts.sys.readFile,
                readDirectory: ts.sys.readDirectory,
                directoryExists: ts.sys.directoryExists,
                getDirectories: ts.sys.getDirectories,
            };

            const lang = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

            const positionInCivetScriptContent: Position = {
                line: position.line - scriptInfo.startPos.line,
                character: position.character - (position.line === scriptInfo.startPos.line ? scriptInfo.startPos.character : 0)
            };

            const tsOffset = tsDoc.offsetAt(positionInCivetScriptContent);
            const quickInfo = lang.getQuickInfoAtPosition(tsFileName, tsOffset);

            if (!quickInfo || !quickInfo.textSpan) {
                return null;
            }

            const originalStartPos = originalPositionFor(civetMap, {
                line: tsDoc.positionAt(quickInfo.textSpan.start).line + 1,
                column: tsDoc.positionAt(quickInfo.textSpan.start).character
            });
            const originalEndPos = originalPositionFor(civetMap, {
                line: tsDoc.positionAt(quickInfo.textSpan.start + quickInfo.textSpan.length).line + 1,
                column: tsDoc.positionAt(quickInfo.textSpan.start + quickInfo.textSpan.length).character
            });

            if (!originalStartPos || originalStartPos.line === null || originalStartPos.column === null ||
                !originalEndPos || originalEndPos.line === null || originalEndPos.column === null) {
                return null;
            }

            const hoverRange: Range = {
                start: { line: originalStartPos.line - 1, character: originalStartPos.column },
                end: { line: originalEndPos.line - 1, character: originalEndPos.column }
            };

            let declaration = ts.displayPartsToString(quickInfo.displayParts);
            const documentation = getMarkdownDocumentation(quickInfo.documentation, quickInfo.tags);
            const contents = ['```typescript', declaration, '```']
                .concat(documentation ? ['---', documentation] : [])
                .join('\n');

            return {
                contents,
                range: hoverRange
            };

        } catch (e) {
            console.error('Error in CivetHoverProvider doHover:', e);
            return null;
        }
    }
} 