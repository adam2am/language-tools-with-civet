// Define the source map interface locally
import { decode, encode } from '@jridgewell/sourcemap-codec';
import { TraceMap, traceSegment } from '@jridgewell/trace-mapping';
import { computeCharOffsetInSnippet, getLineAndColumnForOffset } from './civetUtils';

// Helper to convert a 1-based line and 0-based column to a character offset
function getOffsetForLineAndColumn(str: string, line: number, column: number): number {
  const lines = str.split('\n');
  let offset = 0;
  for (let i = 0; i < line - 1; i++) {
    offset += lines[i].length + 1;
  }
  return offset + column;
}

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
    tsStartInSvelteWithTs: number,
    tsEndInSvelteWithTs: number,
    originalFullSvelteContent?: string,
    originalCivetSnippetWithIndents?: string,
    commonIndentRemoved?: string,
    originalSnippetStartOffsetInSvelte?: number,
    svelteWithTsContent?: string
): EncodedSourceMap {
    // Determine if we have Civet snippet context for chaining
    const hasCivetContext =
      typeof originalFullSvelteContent === 'string' &&
      typeof originalCivetSnippetWithIndents === 'string' &&
      typeof commonIndentRemoved === 'string' &&
      typeof originalSnippetStartOffsetInSvelte === 'number' &&
      typeof svelteWithTsContent === 'string';
    let snippetStartLine1 = 0;
    let snippetStartCol0 = 0;
    if (hasCivetContext) {
      // Compute where the TS snippet was inserted in the Svelte-with-TS content
      const pos = getLineAndColumnForOffset(svelteWithTsContent!, originalSnippetStartOffsetInSvelte!);
      snippetStartLine1 = pos.line;
      snippetStartCol0 = pos.column;
      if (chainCivetDebug && logOptions.input)
        console.log(
          `[chainSourceMaps] Civet TS snippet region starts at line ${snippetStartLine1}, column ${snippetStartCol0}`
        );
    }
    if (chainCivetDebug && logOptions.input) {
        console.log('[chainSourceMaps] Start chaining Civet map');
        console.log('[chainSourceMaps] Optional params:', {
            originalContentLength: originalFullSvelteContent?.length,
            snippetSample: originalCivetSnippetWithIndents?.slice(0,30),
            commonIndentRemoved,
            originalSnippetStartOffsetInSvelte,
            svelteWithTsLength: svelteWithTsContent?.length
        });
    }
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
          const [genCol, _baseMapSourceIndex, origLine, origCol, nameIdx] = segment;
          let traced: readonly number[] | null = null;
          // Only attempt Civet chaining if this segment originated inside the TS snippet region
          if (hasCivetContext) {
            // Compute character offset in the Svelte-with-TS content
            const absOffset = getOffsetForLineAndColumn(svelteWithTsContent!, origLine + 1, origCol);
            if (absOffset >= tsStartInSvelteWithTs && absOffset < tsEndInSvelteWithTs) {
              // Compute line/col local to the compiled TS snippet
              let localLine0: number;
              let localCol0: number;
              if (origLine + 1 === snippetStartLine1) {
                localLine0 = 0;
                localCol0 = origCol - snippetStartCol0;
              } else {
                localLine0 = origLine - (snippetStartLine1 - 1);
                localCol0 = origCol;
              }
              try {
                traced = traceSegment(tracer, localLine0, localCol0);
          } catch {
            traced = null;
              }
            }
          }

          if (chainCivetDebug) {
            const tl = traced ? traced[2] + 1 : 'null';
            const tc = traced ? traced[3] : 'null';
            console.log(
              `[chainSourceMaps] Segment gen L${lineIndex + 1}C${genCol}, orig in svelteWithTs L${origLine + 1}C${origCol} -> Civet traced dedented L${tl}C${tc}`
            );
          }

          if (traced && traced.length >= 4 && hasCivetContext) {
            const [, , dedentedLine0, dedentedCol0] = traced;
            // Undo common indent
            const colWithIndent = dedentedCol0 + commonIndentRemoved!.length;
            // Compute character offset in the original Civet snippet (with indents)
            const snippetOffset = computeCharOffsetInSnippet(originalCivetSnippetWithIndents!, dedentedLine0, colWithIndent);
            if (snippetOffset >= 0) {
              // Absolute offset in the original Svelte file
              const absoluteOffset = originalSnippetStartOffsetInSvelte! + snippetOffset;
              const { line: finalLine1, column: finalCol0 } = getLineAndColumnForOffset(originalFullSvelteContent!, absoluteOffset);
              // Convert to 0-based line
              return [genCol, 0, finalLine1 - 1, finalCol0, nameIdx ?? 0] as [number, number, number, number, number];
            }
          }
          if (chainCivetDebug && logOptions.segmentTrace) console.log('[chainSourceMaps] No Civet mapping for segment, falling back to baseMap mapping');
          // Fallback: preserve original baseMap mapping
          return [genCol, 0, origLine, origCol, nameIdx ?? 0] as [number, number, number, number, number];
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