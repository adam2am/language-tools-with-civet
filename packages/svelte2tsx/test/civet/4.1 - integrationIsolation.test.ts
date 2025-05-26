import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { originalPositionFor, TraceMap, traceSegment } from '@jridgewell/trace-mapping';
import { CivetProcessedResult, preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';

const integrationIsolationDebug = process.env.CIVET_DEBUG === 'true' || false;
// const focusFixture = '2scripts.svelte'; 
const focusFixture = undefined;

// #current is in the describe name so it runs with test-current
describe('#current integrationIsolation: Civet preprocessing mapping only', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  let allFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));

  let filesToTest = allFiles;
  if (focusFixture) {
    if (!allFiles.includes(focusFixture)) {
      console.warn(`[integrationIsolation.test.ts] Focus fixture ${focusFixture} not found in ${fixturesDir}, running all fixtures.`);
    } else {
      filesToTest = [focusFixture];
      console.log(`[integrationIsolation.test.ts] Focusing on ${focusFixture}`);
    }
  }
  if (filesToTest.length === 0) {
    console.warn("[integrationIsolation.test.ts] No Svelte files found to test.");
    return;
  }

  filesToTest.forEach((file) => {
    it(`should map tokens in module and instance blocks for ${file}`, () => {
      const filePath = path.join(fixturesDir, file);
      const svelteContent = fs.readFileSync(filePath, 'utf-8');

      const preprocessed = preprocessCivet(svelteContent, filePath, integrationIsolationDebug ? {all:true} : undefined);
      if (!preprocessed) {
        assert.fail("Civet preprocessing failed or returned no blocks.");
        return;
      }

      const blocks: { name: string; data: CivetProcessedResult['module'] | CivetProcessedResult['instance'] }[] = [];
      if (preprocessed.module) blocks.push({ name: 'module', data: preprocessed.module });
      if (preprocessed.instance) blocks.push({ name: 'instance', data: preprocessed.instance });

      assert.ok(blocks.length > 0, "No Civet script blocks found or processed.");

      for (const { data: block, name } of blocks) {
        const { map, originalContentStartLine: block_originalContentStartLine_1based, commonIndentRemoved } = block!;
        const decodedByLibrary = decode(map.mappings);
        const tracer = new TraceMap(map as any);
        if (integrationIsolationDebug) console.log(`\n[integrationIsolation.test.ts] File: ${file}, Block: ${name}, originalContentStartLine (1-based for dedented snippet): ${block_originalContentStartLine_1based}, commonIndent: '${commonIndentRemoved}'`);
        
        decodedByLibrary.forEach((lineSegments, genLineIndex_0based) => {
          lineSegments.forEach((segmentFromDecode) => {
            const [
              genCol_0based, 
              sourceIndex, 
              origLine0_Svelte_from_decode, 
              origCol0_Svelte_ABS_from_decode 
            ] = segmentFromDecode as [number, number, number, number, number?];
            
            const generatedLine_1based = genLineIndex_0based + 1;

            const tracedSegmentViaAPI = traceSegment(tracer, genLineIndex_0based, genCol_0based);

            if (integrationIsolationDebug) {
              console.log(`  [integrationIsolation] ---- Segment ----`);
              console.log(`    Gen L:${generatedLine_1based}, Gen C:${genCol_0based}`);
              console.log(`    Decoded Segment (from map string): [genCol:${genCol_0based}, srcIdx:${sourceIndex}, origLine0_Svelte:${origLine0_Svelte_from_decode}, origCol0_Svelte_ABS:${origCol0_Svelte_ABS_from_decode}]`);
              if (tracedSegmentViaAPI) {
                console.log(`    Traced Segment (via API):          [genCol:${tracedSegmentViaAPI[0]}, srcIdx:${tracedSegmentViaAPI[1]}, origLine0_Svelte:${tracedSegmentViaAPI[2]}, origCol0_Svelte_ABS:${tracedSegmentViaAPI[3]}]`);
              } else {
                console.log(`    Traced Segment (via API):          null (no mapping found by traceSegment for GenL${generatedLine_1based}C${genCol_0based})`);
              }
            }

            assert.ok(tracedSegmentViaAPI, `[${name}] traceSegment found no mapping for ${file} at GenL${generatedLine_1based}C${genCol_0based}`);
            if (!tracedSegmentViaAPI) return;

            const origLine0_Svelte_from_traceSegment = tracedSegmentViaAPI[2];
            const origCol0_Svelte_ABS_from_traceSegment = tracedSegmentViaAPI[3];

            const expectedSvelteLine_1based = origLine0_Svelte_from_traceSegment + 1;

            assert.strictEqual(tracedSegmentViaAPI[0], genCol_0based, `[${name}] Generated column mismatch between decode and traceSegment for ${file} at GenL${generatedLine_1based}C${genCol_0based}`);
            assert.strictEqual(origLine0_Svelte_from_traceSegment, origLine0_Svelte_from_decode, `[${name}] Original line mismatch between decode and traceSegment for ${file} at GenL${generatedLine_1based}C${genCol_0based}`);
            assert.strictEqual(origCol0_Svelte_ABS_from_traceSegment, origCol0_Svelte_ABS_from_decode, `[${name}] Original column mismatch between decode and traceSegment for ${file} at GenL${generatedLine_1based}C${genCol_0based}`);

            const pos_opf = originalPositionFor(tracer, { line: generatedLine_1based, column: genCol_0based });

            if (integrationIsolationDebug) {
              console.log(`    originalPositionFor() output: source='${pos_opf.source}', line=${pos_opf.line}, column=${pos_opf.column}, name=${pos_opf.name}`);
              console.log(`    Expected Svelte Line (1-based, from traceSegment): ${expectedSvelteLine_1based}`);
              console.log(`    Actual   Svelte Line (1-based, from OPF): ${pos_opf.line}`);
              console.log(`    Expected Svelte Col (0-based, ABSOLUTE, from traceSegment): ${origCol0_Svelte_ABS_from_traceSegment}`);
              console.log(`    Actual   Svelte Col (0-based, from OPF): ${pos_opf.column}`);
            }

            assert.strictEqual(pos_opf.source, file, `[${name}] OPF Source mismatch for ${file} at GenL${generatedLine_1based}C${genCol_0based}.`);
            assert.strictEqual(pos_opf.line, expectedSvelteLine_1based, `[${name}] OPF Line mismatch for ${file} at GenL${generatedLine_1based}C${genCol_0based}. Expected ${expectedSvelteLine_1based} (from traceSegment), got ${pos_opf.line}.`);
            assert.strictEqual(pos_opf.column, origCol0_Svelte_ABS_from_traceSegment, `[${name}] OPF Column mismatch for ${file} at GenL${generatedLine_1based}C${genCol_0based}. Expected ABSOLUTE Svelte column ${origCol0_Svelte_ABS_from_traceSegment} (from traceSegment), got OPF column ${pos_opf.column}.`);

          });
        });
      }
    });
  });
}); 