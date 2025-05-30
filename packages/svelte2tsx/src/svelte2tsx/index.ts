import MagicString from 'magic-string';
import { convertHtmlxToJsx, TemplateProcessResult } from '../htmlxtojsx_v2';
import { parseHtmlx } from '../utils/htmlxparser';
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
import { preprocessCivet } from './utils/civetPreprocessor';
import { chainMaps, EnhancedChainBlock } from './utils/civetMapChainer';
import type { EncodedSourceMap } from './utils/civetMapChainer';
import { getLineAndColumnForOffset } from './utils/civetUtils';
import { decode } from '@jridgewell/sourcemap-codec';

const svelte2tsxDebug = false;

const logOptions = {
    preprocessCivetOutput: true,
    baseMapMappingsHead: true,
    moduleChainingOffsets: true,
    instanceChainingOffsets: true,
    finalMapMappingsHead: true,
}

function processSvelteTemplate(
    str: MagicString,
    parse: typeof import('svelte/compiler').parse,
    options: {
        emitOnTemplateError?: boolean;
        namespace?: string;
        accessors?: boolean;
        mode?: 'ts' | 'dts';
        typingsNamespace?: string;
        svelte5Plus: boolean;
    }
): TemplateProcessResult {
    const { htmlxAst, tags } = parseHtmlx(str.original, parse, options);
    return convertHtmlxToJsx(str, htmlxAst, tags, options);
}

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
    options.mode = options.mode || 'ts';
    options.version = options.version || VERSION;

    if (svelte2tsxDebug) console.log('[svelte2tsx-index.ts] Initial Svelte content:\n', svelte);

    const filename = options.filename!;
    let svelteWithTs = svelte;
    let civetModuleInfo = undefined;
    let civetInstanceInfo = undefined;
    // Only run preprocessCivet if a <script lang="civet"> is present
    if (/\<script[^>]*lang=["']civet["']/i.test(svelte)) {
        const civetResult = preprocessCivet(svelte, filename);
        svelteWithTs = civetResult.code;
        civetModuleInfo = civetResult.module;
        civetInstanceInfo = civetResult.instance;
        // Debug specific fixture
        if (filename.includes('twoFooUserRequest.svelte')) {
            console.log(`[S2TSX_DEBUG] After preprocessCivet for ${filename}: ts code snippet:\n${svelteWithTs}`);
            if (civetInstanceInfo && civetInstanceInfo.map && 'lines' in civetInstanceInfo.map) {
                console.log(`[S2TSX_DEBUG] Civet instance rawMap lines: ${JSON.stringify((civetInstanceInfo.map as any).lines)}`);
            }
        }
        if (svelte2tsxDebug && logOptions.preprocessCivetOutput) console.log(`[S2TSX_INDEX ${filename}] preprocessCivet output: moduleInfo=${JSON.stringify(civetModuleInfo)}, instanceInfo=${JSON.stringify(civetInstanceInfo)}`);
        console.log(`[S2TSX_INDEX ${filename}] svelteWithTs after preprocessCivet:\n${svelteWithTs}`);
        if (civetModuleInfo) console.log(`[S2TSX_INDEX ${filename}] Civet Module Info MAP (first 3 lines mappings): ${civetModuleInfo.map.mappings.split(';').slice(0,3).join(';')}`);
        if (civetInstanceInfo) console.log(`[S2TSX_INDEX ${filename}] Civet Instance Info MAP (first 3 lines mappings): ${civetInstanceInfo.map.mappings.split(';').slice(0,3).join(';')}`);
    }

    if (svelte2tsxDebug) console.log('[svelte2tsx-index.ts] Svelte content after preprocessCivet (svelteWithTs):\n', svelteWithTs);

    const str = new MagicString(svelteWithTs);
    const basename = path.basename(options.filename || '');
    const svelte5Plus = Number(options.version![0]) > 4;
    const isTsFile = options?.isTsFile;

    // process the htmlx as a svelte template
    let {
        htmlAst,
        moduleScriptTag,
        scriptTag,
        rootSnippets,
        slots,
        uses$$props,
        uses$$slots,
        uses$$restProps,
        events,
        componentDocumentation,
        resolvedStores,
        usesAccessors,
        isRunes
    } = processSvelteTemplate(str, options.parse || parse, {
        ...options,
        svelte5Plus
    });

    /* Rearrange the script tags so that module is first, and instance second followed finally by the template
     * This is a bit convoluted due to some trouble I had with magic string. A simple str.move(start,end,0) for each script wasn't enough
     * since if the module script was already at 0, it wouldn't move (which is fine) but would mean the order would be swapped when the script tag tried to move to 0
     * In this case we instead have to move it to moduleScriptTag.end. We track the location for the script move in the MoveInstanceScriptTarget var
     */
    let instanceScriptTarget = 0;

    let moduleAst: ModuleAst | undefined;

    if (moduleScriptTag) {
        moduleAst = createModuleAst(str, moduleScriptTag);

        if (moduleScriptTag.start != 0) {
            //move our module tag to the top
            str.move(moduleScriptTag.start, moduleScriptTag.end, 0);
        } else {
            //since our module script was already at position 0, we need to move our instance script tag to the end of it.
            instanceScriptTarget = moduleScriptTag.end;
        }
    }

    const renderFunctionStart = scriptTag
        ? str.original.lastIndexOf('>', scriptTag.content.start) + 1
        : instanceScriptTarget;
    const implicitStoreValues = new ImplicitStoreValues(resolvedStores, renderFunctionStart);
    //move the instance script and process the content
    let exportedNames = new ExportedNames(str, 0, basename, isTsFile, svelte5Plus, isRunes);
    let generics = new Generics(str, 0, { attributes: [] } as any);
    let uses$$SlotsInterface = false;
    if (scriptTag) {
        //ensure it is between the module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        const res = processInstanceScriptContent(
            str,
            scriptTag,
            events,
            implicitStoreValues,
            options.mode,
            moduleAst,
            isTsFile,
            basename,
            svelte5Plus,
            isRunes
        );
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
        uses$$slots = uses$$slots || res.uses$$slots;

        ({ exportedNames, events, generics, uses$$SlotsInterface } = res);
    }

    exportedNames.usesAccessors = usesAccessors;
    if (svelte5Plus) {
        exportedNames.checkGlobalsForRunes(implicitStoreValues.getGlobals());
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction({
        str,
        scriptTag,
        scriptDestination: instanceScriptTarget,
        slots,
        events,
        exportedNames,
        uses$$props,
        uses$$restProps,
        uses$$slots,
        uses$$SlotsInterface,
        generics,
        svelte5Plus,
        isTsFile,
        mode: options.mode
    });

    // we need to process the module script after the instance script has moved otherwise we get warnings about moving edited items
    if (moduleScriptTag) {
        processModuleScriptTag(
            str,
            moduleScriptTag,
            new ImplicitStoreValues(
                implicitStoreValues.getAccessedStores(),
                renderFunctionStart,
                scriptTag || options.mode === 'ts' ? undefined : (input) => `</>;${input}<>`
            ),
            moduleAst
        );
        if (!scriptTag) {
            moduleAst.tsAst.forEachChild((node) =>
                exportedNames.hoistableInterfaces.analyzeModuleScriptNode(node)
            );
        }
    }

    // Hoist root snippets into module if present
    if (moduleScriptTag && rootSnippets.length > 0) {
        exportedNames.hoistableInterfaces.analyzeSnippets(rootSnippets);
    }

    if (moduleScriptTag || scriptTag) {
        let snippetHoistTargetForModule = 0;
        if (rootSnippets.length) {
            if (scriptTag) {
                snippetHoistTargetForModule = scriptTag.start + 1; // +1 because imports are also moved at that position, and we want to move interfaces after imports
            } else {
                const imports = getTopLevelImports(moduleAst.tsAst);
                const lastImport = imports[imports.length - 1];
                snippetHoistTargetForModule = lastImport
                    ? lastImport.end + moduleAst.astOffset
                    : moduleAst.astOffset;
                str.appendLeft(snippetHoistTargetForModule, '\n');
            }
        }

        for (const [start, end, globals] of rootSnippets) {
            const hoist_to_module =
                moduleScriptTag &&
                (globals.size === 0 ||
                    [...globals.keys()].every((id) =>
                        exportedNames.hoistableInterfaces.isAllowedReference(id)
                    ));

            if (hoist_to_module) {
                str.move(start, end, snippetHoistTargetForModule);
            } else if (scriptTag) {
                str.move(start, end, renderFunctionStart);
            }
        }
    }

    addComponentExport({
        str,
        canHaveAnyProp: !exportedNames.uses$$Props && (uses$$props || uses$$restProps),
        events,
        isTsFile,
        exportedNames,
        usesAccessors,
        usesSlots: slots.size > 0,
        fileName: options?.filename,
        componentDocumentation,
        mode: options.mode,
        generics,
        isSvelte5: svelte5Plus,
        noSvelteComponentTyped: options.noSvelteComponentTyped
    });

    if (options.mode === 'dts') {
        // Prepend the import which is used for TS files
        // The other shims need to be provided by the user ambient-style,
        // for example through filenames.push(require.resolve('svelte2tsx/svelte-shims.d.ts'))
        // TODO replace with SvelteComponent for Svelte 5, keep old for backwards compatibility with Svelte 3
        if (options.noSvelteComponentTyped) {
            str.prepend('import { SvelteComponent } from "svelte"\n' + '\n');
        } else {
            str.prepend('import { SvelteComponentTyped } from "svelte"\n' + '\n');
        }
        let code = str.toString();
        // Remove all tsx occurences and the template part from the output
        code = code
            // prepended before each script block
            .replace('<></>;', '')
            .replace('<></>;', '')
            // tsx in render function
            .replace(/<>.*<\/>/s, '')
            .replace('\n() => ();', '');

        return {
            code
        };
    } else {
        str.prepend('///<reference types="svelte" />\n');
        // Generate the base Svelte→TSX source map (class instance)
        const rawBaseMap = str.generateMap({ hires: true, source: options?.filename });
        // Convert to plain JSON EncodedSourceMap
        const baseMap = JSON.parse(rawBaseMap.toString()) as EncodedSourceMap;
        console.log(`[S2TSX_INDEX ${filename}] Base Svelte->TSX map (before chaining, first 3 lines mappings): ${baseMap.mappings.split(';').slice(0,3).join(';')}`);
        // Log specific segments for TSX Line 3 if it exists
        const decodedBaseMapForLog = baseMap.mappings ? decode(baseMap.mappings) : undefined;
        if (decodedBaseMapForLog && decodedBaseMapForLog.length > 2) { // TSX Line 3 is index 2
            console.log(`[S2TSX_INDEX ${filename}] BaseMap Decoded for TSX Line 3 (all segments): ${JSON.stringify(decodedBaseMapForLog[2])}`);
            // Try to find the segment for TSX L3C9 (0-indexed column 8 for 'f' in 'foo1' if generated at col 1)
            // Or, more generally, column 8 if the line starts at column 0 in TSX.
            // The test output says TSX L3C9, which is generated line index 2, generated col index 8.
            const targetGenLine_0based = 2; // TSX Line 3
            const targetGenCol_0based = 8; // TSX Col 9
            if (decodedBaseMapForLog.length > targetGenLine_0based) {
                const lineSegments = decodedBaseMapForLog[targetGenLine_0based];
                let foundSegmentForL3C9: number[] | undefined;
                for (const segment of lineSegments) {
                    if (segment[0] === targetGenCol_0based) {
                        foundSegmentForL3C9 = segment;
                        break;
                    }
                    // If no exact match, take the one immediately preceding if it's the last one before target
                    if (segment[0] < targetGenCol_0based) {
                        foundSegmentForL3C9 = segment; // Keep updating until we pass it or find exact
                    } else if (segment[0] > targetGenCol_0based && foundSegmentForL3C9) {
                        break; // We've passed the target column, use the last found segment
                    }
                }
                if (foundSegmentForL3C9) {
                    console.log(`[S2TSX_INDEX ${filename}] BaseMap specific segment for TSX L${targetGenLine_0based + 1}C${targetGenCol_0based + 1} (targeting col ${targetGenCol_0based}): maps to svelteWithTs L${foundSegmentForL3C9[2] + 1}C${foundSegmentForL3C9[3] + 1} (0-indexed: L${foundSegmentForL3C9[2]}C${foundSegmentForL3C9[3]}) Segment: ${JSON.stringify(foundSegmentForL3C9)}`);
                } else {
                    console.log(`[S2TSX_INDEX ${filename}] BaseMap: No specific segment found for TSX L${targetGenLine_0based + 1}C${targetGenCol_0based + 1} (targeting col ${targetGenCol_0based}) on line ${targetGenLine_0based + 1}.`);
                }
            }
        }
        // Debug: log head of baseMap mappings
        if (svelte2tsxDebug && logOptions.baseMapMappingsHead) console.log(`[svelte2tsx-index.ts] baseMap mappings head: ${baseMap.mappings.split(';').slice(0,3).join(';')}`);
        // Collect Civet blocks for chaining
        const civetBlocksForChaining: EnhancedChainBlock[] = [];

        if (civetModuleInfo) {
            if (svelte2tsxDebug && logOptions.moduleChainingOffsets) console.log(`[svelte2tsx-index.ts] queueing module block map at offsets ${civetModuleInfo.tsStartInSvelteWithTs}-${civetModuleInfo.tsEndInSvelteWithTs}`);
            const { line: startLine, column: startCol } = getLineAndColumnForOffset(svelteWithTs, civetModuleInfo.tsStartInSvelteWithTs);
            const { line: endLine } = getLineAndColumnForOffset(svelteWithTs, civetModuleInfo.tsEndInSvelteWithTs);
            civetBlocksForChaining.push({
                map: civetModuleInfo.map,
                tsStartCharInSvelteWithTs: civetModuleInfo.tsStartInSvelteWithTs,
                tsEndCharInSvelteWithTs: civetModuleInfo.tsEndInSvelteWithTs,
                tsStartLineInSvelteWithTs: startLine,
                tsStartColInSvelteWithTs: startCol,
                tsEndLineInSvelteWithTs: endLine,
                originalCivetLineCount: civetModuleInfo.originalCivetLineCount,
                compiledTsLineCount: civetModuleInfo.compiledTsLineCount,
                originalCivetSnippetLineOffset_0based: civetModuleInfo.originalCivetSnippetLineOffset_0based,
                removedCivetContentIndentLength: civetModuleInfo.removedCivetContentIndentLength,
                originalContentStartLine_Svelte_1based: civetModuleInfo.originalContentStartLine
            });
        }
        if (civetInstanceInfo) {
            // DETAILED LOGGING MOVED HERE
            if (filename.includes('twoFooUserRequest.svelte')) {
                const offset = civetInstanceInfo.tsStartInSvelteWithTs;
                console.log(`[S2TSX_INDEX_GETLINECOL_DEBUG ${filename}] For Civet Instance Block (twoFooUserRequest):`);
                console.log(`  civetInstanceInfo.tsStartInSvelteWithTs (offset): ${offset}`);
                console.log(`  svelteWithTs char at offset: "${svelteWithTs[offset]}"`);
                console.log(`  svelteWithTs snippet around offset: "${svelteWithTs.slice(Math.max(0, offset - 10), offset + 10)}"`);
                let lastNewline = -1;
                for (let j = 0; j < Math.min(offset, svelteWithTs.length); j++) {
                    if (svelteWithTs[j] === '\n') {
                        lastNewline = j;
                    }
                }
                console.log(`  Calculated lastNewline for offset ${offset}: ${lastNewline}`);
                console.log(`  Expected column would be: ${offset - (lastNewline + 1)}`);
            }

            if (svelte2tsxDebug && logOptions.instanceChainingOffsets) console.log(`[S2TSX_INDEX ${filename}] Civet instance block: tsStartInSvelteWithTs=${civetInstanceInfo.tsStartInSvelteWithTs}, originalContentStartLine_Svelte_1based=${civetInstanceInfo.originalContentStartLine}`);
            if (filename.includes('twoFooUserRequest.svelte')) {
                 console.log(`[S2TSX_INDEX_DYN_DEBUG_FOO1_BLOCK ${filename}] For Block to be added (twoFooUserRequest instance): tsStartLineInSvelteWithTs=${getLineAndColumnForOffset(svelteWithTs, civetInstanceInfo.tsStartInSvelteWithTs).line}, tsStartColInSvelteWithTs=${getLineAndColumnForOffset(svelteWithTs, civetInstanceInfo.tsStartInSvelteWithTs).column}, originalContentStartLine_Svelte_1based=${civetInstanceInfo.originalContentStartLine}`);
            }
            const { line: startLine, column: startCol } = getLineAndColumnForOffset(svelteWithTs, civetInstanceInfo.tsStartInSvelteWithTs);
            const { line: endLine } = getLineAndColumnForOffset(svelteWithTs, civetInstanceInfo.tsEndInSvelteWithTs);
            civetBlocksForChaining.push({
                map: civetInstanceInfo.map,
                tsStartCharInSvelteWithTs: civetInstanceInfo.tsStartInSvelteWithTs,
                tsEndCharInSvelteWithTs: civetInstanceInfo.tsEndInSvelteWithTs,
                tsStartLineInSvelteWithTs: startLine,
                tsStartColInSvelteWithTs: startCol,
                tsEndLineInSvelteWithTs: endLine,
                originalCivetLineCount: civetInstanceInfo.originalCivetLineCount,
                compiledTsLineCount: civetInstanceInfo.compiledTsLineCount,
                originalCivetSnippetLineOffset_0based: civetInstanceInfo.originalCivetSnippetLineOffset_0based,
                removedCivetContentIndentLength: civetInstanceInfo.removedCivetContentIndentLength,
                originalContentStartLine_Svelte_1based: civetInstanceInfo.originalContentStartLine
            });
        }

        // Sort blocks by start character offset, crucial for cumulative delta calculation
        civetBlocksForChaining.sort((a, b) => a.tsStartCharInSvelteWithTs - b.tsStartCharInSvelteWithTs);
        console.log(`[S2TSX_INDEX ${filename}] Civet blocks prepared for chaining (${civetBlocksForChaining.length} blocks):`);
        civetBlocksForChaining.forEach((block, i) => {
            const isTwoFooFixture = filename.includes('twoFooUserRequest.svelte');
            if (isTwoFooFixture && block.map.file?.includes('twoFooUserRequest.svelte')) { // Check block.map.file to ensure it's the instance script
                console.log(`[S2TSX_INDEX_DYN_DEBUG_FOO1_BLOCK ${filename}] For Block ${i} (twoFooUserRequest instance): tsStartLineInSvelteWithTs=${block.tsStartLineInSvelteWithTs}, tsStartColInSvelteWithTs=${block.tsStartColInSvelteWithTs}, originalContentStartLine_Svelte_1based=${block.originalContentStartLine_Svelte_1based}`);
            }
            console.log(`  [S2TSX_INDEX ${filename}] Block ${i}: tsStartChar=${block.tsStartCharInSvelteWithTs}, tsEndChar=${block.tsEndCharInSvelteWithTs}, tsStartLine=${block.tsStartLineInSvelteWithTs}, mapFile=${block.map.file}, mapSources=${JSON.stringify(block.map.sources)}, mapMappings(first 3 lines): ${block.map.mappings.split(';').slice(0,3).join(';')}`);
        });

        // Chain all blocks in one pass
        let finalMap: EncodedSourceMap = baseMap as any as EncodedSourceMap;

        if (civetBlocksForChaining.length > 0) {
            finalMap = chainMaps(baseMap, civetBlocksForChaining, svelte, str.original);
            if (svelte2tsxDebug && logOptions.finalMapMappingsHead) console.log(`[svelte2tsx-index.ts] after chaining all blocks, mappings head: ${finalMap.mappings.split(';').slice(0,3).join(';')}`);
            console.log(`[S2TSX_INDEX ${filename}] Final map after chainMaps (first 3 lines mappings): ${finalMap.mappings.split(';').slice(0,3).join(';')}`);
        }
        const finalTsxCode = str.toString();
        if (svelte2tsxDebug) console.log('[svelte2tsx-index.ts] Final generated TSX code:\n', finalTsxCode);
        console.log(`[S2TSX_INDEX ${filename}] Final generated TSX code:\n${finalTsxCode}`);
        return {
            code: finalTsxCode,
            map: finalMap,
            exportedNames: exportedNames.getExportsMap(),
            events: events.createAPI(),
            // not part of the public API so people don't start using it
            htmlAst
        };
    }
}