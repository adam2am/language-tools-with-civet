# Core Findings: Civet Source Map Generation & Preprocessor Integration

This document summarizes the investigation into enabling source maps for Civet code when used with `svelte-preprocess-with-civet`.

so what do we do, 
we need to see+understand what?
what files do we need to investigate further

# Civet Preprocessor Findings & Current+Further Steps

## user raport:
- user noticed, also when foofunc2 is exactly near the script tag, it is being hovered with a /script tag visually
- sometimes through time when bunch of error stop even working?

## Current Status & Next Milestones
[layout] - 7phase - #from language server to svelte2tsx
In short:
Current flow: Civet-preprocess → Svelte (LS) → svelte2tsx → TSX → LS
Desired flow: Svelte with <script lang="civet"> → svelte2tsx (inside it: Civet-preprocess + template conversion) → TSX + unified source-map → LS

### Actionable 7-phase roadmap

- [ ] Civet in svelte2tsx (module scripts)
  - files affected: packages/svelte2tsx/src/index.ts
  - context: svelte2tsx only handles TS/JS in module scripts
  - potential approach: In the processModuleScript branch, detect `lang="civet"`, import the Civet→TS transformer, run preprocessor to get TS snippet + map, inject snippet into MagicString, chain the Civet map, fallback unchanged for other langs.
  - playtests: Add a module-script Civet fixture under `packages/svelte2tsx/test/test.ts`; verify generated TSX + unified sourcemap and no regressions.

- [ ] Civet in svelte2tsx (instance scripts)
  - files affected: packages/svelte2tsx/src/index.ts
  - context: `processInstanceScriptContent` currently handles TS/JS in template scripts
  - potential approach: Mirror the module-script hook: guard on `lang="civet"`, preprocess to TS snippet + map, inject and chain maps, fallback when lang≠civet.
  - playtests: Add instance-script fixtures (`arrow-*.svelte`, `indent-arrow.svelte`) under `packages/svelte2tsx/test/fixtures`; verify raw TSX mappings and unified map cover both template and Civet snippet.

- [ ] Source-map chaining in svelte2tsx
  - files affected: packages/svelte2tsx/src/index.ts
  - context: separate Civet→TS and TSX→Svelte maps aren't merged today
  - potential approach: After injecting the Civet snippet, call `magicString.chainSourcemaps(civetMap)` before `generateMap()`, producing a unified source map.
  - playtests: Inspect the output `.map` JSON for a multi-stage sample; verify positions round-trip correctly through both maps.

- [ ] Audit post-Civet formatting
  - files affected: svelte-preprocess-with-civet/src/transformers/typescript.ts
  - context: formatting passes (Prettier/ts-morph) may shift offsets and misalign mappings
  - potential approach: Review or disable formatting during svelte2tsx injection, or re-apply formatting as a chained map
  - playtests: Run `test-civet-preprocessor.mjs` and `testPreProcTest.mjs` end-to-end; confirm mapping logs match unformatted source.

- [ ] Pass snippet region into DocumentSnapshot
  - files affected: packages/language-server/src/plugins/typescript/DocumentSnapshot.ts
  - context: `initMapper` must know the TSX range of the injected snippet for region-aware mapping
  - potential approach: In `initMapper`, compute snippetRegion via `getRawSvelte2TsxMappedPosition()`, then pass it into `new ConsumerDocumentMapper(parentMapper, snippetRegion)`
  - playtests: Extend civet-diagnostics tests to assert the region was recorded and used.

- [ ] Region-aware short-circuit in ConsumerDocumentMapper
  - files affected: packages/language-server/src/plugins/typescript/DocumentMapper.ts (ConsumerDocumentMapper)
  - context: `getOriginalPosition` currently always walks TSX→Svelte map, even inside injected snippets
  - potential approach: In `getOriginalPosition(generatedPos)`, if `generatedPos` falls within `snippetRegion`, call the Civet→TS parentMapper; otherwise, fallback to TSX→Svelte mapping.
  - playtests: Run `test/civet-chain.test.ts`; assert inside-snippet vs outside-snippet positions diverge as expected.

- [ ] Validate & fix multi-line range conversion
  - files affected: packages/language-server/src/plugins/typescript/utils.ts
  - context: `convertRange` can be off-by-one on multi-line `TextSpan`s
  - potential approach: Audit 0-based vs 1-based arithmetic in `convertRange`, clamp multi-line spans correctly
  - playtests: Add a multi-line Civet function fixture to `utils.spec.ts`; run the full LS test suite and ensure no off-by-one failures in hover/diagnostics.

Where to hook in Civet processing
Right now, both in the module and instance branches you see a // TODO: Preprocess Civet content…. If you want svelte2tsx itself to handle <script lang="civet">, you would:
Import your Civet transformer (just like your Language Server does).
At the two detection sites, replace the raw str.move + processInstanceScriptContent with something like:
Extract the raw Civet code from scriptTag.content,
Run it through the Civet → TS transformer (getting both code and its preprocessor sourcemap),
Inject the resulting TS snippet back into the MagicString (just like you do today in your LS),
Chain that snippet's map into the overall MagicString map so that the final str.generateMap() knows about both the Civi→TS map and the TSX→Svelte map.
That would give you a single svelte2tsx invocation that:
Parses the template,
Preprocesses Civet to TS,
Emits your TSX + a unified source map,
And (crucially) can—once the snippet is injected in the right place—preserve precise mappings for each template expression back to your original Civet lines.

–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––

# History-log:

## Read-only milestones bellow after being written (freshest=up, historically=down):
[45]
In short:
Current flow: Civet-preprocess → Svelte (LS) → svelte2tsx → TSX → LS
Desired flow: Svelte with <script lang="civet"> → svelte2tsx (inside it: Civet-preprocess + template conversion) → TSX + unified source-map → LS

[44]
File to Investigate: ltools-backup/packages/svelte2tsx/src/svelte2tsx/index.ts is the most likely candidate. This is where the Svelte AST is traversed, different parts (script, template) are processed (calling out to htmlxtojsx_v2 for the template), and the final code and map are produced.


The handleMustacheTag itself is quite simple. It relies on MagicString to keep the mapping for the inner expression (hoverVarTemplate in our example) intact relative to its surrounding transformations.
The problem is less likely to be an incorrect addSourcemapSegment call for the identifier within handleMustacheTag, and more likely one of these:
Offset Accumulation/Shifting: As svelte2tsx builds the entire TSX string (embedding the <script> content, then the render function, etc.), the cumulative effect of various str.overwrite(), str.prepend(), str.append() calls might cause the final sourcemap generated by MagicString.generateMap() to lose precision or context for template expressions, especially when a significant block of (script) code with its own mappings precedes the template rendering logic in the generated TSX.
Sourcemap Generation Parameters: When MagicString.generateMap() is called (likely in the main svelte2tsx/index.ts or a similar top-level file after all transformations are done), the options passed to it (like source, file, includeContent) might influence how mappings are resolved or merged.
Interaction with Script Mappings: The presence of sourcemap segments for the script block (which maps from the TS-in-script-tag back to the original Svelte file) might be interfering with or overshadowing the mappings for the template block when the final map is generated. The sourcemap generation tools might try to "simplify" or "reconcile" mappings in a way that loses the template-specific origin.



[43]
Okay, I've reviewed the detailed summary and your current hypothesis. It seems very plausible that the precision of svelte2tsx sourcemaps for template expressions is the root cause, even when it's processing Svelte content that has already had Civet code preprocessed into TypeScript.
|
The svelte2tsx maps the original Svelte hover-user-case-template.svelte (line 7, char 6 for {fooFunc2}) to the generated TSX line 10, char 5 (fooFunc2;). This seems correct at a glance.
The test fails with: AssertionError [ERR_ASSERTION]: Hover content should include fooFunc2.
The actual hover object from the logs for this failing test case (markup {fooFunc2}):

Root Cause Confirmation:
For hover-template.svelte and arrow-template.svelte, the primary issue is indeed the inaccuracy of the svelte2tsx sourcemaps. These maps incorrectly link template expressions back to the script portion of the TSX instead of the template-rendering portion.
Next Steps:
First, I'll correct the test coordinate in civet-hover.spec.ts for the hover-user-case-template.svelte - {fooFunc2} test.
After that, we'll need to decide how to handle the svelte2tsx sourcemap inaccuracies for the other failing template tests.
Let's

he most pragmatic approach for now might be a combination:* **Short-term:** Update the core-findings.md to clearly document this limitation of svelte2tsx with preprocessed Civet blocks affecting template hover accuracy.* **Short-term:** For the failing tests (hover-template.svelte, arrow-template.svelte), we could adjust their expectations to reflect the current (incorrect) behavior or temporarily skip them with a clear comment explaining why, pointing to the svelte2tsx sourcemap issue. This keeps the test suite "green" while acknowledging the known problem.* **Long-term:** Consider investigating Option 2 or a more targeted version of Option 3 if this becomes a critical issue for users.What are your thoughts on how to proceed with the two remaining failing tests and documenting this finding? If you'd like to update core-findings.md, let me know what you'd like to add or change. If you want to adjust the tests, how would you like to adjust them?

== the svelte2tsx sourcemaps for template expressions are routing you into your <script> block instead of into the $$render() template code, so TS can't resolve those identifiers.


[42]
Conclusion: This is the most revealing one!
Svelte position (7,6) for fooFunc2 maps to TSX (10,5) (offset 177).
getDefinitionAtPosition at this TSX offset fails initially.
Crucially, the AST fallback in LSResolver finds fooFunc (the one that is not defined in the script, but exists as {fooFunc} in the template!) as the "closest node" at TSX offset 176. This is because fooFunc2 is right after fooFunc in the svelte2tsx output: { svelteHTML.createElement("div", {}); fooFunc; fooFunc2; }. The mapping for fooFunc2 seems to be landing on or very near the end of fooFunc or the start of fooFunc2 in a way that TS's AST traversal or definition lookup gets confused or picks the preceding token.
The fallback direct getQuickInfoAtPosition at the TSX offset 177 then gets any with a textSpan starting at TSX offset 176 (which is fooFunc).
The test fails because the hover content is "any" and doesn't include "fooFunc2".
This strongly indicates that the svelte2tsx sourcemap for {fooFunc2} is leading to a TSX position that is either ambiguous or incorrectly resolved by TypeScript to the preceding {fooFunc} token (or a part of it).


[41log]
Looking at the logs, the primary reason for these failures is that TypeScript's getDefinitionAtPosition (called via the LSAndTSDocResolver wrapper) returns no definitions when invoked for these template identifiers. This causes the CivetHoverProvider's template hover logic to return null.
We've identified two potential underlying issues:
Inaccurate Svelte-to-TSX mapping for template positions: For hover-user-case-template.svelte when hovering {fooFunc2}, the logs indicate that tsDoc.getGeneratedPosition() maps the Svelte position to a TSX offset that appears to be inside the preceding {fooFunc} token. This would naturally lead to getDefinitionAtPosition failing for fooFunc2 (and possibly finding nothing for fooFunc if it's undefined).
TypeScript failing to find definitions for correctly mapped template identifiers: For arrow-template.svelte, the Svelte-to-TSX mapping for {arrowFn} seemed plausible, yet getDefinitionAtPosition still returned no results.


[40log]
Confirmation: that the primary logic for template hovers (find definition, then get info for definition site) is now working correctly with the proper offset mappings.
|
Success for hover-user-case-template.svelte (template hover):
The key test case we added, provides correct hover info for fooFunc2 in hover-user-case-template.svelte template, is now PASSING!
Let's look at the logs for this specific test run:
Definition Found:
WRAPPER HIT: getDefinitionAtPosition is called for the hover on {fooFunc2} (Svelte offset 177).
[LSResolver] getDefinitionAtPosition: Svelte input: ... Mapped to TSX: { tsxOffset: 191 ... }
[LSResolver] Initial getDefinitionAtPosition result (from TSX): [ { ... textSpan: { start: 65, length: 8 } ... name: 'fooFunc2' ... } ]
This correctly finds the definition of fooFunc2 in the TSX, which corresponds to the Civet function definition. TSX offset 65 is the start of fooFunc2 in the script block of the generated TSX.

[39log]
Consequences for Fallback Logic:
Our fallback logic, as it currently stands inside the wrappers, is also based on this flawed premise.
program.getSourceFile(fileName): If fileName is +page.svelte, this will likely not return the TSX SourceFile object we need for reliable AST traversal or accurate text operations on the generated code.
tsxSnapshot.getText(...): This tsxSnapshot is currently fetching the Svelte file content because fileName is the Svelte file path. So, the fallbacks are operating on Svelte content, not TSX content.

Svelte to TSX Mapping:
The wrappers now correctly understand that the incoming fileName and position are for the original Svelte file.
Before calling the underlying TypeScript service methods (origGetDef, origGetQuickInfo), the Svelte file path and position are explicitly mapped to their corresponding TSX file path (tsxFilePath) and TSX character offset (tsxOffset).
This mapping uses:
document.getFilePath() for the Svelte path.
tsDoc.filePath for the TSX path (where tsDoc is the SvelteDocumentSnapshot representing the generated TSX).
document.positionAt(svelteOffset) to convert Svelte offset to Svelte Position (line/char).
tsDoc.getGeneratedPosition(sveltePosition) to map Svelte Position to TSX Position.
tsDoc.offsetAt(tsxPosition) to convert TSX Position to TSX offset.
TypeScript Service Calls:
origGetDef and origGetQuickInfo are now called with tsxFilePath and tsxOffset. This is crucial because the TS service operates on the generated TSX.
Fallback Logic:
The fallback mechanisms (text-based and AST-based) now correctly use tsxFilePath to get the sourceFile from the TS program and operate on the tsxOffset and TSX content (tsDoc.getText(...)).
Logging:
The console.log and Logger.debug statements have been updated to clearly indicate:
Incoming Svelte coordinates.
Target TSX file path.
Mapped TSX coordinates (offset, line, character).
Which file path and offset are being used for TS calls and fallbacks.
Return Values:
The definitions (defs) returned by lang.getDefinitionAtPosition and the quickInfo returned by lang.getQuickInfoAtPosition (including any textSpan within quickInfo) will be in TSX coordinates. The comments now reflect that the caller of getLSAndTSDoc is responsible for mapping these TSX results back to Svelte coordinates if needed for the final response to the client.

[38log]
YES! This is exactly what we needed!
The key lines are:
Apply to LSAndTSDocRe...
This is a major breakthrough because it confirms:
Our wrapper methods ARE being hit. This means the lang object we are creating by spreading origLang and then replacing methods is the one being used for these TypeScript calls.
The console.log statements are working, which means if Logger.debug messages from within these wrappers were not appearing, it would suggest an issue with Logger.debug specifically in this context/scope, or its output being filtered.
The fileName passed to these methods is /home/user/Documents/repos/sv-civet-proof-of-concept/src/routes/ts/+page.svelte. This is the original Svelte file path, NOT the TSX path.
The position (e.g., 187 for definition, 67 for quick info) is an offset within that original Svelte file.
Crucial Insight & Correction to my Previous Assumption:
My previous Logger.debug messages inside the wrappers incorrectly stated Position (offset in TSX doc). This is wrong. The fileName and position that our wrappers receive are the already mapped coordinates, supposedly corresponding to the original Svelte/Civet file.
The flow is roughly:
VS Code requests hover/definition at a UI position in +page.svelte.
Language server maps this UI position to a TSX position.
Language server calls the actual TypeScript service's getQuickInfoAtPosition / getDefinitionAtPosition with the +page.svelte.tsx path and the TSX offset.
If TS returns results, these results contain spans within the TSX file.
The language server then takes these TSX spans and maps them back to original Svelte/Civet coordinates using ConsumerDocumentMapper.getOriginalPosition.
It is these final, mapped-back-to-original-Svelte/Civet coordinates that are then (usually) used to interact with our LSAndTSDocResolver's wrapped methods if further processing or fallbacks specific to the Svelte/Civet context were intended.
However, the current logging in LSAndTSDocResolver (the Logger.debug lines) is designed as if it's receiving TSX positions and then performing fallbacks within the TSX. This needs to be re-evaluated. The fallbacks (text-based, AST-based) should operate on the TSX content if the initial TypeScript call (which itself operates on TSX) fails.
|
The fallbacks inside our wrapped getDefinitionAtPosition are triggered if the initial origGetDef(fileName, position) fails. At this point, fileName is the original Svelte path and position is an offset there.
To perform fallbacks on the TSX content, we first need to map this original Svelte/Civet (fileName, position) back to its corresponding TSX (tsxFileName, tsxPosition).
Then, the text/AST fallbacks should use tsxFileName and tsxPosition to analyze the TSX content and find candidate TSX offsets.
Finally, origGetDef would be called with tsxFileName and the new candidate tsxOffset.




[37log] - #6phase - #mapping-debug - Further log analysis
Based on the latest logs (post `DocumentMapper.ts` refactoring and with extensive logging):

**Conclusions & Progress on Phase 6 Investigation:**

*   **Items 1 & 2 (Workspace & Config):**
    *   `[x] packages/svelte-vscode/src/extension.ts – verify workspace root resolution and initializationOptions passed to the LS (#workspace)`
    *   `[x] packages/language-server/src/server.ts – confirm rootUri/workspaceFolders handling and svelte.config.js loading (#config-loading)`
    *   Logs confirm:
        *   Language server initialized in the correct project root (`sv-civet-proof-of-concept`).
        *   `svelte.config.js` (containing Civet preprocessor) is loaded successfully.
    *   *Status: These appear to be working correctly in the test environment.*

*   **Item 3 (Preprocessor Invocation):**
    *   `[x] packages/language-server/src/plugins/svelte/SvelteDocument.ts – log Civet preprocessor invocation via wrapPreprocessors.script (check lang="civet" code and source map) (#preprocessing)`
    *   Logs (`SvelteDocument.wrapPreprocessors: Script preprocessor ('unknown') called... Lang: civet`) confirm the Civet preprocessor is being invoked for `<script lang="civet">` blocks. Raw preprocessor output is also visible.
    *   *Status: Confirmed working in the test environment.*

*   **Item 4 (Snapshot Mapper Init):**
    *   `[x] packages/language-server/src/plugins/typescript/DocumentSnapshot.ts – log computed snippetRegion, tsxMap and preprocessorMapper in initMapper (#snapshot-mapper)`
    *   Logs (`[SvelteDocumentSnapshot] initMapper snippetRegion...`) show `snippetRegion` is computed and logged. Its coordinates (TSX 0-based) appear correct for the structure of the content processed by `svelte2tsx`.
    *   *Status: Confirmed working in the test environment.*

*   **Item 5 (Consumer Mapper Logic):**
    *   `[x] packages/language-server/src/plugins/typescript/DocumentMapper.ts – log branch choice and positions in ConsumerDocumentMapper.getOriginalPosition (#mapping-branch)`
    *   Extensive logs from `ConsumerDocumentMapper.getOriginalPosition` demonstrate:
        *   Accurate mapping from TSX positions to `initialPos` (0-based, relative to `svelte2tsx`'s input view, which includes the Civet-processed script).
        *   Correct branching based on `snippetRegion`: `parentMapper` (Civet's map) is used for script content, and direct TSX->Svelte mapping for template content.
        *   Coordinates passed to the `parentMapper` (`initialPos`) are 0-based and relative to the start of Civet's JavaScript output, which is the correct frame of reference for the Civet sourcemap.
    *   *Status: The logic within `ConsumerDocumentMapper` itself seems sound and is behaving as designed according to the logs.*

**If mispositioning persists (as per user report "still misposition 1 line bellow"):**

The primary suspects for remaining mispositions within Civet script blocks are now:
1.  **The Civet Preprocessor's Own SourceMap (`parentMapper`):** The sourcemap generated by `svelte-preprocess-with-civet` might have inaccuracies, especially concerning line/column mappings for unbraced/indentation-sensitive Civet syntax. While `ConsumerDocumentMapper` correctly passes a position in Civet's *output* JavaScript, the fidelity of mapping this back to the *original* `.civet` source depends entirely on the preprocessor's sourcemap.
2.  **`LSAndTSDocResolver.ts` (Item 6):**
    *   `[ ] packages/language-server/src/plugins/typescript/LSAndTSDocResolver.ts – log initial TS lookup and text/AST fallback paths and offsets (#resolver-fallback)`
    *   If the final position returned by the complete mapping chain (including the Civet parent map) is still not precise enough for TypeScript's language service to find the definition directly, the fallback mechanisms in `LSAndTSDocResolver` engage. Logging is needed to see the exact mapped position given to TS and to observe if/how these fallbacks are triggered and if they might contribute to perceived offsets.

**Revised Next Steps for Phase 6:**
The logging patches requested in the original "Next steps for Phase 6" for items related to `SvelteDocument`, `DocumentSnapshot`, and `ConsumerDocumentMapper` have been effectively implemented and analyzed. The remaining crucial logging is for `LSAndTSDocResolver`.

1.  **Log in `LSAndTSDocResolver.ts`:** (Complete original Phase 6, item 1d for `LSAndTSDocResolver`)
    *   Add detailed logging in `LSAndTSDocResolver.getDefinitionAtPosition`, `LSAndTSDocResolver.getHoverInfo`, and any related internal methods to observe:
        *   The *final* mapped position (0-based, in original Civet source coordinates) that is being passed to TypeScript's language service methods (e.g., `getDefinitionAtPosition`, `getQuickInfoAtPosition`).
        *   Whether TypeScript's methods succeed directly with this position.
        *   If not, log when fallback mechanisms (text scan, AST scan) are triggered.
        *   Log the specific positions and identifiers involved if fallbacks are used.
2.  **Verify Civet Sourcemap Accuracy:** (May require testing outside the language server)
    *   Isolate the `svelte-preprocess-with-civet` preprocessor.
    *   Create minimal test cases of Civet code (especially unbraced/Python-style functions that might cause issues) and their expected JavaScript output.
    *   Directly examine the sourcemaps generated by the Civet preprocessor for these test cases. Tools that can visualize or query V3 sourcemaps might be helpful here. Ensure line and column mappings are perfectly accurate.
3.  **Review `SourceMapDocumentMapper` Implementation:**
    *   As a secondary check, briefly review `packages/language-server/src/lib/documents/SourceMapDocumentMapper.ts`. Ensure its logic for applying a `traceMap` (given an incoming position in its "generated" space – i.e., Civet's JS output) is standard and doesn't have obvious off-by-one errors or misinterpretations of 0-based vs 1-based conventions.

This revised plan prioritizes understanding the interaction with TypeScript and its fallbacks, and separately validating the Civet preprocessor's sourcemap output.


[36log] - #6phase - #nobrackets-breaks-position
The crucial change is how tsxMapped is obtained (directly from generatedPosition.line + 1 without subtracting this.nrPrependesLines) and how inTsxSnippetRegion is determined (using generatedPosition directly against this.snippetRegion).
 prepared a new version of the getOriginalPosition method in ConsumerDocumentMapper.ts. This version:

1. Uses the generatedPosition (from TSX) directly when mapping through the svelte2tsx sourcemap (this.traceMap).
2. Checks generatedPosition (TSX) directly against the snippetRegion (also TSX coordinates).
3. The initialPos (which is in the coordinate system of the Svelte file as processed by svelte2tsx, including Civet's script changes) is then correctly passed to the parentMapper (Civet's own mapper) if the position falls within the script snippet.




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

---
**Original Phase 6 Plan Items (for reference, largely superseded or completed):**

(... original Phase 6 items can remain here for historical context if desired, or be removed ...)

**What's still broken in F5 debug?** (This section can be updated based on F5 testing after svelte2tsx investigation)
When you open your root folder in VS Code and hit F5:

  1. **Unbraced (`function foo` style) Civet functions** still mis-position hover and diagnostics—they end up inside a `"div"` or `"template"` literal in the TSX, not on your `foo` identifier.
  2. **Braced JavaScript functions** (e.g. `function foo { … }`) work perfectly.

All of our **isolated** tests (hover, definition, diagnostics) now pass under Mocha, so the logic _in_ the language-server _code_ is sound—but something changes once it's running as the real VS Code extension.

---

**Likely culprits to investigate in Phase 6** (This section is now largely outdated by the focus on svelte2tsx for template hovers, but kept for historical context regarding F5 debugging if script issues reappear there)
  • **Config loading & preprocessor hook**
    – Is your `svelte.config.js`