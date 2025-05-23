import { SourceMapGenerator, type RawSourceMap as StandardRawSourceMap } from 'source-map';
import type { CivetLinesSourceMap } from './civetTypes';

/**
 * Normalize a Civet-specific sourcemap (CivetLinesSourceMap, from Civet snippet -> TS snippet)
 * to be a standard V3 RawSourceMap from Original Svelte File -> TS snippet.
 *
 * @param civetMap The CivetLinesSourceMap containing the `lines` array from `civet.compile()`.
 * @param originalFullSvelteContent The full content of the original .svelte file.
 * @param originalCivetSnippetLineOffset_0based 0-based line number where the civet snippet started in the .svelte file.
 * @param svelteFilePath The actual file path of the .svelte file (for the output sourcemap's `sources` and `file` fields).
 * @returns A Standard V3 RawSourceMap that maps from the original .svelte file to the compiled TS snippet.
 */
export function normalizeCivetMap(
  civetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  originalCivetSnippetLineOffset_0based: number,
  svelteFilePath: string
): StandardRawSourceMap {

  const generator = new SourceMapGenerator({ file: svelteFilePath });

  // Set the source content for the .svelte file.
  // This ensures the output map refers to the full original Svelte content.
  generator.setSourceContent(svelteFilePath, originalFullSvelteContent);

  // The `civetMap.lines` array contains segments which are:
  // [generatedColumn_0based, sourceFileIndex_0based (relative to civetMap.sources if it existed), 
  //  originalLine_0based_in_snippet, originalColumn_0based_in_snippet, 
  //  optional_nameIndex_0based (relative to civetMap.names if it existed)]
  // For CivetLinesSourceMap from our logs, sourceFileIndex is 0 (referring to civetMap.source)
  // and there's no nameIndex (segments are 4-element arrays).

  if (civetMap.lines) {
    civetMap.lines.forEach((lineSegments, generatedLine_0based) => {
      if (!lineSegments) return;

      lineSegments.forEach(segment => {
        if (!segment || segment.length < 4) return; // Ensure segment is valid

        const generatedColumn_0based = segment[0];
        // segment[1] is sourceFileIndex, typically 0 for single-file snippet compilation
        const originalLine_0based_in_snippet = segment[2];
        const originalColumn_0based_in_snippet = segment[3];
        // We assume no name mapping if segment has 4 elements, as seen in logs.
        // If civetMap could have a `names` array and 5-element segments, this would need enhancement.
        const name = (segment.length >= 5 && civetMap.names && typeof segment[4] === 'number') 
                     ? civetMap.names[segment[4]] 
                     : undefined;

        // Adjust original line to be relative to the start of the original .svelte file.
        const finalOriginalLine_1based_in_svelte = originalLine_0based_in_snippet + originalCivetSnippetLineOffset_0based + 1;

        generator.addMapping({
          source: svelteFilePath, // All original positions are from the .svelte file
          original: {
            line: finalOriginalLine_1based_in_svelte,
            column: originalColumn_0based_in_snippet 
          },
          generated: {
            line: generatedLine_0based + 1, // SourceMapGenerator expects 1-based generated line
            column: generatedColumn_0based
          },
          name: name
        });
      });
    });
  }

  const outputMap = generator.toJSON(); // This is StandardRawSourceMap

  // Ensure `sources` and `sourcesContent` are correctly set in the final map.
  // `setSourceContent` and using `svelteFilePath` in `addMapping` should handle this,
  // but explicit reinforcement can be good.
  outputMap.sources = [svelteFilePath];
  outputMap.sourcesContent = [originalFullSvelteContent];
  // outputMap.file should be svelteFilePath as per SourceMapGenerator({ file: svelteFilePath })

  return outputMap;
} 