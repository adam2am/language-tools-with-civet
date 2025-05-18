import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { decode, encode } from '@jridgewell/sourcemap-codec';

/**
 * Interface for a V3 source map
 */
export interface EncodedSourceMap {
    version: number;
    sources: string[];
    names: string[];
    mappings: string;
    file?: string;
    sourcesContent?: string[];
}

/**
 * Chains two source maps together: a base map (from original Svelte to TSX) and a Civet map (from Civet to TS).
 * This creates a new source map that maps directly from the original Civet code to the final TSX.
 *
 * @param baseMapPayload The base source map from Svelte to TSX
 * @param civetMap The Civet source map from Civet to TS
 * @param scriptStart The start offset of the Civet script in the original Svelte file
 * @param scriptEnd The end offset of the Civet script in the original Svelte file
 * @param tsCodeStart The start offset of the compiled TS code in the FINAL generatedContent string
 * @param originalContent The original Svelte file content
 * @param generatedContent The final generated TSX content string
 * @returns A new source map that chains the two maps
 */
export function chainSourceMaps(
    baseMapPayload: EncodedSourceMap,
    civetMap: EncodedSourceMap | any, // any for now if it could be a TraceMap instance from direct civet
    scriptStart: number,
    scriptEnd: number,
    tsCodeStart: number,      // Re-added: offset of Civet-TS block in generatedContent
    originalContent: string,
    generatedContent: string  // Re-added: the final generated TSX string
): EncodedSourceMap {
    const civetTraceMap = civetMap instanceof TraceMap ? civetMap : new TraceMap(civetMap);

    // console.log('[chainSourceMaps] Civet Instance Map JSON:', JSON.stringify(civetMap, null, 2));
    // console.log('[chainSourceMaps] civetTraceMap sources:', civetTraceMap.sources);
    // console.log('[chainSourceMaps] civetTraceMap resolvedSources:', civetTraceMap.resolvedSources);

    const chainedMap: EncodedSourceMap = {
        version: 3,
        sources: baseMapPayload.sources, // e.g., ['myFile.svelte']
        names: baseMapPayload.names ? [...baseMapPayload.names] : [],
        mappings: '',
        file: baseMapPayload.file,
        sourcesContent: baseMapPayload.sourcesContent
    };

    const scriptStartPos = getLineAndColumn(originalContent, scriptStart);
    const scriptEndPos = getLineAndColumn(originalContent, scriptEnd);
    const tsCodeStartPos = getLineAndColumn(generatedContent, tsCodeStart);

    const decodedMappings = decode(baseMapPayload.mappings);
    const newDecodedMappings: number[][][] = [];

    for (let i = 0; i < decodedMappings.length; i++) {
        const lineSegments = decodedMappings[i];
        const newLine: number[][] = [];
        const currentTsxLineNumber = i + 1; // 1-based line number in generatedContent (TSX)

        for (let j = 0; j < lineSegments.length; j++) {
            const segment = lineSegments[j];
            const genCol = segment[0]; // Column in generatedContent (TSX)

            // DIAGNOSTIC LOGGING: Log raw segment from baseMapPayload if it might be in script
            if (segment.length > 1) { // Only log segments that have source mapping info
                const seg_origLine_0based = segment[2];
                const seg_origCol_0based = segment[3];
                const tempOrigSveltePos = { line: seg_origLine_0based + 1, column: seg_origCol_0based };

                // Test with the actual isPositionInRange condition for this segment
                if (isPositionInRange(tempOrigSveltePos, scriptStartPos, scriptEndPos)) {
                    console.log(`[chainSourceMaps_DEBUG_VALID_FOR_RANGE] BaseMap Segment @ TSX L${currentTsxLineNumber}C${genCol}: ` +
                                `Raw=[${segment.join(',')}] (genCol, srcIdx, origL, origC, nameIdx?) -> ` +
                                `Orig Svelte L${tempOrigSveltePos.line}C${tempOrigSveltePos.column}`);
                }
            }
            // END DIAGNOSTIC LOGGING

            if (segment.length === 1) {
                newLine.push(segment);
                continue;
            }

            const sourceIndex = segment[1];    // Index into baseMapPayload.sources
            const origLine = segment[2];       // 0-based line in originalContent (Svelte)
            const origCol = segment[3];        // 0-based column in originalContent (Svelte)
            const nameIndex = segment.length === 5 ? segment[4] : undefined;

            const origSveltePos_from_segment = { line: origLine + 1, column: origCol }; // 1-based Svelte pos
            const currentTsxPos = { line: currentTsxLineNumber, column: genCol }; // 1-based TSX pos

            // Restore previous logging level - remove detailed TRACE for isPositionInRange inputs
            // console.log(`[chainSourceMaps_TRACE] Attempting to check segment: TSX L${currentTsxLineNumber}C${genCol} ` +
            //             `maps to Svelte L${origSveltePos_from_segment.line}C${origSveltePos_from_segment.column}. ` +
            //             `Script range in Svelte: L${scriptStartPos.line}C${scriptStartPos.column} to L${scriptEndPos.line}C${scriptEndPos.column}.`);

            if (isPositionInRange(origSveltePos_from_segment, scriptStartPos, scriptEndPos)) {
                // console.log(`[chainSourceMaps_TRACE] Segment IS IN RANGE. Proceeding with Civet map.`);

                // This TSX segment originated from the Svelte <script lang="civet"> range.
                // Calculate its position relative to the start of the Civet-compiled TS block in the FINAL TSX.
                
                // Basic check: is currentTsxPos at or after where the Civet-TS block starts?
                // A more robust check would involve tsCodeEndPos if available.
                if (currentTsxPos.line < tsCodeStartPos.line || 
                    (currentTsxPos.line === tsCodeStartPos.line && currentTsxPos.column < tsCodeStartPos.column)) {
                    // This TSX position is *before* the start of the mapped Civet block, 
                    // but baseMapPayload says it came from Svelte script. This implies baseMapPayload is too coarse.
                    // Or, it's part of the <script> tag itself, not the content.
                    // Fallback to base map's segment for safety here.
                    // console.log('[chainSourceMaps] TSX pos is BEFORE Civet-TS block start. Using base segment. TSX:', currentTsxPos, 'CivetTSStart:', tsCodeStartPos);
                    newLine.push(segment);
                    continue;
                }

                const posInIntermediateTs = {
                    line: currentTsxPos.line - tsCodeStartPos.line + 1,
                    column: currentTsxPos.line === tsCodeStartPos.line
                        ? currentTsxPos.column - tsCodeStartPos.column
                        : currentTsxPos.column
                };

                console.log('[chainSourceMaps] In Civet Script Block. TSX Pos:', currentTsxPos, 'Orig Svelte Pos:', origSveltePos_from_segment, 'tsCodeStartPos:', tsCodeStartPos);
                console.log('[chainSourceMaps] Relative pos in Intermediate TS (for civetMap input):', posInIntermediateTs);

                if (posInIntermediateTs.line >= 1 && posInIntermediateTs.column >= 0) {
                    const civetSourcePos = originalPositionFor(civetTraceMap, posInIntermediateTs);
                    console.log('[chainSourceMaps] Mapped Civet pos (from civetMap output):', civetSourcePos);

                    if (civetSourcePos.line !== null && civetSourcePos.column !== null && civetSourcePos.source !== null) {
                        // If civetMap has its own sources (e.g. a virtual filename for the civet snippet),
                        // we might need to add that to chainedMap.sources and use a new sourceIndex.
                        // For now, assuming we want to map Civet code *as if* it lived in the Svelte file.
                        const newSegmentData: number[] = [
                            genCol,       // genCol from baseMapPayload (final TSX column)
                            sourceIndex,  // sourceIndex from baseMapPayload (points to Svelte file)
                            civetSourcePos.line - 1, // Original Civet line (0-based for encode)
                            civetSourcePos.column,   // Original Civet column (0-based for encode)
                        ];
                        if (nameIndex !== undefined) {
                            newSegmentData.push(nameIndex);
                        }
                        newLine.push(newSegmentData);
                    } else {
                        console.log('[chainSourceMaps] Failed to map through Civet. Using base segment.');
                        newLine.push(segment); // Cannot map through Civet, use base Svelte->TSX map
                    }
                } else {
                    console.log('[chainSourceMaps] Invalid relative pos in Intermediate TS. Using base segment.');
                    newLine.push(segment); // Calculated relative position is invalid
                }
            } else {
                // console.log(`[chainSourceMaps_TRACE] Segment IS NOT IN RANGE. Using base segment.`);
                newLine.push(segment); // Not in Civet script, use original Svelte->TSX mapping
            }
        }
        newDecodedMappings.push(newLine);
    }

    chainedMap.mappings = encode(newDecodedMappings as any);
    return chainedMap;
}

/**
 * Gets the line and column for a position in the content (1-based line, 0-based column)
 */
function getLineAndColumn(content: string, offset: number): { line: number; column: number } {
    if (offset < 0) return { line: 1, column: 0 }; // Should not happen with valid offsets
    const lines = content.substring(0, offset).split('\n');
    return {
        line: lines.length, // 1-based
        column: lines[lines.length - 1].length // 0-based
    };
}

/**
 * Checks if a position is within a range (expects 1-based line, 0-based column for pos)
 */
function isPositionInRange(
    pos: { line: number; column: number },
    start: { line: number; column: number }, // from getLineAndColumn
    end: { line: number; column: number }   // from getLineAndColumn
): boolean {
    if (pos.line < start.line || pos.line > end.line) {
        return false;
    }
    if (pos.line === start.line && pos.column < start.column) {
        return false;
    }
    // For the end position, if it's on the same line, it should be less than end.column
    // If scriptEnd is the offset of the char *after* the script, then getLineAndColumn(scriptEnd) gives its position.
    // A position is *in* the range if it's < end position if end is exclusive.
    // If scriptEnd is the offset of the last char, then check should be <=.
    // Let's assume scriptEnd is exclusive (offset after last char of script)
    if (pos.line === end.line && pos.column >= end.column) { 
        return false;
    }
    return true;
}
