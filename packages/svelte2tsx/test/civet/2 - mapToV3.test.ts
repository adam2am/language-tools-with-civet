import { strict as assert } from 'assert';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapToV3';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type { CivetLinesSourceMap } from '../../src/svelte2tsx/utils/civetTypes';
import { getSnippetOffset } from '../../src/svelte2tsx/utils/civetUtils';

// Helper to escape strings for regex construction
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\\\\\\]\\]/g, '\\\\$&'); // $& means the whole matched string
}

describe('2 - normalizeCivetMap = converting lines to v3 (dynamic scenarios) #happy', () => {
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
      name: 'simple function - pass',
      civetSnippet: 'foo := () => a + b\n',
      svelteContent: `<script lang="civet">\nfoo := () => a + b\n</script>`,
      tokens: ['foo', 'a', 'b']
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
      name: 'array operations - pass if not n, but value ',
      civetSnippet: 'processArray := (arr: number[]): number[] =>\n  arr.filter (value) => value > 0\n  .map (value) => value * 2\n',
      svelteContent: `<script lang="civet">\nprocessArray := (arr: number[]): number[] =>\n  arr.filter (value) => value > 0\n  .map (value) => value * 2\n</script>`,
      tokens: ['processArray', 'arr', 'filter', 'map', 'value', '2']
    },
    {
      name: 'conditional expression -  pass',
      civetSnippet: 'getStatus := () =>\n  if value > 10\n    "high"\n  else\n    "low"\n',
      svelteContent: `<script lang="civet">\ngetStatus := () =>\n  if value > 10\n    "high"\n  else\n    "low"\n</script>`,
      tokens: ['getStatus', 'value', '10', 'high', 'low']
    },
    {
      name: 'reactiveValue scenario - pass',
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

      // 5. Map tokens back using TraceMap
      const tracer = new (TraceMap as any)(normalized);
      const tsLines = result.code.split('\n');
      const svelteContentLines = svelteContent.split('\n');
      
      // Precompute positions of each token in the generated TS code (to handle duplicates)
      const tokenPositions: Record<string, { lineIndex: number; colIndex: number; }[]> = {};
      for (const tokenVal of Array.from(new Set(tokens))) {
        const escapedVal = escapeRegExp(tokenVal);
        const regexVal = new RegExp(`(?<!\\\\)\\b${escapedVal}\\b`, 'g');
        const positions: { lineIndex: number; colIndex: number; }[] = [];
        tsLines.forEach((lineText, idx) => {
          let match: RegExpExecArray | null;
          while ((match = regexVal.exec(lineText))) {
            if (tokenVal === 'n' && idx === 1) { // Specific log for the problematic case
              console.log(`[DEBUG n-matcher] tokenVal: ${tokenVal}, lineIdx: ${idx}, match.index: ${match.index}, matched: "${match[0]}", lineText: "${lineText}"`);
            }
            positions.push({ lineIndex: idx, colIndex: match.index });
          }
        });
        assert.ok(
          positions.length >= tokens.filter(t => t === tokenVal).length,
          `Expected at least ${tokens.filter(t => t === tokenVal).length} occurrences of token "${tokenVal}" in generated TS, but found ${positions.length}`
        );
        tokenPositions[tokenVal] = positions;
      }
      console.log("[DEBUG tokenPositions population] Final tokenPositions:", JSON.stringify(tokenPositions, null, 2)); // Log here
      
      const seenCounts: Record<string, number> = {};

      for (const token of tokens) {
        const occurrence = seenCounts[token] || 0;
        seenCounts[token] = occurrence + 1;
        
        if (!tokenPositions[token] || occurrence >= tokenPositions[token].length) {
          assert.fail(`Token "${token}" (occurrence ${occurrence + 1}) not found in precomputed TS positions. This should not happen if previous check passed.`);
        }
        
        const { lineIndex: tsLineIndex, colIndex: tsColIndex } = tokenPositions[token][occurrence];
        
        console.log(`[Test DEBUG] Scenario: ${name}, Token: "${token}", Occurrence: ${occurrence + 1}, TS Pos: L${tsLineIndex + 1}C${tsColIndex}`); // Log before originalPositionFor

        // Use originalPositionFor from @jridgewell/trace-mapping
        // Note: originalPositionFor expects 1-based line numbers
        const orig = originalPositionFor(tracer, {
          line: tsLineIndex + 1,
          column: tsColIndex
        });

        assert.ok(orig.source, `Original source is null/undefined for token "${token}" in ${name}. TS Pos: L${tsLineIndex+1}C${tsColIndex}`);
        assert.equal(orig.source, 'test.svelte', `Source mismatch for token "${token}" in ${name}. Expected 'test.svelte', got '${orig.source}'`);
        assert.ok(typeof orig.line === 'number' && orig.line >= 1, `Invalid original line for token "${token}" in ${name}: ${orig.line}`);
        assert.ok(typeof orig.column === 'number' && orig.column >= 0, `Invalid original column for token "${token}" in ${name}: ${orig.column}`);

        // Extract the text from the original Svelte content at the mapped position
        const originalSvelteLineContent = svelteContentLines[orig.line - 1];
        assert.ok(originalSvelteLineContent !== undefined, `Original Svelte line ${orig.line} is out of bounds for token "${token}" in ${name}.`);
        
        // Check for direct match or quoted match
        const actualMappedSvelteText = originalSvelteLineContent.substring(orig.column, orig.column + token.length);
        let passed = actualMappedSvelteText === token;

        if (!passed) {
            // Check if the mapping points to the start of a quoted version of the token
            const startsWithQuote = originalSvelteLineContent.charAt(orig.column) === '"' || originalSvelteLineContent.charAt(orig.column) === "'";
            if (startsWithQuote) {
                const quoteChar = originalSvelteLineContent.charAt(orig.column);
                // Ensure there's a closing quote and it's of the same type
                if (orig.column + token.length + 1 < originalSvelteLineContent.length && 
                    originalSvelteLineContent.charAt(orig.column + token.length + 1) === quoteChar) {
                    
                    const innerContent = originalSvelteLineContent.substring(orig.column + 1, orig.column + 1 + token.length);
                    if (innerContent === token) {
                        passed = true;
                    }
                }
            }
        }

        assert.ok(passed, 
            `Incorrect mapping for token "${token}" in ${name}. ` + 
            `TS Pos (L${tsLineIndex + 1}C${tsColIndex}) maps to Svelte (L${orig.line}C${orig.column}). ` + 
            `Expected Svelte text (or quoted inner text) to be "${token}", but direct map got "${actualMappedSvelteText}". ` + 
            `Original Svelte line content: "${originalSvelteLineContent}"`);
      }
    });
  }
});



