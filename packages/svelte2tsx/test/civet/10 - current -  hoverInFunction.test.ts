import { strict as assert } from 'assert';
import { svelte2tsx } from '../../src/svelte2tsx';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import fs from 'fs';
import path from 'path';

// Helpers
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

describe('10 - Hover in Function Blank Space Test #current', () => {
  const fixtureDir = path.join(__dirname, 'fixtures');
  const rawSvelteFilePath = path.join(fixtureDir, 'hoverInFunction.svelte');
  const svelteFilePath = normalizePath(rawSvelteFilePath);
  const svelteContent = fs.readFileSync(rawSvelteFilePath, 'utf-8');

  it('should correctly map kekw and abc characters without trailing spaces', () => {
    const { code: tsxCode, map: finalMapJson } = svelte2tsx(svelteContent, {
      filename: rawSvelteFilePath,
      isTsFile: true
    });
    assert.ok(tsxCode, 'Generated TSX code should not be empty');
    assert.ok(finalMapJson, 'Final sourcemap should not be empty');

    const tracer = new (TraceMap as any)(finalMapJson);
    const svelteLines = svelteContent.split('\n');
    const tsxLines = tsxCode.split('\n');

    const tokensToVerify = [
      {
        svelteToken: 'kekw',
        svelteExpectedLine: 3,
        svelteExpectedColumn: 2,
        tsxExactMatch: 'const kekw =',
        checkCharacterMappings: true
      },
      {
        svelteToken: 'abc',
        svelteExpectedLine: 5,
        svelteExpectedColumn: 2,
        tsxExactMatch: 'const abc =',
        checkCharacterMappings: true
      }
    ];

    for (const tokenTest of tokensToVerify) {
      const { svelteToken, svelteExpectedLine, svelteExpectedColumn, tsxExactMatch, checkCharacterMappings } = tokenTest as any;
      let foundTsxLine = -1;
      let foundTsxCol = -1;

      // Find the TSX line & column for the token within the hint context
      for (let i = 0; i < tsxLines.length; i++) {
        const line = tsxLines[i];
        if (!line.includes(tsxExactMatch)) continue;
        const idx = line.indexOf(svelteToken);
        if (idx !== -1) {
          foundTsxLine = i + 1;
          foundTsxCol = idx;
          break;
        }
      }

      assert.notStrictEqual(foundTsxLine, -1, `Token "${svelteToken}" not found in generated TSX code.`);

      const originalPos = originalPositionFor(tracer, { line: foundTsxLine, column: foundTsxCol });
      assert.ok(originalPos, `originalPositionFor returned null for "${svelteToken}" at TSX L${foundTsxLine}C${foundTsxCol}`);

      assert.strictEqual(normalizePath(originalPos.source), svelteFilePath, `Source filename mismatch for "${svelteToken}".`);
      assert.strictEqual(originalPos.line, svelteExpectedLine, `Line mismatch for "${svelteToken}". Expected ${svelteExpectedLine}, got ${originalPos.line}.`);
      assert.strictEqual(originalPos.column, svelteExpectedColumn, `Column mismatch for "${svelteToken}". Expected ${svelteExpectedColumn}, got ${originalPos.column}.`);

      if (checkCharacterMappings) {
        for (let charIdx = 0; charIdx < svelteToken.length; charIdx++) {
          const tsxCharCol = foundTsxCol + charIdx;
          const expectedSvelteCol = svelteExpectedColumn + charIdx;
          const posForChar = originalPositionFor(tracer, { line: foundTsxLine, column: tsxCharCol });
          assert.ok(posForChar, `originalPositionFor returned null for char '${svelteToken[charIdx]}' of "${svelteToken}"`);
          assert.strictEqual(posForChar.line, svelteExpectedLine, `Line mismatch for char index ${charIdx} of "${svelteToken}". Expected ${svelteExpectedLine}, got ${posForChar.line}.`);
          assert.strictEqual(posForChar.column, expectedSvelteCol, `Column mismatch for char index ${charIdx} of "${svelteToken}". Expected ${expectedSvelteCol}, got ${posForChar.column}.`);
        }
        // Verify mapping for the character *after* the token
        const charAfterTokenTsxCol = foundTsxCol + svelteToken.length;
        const posForCharAfter = originalPositionFor(tracer, { line: foundTsxLine, column: charAfterTokenTsxCol });
        assert.ok(posForCharAfter, `originalPositionFor returned null for character after "${svelteToken}"`);
        
        const expectedSvelteColAfter = svelteExpectedColumn + svelteToken.length;
        console.log(`[Test Check After] Token: "${svelteToken}", TSX char after (L${foundTsxLine}C${charAfterTokenTsxCol}) mapped to Svelte L${posForCharAfter.line}C${posForCharAfter.column}. Expected Svelte L${svelteExpectedLine}C${expectedSvelteColAfter}`);

        assert.strictEqual(posForCharAfter.line, svelteExpectedLine, `Line mismatch for char after "${svelteToken}". Expected Svelte line ${svelteExpectedLine}, got ${posForCharAfter.line}.`);
        assert.strictEqual(posForCharAfter.column, expectedSvelteColAfter, `Column mismatch for char after "${svelteToken}". Expected Svelte col ${expectedSvelteColAfter}, got ${posForCharAfter.column}. It should not map to the last char of the token.`);
      }
    }
  });
}); 