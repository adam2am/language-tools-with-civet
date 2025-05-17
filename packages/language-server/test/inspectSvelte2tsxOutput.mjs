import { svelte2tsx } from '../../svelte2tsx/index.mjs'; // Adjusted path
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url'; // Import for ES module __dirname equivalent

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixtureFileName = 'arrow-template.svelte';
const svelteFilePath = path.join(
    __dirname, // Now correctly defined for ES module
    'plugins/typescript/civet-features/fixtures/hover',
    fixtureFileName
);

console.log(`Processing Svelte file: ${svelteFilePath}`);

let svelteContent;
try {
    svelteContent = fs.readFileSync(svelteFilePath, 'utf-8');
} catch (e) {
    console.error(`Error reading Svelte file ${svelteFilePath}:`, e);
    process.exit(1);
}

console.log('\n--- Original Svelte Content ---');
console.log(svelteContent);

const options = {
    filename: svelteFilePath, // svelte2tsx expects a filename for sourcemap generation
    // Add other necessary options if discovered (e.g., svelte version, strict mode)
};

let svelte2tsxResult;
try {
    svelte2tsxResult = svelte2tsx(svelteContent, options);
} catch (e) {
    console.error('Error during svelte2tsx processing:', e);
    process.exit(1);
}

console.log('\n\n--- Generated TSX Code ---');
console.log(svelte2tsxResult.code);

console.log('\n\n--- Generated Sourcemap (JSON) ---');
console.log(JSON.stringify(svelte2tsxResult.map, null, 2));

console.log('\n\n--- Sourcemap Mappings (decoded) ---');
// Basic VLQ decoding for demonstration might be too complex here.
// We can paste the JSON into a visualizer like https://sokra.github.io/source-map-visualization/
// Or use a library like 'source-map' to parse and iterate mappings if needed later.
console.log('To inspect mappings, copy the JSON above and use a sourcemap visualizer like https://sokra.github.io/source-map-visualization/');

console.log('\n\nInspection script finished.'); 