import type { DiagnosticMessageChain } from 'typescript';

interface Position {
  line: number;
  character: number;
}

interface Range {
  start: Position;
  end: Position;
}

type SourceMapping = [number] | [number, number, number, number];

type SourceMap = {
  updateSourceMap?(outputStr: string, inputPos: number): void;
  json(srcFileName: string, outFileName: string): unknown;
  lines: SourceMapping[][];
};

export type SourcemapLines = SourceMap['lines'];

/**
 * Take a position in generated code and map it into a position in source code.
 * Reverse mapping.
 *
 * Return position as-is if no sourcemap is available.
 */
export function remapPosition(
  position: Position,
  sourcemapLines?: SourcemapLines
): Position {
  if (!sourcemapLines) return position;

  const { line, character } = position;

  const textLine = sourcemapLines[line];
  // Return original position if no mapping at this line
  if (!textLine?.length) return position;

  let i = 0,
    p = 0,
    l = textLine.length,
    lastMapping,
    lastMappingPosition = 0;

  while (i < l) {
    const mapping = textLine[i]!;
    p += mapping[0]!;

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
    // console.error("no mapping for ", position)
    return position;
  }
}

/**
 * Use sourcemap lines to remap the start and end position of a range.
 */
export function remapRange(
  range: Range,
  sourcemapLines?: SourcemapLines
): Range {
  return {
    start: remapPosition(range.start, sourcemapLines),
    end: remapPosition(range.end, sourcemapLines)
  };
}

export function flattenDiagnosticMessageText(
  diag: string | DiagnosticMessageChain | undefined,
  indent = 0
): string {
  if (typeof diag === 'string') {
    return diag;
  } else if (diag === undefined) {
    return '';
  }

  let result = '';
  if (indent) {
    result += '\n';

    for (let i = 0; i < indent; i++) {
      result += '  ';
    }
  }

  result += diag.messageText;
  indent++;
  if (diag.next) {
    for (const kid of diag.next) {
      result += flattenDiagnosticMessageText(kid, indent);
    }
  }

  return result;
}
