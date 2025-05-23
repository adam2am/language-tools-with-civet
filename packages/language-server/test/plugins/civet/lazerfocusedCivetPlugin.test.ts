import assert from 'assert';
import {
    CivetPlugin
} from '../../../src/plugins/civet/CivetPlugin';
import { CivetLanguageServiceHost } from '../../../src/typescriptServiceHost';
import { LSConfigManager } from '../../../src/ls-config';
import { Document, TagInformation } from '../../../src/lib/documents';
import { Position, DefinitionLink } from 'vscode-languageserver';
import * as civet from '@danielx/civet';
import { Range } from 'vscode-languageserver-types';


// Helper to create Position objects (0-indexed)
const pos = (line: number, character: number): Position => ({ line, character });

// Helper to create our Document wrapper
const createPluginDocument = (uri: string, text: string): Document => {
    return new Document(uri, text);
};

describe('LazerFocused CivetPlugin - Nested Property Definitions', () => {
    let host: CivetLanguageServiceHost;
    let plugin: CivetPlugin;
    let lsConfigManager: LSConfigManager;
    const testFileUri = 'file:///test-lazerfocused-plugin.svelte';

    // Minimal Civet code to test nested property definition
    const focusedCivetSourceCode = `
<script lang="civet">
// Lazer focus test
myObj := {
  nested: {
    prop: "value"
  }
}
useProp := myObj.nested.prop
</script>
    `;
    // Expected TS for the above Civet
    const expectedFocusedCompiledTs = `// Lazer focus test
const myObj = {
  nested: {
    prop: "value"
  }
}
const useProp = myObj.nested.prop`.trim();

    let document: Document;

    beforeEach(async () => {
        host = new CivetLanguageServiceHost();
        lsConfigManager = new LSConfigManager();
        const mockLsAndTsDocResolver: any = {
            getScriptSnapshot: (fileName: string) => host.getScriptSnapshot(fileName),
            getLsForSyntheticOperations: async () => ({ lang: host, tsDoc: {}, userPreferences: {} }),
            getLSAndTSDoc: async () => ({ lang: host, lsContainer: { getService: () => host } })
        };
        plugin = new CivetPlugin(lsConfigManager, mockLsAndTsDocResolver, host);
        
        document = createPluginDocument(testFileUri, focusedCivetSourceCode);
        console.log('--- [LAZERFOCUS TEST] Document created ---');
        console.log('Full Svelte document content:\n', focusedCivetSourceCode);

        await plugin.handleDocumentChange(document);
        console.log('--- [LAZERFOCUS TEST] handleDocumentChange executed ---');

        const cachedData = plugin.getCompiledCivetDataForTest(testFileUri);
        if (cachedData) {
            console.log('--- [LAZERFOCUS TEST] Cached Data Retrieved ---');
            console.log('Original Civet content (from scriptTagInfo):\n', cachedData.scriptTagInfo?.content);
            console.log('Original Content Line Offset:', cachedData.originalContentLineOffset);
            console.log('Compiled TS Code:\n', cachedData.compiledTsCode);
            console.log('Raw Sourcemap Lines (VLQ):\n', JSON.stringify(cachedData.rawSourcemapLines, null, 2));
            assert.strictEqual(cachedData.compiledTsCode.trim(), expectedFocusedCompiledTs, "Compiled TS code does not match expected");
        } else {
            console.error('--- [LAZERFOCUS TEST] FAILED to retrieve cached data ---');
        }
    });

    it('getDefinitions - for focused nested property `myObj.nested.prop`', async () => {
        console.log('--- [LAZERFOCUS TEST] Running getDefinitions test ---');
        // Position in Svelte document:
        // useProp := myObj.nested.pr*o*p  (targeting 'p' of prop)
        // Line numbering is 0-indexed for the whole Svelte document string.
        // Actual Svelte document structure due to leading newline in focusedCivetSourceCode:
        // [Line 0] <empty line>
        // [Line 1] <script lang="civet">
        // [Line 2] // Lazer focus test
        // [Line 3] myObj := {
        // [Line 4]   nested: {
        // [Line 5]     prop: "value"  <-- Definition target
        // [Line 6]   }
        // [Line 7] }
        // [Line 8] useProp := myObj.nested.prop <-- Usage target
        // Target 'p' in 'prop' on line 8. 'useProp := myObj.nested.' is 24 chars. So 'p' is at char 24.
        const documentPosition = pos(8, 24); 
        console.log('[LAZERFOCUS TEST] Requesting definitions for Svelte document position:', JSON.stringify(documentPosition));

        const definitions = await plugin.getDefinitions(document, documentPosition);
        console.log('[LAZERFOCUS TEST] Definitions received from plugin:', JSON.stringify(definitions, null, 2));

        assert.ok(definitions, 'Definitions should be returned');
        assert.ok(Array.isArray(definitions), 'Definitions should be an array');
        assert.strictEqual(definitions.length > 0, true, 'Should find at least one definition link for `myObj.nested.prop`');

        if (definitions.length > 0) {
            const defLink = definitions[0] as DefinitionLink; // Type assertion for clarity
            assert.strictEqual(defLink.targetUri, testFileUri, 'Definition target URI for prop');
            
            // Expected definition: prop: "value"
            // Svelte document line 5: '    prop: "value"'
            // '    prop' -> start char 4, end char 4 + 'prop'.length = 8
            const expectedTargetSelectionRange: Range = {
                start: pos(5, 4),
                end: pos(5, 8) 
            };
            console.log('[LAZERFOCUS TEST] Expected targetSelectionRange:', JSON.stringify(expectedTargetSelectionRange));
            console.log('[LAZERFOCUS TEST] Actual targetSelectionRange:', JSON.stringify(defLink.targetSelectionRange));

            assert.deepStrictEqual(defLink.targetSelectionRange, expectedTargetSelectionRange, 'Definition target selection range for prop');
        }
    });

    // ---- Test Case for Deeper Nested Property ----
    const deeperTestFileUri = 'file:///test-lazerfocused-deeper-plugin.svelte';
    const deeperNestedCivetSourceCode = `
<script lang="civet">
// Deeper nest test
myObj := {
  level1: {
    level2: {
      deeperProp: "value"
    }
  }
}
useDeeperProp := myObj.level1.level2.deeperProp
</script>
    `;
    const expectedDeeperNestedCompiledTs = `// Deeper nest test
const myObj = {
  level1: {
    level2: {
      deeperProp: "value"
    }
  }
}
const useDeeperProp = myObj.level1.level2.deeperProp`.trim();

    it('getDefinitions - for deeper nested property `myObj.level1.level2.deeperProp`', async () => {
        console.log('--- [LAZERFOCUS TEST] Running getDefinitions for DEEPER NESTED property ---');
        
        // Re-initialize document and plugin with the new source code and URI
        const deeperDocument = createPluginDocument(deeperTestFileUri, deeperNestedCivetSourceCode);
        console.log('--- [LAZERFOCUS TEST] Deeper Nested Document created ---');
        console.log('Full Svelte document content (deeper nested):\n', deeperNestedCivetSourceCode);

        await plugin.handleDocumentChange(deeperDocument);
        console.log('--- [LAZERFOCUS TEST] handleDocumentChange executed for deeper nested ---');

        const cachedDeeperData = plugin.getCompiledCivetDataForTest(deeperTestFileUri);
        if (cachedDeeperData) {
            assert.strictEqual(cachedDeeperData.compiledTsCode.trim(), expectedDeeperNestedCompiledTs, "Deeper nested compiled TS code does not match expected");
        } else {
            assert.fail('--- [LAZERFOCUS TEST] FAILED to retrieve cached data for deeper nested test ---');
        }

        // Position in Svelte document (0-indexed for the whole Svelte document string):
        // Svelte document structure with leading newline:
        // [Line 0] <empty line>
        // [Line 1] <script lang="civet">
        // [Line 2] // Deeper nest test
        // [Line 3] myObj := {
        // [Line 4]   level1: {
        // [Line 5]     level2: {
        // [Line 6]       deeperProp: "value"  <-- Definition target
        // [Line 7]     }
        // [Line 8]   }
        // [Line 9] }
        // [Line 10] useDeeperProp := myObj.level1.level2.deeperProp <-- Usage target (d*e*eperProp)
        // 'useDeeperProp := myObj.level1.level2.' is 37 chars to the start of 'deeperProp'. So 'd' is at char 37.
        const documentPosition = pos(10, 37);
        console.log('[LAZERFOCUS TEST] Requesting definitions for Svelte (deeper nested) position:', JSON.stringify(documentPosition));

        const definitions = await plugin.getDefinitions(deeperDocument, documentPosition);
        console.log('[LAZERFOCUS TEST] Definitions received (deeper nested):', JSON.stringify(definitions, null, 2));

        assert.ok(definitions, 'Definitions should be returned for deeperProp');
        assert.ok(Array.isArray(definitions), 'Definitions should be an array for deeperProp');
        assert.strictEqual(definitions.length > 0, true, 'Should find at least one definition for deeperProp');

        if (definitions.length > 0) {
            const defLink = definitions[0] as DefinitionLink;
            assert.strictEqual(defLink.targetUri, deeperTestFileUri, 'Definition target URI for deeperProp');
            
            // Expected definition: deeperProp: "value"
            // Svelte document line 6: '      deeperProp: "value"'
            // '      deeperProp' -> start char 6, end char 6 + 'deeperProp'.length = 16
            const expectedTargetSelectionRange: Range = {
                start: pos(6, 6),
                end: pos(6, 16)
            };
            console.log('[LAZERFOCUS TEST] Expected targetSelectionRange (deeperProp):', JSON.stringify(expectedTargetSelectionRange));
            console.log('[LAZERFOCUS TEST] Actual targetSelectionRange (deeperProp):', JSON.stringify(defLink.targetSelectionRange));

            assert.deepStrictEqual(defLink.targetSelectionRange, expectedTargetSelectionRange, 'Definition target selection range for deeperProp');
        }
    });

    // ---- Test Case for Nested Number Property ----
    const numberTestFileUri = 'file:///test-lazerfocused-number-plugin.svelte';
    const nestedNumberCivetSourceCode = `
<script lang="civet">
// Nested number test
myNumObj := {
  group: {
    count: 123
  }
}
useCount := myNumObj.group.count
</script>
    `;
    const expectedNestedNumberCompiledTs = `// Nested number test
const myNumObj = {
  group: {
    count: 123
  }
}
const useCount = myNumObj.group.count`.trim();

    it('getDefinitions - for nested number property `myNumObj.group.count`', async () => {
        console.log('--- [LAZERFOCUS TEST] Running getDefinitions for NESTED NUMBER property ---');
        
        const numberDocument = createPluginDocument(numberTestFileUri, nestedNumberCivetSourceCode);
        await plugin.handleDocumentChange(numberDocument);

        const cachedNumberData = plugin.getCompiledCivetDataForTest(numberTestFileUri);
        if (cachedNumberData) {
            assert.strictEqual(cachedNumberData.compiledTsCode.trim(), expectedNestedNumberCompiledTs, "Nested number compiled TS code does not match expected");
        } else {
            assert.fail('--- [LAZERFOCUS TEST] FAILED to retrieve cached data for nested number test ---');
        }

        // Position in Svelte document (0-indexed):
        // [Line 0] <empty line>
        // [Line 1] <script lang="civet">
        // [Line 2] // Nested number test
        // [Line 3] myNumObj := {
        // [Line 4]   group: {
        // [Line 5]     count: 123  <-- Definition target
        // [Line 6]   }
        // [Line 7] }
        // [Line 8] useCount := myNumObj.group.count <-- Usage target (c*o*unt)
        // 'useCount := myNumObj.group.' is 26 chars. 'c' is at char 26.
        const documentPosition = pos(8, 26); 
        const definitions = await plugin.getDefinitions(numberDocument, documentPosition);

        assert.ok(definitions && definitions.length > 0, 'Should find a definition for `count`');
        if (definitions.length > 0) {
            const defLink = definitions[0] as DefinitionLink;
            assert.strictEqual(defLink.targetUri, numberTestFileUri, 'Definition target URI for count');
            // Expected: count: 123
            // Svelte line 5: '    count: 123'
            // '    count' -> start char 4, end char 4 + 'count'.length = 9
            const expectedTargetSelectionRange: Range = { start: pos(5, 4), end: pos(5, 9) };
            assert.deepStrictEqual(defLink.targetSelectionRange, expectedTargetSelectionRange, 'Definition target selection range for count');
        }
    });

    // ---- Test Case for Very Deeply Nested Property (4 levels) ----
    const veryDeepTestFileUri = 'file:///test-lazerfocused-verydeep-plugin.svelte';
    const veryDeepCivetSourceCode = `
<script lang="civet">
// Very deep nest test
deepObj := {
  l1: {
    l2: {
      l3: {
        l4Prop: "final"
      }
    }
  }
}
useVeryDeepProp := deepObj.l1.l2.l3.l4Prop
</script>
    `;
    const expectedVeryDeepCompiledTs = `// Very deep nest test
const deepObj = {
  l1: {
    l2: {
      l3: {
        l4Prop: "final"
      }
    }
  }
}
const useVeryDeepProp = deepObj.l1.l2.l3.l4Prop`.trim();

    it('getDefinitions - for very deeply nested property `deepObj.l1.l2.l3.l4Prop`', async () => {
        console.log('--- [LAZERFOCUS TEST] Running getDefinitions for VERY DEEPLY NESTED property ---');
        
        const veryDeepDocument = createPluginDocument(veryDeepTestFileUri, veryDeepCivetSourceCode);
        await plugin.handleDocumentChange(veryDeepDocument);

        const cachedVeryDeepData = plugin.getCompiledCivetDataForTest(veryDeepTestFileUri);
        if (cachedVeryDeepData) {
            assert.strictEqual(cachedVeryDeepData.compiledTsCode.trim(), expectedVeryDeepCompiledTs, "Very deep compiled TS code does not match expected");
        } else {
            assert.fail('--- [LAZERFOCUS TEST] FAILED to retrieve cached data for very deep test ---');
        }

        // Position in Svelte document (0-indexed):
        // [Line 0] <empty line>
        // [Line 1] <script lang="civet">
        // [Line 2] // Very deep nest test
        // [Line 3] deepObj := {
        // [Line 4]   l1: {
        // [Line 5]     l2: {
        // [Line 6]       l3: {
        // [Line 7]         l4Prop: "final"  <-- Definition target
        // [Line 8]       }
        // [Line 9]     }
        // [Line 10]  }
        // [Line 11] }
        // [Line 12] useVeryDeepProp := deepObj.l1.l2.l3.l4Prop <-- Usage target (l*4*Prop)
        // 'useVeryDeepProp := deepObj.l1.l2.l3.' is 35 chars. 'l' is at char 35.
        const documentPosition = pos(12, 35);
        const definitions = await plugin.getDefinitions(veryDeepDocument, documentPosition);

        assert.ok(definitions && definitions.length > 0, 'Should find a definition for `l4Prop`');
        if (definitions.length > 0) {
            const defLink = definitions[0] as DefinitionLink;
            assert.strictEqual(defLink.targetUri, veryDeepTestFileUri, 'Definition target URI for l4Prop');
            // Expected: l4Prop: "final"
            // Svelte line 7: '        l4Prop: "final"'
            // '        l4Prop' -> start char 8, end char 8 + 'l4Prop'.length = 14
            const expectedTargetSelectionRange: Range = { start: pos(7, 8), end: pos(7, 14) };
            assert.deepStrictEqual(defLink.targetSelectionRange, expectedTargetSelectionRange, 'Definition target selection range for l4Prop');
        }
    });

    // ---- Test Case for Nested Property with Separate Line Assignments ----
    const separateLinesTestFileUri = 'file:///test-lazerfocused-separatelines-plugin.svelte';
    const separateLinesCivetSourceCode = `
<script lang="civet">
// Separate lines assignment test
mySepObj := {}
mySepObj.first = {}
mySepObj.first.second = "assigned_later"

useSeparate := mySepObj.first.second
</script>
    `;
    const expectedSeparateLinesCompiledTs = `// Separate lines assignment test
const mySepObj = {}
mySepObj.first = {}
mySepObj.first.second = "assigned_later"

const useSeparate = mySepObj.first.second`.trim();

    it('getDefinitions - for nested property `mySepObj.first.second` with separate line assignments', async () => {
        console.log('--- [LAZERFOCUS TEST] Running getDefinitions for SEPARATE LINES ASSIGNMENT ---');
        
        const separateLinesDocument = createPluginDocument(separateLinesTestFileUri, separateLinesCivetSourceCode);
        await plugin.handleDocumentChange(separateLinesDocument);

        const cachedSeparateLinesData = plugin.getCompiledCivetDataForTest(separateLinesTestFileUri);
        if (cachedSeparateLinesData) {
            assert.strictEqual(cachedSeparateLinesData.compiledTsCode.trim(), expectedSeparateLinesCompiledTs, "Separate lines compiled TS code does not match expected");
        } else {
            assert.fail('--- [LAZERFOCUS TEST] FAILED to retrieve cached data for separate lines test ---');
        }

        // Position in Svelte document (0-indexed):
        // [Line 0] <empty line>
        // [Line 1] <script lang="civet">
        // [Line 2] // Separate lines assignment test
        // [Line 3] mySepObj := {}
        // [Line 4] mySepObj.first = {}
        // [Line 5] mySepObj.first.second = "assigned_later"  <-- Definition target
        // [Line 6] 
        // [Line 7] useSeparate := mySepObj.first.second <-- Usage target (s*e*cond)
        // 'useSeparate := mySepObj.first.' is 29 chars. 's' is at char 29.
        const documentPosition = pos(7, 29);
        const definitions = await plugin.getDefinitions(separateLinesDocument, documentPosition);

        assert.ok(definitions && definitions.length > 0, 'Should find a definition for `second` (separate lines)');
        if (definitions.length > 0) {
            const defLink = definitions[0] as DefinitionLink;
            assert.strictEqual(defLink.targetUri, separateLinesTestFileUri, 'Definition target URI for second (separate lines)');
            // Expected: mySepObj.first.second = "assigned_later"
            // Target is 'second' in this line.
            // Svelte line 5: 'mySepObj.first.second = "assigned_later"'
            // 'mySepObj.first.' is 15 chars. 'second' starts at char 15.
            // 'second'.length is 6. So ends at char 15+6=21
            const expectedTargetSelectionRange: Range = { start: pos(5, 15), end: pos(5, 21) };
            assert.deepStrictEqual(defLink.targetSelectionRange, expectedTargetSelectionRange, 'Definition target selection range for second (separate lines)');
        }
    });
});
