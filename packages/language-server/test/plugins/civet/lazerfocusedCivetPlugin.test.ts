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
        // <script lang="civet"> (line 0)
        // // Lazer focus test   (line 1)
        // myObj := {             (line 2)
        //   nested: {           (line 3)
        //     prop: "value"     (line 4)
        //   }                   (line 5)
        // }                     (line 6)
        // useProp := myObj.nested.prop (line 7)
        // Target 'p' in 'prop' on line 7. 'useProp := myObj.nested.' is 24 chars. So 'p' is at char 24.
        const documentPosition = pos(7, 24); 
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
            // Svelte document line 4: '    prop: "value"'
            // '    prop' -> start char 4, end char 4 + 'prop'.length = 8
            const expectedTargetSelectionRange: Range = {
                start: pos(4, 4),
                end: pos(4, 8) 
            };
            console.log('[LAZERFOCUS TEST] Expected targetSelectionRange:', JSON.stringify(expectedTargetSelectionRange));
            console.log('[LAZERFOCUS TEST] Actual targetSelectionRange:', JSON.stringify(defLink.targetSelectionRange));

            assert.deepStrictEqual(defLink.targetSelectionRange, expectedTargetSelectionRange, 'Definition target selection range for prop');
        }
    });
});
