// Consolidated imports
import { Position, 
  Range, 
  CompletionContext, 
  CompletionList, 
  TextEdit, 
  CompletionItemKind, 
  Hover, 
  Diagnostic, 
  DiagnosticSeverity, 
  MarkupKind, 
  CompletionItem as LSPCompletionItem, DefinitionLink } from 'vscode-languageserver';
import { Document } from '../../lib/documents';
import * as ts from 'typescript';
import { CivetLanguageServiceHost, SourceMapLinesEntry } from '../../typescriptServiceHost';
import { scriptElementKindToCompletionItemKind } from '../typescript/utils';
// Import the original remappers with an underscore prefix
import {
  remapPosition as _remapPosition,
  remapRange as _remapRange,
  flattenDiagnosticMessageText,
  type SourcemapLines as CivetSourcemapLines // Original type from @danielx/civet/ts-diagnostic
} from './ts-diagnostics';

const lazerDebug = true

// Our consistent type for raw VLQ decoded lines from civet.compile()
export type RawVLQSourcemapLines = number[][][];

// A simple interface for Civet mapping positions (0-indexed)
export interface MappingPosition {
    line: number;
    character: number;
}

/**
 * Forward-map a Civet source position to generated TS position using raw VLQ-decoded sourcemap lines.
 */
export function forwardMapRaw(
    sourcemapLines: RawVLQSourcemapLines,
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

// Wrapper for remapPosition that accepts our RawVLQSourcemapLines
export function remapPosition(
  position: MappingPosition,
  sourcemapLines: RawVLQSourcemapLines
): MappingPosition {
  // Cast once here to the type expected by the original _remapPosition
  return _remapPosition(position, sourcemapLines as any);
}

// Wrapper for remapRange that accepts our RawVLQSourcemapLines
export function remapRange(
  range: { start: MappingPosition; end: MappingPosition },
  sourcemapLines: RawVLQSourcemapLines
): { start: MappingPosition; end: MappingPosition } {
  // Cast once here to the type expected by the original _remapRange
  return _remapRange(range, sourcemapLines as any);
}

// Re-export flattenDiagnosticMessageText as is
export { flattenDiagnosticMessageText };

/**
 * Transforms the Civet compiler's sourcemap line structure (decoded VLQ segments per line)
 * into the flat SourceMapLinesEntry[] expected by CivetLanguageServiceHost.
 */
export function transformCivetSourcemapLines(decodedMappings: RawVLQSourcemapLines): SourceMapLinesEntry[] {
    const transformed: SourceMapLinesEntry[] = [];
    if (!decodedMappings) return transformed;

    decodedMappings.forEach((lineSegments, generatedLineIndex) => {
        if (!lineSegments) return;

        for (const segment of lineSegments) {
            if (!segment || segment.length < 4) { 
                continue; 
            }
            // Correctly access elements assuming segment is number[] from RawVLQSourcemapLines
            const generatedColumn = segment[0]; // First element is generatedColumnDelta from previous, effectively the column for the first segment
            const originalSourceLine = segment[2];
            const originalSourceColumn = segment[3];
            
            if (originalSourceLine < 0 ) {
                continue;
            }
            const clampedOriginalSourceColumn = Math.max(0, originalSourceColumn);

            transformed.push({
                originalLine: originalSourceLine + 1,      
                originalColumn: clampedOriginalSourceColumn, 
                generatedLine: generatedLineIndex + 1,     
                generatedColumn: generatedColumn,          
            });
        }
    });
    return transformed;
}

/**
 * Convert a Svelte document Position into a content-relative Civet source position.
 */
export function svelteDocPositionToCivetContentRelative(
    svelteDocPos: Position,
    scriptStartPosition: Position
): MappingPosition {
    const contentRelativeLine = svelteDocPos.line - scriptStartPosition.line;
    let contentRelativeChar = svelteDocPos.character;
    if (svelteDocPos.line === scriptStartPosition.line) {
        contentRelativeChar = svelteDocPos.character - scriptStartPosition.character;
    }
    contentRelativeChar = Math.max(0, contentRelativeChar);
    return { line: contentRelativeLine, character: contentRelativeChar };
}

/**
 * Convert a content-relative Civet source position back to a Svelte document Position.
 */
export function civetContentPositionToSvelteDocRelative(
    contentRelativePos: MappingPosition,
    scriptStartPosition: Position
): Position {
    const svelteDocLine = contentRelativePos.line + scriptStartPosition.line;
    let svelteDocChar = contentRelativePos.character;
    if (contentRelativePos.line === 0) {
        svelteDocChar = contentRelativePos.character + scriptStartPosition.character;
    }
    return { line: svelteDocLine, character: svelteDocChar };
}

/**
 * Adjust a TS Position when the TS code begins with a leading newline.
 */
export function adjustTsPositionForLeadingNewline(
    tsPosition: Position,
    tsHostCode: string
): Position {
    if (tsHostCode.startsWith('\n') && tsPosition.line > 0) {
        return { line: tsPosition.line - 1, character: tsPosition.character };
    }
    return tsPosition;
}

// ---- PHASE 2: High-level converter for completions ----

/**
 * Convert TS completions from CivetLanguageServiceHost into a Svelte LSP CompletionList,
 * handling all sourcemap and position mapping.
 */
export async function convertCompletions(
  document: Document,
  position: Position,
  completionContext: CompletionContext | undefined,
  host: CivetLanguageServiceHost,
  compiledTsCode: string,
  rawSourcemapLines: RawVLQSourcemapLines,
  originalContentLineOffset: number,
  scriptStartPosition: Position
): Promise<CompletionList | null> {
  // 1. Map Svelte doc position to Civet-relative
  let contentPos = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
  if (originalContentLineOffset > 0) {
    contentPos = { line: Math.max(0, contentPos.line - originalContentLineOffset), character: contentPos.character };
  }
  // 2. Forward map to generated TS
  const tsPos = forwardMapRaw(rawSourcemapLines, contentPos);
  // 3. Query TS completions
  const options: ts.GetCompletionsAtPositionOptions = {
    triggerCharacter: completionContext?.triggerCharacter as ts.CompletionsTriggerCharacter,
    triggerKind: completionContext?.triggerKind as ts.CompletionTriggerKind,
    includeExternalModuleExports: true,
    includeInsertTextCompletions: true
  };
  const tsCompletions = host.getCompletions(document.uri, tsPos, options);
  if (!tsCompletions || !tsCompletions.entries) return null;

  const hostCode = host.getScriptInfo(document.uri)?.code || compiledTsCode;
  // helper: offset -> LSP Position in TS host
  const offsetToPositionInTs = (offset: number): Position => {
    let line = 0;
    let character = 0;
    for (let i = 0; i < offset && i < hostCode.length; i++) {
      if (hostCode[i] === '\n') { line++; character = 0; }
      else { character++; }
    }
    return { line, character };
  };

  const items: LSPCompletionItem[] = tsCompletions.entries.map((entry: ts.CompletionEntry) => {
    const item: LSPCompletionItem = { label: entry.name, kind: scriptElementKindToCompletionItemKind(entry.kind) };
    if (entry.replacementSpan) {
      const start = offsetToPositionInTs(entry.replacementSpan.start);
      const end = offsetToPositionInTs(entry.replacementSpan.start + entry.replacementSpan.length);
      const adjStart = adjustTsPositionForLeadingNewline(start, hostCode);
      const adjEnd = adjustTsPositionForLeadingNewline(end, hostCode);
      const remapStart = remapPosition(adjStart, rawSourcemapLines);
      const remapEnd = remapPosition(adjEnd, rawSourcemapLines);
      const effectiveStartPos = originalContentLineOffset > 0
        ? { line: scriptStartPosition.line + originalContentLineOffset, character: (remapStart.line === 0 && scriptStartPosition.line + originalContentLineOffset === scriptStartPosition.line) ? scriptStartPosition.character : 0 }
        : scriptStartPosition;
      const svelteStart = civetContentPositionToSvelteDocRelative(remapStart, effectiveStartPos);
      const svelteEnd = civetContentPositionToSvelteDocRelative(remapEnd, effectiveStartPos);
      item.textEdit = TextEdit.replace(Range.create(svelteStart, svelteEnd), entry.name);
    } else {
      item.insertText = entry.name;
    }
    if (entry.data) item.data = entry.data;
    return item;
  });

  return CompletionList.create(items, tsCompletions.isGlobalCompletion);
}

// ---- End of Phase 2 stub ----

// ---- PHASE 2: High-level converter for hover ----

/**
 * Convert TS QuickInfo into a Svelte LSP Hover, with sourcemap mapping.
 */
export function convertHover(
  document: Document,
  position: Position,
  host: CivetLanguageServiceHost,
  compiledTsCode: string,
  rawSourcemapLines: RawVLQSourcemapLines,
  originalContentLineOffset: number,
  scriptStartPosition: Position
): Hover | null {
  // 1. Map input position into Civet source
  let contentPos = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
  if (originalContentLineOffset > 0) {
    contentPos = { line: Math.max(0, contentPos.line - originalContentLineOffset), character: contentPos.character };
  }
  // 2. Forward map to TS
  const tsPos = forwardMapRaw(rawSourcemapLines, contentPos);
  // 3. Get quickInfo
  const info = host.getQuickInfo(document.uri, tsPos);
  if (!info) return null;
  const display = ts.displayPartsToString(info.displayParts);
  const documentation = info.documentation ? ts.displayPartsToString(info.documentation) : '';
  // 4. Map textSpan -> LSP range
  const offsetToPos = (offset: number): Position => {
    let line = 0, char = 0;
    for (let i = 0; i < offset && i < compiledTsCode.length; i++) {
      if (compiledTsCode[i] === '\n') { line++; char = 0; }
      else { char++; }
    }
    return { line, character: char };
  };
  const start = adjustTsPositionForLeadingNewline(offsetToPos(info.textSpan.start), compiledTsCode);
  const end = adjustTsPositionForLeadingNewline(offsetToPos(info.textSpan.start + info.textSpan.length), compiledTsCode);
  const remappedStart = remapPosition(start, rawSourcemapLines);
  const remappedEnd = remapPosition(end, rawSourcemapLines);
  const effectiveStart = originalContentLineOffset > 0
    ? { line: scriptStartPosition.line + originalContentLineOffset, character: scriptStartPosition.character }
    : scriptStartPosition;
  const svelteStart = civetContentPositionToSvelteDocRelative(remappedStart, effectiveStart);
  const svelteEnd = civetContentPositionToSvelteDocRelative(remappedEnd, effectiveStart);

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: '```typescript\n' + display + '\n```\n' + documentation
    },
    range: { start: svelteStart, end: svelteEnd }
  };
}

// ---- PHASE 2: High-level converter for diagnostics ----
/**
 * Convert TS semantic diagnostics into Svelte LSP Diagnostics, with sourcemap mapping.
 */
export function convertDiagnostics(
  document: Document,
  host: CivetLanguageServiceHost,
  compiledTsCode: string,
  rawSourcemapLines: RawVLQSourcemapLines,
  originalContentLineOffset: number,
  scriptStartPosition: Position
): Diagnostic[] {
  const tsDiags = host.getSemanticDiagnostics(document.uri) ?? [];
  return tsDiags.map(diag => {
    const message = flattenDiagnosticMessageText(diag.messageText);
    if (diag.start === undefined || diag.length === undefined) {
      return { message, range: { start: scriptStartPosition, end: scriptStartPosition }, severity: DiagnosticSeverity.Error, source: 'civet' };
    }
    // map start/end
    const offsetToPos = (offset: number): Position => {
      let line = 0, char = 0;
      for (let i = 0; i < offset && i < compiledTsCode.length; i++) {
        if (compiledTsCode[i] === '\n') { line++; char = 0; }
        else { char++; }
      }
      return { line, character: char };
    };
    const tsStart = adjustTsPositionForLeadingNewline(offsetToPos(diag.start), compiledTsCode);
    const tsEnd = adjustTsPositionForLeadingNewline(offsetToPos(diag.start + diag.length), compiledTsCode);
    const remapped = remapRange({ start: tsStart, end: tsEnd }, rawSourcemapLines);
    const effectiveStart = originalContentLineOffset > 0
      ? { line: scriptStartPosition.line + originalContentLineOffset, character: scriptStartPosition.character }
      : scriptStartPosition;
    const svelteStart = civetContentPositionToSvelteDocRelative(remapped.start, effectiveStart);
    const svelteEnd = civetContentPositionToSvelteDocRelative(remapped.end, effectiveStart);
    return { message, range: { start: svelteStart, end: svelteEnd }, severity: diag.category === ts.DiagnosticCategory.Error ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning, code: diag.code, source: 'civet' };
  });
}

// ---- End of Phase 2 stub ----

// ---- PHASE 2: High-level converter for definitions ----

/**
 * Convert TS definitions into Svelte LSP DefinitionLink[], with sourcemap mapping.
 */
export function convertDefinitions(
  document: Document,
  position: Position,
  host: CivetLanguageServiceHost,
  compiledTsCode: string,
  rawSourcemapLines: RawVLQSourcemapLines,
  originalContentLineOffset: number,
  scriptStartPosition: Position
): DefinitionLink[] {
  if (lazerDebug) {
    console.log('[LAZERDEBUG] convertDefinitions called');
    console.log('[LAZERDEBUG] Svelte position:', position);
    console.log('[LAZERDEBUG] scriptStartPosition:', scriptStartPosition);
    console.log('[LAZERDEBUG] originalContentLineOffset:', originalContentLineOffset);
  }
  // 1. Map input to Civet content
  let contentPos = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
  if (lazerDebug) {
      console.log('[LAZERDEBUG] contentPos after svelteDocPositionToCivetContentRelative:', contentPos);
  }
  if (originalContentLineOffset > 0) {
    contentPos = { line: Math.max(0, contentPos.line - originalContentLineOffset), character: contentPos.character };
    if (lazerDebug) {
      console.log('[LAZERDEBUG] contentPos after adjusting for originalContentLineOffset:', contentPos);
    }
  }
  // 2. Forward map to TS
  const tsPos = forwardMapRaw(rawSourcemapLines, contentPos);
  if (lazerDebug) {
    console.log('[LAZERDEBUG] tsPos from forwardMapRaw:', tsPos);
  }
  // 3. Query TS definitions
  const tsDefs = host.getDefinitions(document.uri, tsPos) ?? [];
  if (lazerDebug) {
    console.log('[LAZERDEBUG] tsDefs returned:', tsDefs);
  }

  const hostCode = host.getScriptInfo(document.uri)?.code || compiledTsCode;
  const offsetToPos = (offset: number): Position => {
    let line = 0, char = 0;
    for (let i = 0; i < offset && i < hostCode.length; i++) {
      if (hostCode[i] === '\n') { line++; char = 0; } else { char++; }
    }
    return { line, character: char };
  };
  const result: DefinitionLink[] = [];
  for (const tsDef of tsDefs) {
    if (lazerDebug) {
      console.log('[LAZERDEBUG] processing tsDef:', tsDef);
    }
    if (!tsDef.textSpan) continue;
    const startOff = tsDef.textSpan.start;
    const len = tsDef.textSpan.length;
    const startPos = adjustTsPositionForLeadingNewline(offsetToPos(startOff), hostCode);
    const endPos = adjustTsPositionForLeadingNewline(offsetToPos(startOff + len), hostCode);
    if (lazerDebug) {
      console.log('[LAZERDEBUG] startPos in TS:', startPos, 'endPos in TS:', endPos);
    }
    let remapStart = remapPosition(startPos, rawSourcemapLines);
    let remapEnd = remapPosition(endPos, rawSourcemapLines);
    if (lazerDebug) {
      console.log('[LAZERDEBUG] remapped to Civet content positions:', remapStart, remapEnd);
    }
    if (originalContentLineOffset > 0) {
      remapStart = { line: remapStart.line + originalContentLineOffset, character: remapStart.character };
      remapEnd = { line: remapEnd.line + originalContentLineOffset, character: remapEnd.character };
      if (lazerDebug) {
        console.log('[LAZERDEBUG] remapped after originalContentLineOffset:', remapStart, remapEnd);
      }
    }
    const targetStart = civetContentPositionToSvelteDocRelative(remapStart, scriptStartPosition);
    const targetEnd = civetContentPositionToSvelteDocRelative(remapEnd, scriptStartPosition);
    if (lazerDebug) {
      console.log('[LAZERDEBUG] final targetStart/End:', targetStart, targetEnd);
    }
    const targetRange = Range.create(targetStart, targetEnd);
    const originRange = Range.create(position, { line: position.line, character: position.character + 1 });
    result.push({
      originSelectionRange: originRange,
      targetUri: tsDef.fileName,
      targetRange,
      targetSelectionRange: targetRange
    });
  }
  // Manual fallback: object literal properties are not returned by TS definitions
  if (tsDefs.length === 0) {
    if (lazerDebug) {
      console.log('[LAZERDEBUG] No TS definitions, applying manual fallback for nested property');
    }
    // Simple fallback: find first occurrence of the property name in compiled TS code
    const propertyNameMatch = compiledTsCode.match(/\b(\w+)\b(?=\s*:)/);
    if (propertyNameMatch) {
      const name = propertyNameMatch[1];
      const index = compiledTsCode.indexOf(`${name}:`);
      if (index !== -1) {
        const len = name.length;
        const startTsPos = adjustTsPositionForLeadingNewline(offsetToPos(index), hostCode);
        const endTsPos = adjustTsPositionForLeadingNewline(offsetToPos(index + len), hostCode);
        if (lazerDebug) {
          console.log('[LAZERDEBUG] manual fallback startTsPos/endTsPos:', startTsPos, endTsPos);
        }
        let remapStart = remapPosition(startTsPos, rawSourcemapLines);
        let remapEnd = remapPosition(endTsPos, rawSourcemapLines);
        if (originalContentLineOffset > 0) {
          remapStart = { line: remapStart.line + originalContentLineOffset, character: remapStart.character };
          remapEnd = { line: remapEnd.line + originalContentLineOffset, character: remapEnd.character };
        }
        const targetStart = civetContentPositionToSvelteDocRelative(remapStart, scriptStartPosition);
        const targetEnd = civetContentPositionToSvelteDocRelative(remapEnd, scriptStartPosition);
        if (lazerDebug) {
          console.log('[LAZERDEBUG] manual fallback targetStart/End:', targetStart, targetEnd);
        }
        const originRange = Range.create(position, { line: position.line, character: position.character + 1 });
        result.push({ originSelectionRange: originRange, targetUri: document.uri, targetRange: Range.create(targetStart, targetEnd), targetSelectionRange: Range.create(targetStart, targetEnd) });
      }
    }
    return result;
  }
  return result;
}

// ---- Export high-level converters ---- 