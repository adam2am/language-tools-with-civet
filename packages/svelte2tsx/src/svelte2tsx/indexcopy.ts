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
import { createRequire } from 'module';

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

    const str = new MagicString(svelte);
    const basename = path.basename(options.filename || '');
    const svelte5Plus = Number(options.version![0]) > 4;
    const isTsFile = options?.isTsFile;

    // Dynamically require Civet compiler (lazy load to avoid static dependency)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const require = createRequire(import.meta.url);
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
        const langAttr = getAttributeValue(moduleScriptTag.attributes, 'lang');
        if (langAttr === 'civet') {
            console.log('svelte2tsx: Civet module script detected via lang="' + langAttr + '"');
            const start = moduleScriptTag.content.start;
            const end = moduleScriptTag.content.end;
            const civetContent = svelte.slice(start, end);
            const compiler = getCivetCompiler();
            const { code: compiledTs } = compiler.compile(civetContent, {
                filename: options.filename,
                sync: true,
                sourceMap: true,
                inlineMap: false,
                js: false
            });
            str.addSourcemapLocation(start);
            str.overwrite(start, end, compiledTs);
            str.addSourcemapLocation(start + compiledTs.length);
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
            console.log('svelte2tsx: Civet instance script detected via lang="' + langAttr + '"');
            const start = scriptTag.content.start;
            const end = scriptTag.content.end;
            const civetContent = svelte.slice(start, end);
            const compiler = getCivetCompiler();
            const { code: compiledTs } = compiler.compile(civetContent, {
                filename: options.filename,
                sync: true,
                sourceMap: true,
                inlineMap: false,
                js: false
            });
            str.addSourcemapLocation(start);
            str.overwrite(start, end, compiledTs);
            str.addSourcemapLocation(start + compiledTs.length);
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
        return {
            code: str.toString(),
            map: str.generateMap({ hires: true, file: options.filename, source: options.filename, includeContent: true }),
            exportedNames: exportedNames.getExportsMap(),
            events: events.createAPI(),
            htmlAst
        };
    }
}
