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
export function preprocessCivet(
  svelte: string,
  filename: string
): PreprocessResult {
  const ms = new MagicString(svelte);
  const parserHtmlx = parseHtmlxOriginal(svelte, parse, { emitOnTemplateError: false, svelte5Plus: true });
  const tags = parserHtmlx.tags;
  const result: PreprocessResult = { code: svelte };

  // process module and instance Civet scripts
  for (const tag of tags) {
    if (tag.type !== 'Script') continue;
    const lang = getAttributeValue((tag as any).attributes, 'lang');
    if (lang !== 'civet') continue;

    const context = getAttributeValue((tag as any).attributes, 'context');
    const isModule = context === 'module';

    const start = tag.content.start;
    const end = tag.content.end;
    const snippet = svelte.slice(start, end);

    // Compile Civet to TS + raw map
    const { code: compiledTsCode, rawMap } = compileCivet(snippet, filename);
    
    // Determine the 1-based line where Civet content starts in the original Svelte file.
    const originalContentStartLine_1based = getActualContentStartLine(svelte, start);
    // Determine the 0-based line offset of the Civet snippet within the original Svelte file.
    const originalCivetSnippetLineOffset_0based = originalContentStartLine_1based - 1;

    // Normalize the Civet sourcemap.
    // Pass the full original Svelte content and the 0-based line offset of the snippet.
    const map = normalizeCivetMap(rawMap, svelte, originalCivetSnippetLineOffset_0based);

    // Replace the snippet in the code
    ms.overwrite(start, end, compiledTsCode);

    const tsEndInSvelteWithTs = start + compiledTsCode.length;
    const blockData: CivetBlockInfo = {
        map,
        tsStartInSvelteWithTs: start, 
        tsEndInSvelteWithTs,      
        originalContentStartLine: originalContentStartLine_1based // Use the 1-based line here
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