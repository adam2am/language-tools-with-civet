// #civet POC: Civet preprocess block mapping proof-of-concept test
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { decode } from '@jridgewell/sourcemap-codec';

const POC_DEBUG = false;  

describe('#POC #current: Civet preprocess block mapping POC = 1st part of index.ts', () => {
  // Phase 1: Setup fixture directory and select the target fixture (proving we can target specific Svelte files)
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  // Focus on a single fixture
  const focusFixture = '2scripts.svelte';
  const files = [focusFixture];
  for (const file of files) {
    it(`POC block mapping for ${file}`, () => {
      // Phase 2: Load the Svelte fixture content from disk (verify test harness reads input)
      const content = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
      // Phase 3: Invoke Civet preprocessor to compile TS snippet and capture its source map (core mapping operation)
      const result = preprocessCivet(content, file);
      // Phase 4: Identify module and instance script blocks that were preprocessed (ensuring both contexts are handled)
      const blocks = [
        { data: result.module, name: 'module' },
        { data: result.instance, name: 'instance' }
      ].filter(({ data }) => data) as Array<{ data: any; name: string }>;

      for (const { data: block, name } of blocks) {
        // Phase 5: Decode the source map mappings and create a tracer for synchronous lookups (validate tracer integration)
        const { map, originalContentStartLine } = block;
        const decoded = decode(map.mappings);
        const tracer = new TraceMap(map as any);
        // Phase 6: For each generated mapping segment, compute the original source position and assert correctness (round-trip proof)
        decoded.forEach((lineSegments, genIndex) => {
          lineSegments.forEach((segment) => {
            const [genCol, , origLine0, origCol0] = segment as [number, number, number, number];
            const genPos = { line: genIndex + 1, column: genCol };
            const pos = originalPositionFor(tracer, genPos);
            const expectedLine = origLine0 + 1;
            if (POC_DEBUG) {
              console.log(
                `[${name}] genPos (L${genIndex + 1},C${genCol}), snippet pos (L${origLine0},C${origCol0}) -> mapped to (L${pos.line},C${pos.column}), expected line ${expectedLine}`
              );
            }
            assert.strictEqual(pos.source, file, `[${name}] Source mismatch in ${file}`);
            assert.strictEqual(pos.line, expectedLine, `[${name}] Line mismatch in ${file}`);
            assert.strictEqual(typeof pos.column, 'number', `[${name}] Invalid column in ${file}`);
          });
        });
      }
    });
  }
});