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
import { preprocessCivet } from './utils/civetPreprocessor';

function processSvelteTemplate(
    str: MagicString,
    svelteParseFn: typeof import('svelte/compiler').parse,
    options: { emitOnTemplateError?: boolean; namespace?: string; accessors?: boolean; mode?: 'ts' | 'dts'; typingsNamespace?: string; svelte5Plus: boolean; filename?: string; }
): TemplateProcessResult {
    const parseHtmlxOptions: { filename?: string; svelte5Plus: boolean } = { filename: options.filename, svelte5Plus: options.svelte5Plus };
    const { htmlxAst, tags } = parseHtmlx(str.original, svelteParseFn, parseHtmlxOptions);
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
    const svelteFilePath = options.filename || 'unknown.svelte';
    const svelteParseFn = options.parse || parse;

    // --- Call Civet Preprocessor --- 
    const { code: svelteContentForProcessing, module: civetModuleInfo, instance: civetInstanceInfo } = preprocessCivet(svelte, svelteFilePath);

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
        filename: svelteFilePath
    });

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

    if (options.mode === 'dts') {
        if (options.noSvelteComponentTyped) str.prepend('import { SvelteComponent } from "svelte"\n\n');
        else str.prepend('import { SvelteComponentTyped } from "svelte"\n\n');
        let code = str.toString();
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
        
        let mapToReturn: EncodedSourceMap = {
            version: finalMapFromMagicString.version,
            sources: finalMapFromMagicString.sources,
            names: finalMapFromMagicString.names,
            mappings: finalMapFromMagicString.mappings,
            file: finalMapFromMagicString.file || undefined,
            sourcesContent: finalMapFromMagicString.sourcesContent ? finalMapFromMagicString.sourcesContent.map(sc => sc === null ? undefined : sc) : undefined
        };

        const generatedCodeWithMarkers = str.toString();
        let generatedCodeClean = generatedCodeWithMarkers;
        const finalCodeToReturn = generatedCodeClean;

        if (civetModuleInfo && moduleScriptTag) {
            try {
                const chainedModuleMap = chainSourceMaps(
                    mapToReturn,
                    civetModuleInfo.map,
                    civetModuleInfo.tsStartInSvelteWithTs,
                    civetModuleInfo.tsEndInSvelteWithTs,
                    moduleScriptTag.content.start,
                    svelteContentForProcessing,
                    finalCodeToReturn,
                    civetModuleInfo.originalContentStartLine
                );
                mapToReturn = chainedModuleMap;
            } catch (e: any) { console.error('Module Civet sourcemap chaining error (New Path):', e.message, e.stack); }
        }

        if (civetInstanceInfo && scriptTag) {
            try {
                const chainedInstanceMap = chainSourceMaps(
                    mapToReturn,
                    civetInstanceInfo.map,
                    civetInstanceInfo.tsStartInSvelteWithTs,
                    civetInstanceInfo.tsEndInSvelteWithTs,
                    scriptTag.content.start,
                    svelteContentForProcessing,
                    finalCodeToReturn,
                    civetInstanceInfo.originalContentStartLine
                );
                mapToReturn = chainedInstanceMap;
            } catch (e: any) { console.error('Instance Civet sourcemap chaining error (New Path):', e.message, e.stack); }
        }

        if (mapToReturn.sources && mapToReturn.sourcesContent) {
            const svelteFileIndex = mapToReturn.sources.indexOf(svelteFilePath);
            if (svelteFileIndex !== -1) {
                mapToReturn.sourcesContent[svelteFileIndex] = svelte;
            }
        }

        return { code: finalCodeToReturn, map: mapToReturn, exportedNames: exportedNames.getExportsMap(), events: events.createAPI(), htmlAst };
    }
}
