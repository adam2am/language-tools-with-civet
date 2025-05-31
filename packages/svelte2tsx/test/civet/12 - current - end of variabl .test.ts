import { svelte2tsx } from '../../src/svelte2tsx';
import { readFileSync } from 'fs';
import { TraceMap, type EncodedSourceMap, traceSegment } from '@jridgewell/trace-mapping';
import path from 'path';
import assert from 'assert';

describe('#current Civet End Variable Mapping Issues for endVariable.svelte', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'endVariable.svelte');
    const svelteCode = readFileSync(fixturePath, 'utf-8');
    const svelteLines = svelteCode.split('\n');
    const { code: tsxCode, map: rawMapFromSvelte2tsx } = svelte2tsx(svelteCode, {
        filename: 'endVariable.svelte',
        // To see full svelte2tsx logs during test, uncomment next line
        // emitOnTemplateError: true, // force some logging path
    });

    const rawMap: EncodedSourceMap | null = rawMapFromSvelte2tsx
        ? {
            ...rawMapFromSvelte2tsx,
            file: rawMapFromSvelte2tsx.file || 'endVariable.svelte',
            version: 3,
            sources: rawMapFromSvelte2tsx.sources || [],
            sourcesContent: rawMapFromSvelte2tsx.sourcesContent || [svelteCode],
            names: rawMapFromSvelte2tsx.names || [],
            mappings: rawMapFromSvelte2tsx.mappings || ''
        }
        : null;

    const findPositionInGeneratedCode = (searchText: string, generatedCode: string, isPartOfToken = false): { line: number; column: number; foundLineContent: string } | null => {
        const lines = generatedCode.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const col = lines[i].indexOf(searchText);
            if (col !== -1) {
                return { line: i + 1, column: isPartOfToken ? col + searchText.length -1 : col, foundLineContent: lines[i] };
            }
        }
        return null;
    };
    
    // Simplified: Finds the first occurrence of charToFind within the first occurrence of contextString in the generatedCode
    const findCharacterInContext = (charToFind: string, contextString: string, generatedCode: string): { line: number; column: number; foundLineContent: string } | null => {
        const lines = generatedCode.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const lineContent = lines[i];
            const contextStartIndex = lineContent.indexOf(contextString);
            if (contextStartIndex !== -1) {
                 // Ensure charToFind is searched *within* the found contextString
                 const charIndexInLine = lineContent.indexOf(charToFind, contextStartIndex);
                 // Check if charToFind is actually part of this specific contextString occurrence
                 if (charIndexInLine !== -1 && charIndexInLine >= contextStartIndex && charIndexInLine < contextStartIndex + contextString.length) {
                     return { line: i + 1, column: charIndexInLine, foundLineContent: lines[i] };
                 }
            }
        }
        return null;
    };


    it('should replicate the reported mapping for propFunc semicolon and check variable `b` mapping', () => {
        if (!rawMap) throw new Error('Sourcemap is null or undefined for propFunc test');
        
        const tracer = new TraceMap(rawMap as EncodedSourceMap);

        // Test 1: Semicolon mapping (as per user report)
        const propFuncAssignmentSnippet = 'number = number * b;';
        const tsxSemicolonLocation = findPositionInGeneratedCode(propFuncAssignmentSnippet, tsxCode, true);

        if (!tsxSemicolonLocation) {
            console.error(`Could not find "${propFuncAssignmentSnippet}" in generated TSX for propFunc. TSX Code:\n${tsxCode}`);
            throw new Error(`Could not find "${propFuncAssignmentSnippet}" in generated TSX for propFunc.`);
        }
        console.log(`[propFunc Test - Semicolon] Found TSX target ';' in "${tsxSemicolonLocation.foundLineContent.trim()}" at L${tsxSemicolonLocation.line}C${tsxSemicolonLocation.column} (0-indexed col)`);
        const tracedSemicolonSegment = traceSegment(tracer, tsxSemicolonLocation.line - 1, tsxSemicolonLocation.column);
        assert(tracedSemicolonSegment, 'traceSegment should return a valid segment for propFunc semicolon');
        const semicolonOriginalSource = tracer.sources[tracedSemicolonSegment[1]];
        const semicolonOriginalLine = tracedSemicolonSegment[2] + 1; 
        const semicolonOriginalColumn = tracedSemicolonSegment[3];
        console.log(`[propFunc Test - Semicolon] TSX L${tsxSemicolonLocation.line}C${tsxSemicolonLocation.column} (target: ';') maps to Svelte (${semicolonOriginalSource}) L${semicolonOriginalLine}C${semicolonOriginalColumn}`);
        if (semicolonOriginalLine > 0 && semicolonOriginalLine <= svelteLines.length) {
            console.log(`[propFunc Test - Semicolon] Mapped Svelte Line Content: "${svelteLines[semicolonOriginalLine - 1].trim()}"`);
        }
        const bDefLineNumber = 4; 
        const bDefLineContent = svelteLines[bDefLineNumber - 1];
        const bDefColumnForSemicolonReport = bDefLineContent.indexOf('b: number)'); 
        console.log(`[propFunc Test - Semicolon] User report expected Svelte L${bDefLineNumber}C${bDefColumnForSemicolonReport} (for 'b' in "${bDefLineContent.trim()}") due to semicolon hover`);
        assert.strictEqual(semicolonOriginalLine, bDefLineNumber, 'Semicolon mapping: Original line differs from user report expectation (maps to b def line)');

        // Test 2: Variable `b` usage mapping
        // We are looking for `b` within the context `number * b`
        const tsxVarBLocation = findCharacterInContext('b', 'number * b', tsxCode);
        if (!tsxVarBLocation) {
            console.error(`Could not find variable 'b' in context "number * b" in generated TSX. TSX Code:\n${tsxCode}`);
            throw new Error(`Could not find variable 'b' in context "number * b" in generated TSX.`);
        }
        console.log(`[propFunc Test - Var 'b'] Found TSX target 'b' in "${tsxVarBLocation.foundLineContent.trim()}" at L${tsxVarBLocation.line}C${tsxVarBLocation.column} (0-indexed col)`);
        const tracedVarBSegment = traceSegment(tracer, tsxVarBLocation.line - 1, tsxVarBLocation.column);
        assert(tracedVarBSegment, 'traceSegment should return a valid segment for propFunc var b');
        const varBOriginalSource = tracer.sources[tracedVarBSegment[1]];
        const varBOriginalLine = tracedVarBSegment[2] + 1;
        const varBOriginalColumn = tracedVarBSegment[3];
        console.log(`[propFunc Test - Var 'b'] TSX L${tsxVarBLocation.line}C${tsxVarBLocation.column} (target: 'b') maps to Svelte (${varBOriginalSource}) L${varBOriginalLine}C${varBOriginalColumn}`);
        if (varBOriginalLine > 0 && varBOriginalLine <= svelteLines.length) {
            console.log(`[propFunc Test - Var 'b'] Mapped Svelte Line Content: "${svelteLines[varBOriginalLine - 1].trim()}"`);
        }
        const bDefColumnForVar = bDefLineContent.indexOf('b: number)');
        console.log(`[propFunc Test - Var 'b'] Expected Svelte L${bDefLineNumber}C${bDefColumnForVar} (for definition of 'b' in "${bDefLineContent.trim()}")`);
        assert.strictEqual(varBOriginalSource, 'endVariable.svelte', 'Incorrect source file for propFunc var b');
        assert.strictEqual(varBOriginalLine, bDefLineNumber, 'Incorrect line for propFunc var b mapping');
        assert.strictEqual(varBOriginalColumn, bDefColumnForVar, 'Incorrect column for propFunc var b mapping');
    });

    it('should replicate the reported mapping for twoPropsFunc asterisk and check variables `ab`, `bc` mapping', () => {
        if (!rawMap) throw new Error('Sourcemap is null or undefined for twoPropsFunc test');
        const tracer = new TraceMap(rawMap as EncodedSourceMap);

        // Test 1: Asterisk mapping (as per user report)
        const twoPropsFuncOpContext = 'ab * bc';
        const tsxAsteriskLocation = findCharacterInContext('*', twoPropsFuncOpContext, tsxCode);
        if (!tsxAsteriskLocation) {
            console.error(`Could not find '*' in context "${twoPropsFuncOpContext}" in generated TSX. TSX Code:\n${tsxCode}`);
            throw new Error(`Could not find '*' in context "${twoPropsFuncOpContext}" in generated TSX.`);
        }
        console.log(`[twoPropsFunc Test - Asterisk] Found TSX target '*' in "${tsxAsteriskLocation.foundLineContent.trim()}" at L${tsxAsteriskLocation.line}C${tsxAsteriskLocation.column} (0-indexed col)`);
        const tracedAsteriskSegment = traceSegment(tracer, tsxAsteriskLocation.line - 1, tsxAsteriskLocation.column);
        assert(tracedAsteriskSegment, 'traceSegment should return a valid segment for twoPropsFunc asterisk');
        const asteriskOriginalSource = tracer.sources[tracedAsteriskSegment[1]];
        const asteriskOriginalLine = tracedAsteriskSegment[2] + 1;
        const asteriskOriginalColumn = tracedAsteriskSegment[3];
        console.log(`[twoPropsFunc Test - Asterisk] TSX L${tsxAsteriskLocation.line}C${tsxAsteriskLocation.column} (target: '*') maps to Svelte (${asteriskOriginalSource}) L${asteriskOriginalLine}C${asteriskOriginalColumn}`);
        if (asteriskOriginalLine > 0 && asteriskOriginalLine <= svelteLines.length) {
            console.log(`[twoPropsFunc Test - Asterisk] Mapped Svelte Line Content: "${svelteLines[asteriskOriginalLine - 1].trim()}"`);
        }
        const abDefLineNumber = 7;
        const abDefLineContent = svelteLines[abDefLineNumber - 1];
        const abDefColumnForAsteriskReport = abDefLineContent.indexOf('ab: number');
        console.log(`[twoPropsFunc Test - Asterisk] User report expected Svelte L${abDefLineNumber}C${abDefColumnForAsteriskReport} (for 'ab' in "${abDefLineContent.trim()}") due to asterisk hover`);
        assert.strictEqual(asteriskOriginalLine, abDefLineNumber, 'Asterisk mapping: Original line differs from user report expectation (maps to ab def line)');

        // Test 2: Variable `ab` usage mapping
        const tsxVarAbLocation = findCharacterInContext('ab', 'ab * bc', tsxCode);
        if (!tsxVarAbLocation) {
            console.error(`Could not find variable 'ab' in context "ab * bc" in generated TSX. TSX Code:\n${tsxCode}`);
            throw new Error(`Could not find variable 'ab' in context "ab * bc" in generated TSX.`);
        }
        console.log(`[twoPropsFunc Test - Var 'ab'] Found TSX target 'ab' in "${tsxVarAbLocation.foundLineContent.trim()}" at L${tsxVarAbLocation.line}C${tsxVarAbLocation.column} (0-indexed col)`);
        const tracedVarAbSegment = traceSegment(tracer, tsxVarAbLocation.line - 1, tsxVarAbLocation.column);
        assert(tracedVarAbSegment, 'traceSegment should return a valid segment for twoPropsFunc var ab');
        const varAbOriginalSource = tracer.sources[tracedVarAbSegment[1]];
        const varAbOriginalLine = tracedVarAbSegment[2] + 1;
        const varAbOriginalColumn = tracedVarAbSegment[3];
        console.log(`[twoPropsFunc Test - Var 'ab'] TSX L${tsxVarAbLocation.line}C${tsxVarAbLocation.column} (target: 'ab') maps to Svelte (${varAbOriginalSource}) L${varAbOriginalLine}C${varAbOriginalColumn}`);
        if (varAbOriginalLine > 0 && varAbOriginalLine <= svelteLines.length) {
            console.log(`[twoPropsFunc Test - Var 'ab'] Mapped Svelte Line Content: "${svelteLines[varAbOriginalLine - 1].trim()}"`);
        }
        const abDefColumnForVar = abDefLineContent.indexOf('ab: number');
        console.log(`[twoPropsFunc Test - Var 'ab'] Expected Svelte L${abDefLineNumber}C${abDefColumnForVar} (for definition of 'ab' in "${abDefLineContent.trim()}")`);
        assert.strictEqual(varAbOriginalSource, 'endVariable.svelte', 'Incorrect source file for twoPropsFunc var ab');
        assert.strictEqual(varAbOriginalLine, abDefLineNumber, 'Incorrect line for twoPropsFunc var ab mapping');
        assert.strictEqual(varAbOriginalColumn, abDefColumnForVar, 'Incorrect column for twoPropsFunc var ab mapping');

        // Test 3: Variable `bc` usage mapping
        const tsxVarBcLocation = findCharacterInContext('bc', 'ab * bc', tsxCode);
        if (!tsxVarBcLocation) {
            console.error(`Could not find variable 'bc' in context "ab * bc" in generated TSX. TSX Code:\n${tsxCode}`);
            throw new Error(`Could not find variable 'bc' in context "ab * bc" in generated TSX.`);
        }
        console.log(`[twoPropsFunc Test - Var 'bc'] Found TSX target 'bc' in "${tsxVarBcLocation.foundLineContent.trim()}" at L${tsxVarBcLocation.line}C${tsxVarBcLocation.column} (0-indexed col)`);
        const tracedVarBcSegment = traceSegment(tracer, tsxVarBcLocation.line - 1, tsxVarBcLocation.column);
        assert(tracedVarBcSegment, 'traceSegment should return a valid segment for twoPropsFunc var bc');
        const varBcOriginalSource = tracer.sources[tracedVarBcSegment[1]];
        const varBcOriginalLine = tracedVarBcSegment[2] + 1;
        const varBcOriginalColumn = tracedVarBcSegment[3];
        console.log(`[twoPropsFunc Test - Var 'bc'] TSX L${tsxVarBcLocation.line}C${tsxVarBcLocation.column} (target: 'bc') maps to Svelte (${varBcOriginalSource}) L${varBcOriginalLine}C${varBcOriginalColumn}`);
        if (varBcOriginalLine > 0 && varBcOriginalLine <= svelteLines.length) {
            console.log(`[twoPropsFunc Test - Var 'bc'] Mapped Svelte Line Content: "${svelteLines[varBcOriginalLine - 1].trim()}"`);
        }
        const bcDefColumnForVar = abDefLineContent.indexOf('bc: number'); // bc is on the same line as ab definition
        console.log(`[twoPropsFunc Test - Var 'bc'] Expected Svelte L${abDefLineNumber}C${bcDefColumnForVar} (for definition of 'bc' in "${abDefLineContent.trim()}")`);
        assert.strictEqual(varBcOriginalSource, 'endVariable.svelte', 'Incorrect source file for twoPropsFunc var bc');
        assert.strictEqual(varBcOriginalLine, abDefLineNumber, 'Incorrect line for twoPropsFunc var bc mapping');
        assert.strictEqual(varBcOriginalColumn, bcDefColumnForVar, 'Incorrect column for twoPropsFunc var bc mapping');
    });
});
