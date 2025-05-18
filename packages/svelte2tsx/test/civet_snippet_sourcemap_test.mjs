import { compile } from '@danielx/civet';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import path from 'path';
import fs from 'fs';

console.log("---- Civet Snippet Sourcemap Test (Stage A) ----");

const civetSnippet = `
  offsetVar := 100 // Line 1 of snippet (Original Line 2)

  add := (a: number, b: number) -> // Line 3 of snippet (Original Line 4)
    sum := a + b
    sum + offsetVar // Line 5 of snippet (Original Line 6)
`;

// Virtual filename representing the context of this snippet
const virtualFilename = 'svelte://MyComponent.svelte/script1.civet';

let compiledTSCode = '';
let civetMapJson = null;
let compileError = null;

try {
  const result = compile(civetSnippet, {
    filename: virtualFilename, // Used for the 'sources' field in the map
    sourceMap: true,
    sync: true,
    js: false // Assuming TS-like output
  });
  compiledTSCode = result.code;
  if (result.sourceMap) {
    civetMapJson = result.sourceMap.json();
  }
} catch (e) {
  compileError = e;
  console.error("Civet Compilation Error:", e);
}

console.log("\n---- Original Civet Snippet ----");
console.log(civetSnippet);

console.log("\n---- Compiled TS Code ----");
console.log(compiledTSCode);

console.log("\n---- Civet-to-TS Sourcemap JSON ----");
console.log(JSON.stringify(civetMapJson, null, 2));

if (compileError) {
  console.log("\nSkipping map querying due to compilation error.");
} else if (civetMapJson) {
  console.log('\n[DEBUG] ---- Before Patch Attempt ----');
  console.log('[DEBUG] typeof civetMapJson.sources:', typeof civetMapJson.sources, '| Array.isArray:', Array.isArray(civetMapJson.sources));
  if (civetMapJson.sources) console.log('[DEBUG] civetMapJson.sources:', JSON.stringify(civetMapJson.sources));
  console.log('[DEBUG] typeof civetMapJson.sourcesContent:', typeof civetMapJson.sourcesContent, '| Array.isArray:', Array.isArray(civetMapJson.sourcesContent));
  if (civetMapJson.sourcesContent) console.log('[DEBUG] civetMapJson.sourcesContent length:', civetMapJson.sourcesContent.length);
  console.log('[DEBUG] virtualFilename:', virtualFilename);

  // Patch for sources: [null] issue
  if (
    civetMapJson.sources &&
    Array.isArray(civetMapJson.sources) &&
    civetMapJson.sources.length === 1 &&
    (civetMapJson.sources[0] === null || civetMapJson.sources[0] === undefined) &&
    civetMapJson.sourcesContent &&
    Array.isArray(civetMapJson.sourcesContent) &&
    civetMapJson.sourcesContent.length === 1
  ) {
    console.log('[DEBUG] Patch condition MET. Entering patch block.');
    civetMapJson.sources[0] = virtualFilename;
    console.log(`[DEBUG] Patched civetMapJson.sources[0] to: "${virtualFilename}"`);
    console.log('[DEBUG] After patch, civetMapJson.sources[0]:', civetMapJson.sources[0]);
  } else {
    console.log('[DEBUG] Patch condition NOT MET. Reasons:');
    if (!civetMapJson.sources) console.log('[DEBUG] - !civetMapJson.sources');
    else if (!Array.isArray(civetMapJson.sources)) console.log('[DEBUG] - civetMapJson.sources is not an array');
    else if (civetMapJson.sources.length !== 1) console.log(`[DEBUG] - civetMapJson.sources.length is ${civetMapJson.sources.length} (expected 1)`);
    else if (civetMapJson.sources[0] !== null) console.log(`[DEBUG] - civetMapJson.sources[0] is "${civetMapJson.sources[0]}" (expected null)`);
    else if (!civetMapJson.sourcesContent) console.log('[DEBUG] - !civetMapJson.sourcesContent');
    else if (!Array.isArray(civetMapJson.sourcesContent)) console.log('[DEBUG] - civetMapJson.sourcesContent is not an array');
    else if (civetMapJson.sourcesContent.length !== 1) console.log(`[DEBUG] - civetMapJson.sourcesContent.length is ${civetMapJson.sourcesContent.length} (expected 1)`);
    else console.log('[DEBUG] - Unknown reason for patch condition failure, all individual checks passed logic implies it should have met.');
  }
  console.log('[DEBUG] ---- After Patch Attempt ----');
  console.log('[DEBUG] civetMapJson.sources before new TraceMap():', JSON.stringify(civetMapJson.sources));
  // console.log('[DEBUG] Full civetMapJson before new TraceMap():', JSON.stringify(civetMapJson, null, 2)); // Optional: for very detailed inspection

  const traceMap = new TraceMap(civetMapJson);

  console.log("\n---- Querying the Civet-to-TS Map (TS -> Original Civet Snippet) ----");

  // Test points in the compiledTSCode (lines are 1-based, columns 0-based for query)
  // tsLine numbers are based on the structure of 'compiledTSCode' variable as logged.
  // expectedCivetLine is 1-based line in sourcesContent[0]
  // expectedCivetColumn is 0-based column in sourcesContent[0]
  const testPoints = [
    // `  const offsetVar = 100` is on line 2 of logged compiledTSCode block
    // `  offsetVar := 100` is on line 2 of sourcesContent[0], `offsetVar` at col 2
    { tsLine: 2, tsColumn: 8, description: "`offsetVar` in `const offsetVar = 100`", expectedCivetLine: 2, expectedCivetColumn: 2 },

    // `  const add = function(a, b) {` is on line 4 of logged compiledTSCode block
    // `  add := (a: number, b: number) ->` is on line 4 of sourcesContent[0], `add` at col 2
    { tsLine: 4, tsColumn: 8, description: "`add` in `const add = ...`", expectedCivetLine: 4, expectedCivetColumn: 2 },

    // `    const sum = a + b;` is on line 5 of logged compiledTSCode block
    // `    sum := a + b` is on line 5 of sourcesContent[0], `sum` at col 4
    { tsLine: 5, tsColumn: 10, description: "`sum` in `const sum = a + b`", expectedCivetLine: 5, expectedCivetColumn: 4 },

    // `    return sum + offsetVar;` is on line 6 of logged compiledTSCode block
    // `    sum + offsetVar` is on line 6 of sourcesContent[0], `offsetVar` at col 8
    { tsLine: 6, tsColumn: 15, description: "`offsetVar` in `sum + offsetVar`", expectedCivetLine: 6, expectedCivetColumn: 8 },
  ];

  testPoints.forEach(tp => {
    if (tp.tsLine > compiledTSCode.split('\n').length) {
        console.log(`Skipping test for "${tp.description}": tsLine ${tp.tsLine} is out of bounds for compiled code.`);
        return;
    }
    const mappedPos = originalPositionFor(traceMap, { line: tp.tsLine, column: tp.tsColumn });
    console.log(
      `Query TS Pos (L${tp.tsLine}C${tp.tsColumn}) for "${tp.description}" -> ` +
      `Mapped to Original Civet: L${mappedPos.line}C${mappedPos.column} (Source: ${mappedPos.source}, Name: ${mappedPos.name}) | ` +
      `Expected: L${tp.expectedCivetLine}C${tp.expectedCivetColumn}`
    );
    // Basic assertion visual check
    if (mappedPos.line === tp.expectedCivetLine && mappedPos.column === tp.expectedCivetColumn && mappedPos.source === virtualFilename) {
      console.log("  -> MAPPING ACCURATE (line, column, source)");
    } else {
      console.log("  -> MAPPING INACCURATE or MISMATCH");
      if (mappedPos.line !== tp.expectedCivetLine) console.log(`    Line mismatch: Got ${mappedPos.line}, Expected ${tp.expectedCivetLine}`);
      if (mappedPos.column !== tp.expectedCivetColumn) console.log(`    Column mismatch: Got ${mappedPos.column}, Expected ${tp.expectedCivetColumn}`);
      if (mappedPos.source !== virtualFilename) console.log(`    Source mismatch: Got '${mappedPos.source}', Expected '${virtualFilename}'`);
    }
  });
} else {
  console.log("\nNo Civet sourcemap generated to query.");
}

console.log("\n---- Test Complete ----");
 