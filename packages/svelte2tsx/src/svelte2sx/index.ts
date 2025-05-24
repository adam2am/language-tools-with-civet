// --- Civet Preprocessor (only if civet blocks are present) --- 
let svelteContentForProcessing = svelte;
let civetModuleInfo: any, civetInstanceInfo: any;
if (svelte.includes('lang="civet"')) {
    const _civet = preprocessCivet(svelte, svelteFilePath);
    svelteContentForProcessing = _civet.code;
    civetModuleInfo = _civet.module;
    civetInstanceInfo = _civet.instance;
} 