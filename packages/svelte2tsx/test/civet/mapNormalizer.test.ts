import { strict as assert } from 'assert';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapNormalizer';
import { SourceMapConsumer } from 'source-map';
import type { CivetLinesSourceMap, StandardRawSourceMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('normalizeCivetMap', () => {
  it('correctly applies line offset and transforms CivetLinesSourceMap to StandardRawSourceMap', async () => {
    const svelteFilePath = 'test.svelte';
    const originalFullSvelteContent = `
<script lang="civet">
  x := 1 // Civet line 0 (original snippet line)
  y := x + 2 // Civet line 1
</script>
<div>Hello</div>
    `;
    const originalCivetSnippetLineOffset_0based = 2; 

    const mockCivetMap: CivetLinesSourceMap = {
      source: '  x := 1\n  y := x + 2',
      lines: [
        [
          [0, 0, 0, 2],
          [6, 0, 0, 2],
          [10, 0, 0, 9]
        ],
        [
          [0, 0, 1, 2],
          [4, 0, 1, 2],
          [8, 0, 1, 9],
          [12, 0, 1, 13]
        ]
      ],
    };

    const normalizedMap: StandardRawSourceMap = normalizeCivetMap(
      mockCivetMap,
      originalFullSvelteContent,
      originalCivetSnippetLineOffset_0based,
      svelteFilePath
    );

    assert.equal(normalizedMap.version, 3);
    assert.deepStrictEqual(normalizedMap.sources, [svelteFilePath]);
    assert.deepStrictEqual(normalizedMap.sourcesContent, [originalFullSvelteContent]);
    assert.ok(normalizedMap.mappings.length > 0);

    const consumer = await new SourceMapConsumer(normalizedMap);

    let pos = consumer.originalPositionFor({ line: 1, column: 0 });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, 3, 'GenL1C0 Original Line for x decl');
    assert.equal(pos.column, 2, 'GenL1C0 Original Col for x decl');

    pos = consumer.originalPositionFor({ line: 1, column: 10 });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, 3, 'GenL1C10 Original Line for 1');
    assert.equal(pos.column, 9, 'GenL1C10 Original Col for 1');

    pos = consumer.originalPositionFor({ line: 2, column: 4 });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, 4, 'GenL2C4 Original Line for y');
    assert.equal(pos.column, 2, 'GenL2C4 Original Col for y');

    pos = consumer.originalPositionFor({ line: 2, column: 12 });
    assert.equal(pos.source, svelteFilePath);
    assert.equal(pos.line, 4, 'GenL2C12 Original Line for 2');
    assert.equal(pos.column, 13, 'GenL2C12 Original Col for 2');

    consumer.destroy();
  });
}); 