// import * as assert from 'assert';
// import * as path from 'path';
// import { Logger } from '../../../../src/logger';
// Logger.setDebug(true);
// import { Hover, Position } from 'vscode-languageserver';
// import ts from 'typescript';
// import { Document, DocumentManager } from '../../../../src/lib/documents';
// import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
// import { LSConfigManager } from '../../../../src/ls-config';
// import { pathToUrl } from '../../../../src/utils';
// import { CivetHoverProvider } from '../../../../src/plugins/civet/features/CivetHoverProvider';
// import * as fs from 'fs';

//   const fixturesDir = path.join(__dirname, 'fixtures', 'hover');

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
//     const provider = new CivetHoverProvider(resolver);
//     const content = ts.sys.readFile(filePath) || '';
//     const document = docManager.openClientDocument(<any>{
//       uri: pathToUrl(filePath),
//       text: content
//     });
//     return { provider, document };
//   }

// describe('Civet Hover Feature - Script Hovers', () => {
//   const fixtureFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));
//   for (const fileName of fixtureFiles) {
//     it(`provides script hover info for ${fileName}`, async () => {
//       const { provider, document } = setup(fileName);
//       const hover = await provider.doHover(document, Position.create(1, 2)); // Targets identifier on line 1, char 2
//       assert.ok(hover !== null, `Expected script hover for ${fileName} not to be null. Hover: ${JSON.stringify(hover)}`);
//       const actual = hover!;
//       assert.ok(actual.range, 'Hover range should be defined');
//       assert.ok(
//         typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
//         'Script hover contents should start with a TypeScript code block'
//       );
//       assert.strictEqual(actual.range!.start.line, 1, 'Script hover range should map back to script line 1');
//       assert.ok(actual.range!.start.character >= 0, 'Script hover character must be >= 0');
//     });
//   }
// });

// describe('Civet Hover Feature - Template Hovers', () => {
//   it(`provides markup hover info for hover-template.svelte`, async () => {
//     const fileName = 'hover-template.svelte';
//     const { provider, document } = setup(fileName);
//     // Targets {hoverVarTemplate} at Svelte line 5, char 6 (0-indexed)
//     const hover = await provider.doHover(document, Position.create(5, 6)); 
//     assert.ok(hover !== null, `Expected markup hover for ${fileName} not to be null. Hover: ${JSON.stringify(hover)}`);
//     const actual = hover!;
//     assert.ok(actual.range, 'Hover range should be defined');
//     assert.ok(
//       typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
//       'Markup hover contents should start with a TypeScript code block'
//     );
//     assert.strictEqual(actual.range!.start.line, 1, 'Hover range should map back to original Civet declaration line');
//   });

//   it(`provides markup hover info for arrow-template.svelte`, async () => {
//     const fileName = 'arrow-template.svelte';
//         const { provider, document } = setup(fileName);
//     // Targets {hoverArrow} at Svelte line 5, char 6 (0-indexed) for 'hoverArrow'
//     const hover = await provider.doHover(document, Position.create(5, 6)); 
//     assert.ok(hover !== null, `Expected markup hover for defined hoverArrow in ${fileName} not to be null. Hover: ${JSON.stringify(hover)}`);
//     if (hover) {
//         const actual = hover!;
//         assert.ok(actual.range, 'Hover range should be defined');
//         assert.ok(
//           typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
//           'Markup hover contents should start with a TypeScript code block'
//         );
//         assert.strictEqual(actual.range!.start.line, 1, 'Hover range should map back to original Civet declaration line');
//     }
//   });

//   it(`provides null markup hover for undefined {fooFunc} in hover-user-case-template.svelte`, async () => {
//     const fileName = 'hover-user-case-template.svelte';
//     const { provider, document } = setup(fileName);
//     // Targets {fooFunc} at Svelte line 6, char 6 (0-indexed)
//     const hover = await provider.doHover(document, Position.create(6, 6)); 
//     assert.ok(hover === null, `Expected markup hover for undefined fooFunc in ${fileName} to be null. Hover: ${JSON.stringify(hover)}`);
//   });

//   it('provides correct hover info for {fooFunc2} in hover-user-case-template.svelte template', async () => {
//     const fileName = 'hover-user-case-template.svelte';
//     const { provider, document } = setup(fileName);
//     // Hover on {fooFunc2} in the template. Svelte Line 7, char 5 (0-indexed for 'f')
//     const hover = await provider.doHover(document, Position.create(7, 5)); 
//     assert.ok(hover !== null, `Expected markup hover for fooFunc2 in ${fileName} not to be null. Hover: ${JSON.stringify(hover)}`);
//     const actual = hover!;
//     assert.ok(actual.range, 'Hover range should be defined');
//     console.log('hover-user-case-template.svelte (fooFunc2) actual hover object:', JSON.stringify(actual, null, 2));
//     assert.ok(
//         typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
//         'Markup hover contents should start with a TypeScript code block for fooFunc2'
//     );
//     assert.ok(actual.contents.includes('fooFunc2'), 'Hover content should include fooFunc2');
//     assert.strictEqual(actual.range!.start.line, 1, 'Hover range should map to original Civet declaration line for fooFunc2');
//   });
// });
