import Civet from '@danielx/civet'; // Assuming @danielx/civet is the correct package name and it has a default export

(async () => {
  const sampleCivetCode = `
        class A
          @name
          age: number
        `;
  const compileOptions = {
    js: false, 
    sourceMap: true, // <--- Testing sourceMap: true now
    sync: true       // with sync: true
    // inlineMap: false // Ensure inlineMap is not interfering
  };

  console.log('--- Testing SYNC @danielx/civet compilation (TS output) with { sourceMap: true, sync: true } ---');
  console.log('Input Civet Code:\n', sampleCivetCode);
  console.log('\nCompile Options:', JSON.stringify(compileOptions, null, 2));

  try {
    const result = Civet.compile(sampleCivetCode, compileOptions); // No await, sync call

    console.log('\n--- Direct Civet Compilation Result (Sync with sourceMap: true) ---');
    console.log('Type of result:', typeof result);

    if (typeof result === 'string') {
      console.log('Result is a STRING (first 500 chars):\n', result.substring(0, 500));
      if (result.length > 500) console.log('... (code truncated)');
      if (result.includes('//# sourceMappingURL=data:application/json')) {
        console.log('INFO: String result contains an inline source map comment.');
      } else {
        console.warn('WARNING: String result does NOT contain an inline source map comment.');
      }
    } else if (typeof result === 'object' && result !== null) {
      console.log('Result is an OBJECT. Keys:', Object.keys(result).join(', '));

      if (result.code && typeof result.code === 'string') {
        console.log('  result.code (first 300 chars):\n', result.code.substring(0, 300) + (result.code.length > 300 ? '...' : ''));
      } else {
        console.warn('  WARNING: result.code is missing or not a string.');
      }

      if (result.map) {
        console.log('  SUCCESS: result.map FOUND!');
        console.log('    Type of result.map:', typeof result.map);
        if (typeof result.map === 'object') {
          console.log('    result.map keys:', Object.keys(result.map).join(', '));
        } else {
          console.log('    result.map content (first 100 chars):', String(result.map).substring(0,100) + (String(result.map).length > 100 ? '...':''));
        }
      } else {
        console.warn('  WARNING: result.map is missing.');
      }
      if (Object.keys(result).length === 0) {
          console.warn('  WARNING: The result object is empty.');
      }
       console.log('\n  Full Result Object (for inspection):');
       console.log(JSON.stringify(result, null, 2));
    } else {
      console.warn('WARNING: Result is not a string or a typical object structure.');
      console.log('Full Result:', result);
    }

  } catch (e) {
    console.error('\n--- ❌ Civet Compilation Failed ---');
    console.error(e);
  }
})(); 