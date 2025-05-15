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

  // Test hover mapping for markup in template fixture
  it('provides hover info for Civet variable in markup back to hover-template.svelte', async () => {
    const { provider, document } = setup('hover-template.svelte');
    // Hover on 'hoverVarTemplate' in the markup content: line 6, character 6
    const hover = await provider.doHover(document, Position.create(6, 6));
    // Ensure hover is not null
    assert.ok(
      hover !== null,
      'Expected hover for markup variable in hover-template.svelte not to be null'
    );
    const actual = hover!;
    // Range should map back to the original Civet declaration as per current mapping
    assert.deepStrictEqual(actual.range, {
      start: { line: 1, character: 2 },
      end: { line: 1, character: 18 }
    });
    // Contents should be a TS code block
    assert.ok(
      typeof actual.contents === 'string' && actual.contents.startsWith('```typescript'),
      'Hover contents for markup should start with a TypeScript code block'
    );
  });
});
