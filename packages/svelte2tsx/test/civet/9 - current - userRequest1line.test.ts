import { strict as assert } from 'assert';
import { svelte2tsx } from '../../src/svelte2tsx';
import { TraceMap, originalPositionFor, generatedPositionFor } from '@jridgewell/trace-mapping';
import fs from 'fs';
import path from 'path';
import type { EncodedSourceMap } from '../../src/svelte2tsx/utils/civetMapChainer';

// Helper to escape strings for regex construction
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

// Helper to normalize path separators to forward slashes for comparison
function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

interface TokenToVerify {
  svelteToken: string;
  svelteExpectedLine: number; // 1-based
  svelteExpectedColumn: number; // 0-based
  expectedMappedSvelteToken?: string; // What content to expect after substringing
  tsxTargetHint?: string; 
  tsxExactMatch?: string; // Exact string to find in TSX (if svelteToken is different or for precision)
  occurrenceInTsx?: number; // 1-based
  isRegex?: boolean; 
}

describe('6 - User Reported Hover Issues #current', () => {
  const fixtureDir = path.join(__dirname, 'fixtures');
  const rawSvelteFilePath = path.join(fixtureDir, 'twoFooUserRequest.svelte');
  const svelteFilePath = normalizePath(rawSvelteFilePath);
  const svelteContent = fs.readFileSync(rawSvelteFilePath, 'utf-8');

  it('should correctly map tokens from TSX back to original Svelte positions', () => {
    const { code: tsxCode, map: finalMapJson } = svelte2tsx(svelteContent, {
      filename: rawSvelteFilePath, // Pass the original path to svelte2tsx
      isTsFile: true,
    });

    assert.ok(tsxCode, 'Generated TSX code should not be empty');
    assert.ok(finalMapJson, 'Final sourcemap should not be empty');

    const finalMap = finalMapJson as EncodedSourceMap;

    console.log('--- Generated TSX Code ---');
    console.log(tsxCode);
    console.log('--- Final SourceMap ---');
    console.log(JSON.stringify(finalMap, null, 2));

    // If sources in finalMap are absolute, mapURL (second arg to TraceMap) might not be needed or could cause issues.
    // const tracer = new (TraceMap as any)(finalMap, svelteFilePath);
    const tracer = new (TraceMap as any)(finalMap);

    const svelteLines = svelteContent.split('\n');
    const tsxLines = tsxCode.split('\n');

    const tokensToVerify: TokenToVerify[] = [
      {
        svelteToken: 'foo1',
        svelteExpectedLine: 2, 
        svelteExpectedColumn: 10, // User's desired target: 'o' in Svelte 'foo1'
        expectedMappedSvelteToken: 'o', // Expect 'o'
        tsxExactMatch: 'function foo1()' // Test finds 'foo1' in this, gets TSX pos for 'f'
      },
      {
        svelteToken: 'function',
        svelteExpectedLine: 2, // Line in Svelte file (1-based)
        svelteExpectedColumn: 1, // Column in Svelte file (0-based, after tab: \tfunction)
        tsxExactMatch: 'function foo1()' // Helps find the correct TSX line and context
        // expectedMappedSvelteToken should be 'function' by default
      }
    ];

    for (const tokenTest of tokensToVerify) {
      const { svelteToken, svelteExpectedLine, svelteExpectedColumn, expectedMappedSvelteToken, tsxTargetHint, tsxExactMatch, occurrenceInTsx = 1 } = tokenTest;
      let foundTsxLine = -1;
      let foundTsxCol = -1;
      let matchCount = 0;

      const effectiveSearchToken = tokenTest.isRegex ? svelteToken : (tsxExactMatch || svelteToken);
      const searchPattern = tokenTest.isRegex ? effectiveSearchToken : escapeRegExp(effectiveSearchToken);
      const tokenRegex = new RegExp(searchPattern);

      for (let i = 0; i < tsxLines.length; i++) {
        const line = tsxLines[i];
        if (tsxTargetHint && !line.includes(tsxTargetHint)) {
            // if tsxTargetHint is provided, use it for a broader line match first
            continue;
        }
        let match;
        // If tsxExactMatch is present, we want to find the svelteToken *within* that exact match line context
        // If not, we just search for svelteToken directly
        const lineToSearch = tsxExactMatch ? line : line; // No real change here, but indicates logic
        
        let searchStartIndex = 0;
        if (tsxExactMatch && line.includes(tsxExactMatch)) {
            // If tsxExactMatch is present, we want the column of svelteToken within its line
            // The tokenRegex will be based on svelteToken or tsxExactMatch itself.
            // We need to find the *svelteToken* specifically for its column.
            const specificTokenForColumn = new RegExp(escapeRegExp(svelteToken));
            const exactMatchIndex = line.indexOf(tsxExactMatch);
            if (exactMatchIndex !== -1) {
                 const subMatch = specificTokenForColumn.exec(line.substring(exactMatchIndex, exactMatchIndex + tsxExactMatch.length));
                 if (subMatch) {
                    match = subMatch;
                    match.index = exactMatchIndex + subMatch.index; // Adjust index to be relative to the full line
                 } else if (effectiveSearchToken === svelteToken) {
                    // If svelteToken itself is the tsxExactMatch, direct regex should work
                     match = tokenRegex.exec(lineToSearch);
                 } else {
                    // If svelteToken is not found within tsxExactMatch, this isn't the right line/occurrence
                    // or tsxExactMatch was too broad for svelteToken.
                    // This branch might indicate a flawed test definition or a complex case.
                    // For now, let the main loop handle it if tsxExactMatch is not used as the primary regex.
                 }
            } else {
                 match = tokenRegex.exec(lineToSearch);
            }
        } else if (!tsxExactMatch) {
            match = tokenRegex.exec(lineToSearch);
        }

        // Fallback to simpler regex matching if the above specific logic didn't pinpoint it or if no tsxExactMatch
        if (!match && !tsxExactMatch) { // only if tsxExactMatch was not guiding the search
            const fallbackRegex = new RegExp(escapeRegExp(svelteToken));
            match = fallbackRegex.exec(line);
        } else if (!match && tsxExactMatch && effectiveSearchToken !== svelteToken) {
            // if tsxExactMatch was used, but svelteToken is different and wasn't found inside, try svelteToken on the line
            const fallbackRegex = new RegExp(escapeRegExp(svelteToken));
            match = fallbackRegex.exec(line);
        }

        // Simplified loop for occurrences if first attempt didn't hit the right occurrence.
        // The logic above is to find the *correct line* using tsxExactMatch, then pinpoint svelteToken.
        // This part handles multiple occurrences on that *correct line* or general occurrences.
        let currentLineMatch = null;
        const lineTokenRegex = new RegExp(escapeRegExp(svelteToken), 'g'); // global for all occurrences
        
        let occurrenceRunner = 0;
        while((currentLineMatch = lineTokenRegex.exec(line)) !== null) {
            occurrenceRunner++;
            if (occurrenceRunner === occurrenceInTsx) {
                // Check if the line matches tsxExactMatch if provided
                if (tsxExactMatch && !line.includes(tsxExactMatch)) {
                    continue; // Not the right line context
                }
                matchCount = occurrenceRunner;
                foundTsxLine = i + 1;
                foundTsxCol = currentLineMatch.index;
                break;
            }
        }
        if (foundTsxLine !== -1) break;
      }

      assert.notStrictEqual(foundTsxLine, -1, `Token "${svelteToken}" (occurrence ${occurrenceInTsx}) with tsxExactMatch "${tsxExactMatch || 'N/A'}" not found in generated TSX code.`);

      console.log(`[Test] Checking mapping for Svelte token: "${svelteToken}" (occurrence ${occurrenceInTsx}) at TSX L${foundTsxLine}C${foundTsxCol}`);

      const originalPos = originalPositionFor(tracer, { line: foundTsxLine, column: foundTsxCol });

      assert.ok(originalPos, `originalPositionFor returned null for "${svelteToken}" at TSX L${foundTsxLine}C${foundTsxCol}`);
      
      // originalPos.source should be the path from the sourcemap's "sources" array.
      // We expect it to be the same as our normalized svelteFilePath.
      assert.strictEqual(normalizePath(originalPos.source), svelteFilePath, `Source filename mismatch for "${svelteToken}". Expected "${svelteFilePath}", got "${normalizePath(originalPos.source)}"`);
      assert.strictEqual(originalPos.line, svelteExpectedLine, `Line mismatch for "${svelteToken}". Expected ${svelteExpectedLine}, got ${originalPos.line}. TSX L${foundTsxLine}C${foundTsxCol}`);
      assert.strictEqual(originalPos.column, svelteExpectedColumn, `Column mismatch for "${svelteToken}". Expected ${svelteExpectedColumn}, got ${originalPos.column}. TSX L${foundTsxLine}C${foundTsxCol}`);

      const svelteLineContent = svelteLines[originalPos.line - 1];
      // Use svelteToken.length for original token, or expectedMappedSvelteToken.length if provided
      // Use svelteToken.length because that's what the original check was doing. 
      // The expectedMappedSvelteToken is the *result* of substringing with svelteToken.length at the (potentially offset) column.
      const mappedSvelteToken = svelteLineContent.substring(originalPos.column, originalPos.column + svelteToken.length);
      
      // if (svelteToken === 'foo1') { // No longer asserting buggy behavior
      //   const expectedBuggyContent = svelteLineContent.substring(originalPos.column, originalPos.column + svelteToken.length);
      //   assert.strictEqual(mappedSvelteToken, expectedBuggyContent, `Mapped Svelte content for buggy \"${svelteToken}\" should be consistent. Expected \"${expectedBuggyContent}\", got \"${mappedSvelteToken}\"`);
      // } else if (!tokenTest.isRegex) { 
      if (!tokenTest.isRegex) { // Standard content check
        const expectedContent = tokenTest.expectedMappedSvelteToken || svelteToken;
        assert.strictEqual(mappedSvelteToken, expectedContent, `Mapped Svelte content for \"${svelteToken}\" does not match. Expected \"${expectedContent}\", got \"${mappedSvelteToken}\" from Svelte line: \"${svelteLineContent}\"`);
      }
      console.log(`[Test] PASSED: \"${svelteToken}\" (TSX L${foundTsxLine}C${foundTsxCol}) correctly maps to Svelte L${originalPos.line}C${originalPos.column} (\"${mappedSvelteToken}\")`);
    }
  });
});

describe('6 - User Reported Hover Issues (TypeScript Baseline) #current', () => {
  const fixtureDir = path.join(__dirname, 'fixtures');
  const rawSvelteFilePath = path.join(fixtureDir, 'twoFooUserRequest_TS.svelte');
  const svelteFilePath = normalizePath(rawSvelteFilePath);
  const svelteContent = fs.readFileSync(rawSvelteFilePath, 'utf-8');

  it('should correctly map tokens from TSX back to original Svelte positions (TS baseline)', () => {
    const { code: tsxCode, map: finalMapJson } = svelte2tsx(svelteContent, {
      filename: rawSvelteFilePath,
      isTsFile: true,
    });

    assert.ok(tsxCode, 'Generated TSX code should not be empty');
    assert.ok(finalMapJson, 'Final sourcemap should not be empty');

    const finalMap = finalMapJson as EncodedSourceMap;

    console.log('--- Generated TSX Code (TS Baseline) ---');
    console.log(tsxCode);
    console.log('--- Final SourceMap (TS Baseline) ---');
    console.log(JSON.stringify(finalMap, null, 2));

    const tracer = new (TraceMap as any)(finalMap);
    const svelteLines = svelteContent.split('\n');

    const tokensToVerify: TokenToVerify[] = [
      {
        svelteToken: 'bar1',
        svelteExpectedLine: 2, // function bar1()
        svelteExpectedColumn: 13, // 'b' in bar1
        tsxExactMatch: 'function bar1()',
      },
      {
        svelteToken: 'baz',
        svelteExpectedLine: 3, // const baz
        svelteExpectedColumn: 14, // 'b' in baz (after const and space)
        tsxExactMatch: 'const baz = "hello, ts";',
      }
    ];

    for (const tokenTest of tokensToVerify) {
      const { svelteToken, svelteExpectedLine, svelteExpectedColumn, tsxExactMatch, occurrenceInTsx = 1 } = tokenTest;
      let foundTsxLine = -1;
      let foundTsxCol = -1;
      let matchCount = 0;
      const tsxLines = tsxCode.split('\n');

      const effectiveSearchToken = tsxExactMatch || svelteToken;
      const tokenRegex = new RegExp(escapeRegExp(effectiveSearchToken));

      for (let i = 0; i < tsxLines.length; i++) {
        const line = tsxLines[i];
        let currentLineMatch = null;
        const lineTokenRegex = new RegExp(escapeRegExp(svelteToken), 'g');
        let occurrenceRunner = 0;
        while((currentLineMatch = lineTokenRegex.exec(line)) !== null) {
            occurrenceRunner++;
            if (occurrenceRunner === occurrenceInTsx) {
                if (tsxExactMatch && !line.includes(tsxExactMatch)) {
                    continue;
                }
                matchCount = occurrenceRunner;
                foundTsxLine = i + 1;
                foundTsxCol = currentLineMatch.index;
                break;
            }
        }
        if (foundTsxLine !== -1) break;
      }

      assert.notStrictEqual(foundTsxLine, -1, `(TS Baseline) Token "${svelteToken}" (occurrence ${occurrenceInTsx}) with tsxExactMatch "${tsxExactMatch || 'N/A'}" not found in generated TSX code.`);
      console.log(`[Test TS Baseline] Checking mapping for Svelte token: "${svelteToken}" (occurrence ${occurrenceInTsx}) at TSX L${foundTsxLine}C${foundTsxCol}`);
      const originalPos = originalPositionFor(tracer, { line: foundTsxLine, column: foundTsxCol });

      assert.ok(originalPos, `(TS Baseline) originalPositionFor returned null for "${svelteToken}" at TSX L${foundTsxLine}C${foundTsxCol}`);
      assert.strictEqual(normalizePath(originalPos.source), svelteFilePath, `(TS Baseline) Source filename mismatch for "${svelteToken}". Expected "${svelteFilePath}", got "${normalizePath(originalPos.source)}"`);
      assert.strictEqual(originalPos.line, svelteExpectedLine, `(TS Baseline) Line mismatch for "${svelteToken}". Expected ${svelteExpectedLine}, got ${originalPos.line}. TSX L${foundTsxLine}C${foundTsxCol}`);
      assert.strictEqual(originalPos.column, svelteExpectedColumn, `(TS Baseline) Column mismatch for "${svelteToken}". Expected ${svelteExpectedColumn}, got ${originalPos.column}. TSX L${foundTsxLine}C${foundTsxCol}`);
      const svelteLineContent = svelteLines[originalPos.line - 1];
      const mappedSvelteToken = svelteLineContent.substring(originalPos.column, originalPos.column + svelteToken.length);
      const expectedContent = tokenTest.expectedMappedSvelteToken || svelteToken;
      assert.strictEqual(mappedSvelteToken, expectedContent, `(TS Baseline) Mapped Svelte content for "${svelteToken}" does not match. Expected "${expectedContent}", got "${mappedSvelteToken}" from Svelte line: "${svelteLineContent}"`);
      console.log(`[Test TS Baseline] PASSED: "${svelteToken}" (TSX L${foundTsxLine}C${foundTsxCol}) correctly maps to Svelte L${originalPos.line}C${originalPos.column} ("${mappedSvelteToken}")`);
    }
  });
});
