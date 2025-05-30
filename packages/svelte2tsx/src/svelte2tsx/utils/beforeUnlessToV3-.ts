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
 * @param civetSnippetSvelteLineOffset 0-based line number where the civet snippet started in the .svelte file.
 * @param svelteFilePath The actual file path of the .svelte file (for the output sourcemap's `sources` and `file` fields).
 * @returns A Standard V3 RawSourceMap that maps from the original .svelte file to the compiled TS snippet.
 */
export function normalizeCivetMap(
  civetMap: CivetLinesSourceMap,
  originalFullSvelteContent: string,
  civetSnippetSvelteLineOffset: number, // This offset already points to the first *actual code line* in Svelte
  svelteFilePath: string
): EncodedSourceMap {
  console.log(`[MAP_TO_V3 ${svelteFilePath}] Normalizing Civet map. Snippet line offset in Svelte (0-based): ${civetSnippetSvelteLineOffset}`);

  // Detailed debug for our failing fixture
  if (svelteFilePath.includes('twoFooUserRequest.svelte')) {
    // Log the raw Civet snippet source
    console.log(`[MAP_TO_V3_DEBUG] Civet snippet source for ${svelteFilePath}:\n${civetMap.source}`);
    // Log the raw mapping lines
    console.log(`[MAP_TO_V3_DEBUG] Civet raw lines for ${svelteFilePath}: ${JSON.stringify(civetMap.lines)}`);
    // Log the corresponding Svelte file lines where the snippet resides
    const tmpSvelteLines = originalFullSvelteContent.split('\n');
    console.log(`[MAP_TO_V3_DEBUG] Svelte snippet lines (line ${civetSnippetSvelteLineOffset + 1} to ${civetSnippetSvelteLineOffset + civetMap.lines.length}):`);
    for (let i = civetSnippetSvelteLineOffset; i < civetSnippetSvelteLineOffset + civetMap.lines.length; i++) {
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
  if (originalFullSvelteContent && civetSnippetSvelteLineOffset >= 0) {
    const svelteLines = originalFullSvelteContent.split('\n');
    if (civetSnippetSvelteLineOffset < svelteLines.length) {
      const snippetLineInSvelte = svelteLines[civetSnippetSvelteLineOffset];
      const match = snippetLineInSvelte.match(/^\s*/);
      if (match) {
        svelteScriptTagIndent = match[0].length;
      }
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Determined svelteScriptTagIndent: ${svelteScriptTagIndent} from Svelte line ${civetSnippetSvelteLineOffset + 1}: "${snippetLineInSvelte.slice(0,30)}..."`);
    } else {
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Could not determine svelteScriptTagIndent: civetSnippetSvelteLineOffset (${civetSnippetSvelteLineOffset}) out of bounds for Svelte lines (${svelteLines.length})`);
    }
  } else {
    console.log(`[MAP_TO_V3 ${svelteFilePath}] Could not determine svelteScriptTagIndent: originalFullSvelteContent empty or civetSnippetSvelteLineOffset negative.`);
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
    civetMap.lines.forEach((lineSegments, tsLineIdx) => {
      if (!lineSegments || lineSegments.length === 0) return;
      console.log(`\n[MAP_TO_V3 ${svelteFilePath}] Processing Generated TS Line (0-based): ${tsLineIdx} (1-based: ${tsLineIdx + 1})`);

      // Log raw segments for this generated line BEFORE any processing
      console.log(`[MAP_TO_V3_RAW_SEGMENTS ${svelteFilePath}] GenLine ${tsLineIdx + 1}: Raw input segments from civetMap.lines: ${JSON.stringify(lineSegments)}`);

      if (lazerFocusDebug) console.log(`\n[normalizeCivetMap DEBUG] Processing Generated Line: ${tsLineIdx + 1}`);

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
      if (lazerFocusDebug) console.log(`[normalizeCivetMap DEBUG] Sorted Segments for Gen Line ${tsLineIdx + 1}:`, JSON.stringify(sortedSegments));
      // Additional log for all segments on this line
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Gen TS Line ${tsLineIdx + 1}: Raw Civet segments for this line: ${JSON.stringify(lineSegments)}`);
      console.log(`[MAP_TO_V3 ${svelteFilePath}] Gen TS Line ${tsLineIdx + 1}: Sorted absolute segments: ${JSON.stringify(sortedSegments.map(s => ({gCol:s.genCol, oLine:s.segment[2]+1, oCol:s.segment[3]})))}`);

      // Phase 1 & 2: precise token start and gap-filling per-character mappings
      let lastProcessedGenCol = -1;
      for (let i = 0; i < sortedSegments.length; i++) {
        const { genCol: tsCol, segment } = sortedSegments[i];
        if (tsCol === lastProcessedGenCol) continue;
        // const nextGenCol = i + 1 < sortedSegments.length ? sortedSegments[i + 1].genCol : tsCol + 1;
        // Determine nextGenCol more carefully: it's current segment's tsCol + length of the TS token it represents
        // However, TS token length is not directly available here. The original approach of using the start of the *next* segment is safer for gap filling.
        const nextTsCol = (i + 1 < sortedSegments.length && sortedSegments[i+1].genCol > tsCol) ? sortedSegments[i+1].genCol : (tsCol + 1);

        // Extract snippet position
        const snippetOrigLine = segment[2]; // 0-based line in Civet snippet
        const snippetOrigCol = segment[3];  // 0-based column in Civet snippet
        const name = segment.length >= 5 && civetMap.names && typeof segment[4] === 'number'
                     ? civetMap.names[segment[4]] 
                     : undefined;
        
        const effectiveSnippetLineIdx = snippetHadLeadingNewline && snippetOrigLine > 0
          ? snippetOrigLine - 1
          : snippetOrigLine;
        
        // 0-based line index in the Svelte file
        const svelteLineIdx = effectiveSnippetLineIdx + civetSnippetSvelteLineOffset;
        const svelteLines = originalFullSvelteContent.split(/\r?\n/);
        const svelteLineText = svelteLines[svelteLineIdx] || '';

        // Calculate indent for the CURRENT Svelte line
        let svelteLineIndent = 0;
        const indentMatch = svelteLineText.match(/^\s*/);
        if (indentMatch) {
          svelteLineIndent = indentMatch[0].length;
        }

        // Determine snippet line text and parse token
        const snippetLines = civetMap.source.split(/\r?\n/);
        const snippetLineText = snippetLines[effectiveSnippetLineIdx] || '';
        const substring = snippetLineText.slice(snippetOrigCol);
        const tokenMatch = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(substring);
        
        let svelteColIdx: number; // 0-based final column in Svelte
        let debugTokenName = ''; 

        const genColForLog = tsCol; // for log clarity
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
          // snippetOrigCol is the column of this token WITHIN the dedented snippet line.
          // We are trying to find this tokenStr on the fully indented svelteLineText.
          let searchStartInSvelte = svelteLineIndent;
          
          const foundIdx = svelteLineText.indexOf(tokenStr, searchStartInSvelte);

          if (debugTokenName) {
            console.log(`[MAP_TO_V3_TOKEN_DEBUG_${debugTokenName} ${svelteFilePath}] Token: '${tokenStr}', OrigCivetLine: ${snippetOrigLine+1}, OrigCivetColInSnippet: ${snippetOrigCol}`);
            console.log(`  SvelteLine (L${svelteLineIdx + 1}): "${svelteLineText}"`);
            console.log(`  CurrentSvelteLineIndent: ${svelteLineIndent}`);
            console.log(`  SearchStartIndexInSvelteLine (currentIndent): ${searchStartInSvelte}`);
            console.log(`  indexOf Result (foundIdx): ${foundIdx}`);
          }

          if (foundIdx !== -1) {
            svelteColIdx = foundIdx;
            if (debugTokenName) console.log(`  Using foundIdx: ${svelteColIdx}`);
          } else {
            // Fallback: If indexOf fails, this means the tokenStr wasn't found at/after svelteLineIndent.
            // This could happen if tokenStr is part of a larger mapped segment (e.g. string literals) or if assumptions are wrong.
            // A safer fallback is svelteLineIndent + snippetOrigCol, though this was problematic.
            // For now, let's log verbosely if indexOf fails for our target tokens.
            svelteColIdx = svelteLineIndent + snippetOrigCol; // Original fallback
            if (debugTokenName) console.log(`  indexOf("${tokenStr}", ${searchStartInSvelte}) FAILED. Defaulting to svelteLineIndent (${svelteLineIndent}) + snippetOrigCol (${snippetOrigCol}) = ${svelteColIdx}`);
          }
        } else {
          // No tokenMatch, typically for whitespace or punctuation segments.
          // Use svelteLineIndent + snippetOrigCol.
          const snippetLineForIndentCalc = snippetLines[effectiveSnippetLineIdx] || '';
          const civetLineIndentMatch = snippetLineForIndentCalc.match(/^\s*/);
          const snippetLineIndent = civetLineIndentMatch ? civetLineIndentMatch[0].length : 0;

          if (snippetOrigCol >= snippetLineIndent) {
            // The character is at or after the Civet line's own internal indent
            svelteColIdx = svelteLineIndent + (snippetOrigCol - snippetLineIndent);
          } else {
            // The character is *within* the Civet line's own internal indent
            svelteColIdx = svelteLineIndent + snippetOrigCol;
          }

          if (svelteFilePath.includes('twoFooUserRequest.svelte') && (name === 'foo1' || name === 'function' || name === 'bar' || name === 'kekw')) {
             console.log(`[MAP_TO_V3_TOKEN_DEBUG_${name ? name.toUpperCase() : 'UNKNOWN_NO_MATCH'} ${svelteFilePath}] No tokenMatch. Fallback to currentIndent + origCivetCol. OrigCivetLine: ${snippetOrigLine+1}, OrigCivetColInSnippet: ${snippetOrigCol}. Segment name: ${name}. Calculated Svelte Col: ${svelteColIdx}`);
          }
          // Debug fallback mapping for hoverInFunction fixture
          if (svelteFilePath.includes('hoverInFunction.svelte')) {
            // Ensure snippetLineText used for char logging is the same one used for indent calc
            const charInSnippet = (snippetLineForIndentCalc[snippetOrigCol] || '');
            const charInSvelte = (svelteLineText[svelteColIdx] || '');
            console.log(`[MAP_TO_V3_FALLBACK_DEBUG ${svelteFilePath}] GenCol ${tsCol}: snippetLine=${snippetOrigLine+1}, snippetCol=${snippetOrigCol}, civetLineInternalIndent=${snippetLineIndent}, currentSvelteLineIndent=${svelteLineIndent}, fallback SvelteCol=${svelteColIdx}, snippetChar='${charInSnippet}', svelteLineChar='${charInSvelte}'`);
          }
        }
        
        // Add mapping for start of segment
        let tsxMapCol = tsCol;
        // If this is the first generated line (0-indexed) AND this segment is not the first segment on that line
        // (indicated by its tsCol being greater than the gCol of the first segment, which is usually 0 for 'function'),
        // then adjust the tsxMapCol.
        // We check `i > 0` to ensure it's not the first segment in `sortedSegments` for this line.
        // REMOVING THIS ADJUSTMENT BLOCK
        // if (tsLineIdx === 0 && i > 0 && sortedSegments[0].genCol < tsCol) {
        //     tsxMapCol = tsCol - 1;
        //     // Optional: Add a log for this adjustment
        //     if (svelteFilePath.includes('twoFooUserRequest.svelte')) {
        //         console.log(`[MAP_TO_V3_ADJUST_GCOL ${svelteFilePath}] Adjusted tsCol for GenL0 token. Original gCol: ${tsCol}, New mappingGCol: ${tsxMapCol}, Token: '${( /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(snippetLineText.slice(segment[3])) || [{toString: ()=>'N/A'}] )[0].toString()}'`);
        //     }
        // }

        if (debugTokenName) {
          console.log(`SEG_GEN_COL ${genColForLog}. Actual token for this specific segment: '${tokenMatch ? tokenMatch[0] : 'NO_TOKEN_MATCH_FOR_LOG'}'. Adding mapping Gen L${tsLineIdx + 1}C${tsxMapCol} -> Svelte L${svelteLineIdx + 1}C${svelteColIdx}`);
        }

        // ULTRA DEBUG FOR FOO1 MAPPING POINT
        if (currentSegmentIsFoo1 && svelteFilePath.includes('twoFooUserRequest.svelte')) {
            console.log(`[MAP_TO_V3_FOO1_PRE_ADDMAPPING ${svelteFilePath}] For foo1:
  genLineForMap: ${tsLineIdx + 1}
  tsxMapCol: ${tsxMapCol} (original GCol in snippet: ${genColForLog})
  svelteLineIdx: ${svelteLineIdx}
  svelteColIdx: ${svelteColIdx}
  debugTokenName: ${debugTokenName}`);
        }

        addMapping(gen, {
          source: svelteFilePath,
          generated: { line: tsLineIdx + 1, column: tsxMapCol },
          original: { line: svelteLineIdx + 1, column: svelteColIdx },
          name
        });
        if (currentSegmentIsFoo1) {
          // Reverting to previous log placement for FOO1, but with more checks.
          const actualTokenForThisSegment = ( /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(snippetLineText.slice(segment[3])) || [{toString: ()=>'NO_TOKEN_MATCH_FOR_LOG'}] )[0].toString();
          if (actualTokenForThisSegment !== 'foo1') {
              console.error(`[!!!! MAP_TO_V3_LOGIC_ERROR_FOO1 !!!! ${svelteFilePath}] SEG_GEN_COL ${genColForLog}: currentSegmentIsFoo1 is TRUE, but actual token for this segment is '${actualTokenForThisSegment}'`);
          }
          console.log(`[MAP_TO_V3_ADD_MAPPING_FOO1_DEBUG_FINAL ${svelteFilePath}] SEG_GEN_COL ${genColForLog}. Actual token for this specific segment: '${actualTokenForThisSegment}'. Adding mapping Gen L${tsLineIdx + 1}C${tsxMapCol} -> Svelte L${svelteLineIdx + 1}C${svelteColIdx}`);
        }
        if (currentSegmentIsFunction) {
          console.log(`[MAP_TO_V3_ADD_MAPPING_FUNCTION_SEG ${svelteFilePath}] SEG_GEN_COL ${genColForLog}: Added mapping for function: Gen L${tsLineIdx + 1}C${tsxMapCol} -> Svelte L${svelteLineIdx + 1}C${svelteColIdx} (name: ${name})`);
          console.log(`[MAP_TO_V3_PER_CHAR_FILL_FUNCTION_SEG ${svelteFilePath}] For FUNCTION segment (base GenCol ${tsxMapCol}), nextTsCol is ${nextTsCol}. Filling from ${tsxMapCol + 1} up to ${nextTsCol}.`);
          console.log(`  Original Svelte base for fill: L${svelteLineIdx + 1}C${svelteColIdx}`);
        }

        // Fill gaps per character until next segment
        // The `nextTsCol` is based on original civet gCols.
        // The `col` for generated mapping also needs to be adjusted if it's the first line.
        if (svelteFilePath.includes('hoverInFunction.svelte') && (tokenMatch && (tokenMatch[0] === 'kekw' || tokenMatch[0] === 'abc'))) {
          console.log(`[MAP_TO_V3_FILL_DEBUG ${svelteFilePath}] Token: '${tokenMatch[0]}', GenLine: ${tsLineIdx + 1}`);
          console.log(`  Looping to fill gaps: tsCol=${tsCol}, nextTsCol=${nextTsCol}`);
          console.log(`  Initial Svelte pos for fill: L${svelteLineIdx + 1}C${svelteColIdx}`);
        }

        for (let col = tsCol + 1; col < nextTsCol; col++) {
          let fillTsxMapCol = col;
          // REMOVING THIS ADJUSTMENT BLOCK AS WELL
          // if (generatedLine_0based === 0 && i > 0 && sortedSegments[0].genCol < col) {
          //   fillMappingGeneratedColumn = col - 1;
          // }

          const fillSvelteCol = svelteColIdx + (col - tsCol);
          if (svelteFilePath.includes('hoverInFunction.svelte') && (tokenMatch && (tokenMatch[0] === 'kekw' || tokenMatch[0] === 'abc'))) {
            // Ensure snippetLineText here is consistent if used.
            console.log(`  FILL: GenL ${tsLineIdx + 1}C${fillTsxMapCol} (orig TS col ${col}) -> SvelteL ${svelteLineIdx + 1}C${fillSvelteCol}`);
          }

          addMapping(gen, {
            source: svelteFilePath,
            generated: { line: tsLineIdx + 1, column: fillTsxMapCol },
            original: { line: svelteLineIdx + 1, column: fillSvelteCol }
          });
          if (currentSegmentIsFunction) { // Log fill IF the main segment was 'function'
            console.log(`[MAP_TO_V3_PER_CHAR_FILL_FUNCTION_DETAIL_SEG ${svelteFilePath}] Filled for FUNCTION segment (base GenCol ${tsxMapCol}): Gen L${tsLineIdx + 1}C${fillTsxMapCol} -> Svelte L${svelteLineIdx + 1}C${fillSvelteCol}`);
          }
        }
        lastProcessedGenCol = tsCol;
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