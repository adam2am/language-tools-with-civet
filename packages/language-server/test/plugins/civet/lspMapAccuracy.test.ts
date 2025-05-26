import { strict as assert } from 'assert';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, Range, Location, TextDocumentItem } from 'vscode-languageserver-types';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { PluginHost, TypeScriptPlugin, SveltePlugin, HTMLPlugin, CSSPlugin } from '../../../src/plugins';
import { LSAndTSDocResolver } from '../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl, normalizePath } from '../../../src/utils';
import * as path from 'path';
import * as fs from 'fs';
import { createLanguageServices } from '../../../src/plugins/css/service'; 
import { FileSystemProvider } from '../../../src/plugins/css/FileSystemProvider'; 

// Helper to create a document
function createDoc(textDocumentItem: Pick<TextDocumentItem, 'uri' | 'text'>): Document {
    const doc = TextDocument.create(textDocumentItem.uri, 'svelte', 0, textDocumentItem.text);
    return new Document(doc.uri, doc.getText());
}

describe('Civet End-to-End Mapping Accuracy #civet', () => {
    const workspaceRoot = normalizePath(path.join(__dirname, '..', '..', 'testfiles', 'civet-mapping')); 
    const fixturesDir = path.join(workspaceRoot, 'fixtures'); 

    // Ensure fixtures directory exists
    if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Use the existing 1-line fixture for test content
    const sourceFixturePath = path.join(__dirname, 'fixtures', 'abc1line.svelte');
    const svelteFileContent = fs.readFileSync(sourceFixturePath, 'utf-8');
    const testFileName = 'abc1line.svelte';
    const testFilePath = normalizePath(path.join(fixturesDir, testFileName));
    fs.writeFileSync(testFilePath, svelteFileContent);

    let docManager: DocumentManager;
    let pluginHost: PluginHost;
    let tsPlugin: TypeScriptPlugin;
    let document: Document;

    before(async function() {
        this.timeout(10000); // 10 seconds timeout instead of default 2 seconds

        docManager = new DocumentManager(createDoc);
        const configManager = new LSConfigManager();
        pluginHost = new PluginHost(docManager);

        pluginHost.register(new SveltePlugin(configManager));
        pluginHost.register(new HTMLPlugin(docManager, configManager));
        pluginHost.register(new CSSPlugin(docManager, configManager, [{ name: 'ws', uri: pathToUrl(workspaceRoot) }], createLanguageServices({ fileSystemProvider: new FileSystemProvider(), clientCapabilities: {} as any })));


        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(workspaceRoot)],
            configManager,
            { watch: false } 
        );

        tsPlugin = new TypeScriptPlugin(configManager, lsAndTsDocResolver, [pathToUrl(workspaceRoot)], docManager);
        pluginHost.register(tsPlugin);
        
        pluginHost.initialize({ filterIncompleteCompletions: true, definitionLinkSupport: true });

        document = docManager.openClientDocument({ uri: pathToUrl(testFilePath), text: svelteFileContent });
        await new Promise(resolve => setTimeout(resolve, 2000)); 
    });

    it('should provide correct hover for a Civet function', async function() {
        this.timeout(10000);
        const docText = document.getText();
        const token = 'funcForTest';
        const defIndex = docText.indexOf(token);
        assert.ok(defIndex !== -1, `Token '${token}' not found in document`);
        const position = document.positionAt(defIndex);
        const hoverInfo = await pluginHost.doHover(document, position);
        assert.ok(hoverInfo, 'Hover info should be returned');
        assert.ok(hoverInfo.contents, 'Hover contents should exist');
        // The hover range should start exactly on the token
        assert.strictEqual(hoverInfo.range?.start.line, position.line, `Hover start line mismatch. Expected ${position.line}, got ${hoverInfo.range?.start.line}`);
        assert.strictEqual(hoverInfo.range?.start.character, position.character, `Hover start character mismatch. Expected ${position.character}, got ${hoverInfo.range?.start.character}`);
    });

    it('should provide correct definition for a Civet variable', async function() {
        this.timeout(10000);
        const docText = document.getText();
        const usageToken = '{abc}';
        const usageIndex = docText.indexOf(usageToken);
        assert.ok(usageIndex !== -1, `Usage token '${usageToken}' not found in document`);
        const position = document.positionAt(usageIndex + usageToken.indexOf('abc'));
        const definitionLocations = await pluginHost.getDefinitions(document, position);
        assert.ok(definitionLocations && (Array.isArray(definitionLocations) ? definitionLocations.length > 0 : true), 'Definition should be returned');
        const defLink = Array.isArray(definitionLocations) ? definitionLocations[0] : definitionLocations;
        // Determine range property name depending on Location or LocationLink
        const defRange = ('range' in defLink ? defLink.range : defLink.targetRange) as Range;
        assert.ok(defRange, 'Definition range should exist');
        const declToken = 'abc';
        const declIndex = docText.indexOf(declToken);
        assert.ok(declIndex !== -1, `Declaration token '${declToken}' not found in document`);
        const expectedPosition = document.positionAt(declIndex);
        assert.strictEqual(defRange.start.line, expectedPosition.line, `Definition start line mismatch. Expected ${expectedPosition.line}, got ${defRange.start.line}`);
        assert.strictEqual(defRange.start.character, expectedPosition.character, `Definition start character mismatch. Expected ${expectedPosition.character}, got ${defRange.start.character}`);
    });

    it('should provide correct hover for funcForTest in template', async function() {
        this.timeout(10000);
        const docText = document.getText();
        const token = 'funcForTest';
        const lastIndex = docText.lastIndexOf(token);
        assert.ok(lastIndex !== -1, `Token '${token}' not found in document`);
        const position = document.positionAt(lastIndex);
        const hoverInfo = await pluginHost.doHover(document, position);
        assert.ok(hoverInfo, 'Hover info should be returned for template token');
        assert.ok(hoverInfo.contents, 'Hover contents should exist for template token');
        assert.strictEqual(hoverInfo.range?.start.line, position.line, `Template hover start line mismatch. Expected ${position.line}, got ${hoverInfo.range?.start.line}`);
        assert.strictEqual(hoverInfo.range?.start.character, position.character, `Template hover start character mismatch. Expected ${position.character}, got ${hoverInfo.range?.start.character}`);
    });

    after(() => {
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
        const parentDir = path.dirname(testFilePath);
        if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
            fs.rmdirSync(parentDir);
        }
         const grandParentDir = path.dirname(parentDir);
        if (fs.existsSync(grandParentDir) && fs.readdirSync(grandParentDir).length === 0 && grandParentDir !== workspaceRoot) {
            fs.rmdirSync(grandParentDir);
        }

    });
});
