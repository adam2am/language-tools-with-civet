const compileTestDebug = true;

import { strict as assert } from 'assert';
import { SourceMapConsumer } from 'source-map';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import type { CivetLinesSourceMap, StandardRawSourceMap, CivetOutputMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('1 - civet: generating source map raw lines #happy #current', () => {
  const filename = 'scenario.civet'; // Match the scenario filename context

  it('handles state and propFunc declarations (dedented)', () => {
    const civetCode = '// Loop example\nfor fruit, index of fruits\n  console.log `Fruit ${index + 1}: ${fruit}`\n\nfor fruit, index in fruits\n  console.log `Fruit ${index + 1}: ${fruit}`';
    const result = compileCivet(civetCode, filename);
    if (compileTestDebug) {
      console.log('\n--- Civet Code Test (Dedented) ---');
      console.log('Compiled TypeScript:\n', result.code);
      // Print raw Civet mapping lines per generated TS line
      if (result.rawMap && 'lines' in result.rawMap) {
        console.log('Civet raw lines per TS line:');
        (result.rawMap as any).lines.forEach((lineSegs: number[][], idx: number) => {
          const segStr = lineSegs.map((seg: number[]) => `[${seg.join(',')}]`).join(' ');
          console.log(`Line ${idx + 1}: ${segStr}`);
        });
      } else {
        console.log('Output Map:', JSON.stringify(result.rawMap, null, 2));
      }
    }
    assert.ok(result.code.includes('let i = 0;for (const fruit of fruits) {const index = i++;'), 'Civet output for "for...of" with index has changed');
    assert.ok(result.code.includes('for (const fruit in fruits) {const index = fruits[fruit];'), 'Civet output for "for...in" with index has changed');
    assert.ok(result.code.match(/console\\.log\(`Fruit \$\{index \+ 1\}: \$\{fruit\}`\)/g)?.length === 2, 'Expected two console.log calls with template literals');

    const map = result.rawMap as CivetLinesSourceMap | undefined;
    assert.ok(map, 'rawMap should be defined');
    if (map) {
      assert.ok(Array.isArray(map.lines), 'map should have a lines array');
      console.log('Civet map lines per TS line:');
      map.lines.forEach((lineSegs, idx) => {
        const segStr = lineSegs.map(seg => `[${seg.join(',')}]`).join(' ');
        console.log(`Line ${idx + 1}: ${segStr}`);
      });
    }
  });
}); 