import MagicString from 'magic-string';
import { parseHtmlx as parseHtmlxOriginal } from '../../utils/htmlxparser';
import { parse } from 'svelte/compiler';
import { compileCivet } from './civetMapRawLines';
import { normalizeCivetMap } from './civetMapToV3';
import { getAttributeValue, getActualContentStartLine, stripCommonIndent } from './civetUtils';
import type { PreprocessResult, CivetBlockInfo } from './civetTypes';

const civetPreprocessorDebug = true; // Enabled for detailed logging

const logOptions = {
  snippetOffset: true,
  firstSemicolonSegment: true,  
  blockInfo: true, // Added to log CivetBlockInfo
}

/**
 * Preprocess a Svelte document, compiling any <script lang="civet"> blocks
 * into TypeScript and normalizing their sourcemaps.
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

    // Change lang="civet" to lang="ts"
    const langAttributeNode = tag.attributes.find(attr => attr.name === 'lang' && attr.value !== true);
    if (langAttributeNode && Array.isArray(langAttributeNode.value) && langAttributeNode.value.length > 0) {
        const langValueNode = langAttributeNode.value[0]; // This is a Text node
        // langValueNode.start is the offset of the opening quote of the attribute value
        // langValueNode.end is the offset *after* the closing quote of the attribute value
        // We overwrite the content within the quotes.
        ms.overwrite(langValueNode.start + 1, langValueNode.end - 1, 'ts');
    }

    const start = tag.content.start; // 0-based offset of where the <script> content STARTS
    const end = tag.content.end;     // 0-based offset of where the <script> content ENDS
    const originalCivetSnippetWithIndents = svelte.slice(start, end);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Original Civet snippet (from svelte slice ${start}-${end}):\n${originalCivetSnippetWithIndents}`);
    
    // Dedent the snippet to strip common leading whitespace for accurate mapping by civet.compile
    // The raw Civet map will be based on this dedentedSnippet.
    const { dedented: dedentedSnippet, indent: commonIndentRemoved } = stripCommonIndent(originalCivetSnippetWithIndents);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Civet snippet after dedent (commonIndentRemoved: '${commonIndentRemoved}'):\n${dedentedSnippet}`);
    
    // Compile Civet to TS and get raw sourcemap (from dedented snippet to TS code)
    const { code: compiledTsCode, rawMap } = compileCivet(dedentedSnippet, filename);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Compiled TS code from Civet:\n${compiledTsCode}`);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Raw Civet map (from dedented to TS):`, rawMap ? JSON.stringify(rawMap).substring(0,100) + '...': 'undefined');

    if (!rawMap || !('lines' in rawMap)) continue;

    // This is the 1-based line number in the Svelte file where the actual *content* of the
    // UNDEDENTED Civet script block begins.
    const originalContentStartLine_1based_in_Svelte = getActualContentStartLine(svelte, start);
    const originalCivetSnippetLineOffset_0based_in_Svelte = originalContentStartLine_1based_in_Svelte - 1;

    if (civetPreprocessorDebug && logOptions.snippetOffset) console.log(`[civetPreprocessor.ts] originalContentStartLine_1based: ${originalContentStartLine_1based_in_Svelte}`);

    // Normalize the Civet sourcemap to a standard V3 map
    // This map will be from: Original Svelte File -> TS snippet
    const v3map = normalizeCivetMap(
      rawMap,
      svelte,
      originalContentStartLine_1based_in_Svelte,
      filename
    );
    
    if (civetPreprocessorDebug && logOptions.firstSemicolonSegment) console.log(`[civetPreprocessor.ts] normalizeCivetMap V3 output map first semicolon segment: ${v3map.mappings.split(';')[0]}`);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] normalizeCivetMap V3 output map number of mapping lines: ${v3map.mappings.split(';').length}`);

    ms.overwrite(start, end, compiledTsCode);

    const tsEndInSvelteWithTs = start + compiledTsCode.length;
    const blockData: CivetBlockInfo = {
      map: v3map,
      tsStartInSvelteWithTs: start,
      tsEndInSvelteWithTs,
      originalContentStartLine: originalContentStartLine_1based_in_Svelte
    };

    if (civetPreprocessorDebug && logOptions.blockInfo) {
      console.log(`[civetPreprocessor.ts] CivetBlockInfo for ${isModule ? 'module' : 'instance'}:`);
      console.log(`  tsStartInSvelteWithTs: ${blockData.tsStartInSvelteWithTs}`);
      console.log(`  tsEndInSvelteWithTs: ${blockData.tsEndInSvelteWithTs}`);
      console.log(`  originalContentStartLine (1-based in Svelte): ${blockData.originalContentStartLine}`);
      console.log(`  map.mappings first segment: ${blockData.map.mappings.split(';')[0]}`);
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