/**
 * Retrieve the text value of a given attribute from a parsed HTMLX tag.
 */
export function getAttributeValue(
  attributes: any[] | undefined,
  attributeName: string
): string | undefined {
  if (!attributes) return undefined;
  const attr = attributes.find(
    (a: any) => a.type === 'Attribute' && a.name === attributeName
  );
  if (attr && Array.isArray(attr.value) && attr.value.length > 0) {
    const valueNode = attr.value[0];
    if (valueNode.type === 'Text') {
      return valueNode.data || valueNode.raw;
    }
  }
  return undefined;
}

/**
 * Given a full string and an offset, compute the 1-based line and 0-based column.
 */
export function getLineAndColumnForOffset(
  str: string,
  offset: number
): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < Math.min(offset, str.length); i++) {
    if (str[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: offset - (lastNewline + 1) };
}

/**
 * Determine the first non-whitespace character's line in a string, starting from a given offset.
 */
export function getActualContentStartLine(
  str: string,
  offset: number
): number {
  let idx = offset;
  while (idx < str.length && /^\s$/.test(str[idx])) idx++;
  const { line } = getLineAndColumnForOffset(str, idx < str.length ? idx : offset);
  return line;
} 

/**
 * Given a full content string and a snippet string, compute the 0-based line index
 * where the first non-empty line of the snippet appears in the full content.
 */
export function getSnippetOffset(
  full: string,
  snippet: string
): number {
  const fullLines = full.split('\n');
  const snippetLines = snippet.split('\n').filter(l => l.trim() !== '');
  if (snippetLines.length === 0) return 0;
  const firstLine = snippetLines[0].trim();
  const idx = fullLines.findIndex(line => line.trim() === firstLine);
  return idx >= 0 ? idx : 0;
} 

/**
 * Strip the common leading whitespace from all non-empty lines of the snippet.
 * Returns the dedented string and the indent that was removed.
 */
export function stripCommonIndent(snippet: string): { dedented: string; indent: string } {
  const lines = snippet.split('\n');
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const match = line.match(/^(\s*)/);
    if (match) {
      minIndent = Math.min(minIndent, match[1].length);
    }
  }
  if (!isFinite(minIndent) || minIndent === 0) {
    return { dedented: snippet, indent: '' };
  }
  // Determine the indent string (spaces or tabs)
  const firstNonEmpty = lines.find(line => line.trim() !== '');
  const indent = firstNonEmpty ? firstNonEmpty.slice(0, minIndent) : '';
  const dedentedLines = lines.map(line =>
    line.startsWith(indent) ? line.slice(indent.length) : line
  );
  return { dedented: dedentedLines.join('\n'), indent };
} 

/**
 * Computes the 0-based character offset within a snippet string for a given
 * 0-based line and 0-based column.
 * @param snippet The snippet string.
 * @param targetLine0 The 0-based target line number.
 * @param targetCol0 The 0-based target column number on that line.
 * @returns The 0-based character offset, or -1 if line/col are out of bounds.
 */
export function computeCharOffsetInSnippet(snippet: string, targetLine0: number, targetCol0: number): number {
  const lines = snippet.split('\n');
  if (targetLine0 < 0 || targetLine0 >= lines.length) {
    return -1; // Target line out of bounds
  }

  let offset = 0;
  for (let i = 0; i < targetLine0; i++) {
    offset += lines[i].length + 1; // +1 for the newline character itself
  }

  if (targetCol0 < 0 || targetCol0 > lines[targetLine0].length) {
    // Target column out of bounds for the target line (can be equal to length for end-of-line)
    // For robustness, let's allow targetCol0 === lines[targetLine0].length (position after last char)
    if (targetCol0 !== lines[targetLine0].length && targetCol0 > 0) { // allow 0 even if line is empty
        // console.warn(`computeCharOffsetInSnippet: targetCol0 ${targetCol0} is out of bounds for line ${targetLine0} (len ${lines[targetLine0].length}). Snippet:\n${snippet}`);
        // Based on typical sourcemap segment behavior, this might imply an issue with the raw map or an edge case.
        // Snapping to end of line, though ideally raw map is always valid.
        // offset += lines[targetLine0].length;
        // return offset;
        return -1; // Strict: consider out of bounds an error.
    }
  }
  
  offset += targetCol0;
  return offset;
} 