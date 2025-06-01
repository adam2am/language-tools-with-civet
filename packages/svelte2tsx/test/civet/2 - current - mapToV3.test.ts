import { strict as assert } from 'assert';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapToV3';
import { SourceMapConsumer, type RawSourceMap } from 'source-map';
import type { CivetLinesSourceMap } from '../../src/svelte2tsx/utils/civetTypes';
import type { EncodedSourceMap } from '@jridgewell/gen-mapping';
import { decode } from '@jridgewell/sourcemap-codec';

describe('2 - normalizeCivetMap = converting lines to v3 (dynamic scenarios) #happy #current', () => {
  interface Scenario {
    name: string;
    civetSnippet: string;
    svelteContent: string;
    tokens: string[];
  }

  const scenarios: Scenario[] = [
    {
      name: 'dedented state and propFunc declarations',
      civetSnippet: 'value := $state(1)\npropFunc := (b: number) =>\n  number .= value * b;\n\npropFunc2 := (b: number) =>\n  number .= value * b\n',
      svelteContent: `<script lang="civet">\nvalue := $state(1)\npropFunc := (b: number) =>\n  number .= value * b;\n\npropFunc2 := (b: number) =>\n  number .= value * b\n</script>`,
      tokens: ['value', '$state', 'propFunc', 'number', 'value', 'propFunc2']
    }
  ];

  for (const { name, civetSnippet, svelteContent, tokens } of scenarios) {
    it(`should map tokens for ${name}`, async () => {
      // 1. Compile Civet snippet
      const result = compileCivet(civetSnippet, `${name}.civet`);
      assert.ok(result.rawMap && 'lines' in result.rawMap, 'Expected a CivetLinesSourceMap');

      // Log Civet input and TypeScript output for debug
      console.log(`\n--- Scenario: ${name} ---\n`);
      console.log('Civet Input:\n', civetSnippet);
      console.log('TypeScript Output:\n', result.code);

      // 2. Compute snippet offset in svelteContent
      const offset = getSnippetOffset(svelteContent, civetSnippet);

      // 3. Normalize the Civet map
      const normalized: EncodedSourceMap = normalizeCivetMap(
        result.rawMap as CivetLinesSourceMap,
        svelteContent,
        offset + 1,
        0,
        'test.svelte'
      );

      // 4. Verify the RawSourceMap structure
      assert.equal(normalized.version, 3);
      assert.deepStrictEqual(normalized.sources, ['test.svelte']);
      assert.deepStrictEqual(normalized.sourcesContent, [svelteContent]);

      // Decode the encoded v3 mappings back to segment arrays for inspection
      const decodedSegments = decode(normalized.mappings);
      console.log('Decoded V3 mapping segments per TS line:');
      decodedSegments.forEach((lineSegs, idx) => {
        const segStr = lineSegs.map(seg => `[${seg.join(',')}]`).join(' ');
        console.log(`Line ${idx + 1}: ${segStr}`);
      });

      // 5. Map tokens back using SourceMapConsumer
      const consumer = await new SourceMapConsumer(normalized as any as RawSourceMap);
      const tsLines = result.code.split('\n');
      for (const token of tokens) {
        const tsLineIndex = tsLines.findIndex(line => line.includes(token));
        assert.notEqual(tsLineIndex, -1, `Token "${token}" not found in compiled TS code`);
        const tsColIndex = tsLines[tsLineIndex].indexOf(token);
        const orig = consumer.originalPositionFor({
          line: tsLineIndex + 1,
          column: tsColIndex,
          bias: SourceMapConsumer.GREATEST_LOWER_BOUND
        });
        assert.equal(orig.source, 'test.svelte', `Source mismatch for token "${token}"`);
        assert.ok(typeof orig.line === 'number' && orig.line >= 1, `Invalid original line for token "${token}": ${orig.line}`);
        assert.ok(typeof orig.column === 'number' && orig.column >= 0, `Invalid original column for token "${token}": ${orig.column}`);
      }
      consumer.destroy();
    });
  }
});

/**
 * Compute the 0-based line offset where the first significant Civet snippet line appears in the Svelte content.
 */
function getSnippetOffset(full: string, snippet: string): number {
  const fullLines = full.split('\n');
  const snippetLines = snippet.split('\n').filter(l => l.trim() !== '');
  if (!snippetLines.length) return 0;
  const firstLine = snippetLines[0].trim();
  const idx = fullLines.findIndex(line => line.trim() === firstLine);
  return idx >= 0 ? idx : 0;
}