const MagicString = require('magic-string');

// Create a MagicString instance
const ms = new MagicString('const greeting = "Hello, World!";');

// Log all methods
console.log('MagicString methods:');
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(ms))
    .filter(m => typeof ms[m] === 'function');
console.log(methods);

// Check for applySourceMap specifically
console.log('Has applySourceMap:', methods.includes('applySourceMap'));

// Check MagicString version
try {
    const pkg = require('magic-string/package.json');
    console.log('MagicString version:', pkg.version);
} catch (e) {
    console.log('Could not determine MagicString version:', e.message);
}
