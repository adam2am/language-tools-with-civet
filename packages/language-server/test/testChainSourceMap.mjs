#!/usr/bin/env node
import { svelte2tsx } from 'svelte2tsx';
import { parse } from 'svelte/compiler';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
// No direct import of civet preprocessor needed if svelte2tsx handles it.

function getLineCol(code, idx) {
  const lines = code.slice(0, idx).split('\n');
  return { line: lines.length - 1, column: lines[lines.length - 1].length };
}

async function run() {
  const originalSvelteContent = `<script lang="civet">\nfoo := "bar";\n</script>`;
  console.log('Original Svelte with Civet block:', originalSvelteContent);

  // Step 1: Svelte2TSX processes Svelte file with Civet block
  // svelte2tsx should handle the Civet transformation internally
  const svelte2tsxResult = svelte2tsx(originalSvelteContent, {
    parse,
    version: '3.59.2', // Or a version that supports your svelte2tsx features
    filename: 'test.svelte', // Important for sourcemap source reference
    isTsFile: false, 
    mode: 'ts',
    typingsNamespace: 'svelteHTML',
    emitOnTemplateError: false,
    namespace: undefined,
    accessors: undefined
  });

  const tsxCode = svelte2tsxResult.code;
  const chainedMap = svelte2tsxResult.map;

  console.log('\nGenerated TSX by svelte2tsx (first 300 chars):\n', tsxCode.substring(0, 300));

  if (!chainedMap || typeof chainedMap.version === 'undefined') {
    console.error('Error: Chained map from svelte2tsx is missing or invalid.', chainedMap);
    // Log more details about the map if it exists but is invalid
    if (chainedMap) console.error('Invalid map details:', JSON.stringify(chainedMap));
    process.exit(1);
  }
  console.log('\nSources in chainedMap from svelte2tsx:', chainedMap.sources);
  console.log('File property in chainedMap:', chainedMap.file);


  // Step 2: Find position of 'foo' in the final TSX code
  // Need to be careful: 'foo' might appear in comments or boilerplate.
  // Let's target 'const foo = "bar"' or similar generated TS/JS from Civet.
  // A more robust way would be to find 'foo' that is part of an identifier or variable declaration.
  const targetTsCodeSnippet = 'const foo = "bar"'; // Adjust if Civet output is different
  let idxFooInTsx = tsxCode.indexOf(targetTsCodeSnippet);
  if (idxFooInTsx !== -1) {
    idxFooInTsx += "const ".length; // Move to the start of 'foo'
  } else {
     // Fallback if the exact snippet isn't found, less reliable
    idxFooInTsx = tsxCode.indexOf('foo');
  }

  if (idxFooInTsx === -1) {
    console.error(`Could not find "foo" (from '${targetTsCodeSnippet}' or fallback) in the final TSX code`);
    console.error("Full TSX Code:\n", tsxCode);
    process.exit(1);
  }
  const posInTsx = getLineCol(tsxCode, idxFooInTsx);
  console.log(`\nPosition of 'foo' in TSX: line ${posInTsx.line}, column ${posInTsx.column}`);

  // Step 3: Map TSX → Original Svelte (Civet)
  // The trace-map library expects 1-based line numbers.
  const originalPosition = originalPositionFor(
    new TraceMap(chainedMap),
    { line: posInTsx.line + 1, column: posInTsx.column }
  );

  console.log(
    `\nMapped back from TSX to Original: line ${originalPosition.line}, column ${originalPosition.column}, source: ${originalPosition.source}`
  );

  // Verification:
  // originalSvelteContent is:
  // 0: <script lang="civet">
  // 1: foo := "bar";
  // 2: </script>
  // 'f' in 'foo' is at line 1 (0-indexed) of originalSvelteContent, character 0.
  // Sourcemap lines are 1-based. So, we expect line 2, column 0.
  const expectedLineInSourceFile = 2; 
  const expectedColumnInSourceFile = 0; 

  // Check if the source in the map matches our input filename
  // svelte2tsx's map.sources might be relative or just the filename.
  // The 'source' from originalPositionFor should correspond to one of these.
  let sourceFileCorrect = false;
  if (originalPosition.source) {
    sourceFileCorrect = originalPosition.source.includes('test.svelte');
  }


  if (originalPosition.line === expectedLineInSourceFile && originalPosition.column === expectedColumnInSourceFile && sourceFileCorrect) {
    console.log('\nSUCCESS: Mapping from TSX back to original Civet position and source file is correct!');
  } else {
    console.error(
      `\nFAILURE: Mapping is incorrect.`+
      `\nExpected: line ${expectedLineInSourceFile}, col ${expectedColumnInSourceFile} in a 'test.svelte' source` +
      `\nGot:      line ${originalPosition.line}, col ${originalPosition.column} in source '${originalPosition.source}'`
    );
    process.exit(1);
  }
}

run().catch(e => {
  console.error('Error in chain test:', e);
  process.exit(1);
}); 