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