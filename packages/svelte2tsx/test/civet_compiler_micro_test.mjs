import { compile } from '@danielx/civet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const civetCode = `
name := "World"
addExclamation := (text: string) -> text + "!"

function foo()
    foo := "bar"

message := addExclamation name
`;

const svelteFilePath = 'test.civet'; // Virtual filename for sourcemap
let generatedJS = '';
let sourcemapJsonString = '';
let errorOutput = '';

try {
    const result = compile(civetCode, {
        filename: svelteFilePath,
        sync: true,
        sourceMap: true,
        js: false // Assuming we want TS-like output if applicable, or just JS
    });
    generatedJS = result.code;
    if (result.sourceMap) {
        sourcemapJsonString = JSON.stringify(result.sourceMap.json(), null, 2);
    } else {
        sourcemapJsonString = "No sourcemap generated.";
    }
} catch (e) {
    errorOutput = "Error during Civet compilation: " + (e instanceof Error ? e.message : String(e));
    console.error(errorOutput);
}

const logFilePath = path.resolve(__dirname, 'civet_compiler_output.log');

let outputContent = `---- Civet Code Input ----
${civetCode}

---- Generated JavaScript/TypeScript ----
${generatedJS}

---- Raw Civet Sourcemap JSON ----
${sourcemapJsonString}
`;

if (errorOutput) {
    outputContent += `

---- Compilation Error ----
${errorOutput}
`;
}

fs.writeFileSync(logFilePath, outputContent);

console.log(`Civet compiler micro test complete. Output written to: ${logFilePath}`); 