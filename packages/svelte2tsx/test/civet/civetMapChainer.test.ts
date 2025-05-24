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
    });
  });
}); 