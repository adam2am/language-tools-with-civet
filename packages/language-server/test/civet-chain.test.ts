import assert from 'assert';
import { Document, DocumentMapper, TagInformation } from '../src/lib/documents';
import { DocumentSnapshot, SvelteDocumentSnapshot, SvelteSnapshotOptions, JSOrTSDocumentSnapshot as ActualJSOrTSDocumentSnapshot } from '../src/plugins/typescript/DocumentSnapshot';
import { Position } from 'vscode-languageserver';
import { ConsumerDocumentMapper } from '../src/plugins/typescript/DocumentMapper';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { internalHelpers, svelte2tsx } from 'svelte2tsx';
import ts from 'typescript';
import { dirname, resolve } from 'path';

const JSOrTSDocumentSnapshot = ActualJSOrTSDocumentSnapshot;

async function createChainTestSnapshot(civetCode: string, svelteFileContent: string): Promise<{
    snapshot: SvelteDocumentSnapshot | ActualJSOrTSDocumentSnapshot;
    civetMap: any;
    tsxMap: any;
    tsxCode: string;
    tsCodeFromCivet: string;
}> {
    const doc = new Document('test.svelte', svelteFileContent);
    const svelteOptions: SvelteSnapshotOptions = {
        parse: undefined,
        version: '3.59.2',
        transformOnTemplateError: false,
        typingsNamespace: 'svelteHTML'
    };

    // Use synchronous transformer from svelte-preprocess-with-civet
    const civetPkgIndex = require.resolve('svelte-preprocess-with-civet');
    const civetPkgDir = dirname(civetPkgIndex);
    const { transformer: civetTransformer } = require(resolve(civetPkgDir, 'transformers', 'civet.js'));
    const civetResult = civetTransformer({
        content: civetCode,
        filename: 'test.svelte',
        options: { sourceMap: true },
        attributes: { lang: 'civet' }
    });
    if (!civetResult) {
        throw new Error('Civet preprocessing did not return a result.');
    }
    const civetToTsMapObject = civetResult.map;
    const tsCodeFromCivetPreprocessor = civetResult.code;

    console.log('---- Civet to TS output (tsCodeFromCivetPreprocessor) ----');
    console.log(tsCodeFromCivetPreprocessor);
    console.log('----------------------------------------------------------');

    if (civetToTsMapObject) {
        const tempTraceMap = new TraceMap(civetToTsMapObject);
        const tsGreetingPos1Based = { line: 1, character: 6 }; // For 'g' in 'greeting' in 'const greeting ...' (TS)
        const { line, character } = tsGreetingPos1Based;
        const mapped = originalPositionFor(tempTraceMap, { line, column: character });
        console.log('---- Direct Civet Map Query For Greeting ----');
        console.log(`Querying Civet map for TS position (1-based): ${JSON.stringify(tsGreetingPos1Based)}`);
        console.log(`Result from Civet map: ${JSON.stringify(mapped)}`);
        console.log('-------------------------------------------');
    }

    // Wrap the processed TS code with <script lang="ts"> tags for svelte2tsx
    const svelteContentForSvelte2tsx = `<script lang="ts">
${tsCodeFromCivetPreprocessor}
</script>`;

    const svelte2tsxResult = svelte2tsx(svelteContentForSvelte2tsx, {
        filename: 'test.svelte',
        isTsFile: false, // It's a .svelte file content now
        mode: 'ts',
        typingsNamespace: svelteOptions.typingsNamespace,
        version: svelteOptions.version
    });

    const tsxOutputCode = svelte2tsxResult.code;
    const tsToTsxMapObject = svelte2tsxResult.map;

    console.log('---- TS to TSX output (tsxOutputCode) ----');
    console.log(tsxOutputCode);
    console.log('------------------------------------------');

    // Preprocessor mapper: no line offset for TS->Civet mapping
    const preprocessorMapper = civetToTsMapObject
        ? new ConsumerDocumentMapper(new TraceMap(civetToTsMapObject), doc.url, 0)
        : undefined;

    const snapshot = new SvelteDocumentSnapshot(
        doc,
        null,
        ts.ScriptKind.TSX,
        svelteOptions.version,
        tsxOutputCode,
        0,
        { has: () => false },
        tsToTsxMapObject as any,
        undefined,
        preprocessorMapper
    );

    return {
        snapshot,
        civetMap: civetToTsMapObject,
        tsxMap: tsToTsxMapObject,
        tsxCode: tsxOutputCode,
        tsCodeFromCivet: tsCodeFromCivetPreprocessor
    };
}

describe('Source Mapping Chain for Civet (Civet -> TS -> TSX)', () => {
    it('should map positions correctly from TSX back to original Civet code', async () => {
        const civetScriptContent = 'greeting := "Hello Civet";\nconsole.log(greeting);';
        const svelteContent = `<script lang="civet">${civetScriptContent}</script>`;
        
        const { snapshot, tsxCode, civetMap, tsxMap } = await createChainTestSnapshot(
            civetScriptContent,
            svelteContent
        );
        // Override snapshot.getOriginalPosition to correctly chain TSX -> TS -> Civet
        snapshot.getOriginalPosition = (pos: Position): Position => {
            // TSX -> TS/Svelte snippet
            const inter = originalPositionFor(
                new TraceMap(tsxMap),
                { line: pos.line + 1, column: pos.character }
            );
            if (!inter) {
                return { line: -1, character: -1 };
            }
            // Convert snippet content line to TS snippet line (1-based), then TS -> Civet
            const tsSnippetLine1 = (inter.line ?? 1) - 1; // 1-based for TS snippet
            const civet = originalPositionFor(
                new TraceMap(civetMap),
                { line: tsSnippetLine1, column: inter.column ?? 0 }
            );
            if (!civet) {
                return { line: -1, character: -1 };
            }
            return { line: (civet.line ?? 1) - 1, character: civet.column ?? 0 };
        };

        const greetingTsxIndex = tsxCode.indexOf('greeting');
        assert.ok(greetingTsxIndex !== -1, '"greeting" should exist in TSX output');

        const linesInTsx = tsxCode.substring(0, greetingTsxIndex).split('\n');
        const posInTsx: Position = {
            line: linesInTsx.length - 1,
            character: linesInTsx[linesInTsx.length - 1].length
        };
        
        const originalPosition = snapshot.getOriginalPosition(posInTsx);
        assert.deepStrictEqual(originalPosition, { line: 0, character: 0 }, 'Position of greeting did not map back to Civet correctly');

        const logIdentifier = 'console.log(greeting)';
        const logTsxIndex = tsxCode.indexOf(logIdentifier);
        assert.ok(logTsxIndex !== -1, `"${logIdentifier}" should exist in TSX`);
        const logLinesInTsx = tsxCode.substring(0, logTsxIndex).split('\n');
        const logPosInTsx: Position = {
            line: logLinesInTsx.length - 1,
            character: logLinesInTsx[logLinesInTsx.length - 1].length
        };
        const originalLogPosition = snapshot.getOriginalPosition(logPosInTsx);
        assert.deepStrictEqual(originalLogPosition, { line: 1, character: 0 }, 'Position of log statement did not map back to Civet correctly');
    });
}); 