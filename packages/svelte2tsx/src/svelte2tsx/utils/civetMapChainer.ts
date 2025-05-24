// civetMapChainer.ts - stub implementation for Civet→TSX source-map chaining

// Minimal interface for a V3 source map in this context
export interface EncodedSourceMap {
    version: number;
    sources: string[];
    names: string[];
    mappings: string;
    file?: string;
    sourcesContent?: string[];
}

/**
 * Stub: chains Civet source map into base Svelte→TSX map.
 * Currently returns the base map unmodified.
 */
export function chainSourceMaps(
  baseMap: EncodedSourceMap,
  _civetMap: EncodedSourceMap,
  _tsStart: number,
  _tsEnd: number
): EncodedSourceMap {
  return baseMap;
}