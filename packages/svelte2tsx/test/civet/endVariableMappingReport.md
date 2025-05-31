 # endVariable.svelte Mapping Report

## User-reported issues - Clarified

The user is describing the behavior of their IDE's hover/language service, which is influenced by the sourcemaps. The issue isn't necessarily that the sourcemap *literally* maps token X to an unrelated token Y, but rather that hovering a specific character (`*` or `;`) causes the IDE to display hover information for a different, though related, variable definition. This suggests a potential off-by-one or slight misregistration in the sourcemap, leading the IDE to associate the hover target with an adjacent or nearby symbol's definition.

1.  **`propFunc := (b: number) => number = number * b;`** (Original problematic case)
    *   **Action:** User hovers over the semicolon `;` in the generated TSX (corresponding to the Svelte code `number = number * b;`).
    *   **Observed IDE Behavior:** The IDE displays hover information for the *parameter* `b: number` (defined on the previous line in Svelte).
    *   **User Concern:** This is unexpected. Hovering `;` should ideally not bring up information for `b`, or if it does due to proximity, it should be clearly an issue with the single-character variable `b` handling.

2.  **`twoPropsFunc := (ab: number, bc: number) => number = ab * bc`** (Original problematic case, note: no semicolon at the end of the expression line in the original fixture `endVariable.svelte` for this problematic case)
    *   **Action:** User hovers over the asterisk `*` in the generated TSX (corresponding to `number = ab * bc`).
    *   **Observed IDE Behavior:** The IDE displays hover information for the *parameter* `ab: number`.
    *   **User Concern:** This is unexpected. Hovering `*` should not bring up information for `ab`. The user also mentioned difficulty in getting hover information for the text `ab` itself in this scenario.

### Contrasting Good Behavior (from new fixture additions `propFuncAllGood` and `twoPropsFuncAllGood`):

*   **`propFuncAllGood := (bc: number) => number = number * bc;`**
    *   When the variable is multi-character (e.g., `bc`) and the line ends with a semicolon, hovering the text `bc` correctly shows information for the parameter `bc: number`.
    *   This suggests that variable length and/or the presence of a semicolon can lead to correct behavior.

*   **`twoPropsFuncAllGood := (ab: number, bc: number) => number = ab * bc;`** (Note: semicolon added)
    *   The user reports that adding a semicolon at the end of the expression (`number = ab * bc;`) fixes the issues for `twoPropsFunc`. Hovering `ab` presumably now correctly shows `ab: number` info, and `bc` shows `bc: number` info, and `*` no longer shows `ab` info.

### Hypothesized Core Problem:

The issues seem to stem from a slight imprecision in the sourcemaps, particularly affecting:
*   Single-character variables (like `b` in `propFunc`).
*   Expressions *not* explicitly terminated by a semicolon (like the original `twoPropsFunc`).

This imprecision might cause the language service, when trying to find the symbol at the hovered character (`*` or `;`), to incorrectly select an adjacent variable's definition due to the mapped region being slightly shifted or too broad.
The presence of a semicolon appears to provide a clearer boundary, improving mapping accuracy or the IDE's interpretation.

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
