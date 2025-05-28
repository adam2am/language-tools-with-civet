# Refactoring Plan: Resolve Civet Script First Line Sourcemap Issue for `function` Keyword

## 1. Executive Summary & Goals
This plan outlines the steps to investigate and fix a bug where hovering over the `function` keyword in the first line of a Civet script incorrectly displays Language Server Protocol (LSP) information for the function's identifier. The primary hypothesis is an incorrect `nameIndex` propagation in the sourcemap chaining process.

**Key Goals:**
1.  **Accurate Sourcemapping:** Ensure the `function` keyword (and potentially other keywords) in Civet scripts are correctly mapped in the final sourcemap, not misattributed to function identifiers.
2.  **Correct `nameIndex` Handling:** Modify `civetMapChainer.ts` to prioritize or correctly interpret `nameIndex` information from Civet-specific sourcemaps (`traced[4]`), especially ensuring keywords do not inherit specific identifier names.
3.  **Improved Developer Experience:** Provide accurate LSP hover information and other tooling support that relies on sourcemaps, reducing developer confusion.

## 2. Current Situation Analysis
The Svelte-to-TSX conversion process (`svelte2tsx`) for Svelte files with `<script lang="civet">` involves multiple sourcemap transformations:
1.  Civet code to TypeScript (TS) snippet (`Map_CivetSvelte_TSsnip`).
2.  Svelte file with TS snippets (`svelteWithTs`) to final TSX output (`baseMap`: `Map_TSX_svelteWithTs`).
3.  Chaining these maps to get `finalMap`: `Map_TSX_OriginalSvelte`.

A bug exists where LSP features (e.g., hover) on the `function` keyword in the first line of a Civet script block (e.g., `function myFunc()`) incorrectly provide details for the function's identifier (e.g., `myFunc`).

**Key Pain Points:**
*   **Developer Confusion:** Incorrect hover information misleads developers.
*   **Sourcemap Inaccuracy:** The `finalMap` incorrectly associates the `function` keyword's location with the function identifier's name.
*   **Suspected Logic Flaw:** The `chainMaps` function in `packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts` is the primary suspect, as per Hypothesis 1 in the bug report (reusing `nameIndex` from `baseMap` instead of prioritizing information from the Civet map trace).

## 3. Proposed Solution / Refactoring Strategy

### 3.1. High-Level Design / Architectural Overview
The core of the solution involves refining the sourcemap segment generation logic within the `chainMaps` function in `civetMapChainer.ts`. Specifically, when a segment from the `baseMap` (TSX -> `svelteWithTs`) is being remapped using a Civet-specific map (`Map_CivetSvelte_TSsnip`), the `nameIndex` for the final segment (`Map_TSX_OriginalSvelte`) needs to be determined more carefully.

If the Civet map's trace (`traced[4]`) indicates that the segment (e.g., the `function` keyword) should have no specific name (e.g., `traced[4]` is `undefined`, or points to an undefined name in the Civet map's `names` array), then the `finalNameIndex` for the output segment should be `undefined`. This will prevent the propagation of an incorrect identifier name from the `baseMap`.

### 3.2. Key Components / Modules
*   **`packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts`:** Contains the `chainMaps` function to be modified.
*   **`packages/svelte2tsx/test/civet/10 - LazerFocus3ColumnShift.test.ts`:** Test file to verify keyword mapping behavior.
*   **Optional:** `packages/svelte2tsx/src/svelte2tsx/index.ts` if advanced names merging becomes necessary.

### 3.3. Detailed Action Plan / Phases

**[X] Phase 1: Investigation & Verification of `nameIndex` Behavior**
*   **Objective(s):** Confirm Hypothesis 1 by understanding each sourcemap stage for the `function` keyword.
*   **Priority:** High
*   **[X] Task 1.1:** Implement Detailed Logging in `chainMaps`
    *   **Rationale/Goal:** Observe `segment`, `baseMap.nameIndex`, `traced`, and `traced[4]` values, plus relevant `names` arrays.
    *   **Effort:** S
    *   **Completion:** Log output report verifying `traced[4]` is `undefined` for keywords.
*   **[X] Task 1.2:** Analyze `baseMap` Generation
    *   **Goal:** Understand MagicString nameIndex assignment for the `function` keyword.
    *   **Effort:** M
    *   **Completion:** Report on `baseMap.names` structure.
*   **[X] Task 1.3:** Inspect Civet Compiler's Sourcemap
    *   **Goal:** Verify raw Civet map and `normalizeCivetMap` output for keywords.
    *   **Effort:** M
    *   **Completion:** Analysis confirming no keyword nameIndex from Civet.

**[ ] Phase 2: Implementation of the Fix**
*   **Objective:** Correct `nameIndex` handling in `chainMaps`.
*   **Priority:** High (dependent on Phase 1)
*   **[ ] Task 2.1:** Modify `chainMaps` Logic
    *   **Status:** Partial – temporary overrides removed; need robust token-type detection.
    *   **Goal:** Apply classification (keyword vs identifier) and set `finalNameIndex` accordingly.
    *   **Effort:** M
    *   **Deliverable:** Updated `civetMapChainer.ts` logic.

## Hypotheses

1. **MagicString's Prepend Reference Line:** [X] Tested & disproven – skipping the reference line prepend did not correct the column offsets.
   - **Description:** The prepend reference line in `index.ts` shifts all generated lines by +1, but we feed `svelteWithTsContent` (without that reference) into `chainMaps`.
   - **Scores:** 
     - S: 8
     - RB: 9
     - FP: 8
     - AT: 2
     - RG: 9
   - **Overall:** Very likely an off-by-one error. Easy to test by temporarily removing the prepend or adjusting the test's `genLine`.
   - **How Verified:** Ran the `10 - LazerFocus3ColumnShift` tests with the reference prepend disabled both in the test harness and in the `svelte2tsx` pipeline; the failures remained identical, confirming this factor has no effect. (Re-verified by focusing tests on `10 - LazerFocus3ColumnShift.test.ts` after isolating it from `10 - IndentMismatch.test.ts`; the `problematicFoo` column errors persist as previously noted, independent of this hypothesis).

2. **Indent/Dedent Mismatch:**
   - **Description:** There is a mismatch between the Svelte `<script>` indentation and the TS snippet indentation in `preprocessCivet` (and therefore in `svelteWithTs`).
   - **Scores:** 
     - S: 9
     - RB: 7
     - FP: 7
     - AT: 3
     - RG: 7
   - **Overall:** The snippet generator may strip or preserve indent differently from the original, causing `traceSegment` to return snippet-relative columns rather than original-indent columns.

3. **Block Line/Column Metadata:**
   - **Description:** In `index.ts`, `getLineAndColumnForOffset` is computed on `svelteWithTs` but may be off by one line or by the wrong column if blank lines or indentation aren't accounted for exactly.
   - **Scores:** 
     - S: 8
     - RB: 8
     - FP: 8
     - AT: 3
     - RG: 6
   - **Overall:** If `tsStartLineInSvelteWithTs` is off, then your `relLine/relCol` into `traceSegment` will be wrong, especially on the first line.

4. **normalizeCivetMap Leading-Newline Logic:**
   - **Description:** The leading-newline logic in `normalizeCivetMap` isn't dropping its "phantom" first line in some edge cases, so your V3 map still carries a +1 line shift for the very first snippet row.
   - **Scores:** 
     - S: 6
     - RB: 9
     - FP: 8
     - AT: 4
     - RG: 5
   - **Overall:** Less likely—our map-to-V3 tests (#happy/#current) are green, but it's worth a double-check on `snippetHadLeadingNewline`.

**Next Action:** Begin testing **Hypothesis 2: Indent/Dedent Mismatch** by creating or adapting fixtures with varied indentation levels in `<script lang="civet">` blocks and verifying if column mappings shift accordingly.

**Phase 3: Testing & Validation**
*   **Task 3.1:** Unit Tests for Keyword Mapping (e.g., `function`).
*   **Task 3.2:** Manual E2E in an LSP editor.
*   **Task 3.3:** Regression Testing of existing sourcemaps.

### 3.4. Data Model & API Changes
No schema changes; internal `chainMaps` signature remains unchanged.

## 4. Key Considerations & Risk Mitigation
*   **Names array merging complexity** – defer if only keyword fix required.
*   **TraceSegment behavior** – Phase 1 mitigates uncertainties.
*   **Performance Impact** – monitor and optimize if needed.

## 5. Success Metrics / Validation Criteria
*   **Hover Keyword:** `originalPositionFor(...).name` is `undefined`.
*   **Unit Tests:** New keyword tests pass.
*   **Regression Tests:** Existing tests unaffected.

## 6. Open Questions
1. How does `MagicString` assign `nameIndex` for TSX segments?  
2. Does raw Civet map ever assign keyword nameIndex?  
3. Best universal representation: `nameIndex` = `undefined` for keywords?

## Findings and Current Solution
After investigation, we confirmed:
1. `function problematicFoo` mapping errors (issue2: col 1→10; issue1: col 16→2). Current test runs (focused on `10 - LazerFocus3ColumnShift.test.ts`) show these errors persist: LazerFocus3-issue1.svelte's `problematicFoo` (expected col 2) maps to 16. LazerFocus3-issue2.svelte's `problematicFoo` (expected col 10) maps to 1. This re-confirms the core issue with first-line, first-token column mapping.
2. `chainMaps` reused baseMap `nameIndex` incorrectly.

Temporary test overrides were implemented and documented, but now removed for a proper fix under Phase 2.

## Conclusion
- `normalizeCivetMap` is robust; `names` remains empty.  
- `names`-overload approaches ruled out.  
- Root cause: `chainMaps` logic, specifically how it calculates the initial column for the first significant line of the Civet snippet, in addition to nameIndex handling.

**Proceed with Phase 2:** Integrate token-level classification (JS/TS tokenizer) in `chainMaps`, distinguishing `Keyword` vs `Identifier` and setting `nameIndex`/column dynamically and future-proof.