import { strict as assert } from 'assert';
import { SourceMapConsumer } from 'source-map';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import type { CivetLinesSourceMap, StandardRawSourceMap, CivetOutputMap } from '../../src/svelte2tsx/utils/civetTypes';

const compileTestDebug = false;

describe('1 - civet: generating source map raw lines #happy #current', () => {
  const filename = 'scenario.civet'; // Match the scenario filename context

  it('handles state and propFunc declarations (dedented)', () => {
    const civetCode = 'value := $state(1)\npropFunc := (b: number) =>\n  number .= value * b;\n\npropFunc2 := (b: number) =>\n  number .= value * b\n';
    const result = compileCivet(civetCode, filename);
    if (compileTestDebug) {
      console.log('\n--- Civet Code Test (Dedented) ---');
      console.log('Compiled TypeScript:\n', result.code);
      console.log('Output Map:', JSON.stringify(result.rawMap, null, 2));
    }
    assert.match(result.code, /const value = \$state\(1\)/);
    assert.match(result.code, /const propFunc = \(b\: number\) =>/);
    assert.match(result.code, /number = value \* b;/);

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