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
    // {
    //   fixtureFile: '0returnCase.svelte',
    //   description: "Testing sourcemap accuracy for return statements with and without trailing semicolon in Civet and variable assignments.",
    //   tokensToAssert: {
    //     'funcIssue_decl': {
    //       originalLine: 2, originalColumn: 1,
    //       tsShouldContain: 'funcIssue',
    //       anchorTsString: 'const funcIssue = () => {'
    //     },
    //     'number1_decl_issue': {
    //       originalLine: 3, originalColumn: 2,
    //       tsShouldContain: 'number1',
    //       anchorTsString: 'const number1 = 1;'
    //     },
    //     'number1_return_issue': {
    //       originalLine: 4, originalColumn: 9,
    //       tsShouldContain: 'number1',
    //       anchorTsString: 'return number1'
    //     },
    //     'funcGreat_decl': {
    //       originalLine: 6, originalColumn: 1,
    //       tsShouldContain: 'funcGreat',
    //       anchorTsString: 'const funcGreat = () => {'
    //     },
    //     'number2_decl_great': {
    //       originalLine: 7, originalColumn: 2,
    //       tsShouldContain: 'number2',
    //       anchorTsString: 'const number2 = 1;'
    //     },
    //     'number2_return_great': {
    //       originalLine: 8, originalColumn: 9,
    //       tsShouldContain: 'number2',
    //       anchorTsString: 'return number2;'
    //     },
    //     'varIssue_decl': {
    //       originalLine: 10, originalColumn: 1,
    //       tsShouldContain: 'varIssue',
    //       anchorTsString: 'const varIssue = () => {'
    //     },
    //     'number3_decl_varIssue': {
    //       originalLine: 11, originalColumn: 2,
    //       tsShouldContain: 'number3',
    //       anchorTsString: 'let number3 = va;return number3'
    //     },
    //     'varGreat_decl': {
    //       originalLine: 13, originalColumn: 1,
    //       tsShouldContain: 'varGreat',
    //       anchorTsString: 'const varGreat = () => {'
    //     },
    //     'number4_decl_varGreat': {
    //       originalLine: 14, originalColumn: 2,
    //       tsShouldContain: 'number4',
    //       anchorTsString: 'let number4 = z;return number4'
    //     }
    //   }
    // },
    {
      fixtureFile: '0fruitCase.svelte',
      description: "Decompose mapping for fruit loops (0fruitCase.svelte)",
      tokensToAssert: {}
    }
  ];

  for (const scenario of scenarios) {
    it(`should correctly map tokens for ${scenario.description}`, async () => {
      const filePath = path.join(fixturesDir, scenario.fixtureFile);
      const svelteContent = fs.readFileSync(filePath, 'utf-8');

      console.log(`\n--- Scenario: ${scenario.description} (${scenario.fixtureFile}) ---`);
      
      const preprocessResult = preprocessCivet(svelteContent, filePath);
      console.log('\n--- Preprocessed TypeScript Code ---\n', preprocessResult.code);
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
                if (expectedMeta.anchorTsString && !line.includes(expectedMeta.anchorTsString)) {
                    continue;
                }
                const match = regex.exec(line);
                if (match) {
                    const potentialTsLine = i + 1; // 1-based for sourcemap library
                    const potentialTsCol = match.index; // 0-based for sourcemap library

                    if (tokenKey.endsWith('_decl') && line.match(new RegExp(`(const|let|var)\\s+${searchString}`))) {
                        const originalPos = consumer.originalPositionFor({
                            line: potentialTsLine,
                            column: potentialTsCol,
                            bias: SourceMapConsumer.GREATEST_LOWER_BOUND
                        });
                        // Verify this is the correct declaration by checking its original mapped position
                        if (originalPos.source === filePath &&
                            originalPos.line === expectedMeta.originalLine &&
                            originalPos.column === expectedMeta.originalColumn) {
                            tsLineIndex = i; // 0-based for tsLines array
                            tsColIndex = potentialTsCol;
                            break; // Found the exact declaration we are looking for
                        }
                        // If not the correct one, continue loop to find other potential matches
                    } else if (tokenKey === 'fruits_def' && line.startsWith('const fruits = ')) {
                        tsLineIndex = i;
                        tsColIndex = potentialTsCol;
                        break;
                    } else if (tokenKey !== 'fruits_def' && !tokenKey.endsWith('_decl')) {
                        // For other tokens, first match on an anchored line is taken.
                        // If ambiguity arises here in the future, similar logic to _decl might be needed.
                        tsLineIndex = i;
                        tsColIndex = potentialTsCol;
                        break;
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