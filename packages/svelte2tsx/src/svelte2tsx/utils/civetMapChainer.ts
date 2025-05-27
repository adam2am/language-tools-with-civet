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
export interface ChainBlock {
  map: EncodedSourceMap;
  tsStart: number;
  tsEnd: number;
}

const chainCivetDebug = true; // Master switch for all logs in this file (enabled for debugging)

const logOptions = {
  input: true,     // Logs input baseMap and civetMap details
  decodedBase: false, // Logs decoded baseMap segments
  tracerInit: false,  // Logs civetMap details used for TraceMap initialization
  lineProcessing: false, // Verbose: logs each generated line before remapping segments
  segmentTrace: false,   // Verbose: logs individual segment tracing (before/after/no trace)
  remappedSegments: false,   // Verbose: logs the entire remapped segments array
  remappedSummary: true, // Logs a summary of the first 5 lines of remapped segments
  encodedOutput: true  // Logs the final encoded mappings string
};

/**
 * Chain multiple Civet-generated source maps into a base map.
 * This runs synchronously using trace-mapping and sourcemap-codec.
 */
export function chainMaps(
  baseMap: EncodedSourceMap,
  blocks: ChainBlock[]
): EncodedSourceMap {
  if (chainCivetDebug && logOptions.input) console.log('[chainMaps] Starting chaining of Civet blocks');
  // Decode base mappings once
  let decoded = decode(baseMap.mappings);
  if (chainCivetDebug && logOptions.decodedBase) console.log('[chainMaps] Decoded baseMap:', JSON.stringify(decoded, null, 2));
  // For each Civet block, remap segments
  for (const { map: civetMap } of blocks) {
    if (chainCivetDebug && logOptions.tracerInit) console.log('[chainMaps] Init tracer with block mappings');
    const tracer = new TraceMap({
      version: 3,
      sources: civetMap.sources,
      names: civetMap.names,
      mappings: civetMap.mappings,
      file: civetMap.file,
      sourcesContent: civetMap.sourcesContent,
    });
    decoded = decoded.map((lineSegments, lineIndex) => {
      if (chainCivetDebug && logOptions.lineProcessing) console.log(`[chainMaps] Processing gen line ${lineIndex+1}`);
      return lineSegments.map((segment) => {
        if (chainCivetDebug && logOptions.segmentTrace) console.log('[chainMaps] Segment before trace:', segment);
        const [genCol, sourceIdx, origLine, origCol, nameIdx] = segment as [number, number, number, number, number];
        let traced: readonly number[] | null = null;
        try {
          traced = traceSegment(tracer, origLine, origCol);
        } catch {
          /* no trace available */
        }
        if (traced && traced.length >= 4) {
          const [, , newLine, newCol] = traced;
          return [genCol, 0, newLine, newCol, nameIdx] as [number, number, number, number, number];
        }
        // fallback to original segment
        return [genCol, sourceIdx, origLine, origCol, nameIdx] as [number, number, number, number, number];
      });
    });
  }
  // Encode the merged mappings
  const mappings = encode(decoded);
  if (chainCivetDebug && logOptions.encodedOutput) console.log('[chainMaps] Encoded chained mappings:', mappings);
  // Return a new source map preserving baseMap metadata
  return { ...baseMap, mappings };
}

// For backward compatibility: single-block chaining
export function chainSourceMaps(
  baseMap: EncodedSourceMap,
  civetMap: EncodedSourceMap,
  tsStart: number,
  tsEnd: number
): EncodedSourceMap {
  return chainMaps(baseMap, [{ map: civetMap, tsStart, tsEnd }]);
} 