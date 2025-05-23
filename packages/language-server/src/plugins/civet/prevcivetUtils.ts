import assert from 'assert';
import type { Position } from 'vscode-languageserver';

/**
 * Raw sourcemap lines type from Civet compiler (array of mapping segments).
 */
export type SourcemapLines = number[][][];

/**
 * Maps a position in the original Civet source forward to the generated TypeScript code.
 */
export function forwardMap(sourcemapLines: SourcemapLines, position: Position): Position {
  assert('line' in position, 'position must have line');
  assert('character' in position, 'position must have character');

  const { line: origLine, character: origOffset } = position;
  console.log(`[COND_VAR_DEBUG_UTIL] forwardMap INPUT: origLine=${origLine}, origOffset=${origOffset}`);

  let col = 0;
  let bestLine = -1, bestOffset = -1;
  let foundLine = -1, foundOffset = -1;

  console.log(`[COND_VAR_DEBUG_UTIL] sourcemapLines has ${sourcemapLines.length} lines`);
  if (origLine >= 15 && origLine <= 21) { // Likely conditionalVar range based on logs
    console.log(`[COND_VAR_DEBUG_UTIL] Detailed inspection for conditionalVar line ${origLine}`);
  }

  sourcemapLines.forEach((mLine, i) => {
    col = 0;
    
    // Only log details for lines that could be conditionalVar
    const shouldLogDetails = (origLine >= 15 && origLine <= 21) && 
                            (i >= origLine - 2 && i <= origLine + 2);
    
    if (shouldLogDetails) {
      console.log(`[COND_VAR_DEBUG_UTIL] Examining TS line ${i} with ${mLine.length} segments`);
    }
    
    mLine.forEach((mapping, segmentIndex) => {
      col += mapping[0];
      if (mapping.length === 4) {
        const [genColDelta, _srcIdx, srcLine, srcOffset] = mapping;
        
        if (shouldLogDetails) {
          console.log(`[COND_VAR_DEBUG_UTIL] Line ${i}, Segment ${segmentIndex}: genColDelta=${genColDelta}, srcLine=${srcLine}, srcOffset=${srcOffset}, col=${col}`);
          console.log(`[COND_VAR_DEBUG_UTIL] Condition check: srcLine=${srcLine} <= origLine=${origLine}, srcOffset=${srcOffset} <= origOffset=${origOffset}`);
          console.log(`[COND_VAR_DEBUG_UTIL] Current best: line=${bestLine}, offset=${bestOffset}, found at TS line=${foundLine}, offset=${foundOffset}`);
        }
        
        if (
          srcLine <= origLine &&
          ((srcLine > bestLine && srcOffset <= origOffset) ||
           (srcLine === bestLine && srcOffset <= origOffset && srcOffset >= bestOffset))
        ) {
          // When we find a better match, log it
          if (shouldLogDetails) {
            console.log(`[COND_VAR_DEBUG_UTIL] FOUND BETTER MATCH: srcLine=${srcLine}, srcOffset=${srcOffset}, i=${i}, col=${col}`);
          }
          
          bestLine = srcLine;
          bestOffset = srcOffset;
          foundLine = i;
          foundOffset = col;
        }
      }
    });
  });

  if (foundLine >= 0) {
    const genLine = foundLine + origLine - bestLine;
    const genOffset = foundOffset + origOffset - bestOffset;
    console.log(`[COND_VAR_DEBUG_UTIL] forwardMap RESULT: genLine=${genLine}, genOffset=${genOffset}, using bestLine=${bestLine}, bestOffset=${bestOffset}, foundLine=${foundLine}, foundOffset=${foundOffset}`);
    return { line: genLine, character: genOffset };
  }
  console.log(`[COND_VAR_DEBUG_UTIL] forwardMap NO MATCH, returning original position: line=${origLine}, character=${origOffset}`);
  return position;
}

/**
 * Maps a position in the generated TypeScript code back to the original Civet source.
 * Direct port of the implementation from @danielx/civet/ts-diagnostic.
 */
export function remapPosition(sourcemapLines: SourcemapLines, position: Position): Position {
  assert('line' in position, 'position must have line');
  assert('character' in position, 'position must have character');

  if (!sourcemapLines) return position;
  
  const { line, character } = position;
  
  // Add detailed logging for specific line ranges (likely conditionalVar positions)
  const shouldLogDetails = (line >= 15 && line <= 21);
  if (shouldLogDetails) {
    console.log(`[COND_VAR_DEBUG_UTIL] remapPosition INPUT: line=${line}, character=${character}`);
  }
  
  const textLine = sourcemapLines[line];
  if (!textLine?.length) {
    if (shouldLogDetails) {
      console.log(`[COND_VAR_DEBUG_UTIL] remapPosition NO LINE DATA for line ${line}`);
    }
    return position;
  }
  
  if (shouldLogDetails) {
    console.log(`[COND_VAR_DEBUG_UTIL] remapPosition found ${textLine.length} segments for line ${line}`);
  }
  
  let i = 0, p = 0, l = textLine.length;
  let lastMapping, lastMappingPosition = 0;
  
  while (i < l) {
    const mapping = textLine[i];
    p += mapping[0];
    
    if (shouldLogDetails) {
      const mappingDesc = mapping.length === 4 ? 
        `[genColDelta=${mapping[0]}, srcIdx=${mapping[1]}, srcLine=${mapping[2]}, srcCol=${mapping[3]}]` :
        `[genColDelta=${mapping[0]}, ${mapping.slice(1).join(', ')}]`;
      console.log(`[COND_VAR_DEBUG_UTIL] Segment ${i}: ${mappingDesc}, p=${p}`);
    }
    
    if (mapping.length === 4) {
      lastMapping = mapping;
      lastMappingPosition = p;
      
      if (shouldLogDetails) {
        console.log(`[COND_VAR_DEBUG_UTIL] Updated lastMapping: srcLine=${mapping[2]}, srcCol=${mapping[3]}, lastMappingPosition=${lastMappingPosition}`);
      }
    }
    
    if (p >= character) {
      if (shouldLogDetails) {
        console.log(`[COND_VAR_DEBUG_UTIL] Found segment where p(${p}) >= character(${character})`);
      }
      break;
    }
    i++;
  }
  
  if (lastMapping) {
    const srcLine = lastMapping[2];
    const srcChar = lastMapping[3];
    const newChar = srcChar + character - lastMappingPosition;
    
    if (shouldLogDetails) {
      console.log(`[COND_VAR_DEBUG_UTIL] remapPosition RESULT: srcLine=${srcLine}, srcChar=${srcChar}, newChar=${newChar}`);
      console.log(`[COND_VAR_DEBUG_UTIL] Offset calculation: srcChar(${srcChar}) + character(${character}) - lastMappingPosition(${lastMappingPosition}) = ${newChar}`);
    }
    
    return {
      line: srcLine,
      character: newChar
    };
  } else {
    if (shouldLogDetails) {
      console.log(`[COND_VAR_DEBUG_UTIL] remapPosition NO MAPPING, returning original position: line=${line}, character=${character}`);
    }
    return position;
  }
} 