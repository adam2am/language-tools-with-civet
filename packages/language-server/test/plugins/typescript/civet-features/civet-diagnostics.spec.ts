import * as assert from 'assert';
import * as path from 'path';
import { Logger } from '../../../../src/logger';
Logger.setDebug(true);
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../../src/ls-config';
import { pathToUrl } from '../../../../src/utils';
import { CivetDiagnosticsProvider } from '../../../../src/plugins/civet/features/CivetDiagnosticProvider';

describe('Civet Diagnostics Feature', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'diagnostics');

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
    const provider = new CivetDiagnosticsProvider(resolver, new LSConfigManager());
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
    // Now that we count the <script> tag on line 0, the 'str' error is on line 2
    assert.strictEqual(diag.range.start.line, 2);
    assert.strictEqual(diag.range.start.character, 15);
  });

  it('reports TypeScript errors for arrow-function call with wrong type', async () => {
    const { provider, document } = setup('arrow.svelte');
    const diagnostics = await provider.getDiagnostics(document);
    assert.ok(diagnostics.length > 0, 'Should have at least one diagnostic for arrow function');
    const diag = diagnostics[0];

    // The error should mention assignment to wrong parameter type
    assert.ok(
      diag.message.includes('not assignable'),
      `Unexpected diagnostic message: ${diag.message}`
    );
    // The diagnostic range should map back to the arrow call line
    assert.strictEqual(diag.range.start.line, 2);
    assert.ok(
      diag.range.start.character > 0,
      'Diagnostic character must be > 0'
    );
  });
});
