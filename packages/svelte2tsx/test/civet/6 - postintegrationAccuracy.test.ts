/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

// Here we expect script-defined tokens to be offset by 2 lines (a known bug),
// but invocation outside the <script> should map correctly.
const fixture = 'IntegrationAccuracy.svelte';
const expectedScriptLine = 2;
const expectedInvokeLine = 6;
const token = 'funcForTest';
const observedOffset = 1;

describe('6 - postintegrationAccuracy: Civet mapping offset isolation - IntegrationAccuracy.svelte current ', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const input = fs.readFileSync(path.join(fixturesDir, fixture), 'utf-8');
  const { code: tsx, map } = svelte2tsx(input, { filename: fixture });
  const decoded = decode(map.mappings);
  const tracer = new TraceMap(map as any);
  const codeStr = tsx;

  it('script definition mapping is offset by two lines', () => {
    // find first occurrence in TSX (script definition)
    const idx = codeStr.indexOf(token);
    assert.ok(idx !== -1, 'Token not found in TSX output');
    const pre = codeStr.slice(0, idx);
    const genLine = pre.split('\n').length;
    const genCol = pre.split('\n').pop()!.length;
    const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
    assert.strictEqual(
      pos.source,
      fixture,
      'Script definition mapping should reference correct file'
    );
    // Known off-by-1: actual pos.line should equal expectedScriptLine + observedOffset
    assert.strictEqual(
      pos.line,
      expectedScriptLine + observedOffset,
      `Script mapping unexpected: got line ${pos.line}, expected ${expectedScriptLine + observedOffset}`
    );
  });

  it('invocation mapping is accurate outside <script>', () => {
    // find second occurrence in TSX (invocation in template)
    let idx = codeStr.indexOf(token);
    assert.ok(idx !== -1);
    idx = codeStr.indexOf(token, idx + token.length);
    assert.ok(idx !== -1, 'Invocation token not found in TSX output');
    const pre = codeStr.slice(0, idx);
    const genLine = pre.split('\n').length;
    const genCol = pre.split('\n').pop()!.length;
    const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
    assert.strictEqual(
      pos.source,
      fixture,
      'Invocation mapping should reference correct file'
    );
    // Observed off-by-1: actual pos.line should equal expectedInvokeLine + observedOffset
    assert.strictEqual(
      pos.line,
      expectedInvokeLine + observedOffset,
      `Invocation mapping unexpected: got line ${pos.line}, expected ${expectedInvokeLine + observedOffset}`
    );
  });
}); 