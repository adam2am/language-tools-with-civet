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
  originalCivetSnippetLineOffset_0based: number, // This offset already points to the first *actual code line* in Svelte
  svelteFilePath: string
): StandardRawSourceMap {
  console.log(`[MAP_TO_V3 ${svelteFilePath}] Normalizing Civet map. Snippet line offset in Svelte (0-based): ${originalCivetSnippetLineOffset_0based}`);

  const lazerFocusDebug = false;
  const generator = new SourceMapGenerator({ file: svelteFilePath });

  // Set the source content for the .svelte file.
  // This ensures the output map refers to the full original Svelte content.
  generator.setSourceContent(svelteFilePath, originalFullSvelteContent);

  // Determine the indentation of the Civet snippet within the Svelte <script> tag
  let svelteScriptTagIndent = 0;
  if (originalFullSvelteContent && originalCivetSnippetLineOffset_0based >= 0) {
    const svelteLines = originalFullSvelteContent.split('\n');
    if (originalCivetSnippetLineOffset_0based < svelteLines.length) {
      const snippetLineInSvelte = svelteLines[originalCivetSnippetLineOffset_0based];
      const match = snippetLineInSvelte.match(/^\s*/);
      if (match) {
        svelteScriptTagIndent = match[0].length;
      }
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Determined svelteScriptTagIndent: ${svelteScriptTagIndent} from Svelte line ${originalCivetSnippetLineOffset_0based + 1}: "${snippetLineInSvelte.slice(0,30)}..."`);
    } else {
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Could not determine svelteScriptTagIndent: originalCivetSnippetLineOffset_0based (${originalCivetSnippetLineOffset_0based}) out of bounds for Svelte lines (${svelteLines.length})`);
    }
  } else {
    console.log(`[MAP_TO_V3 ${svelteFilePath}] Could not determine svelteScriptTagIndent: originalFullSvelteContent empty or originalCivetSnippetLineOffset_0based negative.`);
  }

  // Determine if the source snippet itself started with a newline, which would affect its internal line numbering.
  const snippetHadLeadingNewline = civetMap.source && (civetMap.source.startsWith('\n') || civetMap.source.startsWith('\r\n'));
  if (lazerFocusDebug && snippetHadLeadingNewline) console.log('[normalizeCivetMap DEBUG] Detected snippetHadLeadingNewline');
  console.log(`[MAP_TO_V3 ${svelteFilePath}] Snippet (from civetMap.source) had leading newline: ${snippetHadLeadingNewline}`);

  // The `civetMap.lines` array contains segments which are:
  // [generatedColumn_0based, sourceFileIndex_0based (relative to civetMap.sources if it existed), 
  //  originalLine_0based_in_snippet, originalColumn_0based_in_snippet, 
  //  optional_nameIndex_0based (relative to civetMap.names if it existed)]
  // For CivetLinesSourceMap from our logs, sourceFileIndex is 0 (referring to civetMap.source)
  // and there's no nameIndex (segments are 4-element arrays).

  if (civetMap.lines) {
    civetMap.lines.forEach((lineSegments, generatedLine_0based) => {
      if (!lineSegments || lineSegments.length === 0) return;
      console.log(`\n[MAP_TO_V3 ${svelteFilePath}] Processing Generated TS Line (0-based): ${generatedLine_0based} (1-based: ${generatedLine_0based + 1})`);

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
      // Additional log for all segments on this line
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Gen TS Line ${generatedLine_0based + 1}: Raw Civet segments for this line: ${JSON.stringify(lineSegments)}`);
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Gen TS Line ${generatedLine_0based + 1}: Sorted absolute segments: ${JSON.stringify(sortedSegments.map(s => ({gCol:s.genCol, oLine:s.segment[2]+1, oCol:s.segment[3]})))}`);

      let lastProcessedGeneratedColumn = -1;
      sortedSegments.forEach(({ genCol: generatedColumn_0based, segment }) => {
        if (generatedColumn_0based === lastProcessedGeneratedColumn) {
          // We have already processed a segment for this exact generated column.
          // Due to our sorting (earliest original position comes first for a given generated column),
          // we stick with the first one we added for this generated column to ensure determinism
          // and map to the most primary/earliest source location.
          if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Skipping segment for already processed Gen L${generatedLine_0based + 1}C${generatedColumn_0based}:`, JSON.stringify(segment));
          return;
        }

        // segment[1] is sourceFileIndex, typically 0 for single-file snippet compilation
        const originalLine_0based_in_snippet = segment[2];
        const originalColumn_0based_in_snippet = segment[3];
        // We assume no name mapping if segment has 4 elements, as seen in logs.
        // If civetMap could have a `names` array and 5-element segments, this would need enhancement.
        const name = (segment.length >= 5 && civetMap.names && typeof segment[4] === 'number') 
                     ? civetMap.names[segment[4]] 
                     : undefined;
        console.log(`[MAP_TO_V3 ${svelteFilePath}] Gen TS L${generatedLine_0based + 1}C${generatedColumn_0based}: Raw Civet seg: [genColDelta:${segment[0]}, srcIdx:${segment[1]}, origLineInCivet:${segment[2]}, origColInCivet:${segment[3]}${name ? ', nameIdx:'+segment[4] : ''}]`);

        let effective_originalLine_0based_in_snippet = originalLine_0based_in_snippet;
        if (snippetHadLeadingNewline) {
          if (originalLine_0based_in_snippet > 0) {
            effective_originalLine_0based_in_snippet = originalLine_0based_in_snippet - 1;
          } 
          // If originalLine_0based_in_snippet is 0, it maps the leading newline itself. 
          // effective_originalLine_0based_in_snippet remains 0.
        }
        if (lazerFocusDebug && snippetHadLeadingNewline) console.log(`[normalizeCivetMap DEBUG] snippetHadLeadingNewline: orig_line=${originalLine_0based_in_snippet}, effective_orig_line=${effective_originalLine_0based_in_snippet}`);

        // Adjust original line to be relative to the start of the original .svelte file.
        const finalOriginalLine_1based_in_svelte = effective_originalLine_0based_in_snippet + originalCivetSnippetLineOffset_0based + 1;
        
        // Adjust original column to account for indentation within the Svelte script tag.
        const finalOriginalColumn_0based_in_svelte = originalColumn_0based_in_snippet + svelteScriptTagIndent;
        console.log(`[MAP_TO_V3 ${svelteFilePath}] Gen TS L${generatedLine_0based + 1}C${generatedColumn_0based}: EffectiveOrigCivetL(0):${effective_originalLine_0based_in_snippet}, EffectiveOrigCivetCol(0):${originalColumn_0based_in_snippet} -> SvelteL(1):${finalOriginalLine_1based_in_svelte}, SvelteCol(0):${finalOriginalColumn_0based_in_svelte}`);

        // **** CRITICAL DEBUG LOG ****
        if (generatedLine_0based === 0 && generatedColumn_0based < 20) { // Log first few segments of the first generated line
          console.log(`[MAP_TO_V3_CRITICAL_DEBUG ${svelteFilePath}] PRE-ADD_MAPPING FOR GEN L${generatedLine_0based + 1}C${generatedColumn_0based}:`);
          console.log(`  Input originalColumn_0based_in_snippet (segment[3]): ${originalColumn_0based_in_snippet}`);
          console.log(`  Calculated svelteScriptTagIndent: ${svelteScriptTagIndent}`);
          console.log(`  Calculated finalOriginalLine_1based_in_svelte: ${finalOriginalLine_1based_in_svelte}`);
          console.log(`  Calculated finalOriginalColumn_0based_in_svelte: ${finalOriginalColumn_0based_in_svelte}`);
        }
        // **** END CRITICAL DEBUG LOG ****

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
        if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Adding mapping for Gen L${generatedLine_0based + 1}C${generatedColumn_0based}:`, JSON.stringify(mappingToAdd));
        lastProcessedGeneratedColumn = generatedColumn_0based; // Mark this generated column as processed.
        generator.addMapping(mappingToAdd);
      });
    });
  }

  const outputMap = generator.toJSON(); // This is StandardRawSourceMap
  if (lazerFocusDebug) console.log('[normalizeCivetMap DEBUG] Final Raw V3 Map from generator.toJSON():', JSON.stringify(outputMap));
  console.log(`[MAP_TO_V3 ${svelteFilePath}] Final Normalized Civet-Svelte map (first 3 lines of mappings): ${outputMap.mappings.split(';').slice(0,3).join(';')}`);

  // Ensure `sources` and `sourcesContent` are correctly set in the final map.
  // `setSourceContent` and using `svelteFilePath` in `addMapping` should handle this,
  // but explicit reinforcement can be good.
  outputMap.sources = [svelteFilePath];
  outputMap.sourcesContent = [originalFullSvelteContent];
  // outputMap.file should be svelteFilePath as per SourceMapGenerator({ file: svelteFilePath })

  return outputMap;
} 