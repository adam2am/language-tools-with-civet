# Final Verified TypeScript and Civet Integration Flow in Svelte Language Server

## I. Overview of Standard TypeScript Integration (`<script lang="ts">`)

The Svelte Language Server processes `.svelte` files with TypeScript (`<script lang="ts">`) through a multi-stage pipeline:

1.  **Initial Parsing & Document Creation**:
    *   `packages/language-server/src/lib/documents/parseHtml.ts`: Uses `vscode-html-languageservice` to parse the `.svelte` file's HTML structure, identifying tags and attributes.
    *   `packages/language-server/src/lib/documents/Document.ts`: Represents the Svelte file in memory, providing access to its content, script tags (instance/module), and their attributes (e.g., `lang="ts"`).
    *   `packages/language-server/src/lib/documents/utils.ts`: Contains utilities for script extraction and position mapping.

2.  **Svelte Preprocessing (Project-Defined)**:
    *   `packages/language-server/src/lib/documents/configLoader.ts`: Discovers and loads Svelte preprocessors defined in the project's `svelte.config.js`.
    *   `packages/language-server/src/plugins/svelte/SvelteDocument.ts`: Applies any configured Svelte preprocessors to the document content.
        *   **Note on `svelte-preprocess-with-civet-Repo`**: If the project uses `svelte-preprocess-with-civet-Repo` (found within this workspace), its `src/processors/typescript.ts` can act as a Svelte preprocessor for `lang="typescript"` scripts, transforming them before they reach `svelte2tsx`. This step is project configuration dependent.

3.  **Snapshot Generation for TypeScript Service**:
    *   `packages/language-server/src/plugins/typescript/utils.ts` -> `getScriptKindFromAttributes()`: Identifies `lang="ts"` and maps it to `ts.ScriptKind.TSX`, signaling to the TypeScript service how to interpret the upcoming code.
    *   `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts`:
        *   The `fromDocument()` method is key. It calls `preprocessSvelteFile()`.
        *   `preprocessSvelteFile()` is responsible for taking the (potentially Svelte-preprocessed) Svelte document content and preparing it for the TypeScript language service. This primarily involves using `svelte2tsx`.

4.  **Core Transformation: Svelte to TSX**:
    *   `packages/svelte2tsx/src/svelte2tsx/index.ts`: This is the core engine that converts Svelte file content into TSX.
        *   It handles `<script>` (instance and module) and template sections.
        *   The script content (already TypeScript if `lang="ts"`) is embedded into a TSX structure.
        *   It generates source maps for this transformation (Svelte JS/TS -> TSX).

5.  **TypeScript Language Service Interaction**:
    *   `packages/language-server/src/plugins/typescript/service.ts`: Manages instances of the TypeScript language service (`ts.LanguageService`).
    *   `packages/language-server/src/plugins/typescript/SnapshotManager.ts`: Provides the TSX snapshots (from `DocumentSnapshot` via `svelte2tsx`) to the TS service.
    *   `packages/language-server/src/plugins/typescript/LSAndTSDocResolver.ts`: Acts as a bridge, fetching the appropriate TS service instance and `DocumentSnapshot` for a given Svelte document when a language feature is requested.

6.  **Language Feature Provision**:
    *   `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts`: The central plugin that implements LSP handlers for various features (diagnostics, hover, completion, definition, etc.).
    *   It delegates to specialized providers in `packages/language-server/src/plugins/typescript/features/`:
        *   `DiagnosticsProvider.ts`: Fetches diagnostics from the TS service.
        *   `HoverProvider.ts`: Gets hover information.
        *   `CompletionProvider.ts`: Provides completions.
        *   And others for definitions, references, etc.
    *   These providers use the source maps (from `svelte2tsx` and potentially earlier Svelte preprocessors) to map results from the TSX back to the original `.svelte` file locations.

7.  **Svelte-Specific Enhancements**:
    *   `packages/language-server/src/plugins/svelte/SveltePlugin.ts`: Provides Svelte-specific language features that go beyond what the TypeScript plugin offers (e.g., template-specific completions, Svelte-specific diagnostics).

## II. Current Civet Integration (`<script lang="civet">`) - Verified Flow & Status

The integration of Civet into this pipeline has several key touchpoints and relies on a combination of Svelte preprocessing and direct handling within `svelte2tsx`.

1.  **Syntax Highlighting**:
    *   `packages/svelte-vscode/syntaxes/civet.tmLanguage.json`: Provides the TextMate grammar for Civet syntax.
    *   `packages/svelte-vscode/syntaxes/svelte.tmLanguage.src.yaml`: Injects the Civet grammar into `<script lang="civet">` blocks within `.svelte` files. (This part is functioning for visual syntax highlighting).

2.  **Svelte Preprocessing (Primary Civet Compilation via `svelte-preprocess-with-civet-Repo`)**:
    *   If the project's `svelte.config.js` is configured to use the Civet preprocessor from `svelte-preprocess-with-civet-Repo` (located within this workspace):
        *   `svelte-preprocess-with-civet-Repo/src/processors/civet.ts`: This Svelte preprocessor is invoked.
        *   It uses `../transformers/civet` (which in turn would use `@danielx/civet`) to compile the Civet code within `<script lang="civet">` tags.
        *   **Expected Outcome**: The Civet code is transformed into JavaScript or TypeScript, and a source map (Civet -> JS/TS) is generated. The `lang` attribute of the script tag *might* be changed by this preprocessor (e.g., to `ts`). This is the primary intended path for Civet compilation at build time and should ideally be leveraged by the language server.

3.  **Snapshot Generation & `getScriptKindFromAttributes`**:
    *   `packages/language-server/src/plugins/typescript/utils.ts` -> `getScriptKindFromAttributes()`: This function has been updated to recognize `lang="civet"` and map it to `ts.ScriptKind.TSX`. This tells the TypeScript service to expect TSX-like input eventually, even if the script initially contains Civet.

4.  **`svelte2tsx` Direct Civet Handling (Secondary/Fallback Compilation)**:
    *   `packages/svelte2tsx/src/svelte2tsx/index.ts`: Contains explicit logic to handle `<script lang="civet">` for both instance and module scripts.
        *   If it encounters a script tag with `lang="civet"` (implying either the Svelte preprocessor from `svelte-preprocess-with-civet-Repo` didn't run, or it ran but didn't change the `lang` attribute):
            *   It attempts to dynamically `import('@danielx/civet')`.
            *   If successful, it calls `civetModule.compile()` on the Civet code (with `js: false` to output TypeScript).
            *   It then overwrites the original Civet code within its internal `MagicString` representation with this compiled TypeScript.
        *   **Source Maps**: This step should ideally also generate or handle source maps (Civet -> TS within `svelte2tsx`'s context).
        *   The rest of `svelte2tsx` then proceeds, treating this compiled TypeScript as the script content to be embedded in the final TSX.

5.  **TypeScript Language Service Interaction**:
    *   The TSX generated by `svelte2tsx` (containing TypeScript derived from Civet) is fed to the TypeScript language service as described in the standard TypeScript flow.

6.  **Language Feature Provision & Civet-Specific Adjustments**:
    *   `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts` interacts with `DiagnosticsProvider.ts`.
    *   `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts`:
        *   When `TypeScriptPlugin.getDiagnostics()` is called for a document where `document.getLanguageAttribute('script') === 'civet'`, an `isCivet` flag is passed.
        *   `DiagnosticsProvider.getDiagnostics()` then uses `filterCivetDiagnostics()` to process the raw TypeScript diagnostics.
        *   `filterCivetDiagnostics()`: This function currently allows only module import errors (TS2306, TS2307) and attempts to filter out common TS errors that arise from valid Civet syntax (like `:=` assignments being misinterpreted by TS before Civet compilation).
    *   **Source Map Chaining is CRITICAL**: For accurate hover, go-to-definition, and diagnostics, the source maps from potentially two stages of Civet compilation (Svelte preprocessor: Civet -> JS/TS; then `svelte2tsx`: Civet -> TS if it re-compiles) plus the `svelte2tsx` (JS/TS -> TSX) map must be correctly chained and applied.

7.  **`CivetPlugin.ts` Status**:
    *   `packages/language-server/src/plugins/civet/CivetPlugin.ts`: This plugin is registered but is currently a placeholder. It returns empty results for all its implemented language feature methods (diagnostics, hover, completions, etc.). It does **not** currently provide any direct language intelligence for Civet.

8. **Snapshot Source Map Chaining & Validation**:
    *   `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts` now accepts a `preprocessorMapper` (Civet→TS map) and chains it with the TS→TSX map using `ConsumerDocumentMapper` (with `nrPrependedLines = 0`).
    *   A dedicated unit test (`packages/language-server/test/civet-chain.test.ts`) verifies end-to-end mapping for a sample Civet snippet, confirming positions in the TSX output map back correctly to original Civet lines and columns.
    *   This test ensures that `snapshot.getOriginalPosition` recovers `{ line: 0, column: 0 }` for the declaration and `{ line: 1, column: 0 }` for subsequent statements in Civet.

## III. Key Considerations for Full Civet IDE Support:

*   **Unified Civet Compilation Strategy**: Clarify whether the `svelte-preprocess-with-civet-Repo` preprocessor is the sole intended Civet-to-JS/TS compiler, or if `svelte2tsx`'s internal compilation is a necessary fallback. Redundant compilation could lead to inefficiencies or conflicting source maps. Ideally, the Svelte preprocessor handles Civet compilation, and `svelte2tsx` consumes its TypeScript output.
*   **Source Map Integrity**: End-to-end source map accuracy is paramount. If `svelte-preprocess-with-civet-Repo` compiles Civet to TS, its source map must be consumed by `SvelteDocument.ts` and then chained with the source map generated by `svelte2tsx` when it converts the (now TS) Svelte file to TSX. The `DocumentMapper` chain in `DocumentSnapshot.ts` is where this would be handled.
*   **`filterCivetDiagnostics` Enhancement**: While filtering helps reduce noise, it's a workaround. True support requires the TS service to see valid TypeScript post-Civet compilation, with source maps pointing errors back to the original Civet. The current filter might hide legitimate type errors if they don't match the allowed codes.
*   **Activating `CivetPlugin.ts`**: For Civet-specific language features (e.g., understanding Civet's unique syntax for completions or hover beyond what transpiled TS offers), `CivetPlugin.ts` would need to be implemented, potentially by interacting with the Civet compiler directly for AST analysis.
*   **Hover and Go-To-Definition**: These rely heavily on accurate source mapping and the TS service understanding the types in the (transpiled) Civet code. For Civet-specific constructs like `:=` (const) or `.`= (let), the hover information should reflect these Civet semantics, not just the underlying JavaScript/TypeScript. This means the type information from the TS service must be correctly mapped and potentially augmented.

## IV. Path to Full Civet IDE Integration: A Phased Checklist

**Overall Goal for Civet Integration:**

Provide a seamless development experience for Civet in Svelte components, including:
1.  Accurate syntax highlighting (mostly done).
2.  Reliable Civet-to-TypeScript compilation, primarily handled by the Svelte preprocessor.
3.  Precise source mapping from Civet -> TypeScript -> TSX, enabling accurate:
    *   Diagnostics (errors/warnings pointing to original Civet code).
    *   Hover information (showing types from TS, eventually Civet-specific info).
    *   Go-to-definition.
    *   Completions (initially TS-based, eventually Civet-aware).
    *   Other LSP features (references, rename, etc.).
4.  Minimize redundant Civet compilation.
5.  Eventually, offer Civet-specific language features beyond what transpiled TypeScript can provide.

**Success Criteria:**

*   A user writing `<script lang="civet"> const foo := "bar" </script>` should see correct syntax highlighting.
*   Hovering over `foo` should (eventually) show its type as `const foo: "bar"`.
*   If there\'s a type error in Civet that translates to a TS error (e.g., assigning a number to `foo`), the error should appear on the Civet code.
*   Go-to-definition on a Civet variable/function should work.
*   Completions should work based on the transpiled TypeScript.

---

### Phase 1: Solidify and Unify Civet Compilation & Source Mapping

- [X] **Macro Task:** Ensure a single, reliable Civet-to-TypeScript compilation step with accurate source map generation that integrates seamlessly into the existing Svelte language server pipeline. *(svelte-preprocess-with-civet now correctly generates V3 source maps. Next step is integration with LS and svelte2tsx.)*
    - [X] **Micro Task 1.1: Designate Primary Civet Compiler & Ensure Quality Output**
        - [X] **Decision & Action:** Solidify `svelte-preprocess-with-civet-Repo`\\\'s Civet preprocessor (invoking `@danielx/civet`) as the **primary and sole** Civet-to-TypeScript compiler for the language server. *(Achieved by modifying its transformer)*
        - [X] **Verification**: Confirm its transformer (`svelte-preprocess-with-civet-Repo/src/transformers/civet.ts`) correctly uses `@danielx/civet` to:
            - [X] Compile Civet to modern, type-inferable TypeScript (e.g., `foo := 1` becomes `const foo = 1;`). *(Verified by testPreProcTest.mjs output)*
            - [X] Produce accurate V3 source maps (Civet -> TypeScript) as a standard object. *(Verified by testPreProcTest.mjs output, the preprocessor calls `.json()` on Civet's sourceMap instance, and `result.map` is a V3 map object with version, sources, mappings keys.)*
            - [X] **Crucial:** Ensure the preprocessor **changes the script tag\'s `lang` attribute to `ts`** after successful compilation. This signals to downstream tools like `svelte2tsx` that the content is now TypeScript. *(Achieved: The transformer in `svelte-preprocess-with-civet/src/transformers/civet.ts` was updated to receive `attributes` and now wraps the compiled TS code with `<script lang="ts">` if `attributes.lang === 'civet'`. Verified with `testPreProcTest.mjs`.)*
        - [ ] **Files to Edit (Cleanup & Fallback Definition):**
            - [ ] `packages/svelte2tsx/src/svelte2tsx/index.ts`:
                - Modify the direct Civet compilation logic (dynamic import of `@danielx/civet`) to act **only as a fallback** if `lang="civet"` is encountered (meaning the preprocessor likely didn\'t run or failed to change the `lang` attribute).
                - This fallback path should be minimized/deprecated in favor of the preprocessor handling compilation.
                - If the fallback *is* used, ensure it also handles source maps correctly (Civet -> TS within `svelte2tsx`).

    - [X] **Micro Task 1.2: Ensure Svelte Preprocessor Output (Code & Map) is Consumed**
        - [X] **Verification:** Trace the output of the `svelte-preprocess-with-civet-Repo` preprocessor.
            - [X] Confirm `packages/language-server/src/plugins/svelte/SvelteDocument.ts` correctly receives and stores both the compiled TypeScript code and the Civet-to-TypeScript source map when the `lang` attribute has been changed to `ts` by the preprocessor. *(Achieved: Analysis of `SvelteDocument.ts` (specifically `TranspiledSvelteDocument.create`) shows it receives the `preprocessed.code` - which is now `<script lang="ts">...</script>` - and `preprocessed.map` - our Civet-to-TS V3 map. This map is then used to instantiate a `SourceMapDocumentMapper` within the `TranspiledSvelteDocument` instance.)*
            - [X] Ensure `SvelteDocument` (or `TranspiledSvelteDocument`) makes this source map available for `DocumentSnapshot`. *(Achieved: The `TranspiledSvelteDocument` instance, accessible via `SvelteDocument.getTranspiled()`, contains the `SourceMapDocumentMapper` (as `this.mapper`), which holds our Civet-to-TS map. This `mapper` is used by its `getOriginalPosition` and `getGeneratedPosition` methods, making the map effectively available.)*

    - [ ] **Micro Task 1.3: Implement Robust Source Map Chaining**
        - **Overview:** Chain the Civet→TS map (Map_A) from the Svelte preprocessor with the TS→TSX map (Map_B) from `svelte2tsx`, so language features map back correctly to original Civet code.
        - **Files & Steps:**
            1. [X] Modify `preprocessSvelteFile` in `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts`:
                - Use the preprocessor's output (`ITranspiledSvelteDocument`) instead of `document.getText()`.
                - Call `svelte2tsx(preprocessedText, …)` on `preprocessedResult.getText()`.
                - Return both `tsxMap` (Map_B) and `preprocessorMapper` (Map_A) in the output object.
            2. [X] Update `DocumentSnapshot.fromDocument` signature to:
                - Call `svelteDocument.getCachedTranspiledDoc()` synchronously to obtain `preprocessedResult`.
                - Pass `preprocessorMapper` into the `SvelteDocumentSnapshot` constructor alongside `tsxMap`.
            3. [X] Extend `SvelteDocumentSnapshot` constructor in `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts`:
                - Accept `preprocessorMapper?: DocumentMapper` and store it as a private field.
            4. [X] Rewrite `SvelteDocumentSnapshot.initMapper()`:
                - If `tsxMap` is absent, return `preprocessorMapper` or `new IdentityMapper(url)`.
                - If `tsxMap` exists, return a `SourceMapDocumentMapper` chaining TS→TSX map onto Civet→TS map:
                    ```ts
                    return new SourceMapDocumentMapper(
                      new TraceMap(tsxMap),
                      this.url,
                      preprocessorMapper // parent map
                    );
                    ```
            5. [X] Modify `ConsumerDocumentMapper` in `packages/language-server/src/plugins/typescript/DocumentMapper.ts`:
                - Add an optional `parent?: DocumentMapper` parameter to its constructor.
                - Pass `parent` to `super(traceMap, sourceUri, parent)` to enable nested mapping.
            6. [ ] Write unit tests for chaining:
                - Create a mock Civet-preprocessor output with a known map (Map_A).
                - Feed it through `DocumentSnapshot` to produce a snapshot with chained maps.
                - Verify `getOriginalPosition` / `getGeneratedPosition`

    - [ ] **Micro Task 1.4: Integrate Chained Mapper into Language Server Pipeline**
            1. [ ] Ensure `DocumentSnapshot.initMapper()` uses the chained `ConsumerDocumentMapper` (with `preprocessorMapper` as parent) by default.
            2. [ ] Update `preprocessSvelteFile` to synchronously supply both `tsxMap` and `preprocessorMapper` to snapshots.
            3. [ ] Write integration tests in `packages/language-server/test/` to verify hover, definition, and diagnostics for Civet code.
            4. [ ] Confirm that language features correctly map back to the original Civet source positions.

### Phase 2: Integrate Civet Features into the Main Svelte/TS Pipeline

- [ ] Micro Task 2.1: Refactor CivetHoverProvider (and upcoming CivetDiagnosticsProvider) to use the existing LSAndTSDocResolver
    * Problem: CivetHoverProvider.ts currently sets up its own ts.LanguageService and a simplified SvelteDocumentSnapshot, bypassing the main language server pipeline.
    * Solution: Modify `CivetPlugin.ts` to accept an `LSAndTSDocResolver` instance and pass it into `CivetHoverProvider` (and later `CivetDiagnosticsProvider`); update providers to use `resolver.getLSAndTSDoc(document)` and the canonical TS service instead of manual setup.
    * Files to Edit:
        - `packages/language-server/src/plugins/civet/CivetPlugin.ts`
        - `packages/language-server/src/plugins/civet/features/CivetHoverProvider.ts`
        - (Later) `packages/language-server/src/plugins/civet/features/CivetDiagnosticsProvider.ts`

- [ ] Micro Task 2.2: Ensure `DocumentSnapshot.ts` Handles Civet Path Correctly for LSAndTSDocResolver
    * Context: `preprocessSvelteFile` currently returns early for `<script lang="civet">`, skipping the full Svelte→TSX transform.
    * Problem: The language server snapshot lacks template processing, so hover/diagnostics spanning template and script will not work.
    * Solution: In `preprocessSvelteFile`, after generating the Civet-to-TS snippet and its source map, inject that TS snippet back into the complete Svelte file text (with `lang="ts"`), then run `svelte2tsx` so the TSX includes both template and script.
    * Files to Edit:
        - `packages/language-server/src/plugins/typescript/DocumentSnapshot.ts`

- [ ] Micro Task 2.3: Create `CivetDiagnosticsProvider.ts`
    * Action: Implement diagnostics for Civet scripts by leveraging `LSAndTSDocResolver`:
        1. Use `resolver.getLSAndTSDoc(document)` to obtain `{ lang, tsDoc }`.
        2. Call `lang.getSyntacticDiagnostics(tsDoc.filePath)` and `lang.getSemanticDiagnostics(tsDoc.filePath)`.
        3. Map each diagnostic's text span back to the original Civet code via `tsDoc.getOriginalPosition`.
    * Files to Create/Edit:
        - `packages/language-server/src/plugins/civet/features/CivetDiagnosticsProvider.ts` (new)
        - `packages/language-server/src/plugins/civet/CivetPlugin.ts` (instantiate and delegate)

- [ ] Micro Task 2.4: Fix Failing Tests & Add More
    * Action: Re-run `civet-diagnostics.spec.ts` and `civet-hover.spec.ts`; with the above refactors, they should pass. Investigate any remaining mismatches in source-map mappings or position offsets. Expand tests to cover:
        - Variables, functions, and types declared in Civet scripts.
        - Interactions between template expressions and Civet-defined identifiers.
    * Files to Edit:
        - `packages/language-server/test/plugins/typescript/features/civet-features/civet-diagnostics.spec.ts`
        - `packages/language-server/test/plugins/typescript/features/civet-features/civet-hover.spec.ts`