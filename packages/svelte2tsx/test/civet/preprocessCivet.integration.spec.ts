// import { strict as assert } from 'assert';
// import { preprocessCivet } from '../../src/svelte2tsx/civet/preprocessor';

// describe('preprocessCivet (integration)', () => {
//   it('processes a Svelte file with <script lang="civet"> and returns TS code and map', async () => {
//     const svelte = `
// <script lang="civet">
// foo := 123
// bar := foo + 1
// </script>
// <div>{bar}</div>
// `;
//     const filename = 'Component.svelte';
//     const result = await preprocessCivet(svelte, filename);
//     // The code should have TypeScript, not Civet
//     assert.match(result.code, /const foo = 123/);
//     assert.match(result.code, /let bar = foo \+ 1/);
//     // Should have instance metadata
//     assert.ok(result.instance);
//     assert.ok(result.instance!.map);
//     assert.equal(result.instance!.map.version, 3);
//     assert.ok(Array.isArray(result.instance!.map.sources));
//     assert.ok(typeof result.instance!.map.mappings === 'string');
//     // Should not have module metadata
//     assert.equal(result.module, undefined);
//   });

//   it('processes a Svelte file with <script context="module" lang="civet">', async () => {
//     const svelte = `
// <script context="module" lang="civet">
// exported := 42
// </script>
// <div>{exported}</div>
// `;
//     const filename = 'ModuleComponent.svelte';
//     const result = await preprocessCivet(svelte, filename);
//     // The code should have TypeScript, not Civet
//     assert.match(result.code, /const exported = 42/);
//     // Should have module metadata
//     assert.ok(result.module);
//     assert.ok(result.module!.map);
//     assert.equal(result.module!.map.version, 3);
//     assert.ok(Array.isArray(result.module!.map.sources));
//     assert.ok(typeof result.module!.map.mappings === 'string');
//     // Should not have instance metadata
//     assert.equal(result.instance, undefined);
//   });
// }); 