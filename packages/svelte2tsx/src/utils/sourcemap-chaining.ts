import { TraceMap, originalPositionFor, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping';
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
 * @param scriptContentStartLineInOriginalFile The 1-based line where Civet script content starts in the original Svelte file
 * @returns A new source map that chains the two maps
 */
export function chainSourceMaps(
    baseMapPayload: EncodedSourceMap,
    civetMap: EncodedSourceMap | any, // any for now if it could be a TraceMap instance from direct civet
    scriptStart: number,
    scriptEnd: number,
    tsCodeStart: number,      // Re-added: offset of Civet-TS block in generatedContent
    originalContent: string,
    generatedContent: string,  // Re-added: the final generated TSX string
    scriptContentStartLineInOriginalFile?: number // 1-based line where Civet script content starts in *original* Svelte file
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
                
                // <<<< DETAILED LOGGING FOR INSTANCE SCRIPT (TSX LINE 23 for instanceVar) >>>>
                // const DEBUG_SPECIFIC_TSX_LINE = 23; // Temporarily disable specific line debugging
                // if (currentTsxLineNumber === DEBUG_SPECIFIC_TSX_LINE && baseMapPayload.file && baseMapPayload.file.includes('test-stage-b-complex-component.svelte')) { // Temporarily disable
                if (baseMapPayload.file && baseMapPayload.file.includes('test-stage-b-complex-component.svelte') && scriptStartPos.line === 22 && currentTsxLineNumber >=21 && currentTsxLineNumber <= 42 ) { // DEBUG INSTANCE SCRIPT MORE BROADLY
                    console.log(`\n[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] === Processing segment for TSX L${currentTsxLineNumber}C${genCol} ===`);
                    // console.log(`[DEBUG_TSX_L${DEBUG_SPECIFIC_TSX_LINE}] baseMap Segment (raw): [${segment.join(',')}]`);
                    console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] origSveltePos_from_segment (1-based Svelte): L${origSveltePos_from_segment.line}C${origSveltePos_from_segment.column}`);
                    console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] scriptStartPos (1-based Svelte): L${scriptStartPos.line}C${scriptStartPos.column}`); // This is for the svelteContentForProcessing
                    console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] scriptEndPos (1-based Svelte): L${scriptEndPos.line}C${scriptEndPos.column}`);
                    console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] tsCodeStart (original offset in final TSX): ${tsCodeStart}`);
                    console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] tsCodeStartPos (1-based TSX where compiled Civet-TS starts): L${tsCodeStartPos.line}C${tsCodeStartPos.column}`);
                    console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] currentTsxPos (1-based TSX being processed): L${currentTsxPos.line}C${currentTsxPos.column}`);
                    console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] posInIntermediateTs (1-based for civetMap query): L${posInIntermediateTs.line}C${posInIntermediateTs.column}`);
                }
                // <<<< END DETAILED LOGGING >>>>

                console.log('[chainSourceMaps] In Civet Script Block. TSX Pos:', currentTsxPos, 'Orig Svelte Pos:', origSveltePos_from_segment, 'tsCodeStartPos:', tsCodeStartPos);
                console.log('[chainSourceMaps] Relative pos in Intermediate TS (for civetMap input):', posInIntermediateTs);

                if (posInIntermediateTs.line >= 1 && posInIntermediateTs.column >= 0) {
                    const civetSourcePos = originalPositionFor(civetTraceMap, {
                        line: posInIntermediateTs.line,
                        column: posInIntermediateTs.column,
                        bias: LEAST_UPPER_BOUND
                    });
                    
                    // <<<< DETAILED LOGGING FOR INSTANCE SCRIPT (TSX LINE 23 for instanceVar) >>>>
                    // if (currentTsxLineNumber === DEBUG_SPECIFIC_TSX_LINE && baseMapPayload.file && baseMapPayload.file.includes('test-stage-b-complex-component.svelte')) { // Temporarily disable
                    if (baseMapPayload.file && baseMapPayload.file.includes('test-stage-b-complex-component.svelte') && scriptStartPos.line === 22 && currentTsxLineNumber >=21 && currentTsxLineNumber <= 42) { // DEBUG INSTANCE SCRIPT MORE BROADLY
                        console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] civetTraceMap.sources:`, civetTraceMap.sources);
                        console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] civetSourcePos (from originalPositionFor):`, civetSourcePos);
                    }
                    // <<<< END DETAILED LOGGING >>>>

                    console.log('[chainSourceMaps] Mapped Civet pos (from civetMap output):', civetSourcePos);

                    if (civetSourcePos.line !== null && civetSourcePos.column !== null && civetSourcePos.source !== null) {
                        
                        // NEW LOGIC HYPOTHESIS:
                        // Assume civetSourcePos.line is the 1-based absolute line in the original svelte file (due to `filename` option in Civet compile)
                        // So, just convert it to 0-based for the sourcemap segment.
                        let finalOriginalLine_0based = civetSourcePos.line - 1;

                        // Optional: Add a warning if scriptContentStartLineInOriginalFile was provided but we are ignoring its value for line offsetting,
                        // to catch if our assumption about civetSourcePos.line is wrong.
                        // For now, let's proceed with the simpler direct usage of civetSourcePos.line.
                        if (!scriptContentStartLineInOriginalFile || scriptContentStartLineInOriginalFile <= 0) {
                             console.warn('[chainSourceMaps] scriptContentStartLineInOriginalFile not provided or invalid. This might be okay if Civet map lines are absolute.');
                        }

                        const newSegmentData: number[] = [
                        genCol,
                        sourceIndex,
                            finalOriginalLine_0based, 
                            civetSourcePos.column,   
                        ];
                        if (nameIndex !== undefined) {
                            newSegmentData.push(nameIndex);
                        }
                        newLine.push(newSegmentData);
                        // <<<< Log the pushed segment for instance script >>>>
                        // if (currentTsxLineNumber === DEBUG_SPECIFIC_TSX_LINE && baseMapPayload.file && baseMapPayload.file.includes('test-stage-b-complex-component.svelte')) { // Temporarily disable
                        if (baseMapPayload.file && baseMapPayload.file.includes('test-stage-b-complex-component.svelte') && scriptStartPos.line === 22 && currentTsxLineNumber >=21 && currentTsxLineNumber <= 42 ) { // DEBUG INSTANCE SCRIPT MORE BROADLY
                            console.log(`[DEBUG_INSTANCE_SCRIPT_TSX_L${currentTsxLineNumber}] PUSHED newSegmentData: [${newSegmentData.join(',')}] to newLine for TSX L${currentTsxLineNumber}`);
                        }
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
