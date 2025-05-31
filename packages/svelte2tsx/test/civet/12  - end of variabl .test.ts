import { svelte2tsx } from '../../src/svelte2tsx';
import { readFileSync } from 'fs';
import { TraceMap, type EncodedSourceMap, traceSegment } from '@jridgewell/trace-mapping';
import path from 'path';
import assert from 'assert';

describe('endVariable.svelte hover mapping scenarios #current', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'endVariable.svelte');
  const svelteCode = readFileSync(fixturePath, 'utf-8');
  const svelteLines = svelteCode.split('\n');

  function getDefLine(varName: string): number {
    const idx = svelteLines.findIndex(line => line.includes(`${varName}:`));
    if (idx === -1) throw new Error(`Could not find definition of '${varName}'`);
    return idx + 1;
  }

  const { code: tsxCode, map: rawMapFromSvelte2tsx } = svelte2tsx(svelteCode, { filename: 'endVariable.svelte' });
  assert(rawMapFromSvelte2tsx, 'Expected a sourcemap from svelte2tsx');

  // Ensure the sourcemap has necessary fields
  const rawMap = {
    ...rawMapFromSvelte2tsx,
    file: rawMapFromSvelte2tsx.file || 'endVariable.svelte',
    version: rawMapFromSvelte2tsx.version || 3,
    sources: rawMapFromSvelte2tsx.sources || ['endVariable.svelte'],
    sourcesContent: rawMapFromSvelte2tsx.sourcesContent || [svelteCode],
    names: rawMapFromSvelte2tsx.names || [],
    mappings: rawMapFromSvelte2tsx.mappings || ''
  } as EncodedSourceMap;
  const tracer = new TraceMap(rawMap);

  // Helper to find a character/token within a given context substring
  function findCharacterInContext(token: string, context: string): { line: number; column: number } {
    const lines = tsxCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].indexOf(context);
      if (idx !== -1) {
        const col = lines[i].indexOf(token, idx);
        if (col !== -1) {
          return { line: i + 1, column: col };
        }
      }
    }
    throw new Error(`Could not find token '${token}' in context '${context}'`);
  }

  // 1. propFunc: single-character 'b'
  it('propFunc usage of b should NOT map to definition', () => {
    const pos = findCharacterInContext('b', 'number * b;');
    const segment = traceSegment(tracer, pos.line - 1, pos.column);
    assert(segment, 'traceSegment must return a segment for b usage');
    const origLine = segment![2] + 1;
    const defLine = getDefLine('b');
    assert.notStrictEqual(origLine, defLine, `b usage should not map to definition (got ${origLine})`);
  });

  it('propFunc semicolon should map to b definition', () => {
    const pos = findCharacterInContext(';', 'number * b;');
    const segment = traceSegment(tracer, pos.line - 1, pos.column);
    assert(segment, 'traceSegment must return a segment for semicolon');
    const origLine = segment![2] + 1;
    const defLine = getDefLine('b');
    assert.strictEqual(origLine, defLine, `semicolon should map to b definition line ${defLine} (got ${origLine})`);
  });

  // 2. twoPropsFunc: two-character ab and bc, no semicolon in original
  it('twoPropsFunc usage of ab should NOT map to definition', () => {
    const pos = findCharacterInContext('ab', 'number = ab * bc');
    const segment = traceSegment(tracer, pos.line - 1, pos.column);
    assert(segment, 'traceSegment must return a segment for ab usage');
    const origLine = segment![2] + 1;
    const defLine = getDefLine('ab');
    assert.notStrictEqual(origLine, defLine, `ab usage should not map to definition (got ${origLine})`);
  });

  it('twoPropsFunc asterisk should map to ab definition', () => {
    const pos = findCharacterInContext('*', 'ab * bc');
    const segment = traceSegment(tracer, pos.line - 1, pos.column);
    assert(segment, 'traceSegment must return a segment for asterisk');
    const origLine = segment![2] + 1;
    const defLine = getDefLine('ab');
    assert.strictEqual(origLine, defLine, `asterisk should map to ab definition line ${defLine} (got ${origLine})`);
  });

  // 3. propFuncAllGood: multi-character dv, semicolon present
  it('propFuncAllGood usage of dv should map to definition', () => {
    const pos = findCharacterInContext('dv', 'number * dv;');
    const segment = traceSegment(tracer, pos.line - 1, pos.column);
    assert(segment, 'traceSegment must return a segment for dv usage');
    const origLine = segment![2] + 1;
    const defLine = getDefLine('dv');
    assert.strictEqual(origLine, defLine, `dv usage should map to definition line ${defLine} (got ${origLine})`);
  });

  // 4. twoPropsFuncAllGood: multi-character ty and ui, semicolon present
  it('twoPropsFuncAllGood usage of ty should map to definition', () => {
    const pos = findCharacterInContext('ty', 'number = ty * ui;');
    const segment = traceSegment(tracer, pos.line - 1, pos.column);
    assert(segment, 'traceSegment must return a segment for ty usage');
    const origLine = segment![2] + 1;
    const defLine = getDefLine('ty');
    assert.strictEqual(origLine, defLine, `ty usage should map to definition line ${defLine} (got ${origLine})`);
  });

  it('twoPropsFuncAllGood usage of ui should map to definition', () => {
    const pos = findCharacterInContext('ui', 'ty * ui;');
    const segment = traceSegment(tracer, pos.line - 1, pos.column);
    assert(segment, 'traceSegment must return a segment for ui usage');
    const origLine = segment![2] + 1;
    const defLine = getDefLine('ui');
    assert.strictEqual(origLine, defLine, `ui usage should map to definition line ${defLine} (got ${origLine})`);
  });
});