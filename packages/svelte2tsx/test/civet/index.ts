// import { strict as assert } from 'assert';
// import { compileCivet } from '../../src/svelte2tsx/utils/civetCompiler';

// describe('compileCivet', () => {
//   it('compiles Civet code to TypeScript and returns a raw sourcemap', async () => {
//     const civetCode =`
//     x := 42
//     y := x + 1
//     `;
//     const filename = 'TestCivetFile.civet';
//     const result = await compileCivet(civetCode, filename);

//     // Check TypeScript code output
//     assert.match(result.code, /const x = 42/);
//     assert.match(result.code, /let y = x \+ 1/);

//     // Check rawMap shape
//     const map = result.rawMap;
//     assert.equal(map.version, 3);
//     assert.ok(Array.isArray(map.sources));
//     assert.ok(typeof map.mappings === 'string');
//     assert.ok(map.sources.includes(filename));
//   });
// }); 