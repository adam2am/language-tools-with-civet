import MagicString from 'magic-string';
import { parseHtmlx as parseHtmlxOriginal } from '../../utils/htmlxparser';
import { parse } from 'svelte/compiler';
import { compileCivet } from './civetMapRawLines';
import { convertRawCivetMapToSvelteContextFormat } from './civetMapToV3';
import { getAttributeValue, getActualContentStartLine, stripCommonIndent, countLeadingBlankLines } from './civetUtils';
import type { PreprocessResult } from './civetTypes';
import type { RawSourceMap as StandardRawSourceMap } from 'source-map';

const civetPreprocessorDebug = false; // Enabled for detailed logging

const logOptions = {
  snippetOffset: true,
  firstSemicolonSegment: true,  
  blockInfo: true, // Added to log CivetBlockInfo
  rawCivetMapInputToConvert: true, // Log input to convertRawCivetMapToSvelteContextFormat
}

/**
 * Represents the information extracted and processed for a Civet script block.
 */
export interface DetailedCivetBlockInfo {
    map: StandardRawSourceMap; // Map from Dedented Civet Snippet -> TS Snippet (Context: Svelte file)
    tsStartInSvelteWithTs: number;
    tsEndInSvelteWithTs: number;
    originalContentStartLine: number; // 1-based line in Svelte where original dedented Civet snippet's content begins
    originalFullSvelteContent: string; // Full original content of the Svelte file
    originalCivetSnippetWithIndents: string; // The <script> content as it was in the Svelte file, indents and all
    commonIndentRemoved: string; // The common leading indent string that was removed
    originalSnippetStartOffsetInSvelte: number; // 0-based character offset where the original Civet snippet (with indents) started in the Svelte file.
    compiledTsCode: string; // The TS code generated from this Civet block
}

/**
 * Preprocess a Svelte document, compiling any <script lang="civet"> blocks
 * into TypeScript and preparing their sourcemaps for later chaining.
 */
export function preprocessCivet(svelte: string, filename: string): PreprocessResult {
  const ms = new MagicString(svelte);
  const { tags } = parseHtmlxOriginal(svelte, parse, { emitOnTemplateError: false, svelte5Plus: true });
  const result: PreprocessResult = { code: svelte };

  for (const tag of tags) {
    if (tag.type !== 'Script') continue;
    const lang = getAttributeValue((tag).attributes, 'lang');
    if (lang !== 'civet') continue;

    const context = getAttributeValue((tag).attributes, 'context');
    const isModule = context === 'module';

    const langAttributeNode = tag.attributes.find(attr => attr.name === 'lang' && attr.value !== true);
    if (langAttributeNode && Array.isArray(langAttributeNode.value) && langAttributeNode.value.length > 0) {
        const langValueNode = langAttributeNode.value[0];
        ms.overwrite(langValueNode.start + 1, langValueNode.end - 1, 'ts');
    }

    const originalSnippetStartOffsetInSvelte = tag.content.start; // 0-based offset of where the <script> content STARTS
    const originalSnippetEndOffsetInSvelte = tag.content.end;     // 0-based offset of where the <script> content ENDS
    const originalCivetSnippetWithIndents = svelte.slice(originalSnippetStartOffsetInSvelte, originalSnippetEndOffsetInSvelte);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Original Civet snippet (from svelte slice ${originalSnippetStartOffsetInSvelte}-${originalSnippetEndOffsetInSvelte}):\n${originalCivetSnippetWithIndents}`);

    const { dedented: dedentedSnippet, indent: commonIndentRemoved } = stripCommonIndent(originalCivetSnippetWithIndents);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Civet snippet after dedent (commonIndentRemoved: '${commonIndentRemoved}'):\n${dedentedSnippet}`);
    
    const { code: compiledTsCode, rawMap: rawCivetMapFromCompile } = compileCivet(dedentedSnippet, filename); // This map is Dedented Civet -> TS
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Compiled TS code from Civet:\n${compiledTsCode}`);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Raw Civet map (from dedented to TS):`, rawCivetMapFromCompile ? JSON.stringify(rawCivetMapFromCompile).substring(0,100) + '...': 'undefined');

    if (!rawCivetMapFromCompile || !('lines' in rawCivetMapFromCompile)) continue;

    const originalContentStartLine_1based_in_Svelte = getActualContentStartLine(svelte, originalSnippetStartOffsetInSvelte);
    const leadingBlankLines = countLeadingBlankLines(dedentedSnippet);
    const adjustedStartLine = originalContentStartLine_1based_in_Svelte + leadingBlankLines;
    if (civetPreprocessorDebug && logOptions.snippetOffset) console.log(`[civetPreprocessor.ts] originalContentStartLine_1based for dedented snippet in Svelte: ${originalContentStartLine_1based_in_Svelte} (+${leadingBlankLines} blank lines => ${adjustedStartLine})`);

    // Convert the raw Civet map (Dedented Civet -> TS) to a standard V3 map,
    // but its original positions are still relative to the dedented Civet snippet.
    // The map's sources/sourcesContent will point to the Svelte file.
    if (civetPreprocessorDebug && logOptions.rawCivetMapInputToConvert) console.log(`[civetPreprocessor.ts] Input to convertRawCivetMapToSvelteContextFormat - rawMap: ${JSON.stringify(rawCivetMapFromCompile).substring(0,100)}, svelte content length: ${svelte.length}, filename: ${filename}`);
    const civetMapForChaining = convertRawCivetMapToSvelteContextFormat(
      rawCivetMapFromCompile,
      svelte, // Full original svelte content
      filename, // Svelte file path
      adjustedStartLine, // 1-based snippet start line, adjusted for blank lines
      commonIndentRemoved // Pass the commonIndentRemoved --- Restore original
    );
    
    if (civetPreprocessorDebug && logOptions.firstSemicolonSegment) console.log(`[civetPreprocessor.ts] convertRawCivetMapToSvelteContextFormat output map first semicolon segment: ${civetMapForChaining.mappings.split(';')[0]}`);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] convertRawCivetMapToSvelteContextFormat output map number of mapping lines: ${civetMapForChaining.mappings.split(';').length}`);

    ms.overwrite(originalSnippetStartOffsetInSvelte, originalSnippetEndOffsetInSvelte, compiledTsCode);

    const tsEndInSvelteWithTs = originalSnippetStartOffsetInSvelte + compiledTsCode.length;
    const blockData: DetailedCivetBlockInfo = {
      map: civetMapForChaining, // This map is Dedented Civet Snippet -> TS Snippet (context Svelte file)
      tsStartInSvelteWithTs: originalSnippetStartOffsetInSvelte,
      tsEndInSvelteWithTs,
      originalContentStartLine: originalContentStartLine_1based_in_Svelte, // Line where dedented content starts
      originalFullSvelteContent: svelte,
      originalCivetSnippetWithIndents,
      commonIndentRemoved,
      originalSnippetStartOffsetInSvelte,
      compiledTsCode
    };

    if (civetPreprocessorDebug && logOptions.blockInfo) {
      console.log(`[civetPreprocessor.ts] DetailedCivetBlockInfo for ${isModule ? 'module' : 'instance'}:`);
      console.log(`  tsStartInSvelteWithTs: ${blockData.tsStartInSvelteWithTs}`);
      console.log(`  tsEndInSvelteWithTs: ${blockData.tsEndInSvelteWithTs}`);
      console.log(`  originalContentStartLine (1-based in Svelte for dedented): ${blockData.originalContentStartLine}`);
      console.log(`  originalSnippetStartOffsetInSvelte: ${blockData.originalSnippetStartOffsetInSvelte}`);
      console.log(`  commonIndentRemoved: '${blockData.commonIndentRemoved}'`);
      console.log(`  map.mappings first segment (Dedented Civet -> TS): ${blockData.map.mappings.split(';')[0]}`);
      console.log(`  compiledTsCode length: ${blockData.compiledTsCode.length}`);
    }

    if (isModule) {
      result.module = blockData;
    } else {
      result.instance = blockData;
    }
  }

  result.code = ms.toString();
  return result;
} 