import { strict as assert } from 'assert';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { SourceMapConsumer } from 'source-map';
import fs from 'fs';
import path from 'path';

describe('current preprocessCivet for dual <script lang="civet"> blocks', () => {
  const fixtureFile = '2scripts.svelte';
  const fixturesDir = path.join(__dirname, 'fixtures');
  const fixturePath = path.join(fixturesDir, fixtureFile);
  const svelte = fs.readFileSync(fixturePath, 'utf8');
  const result = preprocessCivet(svelte, fixtureFile);

  it('should process module block and map tokens correctly', async () => {
    assert.ok(result.module, 'Expected module block data');
    const { map, tsStartInSvelteWithTs, tsEndInSvelteWithTs } = result.module!;
    const tsSnippet = result.code.slice(tsStartInSvelteWithTs, tsEndInSvelteWithTs);
    const tsLines = tsSnippet.split('\n');
    const tokens = ['greet', 'name', 'return'];
    const consumer = await new SourceMapConsumer(map);
    for (const token of tokens) {
      const idx = tsLines.findIndex(line => line.includes(token));
      assert.notStrictEqual(idx, -1, `Module token '${token}' not found in TS snippet`);
      const col = tsLines[idx].indexOf(token);
      const orig = consumer.originalPositionFor({ line: idx + 1, column: col, bias: SourceMapConsumer.GREATEST_LOWER_BOUND });
      assert.equal(orig.source, fixtureFile, `Module mapping source for '${token}'`);
      assert.ok(typeof orig.line === 'number' && orig.line >= 1, `Invalid original line for module token '${token}': ${orig.line}`);
      assert.ok(typeof orig.column === 'number' && orig.column >= 0, `Invalid original column for module token '${token}': ${orig.column}`);
    }
    consumer.destroy();
  });

  it('should process instance block and map tokens correctly', async () => {
    assert.ok(result.instance, 'Expected instance block data');
    const { map, tsStartInSvelteWithTs, tsEndInSvelteWithTs } = result.instance!;
    const tsSnippet = result.code.slice(tsStartInSvelteWithTs, tsEndInSvelteWithTs);
    const tsLines = tsSnippet.split('\n');
    const tokens = ['reactiveValue', 'message', 'console'];
    const consumer = await new SourceMapConsumer(map);
    for (const token of tokens) {
      const idx = tsLines.findIndex(line => line.includes(token));
      assert.notStrictEqual(idx, -1, `Instance token '${token}' not found in TS snippet`);
      const col = tsLines[idx].indexOf(token);
      const orig = consumer.originalPositionFor({ line: idx + 1, column: col, bias: SourceMapConsumer.GREATEST_LOWER_BOUND });
      assert.equal(orig.source, fixtureFile, `Instance mapping source for '${token}'`);
      assert.ok(typeof orig.line === 'number' && orig.line >= 1, `Invalid original line for instance token '${token}': ${orig.line}`);
      assert.ok(typeof orig.column === 'number' && orig.column >= 0, `Invalid original column for instance token '${token}': ${orig.column}`);
    }
    consumer.destroy();
  });
}); 