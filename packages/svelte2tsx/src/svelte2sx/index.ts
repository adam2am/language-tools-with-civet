// --- Civet Preprocessor (only if civet blocks are present) --- 
let svelteContentForProcessing = svelte;
let civetModuleInfo: any, civetInstanceInfo: any;
if (svelte.includes('lang="civet"')) {
    const _civet = preprocessCivet(svelte, svelteFilePath);
    svelteContentForProcessing = _civet.code;
    civetModuleInfo = _civet.module;
    civetInstanceInfo = _civet.instance;
} 

import { getTopLevelImports } from './utils/tsAst';
import { preprocessCivet } from './utils/civetPreprocessor';
import { chainSourceMaps } from '../svelte2tsx/utils/civetMapChainer';

export function svelte2tsx(
    options: any
) {
    options.mode = options.mode || 'ts';
    options.version = options.version || VERSION;

    // Run the Civet preprocessor if `<script lang="civet">` blocks exist
    const filename = options.filename!;
    const { code: svelteWithTs, module: civetModuleInfo, instance: civetInstanceInfo } = preprocessCivet(svelte, filename);

    const str = new MagicString(svelteWithTs);

    if (options.mode === 'dts') {
        // ... existing dts branch ...
    } else {
        str.prepend('///<reference types="svelte" />\n');
        // Generate the base Svelte→TSX map
        const baseMap = str.generateMap({ hires: true, source: options?.filename });
        // Chain in Civet maps only if they exist
        let finalMap = baseMap;
        if (civetModuleInfo) {
            finalMap = chainSourceMaps(
                finalMap,
                civetModuleInfo.map,
                civetModuleInfo.tsStartInSvelteWithTs,
                civetModuleInfo.tsEndInSvelteWithTs
            );
        }
        if (civetInstanceInfo) {
            finalMap = chainSourceMaps(
                finalMap,
                civetInstanceInfo.map,
                civetInstanceInfo.tsStartInSvelteWithTs,
                civetInstanceInfo.tsEndInSvelteWithTs
            );
        }
        return {
            code: str.toString(),
            map: finalMap,
            exportedNames: exportedNames.getExportsMap(),
            events: events.createAPI(),
            // not part of the public API so people don't start using it
            htmlAst
        };
    }
} 