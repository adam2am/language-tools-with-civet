import { Position, Range } from 'vscode-languageserver';
import { SourceMapLinesEntry } from '../../typescriptServiceHost';
import * as ts from 'typescript';
import { CivetLanguageServiceHost } from '../../typescriptServiceHost';

// Import the original remappers with an underscore prefix
import {
  remapPosition as _remapPosition,
  remapRange as _remapRange,
  flattenDiagnosticMessageText,
  type SourcemapLines as CivetSourcemapLines // Original type from @danielx/civet/ts-diagnostic
} from './ts-diagnostics';

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
import { Document } from '../../lib/documents';
import { CompletionContext, CompletionList, TextEdit, CompletionItemKind, Position as LSPPosition, Range as LSPRange, CompletionItem } from 'vscode-languageserver';
import { scriptElementKindToCompletionItemKind } from '../typescript/utils';

/**
 * Convert TS completions from CivetLanguageServiceHost into a Svelte LSP CompletionList,
 * handling all sourcemap and position mapping.
 */
export async function convertCompletions(
  document: Document,
  position: LSPPosition,
  completionContext: CompletionContext | undefined,
  host: CivetLanguageServiceHost,
  compiledTsCode: string,
  rawSourcemapLines: RawVLQSourcemapLines,
  originalContentLineOffset: number,
  scriptStartPosition: LSPPosition
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
  const offsetToPositionInTs = (offset: number): LSPPosition => {
    let line = 0;
    let character = 0;
    for (let i = 0; i < offset && i < hostCode.length; i++) {
      if (hostCode[i] === '\n') { line++; character = 0; }
      else { character++; }
    }
    return { line, character };
  };

  const items: CompletionItem[] = tsCompletions.entries.map((entry: ts.CompletionEntry) => {
    const item: CompletionItem = { label: entry.name, kind: scriptElementKindToCompletionItemKind(entry.kind) };
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
      item.textEdit = TextEdit.replace(LSPRange.create(svelteStart, svelteEnd), entry.name);
    } else {
      item.insertText = entry.name;
    }
    if (entry.data) item.data = entry.data;
    return item;
  });

  return CompletionList.create(items, tsCompletions.isGlobalCompletion);
}

// ---- End of Phase 2 stub ---- 