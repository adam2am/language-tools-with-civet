 # endVariable.svelte Mapping Report

## User-reported issues

- In
    ```
    propFunc := (b: number) =>
        number = number * b;
    ```
    hovering on parameter `;` in TSX currently maps to `b` in the original Svelte file (end of previous line).
- In
    ```
	twoPropsFunc := (ab: number, bc: number) =>
		number = ab * bc
    ```
    hovering on `*` parameter in TSX currently maps to `ab` in the original Svelte file (in the script).

## Pipeline overview

1. **Entry point**: `src/svelte2tsx/index.ts`
   - Detects `<script lang="civet">` tags and calls `preprocessCivet`.
   - Generates base TSX code and sourcemap.
   - Chains Civet-generated maps via `chainMaps`.

2. **Preprocessor**: `utils/civetPreprocessor.ts`
   - Parses Svelte components, extracts and dedents Civet snippets.
   - Compiles Civet snippets to TS and obtains raw sourcemaps.
   - Normalizes raw maps via `normalizeCivetMap`.
   - Inserts compiled TS back into Svelte with adjusted indent and records block offsets.

3. **Normalization**: `utils/civetMapToV3.ts`
   - Converts `CivetLinesSourceMap` to a standard V3 `RawSourceMap` using `@jridgewell/gen-mapping`.

4. **Chaining**: `utils/civetMapChainer.ts`
   - Takes the base Svelte→TSX map and multiple Civet block maps.
   - Uses `trace-mapping` to trace mappings through Civet blocks.
   - Applies line and column offsets for both script and template segments.

## Potential inspiration from Unplugin

- `Civet-sourcemap/source/unplugin/unplugin.civet` and
  `dist/unplugin/unplugin.js` /
  `dist/unplugin/vite.js` implement similar source map chaining.
- They use `@jridgewell/sourcemap-codec` and `@jridgewell/trace-mapping`.
- Reviewing their handling of offsets and segments may help address current mapping issues.

## Learnings from `Civet-sourcemap/source/unplugin/unplugin.civet`

Reviewing the `unplugin.civet` code (which provides Civet support for bundlers like Vite, esbuild, etc.) offers several insights into how they handle sourcemaps, which could be relevant for our `svelte2tsx` pipeline:

1.  **Direct `SourceMap` Object Usage & Chaining by `civet.generate`:**
    *   The unplugin often works directly with Civet's `SourceMap` object, instantiated from the raw Civet source (`new SourceMap(rawCivetSource)`).
    *   When generating JavaScript or TypeScript from the Civet AST, this `SourceMap` object is passed as an option to `civet.generate({ ..., sourceMap: civetSourceMap })`.
    *   This suggests that `civet.generate` itself is capable of taking an input sourcemap (e.g., Civet-to-Civet original lines) and updating/chaining it to reflect the subsequent transformation (e.g., Civet-to-TS or Civet-to-JS).
    *   In contrast, our `svelte2tsx` pipeline converts the Civet-generated map to a standard V3 `RawSourceMap` relatively early via `civetMapToV3.ts`.

2.  **Two-Stage Compilation for JS via TS & Reliance on Subsequent Tools:**
    *   When the unplugin targets JavaScript via an intermediate TypeScript step (using `ts: "esbuild"` or `ts: "tsc"`), it first compiles Civet to TS (obtaining a Civet-to-TS map).
    *   Then, this generated TypeScript (and its map) is passed to `esbuild` or `tsc` for the TS-to-JS compilation. The unplugin appears to rely on these subsequent tools to perform the final sourcemap generation and potentially chain the initial Civet-to-TS map.
    *   Our `svelte2tsx` pipeline, however, manually chains the Civet-to-TS map with our base Svelte-to-TSX map using `@jridgewell/trace-mapping` within `civetMapChainer.ts`.

3.  **`remapRange` for Diagnostics:**
    *   For mapping TypeScript diagnostic locations back to the original Civet code, the unplugin uses a `remapRange` function from `@danielx/civet/ts-diagnostic`.
    *   This function takes the diagnostic range (in the intermediate TypeScript) and `sourcemapLines` (apparently a property of Civet's `SourceMap` object) to find the original Civet location.
    *   While we use `traceSegment` from `@jridgewell/trace-mapping`, understanding `remapRange` might offer insights if `traceSegment` struggles with the specific structure or granularity of Civet-generated maps.

4.  **Handling of Offsets and Map Details:**
    *   The unplugin is careful about filenames and relative paths when finalizing sourcemaps.
    *   The way it generates maps on-the-fly for type checking (`.civet.tsx` virtual files) and passes them to the TypeScript compiler host is also noteworthy.

### Potential Implications for `svelte2tsx` Debugging:

*   **Focus on `civetMapChainer.ts`:** The consistent line-shift errors in our tests point to potential issues in how `civetMapChainer.ts` calculates or applies offsets (e.g., `originalLineOffset`, `compiledLineOffset`) when merging the Civet-to-TS map with the Svelte-to-TSX map.
*   **Review `civetPreprocessor.ts` and `civetMapToV3.ts`:** Errors in initial offset calculation (`removedIndentLength`, `originalContentStartLine`) or in the normalization process from Civet's native map to V3 `RawSourceMap` could also be the root cause.
*   **Consider Civet's `SourceMap` Object:** If precision is being lost in the early conversion to V3 `RawSourceMap`, exploring whether our chaining logic could operate on Civet's `SourceMap` object for longer might be beneficial, though this would be a more significant change.

The primary difference remains that `svelte2tsx` must produce the complete end-to-end sourcemap itself, unlike the unplugin which can delegate parts of the process to other tools in a build chain. The unplugin's approach highlights the importance of correctly handling offsets at each stage of transformation, especially when dealing with multi-stage compilations like Civet within Svelte components.
