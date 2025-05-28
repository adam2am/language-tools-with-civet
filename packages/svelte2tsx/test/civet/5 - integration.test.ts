import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

const integrationDebug = true; // master-switch for all debug logs

const logOptions = {
  fixtureStart: true,
  tsxPreview: true,
  decodedSummary: true,
  mapMissmatchDetails: true,
};

describe('5 - integration: svelte2tsx + Civet end-to-end #current', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));

  fixtures.forEach((f) => {
    it(`5 - integration: should map key tokens correctly for ${f}`, async () => {
      // debug: mark start of test for this fixture
      if (integrationDebug && logOptions.fixtureStart) {
        console.log(`\n--- Running end-to-end mapping for fixture: ${f} ---`);
      }
      const input = fs.readFileSync(path.join(fixturesDir, f), 'utf-8');
      // run the full pipeline
      const { code: tsx, map } = svelte2tsx(input, { filename: f });

      // debug: show a preview of generated TSX and raw map info
      if (integrationDebug && logOptions.tsxPreview) {
        console.log('TSX output (first 10 lines):');
        console.log(tsx.split('\n').slice(0, 10).join('\n'));
        console.log('Map version:', map.version, 'sources:', map.sources);
        console.log('Raw mappings string:', map.mappings);
      }

      // basic sanity
      assert.equal(map.version, 3);
      assert.deepEqual(map.sources, [f]);

      // decode and count segments
      const decoded = decode(map.mappings);
      const segCount = decoded.reduce((sum, line) => sum + line.length, 0);
      // debug: show summary of decoded segments
      if (integrationDebug && logOptions.decodedSummary) {
        // Using console.error for these as they were previously unconditional
        console.error('(Debug) Decoded mapping lines 0-3:', JSON.stringify(decoded.slice(0, 3), null, 2));
        console.error('(Debug) Total decoded segment count:', segCount);
        console.log('Total decoded segments:', segCount);
        console.log('First 3 decoded mapping lines:', JSON.stringify(decoded.slice(0, 3), null, 2));
      }
      // assert that we actually have mapping segments
      assert.ok(segCount > 0, 'expected some mappings');

      // dynamically validate every decoded mapping segment
      const tracer = new TraceMap(map as any);
      decoded.forEach((lineSegments, genLineIdx) => {
        lineSegments.forEach((segment) => {
          const [genCol, srcIdx, origLine0, origCol0] = segment as [number, number, number, number];
          const pos = originalPositionFor(tracer, { line: genLineIdx + 1, column: genCol });
          // debug: log detailed mismatch if any
          const expectedLine = origLine0 + 1;
          if (integrationDebug && logOptions.mapMissmatchDetails) {
            if (pos.source !== f || pos.line !== expectedLine || pos.column !== origCol0) {
              console.error(`\n  ↳ Mapping mismatch at gen L${genLineIdx+1} C${genCol}:`, {
                source: pos.source,
                line: pos.line,
                column: pos.column,
                expected: { source: f, line: expectedLine, column: origCol0 },
                segment
              });
            }
          }
          // Always assert correct mapping for every segment
          assert.strictEqual(
            pos.source,
            f,
            `source mismatch at generated line ${genLineIdx + 1}, column ${genCol}`
          );
          assert.strictEqual(
            pos.line,
            origLine0 + 1,
            `line mismatch at generated line ${genLineIdx + 1}, column ${genCol}`
          );
          assert.strictEqual(
            pos.column,
            origCol0,
            `column mismatch at generated line ${genLineIdx + 1}, column ${genCol}`
          );
        });
      });
    });
  });
});