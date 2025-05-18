import { TraceMap, originalPositionFor, GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping';
import fs from 'fs';
import path from 'path';
import civet from '@danielx/civet';
import { decode as decodeMappings } from '@jridgewell/sourcemap-codec';

console.log('Running Civet TraceMap Query Test...');

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

// 4. Define query points (1-based line, 0-based column in generated TypeScript)
// These need to be manually verified against the *actual* Civet compiler output.
// Civet (Original) Lines are 1-based. Columns are 0-based.
// TS (Generated) Lines are 1-based. Columns are 0-based.

// Civet code reminder:
// Line 1: (empty)
// Line 2 (Original Civet Line 2): name := "world"
//   (0-indexed columns: n:0, a:1, m:2, e:3,  :4, ::5, =:6,  :7, ":8, w:9, o:10, r:11, l:12, d:13, ":14)
// Line 3 (Original Civet Line 3): message := `Hello, ${name}!`
//   (m:0, .. `:${12},H:${13}..$:${20},{:${21},n:${22},a:${23},m:${24},e:${25},}:26, !:${27}, `:${28})
// Line 4 (Original Civet Line 4): x := 123
//   (x:0,  :1, ::2, =:3,  :4, 1:5, 2:6, 3:7)
// Line 5 (Original Civet Line 5): y := x + 5
//   (y:0,  :1, ::2, =:3,  :4, x:5,  :6, +:7,  :8, 5:9)

const queryPoints = [
    // For TS: "const name = "world";" (Derived from Civet Line 2)
    { tsLine: 1, tsColumn: 6,  desc: `const [n]ame = "world";`,    expectedCivet: { line: 1, column: 0 } }, // n in name
    { tsLine: 1, tsColumn: 13, desc: `const name = ["]world";`,   expectedCivet: { line: 1, column: 8 } }, // " of "world"
    { tsLine: 1, tsColumn: 14, desc: `const name = "[w]orld";`,   expectedCivet: { line: 1, column: 9 } }, // w in "world"

    // For TS: "const message = \`Hello, \${name}!\`;" (Derived from Civet Line 3)
    { tsLine: 2, tsColumn: 6,  desc: `const [m]essage = ...`,      expectedCivet: { line: 2, column: 0 } }, // m in message
    { tsLine: 2, tsColumn: 24, desc: `...\`Hello, \${[n]ame}!\``,   expectedCivet: { line: 2, column: 22 } },// n in ${name}
    { tsLine: 2, tsColumn: 30, desc: `...Hello, \${name}[\`]\``,    expectedCivet: { line: 2, column: 28 } },// closing backtick

    // For TS: "const x = 123;" (Derived from Civet Line 4)
    { tsLine: 3, tsColumn: 6, desc: `const [x] = 123;`,          expectedCivet: { line: 3, column: 0 } }, // x in x
    { tsLine: 3, tsColumn: 10,desc: `const x = [1]23;`,          expectedCivet: { line: 3, column: 5 } }, // 1 in 123
    
    // For TS: "const y = x + 5;" (Derived from Civet Line 5)
    { tsLine: 4, tsColumn: 6, desc: `const [y] = x + 5;`,          expectedCivet: { line: 4, column: 0 } }, // y in y
    { tsLine: 4, tsColumn: 10,desc: `const y = [x] + 5;`,          expectedCivet: { line: 4, column: 5 } }, // x in x + 5
    { tsLine: 4, tsColumn: 14,desc: `const y = x + [5];`,          expectedCivet: { line: 4, column: 9 } }, // 5 in x + 5
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