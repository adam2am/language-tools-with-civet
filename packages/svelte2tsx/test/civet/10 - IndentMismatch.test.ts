/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

// Hypothesis 2: Indent/Dedent Mismatch - Verify that adding uniform indentation shifts the mapped column by the indent length
describe('10 - IndentMismatch: Hypothesis 2 Indent/Dedent Mismatch', () => {
  const fixtures = [
    { name: 'LazerFocus3-issue1.svelte', tokenName: 'problematicFoo' },
    { name: 'LazerFocus3-issue1.svelte', tokenName: 'allgoodToken' },
    { name: 'LazerFocus3-issue2.svelte', tokenName: 'problematicFoo' },
    { name: 'LazerFocus3-issue2.svelte', tokenName: 'allgood' }
  ];

  for (const { name, tokenName } of fixtures) {
    it(`${name}: indent shifts mapping for '${tokenName}'`, () => {
      const fixturesDir = path.resolve(__dirname, 'fixtures', 'lazerfocusOffset');
      const sveltePath = path.join(fixturesDir, name);
      const content = fs.readFileSync(sveltePath, 'utf-8');
      const indent = '  ';

      // Original mapping
      const { code: tsxCode, map: mapOriginal } = svelte2tsx(content, { filename: name });
      const tracerOriginal = new TraceMap(mapOriginal as any);
      const idxOriginal = tsxCode.indexOf(tokenName);
      assert.ok(idxOriginal !== -1, `Token '${tokenName}' not found in TSX output for ${name}`);
      const preOriginal = tsxCode.slice(0, idxOriginal);
      const genLineOrig = preOriginal.split('\n').length;
      const genColOrig = preOriginal.slice(preOriginal.lastIndexOf('\n') + 1).length;
      const posOriginal = originalPositionFor(tracerOriginal, { line: genLineOrig, column: genColOrig });
      assert.strictEqual(posOriginal.source, name, 'Source should be the Svelte file for original content');

      // Indented mapping
      const indentedContent = content.split('\n').map(line => indent + line).join('\n');
      const { code: tsxCodeIndent, map: mapIndent } = svelte2tsx(indentedContent, { filename: name });
      const tracerIndent = new TraceMap(mapIndent as any);
      const idxIndent = tsxCodeIndent.indexOf(tokenName);
      assert.ok(idxIndent !== -1, `Token '${tokenName}' not found in indented TSX output for ${name}`);
      const preIndent = tsxCodeIndent.slice(0, idxIndent);
      const genLineIndent = preIndent.split('\n').length;
      const genColIndent = preIndent.slice(preIndent.lastIndexOf('\n') + 1).length;
      const posIndent = originalPositionFor(tracerIndent, { line: genLineIndent, column: genColIndent });
      assert.strictEqual(posIndent.source, name, 'Source should be the Svelte file for indented content');

      // Expect the mapped column to shift by the indent length
      const indentLen = indent.length;
      assert.strictEqual(
        posIndent.column,
        posOriginal.column + indentLen,
        `Indent mismatch: expected column ${posOriginal.column + indentLen} (original ${posOriginal.column} + indentLen ${indentLen}), got ${posIndent.column}`
      );
    });
  }
}); 