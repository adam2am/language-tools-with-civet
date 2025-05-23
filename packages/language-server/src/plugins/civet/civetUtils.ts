// Utility functions for Civet sourcemap position mapping, inspired by @danielx/civet ts-diagnostic and util implementations.

export interface MappingPosition {
    line: number;       // 0-indexed line
    character: number;  // 0-indexed character
}

/**
 * Forward map a source position (in Civet code) to generated TS position
 * using raw CVT VLQ-decoded sourcemap lines.
 */
export function forwardMap(
    sourcemapLines: number[][][],
    position: MappingPosition
): MappingPosition {
    const { line: origLine, character: origOffset } = position;
    let bestLine = -1;
    let bestOffset = -1;
    let foundGenLine = -1;
    let foundGenOffset = -1;

    for (let genLine = 0; genLine < sourcemapLines.length; genLine++) {
        const segments = sourcemapLines[genLine];
        let col = 0;
        for (const mapping of segments) {
            // mapping: [genColDelta, sourceFileIndex?, srcLine, srcOffset, nameIdx?]
            const delta = mapping[0] || 0;
            col += delta;
            if (mapping.length >= 4) {
                const srcLine = mapping[2];
                const srcOffset = mapping[3];
                if (srcLine <= origLine) {
                    if (
                        srcLine > bestLine ||
                        (srcLine === bestLine && srcOffset >= bestOffset)
                    ) {
                        bestLine = srcLine;
                        bestOffset = srcOffset;
                        foundGenLine = genLine;
                        foundGenOffset = col;
                    }
                }
            }
        }
    }

    if (foundGenLine >= 0) {
        const genLine = foundGenLine + (origLine - bestLine);
        const genOffset = foundGenOffset + (origOffset - bestOffset);
        return { line: genLine, character: genOffset };
    }

    return position;
}

/**
 * Remap a generated TS position back to original Civet source position
 * using raw CVT VLQ-decoded sourcemap lines.
 */
export function remapPosition(
    position: MappingPosition,
    sourcemapLines: number[][][]
): MappingPosition {
    const { line, character } = position;
    const segments = sourcemapLines[line] || [];
    if (!segments.length) return position;
    let p = 0;
    let lastMapping: number[] | undefined;
    let lastMappingPos = 0;
    for (const mapping of segments) {
        const delta = mapping[0] || 0;
        p += delta;
        if (mapping.length >= 4) {
            lastMapping = mapping;
            lastMappingPos = p;
        }
        if (p >= character) break;
    }
    if (lastMapping) {
        const srcLine = lastMapping[2];
        const srcOffset = lastMapping[3];
        const newChar = srcOffset + (character - lastMappingPos);
        return { line: srcLine, character: newChar };
    }
    return position;
} 