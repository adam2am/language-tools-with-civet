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
// Import the original remappers and forwardMap from OUR ts-diagnostics
import {
  remapPosition,
  remapRange,
  flattenDiagnosticMessageText,
  forwardMap,
  SourcemapLines as CivetSourcemapLines // Use our consistent type
} from './ts-diagnostics';
import { getCivetTagInfo } from './CivetPlugin';

const lazerDebug = true

// Our consistent type for raw VLQ decoded lines from civet.compile()
export type RawVLQSourcemapLines = number[][][];

// A simple interface for Civet mapping positions (0-indexed)
export interface MappingPosition {
    line: number;
    character: number;
}

// Re-export flattenDiagnosticMessageText as is - this is already imported, so no need to re-export

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
  const tsPos = forwardMap(rawSourcemapLines as CivetSourcemapLines, contentPos);
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
      const remapStart = remapPosition(adjStart, rawSourcemapLines as CivetSourcemapLines);
      const remapEnd = remapPosition(adjEnd, rawSourcemapLines as CivetSourcemapLines);
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
  const tsPos = forwardMap(rawSourcemapLines as CivetSourcemapLines, contentPos);
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
  const remappedStart = remapPosition(start, rawSourcemapLines as CivetSourcemapLines);
  const remappedEnd = remapPosition(end, rawSourcemapLines as CivetSourcemapLines);
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
    const remapped = remapRange({ start: tsStart, end: tsEnd }, rawSourcemapLines as CivetSourcemapLines);
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
  let contentPosForSourcemap = svelteDocPositionToCivetContentRelative(position, scriptStartPosition);
  if (lazerDebug) {
      console.log('[LAZERDEBUG] contentPosForSourcemap (before originalContentLineOffset adjustment):', contentPosForSourcemap);
  }
  // Create a separate variable for accessing script content, NOT adjusted by originalContentLineOffset
  const contentPosForScriptAccess = { line: contentPosForSourcemap.line, character: contentPosForSourcemap.character };
  if (lazerDebug) {
    console.log('[LAZERDEBUG] contentPosForScriptAccess (for script string access): motivic contentPosForScriptAccess');
  }

  if (originalContentLineOffset > 0) {
    contentPosForSourcemap = { line: Math.max(0, contentPosForSourcemap.line - originalContentLineOffset), character: contentPosForSourcemap.character };
    if (lazerDebug) {
      console.log('[LAZERDEBUG] contentPosForSourcemap (after originalContentLineOffset, for sourcemap):', contentPosForSourcemap);
    }
  }
  // 2. Forward map to TS using the sourcemap-adjusted position
  const tsPos = forwardMap(rawSourcemapLines as CivetSourcemapLines, contentPosForSourcemap);
  if (lazerDebug) {
    console.log('[LAZERDEBUG] tsPos from forwardMap:', tsPos);
  }
  // 3. Query TS definitions
  const tsDefs = host.getDefinitions(document.uri, tsPos) ?? [];
  if (lazerDebug) {
    console.log('[LAZERDEBUG] tsDefs returned by host.getDefinitions:', JSON.stringify(tsDefs, null, 2));
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
  // let tsReturnedCorrectDefinition = false; // This check will be simplified or removed

  for (const tsDef of tsDefs) {
    if (lazerDebug) {
      console.log('[LAZERDEBUG] processing tsDef:', JSON.stringify(tsDef, null, 2));
    }
    if (!tsDef.textSpan) {
        if (lazerDebug) console.log('[LAZERDEBUG] Skipping tsDef due to missing textSpan');
        continue;
    }

    // With improved sourcemaps, we trust TS service more.
    // The direct check for identifierAtCursor against tsDef.name might be too restrictive
    // if the sourcemaps are accurate, TS should give the correct span.

    const startOff = tsDef.textSpan.start;
    const len = tsDef.textSpan.length;
    const startPos = adjustTsPositionForLeadingNewline(offsetToPos(startOff), hostCode);
    const endPos = adjustTsPositionForLeadingNewline(offsetToPos(startOff + len), hostCode);
    if (lazerDebug) {
      console.log('[LAZERDEBUG] startPos in TS:', startPos, 'endPos in TS:', endPos);
    }
    let remapStart = remapPosition(startPos, rawSourcemapLines as CivetSourcemapLines);
    let remapEnd = remapPosition(endPos, rawSourcemapLines as CivetSourcemapLines);
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
    // originSelectionRange should ideally reflect the identifier at the cursor in the Svelte doc
    // For now, a single character range as before, but could be refined if needed.
    const originRange = Range.create(position, { line: position.line, character: position.character + 1 }); 

    result.push({
      originSelectionRange: originRange, // Consider refining this if TS provides a specific origin span
      targetUri: tsDef.fileName, // Should be document.uri for in-file definitions
      targetRange,
      targetSelectionRange: targetRange // Assuming the whole targetRange is the selection
    });
  }

  // Manual fallback: ONLY if TS definitions are empty.
  if (result.length === 0) { // Changed from (tsDefs.length === 0 || !tsReturnedCorrectDefinition)
    if (lazerDebug) {
        console.log('[LAZERDEBUG] No TS definitions found by primary logic, applying emergency manual fallback.');
    }
    
    let determinedPropertyName = '';
    const tagInfo = getCivetTagInfo(document);
    const scriptContent = tagInfo?.content || '';
    if (scriptContent) { // Ensure scriptContent is not empty before processing
        if (lazerDebug) {
          console.log('[LAZERDEBUG] Fallback: full scriptContent (length):', scriptContent.length, 'snippet:', scriptContent.substr(0,300).replace(/\n/g,'\\n'));
          console.log('[LAZERDEBUG] Fallback: contentPosForScriptAccess (Civet script coords):', contentPosForScriptAccess);
        }
        const scriptLines = scriptContent.split('\n');
        if (contentPosForScriptAccess.line < scriptLines.length) { // Boundary check
            const scriptLineText = scriptLines[contentPosForScriptAccess.line] || '';
            if (lazerDebug) console.log('[LAZERDEBUG] Fallback: scriptLineText:', scriptLineText);
            // Try to extract a valid JS identifier starting at the cursor
            const textAfterCursor = scriptLineText.substring(contentPosForScriptAccess.character);
            if (lazerDebug) console.log('[LAZERDEBUG] Fallback: textAfterCursor in script:', textAfterCursor);
            const usageMatch = textAfterCursor.match(/^([a-zA-Z_]\w*)/); // More robust identifier regex
            if (usageMatch) {
              determinedPropertyName = usageMatch[1];
              if (lazerDebug) console.log('[LAZERDEBUG] Fallback: property name from script usage:', determinedPropertyName);
            }
        } else if (lazerDebug) {
            console.log('[LAZERDEBUG] Fallback: contentPosForScriptAccess.line is out of bounds for scriptLines.');
        }
    }

    // If still undetermined after script parsing, try the compiled TS regex as a last resort
    if (!determinedPropertyName && compiledTsCode) { // Ensure compiledTsCode is not empty
      const firstPropDefMatch = compiledTsCode.match(/\b(\w+)\b(?=\s*:)/);
      if (firstPropDefMatch) {
        determinedPropertyName = firstPropDefMatch[1];
        if (lazerDebug) console.log('[LAZERDEBUG] Fallback: property name from first TS definition regex:', determinedPropertyName);
      }
    }

    if (determinedPropertyName) {
      const searchRegex = new RegExp(`\b${determinedPropertyName}\b(?=\s*:)`);
      if (lazerDebug) console.log('[LAZERDEBUG] Fallback: searchRegex for definition:', searchRegex);
      const idx = compiledTsCode.search(searchRegex);
      if (lazerDebug) console.log('[LAZERDEBUG] Fallback: matched definition at idx:', idx);
      if (lazerDebug && idx !== -1) {
        console.log('[LAZERDEBUG] Fallback: compiledTsCode around match:', compiledTsCode.substr(Math.max(0, idx-20), determinedPropertyName.length+40).replace(/\n/g,'\\n'));
      }
      if (idx !== -1) {
        const len = determinedPropertyName.length;
        const startTsPos = adjustTsPositionForLeadingNewline(offsetToPos(idx), hostCode);
        const endTsPos = adjustTsPositionForLeadingNewline(offsetToPos(idx + len), hostCode);
        if (lazerDebug) console.log('[LAZERDEBUG] Fallback: startTsPos/endTsPos:', startTsPos, endTsPos);
        let remapStart = remapPosition(startTsPos, rawSourcemapLines as CivetSourcemapLines);
        let remapEnd = remapPosition(endTsPos, rawSourcemapLines as CivetSourcemapLines);
        if (originalContentLineOffset > 0) {
          remapStart = { line: remapStart.line + originalContentLineOffset, character: remapStart.character };
          remapEnd = { line: remapEnd.line + originalContentLineOffset, character: remapEnd.character };
        }
        const targetStart = civetContentPositionToSvelteDocRelative(remapStart, scriptStartPosition);
        const targetEnd = civetContentPositionToSvelteDocRelative(remapEnd, scriptStartPosition);
        if (lazerDebug) console.log('[LAZERDEBUG] Fallback: final targetStart/End:', targetStart, targetEnd);
        const originRange = Range.create(position, { line: position.line, character: position.character + 1 });
        result.push({ 
            originSelectionRange: originRange, 
            targetUri: document.uri, // Fallback definition is in the same document
            targetRange: Range.create(targetStart, targetEnd), 
            targetSelectionRange: Range.create(targetStart, targetEnd) 
        });
      }
    } else if (lazerDebug) {
        console.log('[LAZERDEBUG] Fallback: Could not determine property name for fallback logic.');
    }
  }
  if (lazerDebug) {
    console.log('[LAZERDEBUG] convertDefinitions returning results:', JSON.stringify(result, null, 2));
  }
  return result;
}

// ---- Export high-level converters ---- 