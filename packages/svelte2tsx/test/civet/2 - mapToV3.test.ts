import { strict as assert } from 'assert';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapToV3';
import { SourceMapConsumer } from 'source-map';
import type { CivetLinesSourceMap } from '../../src/svelte2tsx/utils/civetTypes';

// Helper to escape strings for regex construction
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\\\\]\\\\]/g, '\\\\$&'); // $& means the whole matched string
}

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
      name: 'array operations named parameter',
      civetSnippet: 'processArray := (arr: number[]): number[] =>\n  arr.filter (value) => value > 0\n  .map (value) => value * 2\n',
      svelteContent: `<script lang="civet">\nprocessArray := (arr: number[]): number[] =>\n  arr.filter (value) => value > 0\n  .map (value) => value * 2\n</script>`,
      tokens: ['processArray', 'arr', 'filter', 'map', 'value', '2']
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
    // FOCUS ON ARRAY OPERATIONS (removed filtering to run all scenarios)
    // if (name !== 'array operations' && name !== 'array operations named parameter') continue;

    it(`should map tokens for ${name}`, async () => { // restored full test suite
      // 1. Compile Civet snippet
      const result = compileCivet(civetSnippet, `${name}.civet`);
      // DEBUG: Log the TypeScript output for inspection
      console.log(`[TS CODE for ${name}]:\n${result.code}`);
      assert.ok(result.rawMap && 'lines' in result.rawMap, 'Expected a CivetLinesSourceMap');

      // LOG RAW MAP LINES FOR THIS SCENARIO
      console.log(`[RAW CIVET MAP LINES for ${name}]:`, JSON.stringify((result.rawMap as CivetLinesSourceMap).lines, null, 2));

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

      // Log the generated V3 mappings string
      console.log(`[V3 MAPPINGS for ${name}]:\n${JSON.stringify(normalized, null, 2)}`);

      // 5. Map tokens back using SourceMapConsumer
      const consumer = await new SourceMapConsumer(normalized);
      const tsLines = result.code.split('\n');
      for (const token of tokens) {
        const escapedToken = escapeRegExp(token);
        const tokenRegex = new RegExp(`\\b${escapedToken}\\b`);
        let tsLineIndex = -1;
        let matchResult = null;

        for (let i = 0; i < tsLines.length; i++) {
            matchResult = tsLines[i].match(tokenRegex);
            if (matchResult) {
                tsLineIndex = i;
                break;
            }
        }
        assert.notEqual(tsLineIndex, -1, `Token "${token}" (as whole word) not found in compiled TS code. Regex: ${tokenRegex}. TS Code:\\n${result.code}`);
        const tsColIndex = matchResult.index;

        const orig = consumer.originalPositionFor({
          line: tsLineIndex + 1,
          column: tsColIndex,
          bias: SourceMapConsumer.GREATEST_LOWER_BOUND
        });

        // TEMPORARY DEBUG LOG FOR "n" in "array operations"
        // if (name === 'array operations' && token === 'n') {
        //   const orig_lub = consumer.originalPositionFor({
        //     line: tsLineIndex + 1,
        //     column: tsColIndex,
        //     bias: SourceMapConsumer.LEAST_UPPER_BOUND
        //   });
        //   console.log(`[DEBUG LUB for 'n']: orig_glb: ${JSON.stringify(orig)}, orig_lub: ${JSON.stringify(orig_lub)}`);
        //   console.log(`[DEBUG LUB for 'n']: TS Line: ${tsLineIndex+1}, TS Col: ${tsColIndex}`);
        //   console.log(`[DEBUG LUB for 'n']: Querying at generated code: '${tsLines[tsLineIndex].substring(tsColIndex, tsColIndex + 5)}...'`);
        // }

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
        // Calculate indentation for the mapped Svelte line
        assert.ok(orig.line - 1 >= 0 && orig.line - 1 < svelteContentLines.length, `orig.line ${orig.line} out of bounds for svelteContentLines`);
        const svelteLineForIndent = svelteContentLines[orig.line - 1];
        const indentMatch = svelteLineForIndent.match(/^(\s*)/);
        const indentLenForThisLine = indentMatch ? indentMatch[1].length : 0;
        // Robust check: find token position in raw Civet snippet line and assert mapping correctness.
        const tokenIndexInRaw = actualTokenLineInRawCivet.indexOf(token);
        assert.ok(tokenIndexInRaw >= 0, `Token "${token}" not found in raw Civet line: "${actualTokenLineInRawCivet}"`);
        // The mapping's original column should equal snippet indent plus raw token index.
        const expectedColumnInSvelte = indentLenForThisLine + tokenIndexInRaw;
        assert.strictEqual(orig.column, expectedColumnInSvelte,
            `Incorrect mapping for token "${token}". Expected column ${expectedColumnInSvelte} (indent ${indentLenForThisLine} + raw index ${tokenIndexInRaw}), but got ${orig.column}. Raw line: "${actualTokenLineInRawCivet}"`);
        // Optionally verify snippet-relative column matches raw index
        const actualSnippetColumn = orig.column - indentLenForThisLine;
        assert.strictEqual(actualSnippetColumn, tokenIndexInRaw,
            `Token "${token}" expected at snippet column ${tokenIndexInRaw}, but actualSnippetColumn is ${actualSnippetColumn}`);

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