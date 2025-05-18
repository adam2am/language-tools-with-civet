import MagicString from 'magic-string';
import { convertHtmlxToJsx, TemplateProcessResult } from '../htmlxtojsx_v2';
import { parseHtmlx } from '../utils/htmlxparser';
import { chainSourceMaps } from '../utils/sourcemap-chaining';
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

let civetCompiler: any = null;
function getCivetCompiler() {
    if (civetCompiler) {
        return civetCompiler;
    }
    try {
        civetCompiler = require('@danielx/civet');
        return civetCompiler;
    } catch (e) {
        // Make sure it's a module not found error for @danielx/civet
        if (typeof e === 'object' && e !== null && (e as any).code === 'MODULE_NOT_FOUND' && (e as any).message?.includes('@danielx/civet')) {
            throw new Error(
                'svelte2tsx: Civet compiler not found. Please install "@danielx/civet" to use <script lang="civet">. ' +
                'Run `npm install --save-dev @danielx/civet` or `yarn add --dev @danielx/civet`.'
            );
        }
        throw e; // Re-throw other errors
    }
}

// Helper function to extract attribute value from Svelte AST attribute array
function getAttributeValue(attributes: any[], attributeName: string): string | undefined {
    if (!attributes || !Array.isArray(attributes)) {
        return undefined;
    }
    const attr = attributes.find(a => a.type === 'Attribute' && a.name === attributeName);
    if (attr && Array.isArray(attr.value) && attr.value.length > 0) {
        // Svelte AST attribute values are an array of nodes. For simple string values,
        // it's usually a single Text node.
        const valueNode = attr.value[0];
        if (valueNode.type === 'Text') {
            return valueNode.data || valueNode.raw; // 'data' is common, 'raw' as fallback
        }
    } else if (attr && attr.value === true && typeof attr.name === 'string') {
        // Handle boolean attributes if necessary, though 'lang' typically isn't.
        // For this specific use case, we're looking for a string value.
    }
    return undefined;
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

// Define unique markers
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
    let markedInstanceScript = false;
    let markedModuleScript = false;
    let moduleScriptWasCivet = false; // Flag to indicate if module script was originally Civet
    let instanceScriptWasCivet = false; // Flag to indicate if instance script was originally Civet

    options.mode = options.mode || 'ts';
    options.version = options.version || VERSION;

    const str = new MagicString(svelte);
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
    let earlyProcessedModuleScript = false; // Flag to indicate early processing for Civet

    if (moduleScriptTag) {
        const langAttr = getAttributeValue(moduleScriptTag.attributes, 'lang');
        if (langAttr === 'civet') {
            console.log('[svelte2tsx/index.ts] Civet module script detected. Performing early compilation.');
            moduleScriptWasCivet = true; // Mark as originally Civet
            const civet = getCivetCompiler();
            const svelteFilePath = options.filename || 'unknown.svelte';

            const civetContent = str.original.slice(moduleScriptTag.content.start, moduleScriptTag.content.end);
            const civetResult = civet.compile(civetContent, {
                filename: svelteFilePath, // For Civet sourcemap to reference original svelte file
                sync: true,
                sourceMap: true,
                inlineMap: false,
                js: false // We want TS output
            });
            let compiledCivetTs = civetResult.code;
            if (civetResult.sourceMap) {
                civetModuleMapJson = civetResult.sourceMap.json();
                if (
                    civetModuleMapJson &&
                    civetModuleMapJson.sources &&
                    Array.isArray(civetModuleMapJson.sources) &&
                    civetModuleMapJson.sources.length === 1 &&
                    (civetModuleMapJson.sources[0] === null || civetModuleMapJson.sources[0] === undefined) &&
                    civetModuleMapJson.sourcesContent &&
                    Array.isArray(civetModuleMapJson.sourcesContent) &&
                    civetModuleMapJson.sourcesContent.length === 1
                ) {
                    civetModuleMapJson.sources[0] = svelteFilePath; 
                }
            }
            // IMPORTANT: Overwrite original Civet with compiled TS. Marker will be added later.
            str.remove(moduleScriptTag.content.start, moduleScriptTag.content.end);
            str.appendLeft(moduleScriptTag.content.start, compiledCivetTs);
            console.log('[svelte2tsx/index.ts] Civet module script content removed and then TS appended (experimenting for granularity).');
            // DO NOT set markedModuleScript or prepend marker here yet
            earlyProcessedModuleScript = true; 
        }

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

        const langAttr = getAttributeValue(scriptTag.attributes, 'lang');
        if (langAttr === 'civet') {
            console.log('[svelte2tsx/index.ts] Civet instance script detected. Performing early compilation.');
            instanceScriptWasCivet = true; // Mark as originally Civet
            const civet = getCivetCompiler();
            const svelteFilePath = options.filename || 'unknown.svelte';

            // Content slice must be from the *original* string, before module script overwrite might change indices
            const originalCivetContentInst = svelte.slice(scriptTag.content.start, scriptTag.content.end);

            const civetResultInst = civet.compile(originalCivetContentInst, {
                filename: svelteFilePath, // For Civet sourcemap
                sync: true,
                sourceMap: true,
                inlineMap: false,
                js: false // We want TS output
            });
            let compiledCivetTsInst = civetResultInst.code;
            if (civetResultInst.sourceMap) {
                civetInstanceMapJson = civetResultInst.sourceMap.json();
                if (
                    civetInstanceMapJson &&
                    civetInstanceMapJson.sources &&
                    Array.isArray(civetInstanceMapJson.sources) &&
                    civetInstanceMapJson.sources.length === 1 &&
                    (civetInstanceMapJson.sources[0] === null || civetInstanceMapJson.sources[0] === undefined) &&
                    civetInstanceMapJson.sourcesContent && 
                    Array.isArray(civetInstanceMapJson.sourcesContent) &&
                    civetInstanceMapJson.sourcesContent.length === 1
                ) {
                    civetInstanceMapJson.sources[0] = svelteFilePath;
                }
            }
            // IMPORTANT: Overwrite original Civet with compiled TS. Marker will be added later.
            str.remove(scriptTag.content.start, scriptTag.content.end);
            str.appendLeft(scriptTag.content.start, compiledCivetTsInst);
            console.log('[svelte2tsx/index.ts] Civet instance script content removed and then TS appended (experimenting for granularity).');
            // DO NOT set markedInstanceScript or prepend marker here yet
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
        // If Civet module script was processed and overwritten early, its content is now TS.
        // The processModuleScriptTag function expects to find the original script content via moduleScriptTag offsets
        // if it were to re-parse or re-analyze. However, createModuleAst already ran on the (potentially modified by overwrite) str.
        // The main purpose of processModuleScriptTag is to handle $store syntax and hoist variables.
        // If the content is now TS, $store syntax transformation might not be applicable or work as intended if it relies on Svelte-specific parsing.
        // For now, let's assume createModuleAst and subsequent operations in processModuleScriptTag are compatible with the TS content.
        if (earlyProcessedModuleScript) {
            console.log('[svelte2tsx/index.ts] Skipping parts of processModuleScriptTag for early-processed Civet module script, or ensuring it runs on TS.');
            // Potentially, processModuleScriptTag might need adjustments if it re-slices based on moduleScriptTag for original content.
            // However, moduleAst was created *after* the overwrite for Civet, so its AST is of the TS code.
        }

        processModuleScriptTag(
            str,
            moduleScriptTag, // Still pass original tag for positions, but content in str is TS
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

    // After all script content modifications by processInstanceScriptContent and processModuleScriptTag
    // Prepend markers if the scripts were originally Civet

    if (moduleScriptWasCivet && moduleScriptTag) {
        str.prependLeft(moduleScriptTag.content.start, MODULE_SCRIPT_MARKER_START);
        markedModuleScript = true;
        console.log('[svelte2tsx/index.ts] Module script marker prepended AFTER all processing.');
    }

    if (instanceScriptWasCivet && scriptTag) {
        str.prependLeft(scriptTag.content.start, INSTANCE_SCRIPT_MARKER_START);
        markedInstanceScript = true;
        console.log('[svelte2tsx/index.ts] Instance script marker prepended AFTER all processing.');
    }

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
        if (markedInstanceScript) code = code.replace(INSTANCE_SCRIPT_MARKER_START, '');
        if (markedModuleScript) code = code.replace(MODULE_SCRIPT_MARKER_START, '');
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
        let finalMap = str.generateMap({ hires: true, source: options?.filename });
        
        const generatedCodeWithMarkers = str.toString();
        let generatedCodeClean = generatedCodeWithMarkers;
        let finalCodeToReturn = generatedCodeClean;

        let instanceTsCodeStartInClean = -1;
        let moduleTsCodeStartInClean = -1;

        // Order of removal and index adjustment matters if both markers are present.
        // Find indices in the string *with* markers first.
        const rawInstanceMarkerIndex = markedInstanceScript ? generatedCodeWithMarkers.indexOf(INSTANCE_SCRIPT_MARKER_START) : -1;
        const rawModuleMarkerIndex = markedModuleScript ? generatedCodeWithMarkers.indexOf(MODULE_SCRIPT_MARKER_START) : -1;

        if (rawInstanceMarkerIndex !== -1) {
            generatedCodeClean = generatedCodeClean.replace(INSTANCE_SCRIPT_MARKER_START, '');
            instanceTsCodeStartInClean = rawInstanceMarkerIndex;
            // If module marker was after instance marker, its index in the clean string will be shifted.
            if (rawModuleMarkerIndex !== -1 && rawModuleMarkerIndex > rawInstanceMarkerIndex) {
                moduleTsCodeStartInClean = rawModuleMarkerIndex - INSTANCE_SCRIPT_MARKER_START.length;
            } else {
                moduleTsCodeStartInClean = rawModuleMarkerIndex; // Stays same or is -1
            }
        } else {
            // Instance marker not found, module marker index is its raw index.
            moduleTsCodeStartInClean = rawModuleMarkerIndex;
        }
        
        // If instance marker wasn't found or module marker was first, and module marker is present.
        if (rawInstanceMarkerIndex === -1 && rawModuleMarkerIndex !== -1) { 
             generatedCodeClean = generatedCodeClean.replace(MODULE_SCRIPT_MARKER_START, '');
             // instanceTsCodeStartInClean remains -1
        } else if (rawModuleMarkerIndex !== -1 && rawInstanceMarkerIndex !== -1 && rawModuleMarkerIndex < rawInstanceMarkerIndex) {
            // Module marker was first and instance marker was second
            generatedCodeClean = generatedCodeClean.replace(MODULE_SCRIPT_MARKER_START, ''); // Already removed if instance was first and module second
            // instanceTsCodeStartInClean needs adjustment because module marker was removed before it
            instanceTsCodeStartInClean = rawInstanceMarkerIndex - MODULE_SCRIPT_MARKER_START.length;
            // moduleTsCodeStartInClean was already set correctly relative to raw
        }
        // If only instance marker was found and removed, generatedCodeClean is already updated, moduleTsCodeStartInClean is -1 or its raw index.
        // If both were found and instance was first, generatedCodeClean had instance marker removed, then moduleTsCodeStartInClean was adjusted.
        //    Now, ensure module marker is also removed from generatedCodeClean if it hasn't been (e.g. if it was the second marker to be removed conceptually).
        if (markedModuleScript && generatedCodeClean.includes(MODULE_SCRIPT_MARKER_START)) { // Ensure it's removed if it was present
            generatedCodeClean = generatedCodeClean.replace(MODULE_SCRIPT_MARKER_START, '');
        }

        finalCodeToReturn = generatedCodeClean;

        if (!markedInstanceScript && rawInstanceMarkerIndex !== -1) console.warn("Svelte2tsx: Instance script marker found but not markedInstanceScript?");
        if (!markedModuleScript && rawModuleMarkerIndex !== -1) console.warn("Svelte2tsx: Module script marker found but not markedModuleScript?");

        // ---- START DIAGNOSTIC LOGS FOR CHAINING CONDITIONS ----
        console.log('[svelte2tsx/index.ts DEBUG CHAIN_COND] About to check chaining conditions.');
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] civetInstanceMapJson: ${!!civetInstanceMapJson}`);
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] scriptTag: ${!!scriptTag}`);
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] markedInstanceScript: ${markedInstanceScript}`);
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] instanceTsCodeStartInClean: ${instanceTsCodeStartInClean}`);
        
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] civetModuleMapJson: ${!!civetModuleMapJson}`);
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] moduleScriptTag: ${!!moduleScriptTag}`);
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] markedModuleScript: ${markedModuleScript}`);
        console.log(`[svelte2tsx/index.ts DEBUG CHAIN_COND] moduleTsCodeStartInClean: ${moduleTsCodeStartInClean}`);
        // ---- END DIAGNOSTIC LOGS FOR CHAINING CONDITIONS ----

        if (civetModuleMapJson || civetInstanceMapJson) {
            try {
                if (civetInstanceMapJson && scriptTag && markedInstanceScript && instanceTsCodeStartInClean !== -1) {
                    const chainedMap = chainSourceMaps(
                        finalMap as any,
                        civetInstanceMapJson as any,
                        scriptTag.content.start,
                        scriptTag.content.end,
                        instanceTsCodeStartInClean,
                        svelte,
                        generatedCodeClean
                    );
                    console.log("[svelte2tsx/index.ts] Instance script chained map successfully.");
                    return { code: finalCodeToReturn, map: chainedMap, exportedNames: exportedNames.getExportsMap(), events: events.createAPI(), htmlAst };
                }

                if (civetModuleMapJson && moduleScriptTag && markedModuleScript && moduleTsCodeStartInClean !== -1 && !(civetInstanceMapJson && scriptTag && markedInstanceScript && instanceTsCodeStartInClean !== -1) ) {
                    const chainedMap = chainSourceMaps(
                        finalMap as any,
                        civetModuleMapJson as any,
                        moduleScriptTag.content.start,
                        moduleScriptTag.content.end,
                        moduleTsCodeStartInClean,
                        svelte,
                        generatedCodeClean
                    );
                    console.log("[svelte2tsx/index.ts] Module script chained map successfully.");
                    return { code: finalCodeToReturn, map: chainedMap, exportedNames: exportedNames.getExportsMap(), events: events.createAPI(), htmlAst };
                }
                console.log ('[svelte2tsx/index.ts] Civet map(s) present, but not chained due to marker issues or conditions not met. Returning original MagicString map.'); // Clarified log message
            } catch (e: any) {
                console.error('svelte2tsx: Error during Civet sourcemap chaining attempt:', e.message, e.stack);
            }
        }

        return {
            code: finalCodeToReturn,
            map: finalMap,
            exportedNames: exportedNames.getExportsMap(),
            events: events.createAPI(),
            htmlAst
        };
    }
}