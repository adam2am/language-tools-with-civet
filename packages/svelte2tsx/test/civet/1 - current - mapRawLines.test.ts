const compileTestDebug = true;

import { strict as assert } from 'assert';
import { SourceMapConsumer } from 'source-map';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import type { CivetLinesSourceMap, StandardRawSourceMap, CivetOutputMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('1 - civet: generating source map raw lines #happy #current', () => {
  const filename = 'scenario.civet'; // Match the scenario filename context

  it('handles state and propFunc declarations (dedented)', () => {
    const civetCode = 'value .= $state(1)\nprops := (ab: number, b: number) =>\n\tvalue = ab * b\n\npropsProbl := (ab: number, bc: number) =>\n\tvalue = ab * bc\n\nprops2 := (ab: number, bc: number) =>\n\tvalue = ab * bc;';
    const result = compileCivet(civetCode, filename);
    if (compileTestDebug) {
      console.log('\n--- Civet Code Test (Dedented) ---');
      console.log('Compiled TypeScript:\n', result.code);
      console.log('Output Map:', JSON.stringify(result.rawMap, null, 2));
    }
    assert.match(result.code, /let value = \$state\(1\)/);
    assert.match(result.code, /const props = \(ab: number, b: number\) =>/);
    assert.match(result.code, /return value = ab \* b/);
    assert.match(result.code, /const propsProbl = \(ab: number, bc: number\) =>/);
    assert.match(result.code, /const props2 = \(ab: number, bc: number\) =>/);
    assert.ok(result.code.includes('value = ab * bc;'), 'Should contain assignment with semicolon for props2');
    const propsProblBodyMatch = result.code.match(/const propsProbl = \(([^)]*)\) => \{([\s\S]*?)\}/);
    console.log('[DEBUG] propsProblBodyMatch:', propsProblBodyMatch);
    assert.ok(propsProblBodyMatch, 'REGEXP_FAILED: propsProblBodyMatch was null. Regex did not match.');
    assert.ok(propsProblBodyMatch[2], 'CAPTURE_GROUP_2_EMPTY: propsProblBodyMatch[2] (the body) was falsey (empty or undefined). Actual value: ' + propsProblBodyMatch[2]);
    assert.ok(propsProblBodyMatch[2].includes('return value = ab * bc') && !propsProblBodyMatch[2].includes('return value = ab * bc;'), 'propsProbl assignment should be part of a return, without its own semicolon. Body: ' + (propsProblBodyMatch ? propsProblBodyMatch[2] : 'null'));

    const props2BodyMatch = result.code.match(/const props2 = \(([^)]*)\) => \{([\s\S]*?)\}/);
    console.log('[DEBUG] props2BodyMatch:', props2BodyMatch);
    assert.ok(props2BodyMatch, 'REGEXP_FAILED: props2BodyMatch was null. Regex did not match.');
    assert.ok(props2BodyMatch[2], 'CAPTURE_GROUP_2_EMPTY: props2BodyMatch[2] (the body) was falsey (empty or undefined). Actual value: ' + props2BodyMatch[2]);
    assert.ok(props2BodyMatch[2].includes('value = ab * bc;') && !props2BodyMatch[2].includes('return value = ab * bc;'), 'props2 should have direct assignment with semicolon. Body: ' + (props2BodyMatch ? props2BodyMatch[2] : 'null'));

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