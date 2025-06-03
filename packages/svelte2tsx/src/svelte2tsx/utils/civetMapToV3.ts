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

  // LAZER FOCUS DEBUG for 2Parameters.svelte, original line 4 (propsProbl parameters)
  const isTargetFixtureForBcDebug = svelteFilePath.includes('2Parameters.svelte');

  if (civetMap.lines) {
    civetMap.lines.forEach((lineSegments, tsLineIdx_0based) => {
      if (!lineSegments || lineSegments.length === 0) return;

      let pendingMapping: {
        generatedLine_1based: number;
        generatedColumn_0based: number;
        originalLine_1based: number;
        originalColumn_0based: number;
        name?: string;
        hasFlushedTokenEnd?: boolean;
      } | null = null;
      
      let currentCivetSegmentGeneratedColumnPointer_0based = 0; // Tracks the absolute start column in TS for the current civet segment

      for (const civetSeg of lineSegments) {
        if (!civetSeg || civetSeg.length === 0) continue;

        const civetGenColDelta = civetSeg[0];
        const tsColForCurrentCivetSeg_0based = currentCivetSegmentGeneratedColumnPointer_0based + civetGenColDelta;
        const currentSegmentIsActualMapping = civetSeg.length >= 4;

        // Duplicate mapping at the end of a skipped token segment, mapping to end-of-token in original
        if (pendingMapping && civetSeg.length < 4 && !pendingMapping.hasFlushedTokenEnd) {
          const skipLen = civetGenColDelta;
          const endGeneratedColumn = tsColForCurrentCivetSeg_0based;
          const endOriginalColumn = pendingMapping.originalColumn_0based + skipLen;
          addMapping(gen, {
            source: svelteFilePath,
            generated: { line: pendingMapping.generatedLine_1based, column: endGeneratedColumn },
            original: { line: pendingMapping.originalLine_1based, column: endOriginalColumn },
            name: pendingMapping.name
          });
          pendingMapping.hasFlushedTokenEnd = true;
        }

        // If pendingMapping exists AND current civetSeg starts at a *different* TS column
        // than the one pendingMapping is for, then pendingMapping might be complete.
        // MODIFIED (Approach A): Only flush if the current segment (causing the column change) is an actual mapping segment.
        // If it's a non-mapping segment, let pendingMapping persist; it will be flushed by the next actual mapping or end-of-line.
        if (pendingMapping && tsColForCurrentCivetSeg_0based !== pendingMapping.generatedColumn_0based && currentSegmentIsActualMapping) {
          // LAZER FOCUS DEBUG
          if (isTargetFixtureForBcDebug && pendingMapping.originalLine_1based === 4 && pendingMapping.originalColumn_0based >= 27 && pendingMapping.originalColumn_0based <= 29) {
             console.log(`[BC_DEBUG ${svelteFilePath}] FLUSHING (due to new TS col BY MAPPING SEG) pendingMapping for '${pendingMapping.name}' from TS ${pendingMapping.generatedLine_1based}:${pendingMapping.generatedColumn_0based} -> Original Svelte ${pendingMapping.originalLine_1based}:${pendingMapping.originalColumn_0based}`);
          }
          addMapping(gen, {
            source: svelteFilePath,
            generated: { line: pendingMapping.generatedLine_1based, column: pendingMapping.generatedColumn_0based },
            original: { line: pendingMapping.originalLine_1based, column: pendingMapping.originalColumn_0based },
            name: pendingMapping.name
          });
          pendingMapping = null; // Flushed it
        }
        
        // Advance the pointer for the next segment's calculation *after* potential flush and *before* processing this one's original details
        currentCivetSegmentGeneratedColumnPointer_0based = tsColForCurrentCivetSeg_0based;

        if (currentSegmentIsActualMapping) { // This Civet segment *has* an original mapping part
          const snippetOrigLine_0based = civetSeg[2];
          const snippetOrigCol_0based = civetSeg[3];
          const currentOriginalLine_1based = originalContentStartLine_1based + snippetOrigLine_0based;
          const currentOriginalCol_0based = snippetOrigCol_0based + removedIndentLength;
          const currentName = civetSeg.length >= 5 && civetMap.names ? civetMap.names[civetSeg[4]] : undefined;

          if (!pendingMapping) {
            // No current pendingMapping for this tsColForCurrentCivetSeg_0based (either first mapping, or previous was flushed)
            // So, this segment's mapping becomes the new pending one.
            pendingMapping = {
              generatedLine_1based: tsLineIdx_0based + 1,
              generatedColumn_0based: tsColForCurrentCivetSeg_0based,
              originalLine_1based: currentOriginalLine_1based,
              originalColumn_0based: currentOriginalCol_0based,
              name: currentName,
              hasFlushedTokenEnd: false
            };
            // LAZER FOCUS DEBUG
            if (isTargetFixtureForBcDebug && currentOriginalLine_1based === 4 && currentOriginalCol_0based >= 27 && currentOriginalCol_0based <= 29) {
              console.log(`[BC_DEBUG ${svelteFilePath}] CREATED new pendingMapping for '${currentName}' at TS ${tsLineIdx_0based + 1}:${tsColForCurrentCivetSeg_0based} -> Original Svelte ${currentOriginalLine_1based}:${currentOriginalCol_0based}`);
            }
          } else {
            // A pendingMapping already exists for this exact tsColForCurrentCivetSeg_0based.
            // We need to decide if this new civetSeg offers a "better" original mapping.
            // CHANGED: "Better" now means its original column is SMALLER (start of token).
            if (currentOriginalCol_0based < pendingMapping.originalColumn_0based) {
              // This new mapping is preferred (it's closer to token start). Update the pendingMapping.
              // LAZER FOCUS DEBUG
              if (isTargetFixtureForBcDebug && currentOriginalLine_1based === 4 && currentOriginalCol_0based >= 27 && currentOriginalCol_0based <= 29) {
                console.log(`[BC_DEBUG ${svelteFilePath}] UPDATING pendingMapping for TS ${tsLineIdx_0based + 1}:${tsColForCurrentCivetSeg_0based}. Old Original Svelte ${pendingMapping.originalLine_1based}:${pendingMapping.originalColumn_0based}. New Original Svelte ${currentOriginalLine_1based}:${currentOriginalCol_0based} ('${currentName}') - PREFERRING TOKEN START`);
              }
              pendingMapping.originalLine_1based = currentOriginalLine_1based; // original line might change too
              pendingMapping.originalColumn_0based = currentOriginalCol_0based;
              pendingMapping.name = currentName; // Update name as well
            } else {
              // Keep existing mapping (it's already at or closer to token start)
              // LAZER FOCUS DEBUG
              if (isTargetFixtureForBcDebug && currentOriginalLine_1based === 4 && currentOriginalCol_0based >= 27 && currentOriginalCol_0based <= 29) {
                console.log(`[BC_DEBUG ${svelteFilePath}] KEEPING existing pendingMapping for TS ${tsLineIdx_0based + 1}:${tsColForCurrentCivetSeg_0based}. Existing Original Svelte ${pendingMapping.originalLine_1based}:${pendingMapping.originalColumn_0based} was preferred over New Original Svelte ${currentOriginalLine_1based}:${currentOriginalCol_0based} ('${currentName}') - KEEPING TOKEN START`);
              }
            }
          }
        }
        // If civetSeg.length < 4, it's a segment that only advances the generated column pointer
        // but doesn't provide an original mapping. `currentCivetSegmentGeneratedColumnPointer_0based`
        // has been updated. If this advancement caused a change in TS column relative to
        // an existing `pendingMapping`, that `pendingMapping` would have been flushed above.
        // This non-mapping segment itself doesn't create or modify `pendingMapping`.
      }

      // After processing all segments for the current TS line,
      // if there's a pendingMapping left, add it.
      if (pendingMapping) {
        // LAZER FOCUS DEBUG
        if (isTargetFixtureForBcDebug && pendingMapping.originalLine_1based === 4 && pendingMapping.originalColumn_0based >= 27 && pendingMapping.originalColumn_0based <= 29) {
            console.log(`[BC_DEBUG ${svelteFilePath}] FLUSHING (end of line) pendingMapping for '${pendingMapping.name}' from TS ${pendingMapping.generatedLine_1based}:${pendingMapping.generatedColumn_0based} -> Original Svelte ${pendingMapping.originalLine_1based}:${pendingMapping.originalColumn_0based}`);
        }
        addMapping(gen, {
          source: svelteFilePath,
          generated: { line: pendingMapping.generatedLine_1based, column: pendingMapping.generatedColumn_0based },
          original: { line: pendingMapping.originalLine_1based, column: pendingMapping.originalColumn_0based },
          name: pendingMapping.name
          });
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