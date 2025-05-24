import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

describe('svelte2tsx + Civet end-to-end', () => {
  const fixturesDir = path.resolve(__dirname, 'civet', 'fixtures');
  const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));

  fixtures.forEach((f) => {
    it(`should map key tokens correctly for ${f}`, async () => {
      const input = fs.readFileSync(path.join(fixturesDir, f), 'utf-8');
      // run the full pipeline
      const { code: tsx, map } = svelte2tsx(input, { filename: f });

      // basic sanity
      assert.ok(tsx.includes('<script lang="ts">'));
      assert.equal(map.version, 3);
      assert.deepEqual(map.sources, [f]);

      // decode and count segments
      const decoded = decode(map.mappings);
      const segCount = decoded.reduce((sum, line) => sum + line.length, 0);
      assert.ok(segCount > 0, 'expected some mappings');

      // dynamically validate every decoded mapping segment
      const tracer = new TraceMap(map as any);
      decoded.forEach((lineSegments, genLineIdx) => {
        lineSegments.forEach((segment) => {
          const [genCol, srcIdx, origLine0, origCol0] = segment as [number, number, number, number];
          const pos = originalPositionFor(tracer, { line: genLineIdx + 1, column: genCol });
          assert.strictEqual(pos.source, f, `source mismatch at gen L${genLineIdx + 1}C${genCol}`);
          assert.strictEqual(pos.line, origLine0 + 1, `line mismatch at gen L${genLineIdx + 1}C${genCol}`);
          assert.strictEqual(pos.column, origCol0, `column mismatch at gen L${genLineIdx + 1}C${genCol}`);
        });
      });
    });
  });
});