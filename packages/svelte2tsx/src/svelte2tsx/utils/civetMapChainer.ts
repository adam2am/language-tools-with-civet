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

// Chain Civet source map into base Svelte→TSX map using trace-mapping and sourcemap-codec.
const chainCivetDebug = true;
export function chainSourceMaps(
    baseMap: EncodedSourceMap,
    civetMap: EncodedSourceMap,
    _tsStartInSvelteWithTs: number,
    _tsEndInSvelteWithTs: number
): EncodedSourceMap {
    if (chainCivetDebug) console.log('[chainSourceMaps] Start chaining Civet map');
    // Decode the base mappings and create a tracer for the Civet map
    const baseDecoded = decode(baseMap.mappings);
    if (chainCivetDebug) console.log('[chainSourceMaps] Decoded baseMap:', JSON.stringify(baseDecoded, null, 2));
    const tracer = new TraceMap({
      version: 3,
      sources: civetMap.sources,
      names: civetMap.names,
      mappings: civetMap.mappings,
      file: civetMap.file,
      sourcesContent: civetMap.sourcesContent,
    });
    if (chainCivetDebug) console.log('[chainSourceMaps] Initialized tracer with civetMap mappings:', civetMap.mappings);
    // Remap each segment: build a full-5-tuple for every mapping
    const remapped: [number, number, number, number, number][][] = baseDecoded.map(
      (lineSegments, lineIndex) => {
        if (chainCivetDebug) console.log(`[chainSourceMaps] Processing generated line ${lineIndex+1}`, lineSegments);
        return lineSegments.map((segment) => {
          if (chainCivetDebug) console.log('[chainSourceMaps] Segment before trace:', segment);
          const [genCol, srcIdx, origLine, origCol, nameIdx] = segment;
          let traced: readonly number[] | null;
          try {
            traced = traceSegment(tracer, origLine, origCol);
          } catch {
            traced = null;
          }
          if (traced && traced.length >= 4) {
            if (chainCivetDebug) console.log(`[chainSourceMaps] Traced (${origLine},${origCol}) -> (${traced[2]},${traced[3]})`);
            const [, , newLine, newCol] = traced;
            return [genCol, 0, newLine, newCol, nameIdx ?? 0] as [number, number, number, number, number];
          }
          if (chainCivetDebug) console.log('[chainSourceMaps] No trace for segment, using original');
          // Fallback: preserve original segment fully (ensure 5 elements)
          const [g, s, oL, oC, n] = segment;
          return [g, s, oL, oC, n] as [number, number, number, number, number];
        });
      }
    );
    if (chainCivetDebug) console.log('[chainSourceMaps] Remapped segments:', JSON.stringify(remapped, null, 2));
    // Encode the merged mappings
    const mappings = encode(remapped);
    if (chainCivetDebug) console.log('[chainSourceMaps] Encoded chained mappings:', mappings);
    return {
      ...baseMap,
      mappings,
      sources: baseMap.sources,
      sourcesContent: baseMap.sourcesContent,
      names: baseMap.names,
    };
} 