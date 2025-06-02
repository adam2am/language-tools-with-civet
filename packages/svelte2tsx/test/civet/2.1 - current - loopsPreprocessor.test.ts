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
    tokensToAssert: Record<string, { originalLine: number, originalColumn: number, tsShouldContain?: string, inLoopContext?: boolean }>;
  }

  const scenarios: Scenario[] = [
    {
      fixtureFile: 'loopBadExp.svelte',
      description: 'Loop without trailing comment',
      tokensToAssert: {
        'fruits_def': { originalLine: 2, originalColumn: 1, tsShouldContain: 'fruits' },  // fruits :=
        'fruits_loop': { originalLine: 3, originalColumn: 21, tsShouldContain: 'fruits', inLoopContext: true }, // of fruits
        'index_decl': { originalLine: 3, originalColumn: 12, tsShouldContain: 'index' },   // , index
        'fruit_decl': { originalLine: 3, originalColumn: 5, tsShouldContain: 'fruit' },    // for fruit (after tab)
        'console': { originalLine: 4, originalColumn: 3 } // console (after tab + 2 spaces)
      }
    },
    {
      fixtureFile: 'loopGoodExp.svelte',
      description: 'Loop with trailing comment',
      tokensToAssert: {
        'fruits_def': { originalLine: 2, originalColumn: 1, tsShouldContain: 'fruits' },  // fruits :=
        'fruits_loop': { originalLine: 3, originalColumn: 21, tsShouldContain: 'fruits', inLoopContext: true }, // of fruits
        'index_decl': { originalLine: 3, originalColumn: 12, tsShouldContain: 'index' },   // , index
        'fruit_decl': { originalLine: 3, originalColumn: 5, tsShouldContain: 'fruit' },    // for fruit (after tab)
        'console': { originalLine: 4, originalColumn: 3 } // console (after tab + 2 spaces)
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
      const normalizedMap = instanceBlock.map as unknown as EncodedSourceMap; // Cast for now, as CivetBlockInfo.map is StandardRawSourceMap
      
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
      console.log('Raw Civet-to-TS map lines (first 3):', (instanceBlock as any).rawMapLines?.slice(0, 3));

      assert.ok(normalizedMap, `Normalized map should exist for ${scenario.fixtureFile}`);
      assert.equal(normalizedMap.version, 3, 'Map version should be 3');
      assert.deepStrictEqual(normalizedMap.sources, [filePath], 'Map sources should be the fixture path');
      assert.ok(normalizedMap.sourcesContent && normalizedMap.sourcesContent[0] === svelteContent, 'Map sourcesContent should be the original Svelte content');
      
      console.log('Normalized V3 map from Preprocessor (first 3 mapping lines):');
      console.log(normalizedMap.mappings.split(';').slice(0, 3).join(';'));

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
        const searchString = expectedMeta.tsShouldContain ?? tokenKey;
        const regex = new RegExp(`\\b${searchString}\\b`);

        if (expectedMeta.inLoopContext) {
            const loopLineIdx = tsLines.findIndex(line => line.includes('for (const fruit of fruits)'));
            assert.notEqual(loopLineIdx, -1, `Could not find TS for...of loop line for token '${tokenKey}'`);
            const loopLine = tsLines[loopLineIdx];
            const match = regex.exec(loopLine);
            if (match) {
                tsLineIndex = loopLineIdx;
                tsColIndex = match.index;
            }
        } else {
            for (let i = 0; i < tsLines.length; i++) {
                const match = regex.exec(tsLines[i]);
                if (match) {
                    // Prioritize finding declarations if applicable (e.g. fruit_decl, index_decl)
                    // This heuristic assumes declarations appear before usages if same name exists.
                    // A more robust way would be to analyze TS AST, but this is for test simplicity.
                    if (tokenKey.endsWith('_decl') && tsLines[i].match(new RegExp(`(const|let|var)\\s+${searchString}`))) {
                         tsLineIndex = i;
                         tsColIndex = match.index;
                         break;
                    }
                    // For fruits_def, ensure it's part of the 'const fruits =' line
                    if (tokenKey === 'fruits_def' && tsLines[i].startsWith('const fruits = ')) {
                        tsLineIndex = i;
                        tsColIndex = match.index;
                        break;
                    }
                    if (tokenKey !== 'fruits_def' && !tokenKey.endsWith('_decl')) { // General case, not a specific declaration
                        tsLineIndex = i;
                        tsColIndex = match.index;
                        break;
                    }
                    // If it's a declaration type but not found yet, and we haven't found a non-decl preferred match, take first overall match
                    if (tsLineIndex === -1) {
                        tsLineIndex = i;
                        tsColIndex = match.index;
                    }
                }
            }
        }
        
        assert.notEqual(tsLineIndex, -1, `Token '${searchString}' (for key '${tokenKey}') not found in compiled TS code: ${compiledTsCode}`);
        assert.notEqual(tsColIndex, -1, `Exact token '${searchString}' (for key '${tokenKey}') not found with word boundary in line ${tsLineIndex + 1}`);

        const originalPos = consumer.originalPositionFor({
          line: tsLineIndex + 1, 
          column: tsColIndex,   
          bias: SourceMapConsumer.GREATEST_LOWER_BOUND
        });

        assert.strictEqual(originalPos.source, filePath, `Source mismatch for token '${tokenKey}'`);
        assert.strictEqual(originalPos.line, expectedMeta.originalLine, `Original line mismatch for token '${tokenKey}'`);
        assert.strictEqual(originalPos.column, expectedMeta.originalColumn, `Original column mismatch for token '${tokenKey}'`);
        console.log(`  Asserted token '${tokenKey}' ('${searchString}'): TS(${tsLineIndex+1}:${tsColIndex}) -> Original(${originalPos.line}:${originalPos.column}) - OK`);
      }
      consumer.destroy();
    });
  }
});