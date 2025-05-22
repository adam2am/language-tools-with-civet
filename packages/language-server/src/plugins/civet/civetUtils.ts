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
 */
export function remapPosition(sourcemapLines: SourcemapLines, position: Position): Position {
  assert('line' in position, 'position must have line');
  assert('character' in position, 'position must have character');

  const genLine1 = position.line + 1;
  let bestMatch: { generatedLine: number; generatedColumn: number; originalLine: number; originalColumn: number } | null = null;

  // Build absolute entries from raw sourcemapLines
  const entries: Array<{ generatedLine: number; generatedColumn: number; originalLine: number; originalColumn: number }> = [];
  sourcemapLines.forEach((lineArr, i) => {
    let col = 0;
    lineArr.forEach(mapping => {
      col += mapping[0];
      if (mapping.length === 4) {
        const [/*genColDelta*/, _srcIdx, origLine, origCol] = mapping;
        entries.push({ generatedLine: i + 1, generatedColumn: col, originalLine: origLine + 1, originalColumn: origCol });
      }
    });
  });

  for (const entry of entries) {
    if (entry.generatedLine === genLine1 && entry.generatedColumn <= position.character) {
      if (
        !bestMatch ||
        entry.generatedColumn > bestMatch.generatedColumn ||
        (entry.generatedColumn === bestMatch.generatedColumn && entry.originalColumn < bestMatch.originalColumn)
      ) {
        bestMatch = entry;
      }
    }
  }

  if (bestMatch) {
    const charOffset = position.character - bestMatch.generatedColumn;
    return { line: bestMatch.originalLine - 1, character: bestMatch.originalColumn + charOffset };
  }
  return position;
} 