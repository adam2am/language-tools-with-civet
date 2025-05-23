// import { strict as assert } from 'assert';
// import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapNormalizer';

// describe('normalizeCivetMap', () => {
//   it('applies line offset to all mappings in the raw map', async () => {
//     // Minimal fake rawMap with a single mapping
//     const rawMap = {
//       version: 3,
//       file: 'test.ts',
//       sources: ['test.civet'],
//       names: [],
//       mappings: 'AAAA', // 0,0 -> 0,0
//       sourcesContent: ['x := 1']
//     };
//     // The mapping is: generated line 1, column 0 -> original line 1, column 0
//     // Apply a line offset of 2
//     const offset = 2;
//     const normalized = await normalizeCivetMap(rawMap, offset);
//     // The mapping should now be: generated line 1, column 0 -> original line 3, column 0
//     // We'll use the source-map library to check the mapping
//     const { SourceMapConsumer } = await import('source-map');
//     const consumer = await new SourceMapConsumer(normalized);
//     const pos = consumer.originalPositionFor({ line: 1, column: 0 });
//     assert.equal(pos.line, 3);
//     assert.equal(pos.column, 0);
//     consumer.destroy();
//   });
// }); 