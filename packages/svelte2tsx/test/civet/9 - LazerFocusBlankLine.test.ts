/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

describe('9 - LazerFocusBlankLine: mapping with leading blank lines #current', () => {
  const fixtures = [
    { name: 'LazerFocus2-issue4-allgood.svelte', expectOffset: 0 },
    { name: 'LazerFocus2-issue4.svelte', expectOffset: 0 /* expect broken offset */ }
  ];

  for (const { name, expectOffset } of fixtures) {
    it(`${name}: mapping for problematicFoo`, () => {
      const fixturesDir = path.resolve(__dirname, 'fixtures', 'lazerfocusOffset');
      const sveltePath = path.join(fixturesDir, name);
      const content = fs.readFileSync(sveltePath, 'utf-8');
      const { code: tsxCode, map } = svelte2tsx(content, { filename: name });
      const tracer = new TraceMap(map as any);

      // Locate generated position of the token
      const token = 'problematicFoo';
      const idx = tsxCode.indexOf(token);
      assert.ok(idx !== -1, `Token '${token}' not found in TSX output for ${name}`);
      const pre = tsxCode.slice(0, idx);
      const genLine = pre.split('\n').length;
      const genCol = pre.slice(pre.lastIndexOf('\n') + 1).length;

      // Determine original Svelte usage line for problematicFoo declaration
      const originalLines = content.split('\n');
      const usageLine0 = originalLines.findIndex(line => line.includes('problematicFoo') && line.includes(':='));
      assert.ok(usageLine0 >= 0, `Original 'problematicFoo' declaration not found in ${name}`);
      const usageLine1 = usageLine0 + 1;

      const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
      assert.strictEqual(pos.source, name, 'Source should be the Svelte file');

      const offset = pos.line - usageLine1;
      console.log(`${name} offset: ${offset}`);
      if (name === 'LazerFocus2-issue4-allgood.svelte') {
        assert.strictEqual(offset, expectOffset, `Expected offset ${expectOffset} for ${name}, got ${offset}`);
      } else {
        assert.notStrictEqual(offset, 0, `Offset for ${name} should be non-zero (found ${offset})`);
      }
    });
  }
}); 