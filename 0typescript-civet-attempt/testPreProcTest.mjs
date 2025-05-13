// test-civet-preproces
// --- ADJUSTED IMPORT ---
// Option 1: If it's a default export -> NO
// import civetPreprocessorFactory from 'svelte-preprocessor-with-civet';
// Option 2: If it's a named export -> YES, this matches your svelte.config.js

import { sveltePreprocess as civetPreprocessorFactory } from 'svelte-preprocess-with-civet';
// Option 3: If it's a CommonJS module -> Less likely if the above ESM import works in svelte.config.js
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
// const civetPreprocessorFactory = require('svelte-preprocessor-with-civet');
// --- End of import section to adjust ---

// Configure the preprocessor as a user would: just request source maps.
// The preprocessor internally should handle sync:true and call .json() on Civet's map.
const preprocessorInstance = civetPreprocessorFactory({
    civet: { 
        sourceMap: true, 
    } 
});

let actualScriptProcessor = preprocessorInstance;
if (preprocessorInstance && typeof preprocessorInstance.script === 'function') {
    actualScriptProcessor = preprocessorInstance;
} else {
    console.warn("Warning: preprocessorInstance from svelte-preprocess-with-civet does not seem to be a Svelte PreprocessorGroup with a .script method as expected.");
}

async function runTest() {
    if (!actualScriptProcessor || typeof actualScriptProcessor.script !== 'function') {
        console.error('ERROR: Could not get a valid script processor.');
        return;
    }

    const sampleCivetInnerCode = `
        class A
          @name
          age: number
`;
    const fullScriptContent = `<script lang="civet">${sampleCivetInnerCode}</script>`;

    const mockArgs = {
        content: sampleCivetInnerCode, // Pass only the inner Civet code to the script processor
        attributes: { lang: 'civet' },
        filename: 'test.svelte', // Original filename
        markup: fullScriptContent // markup can still contain the full script context
    };

    console.log('--- Testing svelte-preprocess-with-civet (expecting V3 map from { sourceMap: true } and lang="ts" in output code) ---');
    console.log('Original Full Script Content (for context):\n', fullScriptContent);
    console.log('Input to processor.script() (content field):\n', sampleCivetInnerCode);
    console.log('\nCalling processor.script() with args (attributes will guide lang change):', JSON.stringify({ attributes: mockArgs.attributes, filename: mockArgs.filename }, null, 2));

    try {
        const result = await actualScriptProcessor.script(mockArgs);

        console.log('\n--- Preprocessor Result ---');
        if (result && typeof result.code === 'string') {
            console.log('Output Code (first 500 chars):\n', result.code.substring(0, 500));
            if (result.code.length > 500) console.log('... (code truncated)');

            if (result.code.includes('<script lang="ts">')) {
                console.log('\nSUCCESS (Code): Output code contains <script lang="ts"> as expected.');
            } else if (result.code.includes('<script')) {
                console.error(`\nERROR (Code): Output code contains a script tag, but lang attribute is not "ts". Found: ${result.code.match(/<script[^>]*>/)?.[0]}`);
            } else {
                console.error('\nERROR (Code): Output code does not seem to contain a script tag.');
            }

            if (result.code.includes('//# sourceMappingURL')) {
                console.error('\nERROR (Code): Output code UNEXPECTEDLY contains an inline source map comment.');
            } else if (result.code.includes(':=') || result.code.includes(': ->')) {
                console.warn('\nWARNING (Code): Output code still seems to contain Civet-specific syntax!');
            } else {
                console.log('\nSUCCESS (Code): Output code appears transformed and clean.');
            }

            if (result.map) {
                console.log('\nSource Map found: -> EXPECTED SUCCESS');
                if (typeof result.map === 'object' && result.map !== null) {
                    console.log('  Type: object (Correct)');
                    const keys = Object.keys(result.map);
                    console.log('  Map Object Keys:', keys.join(', '));
                    // Check for key V3 map properties
                    const hasVersion = keys.includes('version');
                    const hasSources = keys.includes('sources');
                    const hasMappings = keys.includes('mappings');
                    const hasNames = keys.includes('names'); // Optional but common
                    const hasSourcesContent = keys.includes('sourcesContent'); // Optional but common

                    if (hasVersion && result.map.version === 3 && hasSources && hasMappings) {
                        console.log('  VALIDATION: Key V3 properties (version, sources, mappings) found! Version:', result.map.version);
                    } else {
                        console.error('  VALIDATION ERROR: Missing key V3 properties or incorrect version. Version:', result.map.version);
                    }
                    // console.log('  Full Map Object:', JSON.stringify(result.map, null, 2)); // For detailed inspection
                } else {
                    console.error('  ERROR: Expected map to be an object, but got:', typeof result.map);
                }
            } else {
                console.error('\nERROR: Source Map (result.map) NOT found in preprocessor output.');
            }

        } else {
            console.error('ERROR: Preprocessor did not return a result with a "code" string property.');
            console.log('Received result:', result);
        }

        // console.log('\nFull Result Object (Processed for brevity):');
        // console.log(JSON.stringify(result, (key, value) => { /* ... truncation ... */ }, 2));

    } catch (error) {
        console.error('\n--- Preprocessor Execution Error --- ');
        console.error(error); 
    }
}

runTest();