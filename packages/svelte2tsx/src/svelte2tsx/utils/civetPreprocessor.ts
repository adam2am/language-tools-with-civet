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
  console.log(`[PREPROC_CIVET ${filename}] Initializing for ${filename}`);

  for (const tag of tags) {
    if (tag.type !== 'Script') continue;
    const lang = getAttributeValue((tag).attributes, 'lang');
    if (lang !== 'civet') continue;

    const context = getAttributeValue((tag).attributes, 'context');
    const isModule = context === 'module';
    console.log(`[PREPROC_CIVET ${filename}] Found <script lang="civet"> ${isModule ? '(module)' : '(instance)'} at content start ${tag.content.start}, end ${tag.content.end}`);

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
    console.log(`[PREPROC_CIVET ${filename}] Original snippet from Svelte (${start}-${end}):\n${snippet}`);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Original Civet snippet before dedent:
${snippet}`);
    if (civetPreprocessorDebug) {
      console.log(`[preprocessCivet] Detected <script lang="civet"> (${isModule ? 'module' : 'instance'}) at offsets ${start}-${end}`);
      console.log(`[preprocessCivet] Original snippet content:\n${snippet}`);
    }

    // Dedent the trimmed snippet to strip common leading whitespace for accurate mapping
    const { dedented: dedentedSnippet, indent: removedIndentString } = stripCommonIndent(snippetTrimmed);
    const commonIndentLength = removedIndentString.length;
    console.log(`[PREPROC_CIVET ${filename}] Dedent Info: removedIndentString="${removedIndentString}" (length: ${commonIndentLength})`);
    console.log(`[PREPROC_CIVET ${filename}] Dedented snippet (removed ${commonIndentLength} chars of indent):\n${dedentedSnippet}`);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Civet snippet after dedent:
${dedentedSnippet}`);
    if (civetPreprocessorDebug) console.log(`[preprocessCivet] Dedented snippet content:\n${dedentedSnippet}`);
    

    // Compile Civet to TS and get raw sourcemap from dedented snippet
    const { code: compiledTsCode, rawMap } = compileCivet(dedentedSnippet, filename);
    if (civetPreprocessorDebug) console.log(`[civetPreprocessor.ts] Compiled TS code from Civet:
${compiledTsCode}`);
    if (civetPreprocessorDebug) console.log(`[preprocessCivet] compileCivet output code length: ${compiledTsCode.length}, rawMap lines count: ${rawMap && 'lines' in rawMap ? rawMap.lines.length : 0}`);
    console.log(`[PREPROC_CIVET ${filename}] Civet compiled to TS:\n${compiledTsCode}`);
    if (rawMap && 'lines' in rawMap) {
        console.log(`[PREPROC_CIVET ${filename}] Raw Civet-to-TS map (first 3 lines of mappings): ${JSON.stringify(rawMap.lines.slice(0,3))}`);
    } else {
        console.log(`[PREPROC_CIVET ${filename}] No rawMap from compileCivet or no 'lines' in rawMap.`);
    }

    if (!rawMap || !('lines' in rawMap)) continue;

    // Compute line offset for snippet within the Svelte file dynamically by finding first content line
    const originalContentStartLine_1based = getActualContentStartLine(svelte, start);
    const originalCivetSnippetLineOffset_0based = originalContentStartLine_1based - 1;
    // Debug: log snippet offset to Svelte line mapping
    console.log(`[PREPROC_CIVET ${filename}] Original content start in Svelte: line ${originalContentStartLine_1based} (0-based offset: ${originalCivetSnippetLineOffset_0based})`);

    if (civetPreprocessorDebug && logOptions.snippetOffset) console.log(`[preprocessCivet] Civet snippet offsets ${start}-${end} -> Svelte line ${originalContentStartLine_1based}`);

    if (civetPreprocessorDebug) console.log(`[preprocessCivet] originalContentStartLine_1based: ${originalContentStartLine_1based}, snippet offset (0-based): ${originalCivetSnippetLineOffset_0based}`);


    // Normalize the Civet sourcemap to a standard V3 map
    console.log(`[PREPROC_CIVET ${filename}] Normalizing Civet map. originalCivetSnippetLineOffset_0based: ${originalCivetSnippetLineOffset_0based}, filename: ${filename}`);
    const mapFromNormalize = normalizeCivetMap(rawMap, svelte, originalCivetSnippetLineOffset_0based, filename);
    // Debug: log first segment of normalized map mappings
    if (civetPreprocessorDebug && logOptions.firstSemicolonSegment) console.log(`[civetPreprocessor.ts] normalized map first semicolon segment: ${mapFromNormalize.mappings.split(';')[0]}`);
    if (civetPreprocessorDebug) console.log(`[preprocessCivet] normalizeCivetMap returned map mappings length: ${mapFromNormalize.mappings.split(';').length}`);
    console.log(`[PREPROC_CIVET ${filename}] Normalized Civet-Svelte map (first 3 lines of mappings): ${mapFromNormalize.mappings.split(';').slice(0,3).join(';')}`);

    // Re-indent compiled TS code: trim trailing newlines, then preserve original indentation and start on a new line
    const indentString = removedIndentString;
    const trimmedCompiledTsCode = compiledTsCode.replace(/\r?\n+$/g, '');
    const reindentedTsCode = '\n' + trimmedCompiledTsCode.split('\n').map(line => `${indentString}${line}`).join('\n') + '\n';
    console.log(`[PREPROC_CIVET ${filename}] Reindented compiled TS code for insertion (indent: "${indentString}"):\n${reindentedTsCode}`);
    ms.overwrite(start, end, reindentedTsCode);
    const originalScriptBlockLineCount = svelte.slice(start, end).split('\n').length;
    const compiledTsLineCount = reindentedTsCode.split('\n').length;
    const tsEndInSvelteWithTs = start + reindentedTsCode.length;

    const blockData = {
      map: mapFromNormalize as any, // Cast to any to bypass complex type issue for now, assuming structure is EncodedSourceMap compatible
      tsStartInSvelteWithTs: start,
      tsEndInSvelteWithTs,
      originalContentStartLine: originalContentStartLine_1based,
      originalCivetLineCount: originalScriptBlockLineCount,
      compiledTsLineCount,
      originalCivetSnippetLineOffset_0based,
      removedCivetContentIndentLength: commonIndentLength
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