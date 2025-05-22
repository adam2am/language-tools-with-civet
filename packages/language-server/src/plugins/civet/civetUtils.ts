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
  let col = 0;
  let bestLine = -1, bestOffset = -1;
  let foundLine = -1, foundOffset = -1;

  sourcemapLines.forEach((mLine, i) => {
    col = 0;
    mLine.forEach(mapping => {
      col += mapping[0];
      if (mapping.length === 4) {
        const [_genColDelta, _srcIdx, srcLine, srcOffset] = mapping;
        if (
          srcLine <= origLine &&
          ((srcLine > bestLine && srcOffset <= origOffset) ||
           (srcLine === bestLine && srcOffset <= origOffset && srcOffset >= bestOffset))
        ) {
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
    return { line: genLine, character: genOffset };
  }
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
  const textLine = sourcemapLines[line];
  if (!textLine?.length) return position;
  
  let i = 0, p = 0, l = textLine.length;
  let lastMapping, lastMappingPosition = 0;
  
  while (i < l) {
    const mapping = textLine[i];
    p += mapping[0];
    if (mapping.length === 4) {
      lastMapping = mapping;
      lastMappingPosition = p;
    }
    if (p >= character) {
      break;
    }
    i++;
  }
  
  if (lastMapping) {
    const srcLine = lastMapping[2];
    const srcChar = lastMapping[3];
    const newChar = srcChar + character - lastMappingPosition;
    return {
      line: srcLine,
      character: newChar
    };
  } else {
    return position;
  }
} 