import { strict as assert } from 'assert';
import { svelte2tsx } from '../../src/svelte2tsx';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import fs from 'fs';
import path from 'path';

describe('11 - Blank Line Function Mapping Behavior #current', () => {
  const fixtureDir = path.join(__dirname, 'fixtures');
  const blankFile = path.join(fixtureDir, 'blankLineFunction.svelte');
  const noBlankFile = path.join(fixtureDir, 'noBlankLineFunction.svelte');

  function normalizePath(filePath: string) {
    return filePath.replace(/\\/g, '/');
  }

  it('should map kekw correctly when a blank line is present', () => {
    const svelteContent = fs.readFileSync(blankFile, 'utf-8');
    const { code: tsxCode, map: mapJson } = svelte2tsx(svelteContent, { filename: blankFile, isTsFile: true });
    const tracer = new (TraceMap as any)(mapJson);
    const tsxLines = tsxCode.split('\n');

    let foundLine = -1;
    let foundCol = -1;
    for (let i = 0; i < tsxLines.length; i++) {
      const idx = tsxLines[i].indexOf('kekw');
      if (idx !== -1) {
        foundLine = i + 1;
        foundCol = idx;
        break;
      }
    }
    assert.notStrictEqual(foundLine, -1, 'Token "kekw" not found in TSX (blank line fixture)');

    const origPos = originalPositionFor(tracer, { line: foundLine, column: foundCol });
    assert.ok(origPos, 'originalPositionFor returned null for blank line fixture');
    assert.strictEqual(normalizePath(origPos.source), normalizePath(blankFile));
    assert.strictEqual(origPos.line, 5, 'Expected "kekw" to map to Svelte L5 in blank-line fixture');
    assert.strictEqual(origPos.column, 2, 'Expected "kekw" to map to Svelte C2 in blank-line fixture');
  });

  it('should not map kekw to the same position when no blank line is present', () => {
    const svelteContent = fs.readFileSync(noBlankFile, 'utf-8');
    const { code: tsxCode, map: mapJson } = svelte2tsx(svelteContent, { filename: noBlankFile, isTsFile: true });
    const tracer = new (TraceMap as any)(mapJson);
    const tsxLines = tsxCode.split('\n');

    let foundLine = -1;
    let foundCol = -1;
    for (let i = 0; i < tsxLines.length; i++) {
      const idx = tsxLines[i].indexOf('kekw');
      if (idx !== -1) {
        foundLine = i + 1;
        foundCol = idx;
        break;
      }
    }
    assert.notStrictEqual(foundLine, -1, 'Token "kekw" not found in TSX (no-blank-line fixture)');

    const origPos = originalPositionFor(tracer, { line: foundLine, column: foundCol });
    assert.ok(origPos, 'originalPositionFor returned null for no-blank-line fixture');
    assert.strictEqual(normalizePath(origPos.source), normalizePath(noBlankFile));
    // Expect an incorrect mapping (different line or column)
    assert.notStrictEqual(origPos.line, 5, 'Expected no-blank-line fixture to not map "kekw" to Svelte L5');
    assert.notStrictEqual(origPos.column, 2, 'Expected no-blank-line fixture to not map "kekw" to Svelte C2');
  });
}); 