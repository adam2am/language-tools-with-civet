import { strict as assert } from 'assert';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { SourceMapConsumer } from 'source-map';
import fs from 'fs';
import path from 'path';

describe('preprocessCivet on real fixtures', () => {
  it('scenario.svelte maps reactiveValue, anotherVar, and console', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'scenario.svelte');
    const svelte = fs.readFileSync(fixturePath, 'utf8');
    const result = preprocessCivet(svelte, 'scenario.svelte');
    assert.ok(result.instance, 'Expected instance block');
    const { map, tsStartInSvelteWithTs, tsEndInSvelteWithTs } = result.instance!;

    const tsSnippet = result.code.slice(tsStartInSvelteWithTs, tsEndInSvelteWithTs);
    const tsLines = tsSnippet.split('\n');
    const tokens = ['reactiveValue', 'anotherVar', 'console'];

    const consumer = await new SourceMapConsumer(map);
    for (const token of tokens) {
      const lineIndex = tsLines.findIndex(line => line.includes(token));
      assert.notStrictEqual(lineIndex, -1, `Token '${token}' not found in TS snippet`);
      const colIndex = tsLines[lineIndex].indexOf(token);
      const orig = consumer.originalPositionFor({
        line: lineIndex + 1,
        column: colIndex,
        bias: SourceMapConsumer.GREATEST_LOWER_BOUND
      });
      assert.equal(orig.source, 'scenario.svelte', `Source mismatch for '${token}'`);
      assert.ok(typeof orig.line === 'number' && orig.line >= 1,
                `Invalid original line for '${token}': ${orig.line}`);
      assert.ok(typeof orig.column === 'number' && orig.column >= 0,
                `Invalid original column for '${token}': ${orig.column}`);
    }
    consumer.destroy();
  });

  it('2scripts.svelte maps module and instance tokens correctly', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', '2scripts.svelte');
    const svelte = fs.readFileSync(fixturePath, 'utf8');
    const result = preprocessCivet(svelte, '2scripts.svelte');

    // Module script block
    assert.ok(result.module, 'Expected module block');
    const { map: mMap, tsStartInSvelteWithTs: mStart, tsEndInSvelteWithTs: mEnd } = result.module!;
    const mTs = result.code.slice(mStart, mEnd);
    const mLines = mTs.split('\n');
    const moduleTokens = ['greet', 'name', 'return'];
    const mCons = await new SourceMapConsumer(mMap);
    for (const token of moduleTokens) {
      const idx = mLines.findIndex(line => line.includes(token));
      assert.notStrictEqual(idx, -1, `Module token '${token}' not found`);
      const ci = mLines[idx].indexOf(token);
      const orig = mCons.originalPositionFor({
        line: idx + 1,
        column: ci,
        bias: SourceMapConsumer.GREATEST_LOWER_BOUND
      });
      assert.equal(orig.source, '2scripts.svelte', `Module source mismatch for '${token}'`);
      assert.ok(orig.line >= 1, `Invalid module line for '${token}': ${orig.line}`);
    }
    mCons.destroy();

    // Instance script block
    assert.ok(result.instance, 'Expected instance block');
    const { map: iMap, tsStartInSvelteWithTs: iStart, tsEndInSvelteWithTs: iEnd } = result.instance!;
    const iTs = result.code.slice(iStart, iEnd);
    const iLines = iTs.split('\n');
    const instanceTokens = ['reactiveValue', 'message', 'console'];
    const iCons = await new SourceMapConsumer(iMap);
    for (const token of instanceTokens) {
      const idx = iLines.findIndex(line => line.includes(token));
      assert.notStrictEqual(idx, -1, `Instance token '${token}' not found`);
      const ci = iLines[idx].indexOf(token);
      const orig = iCons.originalPositionFor({
        line: idx + 1,
        column: ci,
        bias: SourceMapConsumer.GREATEST_LOWER_BOUND
      });
      assert.equal(orig.source, '2scripts.svelte', `Instance source mismatch for '${token}'`);
      assert.ok(orig.line >= 1, `Invalid instance line for '${token}': ${orig.line}`);
    }
    iCons.destroy();
  });
}); 