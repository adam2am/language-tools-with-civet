import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { svelte2tsx } from '../../src/svelte2tsx';
import type { EncodedSourceMap } from '../../src/svelte2tsx/utils/civetMapChainer';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const compileTestDebug = false;

describe('4 - civet: #happy chainSourceMaps on real Civet fixtures (via svelte2tsx)', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));
  files.forEach((file) => {

    it(`should correctly chain mappings for ${file} using svelte2tsx`, () => {
      const fullPath = path.join(fixturesDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');

      const svelte2tsxResult = svelte2tsx(content, { filename: file });
      const finalTSXCode = svelte2tsxResult.code;
      const chainedMap = svelte2tsxResult.map as EncodedSourceMap;

      assert.ok(chainedMap, `Expected a source map from svelte2tsx for ${file}`);
      assert.strictEqual(chainedMap.version, 3, 'Expected V3 map');
      assert.deepStrictEqual(chainedMap.sources, [file], 'Sources should match fixture file');
      assert.strictEqual(typeof chainedMap.mappings, 'string');
      
      const decodedMappings = decode(chainedMap.mappings);
      const segmentCount = decodedMappings.reduce((sum: number, line: any[]) => sum + line.length, 0);
      assert.ok(segmentCount > 0, 'Expected mapping segments after chaining');
      
      // Instantiate tracer with only the chained map (map.sources has the correct file name)
      const tracer = new (TraceMap as any)(chainedMap as any);
      decodedMappings.forEach((lineSegments, genLineIndex) => {
        lineSegments.forEach((segment) => {
          const [genCol, , origLine0, origCol0] = segment;
          const origPos = originalPositionFor(tracer, { line: genLineIndex + 1, column: genCol });
          assert.strictEqual(origPos.source, file, `Source mismatch at gen L${genLineIndex+1}C${genCol}`);
          assert.strictEqual(origPos.line, origLine0 + 1, `Original line mismatch for gen L${genLineIndex+1}C${genCol}`);
          assert.strictEqual(origPos.column, origCol0, `Original column mismatch for gen L${genLineIndex+1}C${genCol}`);
        });
      });

      const codeStr = finalTSXCode;
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
        const pre = codeStr.slice(0, idx);
        const preLines = pre.split('\n');
        const genLine = preLines.length;
        const genCol = preLines[preLines.length - 1].length;
        const orig = originalPositionFor(tracer, { line: genLine, column: genCol });
        assert.strictEqual(orig.source, file, `Source mismatch for token '${token}' in ${file}`);
        assert.ok(orig.line >= 1, `Invalid original line for token '${token}' in ${file}: ${orig.line}`);
        assert.ok(orig.column >= 0, `Invalid original column for token '${token}' in ${file}: ${orig.column}`);
      });
    });
  });
}); 