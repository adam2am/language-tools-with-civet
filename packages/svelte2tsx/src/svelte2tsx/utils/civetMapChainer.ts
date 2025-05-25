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

// Chain Civet source map into base Svelte→TSX map using trace-mapping and sourcemap-codec.
export function chainSourceMaps(
    baseMap: EncodedSourceMap,
    civetMap: EncodedSourceMap,
    _tsStartInSvelteWithTs: number,
    _tsEndInSvelteWithTs: number
): EncodedSourceMap {
    if (chainCivetDebug && logOptions.input) console.log('[chainSourceMaps] Start chaining Civet map');
    // Decode the base mappings and create a tracer for the Civet map
    const baseDecoded = decode(baseMap.mappings);
    if (chainCivetDebug && logOptions.decodedBase) console.log('[chainSourceMaps] Decoded baseMap:', JSON.stringify(baseDecoded, null, 2));
    const tracer = new TraceMap({
      version: 3,
      sources: civetMap.sources,
      names: civetMap.names,
      mappings: civetMap.mappings,
      file: civetMap.file,
      sourcesContent: civetMap.sourcesContent,
    });
    if (chainCivetDebug && logOptions.tracerInit) console.log('[chainSourceMaps] Initialized tracer with civetMap mappings:', civetMap.mappings);
    // Remap each segment: build a full-5-tuple for every mapping
    const remapped: [number, number, number, number, number][][] = baseDecoded.map(
      (lineSegments, lineIndex) => {
        if (chainCivetDebug && logOptions.lineProcessing) console.log(`[chainSourceMaps] Processing generated line ${lineIndex+1}`, lineSegments);
        return lineSegments.map((segment) => {
          if (chainCivetDebug && logOptions.segmentTrace) console.log('[chainSourceMaps] Segment before trace:', segment);
          // Skip the source index since we always remap to baseMap.sources
          const [genCol, _baseMapSourceIndex, origLine_fromBaseMap, origCol_fromBaseMap, nameIdx] = segment; // Unpack fully for clarity
          let traced: readonly number[] | null;
          try {
            // traceSegment expects 0-indexed line and column
            traced = traceSegment(tracer, origLine_fromBaseMap, origCol_fromBaseMap);
          } catch {
            traced = null;
          }

          if (chainCivetDebug) {
            const tracedL = traced ? traced[2] + 1 : 'null';
            const tracedC = traced ? traced[3] : 'null';
            console.log(`[chainSourceMaps] BaseMap Segment (gen L${lineIndex + 1}C${genCol}, orig (svelteWithTs) L${origLine_fromBaseMap + 1}C${origCol_fromBaseMap}) -> CivetMap Traced Original (Svelte) L${tracedL}C${tracedC}`);
          }

          if (traced && traced.length >= 4) {
            if (chainCivetDebug && logOptions.segmentTrace) console.log(`[chainSourceMaps] Traced (${origLine_fromBaseMap},${origCol_fromBaseMap}) -> (${traced[2]},${traced[3]})`);
            const [, , newLine, newCol] = traced;
            // Ensure newLine and newCol are 0-indexed if they came from traceSegment
            return [genCol, 0, newLine, newCol, nameIdx ?? 0] as [number, number, number, number, number];
          }
          if (chainCivetDebug && logOptions.segmentTrace) console.log('[chainSourceMaps] No trace for segment, using original');
          // Fallback: preserve original segment fully (ensure 5 elements)
          // Segment from baseMap is already [genCol, sourceIdx, origLine, origCol, nameIdx?]
          // We just need to ensure the sourceIndex is 0 if we couldn't trace it, though typically it should be.
          return [genCol, _baseMapSourceIndex, origLine_fromBaseMap, origCol_fromBaseMap, nameIdx ?? 0] as [number, number, number, number, number];
        });
      }
    );
    if (chainCivetDebug && logOptions.remappedSegments) console.log('[chainSourceMaps] Remapped segments:', JSON.stringify(remapped, null, 2));
    // Encode the merged mappings
    const mappings = encode(remapped);
    if (chainCivetDebug && logOptions.encodedOutput) console.log('[chainSourceMaps] Encoded chained mappings:', mappings);
    return {
      ...baseMap,
      mappings,
      sources: baseMap.sources,
      sourcesContent: baseMap.sourcesContent,
      names: baseMap.names,
    };
} 