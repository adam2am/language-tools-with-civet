import MagicString from 'magic-string';
import { parseHtmlx as parseHtmlxOriginal } from '../../utils/htmlxparser';
import { parse } from 'svelte/compiler';
import { compileCivetSnippetToV3MappedTS } from '../../utils/civetNewMapLines';
import { getAttributeValue, getActualContentStartLine, stripCommonIndent } from './civetUtils';
import type { PreprocessResult, CivetBlockInfo, StandardRawSourceMap } from './civetTypes';

const civetPreprocessorDebug = false;

const logOptions = {
  snippetOffset: true,
  firstSemicolonSegment: true,  
}

/**
 * Preprocess a Svelte document, compiling any <script lang="civet"> blocks
 * into TypeScript using AST-based V3 sourcemaps synchronously.
 */
export function preprocessCivetV3(svelte: string, filename: string): PreprocessResult {
  const ms = new MagicString(svelte);
  const { tags } = parseHtmlxOriginal(svelte, parse, { emitOnTemplateError: false, svelte5Plus: true });
  const result: PreprocessResult = { code: svelte };
  console.log(`[PREPROC_CIVET_V3 ${filename}] Initializing for ${filename}`);

  for (const tag of tags) {
    if (tag.type !== 'Script') continue;
    const lang = getAttributeValue((tag).attributes, 'lang');
    if (lang !== 'civet') continue;

    const context = getAttributeValue((tag).attributes, 'context');
    const isModule = context === 'module';
    console.log(`[PREPROC_CIVET_V3 ${filename}] Found <script lang="civet"> ${isModule ? '(module)' : '(instance)'} at content start ${tag.content.start}, end ${tag.content.end}`);

    // Change lang="civet" to lang="ts"
    const langAttributeNode = tag.attributes.find(attr => attr.name === 'lang' && attr.value !== true);
    let currentTagAttributeOffsetShift = 0;
    if (langAttributeNode && Array.isArray(langAttributeNode.value) && langAttributeNode.value.length > 0) {
        const langValueNode = langAttributeNode.value[0]; // This is a Text node
        const originalLangValue = svelte.slice(langValueNode.start + 1, langValueNode.end - 1);
        const newLangValue = 'ts';
        if (originalLangValue !== newLangValue) {
            ms.overwrite(langValueNode.start + 1, langValueNode.end - 1, newLangValue);
            currentTagAttributeOffsetShift = newLangValue.length - originalLangValue.length;
        }
    }

    const start = tag.content.start;
    const end = tag.content.end;
    const snippet = svelte.slice(start, end);
    const snippetTrimmed = snippet.replace(/^(?:[ \t]*[\r\n])+/, '');
    console.log(`[PREPROC_CIVET_V3 ${filename}] Original snippet from Svelte (${start}-${end}):\n${snippet}`);

    const { dedented: dedentedSnippet, indent: removedIndentString } = stripCommonIndent(snippetTrimmed);
    const commonIndentLength = removedIndentString.length;
    console.log(`[PREPROC_CIVET_V3 ${filename}] Dedent Info: removedIndentString="${removedIndentString}" (length: ${commonIndentLength})`);
    console.log(`[PREPROC_CIVET_V3 ${filename}] Dedented snippet (removed ${commonIndentLength} chars of indent):\n${dedentedSnippet}`);
    
    // Compile Civet to TS and get a V3 raw sourcemap directly (synchronously)
    const { code: compiledTsCode, rawMap: v3RawMap } = compileCivetSnippetToV3MappedTS(dedentedSnippet, filename, { /* pass any base options here */ });
    
    console.log(`[PREPROC_CIVET_V3 ${filename}] Civet compiled to TS (V3 map path):
${compiledTsCode}`);
    if (v3RawMap) {
        console.log(`[PREPROC_CIVET_V3 ${filename}] V3 Raw Civet-to-TS map (first 3 lines of mappings): ${v3RawMap.mappings.split(';').slice(0,3).join(';')}`);
    } else {
        console.log(`[PREPROC_CIVET_V3 ${filename}] No V3 rawMap from compileCivetSnippetToV3MappedTS.`);
        // Decide handling: skip this block, use original code, throw error?
        // For now, if map fails, we might still insert code but mapping will be off.
        // Or, more safely, could revert to original snippet or skip transformation for this block.
        // Let's proceed with inserting TS code, mapping will just be missing/incorrect for this block.
    }

    if (!v3RawMap) {
        // If compilation or mapping failed critically, we might choose to not overwrite.
        // For now, we'll insert the compiled code even if the map is missing, 
        // acknowledging that debugging for this specific block will be impaired.
        console.warn(`[PREPROC_CIVET_V3 ${filename}] Warning: No sourcemap generated for Civet block. Debugging may be impaired for this block.`);
        // ms.overwrite(start, end, dedentedSnippet); // Option: revert to original civet code
        // continue; // Option: skip this block entirely
    }

    const originalContentStartLine_1based = getActualContentStartLine(svelte, start);
    const originalCivetSnippetLineOffset_0based = originalContentStartLine_1based - 1;
    console.log(`[PREPROC_CIVET_V3 ${filename}] Original content start in Svelte: line ${originalContentStartLine_1based} (0-based offset: ${originalCivetSnippetLineOffset_0based})`);

    // THE NORMALIZATION STEP IS REMOVED. v3RawMap is ALREADY a StandardRawSourceMap
    // from Civet snippet -> TS snippet.
    // We will need to adjust its `sources` and `sourcesContent` later if they 
    // don't already point to the original Svelte file due to how `filename` was passed to civet.compile.
    // For now, assume `v3RawMap` is the map to use for this block, and it maps from *within* the snippet.
    // The `chainMapsV3` in Phase 3 will handle making it relative to the Svelte file.

    const mapForBlock = v3RawMap as StandardRawSourceMap; // Trusting it is V3 standard now

    if (mapForBlock && civetPreprocessorDebug) {
      console.log(`[PREPROC_CIVET_V3 ${filename}] Using direct V3 map (first 3 lines of mappings): ${mapForBlock.mappings.split(';').slice(0,3).join(';')}`);
    }

    const indentString = removedIndentString;
    const trimmedCompiledTsCode = compiledTsCode.replace(/\r?\n+$/g, '');
    const reindentedTsCode = '\n' + trimmedCompiledTsCode.split('\n').map(line => `${indentString}${line}`).join('\n') + '\n';
    console.log(`[PREPROC_CIVET_V3 ${filename}] Reindented compiled TS code for insertion (indent: "${indentString}"):\n${reindentedTsCode}`);
    ms.overwrite(start, end, reindentedTsCode);
    
    const originalScriptBlockLineCount = svelte.slice(start, end).split('\n').length;
    const compiledTsLineCount = reindentedTsCode.split('\n').length;
    const tsEndInSvelteWithTs = start + currentTagAttributeOffsetShift + reindentedTsCode.length;
    const effectiveContentStartInFinalString = start + currentTagAttributeOffsetShift;
    const actualTsCodeStartOffset = effectiveContentStartInFinalString + 1 + commonIndentLength;

    // Ensure mapForBlock is defined before trying to use it for CivetBlockInfo
    const blockMapToStore = mapForBlock ? mapForBlock : {
        version: 3,
        file: filename, // Fallback, should be overwritten by chainer
        sources: [filename], // Fallback
        sourcesContent: [dedentedSnippet], // Fallback
        names: [],
        mappings: '' // Empty map if none generated
    } as StandardRawSourceMap;

    const blockData: CivetBlockInfo = {
      map: blockMapToStore, 
      tsStartInSvelteWithTs: actualTsCodeStartOffset,
      tsEndInSvelteWithTs,
      originalContentStartLine: originalContentStartLine_1based,
      originalCivetLineCount: originalScriptBlockLineCount, // This is line count of original Civet block in Svelte
      compiledTsLineCount, // This is line count of reindented TS code placed into Svelte
      // These might be useful for the chainer if the map doesn't have all info
      // originalCivetSnippetLineOffset_0based: originalCivetSnippetLineOffset_0based, 
      // removedCivetContentIndentLength: commonIndentLength
    };

    if (isModule) {
      result.module = blockData;
    } else {
      result.instance = blockData;
    }
  }

  result.code = ms.toString();
  return result;
} 