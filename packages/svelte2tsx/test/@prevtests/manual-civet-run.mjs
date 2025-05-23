import fs from 'fs';
import path from 'path';
import { svelte2tsx } from '../index.mjs'; // Adjusted path to point to built output
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        // The console.logs are inside svelte2tsx, but we can log here too if needed.
        // console.log("---- svelte2tsx Raw Code Output ----");
        // console.log(result.code);
        // console.log("---- svelte2tsx Raw Map Output ----");
        // console.log(JSON.stringify(result.map, null, 2));

        console.log("---- End of manual-civet-run.mjs ----");

    } catch (e) {
        console.error("Error during svelte2tsx processing:", e);
    }
}

runTest(); 