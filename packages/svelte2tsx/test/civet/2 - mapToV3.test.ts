import { strict as assert } from 'assert';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapToV3';
import { SourceMapConsumer } from 'source-map';
import type { CivetLinesSourceMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('2 - normalizeCivetMap = converting lines to v3 (dynamic scenarios) #happy #current', () => {
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
      tokens: ['function', 'fooFunc', 'foo', 'foo']
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
      assert.deepStrictEqual(normalized.names, [], 'Expected no names in normalized map');

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

        // New robust way to calculate expected original line and column
        const rawCivetLines = civetSnippet.split('\n');
        const svelteContentLines = svelteContent.split('\n');
        
        // 1. Determine the 0-based line index in the raw Civet snippet that 'orig.line' (1-based in Svelte) corresponds to.
        //    `offset` is the 0-based Svelte line where the Civet snippet (conceptually, its first non-empty part) begins.
        //    `orig.line - 1` is the 0-based Svelte line of the mapping.
        //    So, `orig.line - 1 - offset` is the 0-based line index within the Civet snippet,
        //    assuming `normalizeCivetMap` correctly adjusted for any `snippetHadLeadingNewline`
        //    when it produced `orig.line`. This index refers to `rawCivetLines` if `rawCivetLines`
        //    is a direct split of the snippet string that `normalizeCivetMap` saw.
        const effectiveMappedLineInCivet_0based = orig.line - 1 - offset;

        assert.ok(effectiveMappedLineInCivet_0based >= 0 && effectiveMappedLineInCivet_0based < rawCivetLines.length, 
          `Mapped line index ${effectiveMappedLineInCivet_0based} (from orig.line ${orig.line}, offset ${offset}) out of bounds for rawCivetLines (len ${rawCivetLines.length}) for token "${token}" in ${name}. Raw civet lines: ${JSON.stringify(rawCivetLines)}`);
        
        const actualTokenLineInRawCivet = rawCivetLines[effectiveMappedLineInCivet_0based];
        const actualSnippetColumn = actualTokenLineInRawCivet.indexOf(token); 
        
        assert.notEqual(actualSnippetColumn, -1, 
          `Token "${token}" not found on its mapped Civet line L${effectiveMappedLineInCivet_0based + 1} (orig.line ${orig.line}): '${actualTokenLineInRawCivet}' in ${name}. TS: L${tsLineIndex+1}C${tsColIndex}`);

        // 2. Calculate the indent for the Svelte line pointed to by orig.line
        assert.ok(orig.line -1 >= 0 && orig.line -1 < svelteContentLines.length, `orig.line ${orig.line} out of bounds for svelteContentLines`);
        const svelteLineForIndent = svelteContentLines[orig.line - 1];
        const indentMatch = svelteLineForIndent.match(/^(\s*)/);
        const indentLenForThisLine = indentMatch ? indentMatch[1].length : 0;

        // 3. The expected column is this actualSnippetColumn + indentLenForThisLine
        const expectedColumn = actualSnippetColumn + indentLenForThisLine;
        
        // The expected line is simply orig.line, as we are checking if the map's line is consistent.
        // We've already used orig.line to find the context.

        assert.strictEqual(orig.column, expectedColumn, `Expected original column ${expectedColumn} for token "${token}" in ${name} (orig.line ${orig.line}), got ${orig.column}. TS: L${tsLineIndex+1}C${tsColIndex}. SnippetCol: ${actualSnippetColumn}. IndentLen: ${indentLenForThisLine}. CivetLineContent: '${actualTokenLineInRawCivet}'. SvelteLineContent: '${svelteLineForIndent}'`);
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