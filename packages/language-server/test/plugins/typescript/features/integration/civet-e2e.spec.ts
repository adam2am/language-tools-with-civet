import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import { Diagnostic, Position, Hover, Location } from 'vscode-languageserver-types';
import { DocumentManager, Document } from '../../../../../src/lib/documents';
import { LSConfigManager } from '../../../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../../../src/plugins/typescript/LSAndTSDocResolver';
import { HoverProviderImpl } from '../../../../../src/plugins/typescript/features/HoverProvider';
import { DiagnosticsProviderImpl } from '../../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { setupVirtualEnvironment } from '../../test-utils';
import { pathToUrl } from '../../../../../src/utils';

import ts from 'typescript';

describe('Civet End-to-End LS Integration', () => {
    const testDir = path.join(__dirname, '..', 'testfiles', 'integration');
    
    const { 
        document, 
        docManager, 
        lsAndTsDocResolver, 
        lsConfigManager 
    } = setupVirtualEnvironment({
        testDir,
        filename: 'civet-e2e.svelte',
        fileContent: fs.readFileSync(path.join(__dirname, 'civet-e2e.svelte'), 'utf-8')
    });
    
    let hoverProvider: HoverProviderImpl;
    let diagnosticsProvider: DiagnosticsProviderImpl;

    before(() => {
        hoverProvider = new HoverProviderImpl(lsAndTsDocResolver);
        diagnosticsProvider = new DiagnosticsProviderImpl(lsAndTsDocResolver, lsConfigManager);
    });

    const e2eCivetFile = path.join(__dirname, 'civet-e2e.svelte');
    const e2eCivetUri = pathToUrl(e2eCivetFile);

    async function openDocumentForTesting(docUri: string): Promise<Document> {
        let doc = docManager.get(docUri);
        if (!doc) {
            const filePath = url.fileURLToPath(docUri);
            const content = fs.readFileSync(filePath, 'utf-8');
            docManager.openClientDocument({ uri: docUri, text: content });
            doc = docManager.get(docUri);
            if (!doc) throw new Error(`Test file not found or could not be loaded: ${docUri}`);
        }
        await lsAndTsDocResolver.getLSAndTSDoc(doc);
        return doc;
    }

    describe('Hover Provider', () => {
        it('should provide hover info for variable in Civet script', async () => {
            const document = await openDocumentForTesting(e2eCivetUri);
            const position = Position.create(1, 10);
            const hover = await hoverProvider.doHover(document, position);
            assert.ok(hover, 'Hover should not be null');
            assert.ok(hover?.contents, 'Hover contents should exist');
            const hoverText = JSON.stringify(hover.contents);
            assert.ok(hoverText.includes('name') && (hoverText.includes('string') || hoverText.includes('World')), 'Hover for "name" is incorrect');
        });

        it('should provide hover info for function in Civet script', async () => {
            const document = await openDocumentForTesting(e2eCivetUri);
            const position = Position.create(2, 15);
            const hover = await hoverProvider.doHover(document, position);
            assert.ok(hover, 'Hover should not be null');
            const hoverText = JSON.stringify(hover.contents);
            assert.ok(hoverText.includes('addExclamation') && hoverText.includes('(text: string)'), 'Hover for "addExclamation" is incorrect');
        });
    });

    describe('Diagnostics Provider', () => {
        it('should (not) provide diagnostics for type errors in Civet script (when error is commented out)', async () => {
            const document = await openDocumentForTesting(e2eCivetUri);
            const diagnostics = await diagnosticsProvider.getDiagnostics(document);
            const errorLine = 7;
            const expectedErrorPresent = diagnostics.some((d: Diagnostic) => 
                d.range.start.line === errorLine && 
                d.message.includes('Operator \'+Cannot be applied to types')
            );
            assert.strictEqual(expectedErrorPresent, false, 'Unexpected type error diagnostic found. Check civet-e2e.svelte if error is commented out.');
        });
    });
}); 