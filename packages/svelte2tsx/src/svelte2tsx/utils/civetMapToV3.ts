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
 * @param originalCivetSnippetLineOffset_0based 0-based line number where the civet snippet started in the .svelte file.
 * @param svelteFilePath The actual file path of the .svelte file (for the output sourcemap's `sources` and `file` fields).
 * @returns A Standard V3 RawSourceMap that maps from the original .svelte file to the compiled TS snippet.
 */
export function normalizeCivetMap(
  civetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  originalCivetSnippetLineOffset_0based: number, // This offset already points to the first *actual code line* in Svelte
  svelteFilePath: string
): EncodedSourceMap {
  console.log(`[MAP_TO_V3 ${svelteFilePath}] Normalizing Civet map. Snippet line offset in Svelte (0-based): ${originalCivetSnippetLineOffset_0based}`);

  // Detailed debug for our failing fixture
  if (svelteFilePath.includes('twoFooUserRequest.svelte')) {
    // Log the raw Civet snippet source
    console.log(`[MAP_TO_V3_DEBUG] Civet snippet source for ${svelteFilePath}:\n${civetMap.source}`);
    // Log the raw mapping lines
    console.log(`[MAP_TO_V3_DEBUG] Civet raw lines for ${svelteFilePath}: ${JSON.stringify(civetMap.lines)}`);
    // Log the corresponding Svelte file lines where the snippet resides
    const tmpSvelteLines = originalFullSvelteContent.split('\n');
    console.log(`[MAP_TO_V3_DEBUG] Svelte snippet lines (line ${originalCivetSnippetLineOffset_0based + 1} to ${originalCivetSnippetLineOffset_0based + civetMap.lines.length}):`);
    for (let i = originalCivetSnippetLineOffset_0based; i < originalCivetSnippetLineOffset_0based + civetMap.lines.length; i++) {
      console.log(`  [Svelte L${i+1}] ${tmpSvelteLines[i]}`);
    }
  }

  const lazerFocusDebug = false;
  const gen = new GenMapping({ file: svelteFilePath });

  // Set the source content for the .svelte file.
  // This ensures the output map refers to the full original Svelte content.
  setSourceContent(gen, svelteFilePath, originalFullSvelteContent);

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

      // Log raw segments for this generated line BEFORE any processing
      console.log(`[MAP_TO_V3_RAW_SEGMENTS ${svelteFilePath}] GenLine ${generatedLine_0based + 1}: Raw input segments from civetMap.lines: ${JSON.stringify(lineSegments)}`);

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

      // Phase 1 & 2: precise token start and gap-filling per-character mappings
      let lastProcessedGeneratedColumn = -1;
      for (let i = 0; i < sortedSegments.length; i++) {
        const { genCol: generatedColumn_0based, segment } = sortedSegments[i];
        if (generatedColumn_0based === lastProcessedGeneratedColumn) continue;
        // const nextGenCol = i + 1 < sortedSegments.length ? sortedSegments[i + 1].genCol : generatedColumn_0based + 1;
        // Determine nextGenCol more carefully: it's current segment's generatedColumn + length of the TS token it represents
        // However, TS token length is not directly available here. The original approach of using the start of the *next* segment is safer for gap filling.
        const nextGenCol = (i + 1 < sortedSegments.length && sortedSegments[i+1].genCol > generatedColumn_0based) ? sortedSegments[i+1].genCol : (generatedColumn_0based + 1);

        // Extract snippet position
        const originalLine_0based_in_snippet = segment[2];
        const originalColumn_0based_in_snippet = segment[3];
        const name = segment.length >= 5 && civetMap.names && typeof segment[4] === 'number'
                     ? civetMap.names[segment[4]] 
                     : undefined;
        
        const effectiveLineIndex = snippetHadLeadingNewline && originalLine_0based_in_snippet > 0
          ? originalLine_0based_in_snippet - 1
          : originalLine_0based_in_snippet;
        
        const finalOriginalLine_1based_in_svelte = effectiveLineIndex + originalCivetSnippetLineOffset_0based + 1;
        const svelteLines = originalFullSvelteContent.split(/\r?\n/);
        const svelteLineText = svelteLines[finalOriginalLine_1based_in_svelte - 1] || '';

        // Calculate indent for the CURRENT Svelte line
        let currentSvelteLineIndent = 0;
        const indentMatch = svelteLineText.match(/^\s*/);
        if (indentMatch) {
          currentSvelteLineIndent = indentMatch[0].length;
        }

        // Determine snippet line text and parse token
        const snippetLines = civetMap.source.split(/\r?\n/);
        const snippetLineText = snippetLines[effectiveLineIndex] || '';
        const substring = snippetLineText.slice(originalColumn_0based_in_snippet);
        const tokenMatch = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(substring);
        
        let finalOriginalColumn_0based_in_svelte: number;
        let debugTokenName = ''; 

        const currentSegmentGeneratedColumn_forLog = generatedColumn_0based; // for log clarity
        let currentSegmentIsFunction = false;
        let currentSegmentIsFoo1 = false;

        if (tokenMatch) {
          const tokenStr = tokenMatch[0];
          if (svelteFilePath.includes('twoFooUserRequest.svelte')) {
            if (tokenStr === 'foo1') {
              debugTokenName = 'FOO1_CURR_SEG';
              currentSegmentIsFoo1 = true;
              // ULTRA DEBUG LOG MOVED INSIDE THE CONDITION THAT SETS currentSegmentIsFoo1
              // finalOriginalLine/Col might not be fully calculated yet if they depend on logic after this block,
              // but genCol and tokenStr are definitive here.
              // We need finalOriginalColumn_0based_in_svelte which is calculated *after* this block.
              // So, this log placement is not ideal for the full mapping. Previous was better.
              // The key is why the *previous* log for GCOL 9 ran if currentSegmentIsFoo1 was false for GCOL 9.
            } else if (tokenStr === 'function') {
              debugTokenName = 'FUNCTION_CURR_SEG';
              currentSegmentIsFunction = true;
            } else if (tokenStr === 'bar') {
              debugTokenName = 'BAR'; // Keep for general debug
            } else if (tokenStr === 'kekw') {
              debugTokenName = 'KEKW';
            }
          }

          // Revised: Search for tokenStr on the Svelte line starting from the Svelte line's own indent.
          // tokenStr is already the clean token (e.g., "kekw", not "\tkekw").
          // originalColumn_0based_in_snippet is the column of this token WITHIN the dedented snippet line.
          // We are trying to find this tokenStr on the fully indented svelteLineText.
          let searchStartIndexInSvelteLine = currentSvelteLineIndent;
          
          const foundIdx = svelteLineText.indexOf(tokenStr, searchStartIndexInSvelteLine);

          if (debugTokenName) {
            console.log(`[MAP_TO_V3_TOKEN_DEBUG_${debugTokenName} ${svelteFilePath}] Token: '${tokenStr}', OrigCivetLine: ${originalLine_0based_in_snippet+1}, OrigCivetColInSnippet: ${originalColumn_0based_in_snippet}`);
            console.log(`  SvelteLine (L${finalOriginalLine_1based_in_svelte}): "${svelteLineText}"`);
            console.log(`  CurrentSvelteLineIndent: ${currentSvelteLineIndent}`);
            console.log(`  SearchStartIndexInSvelteLine (currentIndent): ${searchStartIndexInSvelteLine}`);
            console.log(`  indexOf Result (foundIdx): ${foundIdx}`);
          }

          if (foundIdx !== -1) {
            finalOriginalColumn_0based_in_svelte = foundIdx;
            if (debugTokenName) console.log(`  Using foundIdx: ${finalOriginalColumn_0based_in_svelte}`);
          } else {
            // Fallback: If indexOf fails, this means the tokenStr wasn't found at/after currentSvelteLineIndent.
            // This could happen if tokenStr is part of a larger mapped segment (e.g. string literals) or if assumptions are wrong.
            // A safer fallback is currentSvelteLineIndent + originalColumn_0based_in_snippet, though this was problematic.
            // For now, let's log verbosely if indexOf fails for our target tokens.
            finalOriginalColumn_0based_in_svelte = currentSvelteLineIndent + originalColumn_0based_in_snippet; // Original fallback
            if (debugTokenName) console.log(`  indexOf("${tokenStr}", ${searchStartIndexInSvelteLine}) FAILED. Defaulting to currentSvelteLineIndent (${currentSvelteLineIndent}) + originalColumn_0based_in_snippet (${originalColumn_0based_in_snippet}) = ${finalOriginalColumn_0based_in_svelte}`);
          }
        } else {
          // No tokenMatch, typically for whitespace or punctuation segments.
          // Use currentSvelteLineIndent + originalColumn_0based_in_snippet.
          finalOriginalColumn_0based_in_svelte = currentSvelteLineIndent + originalColumn_0based_in_snippet;
          if (svelteFilePath.includes('twoFooUserRequest.svelte') && (name === 'foo1' || name === 'function' || name === 'bar' || name === 'kekw')) {
             console.log(`[MAP_TO_V3_TOKEN_DEBUG_${name ? name.toUpperCase() : 'UNKNOWN_NO_MATCH'} ${svelteFilePath}] No tokenMatch. Fallback to currentIndent + origCivetCol. OrigCivetLine: ${originalLine_0based_in_snippet+1}, OrigCivetColInSnippet: ${originalColumn_0based_in_snippet}. Segment name: ${name}. Calculated Svelte Col: ${finalOriginalColumn_0based_in_svelte}`);
          }
        }
        
        // Add mapping for start of segment
        let mappingGeneratedColumn = generatedColumn_0based;
        // If this is the first generated line (0-indexed) AND this segment is not the first segment on that line
        // (indicated by its generatedColumn_0based being greater than the gCol of the first segment, which is usually 0 for 'function'),
        // then adjust the mappingGeneratedColumn.
        // We check `i > 0` to ensure it's not the first segment in `sortedSegments` for this line.
        // REMOVING THIS ADJUSTMENT BLOCK
        // if (generatedLine_0based === 0 && i > 0 && sortedSegments[0].genCol < generatedColumn_0based) {
        //     mappingGeneratedColumn = generatedColumn_0based - 1;
        //     // Optional: Add a log for this adjustment
        //     if (svelteFilePath.includes('twoFooUserRequest.svelte')) {
        //         console.log(`[MAP_TO_V3_ADJUST_GCOL ${svelteFilePath}] Adjusted generatedColumn for GenL0 token. Original gCol: ${generatedColumn_0based}, New mappingGCol: ${mappingGeneratedColumn}, Token: '${( /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(snippetLineText.slice(segment[3])) || [{toString: ()=>'N/A'}] )[0].toString()}'`);
        //     }
        // }

        if (debugTokenName) {
          console.log(`SEG_GEN_COL ${currentSegmentGeneratedColumn_forLog}. Actual token for this specific segment: '${tokenMatch ? tokenMatch[0] : 'NO_TOKEN_MATCH_FOR_LOG'}'. Adding mapping Gen L${generatedLine_0based + 1}C${mappingGeneratedColumn} -> Svelte L${finalOriginalLine_1based_in_svelte}C${finalOriginalColumn_0based_in_svelte}`);
        }

        // ULTRA DEBUG FOR FOO1 MAPPING POINT
        if (currentSegmentIsFoo1 && svelteFilePath.includes('twoFooUserRequest.svelte')) {
            console.log(`[MAP_TO_V3_FOO1_PRE_ADDMAPPING ${svelteFilePath}] For foo1:
  genLineForMap: ${generatedLine_0based + 1}
  mappingGeneratedColumn: ${mappingGeneratedColumn} (original GCol in snippet: ${currentSegmentGeneratedColumn_forLog})
  finalOriginalLine_0based_in_svelte: ${finalOriginalLine_1based_in_svelte - 1}
  finalOriginalColumn_0based_in_svelte: ${finalOriginalColumn_0based_in_svelte}
  debugTokenName: ${debugTokenName}`);
        }

        addMapping(gen, {
          source: svelteFilePath,
          generated: { line: generatedLine_0based + 1, column: mappingGeneratedColumn },
          original: { line: finalOriginalLine_1based_in_svelte, column: finalOriginalColumn_0based_in_svelte },
          name
        });
        if (currentSegmentIsFoo1) {
          // Reverting to previous log placement for FOO1, but with more checks.
          const actualTokenForThisSegment = ( /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(snippetLineText.slice(segment[3])) || [{toString: ()=>'NO_TOKEN_MATCH_FOR_LOG'}] )[0].toString();
          if (actualTokenForThisSegment !== 'foo1') {
              console.error(`[!!!! MAP_TO_V3_LOGIC_ERROR_FOO1 !!!! ${svelteFilePath}] SEG_GEN_COL ${currentSegmentGeneratedColumn_forLog}: currentSegmentIsFoo1 is TRUE, but actual token for this segment is '${actualTokenForThisSegment}'`);
          }
          console.log(`[MAP_TO_V3_ADD_MAPPING_FOO1_DEBUG_FINAL ${svelteFilePath}] SEG_GEN_COL ${currentSegmentGeneratedColumn_forLog}. Actual token for this specific segment: '${actualTokenForThisSegment}'. Adding mapping Gen L${generatedLine_0based + 1}C${mappingGeneratedColumn} -> Svelte L${finalOriginalLine_1based_in_svelte}C${finalOriginalColumn_0based_in_svelte}`);
        }
        if (currentSegmentIsFunction) {
          console.log(`[MAP_TO_V3_ADD_MAPPING_FUNCTION_SEG ${svelteFilePath}] SEG_GEN_COL ${currentSegmentGeneratedColumn_forLog}: Added mapping for function: Gen L${generatedLine_0based + 1}C${mappingGeneratedColumn} -> Svelte L${finalOriginalLine_1based_in_svelte}C${finalOriginalColumn_0based_in_svelte} (name: ${name})`);
          console.log(`[MAP_TO_V3_PER_CHAR_FILL_FUNCTION_SEG ${svelteFilePath}] For FUNCTION segment (base GenCol ${mappingGeneratedColumn}), nextGenCol is ${nextGenCol}. Filling from ${mappingGeneratedColumn + 1} up to ${nextGenCol}.`);
          console.log(`  Original Svelte base for fill: L${finalOriginalLine_1based_in_svelte}C${finalOriginalColumn_0based_in_svelte}`);
        }

        // Fill gaps per character until next segment
        // The `nextGenCol` is based on original civet gCols.
        // The `col` for generated mapping also needs to be adjusted if it's the first line.
        for (let col = generatedColumn_0based + 1; col < nextGenCol; col++) {
          let fillMappingGeneratedColumn = col;
          // REMOVING THIS ADJUSTMENT BLOCK AS WELL
          // if (generatedLine_0based === 0 && i > 0 && sortedSegments[0].genCol < col) {
          //   fillMappingGeneratedColumn = col - 1;
          // }
          addMapping(gen, {
            source: svelteFilePath,
            generated: { line: generatedLine_0based + 1, column: fillMappingGeneratedColumn },
            original: { line: finalOriginalLine_1based_in_svelte, column: finalOriginalColumn_0based_in_svelte + (col - generatedColumn_0based) }
          });
          if (currentSegmentIsFunction) { // Log fill IF the main segment was 'function'
            console.log(`[MAP_TO_V3_PER_CHAR_FILL_FUNCTION_DETAIL_SEG ${svelteFilePath}] Filled for FUNCTION segment (base GenCol ${mappingGeneratedColumn}): Gen L${generatedLine_0based + 1}C${fillMappingGeneratedColumn} -> Svelte L${finalOriginalLine_1based_in_svelte}C${finalOriginalColumn_0based_in_svelte + (col - currentSegmentGeneratedColumn_forLog)}`);
          }
        }
        lastProcessedGeneratedColumn = generatedColumn_0based;
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
      console.log(`[MAP_TO_V3_DECODED_DEBUG_FOO1 ${svelteFilePath}] Segment for generatedColumn 8: ${JSON.stringify(foo1Seg)}`);
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