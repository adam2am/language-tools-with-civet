import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { svelte2tsx } from '../../src/svelte2tsx';

/**
 * Parse all <script lang="civet"> blocks to extract their snippet and start line.
 */
function parseCivetBlocks(input: string) {
  const re = /<script\b([^>]*?\blang=["']civet["'][^>]*)>([\s\S]*?)<\/script>/g;
  const blocks: { snippet: string; startLine: number }[] = [];
  let match;
  while ((match = re.exec(input)) !== null) {
    const snippet = match[2];
    const localIndex = match[0].indexOf(snippet);
    const absIndex = match.index + localIndex;
    const before = input.slice(0, absIndex);
    const startLine = before.split('\n').length;
    blocks.push({ snippet, startLine });
  }
  return blocks;
}

describe('#currently end-to-end Civet integration (dynamic token mapping)', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.svelte'));

  for (const file of files) {
    it(`should map all tokens correctly for ${file}`, () => {
      const input = fs.readFileSync(path.join(fixturesDir, file), 'utf-8');
      const blocks = parseCivetBlocks(input);
      if (!blocks.length) return; // skip files without civet scripts

      // Extract all identifier tokens and their original positions
      const tokenRE = /[A-Za-z_$][A-Za-z0-9_$]*/g;
      const tokenPositions: Array<{ token: string; line: number; col: number }> = [];
      for (const { snippet, startLine } of blocks) {
        const lines = snippet.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          // skip comment lines
          if (/^\s*\/\//.test(lineText)) continue;
          let m;
          while ((m = tokenRE.exec(lineText))) {
            const token = m[0];
            const origLine = startLine + i;
            const origCol = m.index;
            tokenPositions.push({ token, line: origLine, col: origCol });
          }
        }
      }

      // Run the full Svelte→TSX pipeline
      const { code: tsx, map } = svelte2tsx(input, { filename: file });

      // only consider tokens that appear in the generated TSX
      const presentTokenPositions = tokenPositions.filter(({ token }) => {
        if (!tsx.includes(token)) {
          // skip tokens that the compiler removed or didn't emit
          return false;
        }
        return true;
      });
      const decoded = decode(map.mappings);
      // Flatten all segments to { origLine, origCol }
      const segments = decoded.flatMap((lineSegments) =>
        lineSegments.map((seg) => ({ origLine: seg[2] + 1, origCol: seg[3] }))
      );

      // For each token, assert there's a mapping segment back to its original position
      for (const { token, line, col } of presentTokenPositions) {
        const found = segments.some((s) => s.origLine === line && s.origCol === col);
        assert.ok(
          found,
          `Token '${token}' in ${file} at ${line}:${col} was not mapped correctly`
        );
      }
    });
  }
});