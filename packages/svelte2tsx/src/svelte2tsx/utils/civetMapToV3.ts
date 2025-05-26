import { SourceMapGenerator, type RawSourceMap as StandardRawSourceMap } from 'source-map';
import type { CivetLinesSourceMap } from './civetTypes';
// computeCharOffsetInSnippet and getLineAndColumnForOffset are not directly used in this revised function
// as it no longer maps fully back to the Svelte file, but prepares the map for chaining.
// import { computeCharOffsetInSnippet, getLineAndColumnForOffset } from './civetUtils'; 

/**
 * Converts a raw Civet-specific sourcemap (from civet.compile(), mapping dedented Civet snippet -> TS snippet)
 * into a Standard V3 RawSourceMap format.
 * The mappings' original line/column numbers remain relative to the *dedented* Civet snippet.
 * The 'sources' and 'sourcesContent' fields of the output map will refer to the original Svelte file.
 * This prepares the map for a subsequent chaining process.
 *
 * @param rawCivetMap The CivetLinesSourceMap (effectively `sourceMap` object from `civet.compile()`).
 * @param originalFullSvelteContent The full content of the original .svelte file.
 * @param svelteFilePath The file path of the .svelte file.
 * @param originalContentStartLine_1based The 1-based start line of the original snippet in the Svelte file.
 * @param commonIndentRemoved The common indent removed from the original snippet.
 * @returns A Standard V3 RawSourceMap (Dedented Civet Snippet -> Compiled TS Snippet, with Svelte file context).
 */
export function convertRawCivetMapToSvelteContextFormat(
  rawCivetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  svelteFilePath: string,
  originalContentStartLine_1based: number = 1,
  commonIndentRemoved: string = ''
): StandardRawSourceMap {
  const lazerFocusDebug = false; // Keep debug flag if needed for local testing
  if (lazerFocusDebug) console.log('[convertRawCivetMapToSvelteContextFormat] Input rawCivetMap:', JSON.stringify(rawCivetMap).substring(0, 200) + '...');

  const generator = new SourceMapGenerator({
    file: svelteFilePath // The "file" field refers to the output of this map stage (the TS snippet)
                         // but often set to the ultimate source for easier debugging in some tools.
                         // Or it could be null if it's purely intermediate. Let's use svelteFilePath for now.
  });

  // The "source" for this map's *original positions* is notionally the dedented Civet snippet.
  // However, for chaining purposes where the final map should point to the Svelte file,
  // we set the source file path here to the Svelte file.
  // The actual line/col numbers in the mappings are relative to the dedented snippet.
  generator.setSourceContent(svelteFilePath, originalFullSvelteContent);

  let generatedLineNo_1based = 0;
  if (rawCivetMap.lines) {
    rawCivetMap.lines.forEach((lineSegments) => {
      generatedLineNo_1based++; // Civet `lines` is 0-indexed array of lines, so this is 1-based gen line
      if (!lineSegments || lineSegments.length === 0) {
        // It's possible to have empty lines in mappings, SourceMapGenerator handles this.
        // Add a null mapping? Or just skip? Skippings seems fine if no segments.
        return;
      }
      if (lazerFocusDebug) console.log(`[convertRawCivetMapToSvelteContextFormat DEBUG] Processing Generated Line (1-based): ${generatedLineNo_1based}`);

      let generatedColumn_0based = 0;
      for (const segment of lineSegments) {
        if (!segment || segment.length < 4) continue; // Segment must have at least [genCol, srcIdx, origLine, origCol]

        // segment[0] is generatedColumnDelta from previous segment on this line (or from 0 for first segment)
        generatedColumn_0based += segment[0];
        // segment[1] is sourceFileIndex (relative to `rawCivetMap.sources` if it had them; civet.compile() map usually has one implicit source)
        // const sourceFileIndexInCivetMap = segment[1]; // Typically 0
        // segment[2] is originalSourceLine (0-indexed, relative to dedented Civet snippet)
        const originalLine_0based_inDedented = segment[2];
        // segment[3] is originalSourceColumn (0-indexed, relative to dedented Civet snippet)
        const originalColumn_0based_inDedented = segment[3];
        const nameIndex = segment.length >= 5 ? segment[4] : undefined;
        const name = (nameIndex !== undefined && rawCivetMap.names && typeof nameIndex === 'number')
                     ? rawCivetMap.names[nameIndex]
                     : undefined;

        // Adjust column to be relative to the original Svelte line start, by adding back common indent.
        const originalColumn_0based_inSvelteIndentedLine = originalColumn_0based_inDedented + commonIndentRemoved.length;

        if (lazerFocusDebug) {
            console.log(`  [DEBUG] Adding Mapping: GenL:${generatedLineNo_1based}, GenC:${generatedColumn_0based} -> OrigL (dedent):${originalLine_0based_inDedented + 1}, OrigC (dedent):${originalColumn_0based_inDedented}, Name:${name}`);
            console.log(`    CommonIndent: '${commonIndentRemoved}' (length: ${commonIndentRemoved.length}) -> Final OrigC (absolute in Svelte): ${originalColumn_0based_inSvelteIndentedLine}`);
        }

        // Map back to absolute Svelte file line by adding snippet start line
        const finalLine1 = originalContentStartLine_1based + originalLine_0based_inDedented;
        generator.addMapping({
          source: svelteFilePath,
          original: {
            line: finalLine1,
            column: originalColumn_0based_inSvelteIndentedLine // Store ABSOLUTE Svelte column
          },
          generated: {
            line: generatedLineNo_1based,
            column: generatedColumn_0based
          },
          name
        });
      }
    });
  }

  const outputMap = generator.toJSON();
  if (lazerFocusDebug) console.log('[convertRawCivetMapToSvelteContextFormat] Output Raw V3 Map:', JSON.stringify(outputMap));

  // Ensure sources and sourcesContent are correctly set for the final map structure
  // even if SourceMapGenerator might infer them, explicit is better.
  outputMap.sources = [svelteFilePath];
  outputMap.sourcesContent = [originalFullSvelteContent];
  // outputMap.file = svelteFilePath; // Or could be filename of TS snippet if that were distinct

  return outputMap;
} 

// Original normalizeCivetMap and its comments are removed as per the refactoring plan.
// ... existing code ...
// Leverage the TSX pipeline's own source-map chaining
// • Rather than fully normalizing Civet → Svelte yourself, piggy-back on the TSX generator: insert the raw Civet map as a pre-map into the MagicString chain, then let chainSourceMaps() merge it. That way you only need to align segment positions once, and all subsequent offsets come from a single V3 map.
// • Pros: Reuses our existing chaining logic, fewer places to get out of sync.
// • Cons: More tightly couples Civet → TSX integration, less transparent.
// – S: 8
// – RB: 7
// – FP: 7
// – RG: 5
// – Overall: A middleground—relies on the proven TSX map chain, but requires adjusting our chaining API to accept a raw Civet map directly.


// export function normalizeCivetMap(
//   civetMap: CivetLinesSourceMap,
//   originalFullSvelteContent: string,
//   // originalContentStartLine_1based: number, this way and POC way both got 1 line missmatch
//   svelteFilePath: string,
//   originalSnippetWithIndents: string,
//   commonIndentRemoved: string,
//   snippetStartOffset: number
// ): StandardRawSourceMap {

//   const lazerFocusDebug = false;
//   const generator = new SourceMapGenerator({ file: svelteFilePath });
//   generator.setSourceContent(svelteFilePath, originalFullSvelteContent);

//   if (civetMap.lines) {
//     civetMap.lines.forEach((lineSegments, generatedLine_0based) => {
//       if (!lineSegments || lineSegments.length === 0) return;
//       if (lazerFocusDebug) console.log(`\n[normalizeCivetMap DEBUG] Processing Generated Line: ${generatedLine_0based + 1}`);

//       let runningGenCol = 0;
//       const segmentsWithGenCol: { genCol: number; segment: number[] }[] = [];
//       for (const seg of lineSegments) {
//         if (!seg || seg.length < 4) continue;
//         runningGenCol += seg[0];
//         segmentsWithGenCol.push({ genCol: runningGenCol, segment: seg });
//       }
//       const sortedSegments = segmentsWithGenCol.sort((a, b) => {
//         if (a.genCol !== b.genCol) return a.genCol - b.genCol;
//         const sa = a.segment, sb = b.segment;
//         if (sa[2] !== sb[2]) return sa[2] - sb[2];
//         return sa[3] - sb[3];
//       });
//       if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Sorted Segments for Gen Line ${generatedLine_0based + 1}:`, JSON.stringify(sortedSegments));

//       let lastProcessedGeneratedColumn = -1;
//       sortedSegments.forEach(({ genCol: generatedColumn_0based, segment }) => {
//         if (generatedColumn_0based === lastProcessedGeneratedColumn) {
//           if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Skipping repeated Gen L${generatedLine_0based + 1}C${generatedColumn_0based}`);
//           return;
//         }

//         const snippetLine0 = segment[2];
//         const snippetCol0 = segment[3];
//         const name = segment.length >= 5 && civetMap.names && typeof segment[4] === 'number'
//                      ? civetMap.names[segment[4]]
//                      : undefined;

//         // Compute original column in the *original* snippet (with indent)
//         const originalColumnInSnippet = snippetCol0 + commonIndentRemoved.length;

//         // Compute character offset within the original snippet
//         const offsetInSnippet = computeCharOffsetInSnippet(originalSnippetWithIndents, snippetLine0, originalColumnInSnippet);
//         if (offsetInSnippet < 0) {
//           if (lazerFocusDebug) console.warn(`[normalizeCivetMap WARN] Offset in snippet out of bounds for segment ${JSON.stringify(segment)}`);
//           return;
//         }

//         // Compute absolute offset in the full Svelte file
//         const absoluteOffset = snippetStartOffset + offsetInSnippet;

//         // Derive final line and column in the Svelte file
//         const { line: finalLine, column: finalColumn } = getLineAndColumnForOffset(originalFullSvelteContent, absoluteOffset);

//         if (lazerFocusDebug) {
//           console.log(`[normalizeCivetMap DEBUG] Gen L:${generatedLine_0based + 1}C:${generatedColumn_0based} -> absoluteOffset ${absoluteOffset}`);
//           console.log(`  Maps to Svelte L:${finalLine}C:${finalColumn}`);
//         }

//         lastProcessedGeneratedColumn = generatedColumn_0based;
//         generator.addMapping({
//           source: svelteFilePath,
//           original: { line: finalLine, column: finalColumn },
//           generated: { line: generatedLine_0based + 1, column: generatedColumn_0based },
//           name
//         });
//       });
//     });
//   }

//   const outputMap = generator.toJSON();
//   if (lazerFocusDebug) console.log('[normalizeCivetMap DEBUG] Final Raw V3 Map from generator.toJSON():', JSON.stringify(outputMap));
//   outputMap.sources = [svelteFilePath];
//   outputMap.sourcesContent = [originalFullSvelteContent];
//   return outputMap;
// } 

/**
 * Legacy compatibility: maps a raw CivetLinesSourceMap to a V3 RawSourceMap
 * mapping directly back to the Svelte file.  The snippet offset is treated as 0-based start line.
 */
export function normalizeCivetMap(
  rawCivetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  snippetOffset_0based: number,
  svelteFilePath: string
): StandardRawSourceMap {
  // Convert snippet offset (0-based) to 1-based start line
  const startLine1 = snippetOffset_0based + 1;
  return convertRawCivetMapToSvelteContextFormat(
    rawCivetMap,
    originalFullSvelteContent,
    svelteFilePath,
    startLine1
  );
} 