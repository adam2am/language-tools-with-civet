import { SourceMapGenerator, type RawSourceMap as StandardRawSourceMap } from 'source-map';
import type { CivetLinesSourceMap } from './civetTypes';
// Removed import of computeCharOffsetInSnippet and getLineAndColumnForOffset as they are no longer used after PoC revert

/**
 * Normalize a Civet-specific sourcemap (CivetLinesSourceMap, from Civet snippet -> TS snippet)
 * to be a standard V3 RawSourceMap from Original Svelte File -> TS snippet.
 *
 * @param civetMap The CivetLinesSourceMap containing the `lines` array from `civet.compile()`.
 * @param originalFullSvelteContent The full content of the original .svelte file.
 * @param originalContentStartLine_1based 1-based line number where the civet snippet started in the .svelte file.
 * @param svelteFilePath The actual file path of the .svelte file (for the output sourcemap's `sources` and `file` fields).
 * @returns A Standard V3 RawSourceMap that maps from the original .svelte file to the compiled TS snippet.
 */
export function normalizeCivetMap(
  civetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  originalContentStartLine_1based: number,
  svelteFilePath: string
  // Removed originalUndedentedCivetSnippet and originalSnippetIndent from signature
): StandardRawSourceMap {

  const lazerFocusDebug = false;
  const generator = new SourceMapGenerator({ file: svelteFilePath });
  generator.setSourceContent(svelteFilePath, originalFullSvelteContent);

  // Determine indent of first content line for column mapping
  let svelteScriptTagIndent = 0;
  {
    const lines = originalFullSvelteContent.split('\n');
    const idx = originalContentStartLine_1based - 1;
    if (idx >= 0 && idx < lines.length) {
      const match = lines[idx].match(/^\s*/);
      if (match) svelteScriptTagIndent = match[0].length;
    }
  }

  if (civetMap.lines) {
    civetMap.lines.forEach((lineSegments, generatedLine_0based) => {
      if (!lineSegments || lineSegments.length === 0) return;
      if (lazerFocusDebug) console.log(`\n[normalizeCivetMap DEBUG] Processing Generated Line: ${generatedLine_0based + 1}`);

      let runningGenCol = 0;
      const segmentsWithGenCol: { genCol: number; segment: number[] }[] = [];
      for (const seg of lineSegments) {
        if (!seg || seg.length < 4) continue;
        runningGenCol += seg[0];
        segmentsWithGenCol.push({ genCol: runningGenCol, segment: seg });
      }
      const sortedSegments = segmentsWithGenCol.sort((a, b) => {
        if (a.genCol !== b.genCol) return a.genCol - b.genCol;
        const sa = a.segment, sb = b.segment;
        if (sa[2] !== sb[2]) return sa[2] - sb[2];
        return sa[3] - sb[3];
      });
      if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Sorted Segments for Gen Line ${generatedLine_0based + 1}:`, JSON.stringify(sortedSegments));

      let lastProcessedGeneratedColumn = -1;
      sortedSegments.forEach(({ genCol: generatedColumn_0based, segment }) => {
        if (generatedColumn_0based === lastProcessedGeneratedColumn) {
          if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Skipping segment for already processed Gen L${generatedLine_0based + 1}C${generatedColumn_0based}:`, JSON.stringify(segment));
          return;
        }

        const originalLine_0based_in_snippet = segment[2]; // This is line in DEDENTED snippet
        const originalColumn_0based_in_snippet = segment[3]; // This is col in DEDENTED snippet
        const name = (segment.length >= 5 && civetMap.names && typeof segment[4] === 'number') 
                     ? civetMap.names[segment[4]] 
                     : undefined;

        const finalOriginalLine_1based_in_svelte = originalContentStartLine_1based + originalLine_0based_in_snippet;
        // The originalColumn_0based_in_snippet is from the DEDENTED civet code.
        // To map it back to the svelte file, we add the indent that the dedented line had in the original svelte file.
        // The `svelteScriptTagIndent` is a simplification, using the indent of the *first* line of the snippet.
        const finalOriginalColumn_0based_in_svelte = originalColumn_0based_in_snippet + svelteScriptTagIndent;

        if (lazerFocusDebug) {
            console.log(`[normalizeCivetMap DEBUG] GenL:${generatedLine_0based + 1}C:${generatedColumn_0based}`);
            console.log(`  Orig Seg (from dedented Civet): [L${originalLine_0based_in_snippet}, C${originalColumn_0based_in_snippet}]`);
            console.log(`  Snippet Line Offset (0-based in Svelte): ${originalContentStartLine_1based}`);
            console.log(`  Svelte Script/Line Indent (for col adjust): ${svelteScriptTagIndent}`);
            console.log(`  --> Maps to Svelte L:${finalOriginalLine_1based_in_svelte}C:${finalOriginalColumn_0based_in_svelte}`);
        }

        lastProcessedGeneratedColumn = generatedColumn_0based;
        generator.addMapping({
          source: svelteFilePath,
          original: { line: finalOriginalLine_1based_in_svelte, column: finalOriginalColumn_0based_in_svelte },
          generated: { line: generatedLine_0based + 1, column: generatedColumn_0based },
          name: name
        });
      });
    });
  }

  const outputMap = generator.toJSON();
  if (lazerFocusDebug) console.log('[normalizeCivetMap DEBUG] Final Raw V3 Map from generator.toJSON():', JSON.stringify(outputMap));
  outputMap.sources = [svelteFilePath];
  outputMap.sourcesContent = [originalFullSvelteContent];
  return outputMap;
} 