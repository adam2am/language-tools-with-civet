# Civet Sourcemap Refactoring Strategy

## Overview
We're moving to a strategy where `preprocessCivet` will generate a sourcemap from the dedented Civet snippet to its compiled TypeScript snippet. This "rawer" map will then be fed into a modified `chainSourceMaps` function that handles a more complex two-step trace.

## Refactoring Steps

### 1. [] Refactor `civetMapToV3.ts`
### 1. [x] Refactor `civetMapToV3.ts`
- [ ] Rename `normalizeCivetMap` to `convertRawCivetMapToSvelteContextFormat`
- [ ] This function will take the raw map from `civet.compile()` (mapping dedented Civet snippet → TS snippet)
- [ ] Reformat it into a `StandardRawSourceMap`
- [ ] Original line/column numbers in mappings will remain relative to the dedented Civet snippet
- [ ] The `sources` and `sourcesContent` fields will refer to the main Svelte file

### 2. [] Update `civetPreprocessor.ts`
### 2. [x] Update `civetPreprocessor.ts`
- [ ] Call the new `convertRawCivetMapToSvelteContextFormat`
- [ ] Augment `CivetBlockInfo` structure to include:
  - [ ] `originalCivetSnippetWithIndents`
  - [ ] `commonIndentRemoved`
  - [ ] `originalSnippetStartOffsetInSvelte` (which is `tag.content.start`)

### 3. [x] Modify `index.ts`
- [x] Update calls to `chainSourceMaps` to pass new data from `CivetBlockInfo`:
  - [x] `originalFullSvelteContent`
  - [x] `originalSnippetStartOffsetInSvelte`
  - [x] `commonIndentRemoved`
  - [x] `originalCivetSnippetWithIndents`
  - [x] `svelteWithTsContent`

### 4. [x] Overhaul `civetMapChainer.ts` (`chainSourceMaps` function)
- [x] Change signature to accept additional parameters from `index.ts`
- [x] Add helper function `getOffsetForLineAndColumn` to determine character offsets within `svelteWithTsContent`
- [x] For each segment from the baseMap (Svelte → svelteWithTs):
  - [x] Determine if segment's original position falls within the compiled TypeScript block from Civet
  - [x] If it does:
    1. [x] Calculate position relative to start of compiled TS snippet
    2. [x] Use `traceSegment` with `civetMapFromDedent` to find corresponding position in dedented Civet snippet
    3. [x] Adjust for `commonIndentRemoved` and use `computeCharOffsetInSnippet` to find character offset in original Civet snippet
    4. [x] Add `originalSnippetStartOffsetInSvelte` to get absolute character offset in original Svelte file
    5. [x] Convert absolute offset to line/column using `getLineAndColumnForOffset`
  - [x] If not in Civet-originated TS block, use mapping from baseMap directly

### 5. [x] Adjust `POC.test.ts`
- [x] Update assertions to reflect that the map produced by `preprocessCivet` now maps from generated TS snippet back to dedented Civet snippet
- [x] Ensure `sources` still point to the Svelte file name

## Implementation Notes
- [ ] Ensure verbose logging is active throughout to trace data flow and transformations
- [ ] This approach enables proper two-step tracing: svelteWithTs → compiled TS snippet → dedented Civet snippet → original Svelte file

## Next Steps

### 6. Restore `normalizeCivetMap` alias and update MapToV3 tests
- [ ] In `civetMapToV3.ts`, add a one-line re-export: `export { convertRawCivetMapToSvelteContextFormat as normalizeCivetMap }`
- [ ] Update `1 - mapToV3.test.ts` to import `normalizeCivetMap` or switch to the new name

### 7. Fine‐tune `chainSourceMaps` offset math
- [ ] Audit 1-based vs 0-based line/column conversions in `getLineAndColumnForOffset`
- [ ] Remove or adjust `finalLine1 - 1` so that the `originalContentStartLine` is correctly added exactly once
- [ ] Add unit tests for `chainSourceMaps` covering edge cases: first and last snippet lines, empty segments

### 8. Enhance Integration Test Visibility
- [ ] Expose a debug flag or environment variable to control `[chainSourceMaps]` logging in `test/test.ts`
- [ ] Add selective `console.debug` statements inside `4 - integration.test.ts` to print token lookup steps

### 9. Prototype TSX‐based remapping fallback
- [ ] Experiment with feeding the raw Civet map as a pre‐map into the MagicString generator in `index.ts`
- [ ] Compare final mapping accuracy against the two-step chaining approach

## Previous Strategies and Attempts

1. **Line offset adjustment** (Initial approach)
   - Tried adding a fixed line offset based on indent removal.
   - Tests showed mappings off by one line; insufficient for dual-script mapping.

2. **Character offset calculation and refactoring** (Current approach)
   - Using `commonIndentRemoved`, `originalSnippetStartOffsetInSvelte`, and char-based offsets.
   - Refactored map to leverage two-step trace with `trace-mapping`.
   - Not fully integrated yet

3. **TSX remapping fallback** (If current approach fails)
   - Remap through the TSX pipeline by generating a diff map on TSX output.
   - Leverage existing `svelte2tsx` base map to adjust Civet segment positions.
   - Consider bypassing custom chaining and piggyback on TSX map for better alignment.