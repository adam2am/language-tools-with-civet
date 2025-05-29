// Define the source map interface locally
import { decode, encode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor, traceSegment } from '@jridgewell/trace-mapping';
import { GenMapping, addSegment, toEncodedMap, setSourceContent } from '@jridgewell/gen-mapping';

export interface EncodedSourceMap {
  version: number;
  sources: string[];
  names: string[];
  mappings: string;
  file?: string;
  sourcesContent?: string[];
}

// A mapping block from a Civet-generated map to apply
export interface EnhancedChainBlock {
  map: EncodedSourceMap;
  tsStartCharInSvelteWithTs: number;
  tsEndCharInSvelteWithTs: number;
  tsStartLineInSvelteWithTs: number; // 1-based
  tsStartColInSvelteWithTs: number;  // 0-based
  tsEndLineInSvelteWithTs: number;   // 1-based
  originalCivetLineCount: number;
  compiledTsLineCount: number;
}

const chainCivetDebug = true; // Debug enabled for pipeline inspection

const logOptions = {
  input: true,     // log input baseMap and blocks
  decodedBase: true, 
  tracerInit: true,
  lineProcessing: true,
  segmentTrace: true, // log each segment guard and result
  remappedSegments: true,
  remappedSummary: true, 
  encodedOutput: true
};

class LineOffsetCalculator {
  private lineOffsets: number[];
  private content: string;
  constructor(content: string) {
      this.content = content;
      this.lineOffsets = [0]; // First line starts at offset 0
      for (let i = 0; i < content.length; i++) {
          if (content[i] === '\n') {
              this.lineOffsets.push(i + 1);
          }
      }
  }

  getOffset(line1Based: number, col0Based: number): number {
      if (line1Based < 1 || line1Based > this.lineOffsets.length) {
          if (chainCivetDebug) console.warn(`[LineOffsetCalculator] Line ${line1Based} out of bounds (1-${this.lineOffsets.length}). Clamping.`);
          line1Based = Math.max(1, Math.min(line1Based, this.lineOffsets.length));
      }
      const lineStartOffset = this.lineOffsets[line1Based - 1];
      return lineStartOffset + col0Based;
  }

  // Helper to get 0-indexed line and column from a character offset
  getLineAndColumn(charOffset: number): { line0: number; col0: number } {
    let line0 = this.lineOffsets.findIndex(offset => offset > charOffset);
    if (line0 === -1) {
        line0 = this.lineOffsets.length; // It's on the last line or beyond
    }
    line0 = line0 -1; // Convert to 0-indexed line
    if (line0 <0) line0 = 0; // Should not happen if charOffset is valid

    const lineStartOffset = this.lineOffsets[line0];
    const col0 = charOffset - lineStartOffset;
    return { line0, col0 };
  }
}

/**
 * Chain multiple Civet-generated source maps into a base map.
 * This runs synchronously using trace-mapping and sourcemap-codec.
 * This new version correctly handles line shifts for template content.
 */
export function chainMaps(
  baseMap: EncodedSourceMap,
  blocks: EnhancedChainBlock[], // Assumed sorted by tsStartCharInSvelteWithTs
  originalSvelteContent: string,
  svelteWithTsContent: string // Content to which baseMap's original_lines/cols refer
): EncodedSourceMap {
  if (chainCivetDebug && logOptions.input) {
    console.log('[chainMaps GenMapping] Starting.');
    console.log('[chainMaps GenMapping] BaseMap sources:', baseMap.sources);
    console.log('[chainMaps GenMapping] Number of blocks:', blocks.length);
    blocks.forEach((block, i) => console.log(`[chainMaps GenMapping] Block ${i}: tsStartChar=${block.tsStartCharInSvelteWithTs}, tsEndChar=${block.tsEndCharInSvelteWithTs}, tsStartLine=${block.tsStartLineInSvelteWithTs}, compiledTsLineCount=${block.compiledTsLineCount}`));
  }

  const generator = new GenMapping({ file: baseMap.file, sourceRoot: baseMap.sourceRoot });
  const finalSourcePath = baseMap.sources[0]; // Assuming this is the .svelte file path
  // Set source content for the final map. GenMapping uses 0-indexed source indices.
  // addSegment will add the source if it's new, then we can set its content.
  // For now, we only have one source: the original .svelte file.
  // The addSegment calls will use finalSourcePath. We'll call setSourceContent once.

  const svelteWithTsLineOffsets = new LineOffsetCalculator(svelteWithTsContent);
  const decodedBaseMapLines = decode(baseMap.mappings);
  if (chainCivetDebug && logOptions.decodedBase) console.log('[chainMaps GenMapping] Decoded baseMap segments (first 5 lines):', JSON.stringify(decodedBaseMapLines.slice(0,5)));

  const blockTracers = blocks.map(block => new TraceMap(block.map)); // block.map is normalizedMap

  const cumulativeLineDeltas: number[] = [0]; 
  let currentCumulativeDelta = 0;
  for (let i = 0; i < blocks.length; i++) {
    currentCumulativeDelta += (blocks[i].compiledTsLineCount - blocks[i].originalCivetLineCount);
    cumulativeLineDeltas.push(currentCumulativeDelta);
  }

  for (let genLineIdx_TSX = 0; genLineIdx_TSX < decodedBaseMapLines.length; genLineIdx_TSX++) {
    const baseLineSegments = decodedBaseMapLines[genLineIdx_TSX];
    for (const baseSegment of baseLineSegments) {
      const genCol_TSX = baseSegment[0];
      // baseSegment: [genColInTSX, srcIdxInBaseMap, origLineInSvelteWithTs, origColInSvelteWithTs, nameIdxInBaseMap?]

      const origSourceIdxInBaseMap = baseSegment[1]; // Should typically be 0, pointing to svelteWithTsContent via baseMap.sources
      const origLine0_SvelteWithTs = baseSegment[2]; // 0-indexed line in svelteWithTsContent
      const origCol0_SvelteWithTs = baseSegment[3];   // 0-indexed col in svelteWithTsContent
      const nameIdxInBaseMap = baseSegment.length >= 5 ? baseSegment[4] : undefined;
      const nameStrInBaseMap = nameIdxInBaseMap !== undefined && baseMap.names ? baseMap.names[nameIdxInBaseMap] : undefined;

      // Determine if this baseMap original target (in svelteWithTsContent) falls into a Civet block
      const charOffset_SvelteWithTs = svelteWithTsLineOffsets.getOffset(origLine0_SvelteWithTs + 1, origCol0_SvelteWithTs);
      
      let owningBlockIndex = -1;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (charOffset_SvelteWithTs >= b.tsStartCharInSvelteWithTs && charOffset_SvelteWithTs < b.tsEndCharInSvelteWithTs) {
          owningBlockIndex = i;
          break;
        }
      }

      if (owningBlockIndex !== -1) {
        // Target is within a Civet-processed block. Trace it back to original Svelte Civet.
        const block = blocks[owningBlockIndex];
        const tracer_NormalizedMap = blockTracers[owningBlockIndex]; // Tracer for normalizedMap (Svelte Civet -> Civet's TS output)

        // The (origLine0_SvelteWithTs, origCol0_SvelteWithTs) are coordinates in svelteWithTsContent.
        // This svelteWithTsContent *is* where the Civet-generated TS snippet lives.
        // We need to make these coordinates relative to the start of that specific Civet TS snippet
        // to use them as "generated" coordinates for normalizedMap.
        
        // Get 0-indexed line/col of where the Civet TS output starts in svelteWithTsContent
        const civetTsStartPos_InSvelteWithTs = svelteWithTsLineOffsets.getLineAndColumn(block.tsStartCharInSvelteWithTs);
        
        const genLineInCivetTSSnippet_0based = origLine0_SvelteWithTs - civetTsStartPos_InSvelteWithTs.line0;
        let genColInCivetTSSnippet_0based = origCol0_SvelteWithTs;
        if (origLine0_SvelteWithTs === civetTsStartPos_InSvelteWithTs.line0) { // If on the same line as snippet start
            genColInCivetTSSnippet_0based -= civetTsStartPos_InSvelteWithTs.col0;
        }
        genColInCivetTSSnippet_0based = Math.max(0, genColInCivetTSSnippet_0based);

        if (chainCivetDebug && logOptions.segmentTrace && genCol_TSX === 8 && genLineIdx_TSX === 2 /* TSX L3 -> foo1 */) { // Adjusted for 0-indexed genLineIdx_TSX
             console.log(`[chainMaps GenMapping] foo1 TRACE: TSX L${genLineIdx_TSX+1}C${genCol_TSX} maps to SvelteWithTS L${origLine0_SvelteWithTs+1}C${origCol0_SvelteWithTs}`);
             console.log(`    Block ${owningBlockIndex}: tsStartLineInSvelteWithTs=${block.tsStartLineInSvelteWithTs} (1-based), tsStartColInSvelteWithTs=${block.tsStartColInSvelteWithTs} (0-based)`);
             console.log(`    civetTsStartPos_InSvelteWithTs (0-based in svelteWithTs): L${civetTsStartPos_InSvelteWithTs.line0}C${civetTsStartPos_InSvelteWithTs.col0}`);
             console.log(`    Querying normalizedMap with (generated) CivetTS snippet L${genLineInCivetTSSnippet_0based+1}C${genColInCivetTSSnippet_0based}`);
        }

        // Query normalizedMap: (Original Svelte Civet) -> (Civet's TS output snippet)
        // We provide generated coords from Civet's TS output snippet, get original Svelte Civet coords.
        const finalOriginalSveltePos = originalPositionFor(tracer_NormalizedMap, {
          line: genLineInCivetTSSnippet_0based + 1, // originalPositionFor expects 1-based line
          column: genColInCivetTSSnippet_0based    // and 0-based column
        });

        if (chainCivetDebug && logOptions.segmentTrace && genCol_TSX === 8 && genLineIdx_TSX === 2) {
            console.log(`    normalizedMap (SvelteCivet->CivetTS) returned for CivetTS L${genLineInCivetTSSnippet_0based+1}C${genColInCivetTSSnippet_0based}: SvelteCivet L${finalOriginalSveltePos?.line}C${finalOriginalSveltePos?.column}`);
        }

        if (finalOriginalSveltePos && finalOriginalSveltePos.line !== null && finalOriginalSveltePos.column !== null) {
          addSegment(
            generator,
            genLineIdx_TSX,         // 0-indexed gen line in final TSX
            genCol_TSX,             // 0-indexed gen col in final TSX
            finalSourcePath,        // Path to original .svelte file
            finalOriginalSveltePos.line - 1, // 0-indexed original line in .svelte
            finalOriginalSveltePos.column,   // 0-indexed original col in .svelte
            nameStrInBaseMap        // Name from baseMap
          );
        } else {
          // Fallback if normalizedMap has no specific mapping for this Civet-TS point.
          // Map to the start of the original Civet script within the original Svelte file.
          // This requires knowing where the original Civet snippet started in originalSvelteContent.
          // block.map.sources[0] should be original .svelte file if normalizedMap set it.
          // The block.tsStartCharInSvelteWithTs is for svelteWithTsContent, not originalSvelteContent.
          // This fallback needs the original char offset of the Civet snippet.
          // For now, as a rough fallback, map to line 0, or omit.
          // A better fallback might be the line where the civet script tag started.
          // Let's try to map to the line where the block started in the original svelte, if possible.
          // This info is not directly on `EnhancedChainBlock` right now.
          // For now, omit segment if no precise trace.
           if (chainCivetDebug) console.warn(`[chainMaps GenMapping] No precise mapping from normalizedMap for TSX L${genLineIdx_TSX+1}C${genCol_TSX}. Target in CivetTS: L${genLineInCivetTSSnippet_0based+1}C${genColInCivetTSSnippet_0based}. Omitting segment.`);
        }
      } else {
        // Target is *outside* a Civet block (e.g., in template).
        // Use original mapping from baseMap, adjusting line for cumulative delta from Civet blocks.
        const sourcePathInBaseMap = baseMap.sources[origSourceIdxInBaseMap];
        if (sourcePathInBaseMap !== finalSourcePath) {
             if (chainCivetDebug) console.warn(`[chainMaps GenMapping] baseMap segment points to unexpected source: ${sourcePathInBaseMap}. Expected ${finalSourcePath}. TSX L${genLineIdx_TSX+1}C${genCol_TSX}. Segment: ${JSON.stringify(baseSegment)}`);
            // If baseMap points to another source, we'd need to handle that (e.g. add that source to generator too)
            // For now, assuming all relevant baseMap originals point to the svelte file.
            // If not, this mapping will be lost or incorrect.
            continue; 
        }

        let adjustedOrigLine0_Svelte = origLine0_SvelteWithTs;
        // Find the correct delta based on which blocks precede this svelteWithTs line.
        // The charOffset_SvelteWithTs can be used here.
        let applicableDelta = 0;
        for (let k = 0; k < blocks.length; k++) {
            if (charOffset_SvelteWithTs < blocks[k].tsStartCharInSvelteWithTs) { // If this mapping is BEFORE block k
                applicableDelta = cumulativeLineDeltas[k]; // Use delta accumulated up to block k-1
                break;
            }
            // If after the last block, or between blocks, use the delta after the last relevant block
            applicableDelta = cumulativeLineDeltas[k + 1]; 
        }
        adjustedOrigLine0_Svelte -= applicableDelta;


        addSegment(
          generator,
          genLineIdx_TSX,
          genCol_TSX,
          finalSourcePath,
          adjustedOrigLine0_Svelte, // Original line in .svelte, adjusted for line shifts
          origCol0_SvelteWithTs,    // Original col in .svelte (col is not affected by line shifts)
          nameStrInBaseMap
        );
      }
    }
  }

  // After all segments are added, set the source content for the .svelte file.
  // gen-mapping's addSegment adds sources by path. We need to find the index it assigned.
  const genMapInstance = generator as any; // Access internal fields for finding source index
  let svelteSourceIdxInGenerator = -1;
  if (genMapInstance._sources?.indexOf === 'function') { // Check if _sources is an array (it should be)
      svelteSourceIdxInGenerator = genMapInstance._sources.indexOf(finalSourcePath);
  } else if (genMapInstance._sourcesCache?.has(finalSourcePath) && typeof genMapInstance._sourcesCache.get(finalSourcePath) === 'number') { // newer gen-mapping might use _sourcesCache
      svelteSourceIdxInGenerator = genMapInstance._sourcesCache.get(finalSourcePath);
  }


  if (svelteSourceIdxInGenerator !== -1) {
    setSourceContent(generator, finalSourcePath, originalSvelteContent);
  } else if (finalSourcePath && decodedBaseMapLines.flat().length > 0) { // Only warn if there were mappings but source wasn't added
      if (chainCivetDebug) console.warn(`[chainMaps GenMapping] finalSourcePath "${finalSourcePath}" not found in generator's sources. sourcesContent will be incorrect. Sources: ${JSON.stringify(genMapInstance._sources)}`);
  }


  const finalEncodedMap = toEncodedMap(generator);
  // Ensure names and sourcesContent are correctly part of the final map structure.
  // `toEncodedMap` should handle names if `addSegment` was called with names.
  // We need to ensure `sources` and `sourcesContent` are correctly populated.
  finalEncodedMap.sources = [finalSourcePath]; // Should be set by GenMapping if segments were added
  finalEncodedMap.sourcesContent = [originalSvelteContent];
  finalEncodedMap.names = baseMap.names; // Prefer names from baseMap as they relate to the final TSX

  if (chainCivetDebug && logOptions.encodedOutput) console.log('[chainMaps GenMapping] Final encoded mappings:', finalEncodedMap.mappings.slice(0,200) + "...");
  if (chainCivetDebug && logOptions.remappedSummary) {
    const decodedFinal = decode(finalEncodedMap.mappings);
    console.log('[chainMaps GenMapping] Final decoded mappings (first 5 lines):', JSON.stringify(decodedFinal.slice(0,5), null, 2));
  }

  return finalEncodedMap;
}

// For backward compatibility: single-block chaining
// This function's old signature is insufficient for the new chainMaps logic.
// It would need full EnhancedChainBlock details.
// If svelte2tsx/index.ts is updated to call the main chainMaps directly, this might become obsolete.
// For now, it's updated to accept parts of EnhancedChainBlock, but it might not be practically callable
// without significant changes at its call sites if they don't have all this information.
export function chainSourceMaps(
  baseMap: EncodedSourceMap,
  blockDetails: Omit<EnhancedChainBlock, 'map'> & { map: EncodedSourceMap },
  originalSvelteContent: string,
  svelteWithTsContent: string
): EncodedSourceMap {
  const block: EnhancedChainBlock = {
    map: blockDetails.map,
    tsStartCharInSvelteWithTs: blockDetails.tsStartCharInSvelteWithTs,
    tsEndCharInSvelteWithTs: blockDetails.tsEndCharInSvelteWithTs,
    tsStartLineInSvelteWithTs: blockDetails.tsStartLineInSvelteWithTs,
    tsStartColInSvelteWithTs: blockDetails.tsStartColInSvelteWithTs,
    tsEndLineInSvelteWithTs: blockDetails.tsEndLineInSvelteWithTs,
    originalCivetLineCount: blockDetails.originalCivetLineCount,
    compiledTsLineCount: blockDetails.compiledTsLineCount,
  };
  return chainMaps(baseMap, [block], originalSvelteContent, svelteWithTsContent);
} 