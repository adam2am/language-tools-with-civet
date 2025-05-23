import type { RawSourceMap } from 'source-map';

/**
 * Result of a Civet snippet compilation to TypeScript.
 */
export interface CivetCompileResult {
    /** The generated TypeScript code */
    code: string;
    /** The raw V3 sourcemap from the Civet compiler */
    rawMap: RawSourceMap;
}

/**
 * Information about a processed Civet script block.
 */
export interface CivetBlockInfo {
    /** The normalized sourcemap: Original Svelte (Civet part) -> TS snippet */
    map: RawSourceMap;
    /** Start offset of the compiled TS code within the preprocessed svelte string (svelteWithTs) */
    tsStartInSvelteWithTs: number;
    /** End offset of the compiled TS code within the preprocessed svelte string (svelteWithTs) */
    tsEndInSvelteWithTs: number;
    /** 1-based line number in the original Svelte file where the Civet content started */
    originalContentStartLine: number;
}

/**
 * Metadata and code returned from preprocessing a Svelte file containing Civet scripts.
 */
export interface PreprocessResult {
    /** The Svelte code with Civet snippets replaced by TS code */
    code: string;
    /** Module-script block data, if present */
    module?: CivetBlockInfo;
    /** Instance-script block data, if present */
    instance?: CivetBlockInfo;
} 