import fs from 'fs';
import path from 'path';
import { svelte2tsx } from '../index.mjs'; // Assuming .js extension after build
import { TraceMap, originalPositionFor, GREATEST_LOWER_BOUND, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Running Stage B Chaining Test...');

const svelteComponentContent = `
<script context="module" lang="civet">
  moduleVar := "Hello from Module Civet!"
  console.log moduleVar
  // Civet Line 3 in module script (original)
  add := (a, b) -> a + b 
  export const c = add(10, 20) 
</script>

<script lang="civet">
  // Civet Line 1 in instance script (original)
  instanceVar := "Hello from Instance Civet!"
  console.log instanceVar 
  // Civet Line 3 in instance script (original)
  x := 1; y := 2 
  z := x + y
  console.log z
</script>

<h1>Test Component</h1>
<p>{instanceVar}</p>
<p>{moduleVar}</p>
<p>{c}</p>
`;

const svelteFilePath = 'test-stage-b-component.svelte'; // Virtual filename for svelte2tsx

async function runTest() {
    try {
        const { code: tsxCode, map: finalMapJson } = svelte2tsx(svelteComponentContent, {
            filename: svelteFilePath,
            isTsFile: true // To get TS-like output
        });

        const outputDir = path.join(__dirname, 'stage_b_output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const tsxFilePath = path.join(outputDir, 'test-component.stage-b.tsx');
        const mapFilePath = path.join(outputDir, 'test-component.stage-b.tsx.map');
        const logFilePath = path.join(outputDir, 'stage-b-chaining-test.log');

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
        
        // Ensure sourcesContent is present for TraceMap, svelte2tsx should provide it for the svelteFilePath
        if (!finalMapJson.sourcesContent || !finalMapJson.sourcesContent[0]) {
            // If svelte2tsx's own map doesn't have sourcesContent for the svelte file, try to add it.
            // This is a fallback; ideally svelte2tsx's `finalMap` from str.generateMap() includes it.
            // For maps generated from `svelteContentForProcessing`, its `sourcesContent` should be that string.
            if (finalMapJson.sources && finalMapJson.sources.includes(svelteFilePath)) {
                 // svelteContentForProcessing is not available in this scope.
                 // finalMapJson.sourcesContent = [svelteContentForProcessing]; 
                 logContent += "WARNING: finalMapJson.sourcesContent was missing or empty. It was NOT populated here as svelteContentForProcessing is out of scope.\n";
            } else {
                logContent += "ERROR: finalMapJson.sourcesContent is missing, and source file not found in finalMapJson.sources to populate it.\n";
                fs.writeFileSync(logFilePath, logContent);
                console.error('Test failed: finalMapJson.sourcesContent is missing.');
                return;
            }
        }


        const traceMap = new TraceMap(finalMapJson);

        // Define query points: { line: <1-based TSX line>, column: <0-based TSX column>, description: "...", expected: { line: <1-based original mapping line>, column: <0-based mapping column>, scriptType: "module" | "instance" }}
        const queryPoints = [
            // Module Script Queries
            { tsxLine: 4, tsxColumn: 14, description: "moduleVar in 'console.log(moduleVar)'", expected: { line: 4, column: 13, scriptType: "module" } },
            { tsxLine: 7, tsxColumn: 19, description: "add in 'add(10, 20)'", expected: { line: 7, column: 19, scriptType: "module" } },

            // Instance Script Queries
            { tsxLine: 12, tsxColumn: 14, description: "instanceVar in 'console.log(instanceVar)'", expected: { line: 13, column: 13, scriptType: "instance" } },
            { tsxLine: 14, tsxColumn: 8,  description: "x in 'const x = 1'", expected: { line: 15, column: 2, scriptType: "instance" } },
            { tsxLine: 14, tsxColumn: 21, description: "y in 'const y = 2'", expected: { line: 15, column: 10, scriptType: "instance" } },
            { tsxLine: 16, tsxColumn: 14, description: "z in 'console.log(z)'", expected: { line: 17, column: 13, scriptType: "instance" } }
        ];

        logContent += "\n--- Querying Final Map ---\n";
        queryPoints.forEach(qp => {
            const generatedPosition = { line: qp.tsxLine, column: qp.tsxColumn };
            const originalPos = originalPositionFor(traceMap, generatedPosition);
            
            logContent += `Querying for TSX (${svelteFilePath} generated): L${qp.tsxLine}C${qp.tsxColumn} (Description: ${qp.description})\n`;
            if (originalPos.source === svelteFilePath) { // We expect it to map back to the .svelte file
                logContent += `  -> Original (${originalPos.source}): L${originalPos.line}C${originalPos.column}\n`;
                logContent += `     Expected (Original Civet in ${qp.expected.scriptType}): L${qp.expected.line}C${qp.expected.column}\n`;
                // Basic check (can be made more strict)
                if (originalPos.line === qp.expected.line && originalPos.column === qp.expected.column) {
                    logContent += "     Status: MATCH!\n";
                } else {
                    logContent += "     Status: MISMATCH!\n";
                }
            } else {
                logContent += `  -> Original Mapped to UNEXPECTED source: ${originalPos.source}, L${originalPos.line}C${originalPos.column}\n`;
                 logContent += "     Status: UNEXPECTED SOURCE!\n";
            }
            logContent += '\n';
        });

        fs.writeFileSync(logFilePath, logContent);
        console.log(`Test output written to ${logFilePath}, ${tsxFilePath}, ${mapFilePath}`);
        console.log(`PLEASE INSPECT ${tsxFilePath} AND UPDATE queryPoints in stage_b_chaining_test.mjs with correct TSX line/column numbers, then re-run.`);

    } catch (error) {
        console.error('Error during Stage B chaining test:', error);
        const logFilePath = path.join(__dirname, 'stage_b_output', 'stage-b-chaining-test.ERROR.log');
        fs.writeFileSync(logFilePath, `Error: ${error.stack}`);
    }
}

runTest(); 