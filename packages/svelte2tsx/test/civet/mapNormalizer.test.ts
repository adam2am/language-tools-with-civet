import { strict as assert } from 'assert';
import { compileCivet } from '../../src/svelte2tsx/utils/civetCompiler';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapNormalizer';
import { SourceMapConsumer } from 'source-map';
import type { CivetLinesSourceMap, StandardRawSourceMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('normalizeCivetMap', () => {
  const lazerFocusDebug = false;
  
  it('correctly applies line offset and transforms CivetLinesSourceMap to StandardRawSourceMap', async () => {
    const svelteFilePath = 'test.svelte';
    const originalFullSvelteContent = `
<script lang="civet">
  x := 1 // Civet line 0 (original snippet line)
  y := x + 2 // Civet line 1
</script>
<div>Hello</div>
    `;
    const originalCivetSnippetLineOffset_0based = 2;

    // originalColumn_0based_in_snippet (segment[3]) is relative to the UNINDENTED civet snippet lines
    const mockCivetMap: CivetLinesSourceMap = {
      source: 'x := 1\ny := x + 2', // UNINDENTED source
      lines: [
        // For TS "x = 1;" (Generated Line 0, 1-based for consumer)
        [
          [0, 0, 0, 0],  // TS Col 0 ('x') -> Civet L0C0 ('x' in "x := 1")
          [4, 0, 0, 5]   // TS Col 4 ('1') -> Civet L0C5 ('1' in "x := 1")
        ],
        // For TS "y = x + 2;" (Generated Line 1, 1-based for consumer)
        [
          [0, 0, 1, 0],  // TS Col 0 ('y') -> Civet L1C0 ('y' in "y := x + 2")
          [4, 0, 1, 4],  // TS Col 4 ('x') -> Civet L1C4 ('x' in "y := x + 2")
          [8, 0, 1, 8]   // TS Col 8 ('2') -> Civet L1C8 ('2' in "y := x + 2")
        ]
      ],
    };

    const normalizedMap: StandardRawSourceMap = normalizeCivetMap(
      mockCivetMap,
      originalFullSvelteContent,
      originalCivetSnippetLineOffset_0based,
      svelteFilePath
    );

    assert.equal(normalizedMap.version, 3);
    assert.deepStrictEqual(normalizedMap.sources, [svelteFilePath]);
    assert.deepStrictEqual(normalizedMap.sourcesContent, [originalFullSvelteContent]);
    assert.ok(normalizedMap.mappings.length > 0);

    const consumer = await new SourceMapConsumer(normalizedMap);
    const svelteScriptIndent = 2; // normalizeCivetMap will calculate this as 2.

    // Test for "x" in "x := 1" (Civet L0C0)
    // TS is "x = 1;" (TS L1C0 for 'x', 0-based for consumer.originalPositionFor)
    let pos = consumer.originalPositionFor({ line: 1, column: 0, bias: SourceMapConsumer.LEAST_UPPER_BOUND }); // TS: 'x'
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, originalCivetSnippetLineOffset_0based + 0 + 1, 'Original Line for x decl'); // Svelte L3
    assert.equal(pos.column, 0 + svelteScriptIndent, 'Original Col for x decl'); // Svelte C2 ('x')

    // Test for "1" in "x := 1" (Civet L0C5)
    // TS is "x = 1;" (TS L1C4 for '1')
    pos = consumer.originalPositionFor({ line: 1, column: 4, bias: SourceMapConsumer.LEAST_UPPER_BOUND }); // TS: '1'
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, originalCivetSnippetLineOffset_0based + 0 + 1, 'Original Line for 1'); // Svelte L3
    assert.equal(pos.column, 5 + svelteScriptIndent, 'Original Col for 1'); // Svelte C7 ('1')

    // Test for "y" in "y := x + 2" (Civet L1C0)
    // TS is "y = x + 2;" (TS L2C0 for 'y')
    pos = consumer.originalPositionFor({ line: 2, column: 0, bias: SourceMapConsumer.LEAST_UPPER_BOUND }); // TS: 'y'
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, originalCivetSnippetLineOffset_0based + 1 + 1, 'Original Line for y decl'); // Svelte L4
    assert.equal(pos.column, 0 + svelteScriptIndent, 'Original Col for y decl'); // Svelte C2 ('y')

    // Test for "x" in "y := x + 2" (Civet L1C4)
    // TS is "y = x + 2;" (TS L2C4 for 'x')
    pos = consumer.originalPositionFor({ line: 2, column: 4, bias: SourceMapConsumer.LEAST_UPPER_BOUND }); // TS: 'x'
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, originalCivetSnippetLineOffset_0based + 1 + 1, 'Original Line for x usage'); // Svelte L4
    assert.equal(pos.column, 4 + svelteScriptIndent, 'Original Col for x usage'); // Svelte C6 ('x')

    // Test for "2" in "y := x + 2" (Civet L1C8)
    // TS is "y = x + 2;" (TS L2C8 for '2')
    pos = consumer.originalPositionFor({ line: 2, column: 8, bias: SourceMapConsumer.LEAST_UPPER_BOUND }); // TS: '2'
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, originalCivetSnippetLineOffset_0based + 1 + 1, 'Original Line for 2'); // Svelte L4
    assert.equal(pos.column, 8 + svelteScriptIndent, 'Original Col for 2'); // Svelte C10 ('2')

    consumer.destroy();
  });

  // Advanced scenario 1: Simple function
  it('normalizes a simple function declaration', async () => {
    const svelteFilePath = 'scenario1.svelte';
    const civetCode = 'add := (a: number, b: number): number => a + b';
    const originalFullSvelteContent = `
<script lang="civet">
  ${civetCode}
</script>
<div></div>
    `;
    const offset = 2; // Civet content starts on Svelte file line index 2 (0-based)

    const result = compileCivet(civetCode, 'scenario1.civet');
    if (lazerFocusDebug) console.log('\n--- Scenario 1: Simple function ---');
    if (lazerFocusDebug) console.log('Original Civet:', civetCode);
    if (lazerFocusDebug) console.log('Compiled TS:', result.code);
    if (lazerFocusDebug) console.log('Raw CivetLinesSourceMap:', JSON.stringify(result.rawMap, null, 2));

    const civetMap = result.rawMap as CivetLinesSourceMap;
    const normalized = normalizeCivetMap(
      civetMap,
      originalFullSvelteContent,
      offset,
      svelteFilePath
    );
    if (lazerFocusDebug) console.log('Normalized StandardRawSourceMap:', JSON.stringify(normalized, null, 2));

    assert.equal(normalized.version, 3);
    assert.deepStrictEqual(normalized.sources, [svelteFilePath]);

    const consumer = await new SourceMapConsumer(normalized);
    const svelteIndent = 2; // Expected indentation of civetCode within <script>

    // Debug: Detailed mapping around the parameters a and b
    if (lazerFocusDebug) console.log('--- Param mapping debug: TS columns 10..16 ---');
    for (let col = 10; col <= 16; col++) {
      const dbgPos = consumer.originalPositionFor({ line: 1, column: col, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
      if (lazerFocusDebug) console.log(`TS [1,${col}] ->`, dbgPos);
    }
    
    // Token: `add` (declaration)
    // TS: L1, C6 ('a' in `add`)
    // Civet: L0, C0 ('a' in `add`)
    let pos = consumer.originalPositionFor({ line: 1, column: 6, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, offset + 0 + 1, 'Original line for "add" declaration'); // Svelte L3
    assert.equal(pos.column, 0 + svelteIndent, 'Original column for "add" declaration'); // Svelte C2 ('a' in add)

    // Token: `a` (first parameter)
    // TS: L1, C13 ('a' in `(a: number...`)
    // Civet: L0, C8 ('a' in `(a: number...`)
    // Civet's rawMap has a specific mapping for this: generatedCol 12 -> originalCol 7 (space before 'a')
    // and generatedCol 13 -> originalCol 8 ('a').
    // So consumer.originalPositionFor({ line: 1, column: 13 }) should resolve to Civet L0C8.
    pos = consumer.originalPositionFor({ line: 1, column: 13, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    if (lazerFocusDebug) console.log('DEBUG simple function param a mapping:', pos);
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, offset + 0 + 1, 'Original line for param "a"'); // Svelte L3
    assert.equal(pos.column, 8 + svelteIndent, 'Original column for param "a"'); // Svelte C10 ('a')

    // Token: `b` (second parameter)
    // TS: L1, C25 ('b' in `b: number): ...`)
    // Civet: L0, C20 ('b' in `b: number): ...`)
    pos = consumer.originalPositionFor({ line: 1, column: 25, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, offset + 0 + 1, 'Original line for param "b"'); // Svelte L3
    assert.equal(pos.column, 20 + svelteIndent, 'Original column for param "b"'); // Svelte C22 ('b')

    // Token: `a` (in expression `a + b`)
    // TS: L1, C46 ('a' in `=> a + b`)
    // Civet: L0, C41 ('a' in `=> a + b`)
    pos = consumer.originalPositionFor({ line: 1, column: 46, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, offset + 0 + 1, 'Original line for "a" in expression'); // Svelte L3
    assert.equal(pos.column, 41 + svelteIndent, 'Original column for "a" in expression'); // Svelte C43 ('a')

    // Token: `b` (in expression `a + b`)
    // TS: L1, C50 ('b' in `a + b`)
    // Civet: L0, C45 ('b' in `a + b`)
    pos = consumer.originalPositionFor({ line: 1, column: 50, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, offset + 0 + 1, 'Original line for "b" in expression'); // Svelte L3
    assert.equal(pos.column, 45 + svelteIndent, 'Original column for "b" in expression'); // Svelte C47 ('b')

    consumer.destroy();
  });

  // Scenario 1.1: Named function with inner variable
  it('normalizes a named function with an inner variable', async () => {
    const svelteFilePath = 'scenario1.1.svelte';
    const civetCode = 'function fooFunc()\n  foo := "foo"'; // Note: Indentation for foo must be consistent with Civet syntax
    const originalFullSvelteContent = `
<script lang="civet">
  ${civetCode}
</script>
<div></div>
    `;
    const offset = 2; // Civet content starts on Svelte file line index 2

    const result = compileCivet(civetCode, 'scenario1.1.civet');
    if (lazerFocusDebug) console.log('\n--- Scenario 1.1: Named function ---');
    if (lazerFocusDebug) console.log('Original Civet:\n', civetCode);
    if (lazerFocusDebug) console.log('Compiled TS:\n', result.code);
    if (lazerFocusDebug) console.log('Raw CivetLinesSourceMap:', JSON.stringify(result.rawMap, null, 2));

    const civetMap = result.rawMap as CivetLinesSourceMap;
    const normalized = normalizeCivetMap(
      civetMap,
      originalFullSvelteContent,
      offset,
      svelteFilePath
    );
    if (lazerFocusDebug) console.log('Normalized StandardRawSourceMap for Scenario 1.1 (in-test):', JSON.stringify(normalized, null, 2));

    assert.equal(normalized.version, 3);
    assert.deepStrictEqual(normalized.sources, [svelteFilePath]);

    const consumer = await new SourceMapConsumer(normalized);
    const svelteIndent = 2; // Indentation of civetCode within <script>

    // Compiled TS:
    // function fooFunc() {           // TS Line 1 (1-based for consumer)
    //   const foo = "foo";return foo // TS Line 2
    // }
    // Original Civet:
    // function fooFunc()           // Civet Line 0 (0-based for snippet)
    //   foo := "foo"              // Civet Line 1

    // Token: `fooFunc` (declaration)
    // TS: L1, C9 ('f' in `fooFunc`)
    // Civet: L0, C9 ('f' in `fooFunc`)
    let pos = consumer.originalPositionFor({ line: 1, column: 9, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S1.1 fooFunc S');
    assert.equal(pos.line, offset + 0 + 1, 'S1.1 fooFunc L'); // Svelte L3
    // Civet rawMap segment for TS L1C9 is [9,0,0,9] -> maps to Civet L0C9
    assert.equal(pos.column, 9 + svelteIndent, 'S1.1 fooFunc C'); // Svelte C11 ('f' in fooFunc)

    // Token: `foo` (inner variable declaration)
    // TS: L2, C8 ('f' in `foo` in `const foo`)
    // Civet: L1, C2 ('f' in `foo` in `  foo := "foo"`)
    pos = consumer.originalPositionFor({ line: 2, column: 8, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S1.1 foo var S');
    assert.equal(pos.line, offset + 1 + 1, 'S1.1 foo var L'); // Svelte L4
    // Civet rawMap segment for TS L2C8 is [8,0,1,2] -> maps to Civet L1C2
    assert.equal(pos.column, 2 + svelteIndent, 'S1.1 foo var C'); // Svelte C4 ('f' in foo)

    // Token: `"foo"` (string literal)
    // TS: L2, C13 (opening `"` of `"foo"`)
    // Civet: L1, C8 (opening `"` of `"foo"`)
    pos = consumer.originalPositionFor({ line: 2, column: 13, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S1.1 "foo" S');
    assert.equal(pos.line, offset + 1 + 1, 'S1.1 "foo" L'); // Svelte L4
    // Civet rawMap segment for TS L2C13 is [13,0,1,8] -> maps to Civet L1C8
    assert.equal(pos.column, 8 + svelteIndent, 'S1.1 "foo" C'); // Svelte C10 (opening `"`)

    consumer.destroy();
  });

  // Scenario 1.2: Arrow function with inner variable (same name)
  it('1.2 - normalizes an arrow function with an inner variable of the same name', async () => {
    const svelteFilePath = 'scenario1.2.svelte';
    const civetCode = 'abc := () ->\n  abc := "abc"'; // Note: Indentation
    const originalFullSvelteContent = `
<script lang="civet">
  ${civetCode}
</script>
<div></div>
    `;
    const offset = 2; // Civet content starts on Svelte file line index 2

    const result = compileCivet(civetCode, 'scenario1.2.civet');
    if (lazerFocusDebug) console.log('\n--- Scenario 1.2: Arrow function, same name inner var ---');
    if (lazerFocusDebug) console.log('Original Civet:\n', civetCode);
    if (lazerFocusDebug) console.log('Compiled TS:\n', result.code);
    if (lazerFocusDebug) console.log('Raw CivetLinesSourceMap:', JSON.stringify(result.rawMap, null, 2));

    const civetMap = result.rawMap as CivetLinesSourceMap;
    const normalized = normalizeCivetMap(
      civetMap,
      originalFullSvelteContent,
      offset,
      svelteFilePath
    );
    if (lazerFocusDebug) console.log('Normalized StandardRawSourceMap:', JSON.stringify(normalized, null, 2));

    assert.equal(normalized.version, 3);
    assert.deepStrictEqual(normalized.sources, [svelteFilePath]);

    const consumer = await new SourceMapConsumer(normalized);
    const svelteIndent = 2; // Indentation of civetCode within <script>

    // Compiled TS:
    // const abc = function() {      // TS Line 1
    //   const abc = "abc";return abc // TS Line 2
    // }
    // Original Civet:
    // abc := () ->                  // Civet Line 0
    //   abc := "abc"              // Civet Line 1

    // Token: outer `abc` (declaration)
    // TS: L1, C6 ('a' in `abc`)
    // Civet: L0, C0 ('a' in `abc`)
    let pos = consumer.originalPositionFor({ line: 1, column: 6, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S1.2 outer abc S');
    assert.equal(pos.line, offset + 0 + 1, 'S1.2 outer abc L'); // Svelte L3
    // Civet rawMap for TS L1C6 is [6,0,0,0] -> Civet L0C0
    assert.equal(pos.column, 0 + svelteIndent, 'S1.2 outer abc C'); // Svelte C2 ('a' in abc)

    // Token: inner `abc` (variable declaration)
    // TS: L2, C8 ('a' in `abc` in `const abc`)
    // Civet: L1, C2 ('a' in `abc` in `  abc := "abc"`)
    pos = consumer.originalPositionFor({ line: 2, column: 8, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S1.2 inner abc S');
    assert.equal(pos.line, offset + 1 + 1, 'S1.2 inner abc L'); // Svelte L4
    // Civet rawMap for TS L2C8 is [8,0,1,2] -> Civet L1C2
    assert.equal(pos.column, 2 + svelteIndent, 'S1.2 inner abc C'); // Svelte C4 ('a' in abc)

    // Token: `"abc"` (string literal)
    // TS: L2, C13 (opening `"` of `"abc"`)
    // Civet: L1, C8 (opening `"` of `"abc"`)
    pos = consumer.originalPositionFor({ line: 2, column: 13, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S1.2 "abc" S');
    assert.equal(pos.line, offset + 1 + 1, 'S1.2 "abc" L'); // Svelte L4
    // Civet rawMap for TS L2C13 is [13,0,1,8] -> Civet L1C8
    assert.equal(pos.column, 8 + svelteIndent, 'S1.2 "abc" C'); // Svelte C10 (opening `"`)

    consumer.destroy();
  });

  // Advanced scenario 2: Array operations
  it('scenario2 - normalizes array filter/map operations', async () => {
    const svelteFilePath = 'scenario2.svelte';
    // Civet L0: (blank line in snippet)
    // Civet L1: processArray := (arr: number[]): number[] =>
    // Civet L2:   arr.filter (n) => n > 0
    // Civet L3:   .map (n) => n * 2
    const civetCode = `
		processArray := (arr: number[]): number[] =>
			arr.filter (n) => n > 0
			.map (n) => n * 2
	`;
    const originalFullSvelteContent = `
<script lang="civet">
  ${civetCode}
</script>
<p>Test</p>
    `;
    const offset = 2; // 0-based Svelte file line index where civetCode string starts

    const result = compileCivet(civetCode, 'scenario2.civet');
    if (lazerFocusDebug) console.log('\n--- Scenario 2: Array operations ---');
    if (lazerFocusDebug) console.log('Original Civet:\n', civetCode);
    if (lazerFocusDebug) console.log('Compiled TS:\n', result.code);
    if (lazerFocusDebug) console.log('Raw CivetLinesSourceMap:', JSON.stringify(result.rawMap, null, 2)); // Verbose
    /* Compiled TS (from logs, 1-based lines):
    L1: (blank)
    L2: const processArray = (arr: number[]): number[] => {
    L3:   return arr.filter((n) => n > 0)
    L4:   .map((n) => n * 2)
    L5: }
    */

    const civetMap = result.rawMap as CivetLinesSourceMap;
    const normalized = normalizeCivetMap(
      civetMap,
      originalFullSvelteContent,
      offset,
      svelteFilePath
    );
    if (lazerFocusDebug) console.log('Normalized StandardRawSourceMap:', JSON.stringify(normalized, null, 2)); // Verbose

    assert.equal(normalized.version, 3);
    assert.deepStrictEqual(normalized.sources, [svelteFilePath]);

    const consumer = await new SourceMapConsumer(normalized);
    // const svelteIndent = 2; // This is calculated by normalizeCivetMap

    // Token: `processArray` (declaration)
    // TS: L2, C8 ('p' in `processArray`)
    // Civet Snippet: L1, C2 (after 		)
    let pos = consumer.originalPositionFor({ line: 2, column: 8, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 processArray S');
    assert.equal(pos.line, 4, 'S2 processArray L (Svelte L4)');
    assert.equal(pos.column, 4, 'S2 processArray C (Svelte C4)');

    // Token: `arr` (parameter)
    // TS: L2, C23 ('a' in `(arr: number[])`)
    // Civet Snippet: L1, C18 (raw map points to 'r' of arr for TS 'a')
    pos = consumer.originalPositionFor({ line: 2, column: 23, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 arr_param S');
    assert.equal(pos.line, 4, 'S2 arr_param L (Svelte L4)');
    assert.equal(pos.column, 20, 'S2 arr_param C (Svelte C20 for r)');

    // Token: `arr` (object in `arr.filter`)
    // TS: L3, C7 ('a' in `arr.filter`)
    // Civet Snippet: L2, C3
    pos = consumer.originalPositionFor({ line: 3, column: 7, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 arr_object S');
    assert.equal(pos.line, 5, 'S2 arr_object L (Svelte L5)');
    assert.equal(pos.column, 5, 'S2 arr_object C (Svelte C5)');

    // Token: `filter` (method name)
    // TS: L3, C11 ('f' in `filter`)
    // Civet Snippet: L2, C7
    pos = consumer.originalPositionFor({ line: 3, column: 11, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 filter S');
    assert.equal(pos.line, 5, 'S2 filter L (Svelte L5)');
    assert.equal(pos.column, 9, 'S2 filter C (Svelte C9)');

    // Token: `n` (parameter in filter's arrow function)
    // TS: L3, C21 ('n' in `(n) =>`)
    // Civet Snippet: L2, C15
    pos = consumer.originalPositionFor({ line: 3, column: 21, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 n_filter_param S');
    assert.equal(pos.line, 5, 'S2 n_filter_param L (Svelte L5)');
    assert.equal(pos.column, 19, 'S2 n_filter_param C (Svelte C19)');

    // Token: `n` (in `n > 0`)
    // TS: L3, C27 ('n' in `n > 0`)
    // Civet Snippet: L2, C20
    pos = consumer.originalPositionFor({ line: 3, column: 27, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 n_filter_expr S');
    assert.equal(pos.line, 5, 'S2 n_filter_expr L (Svelte L5)');
    assert.equal(pos.column, 25, 'S2 n_filter_expr C (Svelte C25)');
    
    // Token: `0` (in `n > 0`)
    // TS: L3, C31 ('0')
    // Civet Snippet: L2, C24
    pos = consumer.originalPositionFor({ line: 3, column: 31, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 zero_filter S');
    assert.equal(pos.line, 5, 'S2 zero_filter L (Svelte L5)');
    assert.equal(pos.column, 28, 'S2 zero_filter C (Svelte C28)');

    // Token: `map` (method name)
    // TS: L4, C5 ('m' in `.map`)
    // Civet Snippet: L3, C4
    pos = consumer.originalPositionFor({ line: 4, column: 5, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 map S');
    assert.equal(pos.line, 6, 'S2 map L (Svelte L6)');
    assert.equal(pos.column, 9, 'S2 map C (Svelte C9)');

    // Token: `n` (parameter in map's arrow function)
    // TS: L4, C11 ('n' in `(n) =>`)
    // Civet Snippet: L3, C9
    pos = consumer.originalPositionFor({ line: 4, column: 11, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 n_map_param S');
    assert.equal(pos.line, 6, 'S2 n_map_param L (Svelte L6)');
    assert.equal(pos.column, 13, 'S2 n_map_param C (Svelte C13)');

    // Token: `n` (in `n * 2`)
    // TS: L4, C17 ('n' in `n * 2`)
    // Civet Snippet: L3, C14
    pos = consumer.originalPositionFor({ line: 4, column: 17, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 n_map_expr S');
    assert.equal(pos.line, 6, 'S2 n_map_expr L (Svelte L6)');
    assert.equal(pos.column, 19, 'S2 n_map_expr C (Svelte C19)');

    // Token: `2` (in `n * 2`)
    // TS: L4, C20 ('2')
    // Civet Snippet: L3, C18
    pos = consumer.originalPositionFor({ line: 4, column: 20, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S2 two_map S');
    assert.equal(pos.line, 6, 'S2 two_map L (Svelte L6)');
    assert.equal(pos.column, 22, 'S2 two_map C (Svelte C22)');

    consumer.destroy();
  });

  // lazer-focused-debug Advanced scenario 3: Conditional expression
  it('scenario3 - normalizes a conditional expression', async () => {
    const svelteFilePath = 'scenario3.svelte';
    // Civet L0: getStatus := (value: number): string =>
    // Civet L1:   if value > 10
    // Civet L2:     "high"
    // Civet L3:   else
    // Civet L4:     "low"
    const civetCode = `
		getStatus := (value: number): string =>
			if value > 10
				"high"
			else
				"low"
	`;
    const originalFullSvelteContent = `
<script lang="civet">
  ${civetCode}
</script>
<span>Status</span>
    `;
    const offset = 2;

    const result = compileCivet(civetCode, 'scenario3.civet');
    if (lazerFocusDebug) {
      console.log('\n--- Scenario 3: Conditional expression ---');
      console.log('Original Civet:\n', civetCode);
      console.log('Compiled TS:\n', result.code);
      console.log('Raw CivetLinesSourceMap:', JSON.stringify(result.rawMap, null, 2));
    }
    /* Compiled TS:
    const getStatus = (value: number): string => {
      if (value > 10) {
        return "high"
      }
      else {
        return "low"
      }
    }
    */

    const civetMap = result.rawMap as CivetLinesSourceMap;
    const normalized = normalizeCivetMap(
      civetMap,
      originalFullSvelteContent,
      offset,
      svelteFilePath
    );
    if (lazerFocusDebug) console.log('Normalized StandardRawSourceMap:', JSON.stringify(normalized, null, 2));

    assert.equal(normalized.version, 3);
    assert.deepStrictEqual(normalized.sources, [svelteFilePath]);

    const consumer = await new SourceMapConsumer(normalized);
    const svelteIndent = 2; // Indentation of civetCode in <script>

    // TS (1-based lines, 0-based cols for consumer input):
    // L1: (blank)
    // L2: const getStatus = (value: number): string => {
    // L3:   if (value > 10) {
    // L4:     return "high"
    // L5:   }
    // L6:   else {
    // L7:     return "low"
    // L8:   }
    // L9: }

    // Token: `getStatus`
    // TS: L2, C8 ('g' in `getStatus` on actual TS code line)
    // Civet Snippet: L1, C2 (after \t\t)
    let pos = consumer.originalPositionFor({ line: 2, column: 8, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S3 getStatus S');
    assert.equal(pos.line, 4, 'S3 getStatus L'); // Svelte L4 (offset 2 + Civet L1 + 1-based)
    assert.equal(pos.column, 4, 'S3 getStatus C'); // Svelte C4 (2 tabs + 'g')

    // Token: `value` (parameter)
    // TS: L2, C21 ('v' in `(value: number)`) // Adjusted to pick mapping at genCol=21
    // Civet Snippet: L1, C16
    pos = consumer.originalPositionFor({ line: 2, column: 21, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S3 value_param S');
    assert.equal(pos.line, 4, 'S3 value_param L'); // Svelte L4
    assert.equal(pos.column, 18, 'S3 value_param C'); // Svelte C18 (2 tabs + 14 chars + 'v')

    // Token: `value` (in `if value > 10`)
    pos = consumer.originalPositionFor({ line: 3, column: 6, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S3 value_if S');
    assert.equal(pos.line, 5, 'S3 value_if L'); // Svelte L5 (offset 2 + Civet L2 + 1-based)
    assert.equal(pos.column, 8, 'S3 value_if C'); // Svelte C8 (based on log for Gen L3C6)

    // Token: `10` (in `if value > 10`)
    pos = consumer.originalPositionFor({ line: 3, column: 14, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S3 10_if S');
    assert.equal(pos.line, 5, 'S3 10_if L'); // Svelte L5
    assert.equal(pos.column, 15, 'S3 10_if C'); // Svelte C15 (based on log for Gen L3C14)

    // Token: `"high"`
    // TS: L4, C7 ('"' in `return "high"` based on compiled output and log)
    // Civet Snippet: L3, C4 (log shows L3C2 for quote)
    pos = consumer.originalPositionFor({ line: 4, column: 7, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S3 "high" S');
    assert.equal(pos.line, 6, 'S3 "high" L'); // Svelte L6 (offset 2 + Civet L3 + 1-based)
    assert.equal(pos.column, 6, 'S3 "high" C'); // Svelte C6 (based on log for Gen L4C7)

    // Token: `"low"`
    // TS: L7, C7 ('"' in `return "low"` based on compiled output and log)
    // Civet Snippet: L5, C4 (log shows L5C2 for quote)
    pos = consumer.originalPositionFor({ line: 7, column: 7, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.equal(pos.source, svelteFilePath, 'S3 "low" S');
    assert.equal(pos.line, 8, 'S3 "low" L'); // Svelte L8 (offset 2 + Civet L5 + 1-based)
    assert.equal(pos.column, 6, 'S3 "low" C'); // Svelte C6 (based on log for Gen L7C7)

    consumer.destroy();
  });
});