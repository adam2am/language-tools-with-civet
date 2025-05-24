import MagicString from 'magic-string';
import { parseHtmlx as parseHtmlxOriginal } from '../../utils/htmlxparser';
import { parse } from 'svelte/compiler';
import { compileCivet } from './civetCompiler';
import { normalizeCivetMap } from './civetMapNormalizer';
import { getAttributeValue, getActualContentStartLine } from './civetUtils';
import type { PreprocessResult, CivetBlockInfo } from './civetTypes';

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

    const start = tag.content.start;
    const end = tag.content.end;
    const snippet = svelte.slice(start, end);

    // Compile Civet to TS and get raw sourcemap
    const { code: compiledTsCode, rawMap } = compileCivet(snippet, filename);
    
    if (rawMap && 'lines' in rawMap) {
      if (isModule && filename === 'ComplexComponent.svelte') { 
        console.log(`[preprocessCivet DEBUG MODULE - ${filename}] Raw CivetMap Lines:`, JSON.stringify(rawMap.lines));
      }
      if (!isModule && filename === 'ComplexComponent.svelte') { 
        console.log(`[preprocessCivet DEBUG INSTANCE - ${filename}] Raw CivetMap Lines:`, JSON.stringify(rawMap.lines));
      }
    }

    // Only proceed if we have a CivetLinesSourceMap (has 'lines')
    if (!rawMap || !('lines' in rawMap)) continue;

    // Compute line offset for snippet within the Svelte file
    const originalContentStartLine_1based = getActualContentStartLine(svelte, start);
    const originalCivetSnippetLineOffset_0based = originalContentStartLine_1based - 1;

    // Normalize the Civet sourcemap to a standard V3 map
    const map = normalizeCivetMap(rawMap, svelte, originalCivetSnippetLineOffset_0based, filename);

    // Replace the Civet snippet with the compiled TS code
    ms.overwrite(start, end, compiledTsCode);

    const tsEndInSvelteWithTs = start + compiledTsCode.length;
    const blockData: CivetBlockInfo = {
      map,
      tsStartInSvelteWithTs: start,
      tsEndInSvelteWithTs,
      originalContentStartLine: originalContentStartLine_1based
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