import { strict as assert } from 'assert';
import { compileCivet } from '../../src/svelte2tsx/utils/civetCompiler';
import type { CivetLinesSourceMap, StandardRawSourceMap, CivetOutputMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('compileCivet', () => {
  const civetCode = '\n  a := 1\n  if a > 0 \n    x := 42\n  else\n    y .= x + 1\n  '; // Stresstest code
  const filename = 'TestCivetFile.civet';

  it('returns a CivetLinesSourceMap by default', () => {
    const result = compileCivet(civetCode, filename); // Default: outputStandardV3Map is false
    console.log('\n--- CivetLinesSourceMap Test ---');
    console.log('Compiled TypeScript:\n', result.code);
    console.log('Default (CivetLinesSourceMap) Output:', JSON.stringify(result.rawMap, null, 2));

    assert.match(result.code, /const a = 1/);
    assert.match(result.code, /let y = x \+ 1/);

    const map = result.rawMap as CivetLinesSourceMap | undefined;
    assert.ok(map, 'rawMap should be defined for CivetLinesSourceMap test');
    if (map) {
      assert.ok(!('version' in map) && !('mappings' in map), 'Should be CivetLinesSourceMap, not Standard V3');
      assert.ok(Array.isArray(map.lines), 'CivetLinesSourceMap should have a lines array');
      assert.ok(map.lines.length > 0, 'CivetLinesSourceMap.lines should not be empty');
      assert.strictEqual(map.source, civetCode, 'CivetLinesSourceMap.source should match input code');
    }
  });

  it('returns a StandardRawSourceMap when outputStandardV3Map is true', () => {
    const result = compileCivet(civetCode, filename, { outputStandardV3Map: true });
    console.log('\n--- StandardRawSourceMap Test ---');
    console.log('Compiled TypeScript:\n', result.code);
    console.log('Standard V3 Output:', JSON.stringify(result.rawMap, null, 2));

    assert.match(result.code, /const a = 1/);
    assert.match(result.code, /let y = x \+ 1/);

    const map = result.rawMap as StandardRawSourceMap | undefined;
    assert.ok(map, 'rawMap should be defined for StandardRawSourceMap test');
    if (map) {
      assert.ok('version' in map && 'mappings' in map, 'Should be Standard V3 map');
      assert.equal(map.version, 3, 'StandardRawSourceMap version should be 3');
      assert.ok(Array.isArray(map.sources), 'StandardRawSourceMap should have sources array');
      assert.ok(typeof map.mappings === 'string', 'StandardRawSourceMap should have mappings string');
      assert.ok(map.sources.includes(filename), 'StandardRawSourceMap.sources should include filename');
    }
  });
}); 