### How we go from chained V3 to TSService + forwardmap/remapposition

Below are three possible approaches for wiring direct TSService mapping for Civet `<script>` blocks, rated on feasibility (1 = lowest, 10 = highest):

1. In-process TSService host per Svelte document (Rating: 9/10)
   - Embed a TypeScript LanguageService instance directly into the svelte2tsx LSP server.
   - On open/change of a `<script lang="civet">`, compile Civet→TS in memory, capture `transpiledDoc` and `sourcemapLines` via `@danielx/civet`.
   - Use `ts.createLanguageService` with an in-memory FS to serve that TS snippet plus Svelte shims.
   - On hover/definition/completion, forwardMap incoming Civet positions into TS, call TSService APIs, then remapPosition back.
   - Pros: zero IPC overhead, full fidelity, uses unmodified TS APIs. Cons: increases LSP server memory footprint and complexity.

2. Dedicated TSService subprocess per project (Rating: 7/10)
   - Spawn a separate process (or tsserver instance) that hosts TSService with a Civet plugin.
   - Communicate over IPC/RPC: send Civet code/text and positions, receive hover/definition results.
   - Pros: isolates TSService stability, reuses existing tsserver infrastructure. Cons: IPC latency, harder debugging, extra deployment surface.

3. Hybrid: augment MagicString output with inline mapping markers (Rating: 5/10)
   - Enhance the existing V3 sourcemap pipeline to emit finer-grained segments for single-token expressions (strip braces, adjust offsets).
   - Inject custom comments or zero-width markers around each literal or identifier in the generated TSX and parse them in the LSP.
   - Pros: minimal new runtime dependencies, no TSService host needed. Cons: brittle hacks, likely to break on TS upgrades and edge cases.

---

**Chosen approach**: Option 1 – In-process TSService host per document

**Rationale**: Leverages TypeScript's native LanguageService for perfect mapping, avoids brittle source-map hacks, and preserves original TS behavior. Single-process design simplifies orchestration and caching.

## Phased rollout plan


## Civet LSP pipeline overview

Below is a side-by-side comparison of how hover/definition requests are currently handled (via chained V3 maps) versus the proposed TSService-based pipeline in `language-server`.

### 1. Current (chained V3 sourcemap)

.svelte file
  ⬇️
svelte2tsx/index.ts (in `packages/svelte2tsx`)
  • Preprocess `<script lang="civet">` with `@danielx/civet.compile` → TS code + Civet→TS sourceMap (inline map JSON)
  • Inject compiled TS into MagicString and generate final TSX code
  • Generate base Map (Svelte→TSX) via `magicString.generateMap(...)`
  • Chain maps (Svelte→TSX) ⊕ (Civet→TS) via `chainSourceMaps` → final V3 map: Svelte→TSX (including Civet segments)
  ⬇️
LSP handlers or test runners
  • Use `TraceMap` + `originalPositionFor` on final V3 map to map TSX positions back to Svelte

*Limitations*: brittle segment‐range checks in `chainSourceMaps` can miss single‐token expressions, unbraced branches, or misaligned offsets.

### 2. Proposed (TSService + forward/remap)

**Current Status of this Approach (After Initial Wiring & Phase 1.3 Completion):**
The foundational pieces for this proposed pipeline have been established:
- `CivetLanguageServiceHost` is defined in `packages/language-server/src/typescriptServiceHost.ts`.
- An instance of `CivetLanguageServiceHost` is created in `packages/language-server/src/server.ts`.
- This host instance is passed to and available within `CivetPlugin` in `packages/language-server/src/plugins/civet/CivetPlugin.ts`.
- `CivetPlugin` now contains a `handleDocumentChange` method that:
    - Identifies Svelte files with `<script lang="civet">`.
    - Extracts the Civet script content.
    - Compiles the Civet code to TypeScript synchronously using `@danielx/civet.compile`.
    - Transforms the resulting sourcemap's `lines` property into the `SourceMapLinesEntry[]` format.
    - Calls `this.civetLanguageServiceHost.updateCivetFile()` with the compiled TS code and transformed sourcemap lines.
    - This `handleDocumentChange` method is called from `server.ts` during `onDidOpenTextDocument` and `onDidChangeTextDocument`.

The following describes the target operational flow for LSP features (like hover, definition), which Phase 2 will implement within `CivetPlugin.ts`:

.svelte file
  ⬇️
svelte2tsx/index.ts (unchanged for Civet path)
  • Generate TSX code for template and non‐Civet scripts as today

language‐server (in `packages/language-server/src`)
  • On document open/change (Implemented in Phase 1.3 via `CivetPlugin.handleDocumentChange`):
    – Extract `<script lang="civet">` content.
    – Call `@danielx/civet.compile` → TS snippet + Civet→TS `sourcemapLines` (transformed).
    – `typescriptServiceHost.updateCivetFile(uri, tsCode, transformedSourcemapLines)`.

  • On hover/definition/completion for Civet script (To be implemented in Phase 2):
    1. Ensure Civet script is compiled via `handleDocumentChange`.
    2. Map incoming Svelte `Position` → TS snippet position via `forwardMap(sourcemapLines, position)`.
    3. Call `TSService.getQuickInfoAtPosition` or `.getDefinitionAtPosition` on the in‐memory TS file (via the `civetLanguageServiceHost` instance within `CivetPlugin`).
    4. For each result location, map TS snippet `Position` → Svelte `Position` via `remapPosition` (using `sourcemapLines`).

  • On requests outside Civet blocks (template, module script):
    – Fall back to existing TSX output and final V3 map (Svelte→TSX) handled by `SveltePlugin` and `TypeScriptPlugin`.

*Benefits*: perfect one‐token mapping (no braces needed), zero fallback gaps, uses unmodified TypeScript AST and language service behavior, and bypasses brittle post‐hoc map chaining.


### Phase 1: TSService host integration (granular TODOs)

[x] 1.1. Create new directory and file for the host:
    - Path: `packages/language-server/src/typescriptServiceHost.ts`
    - (Ensured `packages/language-server/src/` exists or created it.)

[x] 1.2. Implement `typescriptServiceHost.ts` in `packages/language-server/src/`:
    - Imported `typescript` (TS API) and defined an in-memory file system (via `LanguageServiceHost` methods: `getScriptFileNames`, `getScriptVersion`, `getScriptSnapshot`, `getCurrentDirectory`, `getCompilationSettings`).
    - Wrapped TS `createLanguageService` with a class `CivetLanguageServiceHost` exposing:
        • `updateCivetFile(uri: string, code: string, sourcemapLines: SourceMap['lines']): void`
        • `getQuickInfo(uri: string, tsPosition: Position): QuickInfo`
        • `getDefinitions(uri: string, tsPosition: Position): Definition[]`
        • `getCompletions(uri: string, tsPosition: Position): CompletionList`
    - Internally stores a map of URIs → `{ code, version, sourcemapLines }`.

[x] 1.3. Integrate Civet compile step:
    - In `packages/language-server/src/plugins/civet/CivetPlugin.ts`:
        - Implemented `async handleDocumentChange(document: Document)` method.
        - This method identifies Svelte files with `<script lang="civet">` using `document.scriptInfo` / `moduleScriptInfo` and extracts Civet content via `tagInfo.content`.
        - Calls `@danielx/civet.compile` with `{ js: false, sourceMap: true, inlineMap: false, sync: true, filename: document.uri }` to get TS `code` and `sourceMap.lines`.
        - Transforms `sourceMap.lines` into `SourceMapLinesEntry[]` via `transformCivetSourcemapLines` utility.
            - **CRITICAL TODO (Completed)**: Verify `CivetSourceMapping` interface and 0-based/1-based indexing against actual `@danielx/civet` output.
                - **Finding**: `compileResult.sourceMap.lines` from `@danielx/civet` (with `inlineMap: false`) provides a `number[][][]` structure. This represents an array of generated lines, where each line is an array of segments. Each segment is an array like `[generatedColumn, sourceFileIndex, originalSourceLine, originalSourceColumn, nameIndex?]`.
                - **Indexing**: All line and column numbers in these segments (`originalSourceLine`, `originalSourceColumn`, `generatedColumn`) are 0-indexed. The `generatedLineIndex` (from the outer array) is also 0-indexed.
                - **Action**: `transformCivetSourcemapLines` in `CivetPlugin.ts` was updated to correctly process this `number[][][]` structure. It now converts the 0-indexed lines to 1-indexed lines for `SourceMapLinesEntry` (originalLine, generatedLine) and keeps columns 0-indexed (originalColumn, generatedColumn), aligning with common sourcemap library expectations (e.g., `source-map` package). The placeholder `CivetSourceMapping` interface was removed.
        - Calls `this.civetLanguageServiceHost.updateCivetFile(svelteFileUri, compiledTsCode, transformedSourcemapLines)`.
    - In `packages/language-server/src/server.ts`:
        - Stored `CivetPlugin` instance.
        - In `onDidOpenTextDocument` and `onDidChangeTextDocument` handlers, call `civetPluginInstance.handleDocumentChange(document)`.


[x] 1.4. Write initial unit tests for host in language-server package:
    - Create `packages/language-server/test/typescriptServiceHost.test.mjs` (later renamed to `.ts`).
    - Simulate a minimal Civet snippet, compile, update host, then assert that `getQuickInfo` and `getDefinitions` return expected TS data.
    - Tests verify:
        - Correct updating and retrieval of Civet files (compiled TS + sourcemap lines) via `updateCivetFile` and `getScriptInfo`/`getScriptSnapshot`.
        - `getQuickInfo` returns expected TypeScript data for a variable in compiled Civet code.
        - `getDefinitions` returns correct definition locations for a variable.
        - `getCompletions` returns a list of in-scope identifiers, including variables from the Civet source.
    - Test suite uses a Svelte file URI as the key for the host, mirroring `CivetPlugin`'s intended usage.
    - The `transformCivetSourcemapLines` utility is implicitly tested as part of the successful host operations.

This is a significant step, as it validates the foundational component for providing rich language features for Civet code within Svelte files. The next phase (Phase 2) will involve integrating this host into the CivetPlugin to handle actual LSP requests like hover, definition, and completion by mapping positions between Svelte/Civet and the compiled TypeScript.

### Phase 2: LSP handlers wiring (granular TODOs)

(No changes here yet, describes future work)
2.1. Locate LSP handler file in language-server package:
    - Path: `packages/language-server/src/plugins/civet/CivetPlugin.ts` (target for modifications).

2.2. Replace V3 map delegation in `doHover` within `CivetPlugin.ts`:
    - Instead of `this.hoverProvider.doHover(...)`:
        a) Ensure Civet script is processed: `await this.handleDocumentChange(document)`.
        b) Get `sourcemapLines` from `this.compiledCivetCache` or re-process if needed.
        c) Import `forwardMap` & `remapPosition` (e.g. from `@danielx/civet/ts-diagnostic` - verify availability/structure).
        d) `posTS = forwardMap(sourcemapLines, position)`.
        e) `info = this.civetLanguageServiceHost.getQuickInfo(document.uri, posTS)`.
        f) Convert `info` ranges via `remapPosition` back into Svelte/Civet coords.

2.3. Update `getDefinitions` similarly in `CivetPlugin.ts`.
2.4. Update `getCompletions` similarly in `CivetPlugin.ts`.
2.5. Ensure caching/invalidation in language-server (already partially handled by `handleDocumentChange` version check; TSService itself caches based on script versions from host).

---

### Phase 3: Optimization & resilience (granular TODOs)

(No changes here yet, describes future work)
3.1. Performance benchmark for language-server:
    - Add script `packages/language-server/scripts/bench-tsservice.mjs`:
        • Measure time for `getQuickInfo` and `getDefinition` on a large Civet snippet.
        • Log mean and p95 latencies.

3.2. Timeout & fallback in language-server handlers:
    - In LSP handlers wrap TSService calls in a `Promise.race` with a timeout (e.g. 200 ms).
    - On timeout or error, fallback to original V3 sourcemap logic in `svelte2tsx/index.ts`.
    - Emit a warning to LSP client for diagnostic.

3.3. End-to-end tests in language-server package:
    - Create `packages/language-server/test/lsp-e2e-civet.test.mjs`:
        • Spin up the LSP server in-process against a real Svelte file containing various Civet patterns.
        • Drive hover and definition requests via VSCode's LSP test harness or plain JSON-RPC.
        • Assert correct hover text and definition positions for:
            - Single-word assignments
            - Unbraced `if`/`else`
            - Nested/indented branches

> **Note**: Only the Civet `<script>` LSP code in the `language-server` package is replaced—existing Svelte2TSX compilation for non-Civet scripts remains untouched.
