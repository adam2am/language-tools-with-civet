const compileTestDebug = true;

import { strict as assert } from 'assert';
import { SourceMapConsumer } from 'source-map';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import type { CivetLinesSourceMap, StandardRawSourceMap, CivetOutputMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('1 - civet: generating source map raw lines #happy #current', () => {
  const filename = 'scenario.civet'; // Match the scenario filename context

  it('raw map for snippet with index var i', () => {
    const civetCode = 'for fruit, i of fruits\n  console.log `Fruit ${i + 1}: ${fruit}`';
    const result = compileCivet(civetCode, filename);
    if (compileTestDebug) {
      console.log('\n--- Civet Raw Map Test: var i ---');
      console.log('Compiled TS code:\n' + result.code);
      if (result.rawMap && 'lines' in result.rawMap) {
        console.log('Raw map lines:');
        (result.rawMap as any).lines.forEach((segs: number[][], idx: number) => {
          console.log(`Line ${idx + 1}:` + segs.map(s => `[${s.join(',')}]`).join(' '));
        });
      }
    }
    const map1 = result.rawMap as CivetLinesSourceMap | undefined;
    assert.ok(map1 && Array.isArray(map1.lines), 'rawMap.lines should be defined for var i snippet');
  });

  it('raw map for snippet with index var index', () => {
    const civetCode = 'for fruit, index of fruits\n  console.log `Fruit ${index + 1}: ${fruit}`';
    const result = compileCivet(civetCode, filename);
    if (compileTestDebug) {
      console.log('\n--- Civet Raw Map Test: var index ---');
      console.log('Compiled TS code:\n' + result.code);
      if (result.rawMap && 'lines' in result.rawMap) {
        console.log('Raw map lines:');
        (result.rawMap as any).lines.forEach((segs: number[][], idx: number) => {
          console.log(`Line ${idx + 1}:` + segs.map(s => `[${s.join(',')}]`).join(' '));
        });
      }
    }
    const map2 = result.rawMap as CivetLinesSourceMap | undefined;
    assert.ok(map2 && Array.isArray(map2.lines), 'rawMap.lines should be defined for var index snippet');
  });
}); 