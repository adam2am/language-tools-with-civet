// const { dirname } = require('path');
// const { join } = require('path');

// require('ts-node').register({
//     project: 'test/tsconfig.json',
//     transpileOnly: true
// });
// require('source-map-support').install();
// const glob = require('tiny-glob/sync');

// //console.clear();

// if (process.env.CI) {
//     const arr = glob('**/*.solo', { cwd: 'test' });
//     if (arr.length) throw new Error(`Forgot to remove ".solo" from test(s) ${arr}`);
// }

// const test_folders = glob('*/index.ts', { cwd: 'test' });
// const solo_folders = test_folders.filter(
//     (folder) => glob('**/*.solo', { cwd: join('test', dirname(folder)) }).length
// );

// if (solo_folders.length) {
//     solo_folders.forEach((name) => require('./' + name));
// } else {
//     test_folders.forEach((name) => require('./' + name));
// }

require('ts-node').register({
    project: 'test/tsconfig.json',
    transpileOnly: true
});
// require('source-map-support').install();

// Handle test filtering based on command-line arguments
const processArgs = process.argv.slice(2);
const isCurrentTest = processArgs.some(arg => arg.includes('#current'));
const isCivetTest = processArgs.some(arg => arg.includes('#civet'));

// Silence debug logging unless DEBUG environment variable is set
if (!process.env.DEBUG) {
    // Save original console methods
    const originalLog = console.log;
    const originalDebug = console.debug;
    
    // Filter out chainSourceMaps logs
    console.log = function(...args) {
        const message = args[0]?.toString() || '';
        if (!message.includes('[chainSourceMaps]')) {
            originalLog.apply(console, args);
        }
    };
    
    console.debug = function(...args) {
        // Suppress debug messages
    };
}

// Use different variable names to avoid conflicts
const tinyGlob = require('tiny-glob/sync');
const pathModule = require('path');

// Load tests based on filters
if (isCurrentTest || isCivetTest) {
    // Only load tests with specific tags
    const civetDir = pathModule.join(__dirname, 'civet');
    const testFiles = tinyGlob('**/*.test.ts', { cwd: civetDir });
    
    let testsRun = false;
    testFiles.forEach(file => {
        // Read the file to check if it contains the requested tag
        const fileContents = require('fs').readFileSync(pathModule.join(civetDir, file), 'utf-8');
        if ((isCurrentTest && fileContents.includes('#current')) || 
            (isCivetTest && fileContents.includes('#civet'))) {
            require(pathModule.join(civetDir, file));
            testsRun = true;
        }
    });
    
    if (!testsRun) {
        console.log(`No tests found with the specified tag: ${isCurrentTest ? '#current' : '#civet'}`);
    }
} else {
    // Load all test files in the civet directory
    const civetDir = pathModule.join(__dirname, 'civet');
    const testFiles = tinyGlob('**/*.test.ts', { cwd: civetDir });
    testFiles.forEach(file => require(pathModule.join(civetDir, file)));
}
