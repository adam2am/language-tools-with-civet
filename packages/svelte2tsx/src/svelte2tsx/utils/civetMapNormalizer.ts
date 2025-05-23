import { SourceMapGenerator, RawSourceMap } from 'source-map';
// Explicitly import the synchronous BasicSourceMapConsumer
import { BasicSourceMapConsumer } from 'source-map/lib/source-map-consumer';

/**
 * Normalize a raw Civet sourcemap (from Civet snippet -> TS snippet)
 * to be a map from Original Svelte File -> TS snippet.
 *
 * @param rawMap The raw V3 sourcemap from `civet.compile()`.
 * @param originalFullSvelteContent The full content of the original .svelte file.
 * @param originalCivetSnippetLineOffset_0based 0-based line number where the civet snippet started in the .svelte file.
 * @returns A RawSourceMap that maps from the original .svelte file to the compiled TS snippet.
 */
export function normalizeCivetMap(
  rawMap: RawSourceMap,
  originalFullSvelteContent: string,
  originalCivetSnippetLineOffset_0based: number
): RawSourceMap {
  // Determine the source path (should be the .svelte file) from the raw Civet map
  const svelteFilePath = rawMap.sources && rawMap.sources.length > 0 && rawMap.sources[0] 
    ? rawMap.sources[0] 
    : (rawMap.file || 'unknown.svelte');

  const generator = new SourceMapGenerator({ file: rawMap.file || svelteFilePath });

  // Set the source content for the .svelte file
  // This ensures the output map refers to the full original Svelte content.
  generator.setSourceContent(svelteFilePath, originalFullSvelteContent);

  const consumer = new BasicSourceMapConsumer(rawMap);

  consumer.eachMapping((m) => {
    if (m.originalLine == null || m.source == null) return;

    // m.originalLine is 0-indexed relative to the Civet snippet content.
    // Adjust to be 1-indexed relative to the start of the original .svelte file.
    const finalOriginalLine_1based = m.originalLine + originalCivetSnippetLineOffset_0based + 1;

    generator.addMapping({
      // All original positions are from the svelteFilePath
      source: svelteFilePath,
      original: {
        line: finalOriginalLine_1based,
        column: m.originalColumn // 0-indexed column in original .svelte file
      },
      generated: {
        // civet.compile's sourcemap provides 1-based generatedLine for its output TS.
        // SourceMapGenerator also expects 1-based generated line.
        line: m.generatedLine,
        column: m.generatedColumn // 0-indexed column in generated TS snippet
      },
      name: m.name
    });
  });
  consumer.destroy();

  const outputMap = generator.toJSON();

  // The generator, having been given svelteFilePath via `setSourceContent`
  // and `source` in `addMapping`, should correctly set these in `toJSON()`.
  // Explicitly ensuring here for robustness.
  outputMap.sources = [svelteFilePath];
  outputMap.sourcesContent = [originalFullSvelteContent];
  if (rawMap.file && !outputMap.file) {
    outputMap.file = rawMap.file; // Preserve original file name from civet map if not set by generator
  }

  return outputMap;
} 