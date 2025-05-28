/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';
import { compileCivet } from '../../src/svelte2tsx/utils/civetMapLines';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapToV3';
import { stripCommonIndent, getActualContentStartLine } from '../../src/svelte2tsx/utils/civetUtils';
import { parseHtmlx } from '../../src/utils/htmlxparser';
import { parse } from 'svelte/compiler';
import type { CivetLinesSourceMap } from '../../src/svelte2tsx/utils/civetTypes';

describe('7 - LazerFocusOffset: end-to-end mapping current', () => {
  const fixtureName = 'LazerFocus.svelte';
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const sveltePath = path.join(fixturesDir, fixtureName);
  const originalSvelteContent = fs.readFileSync(sveltePath, 'utf-8');

  // Step 0: extract Civet snippet
  const { tags } = parseHtmlx(originalSvelteContent, parse, { emitOnTemplateError: false, svelte5Plus: true });
  const civetScriptTag = tags.find(tag =>
    tag.type === 'Script' &&
    tag.attributes.some(attr =>
      attr.name === 'lang' &&
      Array.isArray(attr.value) &&
      attr.value.length > 0 &&
      attr.value[0].raw === 'civet'
    )
  );
  assert.ok(civetScriptTag, 'Civet script tag not found in LazerFocus.svelte');
  const rawSnippet = originalSvelteContent.slice(civetScriptTag.content.start, civetScriptTag.content.end);
  const { dedented: dedentedSnippet, indent: removedIndent } = stripCommonIndent(rawSnippet);
  console.log('DEBUG [Step 0] rawSnippet:', JSON.stringify(rawSnippet));
  console.log('DEBUG [Step 0] dedentedSnippet:', JSON.stringify(dedentedSnippet));

  // Step 1: compileCivet
  const civetCompileResult = compileCivet(dedentedSnippet, fixtureName.replace('.svelte', '.civet'));
  const compiledTs = civetCompileResult.code;
  const rawMap = civetCompileResult.rawMap as CivetLinesSourceMap;
  console.log('DEBUG [Step 1] compiledTs snippet:', JSON.stringify(compiledTs));
  console.log('DEBUG [Step 1] rawMap lines:', JSON.stringify(rawMap.lines, null, 2));

  // Highlight mapping in rawMap for token
  const compileLines = compiledTs.split('\n');
  const compileToken = 'const alpha = 1';
  const tokenLineIdx = compileLines.findIndex(line => line.includes(compileToken));
  const tokenGenLine = tokenLineIdx + 1;
  const tokenGenCol = compileLines[tokenLineIdx].indexOf('const');
  console.log(`DEBUG [Step 1] rawMap.lines[${tokenLineIdx}] for genLine ${tokenGenLine}:`, JSON.stringify(rawMap.lines[tokenLineIdx], null, 2));

  // Step 2: normalizeCivetMap
  const offset0 = getActualContentStartLine(originalSvelteContent, civetScriptTag.content.start) - 1;
  const normMap = normalizeCivetMap(rawMap, originalSvelteContent, offset0, fixtureName);
  console.log('DEBUG [Step 2] normalized mappings:', normMap.mappings);
  const decodedNorm = decode((normMap as any).mappings);
  console.log('DEBUG [Step 2] decoded normalized:', JSON.stringify(decodedNorm, null, 2));
  const normTracer = new TraceMap(normMap as any);
  const normPos = originalPositionFor(normTracer, { line: tokenGenLine, column: tokenGenCol });
  console.log('DEBUG [Step 2] normPos:', normPos);

  // Run full svelte2tsx pipeline
  const { code: tsxCode, map } = svelte2tsx(originalSvelteContent, { filename: fixtureName });
  const tsx = tsxCode;
  const decoded = decode((map as any).mappings);
  const tracer = new TraceMap(map as any);

  it.skip('detects where the offset is introduced in the pipeline', () => {
    // Original Svelte line for 'alpha := 1'
    const originalLines = originalSvelteContent.split('\n');
    const defLine0 = originalLines.findIndex(line => line.includes('alpha :='));
    assert.ok(defLine0 >= 0, 'alpha := not found in original Svelte');
    const defLine1 = defLine0 + 1;

    // Snippet line index in dedented snippet
    const snippetLines = dedentedSnippet.split('\n');
    const snippetIndex0 = snippetLines.findIndex(line => line.includes('alpha :='));
    assert.ok(snippetIndex0 >= 0, 'alpha := not found in dedented snippet');

    // Compiled snippet line index
    const compileLines = compiledTs.split('\n');
    const compileIndex0 = compileLines.findIndex(line => line.includes('const alpha = 1'));
    assert.ok(compileIndex0 >= 0, 'const alpha not found in compiled TS');
    const compileOffset = compileIndex0 - snippetIndex0;
    console.log('DEBUG compileOffset:', compileOffset);
    assert.strictEqual(compileOffset, 0, 'Offset should not be introduced during compileCivet');

    // Normalized mapping for the token
    const normOffset = normPos.line - defLine1;
    console.log('DEBUG normalizeOffset:', normOffset);
    // record that the offset is introduced here if normOffset > 0
    assert.ok(normOffset >= 0, 'normalizeOffset should be non-negative');

    // Full pipeline mapping
    const pipelineIdx = tsx.indexOf('const alpha = 1');
    assert.ok(pipelineIdx >= 0, 'const alpha not found in TSX output');
    const pipelinePre = tsx.slice(0, pipelineIdx);
    const pipelineLine = pipelinePre.split('\n').length;
    const pipelineCol = pipelinePre.slice(pipelinePre.lastIndexOf('\n') + 1).length;
    const finalPos = originalPositionFor(tracer, { line: pipelineLine, column: pipelineCol });
    const finalOffset = finalPos.line - defLine1;
    console.log('DEBUG finalOffset:', finalOffset);
    assert.strictEqual(finalOffset, normOffset, 'Final pipeline offset should match normalizeOffset');
  });
}); 