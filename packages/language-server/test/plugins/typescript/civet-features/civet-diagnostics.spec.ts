import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { DiagnosticsProviderImpl } from '../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { LSConfigManager } from '../../../../src/ls-config';
import { pathToUrl } from '../../../../src/utils';

describe('Civet Diagnostics Feature', () => {
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
    const provider = new DiagnosticsProviderImpl(resolver, new LSConfigManager());
    const content = ts.sys.readFile(filePath) || '';
    const document = docManager.openClientDocument(<any>{
      uri: pathToUrl(filePath),
      text: content
    });
    return { provider, document };
  }

  it('reports TypeScript errors in Civet snippet and maps back to Civet', async () => {
    const { provider, document } = setup('simple.svelte');
    const diagnostics = await provider.getDiagnostics(document);
    assert.ok(diagnostics.length > 0, 'Should have at least one diagnostic');
    const diag = diagnostics[0];

    // The error should be the 'toUpperCase' call on the inferred type
    assert.ok(
      diag.message.includes('does not exist on type'),
      `Unexpected diagnostic message: ${diag.message}`
    );

    // The diagnostic range should map back to the Civet code line/column
    // 'const str := num.toUpperCase();' is on line 1, 'str' starts at column 6
    assert.strictEqual(diag.range.start.line, 1);
    assert.strictEqual(diag.range.start.character, 6);
  });
});
