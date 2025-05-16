import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import {
  StreamMessageReader,
  StreamMessageWriter,
  createMessageConnection
} from 'vscode-jsonrpc';
import {
  InitializeParams,
  HoverRequest,
  TextDocumentPositionParams,
  TextDocumentItem,
  DidOpenTextDocumentNotification,
  DidOpenTextDocumentParams
} from 'vscode-languageserver-protocol';
import { Hover } from 'vscode-languageserver-types';

describe('IDE Integration Smoke Test (hover)', function() {
  this.timeout(20000);
  let proc: ChildProcess;
  let conn: ReturnType<typeof createMessageConnection>;

  before(async () => {
    // Launch the language server
    const serverPath = path.resolve(__dirname, '../../bin/server.js');
    proc = spawn('node', [serverPath], { cwd: path.resolve(__dirname, '../../') });
    conn = createMessageConnection(
      new StreamMessageReader(proc.stdout),
      new StreamMessageWriter(proc.stdin)
    );
    conn.listen();

    // Initialize
    const initParams: InitializeParams = {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
      workspaceFolders: []
    };
    await conn.sendRequest('initialize', initParams);
    conn.sendNotification('initialized', {});
  });

  after(() => {
    conn.sendNotification('shutdown');
    conn.sendNotification('exit');
    proc.kill();
  });

  it('should hover correctly on indent-arrow.svelte', async () => {
    const fixture = path.resolve(__dirname, '../plugins/typescript/civet-features/fixtures/hover/indent-arrow.svelte');
    const text = fs.readFileSync(fixture, 'utf-8');
    const uri = `file://${fixture}`;

    // Open document
    const doc: TextDocumentItem = { uri, languageId: 'svelte', version: 1, text };
    conn.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: doc } as DidOpenTextDocumentParams);

    // Locate the first interpolation identifier
    const match = text.match(/\{(\w+)\}/);
    assert.ok(match, 'No interpolation found in indent-arrow.svelte');
    const name = match[1];
    const index = (match.index || 0) + 1;
    const before = text.slice(0, index);
    const line = before.split(/\r?\n/).length - 1;
    const character = before.split(/\r?\n/).pop()!.length;

    const params: TextDocumentPositionParams = { textDocument: { uri }, position: { line, character } };
    const hover = await conn.sendRequest(HoverRequest.method, params) as Hover;
    assert.ok(hover && hover.range, 'Hover response missing range');
    assert.strictEqual(hover.range.start.line, line, 'Hover start line mismatch');
    assert.strictEqual(hover.range.start.character, character, 'Hover start character mismatch');
    assert.ok(hover.contents, 'Hover contents missing');
  });
}); 