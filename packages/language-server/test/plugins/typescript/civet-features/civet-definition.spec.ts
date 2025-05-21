// import * as assert from 'assert';
// import * as fs from 'fs';
// import * as path from 'path';
// import ts from 'typescript';
// import { Position, Range } from 'vscode-languageserver';
// import { Document, DocumentManager } from '../../../../src/lib/documents';
// import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
// import { LSConfigManager } from '../../../../src/ls-config';
// import { pathToUrl } from '../../../../src/utils';
// import { Logger } from '../../../../src/logger';

// describe('Civet Definition Feature for Shorthand Arrows', () => {
//   const fixturesDir = path.join(__dirname, 'fixtures', 'hover');

//   const testFiles = [
//     'arrow-template.svelte',
//     'arrow-params.svelte',
//     'arrow-untyped.svelte',
//     'arrow-generic.svelte',
//     'unbraced-function.svelte',
//     'indent-arrow.svelte'
//   ];
//   testFiles.forEach((fileName) => {
//     it(`resolves definition for symbols in ${fileName}`, async () => {
//       const filePath = path.join(fixturesDir, fileName);
//       const content = fs.readFileSync(filePath, 'utf-8');
//       const docManager = new DocumentManager(
//         (textDocument: any) => new Document(textDocument.uri, textDocument.text)
//       );
//       const resolver = new LSAndTSDocResolver(
//         docManager,
//         [pathToUrl(fixturesDir)],
//         new LSConfigManager()
//       );
//       const document = docManager.openClientDocument(<any>{
//         uri: pathToUrl(filePath),
//         text: content
//       });
//       const { lang, tsDoc } = await resolver.getLSAndTSDoc(document);

//       // Dynamically locate the `{name}` interpolation in the template
//       const interpMatch = content.match(/\{(\w+)\}/);
//       assert.ok(interpMatch, `No interpolation found in ${fileName}`);
//       const exprName = interpMatch[1];
//       // Compute position: index of `{`, then line/character
//       const braceIndex = interpMatch.index! + 1; // position of identifier's first char
//       const before = content.slice(0, braceIndex);
//       const line = before.split('\n').length - 1;
//       const character = before.split('\n').pop()!.length;
//       const originalPosition = Position.create(line, character);
//       const generatedPosition = tsDoc.getGeneratedPosition(originalPosition);
//       const offset = tsDoc.offsetAt(generatedPosition);

//       if (fileName === 'unbraced-function.svelte' || fileName === 'indent-arrow.svelte') {
//         // Temporarily cast to any to bypass TS error if type system hasn't caught up
//         const rawPos = (tsDoc as any).getRawSvelte2TsxMappedPosition(originalPosition);
//         if (rawPos) {
//             Logger.debug(`[Raw s2tsx Map for ${fileName}] Original Svelte pos:`, originalPosition, `mapped to TSX:`, rawPos);
//         } else {
//             Logger.debug(`[Raw s2tsx Map for ${fileName}] No direct svelte2tsx mapping for Svelte pos:`, originalPosition);
//         }
//       }

//       const definitions = lang.getDefinitionAtPosition(tsDoc.filePath, offset);
//       assert.ok(definitions && definitions.length > 0, `Expected at least one definition for ${exprName} in ${fileName}`);

//       const def = definitions![0];
//       assert.strictEqual(pathToUrl(filePath), pathToUrl(def.fileName), 'Definition file should match source Svelte file');
//       assert.ok(def.textSpan.start >= 0, 'Definition textSpan.start should be non-negative');

//       // Verify that the definition maps back to the correct identifier in the Svelte file
//       const defStartPos = tsDoc.getOriginalPosition(tsDoc.positionAt(def.textSpan.start));
//       const defEndPos = tsDoc.getOriginalPosition(tsDoc.positionAt(def.textSpan.start + def.textSpan.length));
      
//       const originalDoc = docManager.get(pathToUrl(filePath));
//       assert.ok(originalDoc, `Original document not found for ${filePath}`);

//       const originalOffsetStart = originalDoc.offsetAt(defStartPos);
//       const originalOffsetEnd = originalDoc.offsetAt(defEndPos);
//       const mappedBackText = originalDoc.getText().substring(originalOffsetStart, originalOffsetEnd);
      
//       assert.strictEqual(mappedBackText, exprName, 
//         `Definition for ${exprName} maps back to '${mappedBackText}' instead of '${exprName}' in Svelte file ${fileName}`
//       );
//     });
//   });
// }); 