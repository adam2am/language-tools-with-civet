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