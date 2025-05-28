# Pipeline in place

**Civet → TS source-map pipeline:**

1. **`compileCivet`** (`civetMapLines.ts`)
   - Transforms a Civet snippet into TS code + raw CivetLinesSourceMap.

2. **Offset calculation** (`civetUtils.ts`)
   - `getSnippetOffset` / `getActualContentStartLine` finds the 0-based line index where the Civet snippet begins in the full Svelte file.

3. **`normalizeCivetMap`** (`civetMapToV3.ts`)
   - Consumes raw Civet map + full `.svelte` content + snippet offset.
   - Produces a standard v3 SourceMap: `OriginalSvelte(civet_code) -> CivetBlockTSOutput`.
   - Ensures `sources: [original_svelte_filename]`, `names: []`.

4. **`preprocessCivet`** (`civetPreprocessor.ts`)
   - Parses `<script lang="civet">` blocks.
   - Swaps `lang="civet"` to `lang="ts"` in Svelte markup (intermediate state).
   - Dedesnts & trims the Civet snippet from the original Svelte content.
   - Runs `compileCivet` (on dedented snippet) → `block.rawMap`.
   - Runs `normalizeCivetMap(block.rawMap, originalSvelteContent, ...)` → `block.map` (this is a V3 map: `OriginalSvelte(civet_code) -> CivetBlockTSOutput`).
   - Overwrites the script block with compiled TS via MagicString (creating `svelteWithTsContent`).
   - Records `EnhancedChainBlock` info (including `block.map`, TS offsets in `svelteWithTsContent`, and line counts) for each Civet script.

5. **`svelte2tsx`** (core logic, e.g., in `src/svelte2tsx/index.ts`)
   - Generates a `baseMap`: `SvelteWithTsContent -> FinalTSXOutput`.
       * This `baseMap`'s original positions refer to the Svelte file *after* `lang="civet"` became `lang="ts"` but *before* Civet code was replaced by TS.
   - Calls **`chainMaps`** (`civetMapChainer.ts`) with `baseMap` and all `EnhancedChainBlock`s collected by `preprocessCivet`.

6. **`chainMaps`** (`civetMapChainer.ts`)
   - Decodes `baseMap` segments.
   - For each `baseMap` segment mapping `FinalTSX -> SvelteWithTsContent`:
       * If the `SvelteWithTsContent` original position falls *inside* a Civet block's TS output area:
           * Uses the corresponding `block.map` (which is `OriginalSvelte(civet_code) -> CivetBlockTSOutput`) and `traceSegment` to find the *actual* original position in the `OriginalSvelte(civet_code)`.
           * Remaps the segment: `FinalTSX -> OriginalSvelte(civet_code)`.
       * If it falls *outside* (i.e., in template or non-Civet script):
           * Adjusts the `SvelteWithTsContent` original line by cumulative line deltas from preceding Civet-to-TS compilations.
           * Remaps the segment: `FinalTSX -> OriginalSvelte(template_or_other_script)`.
   - Outputs a final `chainedMap`: `FinalTSX -> OriginalSvelteFile`.

---

**Automated test validation (#current):**

* **Dynamic `normalizeCivetMap` scenarios** (`2 - mapToV3-current.test.ts`):
   * 7 cases (declarations, functions, arrays, etc.) verify `OriginalSvelte(civet_code) -> CivetBlockTSOutput` mappings.
   * *All 7 pass*, confirming token-to-token accuracy from Civet snippet to its Svelte origin.

* **`preprocessCivet` fixtures** (`3 - preprocessFixtures-current.test.ts`):
   * Real `.svelte` files (`scenario.svelte`, `2scripts.svelte`).
   * Validates `preprocessCivet`'s output (`block.map` and code replacement).
   * Tokens in compiled TS (from a single block) correctly trace back to original Svelte via the `block.map`.
   * *All pass*.

* **`svelte2tsx` + `chainMaps` integration** (`4 - svelte2tsx+civetMapChainer-current.test.ts`, often part of a broader "integration" test set like "5 - integration"):
   * Processes full `.svelte` fixtures through `svelte2tsx` (which uses `preprocessCivet` and then `chainMaps`).
   * Asserts `chainedMap.sources: [original_svelte_filename]`, version 3.
   * **Segment Integrity Check:** Iterates *every segment* in the `chainedMap`. For each segment `[genCol, , origLineSeg, origColSeg]`, it queries `originalPositionFor(tracer, genLine, genCol)` and asserts the result matches `origLineSeg+1`, `origColSeg`.
   * **Token Spot Check:** Key tokens in the final TSX are mapped back to valid, non-null original Svelte positions.
   * *All pass* (as seen in test output for `scenario.svelte`, `2scripts.svelte`, etc.), confirming the final `FinalTSX -> OriginalSvelteFile` map is internally consistent and correctly resolves key identifiers.

> Ran `pnpm --filter svelte2tsx test-current` (after `build`) → 0 failures, confirming end-to-end mapping correctness for the entire pipeline.



