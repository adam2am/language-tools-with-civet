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
  const fixturesDir = path.join(__dirname, 'fixtures', 'hover');

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

  const fixtureFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));
  for (const fileName of fixtureFiles) {
    it(`provides script hover info for ${fileName}`, async () => {
      const { provider, document } = setup(fileName);
      // Hover inside script: line 1, character 2 (on the identifier)
      const hover = await provider.doHover(document, Position.create(1, 2));
      assert.ok(hover !== null, `Expected script hover for ${fileName} not to be null`);
      const actual = hover!;
      assert.ok(actual.range, 'Hover range should be defined');
      // Contents should be a TS code block
      assert.ok(
        typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
        'Script hover contents should start with a TypeScript code block'
      );
      // Range start maps back to first Civet line
      assert.strictEqual(actual.range!.start.line, 1);
      assert.ok(actual.range!.start.character >= 0, 'Script hover character must be >= 0');
    });

    // Markup test only for files with a <template> section
    if (fileName.includes('template')) {
      it(`provides markup hover info for ${fileName}`, async () => {
        const { provider, document } = setup(fileName);
        // Hover inside template: line 6, character 6
        const hover = await provider.doHover(document, Position.create(6, 6));
        assert.ok(hover !== null, `Expected markup hover for ${fileName} not to be null`);
        const actual = hover!;
        assert.ok(actual.range, 'Hover range should be defined');
        // Contents should be a TS code block
        assert.ok(
          typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
          'Markup hover contents should start with a TypeScript code block'
        );
        // Range start maps back to original Civet declaration line
        assert.strictEqual(actual.range!.start.line, 1);
        assert.ok(actual.range!.start.character >= 0, 'Markup hover character must be >= 0');
      });
    }
  }
});
