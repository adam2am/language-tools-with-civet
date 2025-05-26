import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
// import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';
import { getActualContentStartLine } from '../../src/svelte2tsx/utils/civetUtils';

/**
 * Extract all <script lang="civet"> blocks and compute their 1-based start line
 */
function parseCivetBlocks(input: string) {
  const re = /<script\b([^>]*?\blang=["']civet["'][^>]*)>([\s\S]*?)<\/script>/g;
  const blocks: { snippet: string; startLine: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const snippet = match[2];
    const localIndex = match[0].indexOf(snippet);
    const absIndex = match.index + localIndex;
    const startLine = getActualContentStartLine(input, absIndex);
    blocks.push({ snippet, startLine });
  }
  return blocks;
}

describe('#current end-to-end Civet integration (dynamic token mapping)', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));

  for (const file of files) {
    it(`should map all tokens correctly for ${file}`, () => {
      const input = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
      // Print Svelte file with line numbers for debug
      console.log(`\n--- Svelte file: ${file} ---`);
      input.split(/\r?\n/).forEach((line, idx) => {
        console.log(`${String(idx + 1).padStart(3)}| ${line}`);
      });
      console.log('-----------------------------\n');
      const blocks = parseCivetBlocks(input);
      if (!blocks.length) return; // skip non-civet files

      // Gather original token positions
      const tokenRE = /[A-Za-z_$][A-Za-z0-9_$]*/g;
      const tokenPositions: Array<{ token: string; line: number; col: number }> = [];
      for (const { snippet, startLine } of blocks) {
        // Print dedented snippet with line numbers
        console.log(`--- Dedented Civet snippet (startLine in Svelte: ${startLine}) ---`);
        snippet.split(/\r?\n/).forEach((line, idx) => {
          console.log(`${String(startLine + idx).padStart(3)}| ${line}`);
        });
        console.log('---------------------------------------------\n');
        const lines = snippet.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const text = lines[i];
          if (/^\s*\/\//.test(text)) continue;
          let m;
          while ((m = tokenRE.exec(text))) {
            tokenPositions.push({ token: m[0], line: startLine + i, col: m.index });
          }
        }
      }

      // Run full pipeline
      const { code: tsx, map } = svelte2tsx(input, { filename: file });

      // For each token that survived compilation, assert mapping via TraceMap
      const validTokens = tokenPositions.filter(({ token }) => tsx.includes(token));
      const tsxLines = tsx.split('\n');
      const tracer = new TraceMap(map as any);
      for (const { token, line: origLine, col: origCol } of validTokens) {
        const genLineIdx = tsxLines.findIndex((l) => l.includes(token));
        assert.notStrictEqual(genLineIdx, -1, `Token '${token}' missing in TSX output`);
        const genCol = tsxLines[genLineIdx].indexOf(token);
        const pos = originalPositionFor(tracer, { line: genLineIdx + 1, column: genCol });
        // Print mapping details for debug
        console.log(`[${file}] Token '${token}' in TSX (L${genLineIdx + 1},C${genCol}) -> mapped to Svelte (L${pos.line},C${pos.column}), expected (L${origLine},C${origCol})`);
        assert.strictEqual(pos.source, file, `Source mismatch for '${token}'`);
        assert.strictEqual(pos.line, origLine, `Line mismatch for '${token}'`);
        assert.strictEqual(pos.column, origCol, `Column mismatch for '${token}'`);
      }
    });
  }
});