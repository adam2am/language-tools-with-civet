import fs from 'fs';
import path from 'path';
import { svelte2tsx } from '../index.mjs'; // Adjusted path to point to built output
import { fileURLToPath } from 'url';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get line and column for a position in the content
function getLineAndColumn(content, offset) {
    const lines = content.substring(0, offset).split('\n');
    return {
        line: lines.length,
        column: lines[lines.length - 1].length
    };
}

async function runTest() {
    const svelteFilePath = path.resolve(
        __dirname,
        'civet-e2e.svelte' // Point to civet-e2e.svelte in the same directory
    );
    const svelteContent = fs.readFileSync(svelteFilePath, 'utf-8');

    console.log(`Processing Svelte file: ${svelteFilePath}`);

    try {
        const result = svelte2tsx(svelteContent, {
            filename: svelteFilePath,
            mode: 'ts', // Explicitly set mode to 'ts' to hit our console.logs
            isTsFile: true // Assuming Civet compiles to TS
        });

        console.log("---- Generated TSX Code ----");
        console.log(result.code);

        // Test mapping from TSX back to original Svelte
        console.log("\n---- Testing Source Map Chaining ----");
        
        // Find interesting positions to test
        const namePos = svelteContent.indexOf('name :=');
        const addExclamationPos = svelteContent.indexOf('addExclamation :=');
        const complexFunctionPos = svelteContent.indexOf('complexFunction :=');
        
        console.log(`Original positions in Svelte file:`);
        console.log(`- 'name :=' at offset ${namePos}, ${JSON.stringify(getLineAndColumn(svelteContent, namePos))}`);
        console.log(`- 'addExclamation :=' at offset ${addExclamationPos}, ${JSON.stringify(getLineAndColumn(svelteContent, addExclamationPos))}`);
        console.log(`- 'complexFunction :=' at offset ${complexFunctionPos}, ${JSON.stringify(getLineAndColumn(svelteContent, complexFunctionPos))}`);
        
        // Find corresponding positions in TSX
        const nameInTsx = result.code.indexOf('const name =');
        const addExclamationInTsx = result.code.indexOf('const addExclamation =');
        const complexFunctionInTsx = result.code.indexOf('const complexFunction =');
        
        console.log(`\nCorresponding positions in TSX file:`);
        console.log(`- 'const name =' at offset ${nameInTsx}, ${JSON.stringify(getLineAndColumn(result.code, nameInTsx))}`);
        console.log(`- 'const addExclamation =' at offset ${addExclamationInTsx}, ${JSON.stringify(getLineAndColumn(result.code, addExclamationInTsx))}`);
        console.log(`- 'const complexFunction =' at offset ${complexFunctionInTsx}, ${JSON.stringify(getLineAndColumn(result.code, complexFunctionInTsx))}`);
        
        // Test mapping from TSX back to Svelte
        const traceMap = new TraceMap(result.map);
        
        console.log(`\nMapping from TSX back to Svelte:`);
        
        const namePosTsx = getLineAndColumn(result.code, nameInTsx);
        const nameOrigPos = originalPositionFor(traceMap, { 
            line: namePosTsx.line, 
            column: namePosTsx.column 
        });
        console.log(`- 'const name =' maps to: ${JSON.stringify(nameOrigPos)}`);
        
        const addExclamationPosTsx = getLineAndColumn(result.code, addExclamationInTsx);
        const addExclamationOrigPos = originalPositionFor(traceMap, { 
            line: addExclamationPosTsx.line, 
            column: addExclamationPosTsx.column 
        });
        console.log(`- 'const addExclamation =' maps to: ${JSON.stringify(addExclamationOrigPos)}`);
        
        const complexFunctionPosTsx = getLineAndColumn(result.code, complexFunctionInTsx);
        const complexFunctionOrigPos = originalPositionFor(traceMap, { 
            line: complexFunctionPosTsx.line, 
            column: complexFunctionPosTsx.column 
        });
        console.log(`- 'const complexFunction =' maps to: ${JSON.stringify(complexFunctionOrigPos)}`);
        
        // Verify the mapping accuracy
        console.log("\n---- Mapping Accuracy ----");
        
        const nameOrigPosOffset = (nameOrigPos.line - 1) * (svelteContent.split('\n')[0].length + 1) + nameOrigPos.column;
        console.log(`- 'name' mapping accuracy: ${Math.abs(nameOrigPosOffset - namePos)} characters off`);
        
        const addExclamationOrigPosOffset = (addExclamationOrigPos.line - 1) * (svelteContent.split('\n')[0].length + 1) + addExclamationOrigPos.column;
        console.log(`- 'addExclamation' mapping accuracy: ${Math.abs(addExclamationOrigPosOffset - addExclamationPos)} characters off`);
        
        const complexFunctionOrigPosOffset = (complexFunctionOrigPos.line - 1) * (svelteContent.split('\n')[0].length + 1) + complexFunctionOrigPos.column;
        console.log(`- 'complexFunction' mapping accuracy: ${Math.abs(complexFunctionOrigPosOffset - complexFunctionPos)} characters off`);

        console.log("\n---- Test Completed ----");

    } catch (e) {
        console.error("Error during svelte2tsx processing:", e);
    }
}

runTest();
