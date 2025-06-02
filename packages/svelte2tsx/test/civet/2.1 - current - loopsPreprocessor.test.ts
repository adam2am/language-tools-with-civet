import { strict as assert } from 'assert';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { normalizeCivetMap } from '../../src/svelte2tsx/utils/civetMapToV3'; // Though preprocessCivet calls it
import { SourceMapConsumer, type RawSourceMap } from 'source-map';
import { decode } from '@jridgewell/sourcemap-codec';
import * as fs from 'fs';
import * as path from 'path';
import type { CivetLinesSourceMap, CivetBlockInfo } from '../../src/svelte2tsx/utils/civetTypes';
import type { EncodedSourceMap } from '@jridgewell/gen-mapping'; // Corrected import

describe('2.1 - Preprocessor loop mapping differences #current', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  interface Scenario {
    fixtureFile: string;
    description: string;
    tokensToAssert: Record<string, { 
      originalLine: number, 
      originalColumn: number, // Represents 0-based column for direct comparison with source-map library output
      tsShouldContain?: string, 
      inLoopContext?: boolean,
      anchorTsString?: string 
    }>;
  }

  const scenarios: Scenario[] = [
    {
      fixtureFile: 'multi-char-var.svelte',
      description: "Testing sourcemap accuracy for multi-character variables at line-end (no semicolon) vs. single-char variables, based on user report.",
      tokensToAssert: {
        'z_decl': { 
          originalLine: 2, originalColumn: 1, // Tab, then 'z'
          tsShouldContain: 'z',
          anchorTsString: 'z = 4' 
        },
        'vari_decl': {
          originalLine: 3, originalColumn: 1, // Tab, then 'v' of 'vari'
          tsShouldContain: 'vari',
          anchorTsString: 'vari = 123'
        },
        'number1_decl': {
          originalLine: 4, originalColumn: 1, // Tab, then 'n' of 'number1'
          tsShouldContain: 'number1',
          anchorTsString: 'number1 = vari'
        },
        'vari_in_number1': {
          originalLine: 4, originalColumn: 12, // 	 L4: number1 .= vari (v is at col 12)
          tsShouldContain: 'vari',
          anchorTsString: 'number1 = vari'
        },
        // Inside varIssue := () => number2 .= vari
        // Original Svelte line 6: 		number2 .= vari
        'number2_decl_in_varIssue': {
          originalLine: 6, originalColumn: 2, // 2 Tabs, then 'n' of 'number2' (n is at col 2)
          tsShouldContain: 'number2',
          anchorTsString: 'number2 = vari' 
        },
        'vari_in_varIssue_problematic': { // The reported problematic case: multi-char, EOL
          originalLine: 6, originalColumn: 13, // 		 L6: number2 .= vari (v is at col 13)
          tsShouldContain: 'vari',
          anchorTsString: 'number2 = vari'
        },
        // Inside varGreat := () => number2 .= z
        // Original Svelte line 8: 		number2 .= z
        'z_in_varGreat_control': { // Control case: single char, EOL
          originalLine: 8, originalColumn: 13, // 		 L8: number2 .= z (z is at col 13)
          tsShouldContain: 'z',
          anchorTsString: 'number2 = z'
        }
      }
    }
  ];

  for (const scenario of scenarios) {
    it(`should correctly map tokens for ${scenario.description}`, async () => {
      const filePath = path.join(fixturesDir, scenario.fixtureFile);
      const svelteContent = fs.readFileSync(filePath, 'utf-8');

      console.log(`\n--- Scenario: ${scenario.description} (${scenario.fixtureFile}) ---`);
      
      const preprocessResult = preprocessCivet(svelteContent, filePath);
      assert.ok(preprocessResult.instance, 'Expected instance script info from preprocessCivet');
      const instanceBlock = preprocessResult.instance as CivetBlockInfo;
      const normalizedMap = instanceBlock.map as unknown as EncodedSourceMap; 
      
      const compiledTsCode = preprocessResult.code.slice(
        instanceBlock.tsStartInSvelteWithTs,
        instanceBlock.tsEndInSvelteWithTs
      );

      console.log('Original Svelte Content:\n', svelteContent);
      console.log('Compiled TS Code (from preprocessor):\n', compiledTsCode);
      console.log('Info from CivetBlockInfo:');
      console.log('  originalContentStartLine_1based:', instanceBlock.originalContentStartLine);
      // console.log('  removedCivetContentIndentLength:', instanceBlock.removedCivetContentIndentLength); // This is not directly on CivetBlockInfo
      console.log('  originalCivetLineCount:', instanceBlock.originalCivetLineCount);
      console.log('  compiledTsLineCount:', instanceBlock.compiledTsLineCount);
      // Log raw Civet-to-TS mapping lines before normalization for debugging
      const rawMapLines = (instanceBlock as any).rawMapLines as number[][][];
      if (rawMapLines && Array.isArray(rawMapLines)) {
        console.log('Raw Civet-to-TS map lines:');
        rawMapLines.forEach((lineSegments, index) => {
            const segmentsStr = lineSegments.map(segment => `[${segment.join(',')}]`).join('');
            console.log(`  line ${index + 1} : ${segmentsStr}`);
        });
      } else {
        console.log('Raw Civet-to-TS map lines: (not available or not in expected format)');
      }

      assert.ok(normalizedMap, `Normalized map should exist for ${scenario.fixtureFile}`);
      assert.equal(normalizedMap.version, 3, 'Map version should be 3');
      assert.deepStrictEqual(normalizedMap.sources, [filePath], 'Map sources should be the fixture path');
      assert.ok(normalizedMap.sourcesContent && normalizedMap.sourcesContent[0] === svelteContent, 'Map sourcesContent should be the original Svelte content');
      
      console.log('Normalized V3 map from Preprocessor:');
      const normalizedMapLines = normalizedMap.mappings.split(';');
      normalizedMapLines.forEach((line, index) => {
        console.log(`  Line ${index + 1}: ${line}`);
      });

      const decodedSegments = decode(normalizedMap.mappings);
      console.log('Decoded V3 mapping segments:');
      decodedSegments.forEach((lineSegs, idx) => {
        const segStr = lineSegs.map(seg => `[${seg.join(',')}]`).join(' ');
        console.log(`  TS Line ${idx + 1}: ${segStr}`);
      });

      const consumer = await new SourceMapConsumer(normalizedMap as any as RawSourceMap);
      const tsLines = compiledTsCode.split('\n');

      for (const [tokenKey, expectedMeta] of Object.entries(scenario.tokensToAssert)) {
        let tsLineIndex = -1;
        let tsColIndex = -1;
        const searchString = expectedMeta.tsShouldContain ?? tokenKey.split('_')[0]; // Use base name if tsShouldContain not specified
        const regex = new RegExp(`\\b${searchString}\\b`);

        if (expectedMeta.inLoopContext) {
            let loopLineSearchIdx = -1;
            for(let i=0; i < tsLines.length; i++) {
                const line = tsLines[i];
                // Check for standard loop constructs AND our anchor string
                if ((line.includes('for (const fruit of fruits)') || line.includes('for (const fruit in fruits)')) && 
                    (!expectedMeta.anchorTsString || line.includes(expectedMeta.anchorTsString)) ) {
                    loopLineSearchIdx = i;
                    break; 
                }
            }
            assert.notEqual(loopLineSearchIdx, -1, `Could not find TS loop line for token '${tokenKey}' with anchor '${expectedMeta.anchorTsString}'`);
            const loopLine = tsLines[loopLineSearchIdx];
            const match = regex.exec(loopLine);
            if (match) {
                tsLineIndex = loopLineSearchIdx;
                tsColIndex = match.index;
            }
        } else {
            for (let i = 0; i < tsLines.length; i++) {
                const line = tsLines[i];
                // If anchorTsString is present, current line must contain it
                if (expectedMeta.anchorTsString && !line.includes(expectedMeta.anchorTsString)) {
                    continue;
                }
                const match = regex.exec(line);
                if (match) {
                    if (tokenKey.endsWith('_decl') && line.match(new RegExp(`(const|let|var)\\s+${searchString}`))) {
                         tsLineIndex = i;
                         tsColIndex = match.index;
                         break;
                    }
                    if (tokenKey === 'fruits_def' && line.startsWith('const fruits = ')) {
                        tsLineIndex = i;
                        tsColIndex = match.index;
                        break;
                    }
                    // General case, not a specific declaration, but respects anchor if present
                    if (tokenKey !== 'fruits_def' && !tokenKey.endsWith('_decl')) { 
                        tsLineIndex = i;
                        tsColIndex = match.index;
                        break;
                    }
                    if (tsLineIndex === -1) { // Fallback if specific conditions not met but anchor was (or no anchor)
                        tsLineIndex = i;
                        tsColIndex = match.index;
                    }
                }
            }
        }
        
        assert.notEqual(tsLineIndex, -1, `Token '${searchString}' (for key '${tokenKey}') not found in compiled TS code with anchor '${expectedMeta.anchorTsString}'. TS Code:\n${compiledTsCode}`);
        assert.notEqual(tsColIndex, -1, `Exact token '${searchString}' (for key '${tokenKey}') not found with word boundary in line ${tsLineIndex + 1}`);

        const originalPos = consumer.originalPositionFor({
          line: tsLineIndex + 1, 
          column: tsColIndex,   
          bias: SourceMapConsumer.GREATEST_LOWER_BOUND
        });

        assert.strictEqual(originalPos.source, filePath, `Source mismatch for token '${tokenKey}'`);
        assert.strictEqual(originalPos.line, expectedMeta.originalLine, `Original line mismatch for token '${tokenKey}'. Expected ${expectedMeta.originalLine}, got ${originalPos.line}. TS Line: ${tsLineIndex +1}, Col: ${tsColIndex}`);
        assert.strictEqual(originalPos.column, expectedMeta.originalColumn, `Original column mismatch for token '${tokenKey}'. Expected ${expectedMeta.originalColumn}, got ${originalPos.column}. TS Line: ${tsLineIndex +1}, Col: ${tsColIndex}`);
        console.log(`  Asserted token '${tokenKey}' ('${searchString}'): TS(${tsLineIndex+1}:${tsColIndex}) -> Original(${originalPos.line}:${originalPos.column}) - OK`);
      }
      consumer.destroy();
    });
  }
});