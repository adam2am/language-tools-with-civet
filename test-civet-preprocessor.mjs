import fs from 'fs';
import path from 'path';

// --- ADJUSTED IMPORT ---
// Option 1: If it's a default export -> NO
// import civetPreprocessorFactory from 'svelte-preprocessor-with-civet';
// Option 2: If it's a named export -> YES, this matches your svelte.config.js
import { sveltePreprocess as civetPreprocessorFactory } from 'svelte-preprocessor-with-civet';
// Option 3: If it's a CommonJS module -> Less likely if the above ESM import works in svelte.config.js
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
// const civetPreprocessorFactory = require('svelte-preprocessor-with-civet');
// --- End of import section to adjust ---

// --- ADJUSTED INSTANTIATION ---
const preprocessorInstance = civetPreprocessorFactory({
    // Options from your svelte.config.js
    civet: { sync: true }
});
// --- End of instantiation section to adjust ---

// The rest of the script (Make sure the preprocessorInstance has a `script` method...)
// should largely remain the same, as svelte-preprocess-with-civet (like svelte-preprocess)
// is expected to return a PreprocessorGroup object.
let actualScriptProcessor = preprocessorInstance;
if (preprocessorInstance && typeof preprocessorInstance.script === 'function') {
    actualScriptProcessor = preprocessorInstance; // It's likely a PreprocessorGroup
} else {
     // This block is more of a fallback, but good to have the warning if it hits.
    console.warn("Warning: preprocessorInstance from svelte-preprocess-with-civet does not seem to be a Svelte PreprocessorGroup with a .script method as expected.");
    // If sveltePreprocess directly returns the script function (unlikely for a full preprocessor)
    // you might need to do: actualScriptProcessor = { script: preprocessorInstance };
    // However, svelte-preprocess and its derivatives typically return the group object.
}

async function runTest() {
    if (!actualScriptProcessor || typeof actualScriptProcessor.script !== 'function') {
        console.error('ERROR: Could not get a valid script processor. \'actualScriptProcessor.script\' is not a function.');
        console.error('This usually means the `preprocessorInstance` was not a Svelte PreprocessorGroup object.');
        console.error('Check the import and instantiation of `svelte-preprocessor-with-civet` at the top of this script.');
        console.error('preprocessorInstance received:', preprocessorInstance);
        console.error('actualScriptProcessor derived:', actualScriptProcessor);
        return;
    }

    // --- ATTEMPT 1: Simplified Class Constructor ---
    const sampleCivetCode = `
num := 42
console.log "Number is: ", num

class MyTest
    name: string // Explicitly declare the property type if needed/supported
    constructor: (name_param) ->
        @name = name_param // Assign explicitly
        console.log "MyTest created with name: ", @name

    greet: ->
        "Hello, " + @name

instance := MyTest "Civet Tester"
console.log instance.greet()
`;
    // --- End of ATTEMPT 1 ---

    const mockArgs = {
        content: sampleCivetCode,
        attributes: { lang: 'civet' },
        filename: 'test.svelte'
    };

    console.log('--- Testing svelte-preprocessor-with-civet (Attempt 1: Simplified Constructor) ---');
    console.log('Input Civet Code:\n', sampleCivetCode);
    console.log('\\nCalling processor.script() with args:', JSON.stringify(mockArgs, null, 2));

    try {
        const result = await actualScriptProcessor.script(mockArgs);

        console.log('\\n--- Preprocessor Result ---');
        if (result && typeof result.code === 'string') {
            console.log('Output Code (first 500 chars):\n', result.code.substring(0, 500));
            if (result.code.length > 500) {
                console.log('... (code truncated)');
            }

            if (result.code.includes(':=') || result.code.includes(': ->')) { // Keep check for Civet-like arrow
                console.warn('\\nWARNING: Output code still seems to contain Civet-specific syntax!');
            } else {
                console.log('\\nSUCCESS: Output code does not appear to contain obvious Civet syntax like \':=\'.');
            }
        } else {
            console.error('ERROR: Preprocessor did not return a result with a "code" string property.');
            console.log('Received result:', result);
        }

        console.log('\\nFull Result Object:');
        console.log(JSON.stringify(result, (key, value) => {
            if ((key === 'code' || key === 'map') && typeof value === 'string' && value.length > 200) {
                return value.substring(0, 200) + '... (truncated)';
            }
            if (key === 'map' && typeof value === 'object' && value !== null) {
                return '{...map object...}';
            }
            return value;
        }, 2));

    } catch (error) {
        console.error('\\n--- Preprocessor Execution Error ---');
        console.error(error); // Log the full error object
    }
}

runTest(); 