import { strict as assert } from 'assert';
import { SourceMapConsumer } from 'source-map';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import type { CivetLinesSourceMap, StandardRawSourceMap, CivetOutputMap } from '../../src/svelte2tsx/utils/civetTypes';

const compileTestDebug = false;

describe('1 - civet: generating source map raw lines #happy', () => {
  // Civet code specifically from fixtures/scenario.svelte (script part)
  const civetCode = '\n  // Instance script\n  reactiveValue := 42\n  anotherVar := reactiveValue + 10\n  console.log anotherVar\n';
  const filename = 'scenario.civet'; // Match the scenario filename context


  it('returns a CivetLinesSourceMap by default', () => {
    const result = compileCivet(civetCode, filename); // Default: outputStandardV3Map is false
    if (compileTestDebug) {
      console.log('\n--- CivetLinesSourceMap Test (scenario.civet content) ---');
      console.log('Compiled TypeScript:\n', result.code);
      console.log('Default (CivetLinesSourceMap) Output:', JSON.stringify(result.rawMap, null, 2));
    } 
    assert.match(result.code, /const reactiveValue = 42/);
    assert.match(result.code, /const anotherVar = reactiveValue \+ 10/);

    const map = result.rawMap as CivetLinesSourceMap | undefined;
    assert.ok(map, 'rawMap should be defined for CivetLinesSourceMap test');
    if (map) {
      assert.ok(!('version' in map) && !('mappings' in map), 'Should be CivetLinesSourceMap, not Standard V3');
      assert.ok(Array.isArray(map.lines), 'CivetLinesSourceMap should have a lines array');
      assert.ok(map.lines.length > 0, 'CivetLinesSourceMap.lines should not be empty');
      // The Civet-specific map should have the original source directly.
      assert.strictEqual(map.source, civetCode, 'CivetLinesSourceMap.source should match input code');
    }
  });


  it('returns a StandardRawSourceMap when outputStandardV3Map is true', async () => {
    const result = compileCivet(civetCode, filename, { outputStandardV3Map: true });
    if (compileTestDebug) {
      console.log('\n--- StandardRawSourceMap Test (scenario.civet content) ---');
      console.log('Compiled TypeScript:\n', result.code);
      console.log('Standard V3 Output (raw JSON):', JSON.stringify(result.rawMap, null, 2));
    } 

    assert.match(result.code, /const reactiveValue = 42/);
    assert.match(result.code, /const anotherVar = reactiveValue \+ 10/);

    const map = result.rawMap as StandardRawSourceMap | undefined;
    assert.ok(map, 'rawMap should be defined for StandardRawSourceMap test');
    if (map) {
      assert.ok('version' in map && 'mappings' in map, 'Should be Standard V3 map');
      assert.equal(map.version, 3, 'StandardRawSourceMap version should be 3');
      assert.ok(Array.isArray(map.sources), 'StandardRawSourceMap should have sources array');
      assert.ok(typeof map.mappings === 'string', 'StandardRawSourceMap should have mappings string');
      // Civet compiler (.json() method) by default sets sources to [filename]
      assert.deepStrictEqual(map.sources, [filename], 'StandardRawSourceMap.sources should be an array containing only the filename');
      assert.ok(map.sourcesContent && map.sourcesContent[0] === civetCode, 'StandardRawSourceMap.sourcesContent[0] should match input code');

      // Add detailed mapping segment logging
      if (compileTestDebug) console.log('\n--- Decoded V3 Mapping Segments (scenario.civet content) ---');
      await SourceMapConsumer.with(map, null, consumer => {
        consumer.eachMapping(m => {
          if (compileTestDebug) {
            console.log(
            `Gen L:${m.generatedLine} C:${m.generatedColumn} -> ` +
            (m.source ? `Src L:${m.originalLine} C:${m.originalColumn} (${m.source})` : `(no source mapping)`) +
            (m.name ? ` Name: ${m.name}` : '')
          );}
        });
      });
    }
  });
}); 