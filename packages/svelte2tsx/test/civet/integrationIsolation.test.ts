import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { decode } from '@jridgewell/sourcemap-codec';

const integrationIsolationDebug = true; // Enable detailed logging
// Focus on a single fixture if specified via environment variable
const focusFixture = '2scripts.svelte';

// This test mirrors exactly what index.ts does for Civet blocks, but isolates the mapping logic.
describe('current integrationIsolation: Civet preprocessing mapping only', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  let files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));
  if (focusFixture) {
    if (!files.includes(focusFixture)) throw new Error(`Focus fixture ${focusFixture} not found`);
    files = [focusFixture];
  }

  for (const file of files) {
    it(`should map tokens in module and instance blocks for ${file}`, () => {
      const content = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
      const result = preprocessCivet(content, file);
      const blocks = [
        { data: result.module, name: 'module' },
        { data: result.instance, name: 'instance' }
      ].filter(({ data }) => data) as Array<{ data: any; name: string }>;

      for (const { data: block, name } of blocks) {
        const { map, originalContentStartLine } = block;
        // Decode mapping segments and use TraceMap for synchronous originalPositionFor
        const decoded = decode(map.mappings);
        const tracer = new TraceMap(map as any);
        if (integrationIsolationDebug) console.log(`\n[integrationIsolation.test.ts] File: ${file}, Block: ${name}, originalContentStartLine: ${originalContentStartLine}`);
        decoded.forEach((lineSegments, genLineIndex_0based) => {
          lineSegments.forEach((segment) => {
            const [genCol_0based, , origLine_0based_in_snippet, origCol_0based_in_snippet] = segment as [number, number, number, number, number?];
            const generatedLine_1based = genLineIndex_0based + 1;
            if (integrationIsolationDebug) {
              console.log(`  [integrationIsolation] ---- Segment ----`);
              console.log(`    Gen L:${generatedLine_1based}, Gen C:${genCol_0based}`);
              console.log(`    Raw Segment: [genCol:${genCol_0based}, srcIdx:${segment[1]}, origLine0_snippet:${origLine_0based_in_snippet}, origCol0_snippet:${origCol_0based_in_snippet}${segment.length > 4 ? ', nameIdx:' + segment[4] : ''}]`);
              console.log(`    originalContentStartLine (1-based): ${originalContentStartLine}`);
            }
            const pos = originalPositionFor(tracer, { line: generatedLine_1based, column: genCol_0based });
            const expectedLine = originalContentStartLine + origLine_0based_in_snippet;
            if (integrationIsolationDebug) {
              console.log(`    originalPositionFor() output:`, pos);
              console.log(`    Expected Svelte Line: originalContentStartLine (${originalContentStartLine}) + origLine_0based_in_snippet (${origLine_0based_in_snippet}) = ${expectedLine}`);
              console.log(`    Actual Svelte Line: ${pos.line}`);
              if (pos.line !== expectedLine) console.error(`    !!!! MISMATCH Expected:${expectedLine}, Actual:${pos.line}`);
            }
            assert.strictEqual(pos.source, file, `[${name}] Source mismatch for ${file} at L${generatedLine_1based}C${genCol_0based}`);
            assert.strictEqual(pos.line, expectedLine, `[${name}] Line mismatch for ${file} at L${generatedLine_1based}C${genCol_0based}. Expected map line ${expectedLine}, got ${pos.line}`);
            assert.ok(typeof pos.column === 'number' && pos.column >= 0, `[${name}] Invalid column for ${file} at L${generatedLine_1based}C${genCol_0based}. Got ${pos.column}`);
          });
        });
      }
    });
  }
}); 