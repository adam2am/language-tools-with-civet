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
  export complexAdd := (a, b) -> {
    c := a + b
    // Civet comment
    d := c * 2
    return d
  }

  export const calculated = complexAdd(5, 3) // calculated should be 16

  // Object and array destructuring
  { anObject: { nestedKey }, anArray: [first, ,third] } := { anObject: { nestedKey: "ModuleValue" }, anArray: [10, 20, 30] }
  console.log nestedKey, first, third // "ModuleValue", 10, 30

  // Conditional logic
  x_mod := 10
  export message_mod := if x_mod > 5 {
    "Greater than 5 (module)"
  } else {
    "Not greater than 5 (module)"
  }
  console.log message_mod

  // Loop
  export doubled_mod := []
  for i of [1..3] {
    doubled_mod.push i * 2
  }
  console.log doubled_mod // [2, 4, 6]
</script>

<script lang="civet">
  // Instance script with complex Civet
  export let instanceVar: string = "Hello from Complex Instance Civet!"
  console.log instanceVar

  // Multi-line arrow function (instance)
  complexAddInst := (a, b) -> {
    c := a + b
    d := c * 2
    return d
  }
  calculatedInst := complexAddInst(2, 2) // Should be 8
  console.log calculatedInst

  // Conditional logic
  x_inst := 10
  message_inst := if x_inst > 5 {
    "Greater than 5 (instance)"
  } else {
    "Not greater than 5 (instance)"
  }
  console.log message_inst

  // Loop
  doubled_inst := []
  for i of [1..3] {
    doubled_inst.push i * 2
  }
  console.log doubled_inst // [2, 4, 6]

  // Another destructuring example
  { propA, propB = "defaultB" } .= { propA: "ValueA" }
  console.log propA, propB
</script>

<div>
<p>{moduleVar}</p>
<p>{calculated}</p>
  <p>{nestedKey} {first} {third}</p>
  <p>{message_mod}</p>
  <p>{doubled_mod.join(',')}</p>

  <p>{instanceVar}</p>
  <p>{calculatedInst}</p>
  <p>{message_inst}</p>
  <p>{doubled_inst.join(',')}</p>
  <p>{propA} {propB}</p>
</div>
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
            // Module Script Query Points
            // TSX Line, TSX Col, Svelte File, Svelte Line, Svelte Col (0-based), Token
            [4, 13, svelteFilePath, 3, 7, "moduleVar"],             // moduleVar :=
            [5, 12, svelteFilePath, 4, 12, "moduleVar"],            // moduleVar (in console.log)
            [8, 13, svelteFilePath, 7, 7, "complexAdd"],            // complexAdd :=
            [9, 10, svelteFilePath, 8, 4, "c"],                    // c := a + b
            [11, 10, svelteFilePath, 10, 4, "d"],                   // d := c * 2
            [12, 11, svelteFilePath, 11, 9, "d"],                   // return d
            [15, 13, svelteFilePath, 14, 13, "calculated"],          // calculated =
            [15, 24, svelteFilePath, 14, 26, "complexAdd"],        // complexAdd(5,3)
            [18, 24, svelteFilePath, 17, 7, "nestedKey"],           // nestedKey (destructured)
            [18, 38, svelteFilePath, 17, 17, "first"],             // first (destructured)
            [18, 46, svelteFilePath, 17, 26, "third"],             // third (destructured)
            [19, 12, svelteFilePath, 18, 12, "nestedKey"],         // nestedKey (in console.log)
            [19, 23, svelteFilePath, 18, 23, "first"],           // first (in console.log)
            [19, 30, svelteFilePath, 18, 30, "third"],           // third (in console.log)
            [22, 8, svelteFilePath, 22, 7, "x_mod"],               // x_mod :=
            [23, 13, svelteFilePath, 23, 7, "message_mod"],         // message_mod :=
            [23, 30, svelteFilePath, 23, 27, "x_mod"],             // x_mod (in if condition)
            [26, 12, svelteFilePath, 27, 12, "message_mod"],       // message_mod (in console.log)
            [29, 13, svelteFilePath, 30, 7, "doubled_mod"],         // doubled_mod :=
            [30, 38, svelteFilePath, 31, 7, "i"],                   // i (in for loop) - module
            [31, 4, svelteFilePath, 32, 4, "doubled_mod"],         // doubled_mod.push
            [31, 21, svelteFilePath, 32, 21, "i"],                 // i * 2 - module
            [33, 12, svelteFilePath, 34, 12, "doubled_mod"],       // doubled_mod (in console.log)

            // Instance Script Query Points (Svelte line numbers corrected)
            // TSX Line, TSX Col, Svelte File, Svelte Line (Corrected), Svelte Col (0-based), Token
            [37, 7, svelteFilePath, 40, 7, "instanceVar"],        // export let instanceVar
            [38, 12, svelteFilePath, 41, 12, "instanceVar"],       // console.log instanceVar
            [41, 8, svelteFilePath, 44, 7, "complexAddInst"],     // complexAddInst :=
            [42, 10, svelteFilePath, 45, 4, "c"],                  // c := a + b (in complexAddInst)
            [43, 10, svelteFilePath, 46, 4, "d"],                  // d := c * 2 (in complexAddInst)
            [44, 11, svelteFilePath, 47, 9, "d"],                  // return d (in complexAddInst)
            [46, 8, svelteFilePath, 49, 7, "calculatedInst"],     // calculatedInst :=
            [46, 25, svelteFilePath, 49, 24, "complexAddInst"],   // complexAddInst(2,2)
            [47, 12, svelteFilePath, 50, 12, "calculatedInst"],    // console.log calculatedInst
            [50, 8, svelteFilePath, 53, 2, "x_inst"],              // x_inst :=
            [54, 13, svelteFilePath, 54, 2, "message_inst"],       // message_inst :=
            [51, 15, svelteFilePath, 54, 19, "x_inst"],            // x_inst (in if condition)
            [55, 12, svelteFilePath, 59, 12, "message_inst"],      // console.log message_inst
            [58, 8, svelteFilePath, 62, 2, "doubled_inst"],       // doubled_inst :=
            [59, 38, svelteFilePath, 63, 7, "i"],                  // i (in for loop) - instance
            [60, 4, svelteFilePath, 64, 4, "doubled_inst"],       // doubled_inst.push
            [60, 21, svelteFilePath, 64, 21, "i"],                 // i * 2 - instance
            [62, 12, svelteFilePath, 66, 12, "doubled_inst"],      // console.log doubled_inst
            [65, 7, svelteFilePath, 69, 3, "propA"],               // propA (destructuring)
            [65, 14, svelteFilePath, 69, 10, "propB"],              // propB (destructuring)
            [66, 12, svelteFilePath, 70, 12, "propA"],             // console.log propA
            [66, 19, svelteFilePath, 70, 19, "propB"]              // console.log propB
        ];

        logContent += "\n--- Querying Final Map (Complex Test) ---\n";
        queryPoints.forEach(qp => {
            const generatedPosition = { line: qp[0], column: qp[1] }; // Query with 0-based column
            const originalPos = originalPositionFor(traceMap, generatedPosition); // Receives 1-based line, 0-based col
            
            logContent += `Querying for TSX (${svelteFilePath} generated): L${qp[0]}C${qp[1]} (Description: ${qp[5]})\n`;
            if (originalPos.source === svelteFilePath) {
                logContent += `  -> Original (${originalPos.source}): L${originalPos.line}C${originalPos.column}\n`; // originalPos has 1-based line, 0-based col
                logContent += `     Expected (Original Civet in ${qp[2]}): L${qp[3]}C${qp[4]}\n`;
                if (originalPos.line === qp[3] && originalPos.column === qp[4]) {
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