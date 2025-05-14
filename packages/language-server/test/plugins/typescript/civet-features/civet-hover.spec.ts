import * as assert from 'assert';
import * as path from 'path';
import { Logger } from '../../../../src/logger';
Logger.setDebug(true);
import { Hover, Position } from 'vscode-languageserver';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../../src/ls-config';
import { pathToUrl } from '../../../../src/utils';
import { CivetHoverProvider } from '../../../../src/plugins/civet/features/CivetHoverProvider';
import * as fs from 'fs';

describe('Civet Hover Feature', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  function setup(fileName: string) {
    const filePath = path.join(fixturesDir, fileName);
    const docManager = new DocumentManager(
      (textDocument: any) => new Document(textDocument.uri, textDocument.text)
    );
    const resolver = new LSAndTSDocResolver(
      docManager,
      [pathToUrl(fixturesDir)],
      new LSConfigManager()
    );
    const provider = new CivetHoverProvider(resolver);
    const content = ts.sys.readFile(filePath) || '';
    const document = docManager.openClientDocument(<any>{
      uri: pathToUrl(filePath),
      text: content
    });
    return { provider, document };
  }

  // Dynamically test hover for all Civet fixtures
  const fixtureFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));
  for (const fileName of fixtureFiles) {
    it(`provides hover info for Civet variable mapping back to ${fileName}`, async () => {
      const { provider, document } = setup(fileName);
      // Hover on 'num' in the script content: line 1, character 1 (file-level)
      const hover = await provider.doHover(document, Position.create(1, 1));
      // Ensure hover is not null
      assert.ok(hover !== null, `Expected hover for fixture ${fileName} not to be null`);
      const actual = hover!;
      // Contents should be a TS code block
      assert.ok(
        typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
        'Hover contents should start with a TypeScript code block'
      );
      // Range should map back to the original script
      assert.deepStrictEqual(actual.range, {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 3 }
      });
    });
  }
});
