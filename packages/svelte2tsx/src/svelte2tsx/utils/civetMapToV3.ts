import { GenMapping, setSourceContent, addMapping, toEncodedMap } from '@jridgewell/gen-mapping';
import type { EncodedSourceMap } from '@jridgewell/gen-mapping';
import type { CivetLinesSourceMap } from './civetTypes';
import { decode } from '@jridgewell/sourcemap-codec';

/**
 * Normalize a Civet-specific sourcemap (CivetLinesSourceMap, from Civet snippet -> TS snippet)
 * to be a standard V3 RawSourceMap from Original Svelte File -> TS snippet.
 *
 * @param civetMap The CivetLinesSourceMap containing the `lines` array from `civet.compile()`.
 * @param originalFullSvelteContent The full content of the original .svelte file.
 * @param originalContentStartLine_1based 1-based Svelte line where snippet starts
 * @param removedIndentLength number of spaces stripped from snippet indent
 * @param svelteFilePath The actual file path of the .svelte file (for the output sourcemap's `sources` and `file` fields).
 * @returns A Standard V3 RawSourceMap that maps from the original .svelte file to the compiled TS snippet.
 */
export function normalizeCivetMap(
  civetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  originalContentStartLine_1based: number, // 1-based Svelte line where snippet starts
  removedIndentLength: number,           // number of spaces stripped from snippet indent
  svelteFilePath: string
): EncodedSourceMap {
  console.log(`[MAP_TO_V3 ${svelteFilePath}] Normalizing Civet map. Snippet line offset in Svelte (0-based): ${originalContentStartLine_1based - 1}`);

  // Detailed debug for our failing fixture
  if (svelteFilePath.includes('twoFooUserRequest.svelte')) {
    // Log the raw Civet snippet source
    console.log(`[MAP_TO_V3_DEBUG] Civet snippet source for ${svelteFilePath}:\n${civetMap.source}`);
    // Log the raw mapping lines
    console.log(`[MAP_TO_V3_DEBUG] Civet raw lines for ${svelteFilePath}: ${JSON.stringify(civetMap.lines)}`);
    // Log the corresponding Svelte file lines where the snippet resides
    const tmpSvelteLines = originalFullSvelteContent.split('\n');
    console.log(`[MAP_TO_V3_DEBUG] Svelte snippet lines (line ${originalContentStartLine_1based} to ${originalContentStartLine_1based + civetMap.lines.length - 1}):`);
    for (let i = originalContentStartLine_1based - 1; i < originalContentStartLine_1based + civetMap.lines.length - 1; i++) {
      console.log(`  [Svelte L${i+1}] ${tmpSvelteLines[i]}`);
    }
  }

  const lazerFocusDebug = false;
  const gen = new GenMapping({ file: svelteFilePath });

  // Set the source content for the .svelte file.
  // This ensures the output map refers to the full original Svelte content.
  setSourceContent(gen, svelteFilePath, originalFullSvelteContent);

  // The `civetMap.lines` array contains segments which are:
  // [generatedColumn_0based, sourceFileIndex_0based, originalLine_0based_in_snippet, originalColumn_0based_in_snippet, optional_nameIndex_0based]

  if (civetMap.lines) {
    civetMap.lines.forEach((lineSegments, tsLineIdx) => {
      if (!lineSegments || lineSegments.length === 0) return;
      // currentAbsoluteTSCol tracks the 0-based column in the current generated (TypeScript) line.
      // Civet's segment[0] is a delta indicating the advance in columns on the generated line
      // from the start of the previous segment (or from column 0 for the first segment).
      let currentAbsoluteTSCol = 0;
      for (const seg of lineSegments) {
        if (!seg || seg.length === 0) continue;

        // Always advance the current absolute TS column by the segment's delta.
        currentAbsoluteTSCol += seg[0];

        // Only add a mapping if the segment includes original file information (length >= 4).
        // Segments like [genColDelta] (length 1) indicate unmapped generated characters.
        // gen-mapping handles unmapped characters by default if no mapping is added for them.
        if (seg.length >= 4) {
          const tsColForMapping = currentAbsoluteTSCol; // This is the 0-based start column of this mapping in TS
          const snippetOrigLine = seg[2]; // 0-based line in the Civet snippet
          const snippetOrigCol = seg[3];  // 0-based column in the Civet snippet

          const originalLine1 = originalContentStartLine_1based + snippetOrigLine; // 1-based Svelte line
          const originalCol0  = snippetOrigCol + removedIndentLength;           // 0-based Svelte column
          const name = seg.length >= 5 && civetMap.names ? civetMap.names[seg[4]] : undefined;

          addMapping(gen, {
            source: svelteFilePath,
            generated: { line: tsLineIdx + 1, column: tsColForMapping }, // 1-based line, 0-based col for GenMapping
            original: { line: originalLine1, column: originalCol0 },    // 1-based line, 0-based col
            name
          });
        }
      }
    });
  }

  const outputMap = toEncodedMap(gen); // EncodedSourceMap
  // DYNAMIC DEBUG: decode mappings for first generated line in normalized map for twoFooUserRequest
  if (svelteFilePath.includes('twoFooUserRequest.svelte')) {
    // decode the VLQ mappings into segments
    try {
      const decoded = decode(outputMap.mappings);
      const line0 = decoded[0] || [];
      console.log(`[MAP_TO_V3_DECODED_DEBUG ${svelteFilePath}] Decoded normalized mappings for GenLine1: ${JSON.stringify(line0)}`);
      const foo1Seg = line0.find(seg => seg[0] === 8);
      console.log(`[MAP_TO_V3_DECODED_DEBUG_FOO1 ${svelteFilePath}] Segment for tsCol 8: ${JSON.stringify(foo1Seg)}`);
    } catch (e) {
      console.error(`[MAP_TO_V3_DECODED_DEBUG_ERROR ${svelteFilePath}] Failed to decode mappings: ${e.message}`);
    }
  }
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