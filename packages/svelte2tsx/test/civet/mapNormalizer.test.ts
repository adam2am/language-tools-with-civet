import { strict as assert } from 'assert';
import { compileCivet } from '../../src/svelte2tsx/utils/civetCompiler';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapNormalizer';
import { SourceMapConsumer } from 'source-map';
import type { CivetLinesSourceMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('normalizeCivetMap (dynamic scenarios)', () => {
  interface Scenario {
    name: string;
    civetSnippet: string;
    svelteContent: string;
    tokens: string[];
  }

  const scenarios: Scenario[] = [
    {
      name: 'basic declarations',
      civetSnippet: 'x := 1\ny := x + 2\n',
      svelteContent: `<script lang="civet">\nx := 1\ny := x + 2\n</script>`,
      tokens: ['x', '1', 'y', 'x', '2']
    },
    {
      name: 'simple function',
      civetSnippet: 'add := (a: number, b: number): number => a + b\n',
      svelteContent: `<script lang="civet">\nadd := (a: number, b: number): number => a + b\n</script>`,
      tokens: ['add', 'a', 'b', 'a', 'b']
    },
    {
      name: 'named function with inner variable',
      civetSnippet: 'function fooFunc()\n  foo := "foo"\n',
      svelteContent: `<script lang="civet">\nfunction fooFunc()\n  foo := "foo"\n</script>`,
      tokens: ['fooFunc', 'foo', 'foo']
    },
    {
      name: 'arrow function inner var',
      civetSnippet: 'abc := () ->\n  abc := "abc"\n',
      svelteContent: `<script lang="civet">\nabc := () ->\n  abc := "abc"\n</script>`,
      tokens: ['abc', 'abc', 'abc']
    },
    {
      name: 'array operations',
      civetSnippet: 'processArray := (arr: number[]): number[] =>\n  arr.filter (n) => n > 0\n  .map (n) => n * 2\n',
      svelteContent: `<script lang="civet">\nprocessArray := (arr: number[]): number[] =>\n  arr.filter (n) => n > 0\n  .map (n) => n * 2\n</script>`,
      tokens: ['processArray', 'arr', 'filter', 'map', 'n', '2']
    },
    {
      name: 'conditional expression',
      civetSnippet: 'getStatus := (value: number): string =>\n  if value > 10\n    "high"\n  else\n    "low"\n',
      svelteContent: `<script lang="civet">\ngetStatus := (value: number): string =>\n  if value > 10\n    "high"\n  else\n    "low"\n</script>`,
      tokens: ['getStatus', 'value', '10', 'high', 'low']
    },
    {
      name: 'reactiveValue scenario',
      civetSnippet: '// Instance script\nreactiveValue := 42\nanotherVar := reactiveValue + 10\nconsole.log anotherVar\n',
      svelteContent: `<script lang="civet">\n// Instance script\nreactiveValue := 42\nanotherVar := reactiveValue + 10\nconsole.log anotherVar\n</script>`,
      tokens: ['reactiveValue', '42', 'anotherVar', 'console']
    }
  ];

  for (const { name, civetSnippet, svelteContent, tokens } of scenarios) {
    it(`should map tokens for ${name}`, async () => {
      // 1. Compile Civet snippet
      const result = compileCivet(civetSnippet, `${name}.civet`);
      assert.ok(result.rawMap && 'lines' in result.rawMap, 'Expected a CivetLinesSourceMap');

      // 2. Compute snippet offset in svelteContent
      const offset = getSnippetOffset(svelteContent, civetSnippet);

      // 3. Normalize the Civet map
    const normalized = normalizeCivetMap(
        result.rawMap as CivetLinesSourceMap,
        svelteContent,
      offset,
        'test.svelte'
    );

      // 4. Verify the RawSourceMap structure
    assert.equal(normalized.version, 3);
      assert.deepStrictEqual(normalized.sources, ['test.svelte']);
      assert.deepStrictEqual(normalized.sourcesContent, [svelteContent]);

      // 5. Map tokens back using SourceMapConsumer
    const consumer = await new SourceMapConsumer(normalized);
      const tsLines = result.code.split('\n');
      for (const token of tokens) {
        const tsLineIndex = tsLines.findIndex(line => line.includes(token));
        assert.notEqual(tsLineIndex, -1, `Token "${token}" not found in compiled TS code`);
        const tsColIndex = tsLines[tsLineIndex].indexOf(token);
        const orig = consumer.originalPositionFor({
          line: tsLineIndex + 1,
          column: tsColIndex,
          bias: SourceMapConsumer.GREATEST_LOWER_BOUND
        });
        assert.equal(orig.source, 'test.svelte', `Source mismatch for token "${token}"`);
        assert.ok(typeof orig.line === 'number' && orig.line >= 1, `Invalid original line for token "${token}": ${orig.line}`);
        assert.ok(typeof orig.column === 'number' && orig.column >= 0, `Invalid original column for token "${token}": ${orig.column}`);
      }
    consumer.destroy();
  });
  }
});

/**
 * Compute the 0-based line offset where the first significant Civet snippet line appears in the Svelte content.
 */
function getSnippetOffset(full: string, snippet: string): number {
  const fullLines = full.split('\n');
  const snippetLines = snippet.split('\n').filter(l => l.trim() !== '');
  if (!snippetLines.length) return 0;
  const firstLine = snippetLines[0].trim();
  const idx = fullLines.findIndex(line => line.trim() === firstLine);
  return idx >= 0 ? idx : 0;
}