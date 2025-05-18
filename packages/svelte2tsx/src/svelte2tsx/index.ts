import MagicString from 'magic-string';
import { convertHtmlxToJsx, TemplateProcessResult } from '../htmlxtojsx_v2';
import { parseHtmlx } from '../utils/htmlxparser';
import { chainSourceMaps, EncodedSourceMap } from '../utils/sourcemap-chaining';
import { addComponentExport } from './addComponentExport';
import { createRenderFunction } from './createRenderFunction';
import { ExportedNames } from './nodes/ExportedNames';
import { Generics } from './nodes/Generics';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { processInstanceScriptContent } from './processInstanceScriptContent';
import { createModuleAst, ModuleAst, processModuleScriptTag } from './processModuleScriptTag';
import path from 'path';
import { parse, VERSION } from 'svelte/compiler';
import { getTopLevelImports } from './utils/tsAst';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Helper to get line/column for an offset (1-based line, 0-based column)
function getLineAndColumnForOffset(str: string, offset: number): { line: number; column: number } {
    if (offset < 0) return { line: 1, column: 0 };
    if (offset > str.length) offset = str.length;

    // >>>>> START MEGA DEBUG FOR OFFSET 621 (INSTANCE SCRIPT / char on L23)
    if (offset === 621) {
        console.log(`[GLCO_DEBUG_621] ENTERING for offset 621. str.length: ${str.length}`);
        try {
            // Log a snippet around the offset to see context and newlines
            const snippetStart = Math.max(0, offset - 20);
            const snippetEnd = Math.min(str.length, offset + 20);
            const snippet = str.substring(snippetStart, snippetEnd);
            console.log(`[GLCO_DEBUG_621] Snippet around 621 (chars ${snippetStart}-${snippetEnd}): '${snippet.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`);
        } catch (e: any) {
            console.log(`[GLCO_DEBUG_621] Error getting snippet: ${e.message}`);
        }
    }
    // <<<<< END MEGA DEBUG

    let line = 1;
    let lastNewlineOffset = -1;
    for (let i = 0; i < offset; i++) {
        if (str[i] === '\n') {
            line++;
            lastNewlineOffset = i;
            // >>>>> START MEGA DEBUG FOR OFFSET 621
            if (offset === 621) {
                console.log(`[GLCO_DEBUG_621] Found '\n' at i=${i}. New line count: ${line}. lastNewlineOffset: ${lastNewlineOffset}`);
            }
            // <<<<< END MEGA DEBUG
        }
    }
    const column = offset - (lastNewlineOffset + 1);

    // >>>>> START MEGA DEBUG FOR OFFSET 621
    if (offset === 621) {
        console.log(`[GLCO_DEBUG_621] FINAL. offset: ${offset}, calculated line: ${line}, calculated column: ${column}, lastNewlineOffset: ${lastNewlineOffset}`);
    }
    // <<<<< END MEGA DEBUG

    return { line, column };
}

function getActualContentStartLine(svelteContent: string, contentOffset: number): number {
    let currentOffset = contentOffset;
    // Iterate past leading whitespace, but not newlines if they are the first thing.
    // The goal is to find the line of the first non-whitespace character.
    // If contentOffset itself points to a non-whitespace char, its line is used.
    // If contentOffset points to whitespace, skip until non-whitespace or end of string.
    while (currentOffset < svelteContent.length && svelteContent[currentOffset] !== '\n' && /^\s$/.test(svelteContent[currentOffset])) {
        currentOffset++;
    }
    // If after skipping horizontal whitespace we land on a newline, and the original offset was not a newline,
    // it means the actual content starts on the next line.
    // However, getLineAndColumnForOffset(svelteContent, currentOffset) will give the line of currentOffset itself.
    // The original getLineAndColumnForOffset logic is fine. The key is to pass the offset
    // of the first *meaningful* character.

    // Simpler: advance currentOffset past initial whitespace (including newlines if they are first)
    // This was the bug: it should find the first *non-whitespace* character.
    let searchOffset = contentOffset;
    while (searchOffset < svelteContent.length && /^\s$/.test(svelteContent[searchOffset])) {
        searchOffset++;
    }
    // If we went off the end, use the original offset (or last char offset) for line calculation
    if (searchOffset >= svelteContent.length) {
        searchOffset = Math.max(0, svelteContent.length - 1);
    }
    
    const resultLine = getLineAndColumnForOffset(svelteContent, searchOffset).line;
    // Temporary debug for instance script line calculation
    if (contentOffset > 500 && contentOffset < 1000) { // Crude check for instance script content offset range for test file
        try {
            const charAtContentOffset = svelteContent.charAt(contentOffset);
            const charAtSearchOffset = svelteContent.charAt(searchOffset);
            console.log(`[getActualContentStartLine_DEBUG] For instance script? contentOffset: ${contentOffset} (char: '${charAtContentOffset.replace("\n", "\\n")}') -> searchOffset: ${searchOffset} (char: '${charAtSearchOffset.replace("\n", "\\n")}') -> resultLine: ${resultLine}`);
        } catch (e) { /* ignore error if charAt fails for some reason */ }
    }
    return resultLine;
}

let civetCompiler: any = null;
function getCivetCompiler() {
    if (civetCompiler) return civetCompiler;
    try {
        civetCompiler = require('@danielx/civet');
        return civetCompiler;
    } catch (e: any) {
        if (e.code === 'MODULE_NOT_FOUND' && e.message?.includes('@danielx/civet')) {
            throw new Error('svelte2tsx: Civet compiler not found. Please install "@danielx/civet".');
        }
        throw e;
    }
}

function getAttributeValue(attributes: any[], attributeName: string): string | undefined {
    if (!attributes || !Array.isArray(attributes)) return undefined;
    const attr = attributes.find(a => a.type === 'Attribute' && a.name === attributeName);
    if (attr && Array.isArray(attr.value) && attr.value.length > 0) {
        const valueNode = attr.value[0];
        if (valueNode.type === 'Text') return valueNode.data || valueNode.raw;
    }
    return undefined;
}

function processSvelteTemplate(
    str: MagicString,
    svelteParseFn: typeof import('svelte/compiler').parse,
    options: { emitOnTemplateError?: boolean; namespace?: string; accessors?: boolean; mode?: 'ts' | 'dts'; typingsNamespace?: string; svelte5Plus: boolean; filename?: string; }
): TemplateProcessResult {
    const parseHtmlxOptions: { filename?: string; svelte5Plus: boolean } = { filename: options.filename, svelte5Plus: options.svelte5Plus };
    const { htmlxAst, tags } = parseHtmlx(str.original, svelteParseFn, parseHtmlxOptions);
    return convertHtmlxToJsx(str, htmlxAst, tags, options);
}

const INSTANCE_SCRIPT_MARKER_START = `/*<!@#%^INSTANCE_SCRIPT_START%^#@!>*/`;
const MODULE_SCRIPT_MARKER_START = `/*<!@#%^MODULE_SCRIPT_START%^#@!>*/`;

export function svelte2tsx(
    svelte: string,
    options: {
        parse?: typeof import('svelte/compiler').parse;
        version?: string;
        filename?: string;
        isTsFile?: boolean;
        emitOnTemplateError?: boolean;
        namespace?: string;
        mode?: 'ts' | 'dts';
        accessors?: boolean;
        typingsNamespace?: string;
        noSvelteComponentTyped?: boolean;
    } = { parse }
) {
    let civetModuleMapJson: any = null;
    let civetInstanceMapJson: any = null;
    
    let moduleCivetContentStartLineInOriginalSvelte: number | undefined = undefined;
    let instanceCivetContentStartLineInOriginalSvelte: number | undefined = undefined;

    let moduleScriptWasCivet = false;
    let instanceScriptWasCivet = false;

    options.mode = options.mode || 'ts';
    options.version = options.version || VERSION;
    const svelteFilePath = options.filename || 'unknown.svelte';
    const svelteParseFn = options.parse || parse;
    const svelte5PlusForPreliminaryParse = Number(options.version![0]) > 4;

    // --- Locate Civet scripts in the original Svelte content ---
    let preliminaryModuleScriptTag: any = null;
    let preliminaryInstanceScriptTag: any = null;
    try {
        const parseHtmlxOptionsInitial: { filename?: string; svelte5Plus: boolean } = { filename: svelteFilePath, svelte5Plus: svelte5PlusForPreliminaryParse };
        const { tags: initialTags } = parseHtmlx(svelte, svelteParseFn, parseHtmlxOptionsInitial) as any;
        
        preliminaryModuleScriptTag = (initialTags as any[]).find(tag => 
            tag.type === 'Script' && 
            getAttributeValue(tag.attributes, 'lang') === 'civet' && 
            getAttributeValue(tag.attributes, 'context') === 'module'
        );
        preliminaryInstanceScriptTag = (initialTags as any[]).find(tag => 
            tag.type === 'Script' && 
            getAttributeValue(tag.attributes, 'lang') === 'civet' && 
            getAttributeValue(tag.attributes, 'context') !== 'module'
        );

        if (preliminaryModuleScriptTag) {
            moduleCivetContentStartLineInOriginalSvelte = getActualContentStartLine(svelte, preliminaryModuleScriptTag.content.start);
            console.log(`[svelte2tsx/index.ts] Prelim: Found Civet module script. Original content start line: ${moduleCivetContentStartLineInOriginalSvelte}`);
        }
        if (preliminaryInstanceScriptTag) {
            instanceCivetContentStartLineInOriginalSvelte = getActualContentStartLine(svelte, preliminaryInstanceScriptTag.content.start);
            console.log(`[svelte2tsx/index.ts] Prelim: Found Civet instance script. Original content start line: ${instanceCivetContentStartLineInOriginalSvelte}`);
        }

    } catch (e: any) {
        console.warn('[svelte2tsx/index.ts] Initial parsing for Civet tags failed:', e.message);
    }

    let svelteContentForProcessing = svelte;

    // --- Stage A/B Module Script Preparation ---
    try {
        if (preliminaryModuleScriptTag) {
            const modTag = preliminaryModuleScriptTag; 
            const langAttr = getAttributeValue(modTag.attributes, 'lang');
            if (langAttr === 'civet') {
                console.log('[svelte2tsx/index.ts] Stage A/B: Civet module script detected for pre-processing.');
                moduleScriptWasCivet = true;
                const civet = getCivetCompiler();
                const civetContent = svelte.slice(modTag.content.start, modTag.content.end);
                const civetResult = civet.compile(civetContent, {
                    filename: svelteFilePath, sync: true, sourceMap: true, inlineMap: false, js: false
                });
                const compiledCivetTs = civetResult.code;
                if (civetResult.sourceMap) {
                    civetModuleMapJson = civetResult.sourceMap.json();
                    if (civetModuleMapJson && civetModuleMapJson.sources && Array.isArray(civetModuleMapJson.sources) && civetModuleMapJson.sources.length === 1 &&
                        (civetModuleMapJson.sources[0] === null || civetModuleMapJson.sources[0] === undefined) &&
                        civetModuleMapJson.sourcesContent && Array.isArray(civetModuleMapJson.sourcesContent) && civetModuleMapJson.sourcesContent.length === 1) {
                        civetModuleMapJson.sources[0] = svelteFilePath;
                        console.log(`[svelte2tsx/index.ts] Stage A: Patched civetModuleMapJson.sources[0] for module to '${svelteFilePath}'.`);
                    }
                }
                const tempMsMod = new MagicString(svelteContentForProcessing);
                tempMsMod.overwrite(modTag.content.start, modTag.content.end, compiledCivetTs);
                svelteContentForProcessing = tempMsMod.toString();
                console.log('[svelte2tsx/index.ts] Stage B: Module script Civet->TS placed in svelteContentForProcessing.');
            }
        }
    } catch (e: any) {
        console.warn('[svelte2tsx/index.ts] Module Civet pre-processing failed:', e.message);
    }

    // --- Stage A/B Instance Script Preparation ---
    try {
        // Use preliminaryInstanceScriptTag found earlier from original 'svelte' string to know IF an instance script exists.
        // IMPORTANT: Offsets in preliminaryInstanceScriptTag are for the *original* svelte string.
        // If module script processing modified svelteContentForProcessing, these offsets are invalid for it.
        // We need to re-find the instance script in the *current* svelteContentForProcessing to get current offsets.
        if (preliminaryInstanceScriptTag) { // Check if an instance Civet script was found in the original svelte string
            const parseHtmlxOptionsInstCurrent: { filename?: string; svelte5Plus: boolean } = { filename: svelteFilePath, svelte5Plus: svelte5PlusForPreliminaryParse };
            const { tags: currentInstanceTags } = parseHtmlx(svelteContentForProcessing, svelteParseFn, parseHtmlxOptionsInstCurrent) as any;
            const instTagCurrent = (currentInstanceTags as any[]).find(tag => // This is the tag in current svelteContentForProcessing
                tag.type === 'Script' &&
                getAttributeValue(tag.attributes, 'lang') === 'civet' &&
                getAttributeValue(tag.attributes, 'context') !== 'module'
            );

            if (instTagCurrent) {
                const instTag = instTagCurrent; // Use this for slicing and overwriting svelteContentForProcessing
                const langAttr = getAttributeValue(instTag.attributes, 'lang');
                if (langAttr === 'civet') {
                    console.log('[svelte2tsx/index.ts] Stage A/B: Civet instance script detected for pre-processing.');
                    instanceScriptWasCivet = true;
                    const civet = getCivetCompiler();
                    const civetContent = svelteContentForProcessing.slice(instTag.content.start, instTag.content.end);
                    const civetResult = civet.compile(civetContent, {
                        filename: svelteFilePath, sync: true, sourceMap: true, inlineMap: false, js: false
                    });
                    const compiledCivetTs = civetResult.code;

                    // --- START MICROTEST DEBUG LOGGING ---
                    if (svelteFilePath.includes("test-minimal-civet-instance.svelte")) {
                        console.log('[MICROTEST_DEBUG] === Civet Instance Script Compilation Details ===');
                        console.log('[MICROTEST_DEBUG] Svelte File Path:', svelteFilePath);
                        console.log('[MICROTEST_DEBUG] --- Input Civet Content ---');
                        console.log(civetContent);
                        console.log('[MICROTEST_DEBUG] --- Output Compiled TS ---');
                        console.log(compiledCivetTs);
                        console.log('[MICROTEST_DEBUG] --- Civet SourceMap JSON ---');
                    }
                    // --- END MICROTEST DEBUG LOGGING ---

                    if (civetResult.sourceMap) {
                        civetInstanceMapJson = civetResult.sourceMap.json();
                        // --- START MICROTEST DEBUG LOGGING ---
                        if (svelteFilePath.includes("test-minimal-civet-instance.svelte")) {
                             console.log(JSON.stringify(civetInstanceMapJson, null, 2));
                             console.log('[MICROTEST_DEBUG] === End Civet Instance Script Compilation Details ===');
                        }
                        // --- END MICROTEST DEBUG LOGGING ---
                         if (civetInstanceMapJson && civetInstanceMapJson.sources && Array.isArray(civetInstanceMapJson.sources) && civetInstanceMapJson.sources.length === 1 &&
                            (civetInstanceMapJson.sources[0] === null || civetInstanceMapJson.sources[0] === undefined) &&
                            civetInstanceMapJson.sourcesContent && Array.isArray(civetInstanceMapJson.sourcesContent) && civetInstanceMapJson.sourcesContent.length === 1) {
                            civetInstanceMapJson.sources[0] = svelteFilePath;
                            console.log(`[svelte2tsx/index.ts] Stage A: Patched civetInstanceMapJson.sources[0] for instance to '${svelteFilePath}'.`);
                        }
                    }
                    const tempMsInst = new MagicString(svelteContentForProcessing);
                    tempMsInst.overwrite(instTag.content.start, instTag.content.end, compiledCivetTs);
                    svelteContentForProcessing = tempMsInst.toString();
                    console.log('[svelte2tsx/index.ts] Stage B: Instance script Civet->TS placed in svelteContentForProcessing.');
                }
            }
        }
    } catch (e: any) {
        console.warn('[svelte2tsx/index.ts] Instance Civet pre-processing failed:', e.message);
    }

    const str = new MagicString(svelteContentForProcessing);
    const basename = path.basename(options.filename || '');
    const svelte5Plus = Number(options.version![0]) > 4;
    const isTsFile = options?.isTsFile;

    let {
        htmlAst, moduleScriptTag, scriptTag, rootSnippets, slots, uses$$props,
        uses$$slots, uses$$restProps, events, componentDocumentation, resolvedStores,
        usesAccessors, isRunes
    } = processSvelteTemplate(str, svelteParseFn, { 
        emitOnTemplateError: options.emitOnTemplateError,
        namespace: options.namespace,
        accessors: options.accessors,
        mode: options.mode,
        typingsNamespace: options.typingsNamespace,
        svelte5Plus,
        filename: svelteFilePath // Pass filename here too
    });

    console.log(`[svelte2tsx/index.ts] AFTER processSvelteTemplate: moduleScriptTag is ${moduleScriptTag ? 'defined' : 'NOT defined'}, scriptTag is ${scriptTag ? 'defined' : 'NOT defined'}`);
    if (scriptTag) {
        console.log(`[svelte2tsx/index.ts] AFTER processSvelteTemplate: scriptTag.content.start=${scriptTag.content.start}, scriptTag.content.end=${scriptTag.content.end}`);
    }

    let instanceScriptTarget = 0;
    let moduleAst: ModuleAst | undefined;

    if (moduleScriptTag) {
        moduleAst = createModuleAst(str, moduleScriptTag);
        if (moduleScriptTag.start !== 0) str.move(moduleScriptTag.start, moduleScriptTag.end, 0);
        else instanceScriptTarget = moduleScriptTag.end;
    }

    const renderFunctionStart = scriptTag ? str.original.lastIndexOf('>', scriptTag.content.start) + 1 : instanceScriptTarget;
    const implicitStoreValues = new ImplicitStoreValues(resolvedStores, renderFunctionStart);
    let exportedNames = new ExportedNames(str, 0, basename, isTsFile, svelte5Plus, isRunes);
    let generics = new Generics(str, 0, { attributes: [] } as any);
    let uses$$SlotsInterface = false;

    if (scriptTag) {
        if (scriptTag.start !== instanceScriptTarget) str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        const res = processInstanceScriptContent(
            str, scriptTag, events, implicitStoreValues, options.mode, 
            moduleAst, isTsFile, basename, svelte5Plus, isRunes
        );
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
        uses$$slots = uses$$slots || res.uses$$slots;
        ({ exportedNames, events, generics, uses$$SlotsInterface } = res);
    }

    exportedNames.usesAccessors = usesAccessors;
    if (svelte5Plus) exportedNames.checkGlobalsForRunes(implicitStoreValues.getGlobals());

    createRenderFunction({ str, scriptTag, scriptDestination: instanceScriptTarget, slots, events, exportedNames, uses$$props, uses$$restProps, uses$$slots, uses$$SlotsInterface, generics, svelte5Plus, isTsFile, mode: options.mode });

    if (moduleScriptTag && moduleAst) { // Ensure moduleAst exists
        processModuleScriptTag(str, moduleScriptTag, new ImplicitStoreValues(implicitStoreValues.getAccessedStores(), renderFunctionStart, scriptTag || options.mode === 'ts' ? undefined : (input: string) => `</>;${input}<>`), moduleAst);
        if (!scriptTag) moduleAst.tsAst.forEachChild((node) => exportedNames.hoistableInterfaces.analyzeModuleScriptNode(node));
    }

    if ((moduleScriptTag || scriptTag) && rootSnippets.length > 0) {
        let snippetHoistTargetForModule = 0;
        if (scriptTag) snippetHoistTargetForModule = scriptTag.start + 1;
        else if (moduleAst) {
                const imports = getTopLevelImports(moduleAst.tsAst);
                const lastImport = imports[imports.length - 1];
            snippetHoistTargetForModule = lastImport ? lastImport.end + moduleAst.astOffset : moduleAst.astOffset;
            if (str.original.length > 0 || snippetHoistTargetForModule > 0) { // Avoid prepending to empty string at 0 if no content
                str.appendLeft(snippetHoistTargetForModule, '\n');
            }
        }
        for (const [start, end, globals] of rootSnippets) {
            const hoist_to_module = moduleScriptTag && moduleAst && (globals.size === 0 || [...globals.keys()].every((id) => exportedNames.hoistableInterfaces.isAllowedReference(id)));
            if (hoist_to_module) str.move(start, end, snippetHoistTargetForModule);
            else if (scriptTag) str.move(start, end, renderFunctionStart);
        }
    }

    addComponentExport({ str, canHaveAnyProp: !exportedNames.uses$$Props && (uses$$props || uses$$restProps), events, isTsFile, exportedNames, usesAccessors, usesSlots: slots.size > 0, fileName: svelteFilePath, componentDocumentation, mode: options.mode, generics, isSvelte5: svelte5Plus, noSvelteComponentTyped: options.noSvelteComponentTyped });

    let markedModuleScriptActual = false; 
    let markedInstanceScriptActual = false;

    if (moduleScriptWasCivet && moduleScriptTag) {
        str.prependLeft(moduleScriptTag.content.start, MODULE_SCRIPT_MARKER_START);
        markedModuleScriptActual = true;
        console.log('[svelte2tsx/index.ts] Module script marker prepended (Stage B).');
    }
    if (instanceScriptWasCivet && scriptTag) { 
        str.prependLeft(scriptTag.content.start, INSTANCE_SCRIPT_MARKER_START);
        markedInstanceScriptActual = true;
        console.log('[svelte2tsx/index.ts] Instance script marker prepended (Stage B).');
    }

    if (options.mode === 'dts') {
        if (options.noSvelteComponentTyped) str.prepend('import { SvelteComponent } from "svelte"\n\n');
        else str.prepend('import { SvelteComponentTyped } from "svelte"\n\n');
        let code = str.toString();
        if (markedModuleScriptActual) code = code.replace(MODULE_SCRIPT_MARKER_START, '');
        if (markedInstanceScriptActual) code = code.replace(INSTANCE_SCRIPT_MARKER_START, '');
        code = code.replace(/<\/><\/>;/g, '').replace(/<>.*<\/>/s, '').replace('\n() => ();', ''); // Adjusted regex for empty tags
        return { code };
    } else {
        str.prepend('///<reference types="svelte" />\n');
        const finalMapFromMagicString = str.generateMap({
            hires: true,
            file: svelteFilePath,
            source: svelteFilePath,
            includeContent: true
        });
        
        // Ensure finalMap conforms to EncodedSourceMap for consistent typing of mapToReturn
        let mapToReturn: EncodedSourceMap = {
            version: finalMapFromMagicString.version,
            sources: finalMapFromMagicString.sources,
            names: finalMapFromMagicString.names,
            mappings: finalMapFromMagicString.mappings,
            file: finalMapFromMagicString.file || undefined,
            sourcesContent: finalMapFromMagicString.sourcesContent ? finalMapFromMagicString.sourcesContent.map(sc => sc === null ? undefined : sc) : undefined
        };
        const originalContentForChaining = svelteContentForProcessing; // Re-declare originalContentForChaining

        const generatedCodeWithMarkers = str.toString();
        let generatedCodeClean = generatedCodeWithMarkers;
        let moduleTsCodeStartInClean = -1, instanceTsCodeStartInClean = -1;

        const rawModuleMarkerIndex = markedModuleScriptActual ? generatedCodeWithMarkers.indexOf(MODULE_SCRIPT_MARKER_START) : -1;
        const rawInstanceMarkerIndex = markedInstanceScriptActual ? generatedCodeWithMarkers.indexOf(INSTANCE_SCRIPT_MARKER_START) : -1;
        
        if (rawModuleMarkerIndex !== -1) {
            generatedCodeClean = generatedCodeClean.replace(MODULE_SCRIPT_MARKER_START, '');
            moduleTsCodeStartInClean = rawModuleMarkerIndex;
            if (rawInstanceMarkerIndex !== -1 && rawInstanceMarkerIndex > rawModuleMarkerIndex) {
                instanceTsCodeStartInClean = rawInstanceMarkerIndex - MODULE_SCRIPT_MARKER_START.length;
            } else {
                instanceTsCodeStartInClean = rawInstanceMarkerIndex;
            }
        } else {
            instanceTsCodeStartInClean = rawInstanceMarkerIndex;
        }
        if (rawInstanceMarkerIndex !== -1 && generatedCodeClean.includes(INSTANCE_SCRIPT_MARKER_START)) {
            generatedCodeClean = generatedCodeClean.replace(INSTANCE_SCRIPT_MARKER_START, '');
        }
        const finalCodeToReturn = generatedCodeClean;

        if (civetModuleMapJson && moduleScriptWasCivet && moduleScriptTag && moduleTsCodeStartInClean !== -1) {
            console.log('[svelte2tsx/index.ts] Attempting to chain Module Civet map (Stage B path).');
            console.log(`[svelte2tsx/index.ts] BEFORE calling chainSourceMaps for module: moduleCivetContentStartLineInOriginalSvelte = ${moduleCivetContentStartLineInOriginalSvelte}`);
            try {
                const chainedModuleMap = chainSourceMaps(mapToReturn, civetModuleMapJson as any, moduleScriptTag.content.start, moduleScriptTag.content.end, moduleTsCodeStartInClean, originalContentForChaining, generatedCodeClean, moduleCivetContentStartLineInOriginalSvelte);
                mapToReturn = chainedModuleMap;
                console.log("[svelte2tsx/index.ts] Module script Civet map successfully chained.");
            } catch (e: any) { console.error('Module Civet sourcemap chaining error:', e.message, e.stack); }
        }

        // Chain instance script map if it was Civet (Stage B)
        const instChainCheck1 = `>>> DEBUG_S2TSX_INST_CHECK_A: civetInstanceMapJson: ${!!civetInstanceMapJson}`;
        const instChainCheck2 = `>>> DEBUG_S2TSX_INST_CHECK_B: instanceScriptWasCivet: ${instanceScriptWasCivet}`;
        const instChainCheck3 = `>>> DEBUG_S2TSX_INST_CHECK_C: scriptTag: ${!!scriptTag}`;
        const instChainCheck4 = `>>> DEBUG_S2TSX_INST_CHECK_D: instanceTsCodeStartInClean: ${instanceTsCodeStartInClean !== -1}`;
        console.log(instChainCheck1);
        console.log(instChainCheck2);
        console.log(instChainCheck3);
        console.log(instChainCheck4);

        if (civetInstanceMapJson && instanceScriptWasCivet && scriptTag && instanceTsCodeStartInClean !== -1) {
            console.log('>>> DEBUG_S2TSX_INST_CHAIN_BLOCK_ENTERED');
            console.log('[svelte2tsx/index.ts] Attempting to chain Instance Civet map (Stage B path).');
            console.log(`[svelte2tsx/index.ts] BEFORE calling chainSourceMaps for instance: instanceCivetContentStartLineInOriginalSvelte = ${instanceCivetContentStartLineInOriginalSvelte}`);
            try {
                const chainedInstanceMap = chainSourceMaps(mapToReturn, civetInstanceMapJson as any, scriptTag.content.start, scriptTag.content.end, instanceTsCodeStartInClean, originalContentForChaining, generatedCodeClean, instanceCivetContentStartLineInOriginalSvelte);
                mapToReturn = chainedInstanceMap;
                console.log("[svelte2tsx/index.ts] Instance script Civet map successfully chained.");
            } catch (e: any) { console.error('Instance Civet sourcemap chaining error:', e.message, e.stack); }
        }

        // Ensure the sourcesContent for the svelte file is the original svelte input
        if (mapToReturn.sources && mapToReturn.sourcesContent) {
            const svelteFileIndex = mapToReturn.sources.indexOf(svelteFilePath);
            if (svelteFileIndex !== -1) {
                mapToReturn.sourcesContent[svelteFileIndex] = svelte; // Use the original svelte string
                console.log(`[svelte2tsx/index.ts] Final map sourcesContent for ${svelteFilePath} set to original Svelte input.`);
            }
        }

        return { code: finalCodeToReturn, map: mapToReturn, exportedNames: exportedNames.getExportsMap(), events: events.createAPI(), htmlAst };
    }
}
