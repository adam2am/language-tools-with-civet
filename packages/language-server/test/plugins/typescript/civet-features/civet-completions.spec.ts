// import * as assert from 'assert';
// import * as path from 'path';
// import { Logger } from '../../../../src/logger';
// Logger.setDebug(true);
// import ts from 'typescript';
// import { Document, DocumentManager } from '../../../../src/lib/documents';
// import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
// import { LSConfigManager } from '../../../../src/ls-config';
// import { pathToUrl } from '../../../../src/utils';
// import { CivetPlugin } from '../../../../src/plugins/civet/CivetPlugin';
// import { CompletionList } from 'vscode-languageserver';

// describe('Civet Completions Feature', () => {
//   const fixturesDir = path.join(__dirname, 'fixtures', 'completions');

//   function setup(fileName: string) {
//     const filePath = path.join(fixturesDir, fileName);
//     const docManager = new DocumentManager(
//       (textDocument: any) => new Document(textDocument.uri, textDocument.text)
//     );
//     const resolver = new LSAndTSDocResolver(
//       docManager,
//       [pathToUrl(fixturesDir)],
//       new LSConfigManager()
//     );
//     const plugin = new CivetPlugin(new LSConfigManager(), resolver);
//     const content = ts.sys.readFile(filePath) || '';
//     const document = docManager.openClientDocument(<any>{
//       uri: pathToUrl(filePath),
//       text: content
//     });
//     return { plugin, document };
//   }

//   it('reports completions for Civet script variables', async () => {
//     const { plugin, document } = setup('completions.svelte');
//     // Cursor at end of "fo" on line 2
//     const position = { line: 2, character: 2 };
//     const completions: CompletionList | null = await plugin.getCompletions(
//       document,
//       position
//     );
//     assert.ok(completions && completions.items.length > 0, 'Should return completions');
//     const labels = completions.items.map(item => item.label);
//     assert.ok(labels.includes('foo'), `Expected 'foo' in completions, got ${labels}`);
//   });
// }); 