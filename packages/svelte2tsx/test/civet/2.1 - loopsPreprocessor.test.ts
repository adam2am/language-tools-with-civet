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
      originalColumn: number, 
      tsShouldContain?: string, 
      inLoopContext?: boolean,
      anchorTsString?: string // New: For anchoring search to a specific TS line part
    }>;
  }

  const scenarios: Scenario[] = [
    {
      fixtureFile: 'lastLoopIssue.svelte',
      description: 'Mapping for "for fruit, indexdd in fruits" and "for fruit in fruits"',
      tokensToAssert: {
        'fruits_def': { // Svelte: fruits := ... (L2F)
          originalLine: 2, originalColumn: 1, tsShouldContain: 'fruits'
        },

        // "no issue loop"
        // Svelte L4: for fruit in fruits
        // TS: for (const fruit in fruits) {
        'no_issue_loop_fruit_iterator': { // Svelte 'fruit' (L4C5)
          originalLine: 4, originalColumn: 5, tsShouldContain: 'fruit',
          anchorTsString: 'for (const fruit in fruits)', 
          inLoopContext: true
        },
        'no_issue_loop_fruits_collection': { // Svelte 'fruits' (L4C14)
          originalLine: 4, originalColumn: 14, tsShouldContain: 'fruits',
          anchorTsString: 'for (const fruit in fruits)',
          inLoopContext: true
        },
        // Svelte L5: console.log \`Fruit ${fruit}\`
        // TS: console.log(\`Fruit ${fruit}\`)
        'no_issue_log_console': { // Svelte 'console' (L5C3)
          originalLine: 5, originalColumn: 3, tsShouldContain: 'console',
          // Ensure this anchor is specific to the first console.log call for the "no issue loop"
          anchorTsString: 'console.log(`Fruit ${fruit}`)' 
        },
        'no_issue_log_fruit_usage': { // Svelte 'fruit' (L5C23)
          originalLine: 5, originalColumn: 23, tsShouldContain: 'fruit',
          // This anchor, combined with top-down search, should target fruit in the first loop's log
          anchorTsString: 'Fruit ${fruit}`)' 
        },

        // "issue loop"
        // Svelte L8: for fruit, indexdd in fruits
        // TS: for (const fruit in fruits) {const indexdd = fruits[fruit];
        'issue_loop_fruit_iterator': { // Svelte 'fruit' (L8C5) -> TS 'fruit' in 'for (const fruit...'
          originalLine: 8, originalColumn: 5, tsShouldContain: 'fruit',
          anchorTsString: 'for (const fruit in fruits) {const indexdd = fruits[fruit];',
          inLoopContext: true
        },
        'issue_loop_indexdd_declaration': { // Svelte 'indexdd' (L8C12) -> TS 'indexdd' in 'const indexdd...'
          originalLine: 8, originalColumn: 12, tsShouldContain: 'indexdd',
          anchorTsString: '{const indexdd = fruits[fruit];'
        },
        'issue_loop_fruits_collection': { // Svelte 'fruits' (L8C23) -> TS 'fruits' in '...in fruits)'
          originalLine: 8, originalColumn: 23, tsShouldContain: 'fruits',
          anchorTsString: 'for (const fruit in fruits) {const indexdd = fruits[fruit];',
          inLoopContext: true
        },
        'issue_loop_fruits_in_assignment': { // Svelte 'fruits' (L8C23) -> TS 'fruits' in 'fruits[fruit]'
            originalLine: 8, originalColumn: 23, tsShouldContain: 'fruits',
            anchorTsString: 'indexdd = fruits[fruit];' 
        },
        'issue_loop_fruit_key_in_assignment': { // Svelte 'fruit' (L8C5) -> TS 'fruit' in 'fruits[fruit]'
            originalLine: 8, originalColumn: 5, tsShouldContain: 'fruit',
            anchorTsString: 'indexdd = fruits[fruit];'
        },
        // Svelte L9: console.log \`Fruit ${indexdd + 1}: ${fruit}\`
        // TS: console.log(\`Fruit ${indexdd + 1}: ${fruit}\`)
        'issue_log_console': { 
          originalLine: 9, originalColumn: 3, tsShouldContain: 'console',
          anchorTsString: 'console.log(`Fruit ${indexdd + 1}: ${fruit}`)'
        },
        'issue_log_indexdd_usage': { 
          originalLine: 9, originalColumn: 21, tsShouldContain: 'indexdd',
          anchorTsString: 'Fruit ${indexdd + 1}: ${fruit}`)'
        },
        'issue_log_fruit_usage': { 
          originalLine: 9, originalColumn: 36, tsShouldContain: 'fruit',
          anchorTsString: 'Fruit ${indexdd + 1}: ${fruit}`)'
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