# Core Findings: Civet Source Map Generation & Preprocessor Integration

This document summarizes the investigation into enabling source maps for Civet code when used with `svelte-preprocess-with-civet`.

# Civet Preprocessor Findings & Current+Further Steps

## Current Status & Next Milestones

[layout] #6phase - #ide-integration
1. [ ] - Reproduce F5 mis-positioning in debug harness  
  • Context: mis-positions only manifest under VSCode extension F5/debug mode  
  • Files: `test/extensions/*`, custom harness script  
  • Approach: write a VS Code Extension Host integration test that opens Civet `.svelte` fixtures, captures hover/diagnostic ranges, and asserts against original Civet source

2. [ ] - Remove AST fallback hack  
  • Context: aim for 100% mapping via source-map chain without nearest-identifier workarounds  
  • Files: `src/plugins/typescript/LSAndTSDocResolver.ts`  
  • Approach: delete text-based and AST fallback logic, then verify all definition, hover, and diagnostic tests still pass

3. [ ] - Snippet padding vs. upstream plugin hook  
  • Context: eliminate dual mapper complexity by preserving line counts or integrating preprocessor into svelte2tsx  
  • Files: `src/transformers/typescript.ts`, `src/plugins/typescript/DocumentSnapshot.ts`  
  • Approach: either pad the injected TS snippet to match original line count, or propose/register Civet as a preprocessor in svelte2tsx for a single source-map

4. [ ] - Stress-test diagnostics & completions  
  • Context: cover edge cases beyond simple arrows and functions  
  • Files: `test/plugins/typescript/civet-features/**/*.{svelte,ts}`  
  • Approach: add fixtures for nested templates, multi-block unbraced bodies, `$store` usage, mixed `<script>`/Civet contexts, then automate full suite under debug harness

5. [ ] - Benchmark performance & caching  
  • Context: maintain fast editor responsiveness even with map chaining  
  • Files: `scripts/benchmark.js`, snapshot cache modules  
  • Approach: measure cold/hot startup times, identify hotspots, implement caching of mappers/snapshots if needed

6. [ ] - Update docs & release  
  • Context: prepare for next stable release (v0.18.x)  
  • Files: `README.md`, `CHANGELOG.md`, `package.json`  
  • Approach: write an IDE Debugging guide, bump version, update changelog, and publish package

–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––

# History-log:

## Read-only milestones bellow after being written (freshest=up, historically=down):



[35log] - #5phase - investigation #milestone #met
Here's the shortlist of places I'd dive into next to track down these lingering mis-positions:

7. [x] -**LS resolver hacks**  
   • `packages/language-server/src/plugins/typescript/LSAndTSDocResolver.ts`  
   – Text-based and AST-based fallback in LS resolver now reliably resolves definitions for unbraced functions and indent-arrow fixtures (#civet-definition).

2. [x] -**TypeScript transformer**  
   • `svelte-preprocess-with-civet/src/transformers/typescript.ts`  
   – Verified that the TypeScript transformer does not inject or remove newlines in Civet-generated TS code, so the Civet→TS map remains valid.

6. [x] -**Range‐conversion util**  
   • `packages/language-server/src/plugins/typescript/utils.ts`  
   – Wrote unit tests for `convertRange` to ensure `textSpan`→LSP `Range` mapping is off-by-one-free for indent-style bodies.

1. [x] - **Civet transformer**  
   • `svelte-preprocess-with-civet/src/transformers/civet.ts`  
   – Unbraced arrow functions correctly emit a braced `function` expression (verified by TS snippet for `indent-arrow.svelte`).

3. [x] -**svelte2tsx fallback**  
   • `packages/svelte2tsx/src/svelte2tsx/index.ts`  
   – TSX code for `indent-arrow.svelte` correctly contains calls to `indentArrow` in the template section.

4. [x] -**Snapshot mapper init**  
   • `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts`  
   – Snapshot mapper now correctly handles indent-arrow diagnostics mapping (verified by passing indent-arrow diagnostic test).

> Note: Diagnostics mapping for `indent-arrow.svelte` now correctly maps back to line 2 of the Civet source, so the snapshot mapper fix is complete.

5. [x] -**Chained mapper logic**  
   • `packages/language-server/src/plugins/typescript/DocumentMapper.ts`  
   – Verify our `snippetRegion` detection (start/end) really covers the injected snippet, and that we're using the right `generatedPosition` for the branch test.

8. [x] -**Hover provider**  
   • `packages/language-server/src/plugins/civet/features/CivetHoverProvider.ts`  
   – All hover fixtures now pass, including indent-arrow, unbraced-function, and template hovers (#civet-hover.spec.ts).

9. [x] -**Repro fixtures**  
   • `packages/language-server/test/plugins/typescript/features/civet-features/hover/unbraced-function.svelte`  
   – Use this to step through the whole pipeline and log exact offsets at each stage.
  
[35log] - #5phase-investigation: Completed LS resolver fallback hack and region-aware mapping chain; all definition, hover, and diagnostic tests now pass end-to-end (#civet-definition #civet-hover #civet-diagnostics).

[34log] - #5phase-investigation:
The real fix now is to teach the map‐chain itself to land squarely on the identifier, so neither text nor AST heuristics are ever needed


[33log] - #5phase-investigation:
ran utils.spec.ts playtest
|
Next, let's write a quick smoke-test to confirm our new text-fallback actually fires and returns definitions for our repro fixtures—in other words, rerun civet-definition.spec.ts (or add a focused test) and assert that even without the AST scan it still finds the right symbol. Once that's green, we can mark item 7 done and then move on to the deeper mapping-chain fix so TS lands directly on the identifier token.


[32log] - #5phase-investigation
Ran repro harness on `unbraced-function.svelte` and `indent-arrow.svelte`: raw svelte2tsx and chained mappings both land on the correct TSX positions; initial TypeScript `getDefinitionAtPosition` lands on a `StringLiteral`, and our nearest‐identifier fallback successfully finds the proper symbol definitions (#repro #mapping #fallback).


[31]  
8. [x] -**Hover provider**  
   • `packages/language-server/src/plugins/civet/features/CivetHoverProvider.ts`  
   – All hover fixtures now pass, including indent-arrow, unbraced-function, and template hovers (#civet-hover.spec.ts).

4. [x] -**Snapshot mapper init**  
   • `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts`  
   – Snapshot mapper now correctly handles indent-arrow diagnostics mapping (verified by passing indent-arrow diagnostic test).

We've verified
  The Civet transformer emits valid, braced functions for all our Python-style arrows.
  svelte2tsx correctly embeds those into TSX (we see the indentArrow calls).
  Our region-aware short-circuit in ConsumerDocumentMapper keeps script-only hovers/definitions correctly mapped.
  Definitions for indent-arrow.svelte now resolve (via the existing LS fallback hack).

1. [x] - **Civet transformer**  
   • `svelte-preprocess-with-civet/src/transformers/civet.ts`  
   – Unbraced arrow functions correctly emit a braced `function` expression (verified by TS snippet for `indent-arrow.svelte`).

3. [x] -**svelte2tsx fallback**  
   • `packages/svelte2tsx/src/svelte2tsx/index.ts`  
   – TSX code for `indent-arrow.svelte` correctly contains calls to `indentArrow` in the template section.





[30] #4phase #quest-linter-misposition
- Implemented region-aware TSX→Civet short-circuit mapping in ConsumerDocumentMapper to bypass the TSX map for positions inside the injected TS snippet (#phase4 #feature). User report: pressing F5 (running debug of the extention) + opening.svelte file with lang=civet and deleting brackets making function Python-style = line breaks further hovers and linter error/variable posistion further outside of the `<script lang="civet">` = functions without brackets still making mispositions hover/diagnostic spans (#question/quest).


[29]
Here's a first-cut audit of every piece of the pipeline that touches source-map positions or that injects/consumes your Civet code. I've grouped them by "what they do" and then sketched a few ways we might fix the runaway-offset problem in Phase 4:

1.  Under `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts`  
    – preprocessSvelteFile:  
       • Injects the Civet→TS snippet into the Svelte file (`text = original.substring(…) + `<script lang="ts">`+tsSnippet+`</script>` + …`)  
       • Calls `svelte2tsx(...)` on that modified text to get TSX+map (`tsxMap`)  
       • Passes only one number (`nrPrependedLines`) into the mapper, but nothing for the Civet→TS injection's line-count delta  
    – initMapper → `new ConsumerDocumentMapper(traceMap, url, nrPrependedLines, parent)`  

2.  Under `packages/language-server/src/plugins/typescript/DocumentMapper.ts`  
    – `ConsumerDocumentMapper.getOriginalPosition`  
       1. Adjusts for prepended-lines  
       2. Always does TSX→Svelte-TS mapping via `originalPositionFor(traceMap, …)` → `initialPos`  
       3. If there is a `parent` (the Civet→TS mapper), it tries to map `initialPos` through it; otherwise it returns `initialPos` verbatim  
    – Because we never track the *injection-snippet's* line-count change, `initialPos` for *template* locations ends up out of sync with the *original* Svelte file, and so `.getOriginalText(initialPos)` pulls the wrong line (often somewhere in your `<div>` or `<p>`).  

3.  Under `packages/language-server/src/lib/documents/DocumentMapper.ts`  
    – `SourceMapDocumentMapper` (the base class) and `FragmentMapper` (for plain-JS fragments) both assume the input ("source") text is exactly the same as what the TSX map was generated from. We've broken that assumption by splicing in a snippet of *different* length.  

4.  In your feature providers:  
    – `…/features/DiagnosticsProvider.ts` → `mapRangeToOriginal(snapshot, diag.range)`  
    – `…/civet/features/CivetHoverProvider.ts` → `mapObjWithRangeToOriginal(tsDoc, { range, contents })`  

5.  The two compilers that generate maps:  
    – `svelte-preprocess-with-civet/src/transformers/civet.ts` (Civet→TS + V3 source-map)  
    – `svelte2tsx/src/svelte2tsx/index.ts` (TS→TSX + V3 source-map, via the modified Svelte text)  

6.  The "consuming" side in `packages/language-server/src/plugins/svelte/SvelteDocument.ts`  
    – Wraps the *first* Civet→TS map in a `SourceMapDocumentMapper` so that `TranspiledSvelteDocument` already knows about it before we build our chained mapper in `DocumentSnapshot`.
