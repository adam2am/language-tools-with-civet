import Civet from '@danielx/civet'; // Assuming @danielx/civet is the correct package name and it has a default export

(async () => {
  const sampleCivetCode = `
        class A
          @name
          age: number
        `;
  const compileOptions = {
    js: false, 
    inlineMap: true,
    sync: true // <--- Testing SYNCHRONOUS compilation now
  };

  console.log('--- Testing SYNC @danielx/civet compilation (TS output) with inlineMap: true, sync: true ---');
  console.log('Input Civet Code:\n', sampleCivetCode);
  console.log('\nCompile Options:', JSON.stringify(compileOptions, null, 2));

  try {
    // Testing SYNCHRONOUS compilation with sync: true
    const result = Civet.compile(sampleCivetCode, compileOptions); // No await

    console.log('\n--- Direct Civet Compilation Result (Sync) ---');
    console.log('Type of result:', typeof result);

    if (typeof result === 'string') {
      console.log('Result (string - first 500 chars):\n', result.substring(0, 500));
      if (result.length > 500) console.log('... (code truncated)');
      if (result.includes('//# sourceMappingURL=data:application/json')) {
        console.log('\nSUCCESS: Inline source map comment found in the output string!');
      } else {
        console.warn('\nWARNING: Expected an inline source map comment, but not found.');
      }
    } else if (typeof result === 'object' && result !== null) {
      console.log('Result Object Keys:', Object.keys(result).join(', '));
      console.warn('WARNING: Expected a string with inline map, but got an object.');
      if (Object.keys(result).length === 0) {
        console.warn('The result object is empty. This might indicate an issue with sync compilation or options.');
      }
       console.log('\nFull Result Object (for inspection):');
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