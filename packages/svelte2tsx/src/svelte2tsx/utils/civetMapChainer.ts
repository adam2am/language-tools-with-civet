// Define the source map interface locally
import { decode, encode } from '@jridgewell/sourcemap-codec';
import { TraceMap, traceSegment } from '@jridgewell/trace-mapping';

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
  constructor(content: string) {
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
    console.log('[chainMaps] Starting refactored chaining.');
    console.log('[chainMaps] BaseMap sources:', baseMap.sources);
    console.log('[chainMaps] Number of blocks:', blocks.length);
    blocks.forEach((block, i) => console.log(`[chainMaps] Block ${i}: originalLines=${block.originalCivetLineCount}, compiledLines=${block.compiledTsLineCount}, tsStartChar=${block.tsStartCharInSvelteWithTs}, tsEndChar=${block.tsEndCharInSvelteWithTs}, tsStartLine=${block.tsStartLineInSvelteWithTs}`));
  }

  const svelteWithTsLineOffsets = new LineOffsetCalculator(svelteWithTsContent);
  const decodedBaseMap = decode(baseMap.mappings);
  if (chainCivetDebug && logOptions.decodedBase) console.log('[chainMaps] Decoded baseMap segments (first 5 lines):', JSON.stringify(decodedBaseMap.slice(0,5)));

  const blockTracers = blocks.map(block => new TraceMap({
    version: 3,
    sources: block.map.sources,
    names: block.map.names,
    mappings: block.map.mappings,
    file: block.map.file,
    sourcesContent: block.map.sourcesContent
  }));

  const cumulativeLineDeltas: number[] = [0]; 
  let currentCumulativeDelta = 0;
  for (let i = 0; i < blocks.length; i++) {
    // Note: This delta is calculated based on line counts passed from preprocessCivet.
    // It reflects the change in line count from original Civet to compiled TS for that block.
    currentCumulativeDelta += (blocks[i].compiledTsLineCount - blocks[i].originalCivetLineCount);
    cumulativeLineDeltas.push(currentCumulativeDelta);
  }

  const remappedLines: number[][][] = [];

  for (const lineSegments of decodedBaseMap) {
    // Pre-filter baseMap segments
    const scriptSegments: { segment: number[]; charOffset: number; blockIndex: number }[] = [];
    const templateSegments: { segment: number[]; charOffset: number }[] = [];
    for (const segment of lineSegments) {
      const [, , origLine0, origCol0] = segment;
      const charOffset = svelteWithTsLineOffsets.getOffset(origLine0 + 1, origCol0);
      // Find which block, if any, this offset belongs to
      let blockIndex = -1;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (charOffset >= b.tsStartCharInSvelteWithTs && charOffset < b.tsEndCharInSvelteWithTs) {
          blockIndex = i;
          break;
        }
      }
      if (blockIndex >= 0) {
        scriptSegments.push({ segment, charOffset, blockIndex });
      } else {
        templateSegments.push({ segment, charOffset });
      }
    }
    // Remap script segments via trace-mapping
    const remappedScript: number[][] = [];
    for (const { segment, blockIndex } of scriptSegments) {
      const [generatedCol, , origLine0, origCol0, nameIndex] = segment;
      const block = blocks[blockIndex];
      const tracer = blockTracers[blockIndex];
      if (chainCivetDebug && logOptions.segmentTrace) {
        const baseSegmentName = (nameIndex != null && baseMap.names[nameIndex] !== undefined)
          ? baseMap.names[nameIndex]
          : 'undefined';
        // console.log(`[chainMaps] BaseMap segment nameIndex=${nameIndex}, name=${baseSegmentName}`); // REVERTED
      }
      const relLine = (origLine0 + 1) - block.tsStartLineInSvelteWithTs;
      const relCol = relLine === 0
        ? origCol0 - block.tsStartColInSvelteWithTs
        : origCol0;
      let traced: readonly number[] | null = null;
      try {
        traced = traceSegment(tracer, relLine, Math.max(0, relCol));
      } catch { }
      if (chainCivetDebug && logOptions.segmentTrace) {
        const civetNameIndex = (traced && traced.length > 4) ? traced[4] : undefined;
        const civetName = (civetNameIndex != null && block.map.names && block.map.names[civetNameIndex] !== undefined)
          ? block.map.names[civetNameIndex]
          : 'undefined';
        console.log(`[chainMaps] traceSegment returned traced=${JSON.stringify(traced)}, civetNameIndex=${civetNameIndex}, civetName=${civetName}`);
      }
      if (traced && traced.length >= 4) {
        // Classify segment: propagate nameIndex for identifiers (nameIndex!=null), drop for keywords
        const finalNameIndex = nameIndex != null ? nameIndex : undefined;

        // REVERTED focused log for foo1
        // if (chainCivetDebug && generatedCol === 8 && traced[2] === 1 && traced[3] === 9) {
        //     console.log(`[chainMaps] PUSHING to remappedScript for TSX genCol ${generatedCol}: [${generatedCol}, 0, ${traced[2]}, ${traced[3]}, ${finalNameIndex === undefined ? 'undef' : finalNameIndex}]`);
        // }

        remappedScript.push([generatedCol, 0, traced[2], traced[3], finalNameIndex]);
      } else {
        // Fallback: map to start of script block in original Svelte
        remappedScript.push([generatedCol, 0, block.tsStartLineInSvelteWithTs - 1, 0, nameIndex]);
      }
    }
    // Remap template segments by adjusting line delta
    const remappedTemplate: number[][] = [];
    for (const { segment, charOffset } of templateSegments) {
      const [generatedCol, , origLine0, origCol0, nameIndex] = segment;
      let delta = 0;
      for (let k = 0; k < blocks.length; k++) {
        if (charOffset < blocks[k].tsStartCharInSvelteWithTs) {
          delta = cumulativeLineDeltas[k];
          break;
        }
        delta = cumulativeLineDeltas[k + 1];
      }
      remappedTemplate.push([generatedCol, 0, origLine0 - delta, origCol0, nameIndex]);
    }
    // Merge and sort segments by generated column
    const merged = remappedScript.concat(remappedTemplate).sort((a, b) => a[0] - b[0]);
    remappedLines.push(merged);
  }

  if (chainCivetDebug && logOptions.remappedSegments) console.log('[chainMaps] Remapped segments (first 5 lines):', JSON.stringify(remappedLines.slice(0,5)));
  if (chainCivetDebug && logOptions.remappedSummary) {
    console.log('[chainMaps] Remapped summary (first 5 lines):');
    remappedLines.slice(0,5).forEach((line, i) => console.log(`  Line ${i+1}: ${JSON.stringify(line)}`));
  }
  
  const finalEncodedMappings = encode(remappedLines as any);
  if (chainCivetDebug && logOptions.encodedOutput) console.log('[chainMaps] Final encoded mappings:', finalEncodedMappings.slice(0,100) + "...");

  if (chainCivetDebug) {
    const decodedFinal = decode(finalEncodedMappings);
    console.log('[chainMaps] Final decoded mappings (first 3 lines):', JSON.stringify(decodedFinal.slice(0,3), null, 2));
  }

  return {
    version: 3,
    sources: [baseMap.sources[0]], 
    sourcesContent: [originalSvelteContent],
    names: baseMap.names,
    mappings: finalEncodedMappings,
    file: baseMap.file 
  };
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