/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

describe('8.1 current - OffsetTwoAtTime: braceless vs braced offset analysis #current', () => {
  const fixtures: Array<{ name: string; token: string; expectOffset?: number }> = [
    { name: 'LazerFocus2-issue3.svelte', token: 'foo2', expectOffset: 0 },       // Fixed: Should now be 0
    { name: 'LazerFocus2-issue3-nooffset.svelte', token: 'foo2', expectOffset: 0 } // Fixed: Should now be 0
  ];

  for (const { name, token, expectOffset } of fixtures) {
    it(`${name}: template usage '${token}' mapping analysis`, () => {
      const fixturesDir = path.resolve(__dirname, 'fixtures', 'lazerfocusOffset');
      const sveltePath = path.join(fixturesDir, name);
      const content = fs.readFileSync(sveltePath, 'utf-8');
      const { code: tsxCode, map } = svelte2tsx(content, { filename: name });
      
      console.log(`\n--- TSX Output for ${name} ---`);
      console.log(tsxCode);
      console.log(`--- End TSX Output for ${name} ---\n`);

      console.log(`\n--- Sourcemap (V3) for ${name} ---`);
      console.log(JSON.stringify(map, null, 2));
      console.log(`--- End Sourcemap for ${name} ---\n`);

      const tracer = new TraceMap(map as any);
      const decoded = decode((map as any).mappings);

      // Find generated position of token in template (skip script occurrence)
      const firstIdx = tsxCode.indexOf(token);
      assert.ok(firstIdx !== -1, `Token '${token}' not found in TSX output for ${name}`);
      
      let idx = tsxCode.indexOf(token, firstIdx + token.length);
      if (idx === -1) { // Fallback if only one occurrence (e.g. token is only in template)
        idx = firstIdx;
      }
      assert.ok(idx !== -1, `Template occurrence of '${token}' not found in TSX output for ${name}`);
      
      const pre = tsxCode.slice(0, idx);
      const genLine = pre.split('\n').length;
      const genCol = pre.slice(pre.lastIndexOf('\n') + 1).length;

      const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
      assert.strictEqual(pos.source, name, 'Source should be the Svelte file');

      const originalLines = content.split('\n');
      let usageLine0: number;

      // Determine original usage line. For these specific fixtures, token is in an onclick.
      // If expanding, make this more robust or add fixture-specific logic.
      const onclickPattern = `onclick={${token}}`;
      usageLine0 = originalLines.findIndex(line => line.includes(onclickPattern));
      if (usageLine0 === -1) {
        // Fallback: simple template search if not in onclick (e.g. if token was just {token})
        const scriptEnd = originalLines.findIndex(line => line.includes('</script>'));
        usageLine0 = originalLines.findIndex((line, i) => i > scriptEnd && line.includes(token));
      }
      assert.ok(usageLine0 >= 0, `Token pattern '${token}' or '${onclickPattern}' not found in original Svelte for ${name}`);
      
      const usageLine1 = usageLine0 + 1;
      const offset = pos.line - usageLine1;

      console.log(`\n--- Mapping Analysis for ${name} (token: '${token}') ---`);
      console.log(`Generated Position: Line ${genLine}, Column ${genCol}`);
      console.log(`Original Svelte Position (from map): Line ${pos.line}, Column ${pos.column}`);
      console.log(`Expected Original Svelte Line (calculated): ${usageLine1}`);
      console.log(`Calculated Offset: ${offset}`);
      if (typeof expectOffset === 'number') {
        console.log(`Expected Offset: ${expectOffset}`);
        assert.strictEqual(offset, expectOffset, `Unexpected offset for ${name}: got ${offset}, expected ${expectOffset}`);
      }
      console.log(`Decoded V3 segments at generated line ${genLine}:`, JSON.stringify(decoded[genLine - 1], null, 2));
      console.log(`--- End Mapping Analysis for ${name} ---\n`);

      // Assertion: only assert if expectOffset is defined, otherwise just log.
      if (typeof expectOffset === 'number') {
        assert.strictEqual(offset, expectOffset, `Offset for ${name} was ${offset}, expected ${expectOffset}`);
      }
    });
  }
}); 