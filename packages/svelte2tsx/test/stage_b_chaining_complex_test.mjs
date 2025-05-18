import fs from 'fs';
import path from 'path';
import { svelte2tsx } from '../index.mjs'; // Assuming .js extension after build
import { TraceMap, originalPositionFor, GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping';
import { fileURLToPath } from 'url';
import util from 'util'; // For redirecting console

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures'); // Define fixturesDir

// --- Redirect console output to a debug file ---
const debugLogPath = path.join(__dirname, 'stage_b_output', 'complex_test_console.debug.log');
// Clear the debug log file at the start of each test run
if (fs.existsSync(debugLogPath)) {
    fs.unlinkSync(debugLogPath);
}
const debugLogStream = fs.createWriteStream(debugLogPath, { flags: 'a' });
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
    debugLogStream.write(util.format(...args) + '\n');
    originalConsoleLog.apply(console, args); // Also log to original stdout for live feedback if needed
};
console.error = (...args) => {
    debugLogStream.write('ERROR: ' + util.format(...args) + '\n');
    originalConsoleError.apply(console, args);
};
console.warn = (...args) => {
    debugLogStream.write('WARN: ' + util.format(...args) + '\n');
    originalConsoleWarn.apply(console, args);
};
// --- End console output redirection ---

console.log('Running Stage B Complex Chaining Test (with console debug log to:', debugLogPath, ')...');

const svelteComponentContent = `
<script context="module" lang="civet">
  // Module script with complex Civet
  export moduleVar := "Hello from Complex Module Civet!"
  console.log moduleVar

  // Multi-line arrow function
  export complexAdd := (a, b) ->
    c := a + b
    // Civet comment
    d := c * 2
    return d

  export const calculated = complexAdd(5, 3) // calculated should be 16

  // Object and array destructuring
  { anObject: { nestedKey }, anArray: [first, ,third] } := { anObject: { nestedKey: "ModuleValue" }, anArray: [10, 20, 30] }
  console.log nestedKey, first, third // "ModuleValue", 10, 30
</script>

<script lang="civet">
  // Instance script with complex Civet
  instanceVar := "Hello from Complex Instance Civet!"
  console.log instanceVar

  // Conditional logic
  x := 10
  message := if x > 5
    "Greater than 5"
  else
    "Not greater than 5"
  console.log message

  // Loop
  doubled := []
  for i of [1..3]
    doubled.push i * 2
  console.log doubled // [2, 4, 6]

  // Another destructuring example
  { propA, propB = "defaultB" } .= { propA: "ValueA" }
  console.log propA, propB
</script>

<h1>Complex Test Component</h1>
<p>{instanceVar}</p>
<p>{moduleVar}</p>
<p>{calculated}</p>
<p>Nested: {nestedKey}, First: {first}, Third: {third}</p>
<p>Message: {message}</p>
<p>Doubled: {doubled.join(', ')}</p>
<p>Props: {propA}, {propB}</p>
`;

const svelteFilePath = 'test-stage-b-complex-component.svelte'; // Virtual filename

async function runTest() {
    try {
        const { code: tsxCode, map: finalMapJson } = svelte2tsx(svelteComponentContent, {
            filename: svelteFilePath,
            isTsFile: true
        });

        const outputDir = path.join(__dirname, 'stage_b_output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const tsxFilePath = path.join(outputDir, 'test-component.stage-b-complex.tsx');
        const mapFilePath = path.join(outputDir, 'test-component.stage-b-complex.tsx.map');
        const logFilePath = path.join(outputDir, 'stage-b-chaining-complex-test.log');

        fs.writeFileSync(tsxFilePath, tsxCode);
        fs.writeFileSync(mapFilePath, JSON.stringify(finalMapJson, null, 2));

        let logContent = `== Original Svelte Component (${svelteFilePath}) ==\n`;
        logContent += svelteComponentContent + '\n\n';
        logContent += '== Generated TSX Code ==\n';
        logContent += tsxCode + '\n\n';
        logContent += '== Final V3 SourceMap JSON ==\n';
        logContent += JSON.stringify(finalMapJson, null, 2) + '\n\n';
        logContent += '== Sourcemap Query Results (TSX -> Original Civet) ==\n';

        if (!finalMapJson) {
            logContent += 'ERROR: No finalMapJson produced by svelte2tsx.\n';
            fs.writeFileSync(logFilePath, logContent);
            console.error('Test failed: No finalMapJson produced.');
            return;
        }
        
        if (!finalMapJson.sourcesContent || !finalMapJson.sourcesContent[0]) {
            if (finalMapJson.sources && finalMapJson.sources.includes(svelteFilePath)) {
                 logContent += "WARNING: finalMapJson.sourcesContent was missing or empty. It was NOT populated here as svelteContentForProcessing is out of scope.\n";
            } else {
                logContent += "ERROR: finalMapJson.sourcesContent is missing, and source file not found in finalMapJson.sources to populate it.\n";
                fs.writeFileSync(logFilePath, logContent);
                console.error('Test failed: finalMapJson.sourcesContent is missing.');
                return;
            }
        }

        const traceMap = new TraceMap(finalMapJson);

        // IMPORTANT: TSX Line/Column numbers below are ESTIMATES. 
        // They MUST be updated after inspecting the generated test-component.stage-b-complex.tsx
        const queryPoints = [
            // Module Script Queries
            // Original Civet: moduleVar := "Hello from Complex Module Civet!" (Svelte File Line 3, `moduleVar` at col 9)
            { tsxLine: 4, tsxColumn: 13, description: "moduleVar in definition", expected: { sourceFile: "test-stage-b-complex-component.svelte", line: 3, column: 9, scriptType: "module" } }, 
            // Original Civet: c := a + b (Svelte File Line 8, `c` at col 4)
            { tsxLine: 9, tsxColumn: 10, description: "c in 'c := a + b'", expected: { sourceFile: "test-stage-b-complex-component.svelte", line: 8, column: 4, scriptType: "module" } },
            // Original Civet: return d (Svelte File Line 11, `d` at col 11)
            { tsxLine: 12, tsxColumn: 11, description: "d in 'return d'", expected: { sourceFile: "test-stage-b-complex-component.svelte", line: 11, column: 11, scriptType: "module" } },
            // Original Civet: export const calculated = complexAdd(5, 3) (Svelte File Line 13, 'complexAdd' token @ C23)
            { tsxLine: 15, tsxColumn: 25, description: "complexAdd in call", expected: { line: 13, column: 23, scriptType: "module" } },
            // Original Civet: { anObject: { nestedKey }, ... } := ... (Svelte File Line 16, 'nestedKey' on LHS @ C15)
            { tsxLine: 18, tsxColumn: 25, description: "nestedKey in module destructuring", expected: { line: 16, column: 15, scriptType: "module" } },
            // Original Civet: console.log nestedKey (Svelte File Line 17, 'nestedKey' token @ C14)
            { tsxLine: 19, tsxColumn: 12, description: "nestedKey in module console.log", expected: { line: 17, column: 14, scriptType: "module" } },
            
            // Instance Script Queries
            // Original Civet: instanceVar := "Hello from Complex Instance Civet!" (Svelte File Line 22, `instanceVar` at col 2)
            { tsxLine: 22, tsxColumn: 8, description: "instanceVar in definition", expected: { sourceFile: "test-stage-b-complex-component.svelte", line: 22, column: 2, scriptType: "instance" } },
            // Original Civet: message := if x > 5 (Svelte File Line 26, `message` at col 2)
            { tsxLine: 31, tsxColumn: 8, description: "message in conditional assign", expected: { line: 26, column: 2, scriptType: "instance" } },
            // Original Civet: "Greater than 5" (Svelte File Line 27, string at col 4)
            { tsxLine: 28, tsxColumn: 10, description: "string 'Greater than 5'", expected: { line: 27, column: 4, scriptType: "instance" } },
            // Original Civet: doubled.push i * 2 (Svelte File Line 34, 'doubled' token @ C4)
            { tsxLine: 36, tsxColumn: 4, description: "doubled in loop", expected: { line: 34, column: 4, scriptType: "instance" } },
            // Original Civet: for i of [1..3] (Svelte File Line 33, 'i' token @ C6) - TSX: for (const i of [1, 2, 3]) { (i @ C17 if 'of' works)
            // TSX with original for...in: for (const i in [1, 2, 3]) { (i @ C16)
            { tsxLine: 35, tsxColumn: 17, description: "loop variable i", expected: { line: 33, column: 6, scriptType: "instance" } }, // Assuming 'for...of' generates `i` at column 17
            // Original Civet: { propA, propB = "defaultB" } .= { propA: "ValueA" } (Svelte L38, 'propA' in {propA:"ValueA"} @ C28)
            { tsxLine: 41, tsxColumn: 38, description: "propA in instance destructuring RHS", expected: { line: 38, column: 28, scriptType: "instance" } },
             // Original Civet: console.log propA (Svelte L39, 'propA' token @ C14)
            { tsxLine: 42, tsxColumn: 12, description: "propA in instance console.log", expected: { line: 39, column: 14, scriptType: "instance" } }
        ];

        logContent += "\n--- Querying Final Map (Complex Test) ---\n";
        queryPoints.forEach(qp => {
            const generatedPosition = { line: qp.tsxLine, column: qp.tsxColumn }; // Query with 0-based column
            const originalPos = originalPositionFor(traceMap, generatedPosition); // Receives 1-based line, 0-based col
            
            logContent += `Querying for TSX (${svelteFilePath} generated): L${qp.tsxLine}C${qp.tsxColumn} (Description: ${qp.description})\n`;
            if (originalPos.source === svelteFilePath) {
                logContent += `  -> Original (${originalPos.source}): L${originalPos.line}C${originalPos.column}\n`; // originalPos has 1-based line, 0-based col
                logContent += `     Expected (Original Civet in ${qp.expected.scriptType}): L${qp.expected.line}C${qp.expected.column}\n`;
                if (originalPos.line === qp.expected.line && originalPos.column === qp.expected.column) {
                    logContent += "     Status: MATCH!\n";
                } else {
                    logContent += "     Status: MISMATCH! (Line or Column)\n";
                }
            } else {
                logContent += `  -> Original Mapped to UNEXPECTED source: ${originalPos.source}, L${originalPos.line}C${originalPos.column}\n`;
                logContent += "     Status: UNEXPECTED SOURCE!\n";
            }
            logContent += '\n';
        });

        fs.writeFileSync(logFilePath, logContent);
        console.log(`Complex test output written to ${logFilePath}, ${tsxFilePath}, ${mapFilePath}`);
        console.log(`PLEASE INSPECT ${tsxFilePath} AND UPDATE queryPoints in stage_b_chaining_complex_test.mjs with correct TSX line/column numbers, then re-run.`);

    } catch (error) {
        console.error('Error during Stage B complex chaining test:', error);
        const logFilePath = path.join(__dirname, 'stage_b_output', 'stage-b-chaining-complex-test.ERROR.log');
        fs.writeFileSync(logFilePath, `Error: ${error.stack}`);
    }
}

async function testMinimalCivetInstanceSourcemap() {
    const svelteFilePath = path.join(fixturesDir, 'test-minimal-civet-instance.svelte');
    const svelteComponentContent = fs.readFileSync(svelteFilePath, 'utf-8');

    console.log(`\n--- Running svelte2tsx for Minimal Civet Instance Test: ${svelteFilePath} ---\n`);

    try {
        const result = svelte2tsx(svelteComponentContent, {
            filename: svelteFilePath,
            isTsFile: true, // Assuming we want TS output features
            mode: 'ts',
            svelte5Plus: true, // Or false, depending on what svelte version features you are testing
        });

        // For this test, we are primarily interested in the console logs from svelte2tsx/index.ts
        // No assertions needed here for query points yet.
        console.log('[MinimalCivetInstanceTest] svelte2tsx processing completed.');
        if (result.code) {
            console.log('[MinimalCivetInstanceTest] Generated TSX code snippet (first 300 chars):');
            console.log(result.code.substring(0,300) + '...');
        }
        if (result.map) {
            console.log('[MinimalCivetInstanceTest] Generated final sourcemap (summary):');
            console.log(`  Sources: ${result.map.sources}`);
            console.log(`  Mappings length: ${result.map.mappings.length}`);
        }

    } catch (e) {
        console.error('[MinimalCivetInstanceTest] Error during svelte2tsx processing:', e);
    }
    console.log(`\n--- Minimal Civet Instance Test for ${svelteFilePath} Finished ---\n`);
}

async function main() {
    await runTest();
    await testMinimalCivetInstanceSourcemap();
}

main().catch(console.error); 