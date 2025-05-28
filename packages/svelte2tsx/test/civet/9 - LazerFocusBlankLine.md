# 9 - LazerFocusBlankLine: Bug Analysis Report

## 1. Executive Summary

The bug occurs when a `<script lang="civet">` block starts with a blank line (or tab+newline). This leads to an off-by-one error in the generated sourcemap: the snippet normalization or chaining logic miscalculates the original snippet’s starting line, producing an incorrect mapping for code within the script.

## 2. Bug Description and Context

**Observed:** A leading blank/tab line in a Civet script causes sourcemap offsets to shift. In `LazerFocus2-issue4.svelte`, the mapping for `problematicFoo` is off by –1 line. In contrast, `LazerFocus2-issue4-allgood.svelte` (no blank line) maps correctly.

**Expected:** Mappings should be accurate regardless of leading blank lines—`problematicFoo` should map to its actual line (offset 0).

### Steps to Reproduce

1. Create a Svelte file with:
   ```svelte
   <script lang="civet">
     	    <!-- blank/tab line -->
     foo := 1
     bar := 2
   </script>
   ```
2. Run `svelte2tsx` and generate TSX + sourcemap.
3. Locate `bar` in the TSX and trace its generated position back: the mapped line is incorrect (one line too early).

## 3. Execution Path and Key Components

1. **`src/svelte2tsx/index.ts`**
   - Entry point: calls `preprocessCivet()` for Civet scripts.
   - Builds base TSX + `baseMap` via MagicString.
   - Gathers `CivetBlockInfo` and invokes `chainMaps()`.

2. **`utils/civetPreprocessor.ts`**
   - Parses and finds `<script lang="civet">` tags.
   - Extracts snippet via `slice(start, end)`.
   - Strips leading blank lines: `snippet.replace(/^[ \t]*[\r\n]+/, '')`.
   - Removes common indent via `stripCommonIndent()`.
   - Computes `originalContentStartLine` via `getActualContentStartLine()`.
   - Compiles snippet to TS + raw map (`compileCivet()`).
   - Calls `normalizeCivetMap()` to produce a V3 map anchored to the original `.svelte` file.
   - Returns updated code and block metadata.

3. **`utils/civetMapLines.ts`**
   - `compileCivet()`: invokes `@danielx/civet.compile()` on the dedented snippet, returning `{ code, rawMap }`.

4. **`utils/civetMapToV3.ts`**
   - `normalizeCivetMap()`: converts raw Civet map (delta-encoded lines) into a standard V3 `RawSourceMap`.
   - Applies `originalCivetSnippetLineOffset_0based`, `svelteScriptTagIndent`, and adjusts for `snippetHadLeadingNewline`.

5. **`utils/civetMapChainer.ts`**
   - `chainMaps()`: merges the base TSX map with Civet block maps.
   - For script segments: uses `TraceMap` to map back.
   - For template segments: applies cumulative line deltas `(compiledTsLineCount – originalCivetLineCount)`.

6. **`utils/civetUtils.ts`**
   - Helpers: `getActualContentStartLine()`, `stripCommonIndent()`, `getLineAndColumnForOffset()`, etc.

## 4. Data Flow Analysis for `LazerFocus2-issue4.svelte`

- **Raw snippet** includes a leading tab+newline.
- **`snippetTrimmed`** removes one leading newline via regex.
- **`dedentedSnippet`** removes the common indent, resulting in no leading newline.
- **`originalContentStartLine`** computed as the first non-whitespace char’s line (L3).
- **`normalizeCivetMap`**: `snippetHadLeadingNewline` should be `false`.

For `problematicFoo` (second line of `dedentedSnippet`):
```
originalLine_0based_in_snippet = 2
finalOriginalLine_1based = 2 + 2 + 1 = 5  // maps to line 5 in .svelte
```

**Yet**, the test shows offset –1 (i.e. mapped to L4), indicating that in practice `snippetHadLeadingNewline` was treated as `true` or the offset metadata was off by one.

## 5. Preliminary Root-Cause Hypotheses

1. **`snippetHadLeadingNewline` misfires** in `normalizeCivetMap`, i.e. `dedentedSnippet` unexpectedly begins with a newline.
2. **`getActualContentStartLine` off-by-one** if it skips too many characters.
3. **Line-count mismatch**: `originalCivetLineCount` vs. trimmed snippet length, causing negative deltas in `chainMaps` for script segments.

## 6. Next Steps

1. Instrument `civetPreprocessor.ts` to log `snippet`, `snippetTrimmed`, and `dedentedSnippet` for the problematic fixture.
2. In `normalizeCivetMap`, log `civetMap.source` and the value of `snippetHadLeadingNewline`.
3. Verify `originalContentStartLine` values directly.
4. Confirm that a single blank/tab line in the script triggers the unexpected leading newline in the map.

## 7. Relevant Files

- `src/svelte2tsx/index.ts`
- `utils/civetPreprocessor.ts`
- `utils/civetMapLines.ts`
- `utils/civetMapToV3.ts`
- `utils/civetMapChainer.ts`
- `utils/civetUtils.ts`