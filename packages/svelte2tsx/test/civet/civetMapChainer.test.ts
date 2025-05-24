import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import MagicString from 'magic-string';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { chainSourceMaps, EncodedSourceMap } from '../../src/svelte2tsx/utils/civetMapChainer';

describe('chainSourceMaps on real Civet fixtures', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));
  files.forEach((file) => {

    it(`should correctly chain mappings for ${file}`, () => {
      const fullPath = path.join(fixturesDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const result = preprocessCivet(content, file);
      console.log(`[chainSourceMaps] Preprocessed TSX for ${file}:\n${result.code}`);
      const blockInfo = result.instance || result.module;
      assert(blockInfo, 'Expected a Civet block in fixture');
      const { map: civetMap, tsStartInSvelteWithTs, tsEndInSvelteWithTs } = blockInfo!;
      const str = new MagicString(result.code);
      const baseMap = str.generateMap({ hires: true, source: file });
      const chainedMap = chainSourceMaps(
        baseMap as EncodedSourceMap,
        civetMap,
        tsStartInSvelteWithTs,
        tsEndInSvelteWithTs
      );
      // Basic sanity checks on the chained map
      assert.strictEqual(chainedMap.version, 3, 'Expected V3 map');
      assert.deepStrictEqual(chainedMap.sources, [file], 'Sources should match fixture file');
      assert.strictEqual(typeof chainedMap.mappings, 'string');
      // Ensure there is at least one mapping segment
      const { decode } = require('@jridgewell/sourcemap-codec');
      const decoded = decode(chainedMap.mappings);
      const segmentCount = decoded.reduce((sum: number, line: any[]) => sum + line.length, 0);
      assert.ok(segmentCount > 0, 'Expected mapping segments after chaining');
      
      // Verify each mapping segment accurately maps back to the original position
      const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
      const tracer = new TraceMap(chainedMap);
      decoded.forEach((lineSegments, genLineIndex) => {
        lineSegments.forEach((segment) => {
          const [genCol, , origLine0, origCol0] = segment;
          const origPos = originalPositionFor(tracer, { line: genLineIndex + 1, column: genCol });
          assert.strictEqual(origPos.source, file, `Source mismatch at gen L${genLineIndex+1}C${genCol}`);
          assert.strictEqual(origPos.line, origLine0 + 1, `Original line mismatch for gen L${genLineIndex+1}C${genCol}`);
          assert.strictEqual(origPos.column, origCol0, `Original column mismatch for gen L${genLineIndex+1}C${genCol}`);
        });
      });

      // Token-based mapping accuracy tests per fixture
      const codeStr = result.code;
      // Define expected tokens per fixture
      const fixtureTokens: Record<string, string[]> = {
        'scenario.svelte': ['reactiveValue', 'anotherVar', 'console'],
        '2scripts.svelte': ['greet', 'name', 'reactiveValue', 'message', 'console'],
        'func.svelte': ['funcForTest'],
        'complicated.svelte': ['generateRandomNumber', 'age', 'console', 'fruits', 'sum', 'nestedFunction', 'nestedVar']
      };
      const tokens = fixtureTokens[file] || [];
      tokens.forEach((token) => {
        const idx = codeStr.indexOf(token);
        assert.notStrictEqual(idx, -1, `Token '${token}' not found in TSX output for ${file}`);
        // Calculate generated line/column
        const pre = codeStr.slice(0, idx);
        const preLines = pre.split('\n');
        const genLine = preLines.length;
        const genCol = preLines[preLines.length - 1].length;
        const { originalPositionFor } = require('@jridgewell/trace-mapping');
        const tracer = new (require('@jridgewell/trace-mapping').TraceMap)(chainedMap);
        const orig = originalPositionFor(tracer, { line: genLine, column: genCol });
        assert.strictEqual(orig.source, file, `Source mismatch for token '${token}' in ${file}`);
        assert.ok(orig.line >= 1, `Invalid original line for token '${token}' in ${file}: ${orig.line}`);
        assert.ok(orig.column >= 0, `Invalid original column for token '${token}' in ${file}: ${orig.column}`);
      });
    });
  });
}); 