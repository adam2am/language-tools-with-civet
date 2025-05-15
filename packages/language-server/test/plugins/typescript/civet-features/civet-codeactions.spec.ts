import * as assert from 'assert';
import * as path from 'path';
import { Logger } from '../../../../src/logger';
Logger.setDebug(true);
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { LSConfigManager } from '../../../../src/ls-config';
import { pathToUrl } from '../../../../src/utils';
import { CivetPlugin } from '../../../../src/plugins/civet/CivetPlugin';
import { CodeActionContext, CodeActionKind } from 'vscode-languageserver';

describe('Civet Code Actions Feature', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'codeactions');

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
    const plugin = new CivetPlugin(new LSConfigManager(), resolver);
    const content = ts.sys.readFile(filePath) || '';
    const document = docManager.openClientDocument(<any>{
      uri: pathToUrl(filePath),
      text: content
    });
    return { plugin, document };
  }

  it('provides quick fix code actions for undefined variables', async () => {
    const { plugin, document } = setup('codeactions.svelte');
    const diagnostics = await plugin.getDiagnostics(document);
    assert.ok(diagnostics.length > 0, 'Should have diagnostics for undefined variable');
    const range = diagnostics[0].range;
    const context: CodeActionContext = { diagnostics, only: [CodeActionKind.QuickFix] };
    const codeActions = await plugin.getCodeActions(document, range, context);
    assert.ok(codeActions.length > 0, 'Should return at least one code action');
    const titles = codeActions.map(ca => ca.title);
    assert.ok(
      titles.some(title => title.includes('missingVar')),
      `Expected a code action for missingVar, got ${titles}`
    );
  });
}); 