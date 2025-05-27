import MagicString from 'magic-string';
import { parseHtmlx as parseHtmlxOriginal } from '../../utils/htmlxparser';
import { parse } from 'svelte/compiler';
import { compileCivet } from './civetMapLines';
import { normalizeCivetMap } from './civetMapToV3';
import { getAttributeValue, getActualContentStartLine, stripCommonIndent } from './civetUtils';
import type { PreprocessResult, CivetBlockInfo } from './civetTypes';

const civetPreprocessorDebug = false;

const logOptions = {
  snippetOffset: true,
  firstSemicolonSegment: true,  
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

    const start = tag.content.start;
    const end = tag.content.end;
    const snippet = svelte.slice(start, end);
    // Remove leading blank lines to avoid offset mismatches
    const snippetTrimmed = snippet.replace(/^[ \t]*[\r\n]+/, '');
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Original Civet snippet before dedent:
${snippet}`);
    if (civetPreprocessorDebug) {
      console.log(`[preprocessCivet] Detected <script lang="civet"> (${isModule ? 'module' : 'instance'}) at offsets ${start}-${end}`);
      console.log(`[preprocessCivet] Original snippet content:\n${snippet}`);
    }

    // Dedent the trimmed snippet to strip common leading whitespace for accurate mapping
    const { dedented: dedentedSnippet } = stripCommonIndent(snippetTrimmed);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Civet snippet after dedent:
${dedentedSnippet}`);
    if (civetPreprocessorDebug) console.log(`[preprocessCivet] Dedented snippet content:\n${dedentedSnippet}`);
    

    // Compile Civet to TS and get raw sourcemap from dedented snippet
    const { code: compiledTsCode, rawMap } = compileCivet(dedentedSnippet, filename);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Compiled TS code from Civet:\n${compiledTsCode}`);
    if (civetPreprocessorDebug) console.log(`[preprocessCivet] compileCivet output code length: ${compiledTsCode.length}, rawMap lines count: ${rawMap && 'lines' in rawMap ? rawMap.lines.length : 0}`);

    if (!rawMap || !('lines' in rawMap)) continue;

    // Compute line offset for snippet within the Svelte file dynamically by finding first content line
    const originalContentStartLine_1based = getActualContentStartLine(svelte, start);
    const originalCivetSnippetLineOffset_0based = originalContentStartLine_1based - 1;
    // Debug: log snippet offset to Svelte line mapping

    if (civetPreprocessorDebug && logOptions.snippetOffset) console.log(`[preprocessCivet] Civet snippet offsets ${start}-${end} -> Svelte line ${originalContentStartLine_1based}`);

    if (civetPreprocessorDebug) console.log(`[preprocessCivet] originalContentStartLine_1based: ${originalContentStartLine_1based}, snippet offset (0-based): ${originalCivetSnippetLineOffset_0based}`);


    // Normalize the Civet sourcemap to a standard V3 map
    const map = normalizeCivetMap(rawMap, svelte, originalCivetSnippetLineOffset_0based, filename);
    // Debug: log first segment of normalized map mappings
    if (civetPreprocessorDebug && logOptions.firstSemicolonSegment) console.log(`[civetPreprocessor.ts] normalized map first semicolon segment: ${map.mappings.split(';')[0]}`);
    if (civetPreprocessorDebug) console.log(`[preprocessCivet] normalizeCivetMap returned map mappings length: ${map.mappings.split(';').length}`);

    // Replace the Civet snippet with the compiled TS code (dedented)
    ms.overwrite(start, end, compiledTsCode);

    // Calculate line counts
    const originalCivetLineCount = dedentedSnippet.split('\n').length;
    const compiledTsLineCount = compiledTsCode.split('\n').length;

    const tsEndInSvelteWithTs = start + compiledTsCode.length;
    const blockData = {
      map,
      tsStartInSvelteWithTs: start,
      tsEndInSvelteWithTs,
      originalContentStartLine: originalContentStartLine_1based,
      originalCivetLineCount,
      compiledTsLineCount
    } as CivetBlockInfo;

    if (isModule) {
      result.module = blockData;
    } else {
      result.instance = blockData;
    }
  }

  result.code = ms.toString();
  return result;
} 