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

// --- CORRECTED OPTIONS BASED ON FINDINGS ---
const preprocessorInstance = civetPreprocessorFactory({
    civet: { 
        sync: true,      // Keep sync: true for synchronous preprocessor operation
        inlineMap: true, // Use inlineMap: true as discovered
        // sourceMap: true, // Remove or comment out sourceMap option
    } 
});
// --- END OF CORRECTED OPTIONS ---

let actualScriptProcessor = preprocessorInstance;
if (preprocessorInstance && typeof preprocessorInstance.script === 'function') {
    actualScriptProcessor = preprocessorInstance;
} else {
    console.warn("Warning: preprocessorInstance from svelte-preprocess-with-civet does not seem to be a Svelte PreprocessorGroup with a .script method as expected.");
}

async function runTest() {
    if (!actualScriptProcessor || typeof actualScriptProcessor.script !== 'function') {
        console.error('ERROR: Could not get a valid script processor. \'actualScriptProcessor.script\' is not a function.');
        console.error('preprocessorInstance received:', preprocessorInstance);
        console.error('actualScriptProcessor derived:', actualScriptProcessor);
        return;
    }

    const sampleCivetCode = `
        class A
          @name
          age: number
`;

    const mockArgs = {
        content: sampleCivetCode,
        attributes: { lang: 'civet' },
        filename: 'test.svelte',
        markup: sampleCivetCode // For Svelte 4+ markup is typically the full file content
    };

    console.log('--- Testing svelte-preprocessor-with-civet (Using { inlineMap: true, sync: true }) ---');
    console.log('Input Civet Code:\n', sampleCivetCode);
    console.log('\nCalling processor.script() with args:', JSON.stringify(mockArgs, null, 2));

    try {
        // Preprocessor script function might be sync or async, using await for safety
        const result = await actualScriptProcessor.script(mockArgs); 

        console.log('\n--- Preprocessor Result ---');
        if (result && typeof result.code === 'string') {
            console.log('Output Code (first 500 chars):\n', result.code.substring(0, 500));
            if (result.code.length > 500) {
                console.log('... (code truncated)');
            }

            if (result.code.includes('//# sourceMappingURL=data:application/json')) {
                console.warn('\nWARNING: Output code *still* contains the inline source map comment. This suggests svelte-preprocess-with-civet might not be parsing/removing it.');
            } else if (result.code.includes(':=') || result.code.includes(': ->')) {
                console.warn('\nWARNING: Output code seems to contain Civet-specific syntax! Transformation might have failed internally.');
            } else {
                console.log('\nSUCCESS: Output code appears transformed and does not contain the inline map comment.');
            }

            // Check source map
            if (result.map) {
                console.log('\nSource Map found: -> SUCCESS?');
                if (typeof result.map === 'object') {
                    console.log('  Type: object (Correct - preprocessor likely parsed the inline map!)');
                    console.log('  Content: { ...map object... } (Keys:', Object.keys(result.map).join(', ') + ')');
                } else if (typeof result.map === 'string') {
                    console.warn('  Type: string (Incorrect - preprocessor returned the raw inline map string?)');
                    console.log('  Content (first 200 chars):', result.map.substring(0, 200) + (result.map.length > 200 ? '...' : ''));
                } else {
                    console.warn('  Type: unknown (neither string nor object)');
                }
            } else {
                console.warn('\nWARNING: Source Map (result.map) NOT found in preprocessor output even though inlineMap was requested from Civet.');
            }

        } else {
            console.error('ERROR: Preprocessor did not return a result with a "code" string property.');
            console.log('Received result:', result);
        }

        console.log('\nFull Result Object (Processed for brevity): ');
        console.log(JSON.stringify(result, (key, value) => {
            if ((key === 'code') && typeof value === 'string' && value.length > 200) {
                return value.substring(0, 200) + '... (truncated)';
            }
            if (key === 'map') {
                if (typeof value === 'string' && value.length > 100) return value.substring(0,100) + '...[string map truncated]...';
                if (typeof value === 'object' && value !== null) return '{...map object...}';
            }
            if (key === 'dependencies' && Array.isArray(value) && value.length === 0) {
                return undefined; 
            }
            return value;
        }, 2));

    } catch (error) {
        console.error('\n--- Preprocessor Execution Error --- ');
        console.error(error); 
    }
}

runTest();