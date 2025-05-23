import assert from 'assert';
import * as civet from '@danielx/civet';
import { CivetLanguageServiceHost, SourceMapLinesEntry } from '../src/typescriptServiceHost';
import { transformCivetSourcemapLines } from '../src/plugins/civet/util';
import type { Position } from 'vscode-languageserver-types'; // Using a more standard type import

// Helper to create Position objects
const pos = (line: number, character: number): Position => ({ line, character });

describe('CivetLanguageServiceHost', () => {

    describe('Basic file operations', () => {
        let host: CivetLanguageServiceHost;
        const testFileUri = 'file:///test-basic.svelte'; // Test with a .svelte URI as per typical use case

        beforeEach(() => {
            host = new CivetLanguageServiceHost();
        });

        it('should correctly update and retrieve a Civet file', () => {
            const civetCode = `
                // Test Civet code
                name2 .= "world"
                console.log("Hello " + name2)
            `;
            const compileResult = civet.compile(civetCode, {
                js: false,
                sourceMap: true,
                inlineMap: false,
                sync: true,
                filename: testFileUri // filename for the original civet source
            });

            const compiledTsCode = compileResult.code;
            let transformedMapLines: SourceMapLinesEntry[] = [];
            if (compileResult.sourceMap && compileResult.sourceMap.lines) {
                transformedMapLines = transformCivetSourcemapLines(compileResult.sourceMap.lines);
            }

            host.updateCivetFile(testFileUri, compiledTsCode, transformedMapLines);

            const scriptInfo = host.getScriptInfo(testFileUri);
            assert.ok(scriptInfo, 'Script info should exist for basic operations test');
            assert.strictEqual(scriptInfo?.code, compiledTsCode, 'Compiled code should match');
            assert.strictEqual(scriptInfo?.version, 1, 'Version should be 1 after first update');
            assert.deepStrictEqual(scriptInfo?.sourcemapLines, transformedMapLines, 'Sourcemap lines should match');

            const snapshot = host.getScriptSnapshot(testFileUri);
            assert.ok(snapshot, 'Snapshot should exist for basic operations test');
            assert.strictEqual(snapshot?.getText(0, snapshot.getLength()), compiledTsCode, 'Snapshot content should match compiled code');
        });
    });

    describe('Language features', () => {
        let host: CivetLanguageServiceHost;
        // Use a Svelte file URI, as this is how CivetPlugin will key the host.
        // The Civet code is assumed to be within a <script lang="civet"> tag in this Svelte file.
        const testSvelteFileUri = 'file:///test-lang-features.svelte'; 
        
        const civetSourceCode = `
param := 123
// Main variable for testing
x := 42 
export x 
y := "test" 
z := x + param
        `;

        let compiledTsCodeForFeatures: string;
        let transformedMapLinesForFeatures: SourceMapLinesEntry[];

        before(() => {
            // The filename passed to civet.compile should be the Svelte file URI,
            // so that sourcemaps correctly refer to the original Svelte file.
            const compileResult = civet.compile(civetSourceCode, {
                filename: testSvelteFileUri, // Source map should refer to original .svelte file
                sync: true,
                sourceMap: true,
                inlineMap: false,
                js: false
            });
            compiledTsCodeForFeatures = compileResult.code;
            if (compileResult.sourceMap && compileResult.sourceMap.lines) {
                transformedMapLinesForFeatures = transformCivetSourcemapLines(compileResult.sourceMap.lines);
            } else {
                transformedMapLinesForFeatures = [];
            }
        });

        beforeEach(() => {
            host = new CivetLanguageServiceHost();
            // The host is keyed by the Svelte file URI.
            host.updateCivetFile(testSvelteFileUri, compiledTsCodeForFeatures, transformedMapLinesForFeatures);
        });

        it('should provide quick info for an exported variable', () => {
            const lines = compiledTsCodeForFeatures.split('\n');
            let targetLine = -1, targetChar = -1;
            for (let i = 0; i < lines.length; i++) {
                // Find the declaration of x (e.g., "const x = 42")
                const xDeclarationMatch = lines[i].match(/^\s*(const|let|var)\s+x\s*=/);
                if (xDeclarationMatch) {
                    targetLine = i;
                    // Get the character position of 'x' itself
                    targetChar = lines[i].indexOf('x'); 
                    break;
                }
            }
            assert.notStrictEqual(targetLine, -1, "Target line for 'x' declaration not found in compiled TS");
            assert.notStrictEqual(targetChar, -1, "Target char for 'x' declaration not found in compiled TS");

            const quickInfo = host.getQuickInfo(testSvelteFileUri, pos(targetLine, targetChar));
            assert.ok(quickInfo, 'QuickInfo should be returned');
            assert.ok(quickInfo?.displayParts?.some(p => p.text.includes('x')), 'QuickInfo displayParts should mention x');
        });

        it('should provide definitions for an exported variable', () => {
            const lines = compiledTsCodeForFeatures.split('\n');
            let targetLine = -1, targetChar = -1;
            for (let i = 0; i < lines.length; i++) {
                // Find the declaration of x (e.g., "const x = 42")
                const xDeclarationMatch = lines[i].match(/^\s*(const|let|var)\s+x\s*=/);
                if (xDeclarationMatch) {
                    targetLine = i;
                    // Get the character position of 'x' itself
                    targetChar = lines[i].indexOf('x');
                    break;
                }
            }
            assert.notStrictEqual(targetLine, -1, "Target line for 'x' declaration (definition) not found");
            assert.notStrictEqual(targetChar, -1, "Target char for 'x' declaration (definition) not found");

            const definitions = host.getDefinitions(testSvelteFileUri, pos(targetLine, targetChar));
            assert.ok(definitions && definitions.length > 0, 'Definitions should be returned and not empty');
            // TS service will return the filename it knows, which is the key we used with the host.
            assert.ok(definitions?.some(def => def.fileName === testSvelteFileUri), 'Definition fileName should match the test Svelte file URI');
        });

        it('should provide completions in the file', () => {
            const lines = compiledTsCodeForFeatures.split('\n');
            assert.ok(lines.length > 0, "Compiled code should not be empty for completion test");

            // Request completions at the start of a new line after all existing code
            const completionLine = lines.length -1; // Last line of the script (could be an empty line)
            const completionChar = 0; // Beginning of that line

            const completions = host.getCompletions(testSvelteFileUri, pos(completionLine, completionChar), {});
            assert.ok(completions, 'Completions object should be returned');
            assert.ok(completions!.entries.length > 0, 'Completions should not be empty');
            assert.ok(completions!.entries.some(e => e.name === 'x'), 'Completions should include x');
            assert.ok(completions!.entries.some(e => e.name === 'y'), 'Completions should include y');
            assert.ok(completions!.entries.some(e => e.name === 'param'), 'Completions should include param');
        });
    });

    describe('Complex scenarios', () => {
        let host: CivetLanguageServiceHost;
        const complexTestSvelteFileUri = 'file:///test-complex-scenario.svelte';

        const complexCivetSourceCode = `
// Generate a random integer between min (inclusive) and max (inclusive)
randomInt := (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

// Roll a dice (1-6)
dice := randomInt(1, 6)

// Check if dice roll is less than 3
if dice < 3
  console.log "Less than three"
else
  console.log "More than or equal to three"
        `;

        let compiledTsCodeForComplexScenario: string;
        let transformedMapLinesForComplexScenario: SourceMapLinesEntry[];

        before(() => {
            const compileResult = civet.compile(complexCivetSourceCode, {
                filename: complexTestSvelteFileUri,
                sync: true,
                sourceMap: true,
                inlineMap: false,
                js: false
            });
            compiledTsCodeForComplexScenario = compileResult.code;
            console.log('\n--- Compiled TypeScript for Complex Scenario ---\n', compiledTsCodeForComplexScenario);
            console.log('--- End Compiled TypeScript ---\n');

            if (compileResult.sourceMap && compileResult.sourceMap.lines) {
                transformedMapLinesForComplexScenario = transformCivetSourcemapLines(compileResult.sourceMap.lines);
            } else {
                transformedMapLinesForComplexScenario = [];
            }
        });

        beforeEach(() => {
            host = new CivetLanguageServiceHost();
            host.updateCivetFile(complexTestSvelteFileUri, compiledTsCodeForComplexScenario, transformedMapLinesForComplexScenario);
        });

        // TODO: Add specific tests for quick info, definitions, completions for tokens in complexCivetSourceCode
        it('should have compiled code for complex scenario', () => {
            assert.ok(compiledTsCodeForComplexScenario, "Compiled TS code for complex scenario should exist");
            assert.ok(compiledTsCodeForComplexScenario.length > 0, "Compiled TS code for complex scenario should not be empty");
        });

    });

    // TODO: Phase 2 tests involving forwardMap/remapPosition for Svelte/Civet positions.
}); 