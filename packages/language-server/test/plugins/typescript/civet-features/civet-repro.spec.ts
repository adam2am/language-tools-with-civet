import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Position } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../../src/ls-config';
import { pathToUrl } from '../../../../src/utils';
import { Logger } from '../../../../src/logger';

describe('Civet mapping repro harness', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'hover');
  const testFiles = [
    'unbraced-function.svelte',
    'indent-arrow.svelte'
  ];

  it('logs mapping info for all repro fixtures', async () => {
    const docManager = new DocumentManager(
      (textDocument: any) => new Document(textDocument.uri, textDocument.text)
    );
    const resolver = new LSAndTSDocResolver(
      docManager,
      [pathToUrl(fixturesDir)],
      new LSConfigManager()
    );

    for (const fileName of testFiles) {
      const filePath = path.join(fixturesDir, fileName);
      const content = fs.readFileSync(filePath, 'utf-8');
      const document = docManager.openClientDocument(<any>{
        uri: pathToUrl(filePath),
        text: content
      });
      const { lang, tsDoc } = await resolver.getLSAndTSDoc(document);

      // Locate the first interpolation {name}
      const interpMatch = content.match(/\{(\w+)\}/);
      if (!interpMatch) {
        Logger.debug(`[Repro ${fileName}] No interpolation found`);
        continue;
      }
      const exprName = interpMatch[1];
      const braceIndex = interpMatch.index! + 1; // position of identifier start
      const before = content.slice(0, braceIndex);
      const line = before.split('\n').length - 1;
      const character = before.split('\n').pop()!.length;
      const originalPosition = Position.create(line, character);

      // Raw svelte2tsx map
      const rawPos = (tsDoc as any).getRawSvelte2TsxMappedPosition?.(originalPosition);
      Logger.debug(`[Repro ${fileName}] raw svelte2tsx ->`, rawPos);

      // Generated TSX position
      const generatedPosition = tsDoc.getGeneratedPosition(originalPosition);
      Logger.debug(`[Repro ${fileName}] generatedPosition ->`, generatedPosition);

      // Offset in TSX
      const offset = tsDoc.offsetAt(generatedPosition);
      Logger.debug(`[Repro ${fileName}] offset ->`, offset);

      // Definitions count
      const definitions = lang.getDefinitionAtPosition(tsDoc.filePath, offset);
      Logger.debug(`[Repro ${fileName}] definitions found ->`, definitions?.length ?? 0);
    }

    assert.ok(true, 'Repro harness completed');
  });
}); 