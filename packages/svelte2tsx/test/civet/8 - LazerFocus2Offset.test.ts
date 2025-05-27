/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

describe('8 #current - LazerFocus2Offset: template mapping offset analysis', () => {
  // Each case tests mapping for a specific invocation token; expectOffset optional
  const fixtures: Array<{ name: string; token: string; expectOffset?: number }> = [
    { name: 'LazerFocus2-issue.svelte', token: 'funcForTest', expectOffset: 0 },
    { name: 'LazerFocus2-allgood.svelte', token: 'funcForTest', expectOffset: 0 },
    { name: 'LazerFocus2-issue2.svelte', token: 'funcForTest', expectOffset: 0 },
    { name: 'LazerFocus2-issue3.svelte', token: 'foo2', expectOffset: 0 },
    { name: 'LazerFocus2-issue3-nooffset.svelte', token: 'foo2', expectOffset: 0 },
    // Edge-case fixtures: just compute and log offsets
    { name: 'complicated.svelte', token: 'sum' },
    { name: 'conditional.svelte', token: 'welcomeMessage' },
    { name: 'loop.svelte', token: 'fruits[0]' },
    { name: 'nestedArrow.svelte', token: 'value' }
  ];

  for (const { name, token, expectOffset } of fixtures) {
    it(`${name}: template usage '${token}' mapping offset should be ${expectOffset}`, () => {
      const fixturesDir = path.resolve(__dirname, 'fixtures', 'lazerfocusOffset');
      const sveltePath = path.join(fixturesDir, name);
      const content = fs.readFileSync(sveltePath, 'utf-8');
      const { code: tsxCode, map } = svelte2tsx(content, { filename: name });
      // Debug: print full TSX output for loop.svelte to inspect mapping
      if (name === 'loop.svelte') {
        console.log(`TSX output for ${name}:\n${tsxCode}`);
      }
      const tracer = new TraceMap(map as any);
      const decoded = decode((map as any).mappings);

      // Find generated position of token in template (skip script occurrence)
      const firstIdx = tsxCode.indexOf(token);
      assert.ok(firstIdx !== -1, `Token '${token}' not found in TSX output for ${name}`);
      // Find second occurrence; if none, fallback to first (single occurrence case)
      let idx = tsxCode.indexOf(token, firstIdx + token.length);
      if (idx === -1) {
        // only one occurrence: use first occurrence as template
        idx = firstIdx;
      }
      assert.ok(idx !== -1, `Template occurrence of '${token}' not found in TSX output for ${name}`);
      const pre = tsxCode.slice(0, idx);
      const genLine = pre.split('\n').length;
      const genCol = pre.slice(pre.lastIndexOf('\n') + 1).length;

      const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
      assert.strictEqual(pos.source, name, 'Source should be the Svelte file');

      const originalLines = content.split('\n');
      // Compute original usage line: click attributes for fixed fixtures, any token in template for edge cases
      let usageLine0: number;
      if (typeof expectOffset === 'number') {
        usageLine0 = originalLines.findIndex(line => line.includes(`onclick={${token}}`));
        assert.ok(usageLine0 >= 0, `onclick={${token}} not found in original Svelte for ${name}`);
      } else {
        // search after the script end marker
        const scriptEnd = originalLines.findIndex(line => line.includes('</script>'));
        usageLine0 = originalLines.findIndex((line, idx) => idx > scriptEnd && line.includes(token));
        assert.ok(usageLine0 >= 0, `template token '${token}' not found in original Svelte for ${name}`);
      }
      const usageLine1 = usageLine0 + 1;

      const offset = pos.line - usageLine1;
      // Log detailed flow for non-zero offsets
      if (offset !== 0) {
        console.log(`[${name}] OFFSET FLOW: token='${token}', genLine=${genLine}, usageLine1=${usageLine1}, mappedLine=${pos.line}, offset=${offset}`);
        console.log(`[${name}] decoded segments at genLine:`, JSON.stringify(decoded[genLine - 1], null, 2));
      }
      console.log(`DEBUG [${name}] genLine=${genLine}, usageLine1=${usageLine1}, mappedLine=${pos.line}, offset=${offset}`);
      if (typeof expectOffset === 'number') {
        assert.strictEqual(offset, expectOffset, `Unexpected offset for ${name}: got ${offset}, expected ${expectOffset}`);
      } else {
        console.log(`[${name}] computed offset: ${offset}`);
        assert.ok(Number.isInteger(offset), `Offset for ${name} should be an integer, got ${offset}`);
      }
    });
  }
}); 