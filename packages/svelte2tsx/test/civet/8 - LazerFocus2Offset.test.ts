/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

describe('8 - LazerFocus2Offset: template mapping offset analysis #current', () => {
  const fixtures: Array<{ name: string; expectOffset: number }> = [
    { name: 'LazerFocus2-issue.svelte', expectOffset: -1 },
    { name: 'LazerFocus2-allgood.svelte', expectOffset: 0 },
    { name: 'LazerFocus2-issue2.svelte', expectOffset: 1 }
  ];

  const usageToken = 'funcForTest';

  for (const { name, expectOffset } of fixtures) {
    it(`${name}: template usage '${usageToken}' mapping offset should be ${expectOffset}`, () => {
      const fixturesDir = path.resolve(__dirname, 'fixtures');
      const sveltePath = path.join(fixturesDir, name);
      const content = fs.readFileSync(sveltePath, 'utf-8');
      const { code: tsxCode, map } = svelte2tsx(content, { filename: name });
      const tracer = new TraceMap(map as any);
      const decoded = decode((map as any).mappings);

      // Find generated position of usageToken in template (skip script occurrence)
      const firstIdx = tsxCode.indexOf(usageToken);
      assert.ok(firstIdx !== -1, `Token '${usageToken}' not found in TSX output for ${name}`);
      const idx = tsxCode.indexOf(usageToken, firstIdx + usageToken.length);
      assert.ok(idx !== -1, `Template occurrence of '${usageToken}' not found in TSX output for ${name}`);
      const pre = tsxCode.slice(0, idx);
      const genLine = pre.split('\n').length;
      const genCol = pre.slice(pre.lastIndexOf('\n') + 1).length;

      const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
      assert.strictEqual(pos.source, name, 'Source should be the Svelte file');

      // Compute original usage line from onclick attribute in template
      const originalLines = content.split('\n');
      const usageLine0 = originalLines.findIndex(line => line.includes(`onclick={${usageToken}}`));
      assert.ok(usageLine0 >= 0, `onclick={${usageToken}} not found in original Svelte for ${name}`);
      const usageLine1 = usageLine0 + 1;

      const offset = pos.line - usageLine1;
      // Log detailed flow for non-zero offsets
      if (offset !== 0) {
        console.log(`[${name}] OFFSET FLOW: genLine=${genLine}, usageLine1=${usageLine1}, mappedLine=${pos.line}, offset=${offset}`);
        console.log(`[${name}] decoded segments at genLine:`, JSON.stringify(decoded[genLine - 1], null, 2));
      }
      console.log(`DEBUG [${name}] genLine=${genLine}, usageLine1=${usageLine1}, mappedLine=${pos.line}, offset=${offset}`);
      assert.strictEqual(offset, expectOffset, `Unexpected offset for ${name}: got ${offset}, expected ${expectOffset}`);
    });
  }
}); 