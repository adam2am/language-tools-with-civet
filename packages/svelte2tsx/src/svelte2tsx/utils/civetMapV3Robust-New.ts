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
 * @param removedCivetContentIndentLength Length of the common indent removed from civet snippet by stripCommonIndent
 * @returns A Standard V3 RawSourceMap that maps from the original .svelte file to the compiled TS snippet.
 */
export function normalizeCivetMap(
  civetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  originalCivetSnippetLineOffset_0based: number, // This offset already points to the first *actual code line* in Svelte
  svelteFilePath: string,
  removedCivetContentIndentLength: number // Length of the common indent removed from civet snippet by stripCommonIndent
): StandardRawSourceMap {

  const lazerFocusDebug = false;
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
      if (!lineSegments || lineSegments.length === 0) return;

      if (lazerFocusDebug) console.log(`\n[normalizeCivetMap DEBUG] Processing Generated Line: ${generatedLine_0based + 1}`);

      // Convert Civet's delta-based generated column entries to absolute columns
      let runningGenCol = 0;
      const segmentsWithGenCol: { genCol: number; segment: number[] }[] = [];
      for (const seg of lineSegments) {
        if (!seg || seg.length < 4) continue;
        runningGenCol += seg[0];
        segmentsWithGenCol.push({ genCol: runningGenCol, segment: seg });
      }
      // Sort by absolute generated column, then original line, then original column
      const sortedSegments = segmentsWithGenCol.sort((a, b) => {
        if (a.genCol !== b.genCol) return a.genCol - b.genCol;
        const sa = a.segment, sb = b.segment;
        if (sa[2] !== sb[2]) return sa[2] - sb[2];
        return sa[3] - sb[3];
      });
      if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Sorted Segments for Gen Line ${generatedLine_0based + 1}:`, JSON.stringify(sortedSegments));

      sortedSegments.forEach(({ genCol: generatedColumn_0based, segment }) => {
        // segment[1] is sourceFileIndex, typically 0 for single-file snippet compilation
        const originalLine_0based_in_snippet = segment[2];
        const originalColumn_0based_in_snippet = segment[3];
        // We assume no name mapping if segment has 4 elements, as seen in logs.
        // If civetMap could have a `names` array and 5-element segments, this would need enhancement.
        const name = (segment.length >= 5 && civetMap.names && typeof segment[4] === 'number') 
                     ? civetMap.names[segment[4]] 
                     : undefined;

        // Adjust original line to be relative to the start of the original .svelte file.
        // preprocessCivet is expected to have trimmed leading newlines from the snippet 
        // passed to compileCivet, so rawMap's originalLine_0based_in_snippet is already correct.
        const finalOriginalLine_1based_in_svelte = originalLine_0based_in_snippet + originalCivetSnippetLineOffset_0based + 1;
        
        // const finalOriginalColumn_0based_in_svelte = originalColumn_0based_in_snippet; // CORRECT: Civet's originalColumn is for its line content
        // ADJUSTED: Add back the indent that was stripped from the civet snippet content by stripCommonIndent
        const finalOriginalColumn_0based_in_svelte = originalColumn_0based_in_snippet + removedCivetContentIndentLength;

        const mappingToAdd = {
          source: svelteFilePath, // All original positions are from the .svelte file
          original: {
            line: finalOriginalLine_1based_in_svelte,
            column: finalOriginalColumn_0based_in_svelte 
          },
          generated: {
            line: generatedLine_0based + 1, // SourceMapGenerator expects 1-based generated line
            column: generatedColumn_0based
          },
          name: name
        };

        if (lazerFocusDebug) {
            console.log(`[normalizeCivetMap DEBUG] Adding mapping for Gen L${generatedLine_0based + 1}C${generatedColumn_0based}:`, JSON.stringify(mappingToAdd));
            if ((generatedLine_0based + 1 === 2) && (generatedColumn_0based === 21) && svelteFilePath.includes('array operations - didnt pass if 1 symbol')) {
                console.log('[SPECIFIC DEBUG FOR L2C21 array op N]:');
                console.log(`  originalLine_0based_in_snippet: ${originalLine_0based_in_snippet}`);
                console.log(`  originalColumn_0based_in_snippet: ${originalColumn_0based_in_snippet}`);
                console.log(`  finalOriginalLine_1based_in_svelte: ${finalOriginalLine_1based_in_svelte}`);
                console.log(`  finalOriginalColumn_0based_in_svelte: ${finalOriginalColumn_0based_in_svelte}`);
            }
        }
        generator.addMapping(mappingToAdd);
      });
    });
  }

  const outputMap = generator.toJSON(); // This is StandardRawSourceMap
  if (lazerFocusDebug) console.log('[normalizeCivetMap DEBUG] Final Raw V3 Map from generator.toJSON():', JSON.stringify(outputMap));

  // Ensure `sources` and `sourcesContent` are correctly set in the final map.
  // `setSourceContent` and using `svelteFilePath` in `addMapping` should handle this,
  // but explicit reinforcement can be good.
  outputMap.sources = [svelteFilePath];
  outputMap.sourcesContent = [originalFullSvelteContent];
  // outputMap.file should be svelteFilePath as per SourceMapGenerator({ file: svelteFilePath })

  return outputMap;
} 