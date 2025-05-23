import { TraceMap, originalPositionFor, GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping';
import fs from 'fs';
import path from 'path';
import civet from '@danielx/civet';
import { decode as decodeMappings } from '@jridgewell/sourcemap-codec';

console.log('Running Civet TraceMap Query Test...');
// Final Overall Conclusions from the Micro-Test Investigation:
// Sourcemap Acquisition:
// civet.compile({ sync: true, sourceMap: true, js: false }).sourceMap.json() reliably provides a V3 sourcemap.
// The sources array in this map is initially [null]. It needs to be explicitly changed to [filename] for TraceMap to report the correct source.
// Line Mapping:
// Is accurate and reliable. TraceMap correctly maps to the 1-based line number in the sourcesContent provided in the V3 map.
// Column Mapping Precision:
// The Civet sourcemap does provide column-level information, and for many tokens (identifiers at the start of a declaration, numbers, operators, start of strings), it's precise.
// Limitations Exist:
// It does not map every individual character within strings or complex tokens. Instead, it typically maps the start (and sometimes end) of such tokens.
// For interpolations ${...}, it tends to map to the $ or the closing } rather than individual tokens inside the interpolation.
// The GREATEST_LOWER_BOUND bias for originalPositionFor is the most suitable. It finds the mapping for the start of the token containing or immediately preceding the target column. This is a standard and useful behavior.
// Is the approach "hacky" or "reliable/straightforward/scalable"?
// Not Hacky: The process of obtaining the map, correcting sources, and using TraceMap with GLB bias is a standard way to consume sourcemaps. We are interpreting the data provided by Civet.
// Reliable: Yes, for what the sourcemap contains. Line mapping is reliable. Column mapping reliably gives the start of the mapped original segment.
// Straightforward: Yes, the steps are clear.
// Scalable: Yes, this approach can be applied generally in chainSourceMaps.
// Sufficient Precision for svelte2tsx: The level of column precision, while not always character-perfect within every token, is generally good enough to point to the correct original token or its beginning. This is a significant improvement and very valuable for IDE integration and debugging.
// This micro-test has been highly successful. We've demystified Civet's sourcemap output and how to consume it effectively. We can now proceed with confidence to integrate this knowledge into the main chainSourceMaps function, expecting good line mapping and reasonably good column mapping.


// 1. Define a simple Civet snippet
// Note: Civet lines are 1-based in this comment for easier manual mapping.
// Line 1: (empty)
// Line 2: name := "world"
// Line 3: message := `Hello, ${name}!`
// Line 4: x := 123
// Line 5: y := x + 5
const civetCode = `
name := "world"
message := \`Hello, \${name}!\`
x := 123
y := x + 5
`;

// 2. Compile Civet to TypeScript with a sourcemap
let compiledResult;
let civetMapJson;

try {
    compiledResult = civet.compile(civetCode, {
        js: false, // Output TypeScript
        sourceMap: true,
        inlineMap: false,
        filename: 'test.civet',
        sync: true // Added sync: true
    });
    console.log('---- Raw Civet Compile Result ----');
    console.log(compiledResult);
    console.log('----------------------------------');
    
    civetMapJson = compiledResult.sourceMap.json();
    
    if (!civetMapJson) {
        console.error('Sourcemap object not found on compiledResult or .json() failed. Properties of sourceMap:', Object.keys(compiledResult.sourceMap));
        process.exit(1);
    }

    // Ensure sourcesContent is populated if not already, and sources has the filename
    if (civetMapJson.sources && civetMapJson.sources.length > 0 && !civetMapJson.sourcesContent) {
        civetMapJson.sourcesContent = [civetCode];
    }
    if (civetMapJson.sources && civetMapJson.sources.length > 0 && civetMapJson.sources[0] === null) {
        civetMapJson.sources[0] = 'test.civet'; // Set the source filename
    }

    console.log('\\n---- Compiled TypeScript ----');
    console.log(compiledResult.code);
    console.log('\\n---- Civet V3 Sourcemap JSON (after potential modifications) ----');
    console.log(JSON.stringify(civetMapJson, null, 2));

} catch (err) {
    console.error('Error during Civet compilation or initial map processing:', err);
    process.exit(1);
}

// --- Start of new/modified block for sources --- 
console.log('\\n---- Initial civetMapJson.sources ----');
console.log(JSON.stringify(civetMapJson ? civetMapJson.sources : 'civetMapJson is undefined'));

if (civetMapJson && civetMapJson.sources && civetMapJson.sources.length > 0 && typeof civetMapJson.sources[0] !== 'string') {
    console.log(`\\nModifying civetMapJson.sources[0] from ${JSON.stringify(civetMapJson.sources[0])} to "test.civet"`);
    civetMapJson.sources[0] = 'test.civet';
} else if (civetMapJson && civetMapJson.sources && civetMapJson.sources.length > 0 && typeof civetMapJson.sources[0] === 'string') {
    console.log('\\nSkipping sources modification, sources[0] is already a string:', civetMapJson.sources[0]);
} else {
    console.log('\\nSkipping sources modification, civetMapJson.sources is missing, empty, or civetMapJson itself is undefined.');
}

console.log('\\n---- civetMapJson.sources after attempt to modify ----');
console.log(JSON.stringify(civetMapJson ? civetMapJson.sources : 'civetMapJson is undefined'));
// --- End of new/modified block for sources ---

// Log sources right before TraceMap instantiation
console.log('\\n---- civetMapJson.sources before TraceMap ----');
console.log(JSON.stringify(civetMapJson ? civetMapJson.sources : 'civetMapJson is undefined')); 
console.log('---------------------------------------------');

// 3. Instantiate TraceMap
const traceMap = new TraceMap(civetMapJson);

// --- Add sourcemap-codec and decode mappings ---
console.log('\\n---- Decoded Civet V3 Mappings (raw segments) ----');
if (civetMapJson && civetMapJson.mappings) {
    const decodedRawMappings = decodeMappings(civetMapJson.mappings);
    // Log segments for the first few lines of generated code for brevity
    // TS Line 1 maps to original Civet code line 1, etc.
    // Decoded lines are 0-indexed, so TS Line 1 is decodedRawMappings[0]
    const numTsLinesToInspect = Math.min(decodedRawMappings.length, 7); // Inspect up to 7 TS lines
    for (let i = 0; i < numTsLinesToInspect; i++) {
        console.log(`  TS Line ${i + 1} (Original Civet Code Line ${i + 1}):`);
        if (decodedRawMappings[i] && decodedRawMappings[i].length > 0) {
            decodedRawMappings[i].forEach((segment, segIndex) => {
                console.log(`    Segment ${segIndex}: genCol=${segment[0]}, srcIdx=${segment[1]}, origLine=${segment[2]+1}, origCol=${segment[3]}${segment.length > 4 ? ", nameIdx="+segment[4] : ""}`);
            });
        } else {
            console.log('    (No segments for this line)');
        }
    }
} else {
    console.log('Could not decode mappings: civetMapJson or civetMapJson.mappings is missing.');
}
console.log('---------------------------------------------------');
// --- End of decoding ---

// Adjust tsLine in queryPoints because compiled TS has a leading newline
// Adjust expectedCivet.line to be 1-based from the start of sourcesContent (including initial blank line)
const queryPoints = [
    // Civet sourcesContent Line 2 (`name := "world"`) -> TS Line 2 (`const name = "world"`)
    { tsLine: 2, tsColumn: 6,  desc: `const [n]ame = "world";`,    expectedCivet: { line: 2, column: 0 } }, 
    { tsLine: 2, tsColumn: 13, desc: `const name = ["]world";`,   expectedCivet: { line: 2, column: 8 } }, 
    { tsLine: 2, tsColumn: 14, desc: `const name = "[w]orld";`,   expectedCivet: { line: 2, column: 9 } }, // Expects col 9, map gives 8 (start of str)

    // Civet sourcesContent Line 3 (`message := ...`) -> TS Line 3 (`const message = ...`)
    { tsLine: 3, tsColumn: 6,  desc: `const [m]essage = ...`,      expectedCivet: { line: 3, column: 0 } }, 
    { tsLine: 3, tsColumn: 24, desc: `...\`Hello, \${[n]ame}!\``,   expectedCivet: { line: 3, column: 21 } },// Expects col 21 (n), map gives 19 ($)
    { tsLine: 3, tsColumn: 30, desc: `...Hello, \${name}[\`]\``,    expectedCivet: { line: 3, column: 27 } },// Expects col 27 (`), map gives 25 (})

    // Civet sourcesContent Line 4 (`x := 123`) -> TS Line 4 (`const x = 123`)
    { tsLine: 4, tsColumn: 6, desc: `const [x] = 123;`,          expectedCivet: { line: 4, column: 0 } }, 
    { tsLine: 4, tsColumn: 10,desc: `const x = [1]23;`,          expectedCivet: { line: 4, column: 5 } }, 
    
    // Civet sourcesContent Line 5 (`y := x + 5`) -> TS Line 5 (`const y = x + 5`)
    { tsLine: 5, tsColumn: 6, desc: `const [y] = x + 5;`,          expectedCivet: { line: 5, column: 0 } }, 
    { tsLine: 5, tsColumn: 10,desc: `const y = [x] + 5;`,          expectedCivet: { line: 5, column: 5 } }, 
    { tsLine: 5, tsColumn: 14,desc: `const y = x + [5];`,          expectedCivet: { line: 5, column: 9 } }, 
];

console.log('\\n---- Querying TraceMap ----');
queryPoints.forEach(point => {
    console.log(`\\nQuerying for: ${point.desc}`);
    console.log(`  TS Target  -> Line: ${point.tsLine}, Column: ${point.tsColumn}`);
    console.log(`  Expected   -> Line: ${point.expectedCivet.line}, Column: ${point.expectedCivet.column} (Source: test.civet, 1-based line from actual code)`);

    const posInTs = { line: point.tsLine, column: point.tsColumn };

    console.log('  Bias: GREATEST_LOWER_BOUND (default):');
    const originalPosGLB = originalPositionFor(traceMap, { ...posInTs, bias: GREATEST_LOWER_BOUND });
    console.log('    -> Civet Pos:', originalPosGLB);

    console.log('  Bias: LEAST_UPPER_BOUND:');
    const originalPosLUB = originalPositionFor(traceMap, { ...posInTs, bias: LEAST_UPPER_BOUND });
    console.log('    -> Civet Pos:', originalPosLUB);
});

console.log('\\nTest completed.'); 