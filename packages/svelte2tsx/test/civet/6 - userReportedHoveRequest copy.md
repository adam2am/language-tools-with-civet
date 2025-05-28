architecy

# Refactoring Plan: Civet Sourcemap Chaining Enhancement in `svelte2tsx`

## 1. Executive Summary & Goals

This plan outlines the refactoring strategy for the `chainMaps` function within `packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts`. The primary objective is to fix a sourcemap bug where language features (like hover) incorrectly target preceding tokens (e.g., `function` keyword) instead of the intended identifier (e.g., `foo1`) within Civet script blocks in Svelte components.

**Key Goals:**

1.  **Accurate Token Mapping:** Ensure that identifiers in the final TSX output, originating from Civet code, map back precisely to their original locations (line and column) in the Civet code within the `.svelte` file.
2.  **Prioritize Detailed Information:** The chaining process must prioritize the detailed token-specific mappings from the Civet-to-TS sourcemap (`normalizedMap`) over potentially coarser mappings from the Svelte-with-TS-to-TSX sourcemap (`baseMap`).
3.  **Robustness:** The solution should be robust for various Civet code structures and improve the overall reliability of source mapping for Civet in Svelte.

## 2. Current Situation Analysis

The current sourcemap generation pipeline involves:
1.  `civetPreprocessor.ts`: Compiles Civet to TypeScript (TS) and produces a `normalizedMap`. This map accurately links the Civet-generated TS snippet back to the original Civet code in the `.svelte` file, including precise column information.
2.  `svelte2tsx/index.ts`: Takes Svelte content (with Civet already turned into TS by the preprocessor) and generates final TSX. It also produces a `baseMap` linking this TSX to the Svelte-with-TS content.
3.  `civetMapChainer.ts` (`chainMaps` function): Attempts to chain `baseMap` (TSX -> Svelte-with-TS) and `normalizedMap` (Civet's TS -> Original Svelte Civet) to produce a final TSX -> Original Svelte Civet map.

**Key Pain Point (The `foo1` Hover Bug):**
The `baseMap` can be coarse. For example, it might map the `foo1` identifier in TSX to the beginning of the line (e.g., the `function` keyword) in the Svelte-with-TS content. The current `chainMaps` logic uses this coarse Svelte-with-TS position to query the `normalizedMap`. `normalizedMap` then correctly maps the `function` keyword in the TS snippet to the `function` keyword in the original Svelte/Civet. Consequently, the final chained map incorrectly links the TSX `foo1` to the original Svelte/Civet `function` keyword.

The `core-findings.md` (especially `[60log]`) suggests that `MagicString.overwrite()` used in `svelte2tsx` might be the cause for `baseMap`'s coarseness over the script region. While a broader fix might involve changing how `baseMap` is generated, this plan focuses on enhancing `chainMaps` as per the user task's specific request.

## 3. Proposed Solution / Refactoring Strategy

The core idea is to make `chainMaps` "smarter" when dealing with segments from `baseMap` that correspond to Civet-originated code, especially when token names are available.

### 3.1. High-Level Design / Architectural Overview

The `chainMaps` function will continue to iterate through segments of the `baseMap`. However, when a segment maps to a region in the `svelteWithTsContent` that was originally a Civet script (and is now Civet-compiled TS):

*   **If `baseMap` segment has a name:** Instead of solely relying on the (potentially coarse) line/column from `baseMap`'s target to query `normalizedMap`, the refactored `chainMaps` will attempt to find a corresponding named token in `normalizedMap`'s "generated" side (the Civet-TS snippet).
*   **Prioritize Named Match:** If a named match is found in `normalizedMap` on a relevant line, its "original" Svelte/Civet coordinates (which are precise) will be used for the final mapping.
*   **Fallback:** If no name is available or no suitable named match is found in `normalizedMap`, the existing logic of using `traceSegment` with the coordinates derived from `baseMap`'s target will be used as a fallback.

This approach aims to "correct" the coarse target from `baseMap` by leveraging token name information, assuming names are consistently propagated and available in both `baseMap` and `normalizedMap`.

### 3.2. Key Components / Modules

1.  **`packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts` (`chainMaps` function):**
    *   This function is the primary target for refactoring.
    *   It will need to decode `normalizedMap` (i.e., `block.map`) to iterate its segments if name-based matching is attempted.
    *   It will need access to `baseMap.names` and `block.map.names`.

2.  **`packages/svelte2tsx/src/svelte2tsx/utils/civetPreprocessor.ts` & `civetMapToV3.ts`:**
    *   No direct changes are planned for these files as part of this specific `chainMaps` refactor. However, their outputs (`CivetBlockInfo.map` which is `normalizedMap`, and the structure of `normalizedMap` itself, including its `names` array) are crucial inputs. The plan assumes `normalizedMap` is correctly generated and provides accurate name information for tokens in the Civet-TS snippet.

### 3.3. Detailed Action Plan / Phases

**Phase 1: Analysis & Preparation**
   - Objective(s): Confirm assumptions about sourcemap contents and prepare for refactoring.
   - **Priority:** High
   - Task 1.1: Verify `normalizedMap` structure for the `foo1` test case.
      - **Rationale/Goal:** Understand how `foo1` and `function` are represented in `normalizedMap`'s segments and `names` array (specifically, the "generated" side, which is the Civet-TS snippet).
      - **Estimated Effort:** S
      - **Deliverable/Criteria for Completion:** Logged/inspected `decoded(normalizedMap.mappings)` and `normalizedMap.names` for the `twoFooUserRequest.svelte` example, specifically focusing on segments related to `function foo1()`.
   - Task 1.2: Verify `baseMap` structure for the `foo1` test case.
      - **Rationale/Goal:** Confirm the exact `baseMap` segment for the TSX `foo1`. Identify its `nameIndex` (if any) and the `originalLine`/`originalColumn` it maps to in the `svelteWithTsContent`.
      - **Estimated Effort:** S
      - **Deliverable/Criteria for Completion:** Logged/inspected `decoded(baseMap.mappings)` and `baseMap.names` for the `twoFooUserRequest.svelte` example, specifically the segment mapping the TSX `foo1`.
   - Task 1.3: Ensure `names` array access.
      - **Rationale/Goal:** Confirm that `baseMap.names` and `block.map.names` (from `normalizedMap`) are accessible within `chainMaps`. The current `civetMapChainer.ts` uses `blockTracers[blockIndex].names`, which should provide this.
      - **Estimated Effort:** XS
      - **Deliverable/Criteria for Completion:** Code review confirming `names` arrays are available.

**Phase 2: Refactor `chainMaps` Logic**
   - Objective(s): Implement the new mapping strategy for script blocks.
   - **Priority:** High
   - Task 2.1: Implement Name-Based Precise Mapping for Script Segments.
      - **Rationale/Goal:** Modify the loop processing `baseMap` segments. When a segment maps into a Civet-TS block (`blockIndex >= 0`):
         1. Extract `targetName` from `baseMap.names` using `baseSegment.nameIndex`.
         2. If `targetName` exists:
            a. Decode `block.map.mappings` (the `normalizedMap` for the current block).
            b. Iterate through lines of `decodedNormalizedMap`. Focus on lines "close" to `coarseRelLine0_in_TS` (calculated from `baseSegment.originalLine` relative to `block.tsStartLineInSvelteWithTs`). Start with a proximity threshold of 0 (same line).
            c. Within these lines, iterate through `normalizedMap` segments (`normSeg`).
            d. If `block.map.names[normSeg.nameIndex]` matches `targetName`:
               This `normSeg` provides the precise `normOrigLine0` and `normOrigCol0` (0-based Svelte/Civet coordinates).
               Push a new segment to `remappedLines` (or `remappedScript`): `[baseSegment.generatedColumn, baseSegment.sourceIndex, normOrigLine0, normOrigCol0, baseSegment.nameIndex]`.
               Set a flag `foundPreciseMapping = true` and break from these inner loops (for `normalizedMap` segments/lines).
      - **Estimated Effort:** M-L
      - **Deliverable/Criteria for Completion:** Modified `chainMaps` function incorporating this logic. Helper functions for searching `normalizedMap` might be created.
   - Task 2.2: Implement Fallback to Current Logic.
      - **Rationale/Goal:** If `targetName` is not defined, or if step 2.1.2 does not find a `foundPreciseMapping`, revert to the existing `traceSegment`-based logic to map the (coarse) coordinates.
      - **Estimated Effort:** S
      - **Deliverable/Criteria for Completion:** Conditional logic in `chainMaps` that executes the current `traceSegment` approach if precise name-based mapping fails. Include a fallback for when `traceSegment` itself might not return a valid mapping (e.g., map to the start of the script block as a last resort).
      ```typescript
      // Pseudocode for the core logic change within chainMaps, inside the loop processing baseMap segments
      // if current baseMap segment maps into a Civet-TS block:
      const baseSeg = decodedBaseMapLine[j];
      const genCol = baseSeg[0];
      const baseSrcIdx = baseSeg[1]; // Should be 0, pointing to svelteFilePath
      const baseOrigLine0 = baseSeg[2];
      const baseOrigCol0 = baseSeg[3];
      const baseNameIdx = baseSeg.length >= 5 ? baseSeg[4] : undefined;
      
      const targetName = (baseNameIdx !== undefined && baseMap.names) ? baseMap.names[baseNameIdx] : undefined;
      
      // Coordinates from baseMap's target, relative to the Civet-TS snippet start
      const coarseRelLine0_in_TS = (baseOrigLine0 + 1) - block.tsStartLineInSvelteWithTs;
      const coarseRelCol0_in_TS = coarseRelLine0_in_TS === 0 
                                  ? baseOrigCol0 - block.tsStartColInSvelteWithTs
                                  : baseOrigCol0;

      let foundPreciseMapping = false;
      if (targetName) {
          const decodedNormalizedMap = decode(block.map.mappings); // block.map is normalizedMap
          for (let normLineIdx = 0; normLineIdx < decodedNormalizedMap.length; normLineIdx++) {
              // Proximity check: only consider segments from normalizedMap on the same line as coarseRelLine0_in_TS
              if (normLineIdx === coarseRelLine0_in_TS) { 
                  const normLineSegs = decodedNormalizedMap[normLineIdx];
                  for (const normSeg of normLineSegs) {
                      const normNameIdx = normSeg.length >= 5 ? normSeg[4] : undefined;
                      if (normNameIdx !== undefined && block.map.names && block.map.names[normNameIdx] === targetName) {
                          const preciseOrigLine0 = normSeg[2];
                          const preciseOrigCol0 = normSeg[3];
                          // Add to remappedLines[current_line_index_of_baseMap]
                          // This part needs to integrate with existing remappedLines.push(merged) structure
                          // For simplicity, assuming remappedScript is being built for current TSX line
                          remappedScript.push([genCol, baseSrcIdx, preciseOrigLine0, preciseOrigCol0, baseNameIdx]);
                          foundPreciseMapping = true;
                          break; 
                      }
                  }
              }
              if (foundPreciseMapping) break;
          }
      }

      if (!foundPreciseMapping) {
          // Fallback to existing traceSegment logic
          const tracer = blockTracers[blockIndex];
          let traced: readonly number[] | null = null;
          try {
              traced = traceSegment(tracer, coarseRelLine0_in_TS, Math.max(0, coarseRelCol0_in_TS));
          } catch {}

          if (traced && traced.length >= 4) {
              remappedScript.push([genCol, baseSrcIdx, traced[2], traced[3], baseNameIdx]);
          } else {
              // Last resort: map to start of original Civet block content line
              // This uses block.originalContentStartLine which is 1-based for the Svelte file
              // traced[2] should be 0-based line
              const originalCivetBlockStartLine0 = blocks[blockIndex].originalContentStartLine -1; // from CivetBlockInfo
              remappedScript.push([genCol, baseSrcIdx, originalCivetBlockStartLine0 , 0, baseNameIdx]);
          }
      }
      // ... then this remappedScript segment joins template segments for this TSX line ...
      ```
   - Task 2.3: Refine `finalMap` Properties.
      - **Rationale/Goal:** Ensure the returned `EncodedSourceMap` has correct `sources`, `sourcesContent`, and `names`.
      - **Estimated Effort:** XS
      - **Deliverable/Criteria for Completion:**
         - `sources`: Should be `[svelteFilePath]` (likely `baseMap.sources[0]`).
         - `sourcesContent`: Should be `[originalSvelteContent]` (passed into `chainMaps`).
         - `names`: Should primarily be `baseMap.names` to keep TSX names.
         The current `chainMaps` code already seems to handle `sources`, `sourcesContent` and `file` correctly. `names` is also `baseMap.names`. This task is mostly a verification.

**Phase 3: Testing & Validation**
   - Objective(s): Verify the fix and ensure no regressions.
   - **Priority:** High
   - Task 3.1: Test with `twoFooUserRequest.svelte`.
      - **Rationale/Goal:** Use the existing `6 - userReportedHover#current.test.ts` to confirm that hovering `foo1` now correctly maps to `foo1` in the Svelte file (Svelte Line 2, Column 9).
      - **Estimated Effort:** S
      - **Deliverable/Criteria for Completion:** Test passes with the corrected mapping.
   - Task 3.2: Add More Granular Test Cases.
      - **Rationale/Goal:** Test edge cases and complex scenarios.
      - **Estimated Effort:** M
      - **Deliverable/Criteria for Completion:** New test files and assertions covering:
         - Multiple named identifiers on the same line in Civet.
         - Identifiers that are substrings of other identifiers or keywords.
         - Cases where `nameIndex` might be missing from `baseMap` or `normalizedMap` (testing fallback).
         - Cases with multiple Civet blocks (module and instance scripts).

**Phase 4: Documentation & Cleanup**
   - Objective(s): Document the changes and clean up code.
   - **Priority:** Medium
   - Task 4.1: Add Code Comments.
      - **Rationale/Goal:** Explain the new logic in `chainMaps`, especially the name-based matching and fallback mechanisms.
      - **Estimated Effort:** S
      - **Deliverable/Criteria for Completion:** Clear, concise comments in `civetMapChainer.ts`.
   - Task 4.2: Review and Remove Debug Logging.
      - **Rationale/Goal:** Clean up temporary `console.log` statements used during development.
      - **Estimated Effort:** XS
      - **Deliverable/Criteria for Completion:** Debug logs removed or properly guarded by a debug flag.

### 3.4. Data Model Changes
   - N/A. This refactor focuses on algorithmic changes within the sourcemap chaining function.

### 3.5. API Design / Interface Changes
   - The public signature of `chainMaps` (and the single-block `chainSourceMaps` wrapper) is expected to remain the same.
   - Internal data structures like `EnhancedChainBlock` will continue to be used.

## 4. Key Considerations & Risk Mitigation

### 4.1. Technical Risks & Challenges
   - **Reliance on `names` Arrays:** The proposed precise mapping heavily relies on the `names` arrays in both `baseMap` and `normalizedMap` being accurate and consistently populated by `svelte2tsx` and `civetPreprocessor`/`normalizeCivetMap` respectively. If names are missing or inconsistent, the precise matching will fail, and the system will fall back to the current (coarse) behavior.
     - **Mitigation:** Thoroughly verify `names` array generation in Phase 1. Add robust fallback logic.
   - **Heuristic for Multiple Name Matches:** If a target name appears multiple times on the same or nearby lines in the Civet-TS snippet, choosing the correct corresponding `normalizedMap` segment can be ambiguous. The current proposal uses line proximity.
     - **Mitigation:** Start with same-line matching. If issues persist, the proximity logic might need refinement or more sophisticated heuristics. Extensive testing with varied Civet code will be crucial.
   - **Performance:** Decoding `normalizedMap` and iterating its segments for every `baseMap` script segment could have performance implications if `normalizedMap` is very large or has many segments.
     - **Mitigation:** `normalizedMap` is typically for a single script block, which might limit its size. Performance testing on large Svelte files with complex Civet scripts should be considered if initial versions are slow. The decoding of `normalizedMap` can be cached per block.

### 4.2. Dependencies
   - **Internal:**
     - Task 2.1 (Implement Name-Based Mapping) depends on Task 1.1 and 1.2 (Verification of sourcemap contents).
     - Phase 3 (Testing) depends on Phase 2 (Refactor `chainMaps`).
   - **External:** None identified for this specific refactor. The changes are localized to `civetMapChainer.ts`.

### 4.3. Non-Functional Requirements (NFRs) Addressed
   - **Maintainability:** By centralizing the complex mapping logic and providing a clear fallback, the code should remain maintainable. Adding comments (Task 4.1) will further aid this.
   - **Reliability:** The primary goal is to improve the reliability of sourcemaps for Civet features.
   - **Usability (Developer Experience):** Correct sourcemaps are fundamental to a good DX when using Civet in Svelte, enabling accurate hover, go-to-definition, and debugging.

## 5. Success Metrics / Validation Criteria

-   **Primary Metric:** The `6 - userReportedHover#current.test.ts` test case focusing on the `foo1` hover bug must pass, with the TSX `foo1` mapping to Svelte Line 2, Column 9 (the `f` in `foo1` within `\tfunction foo1()`), not Line 2, Column 1.
-   **Secondary Metrics:**
    -   Additional test cases (Task 3.2) covering various scenarios pass.
    -   Qualitative assessment: Language features (hover, go-to-definition) feel "correct" and "native" for Civet code in `.svelte` files during manual testing.
    -   No significant performance degradation in sourcemap generation for typical Svelte files with Civet scripts.

## 6. Assumptions Made

-   `normalizedMap` (output of `civetPreprocessor.ts` / `normalizeCivetMap.ts`) is fundamentally correct and accurately maps Civet-generated TS tokens back to their precise original Civet code locations in the Svelte file, including populating its `names` array correctly.
-   `baseMap` (from `svelte2tsx/index.ts`) may provide coarse column information for Civet-originated script blocks but provides a usable `originalLine` and potentially a `nameIndex` for tokens in TSX.
-   The `names` arrays in `baseMap` (for TSX tokens) and `normalizedMap` (for Civet-TS tokens) can be meaningfully correlated for common identifiers.
-   The file structure and key file paths provided in the `User Task` are accurate.

## 7. Open Questions / Areas for Further Investigation

-   **Proximity Threshold for Name Matching:** What is the optimal proximity (number of lines) when searching `normalizedMap` for a `targetName` based on `coarseRelLine0_in_TS`? Starting with 0 (same line) is proposed.
-   **Handling of Unnamed Tokens / Literals:** If `baseMap` provides a segment without a `nameIndex`, or if the corresponding token in Civet-TS has no name in `normalizedMap`, the fallback (current coarse logic) will be used. Is this acceptable, or are there ways to improve mapping for unnamed entities? (This is likely outside the scope of fixing the specific `foo1` named-identifier bug but good for future thought).
-   **Alternative: Improving `baseMap` Generation:** The `core-findings.md ([72log])` suggests using `MagicString.addSourcemapLocation` more effectively in `svelte2tsx/index.ts` could lead to a more granular `baseMap`, potentially simplifying or obviating complex logic in `chainMaps`. While this plan focuses on `chainMaps`, this alternative path remains a valid area for future improvement if the `chainMaps`-centric fix proves insufficient or too complex for all cases.
-   **Impact of Civet Compiler Optimizations/Reflows:** If the Civet compiler significantly reflows code (e.g., moves an identifier to a different line in the TS output than its original declaration line in Civet), how will the "same-line" proximity heuristic for name matching fare? This might necessitate a more flexible proximity check or a different heuristic.