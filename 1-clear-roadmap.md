# Main Idea
**Runtime Civet in Svelte is working perfectly** via `svelte-preprocessor-with-civet`.
Our **sole focus** in this project is to achieve **full IDE recognition for Civet within `<script lang="civet">` blocks in `.svelte` files.**

This means:
-   The IDE (VS Code/Cursor IDE, etc.) must understand Civet syntax inside these script tags.
-   Language features like **TypeScript-aware hover information, go-to-definition, auto-completions, diagnostics (error reporting), and type inference** must work correctly for Civet code, as they do for JavaScript or TypeScript in Svelte files.
-   Essentially, we want to bridge the gap where runtime compilation is fine, but IDE tooling lacks understanding of Civet in the Svelte context.

This project aims to modify the Svelte Language Tools (`language-tools`) to provide this missing IDE support, ensuring a seamless development experience.

# Current State
What's already been done:
- TextMate grammar configuration has been updated to include Civet language support in script tags
- Package configuration has been updated to include Civet in embeddedLanguages
- ✅ Real Civet grammar has been copied into `packages/svelte-vscode/syntaxes/civet.tmLanguage.json`
- ✅ Dummy Civet grammar has been removed from `packages/svelte-vscode/test/grammar/dummy`
- ✅ Civet injection patterns in `svelte.tmLanguage.src.yaml` have been verified as correct
- ✅ Created `packages/svelte-vscode/test/grammar/samples/script-civet/input.svelte` test sample
- ✅ Grammar build and tests passed in `packages/svelte-vscode`
- ✅ Basic Language Server integration has been implemented
- ✅ Syntax highlighting for Civet in Svelte files is working correctly

Current issues:
- ✅ Syntax highlighting and parsing errors are correctly shown for Civet code
- ❌ TypeScript type checking for dynamic imports and module resolution in Civet code is currently disabled (no "Cannot find module" errors)
- ❌ Language-service features like hover, go-to-definition, and type inference for variables in Civet code currently do not work (variables hover as any, navigation fails)

**Next Priority:** Enable TypeScript diagnostics for module imports in Civet code without reintroducing JS/TS syntax errors for Civet constructs

# Immediate Implementation Plan

## Task: Re-enable TypeScript type checking for module imports in Civet code

### Current Status
Currently, the TypeScript plugin completely skips diagnostics for Civet script blocks with this code in `TypeScriptPlugin.ts`:
```typescript
// Skip TS diagnostics for Civet script blocks
if (document.getLanguageAttribute('script') === 'civet') {
    return [];
}
```

This prevents TypeScript from reporting any errors in Civet code, including useful ones like "Cannot find module" errors for imports.

### Implementation Steps

1. **Modify TypeScriptPlugin.getDiagnostics()**
   - File: `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts`
   - Change: Instead of completely skipping Civet files, pass them to the diagnostics provider with a flag indicating they're Civet files
   - Code:
     ```typescript
     async getDiagnostics(document: Document, cancellationToken?: CancellationToken): Promise<Diagnostic[]> {
         if (!this.featureEnabled('diagnostics')) {
             return [];
         }

         // For Civet files, get diagnostics but filter them to only include module import errors
         const isCivet = document.getLanguageAttribute('script') === 'civet';
         return this.diagnosticsProvider.getDiagnostics(document, cancellationToken, isCivet);
     }
     ```

2. **Add filterCivetDiagnostics() function**
   - File: `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts`
   - Add: A function that filters TypeScript diagnostics to only keep module resolution diagnostics (code 2307: Cannot find module 'x')
   - Code:
     ```typescript
     function filterCivetDiagnostics(diagnostics: ts.Diagnostic[]): ts.Diagnostic[] {
         // Keep only module resolution diagnostics (code 2307: Cannot find module 'X'
         // or code 2306: File 'X' is not a module)
         return diagnostics.filter(diag =>
             diag.code === 2307 || // Cannot find module 'X'
             diag.code === 2306    // File 'X' is not a module
         );
     }
     ```

3. **Update DiagnosticsProvider.getDiagnostics()**
   - File: `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts`
   - Change: Modify to accept the isCivet flag and filter diagnostics accordingly
   - Code:
     ```typescript
     async getDiagnostics(
         document: Document,
         cancellationToken?: CancellationToken,
         isCivet?: boolean
     ): Promise<Diagnostic[]> {
         // Existing code...

         let diagnostics: ts.Diagnostic[] = lang.getSyntacticDiagnostics(tsDoc.filePath);
         const checkers = [lang.getSuggestionDiagnostics, lang.getSemanticDiagnostics];

         for (const checker of checkers) {
             // Existing code...
             diagnostics.push(...checker.call(lang, tsDoc.filePath));
         }

         // Filter diagnostics for Civet files to only include module import errors
         if (isCivet) {
             diagnostics = filterCivetDiagnostics(diagnostics);
         }

         // Rest of existing code...
     }
     ```

4. **Test with sample Civet code**
   - Create a test file with valid Civet syntax but invalid imports
   - Verify that only module import errors are reported
   - Ensure that Civet-specific syntax doesn't trigger TypeScript errors

# Implementation Tree

## Phase 1: Complete TextMate Grammar Integration

### 1.1 Replace Dummy Civet Grammar with Real Implementation
- [x] Copy the real Civet TextMate grammar `civet.json` from `civet-syntax/syntaxes` into `packages/svelte-vscode/syntaxes/civet.tmLanguage.json`
- [x] (Optionally) copy supporting files like `civet-configuration.json` or `codeblock.json` as needed
- [x] Remove the dummy Civet grammar `packages/svelte-vscode/test/grammar/dummy/civet.tmLanguage-dummy.json`
- [x] Ensure the grammar's `scopeName` is `source.civet` and that it correctly tokenizes Civet constructs per the cheatsheet

### 1.2 Update Svelte Grammar to Properly Handle Civet
- [x] Ensure the Civet injection pattern is correctly configured
- [x] Verify the pattern `'L:meta.script.svelte meta.lang.civet - (meta source)'` works correctly
- [x] Add any additional patterns needed for Civet-specific features in Svelte context

### 1.3 Create Test Samples for Civet in Svelte
- [x] Create test samples with `<script lang="civet">` content
- [x] Include various Civet syntax features to test grammar highlighting
- [x] Ensure test snapshots are generated and verified

### 1.4 Build and Test Grammar Changes
- [x] Run `pnpm run build:grammar` in `packages/svelte-vscode`
- [x] Run `pnpm run test` to verify grammar tests pass

## Phase 2: Language Server Integration

### 2.1 Update Language Server Configuration
- [x] Add Civet configuration to the language server config
- [x] Add a new `civet` section to the `LSConfig` interface
- [x] Add default configuration values for Civet

### 2.2 Create Civet Language Service
- [x] Create a plugin for Civet language support
- [x] Implement a service similar to TypeScript/JavaScript services
- [x] Handle language features like diagnostics, hover, completions

### 2.3 Register Civet Plugin in Plugin Host
- [x] Register the Civet plugin in the plugin host
- [x] Add Civet plugin to the exported plugins
- [x] Register the plugin in the server initialization

### 2.4 Evaluate Civet Dependencies
- [x] Determine if direct Civet dependencies are needed in the language server
- [x] Document why no parser dependency is required: Civet parsing is handled by the external VSCode Civet extension and `svelte-preprocessor-with-civet`; the language server operates on TSX output
- [ ] If needed, add Civet as a dependency in `packages/language-server/package.json`

## Phase 3: Enabling Full IDE Language Features for Civet in Svelte

This crucial phase is entirely focused on making the IDE fully understand Civet code within `<script lang="civet">` tags. The goal is to provide a rich development experience with features like TypeScript-aware autocompletion, hover information, go-to-definition, and accurate diagnostics. This involves ensuring the Civet code is correctly preprocessed to JavaScript/TypeScript within the language server, that `svelte2tsx` can then convert this to TSX, and that all source mapping is accurate to enable these IDE features to point back to the original Civet source.

### 3.1 Civet Preprocessor Integration with Language Server
   - [x] **Investigate `configLoader` for Preprocessor Discovery:** Confirm how the language server's `configLoader` discovers and utilizes project-defined Svelte preprocessors from `svelte.config.js`.
   - [x] **Ensure Civet Preprocessor Loading:** Verify and ensure the `configLoader` can correctly identify and load `svelte-preprocessor-with-civet` (or any compatible Civet preprocessor specified in the project's Svelte configuration).
   - [x] **Update Document Handling for Civet Scripts:** `packages/language-server/src/lib/documents/Document.ts` and `utils.ts` correctly identify `<script lang="civet">` blocks and their attributes, making the raw Civet content available. No changes were needed as existing logic is generic.

### 3.2 Verify Main Svelte Preprocessing Pipeline for Civet and `svelte2tsx` Consumption

**Reasoning & Context:**
The Svelte Language Server, primarily through `packages/language-server/src/plugins/svelte/SvelteDocument.ts`, already employs `svelte/compiler`'s `preprocess` function. This function is designed to apply all project-defined preprocessors (listed in `svelte.config.js`, which is loaded by `packages/language-server/src/lib/documents/configLoader.ts`) to the entire Svelte file content. This is the standard and robust Svelte tooling approach.

Therefore, `svelte-preprocessor-with-civet` (when configured by the user) should be automatically invoked as part of this existing main Svelte preprocessing pipeline. The output of this pipeline (Svelte code where Civet has been transformed to JavaScript/TypeScript and the `lang` attribute likely updated) is then passed to `svelte2tsx`.

`svelte2tsx`'s role is to convert this already JS/TS-ified Svelte component structure into TSX for the TypeScript Language Service. It should not need to implement its own Civet (or other language-specific) preprocessor invocation logic.

**Current Status (Based on Logs and Isolated Tests):**
✅ The logs confirm that the Svelte Language Server is correctly identifying and invoking the script preprocessor for Civet code.
✅ Isolated tests (e.g., `testPreProcTest.mjs`) confirm that `svelte-preprocessor-with-civet` *can* correctly transpile the problematic Civet class syntax to JavaScript when called directly with appropriate content and attributes.
✅ Direct tests with `@danielx/civet` also confirm its capability to compile this syntax.

❌ **The Discrepancy:** Despite the above, when `svelte-preprocessor-with-civet` is invoked by the Svelte Language Server's internal preprocessing pipeline (via `svelte/compiler`'s `preprocess` function), it *fails* to transform these specific Civet class syntaxes:
    - The output code from the preprocessor (within the LS context) still contains the original Civet.
    - The preprocessed code (within the LS context) maintains `lang="civet"`.

- **New Root Cause Hypothesis:** The issue is **not** an inherent limitation in `@danielx/civet` or `svelte-preprocessor-with-civet` for this syntax. Instead, the problem likely lies in:
    -   The specific options, arguments, or environment provided to `svelte-preprocessor-with-civet` when it's invoked *by the Svelte Language Server's pipeline* (managed by `SvelteDocument.ts` and `svelte/compiler`).
    -   Differences in how the preprocessor behaves or is configured/initialized within the LS context versus standalone test scripts.
    -   The `svelte.config.js` loaded by the language server might differ or its preprocessor options for Civet might not be correctly interpreted/passed through the chain for these complex cases.
- ✅ Simpler Civet syntax (without these problematic class constructs) *is* correctly transpiled to JavaScript by `svelte-preprocessor-with-civet` *both* in isolated tests and (apparently) within the LS pipeline.

**Key Files & Dependencies for this Phase:**
*   `packages/language-server/src/plugins/svelte/SvelteDocument.ts`: Orchestrates the call to `document.compiler.preprocess`. This is where the primary Svelte preprocessing happens.
*   `packages/language-server/src/lib/documents/configLoader.ts`: Loads `svelte.config.js`, making preprocessor definitions available to `SvelteDocument.ts`.
*   `svelte/compiler` (external dependency): Its `preprocess` function is the core engine that runs all configured preprocessors.
*   `svelte-preprocessor-with-civet` (user project dependency): The actual Civet preprocessor that needs to be invoked by the `svelte/compiler::preprocess` step.
*   `packages/svelte2tsx/src/svelte2tsx/index.ts`: Consumes the output of the main preprocessing pipeline. Its script `lang` attribute recognition logic will help verify the pipeline's behavior.

**Tasks:**
*   [x] **Verify `svelte-preprocessor-with-civet` Invocation in Main Pipeline:**
    *   ✅ **Confirmed:** The logs show that the script preprocessor is being called with the correct language and attributes.
    *   ⚠️ **Sharpened Issue:** The preprocessor is invoked by the LS, but for certain class syntaxes, it does not return the expected JavaScript output, *even though isolated tests show it is capable of doing so*. This points to a discrepancy in how the preprocessor is used or behaves within the LS pipeline versus direct invocation.

*   [ ] **Debug the Svelte Language Server's Preprocessing Pipeline for Civet:**
    *   **Investigate Invocation Differences:**
        - Focus on `packages/language-server/src/plugins/svelte/SvelteDocument.ts` and its use of `svelte/compiler`'s `preprocess`.
        - Determine the exact content, filename, and attributes being passed to `svelte-preprocessor-with-civet` from within this pipeline for the problematic syntax.
        - Compare these with the successful invocation in `testPreProcTest.mjs`. Are there subtle differences in the `content` string (e.g., whitespace, newlines)? Are all necessary `attributes` (like `lang="civet"`) correctly passed and received?
        - Verify the options from `svelte.config.js` (loaded by `configLoader.ts`) are correctly reaching `svelte-preprocessor-with-civet` within the LS context.
    *   **Check `svelte-preprocessor-with-civet` Behavior In-LS-Context:**
        - If possible, add more detailed logging within `svelte-preprocessor-with-civet` (or a patched version) to see the options it receives and the exact input/output when run by the LS.
    *   ✅ **Key Test Insights (Direct `@danielx/civet` test, and `testPreProcTest.mjs` for `svelte-preprocessor-with-civet`):**
        - Direct tests show `@danielx/civet` *can* compile the class syntax in question.
        - Crucially, `testPreProcTest.mjs` shows `svelte-preprocessor-with-civet` *can also* correctly transpile this syntax when invoked directly. This strongly suggests the preprocessor itself is not faulty for this syntax.
        - The discrepancy arises when this preprocessor is invoked *within the Svelte Language Server's pipeline*.
    *   **Compare Configurations:** Review `svelte.config.js` and how it's loaded/interpreted by the LS via `configLoader.ts` vs. any setup in test scripts.

*   [ ] **Implement a Solution Based on Findings:**
    *   **Option 1 - Rectify LS Preprocessing Invocation/Context:**
        - Adjust how `SvelteDocument.ts` or `svelte/compiler`'s `preprocess` function passes data/options to `svelte-preprocessor-with-civet` to ensure it behaves as it does in isolated tests.
        - This might involve ensuring the correct preprocessor options from `svelte.config.js` are consistently applied for Civet.
        - If `svelte-preprocessor-with-civet` requires a specific environment or input format subtly different from what the LS pipeline provides, adapt the LS pipeline or the preprocessor.

*   [ ] **Ensure `svelte2tsx` Correctly Consumes Preprocessed JS/TS Output:**
    *   Once the preprocessor is correctly transforming Civet code, confirm that `svelte2tsx` processes the JavaScript/TypeScript output without errors.
    *   The `isTsFile` logic and general script handling within `svelte2tsx` should operate correctly based on the updated `lang` attribute it receives.

*   [ ] **Investigate and Validate End-to-End Source Map Chaining:**
    *   **Importance:** This is critical for all IDE language features (diagnostics, hover, go-to-definition, debugging) to map accurately from the analyzed TSX back to the original Civet source code.
    *   **Chain of Maps:**
        1.  `svelte-preprocessor-with-civet` should produce a source map (Civet -> JS/TS).
        2.  `svelte/compiler::preprocess` should combine maps if multiple preprocessors run. The `preprocessed.map` given to `SvelteDocument` should represent this combined map.
        3.  `SvelteDocument`'s `SourceMapDocumentMapper` uses this `preprocessed.map` to map between the original Svelte file (with Civet) and the fully preprocessed Svelte file (with JS/TS).
        4.  `svelte2tsx` then generates its own source map (preprocessed Svelte with JS/TS -> TSX).
    *   **Validation:** Test IDE features to ensure they point to the correct locations in the original Civet code. This involves checking how the language server combines or uses these two stages of source maps.

### 3.3 Refine Diagnostic Handling for Civet
   - [x] Update Civet plugin to suppress JavaScript diagnostics for Civet code (Initial step done)
   - [x] Modify TypeScript plugin to filter diagnostics rather than skip entirely (Initial step done)
   - [x] Implement `filterCivetDiagnostics` to include only module import errors (Initial step done)
   - [ ] **Enhance `filterCivetDiagnostics`:** Continue refining `filterCivetDiagnostics` in `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts` to accurately map and filter errors from transpiled Civet code, ensuring IDE errors point to the correct Civet source lines.
   - [ ] **Explore Direct Civet Diagnostics (Optional):** Investigate if the `CivetPlugin` can provide early-stage diagnostics directly from the Civet compiler output, if this offers benefits before `svelte2tsx` processing.
   - [ ] **Verify Civet-Specific Error Reporting:** Ensure that common Civet-specific errors (e.g., syntax errors, type errors if applicable in Civet's context) and module import issues are correctly reported and mapped.

### 3.4 Comprehensive Language Feature Verification for Civet
   - [ ] **Test Core Language Features:** Thoroughly test hover information, go-to-definition, auto-completions, and type inference for variables and functions within Civet script blocks.
   - [ ] **End-to-End Testing:** Develop and run end-to-end tests covering various scenarios, including:
        - Navigation between Civet code and other parts of Svelte components.
        - Type inference across Civet/JS/TS boundaries if applicable.
        - Correct behavior with complex Civet syntax and features.
   - [ ] **Documentation:**
        - [ ] Document any specific configuration steps required in `svelte.config.js` or project setup for optimal Civet support in `packages/svelte-vscode/README.md`.
        - [ ] Note any known limitations or unsupported Civet features.
        - [ ] Consider adding an `extensionDependencies` entry in `packages/svelte-vscode/package.json` for the Civet VS Code extension if it's deemed essential for the best user experience (e.g., for `.civet` file syntax highlighting that this work doesn't cover).

### Related File Checklist for Phase 3 (Tracking Progress)
- [x] `packages/language-server/src/plugins/civet/CivetPlugin.ts` - (Initial diagnostic suppression)
- [x] `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts` - (Initial diagnostic filtering)
- [x] `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts` - (Initial `filterCivetDiagnostics`)
- [x] `packages/language-server/src/lib/documents/Document.ts` - Verified Civet script identification (no changes needed).
- [x] `packages/language-server/src/lib/configLoader.ts` - Verified, loads preprocessor config correctly.
- [x] `packages/language-server/src/plugins/svelte/SvelteDocument.ts` - Verified, correctly invokes preprocessors. However, the focus now shifts to *how* it (and `svelte/compiler`) invokes them and what context/options are passed to `svelte-preprocessor-with-civet` that might cause different behavior than isolated tests.
- [x] `packages/svelte2tsx/src/svelte2tsx/index.ts` - `getAttributeValue` helper added for verification; main role is consuming preprocessed output. Verified it should receive JS/TS if preprocessing is successful.
- [ ] `svelte-preprocessor-with-civet` - Isolated tests confirm it *can* correctly transpile the problematic class syntax. The issue is its failure to do so when invoked *within the Svelte Language Server's pipeline*. Investigation should focus on the invocation differences.
- [ ] `packages/svelte-vscode/README.md` - (For user documentation)
- [ ] `packages/svelte-vscode/package.json` - (Potentially for `extensionDependencies`)

## Phase 4: Testing and Documentation

### 4.1 Verify Extension Configuration
- [ ] Verify extension properly recognizes Civet in Svelte files
- [ ] Confirm `embeddedLanguages` configuration is working correctly
- [ ] Test with and without the Civet extension installed

### 4.2 Add End-to-End Tests
- [ ] Add tests for Civet language features in Svelte files
- [ ] Test syntax highlighting in `<script lang="civet">` tags
- [ ] Test integration with the preprocessor

### 4.3 Update Documentation
- [ ] Add documentation about Civet support in Svelte files
- [ ] Document required extensions and configuration
- [ ] Document how to use Civet with Svelte (both in IDE and at runtime)

## Phase 5: Release and Distribution

### 5.1 Version Bump and Changelog
- [ ] Update version numbers and changelog
- [ ] Bump version numbers appropriately
- [ ] Add changelog entries for Civet support

### 5.2 Build and Package
- [ ] Build and package the extension for distribution
- [ ] Run `pnpm run build` at the root
- [ ] Run `pnpm run package` in `packages/svelte-vscode`

### 5.3 Publish
- [ ] Publish the updated extension to the VS Code marketplace
- [ ] Run `pnpm run publish` in `packages/svelte-vscode`

# Files to be Modified

## Phase 1: TextMate Grammar Integration ✅
- [x] Copy `civet-syntax/syntaxes/civet.json` to `packages/svelte-vscode/syntaxes/civet.tmLanguage.json`
- [x] Remove `packages/svelte-vscode/test/grammar/dummy/civet.tmLanguage-dummy.json`
- [x] Verify Civet injection patterns in `packages/svelte-vscode/syntaxes/svelte.tmLanguage.src.yaml`
- [x] Create `packages/svelte-vscode/test/grammar/samples/script-civet/input.svelte` test sample

## Phase 2: Language Server Integration ✅
- [x] `packages/language-server/src/ls-config.ts` - Add Civet configuration
- [x] Create new files:
   - [x] `packages/language-server/src/plugins/civet/index.ts`
   - [x] `packages/language-server/src/plugins/civet/CivetPlugin.ts`
   - [x] `packages/language-server/src/plugins/civet/service.ts`
- [x] `packages/language-server/src/plugins/index.ts` - Export Civet plugin
- [x] `packages/language-server/src/server.ts` - Register Civet plugin
- [ ] Document decision about Civet dependencies

## Phase 3: Enabling Full IDE Language Features for Civet in Svelte

This crucial phase is entirely focused on making the IDE fully understand Civet code within `<script lang="civet">` tags. The goal is to provide a rich development experience with features like TypeScript-aware autocompletion, hover information, go-to-definition, and accurate diagnostics. This involves ensuring the Civet code is correctly preprocessed to JavaScript/TypeScript within the language server, that `svelte2tsx` can then convert this to TSX, and that all source mapping is accurate to enable these IDE features to point back to the original Civet source.

### 3.1 Civet Preprocessor Integration with Language Server
   - [x] **Investigate `configLoader` for Preprocessor Discovery:** Confirm how the language server's `configLoader` discovers and utilizes project-defined Svelte preprocessors from `svelte.config.js`.
   - [x] **Ensure Civet Preprocessor Loading:** Verify and ensure the `configLoader` can correctly identify and load `svelte-preprocessor-with-civet` (or any compatible Civet preprocessor specified in the project's Svelte configuration).
   - [x] **Update Document Handling for Civet Scripts:** `packages/language-server/src/lib/documents/Document.ts` and `utils.ts` correctly identify `<script lang="civet">` blocks and their attributes, making the raw Civet content available. No changes were needed as existing logic is generic.

### 3.2 Verify Main Svelte Preprocessing Pipeline for Civet and `svelte2tsx` Consumption

**Reasoning & Context:**
The Svelte Language Server, primarily through `packages/language-server/src/plugins/svelte/SvelteDocument.ts`, already employs `svelte/compiler`'s `preprocess` function. This function is designed to apply all project-defined preprocessors (listed in `svelte.config.js`, which is loaded by `packages/language-server/src/lib/documents/configLoader.ts`) to the entire Svelte file content. This is the standard and robust Svelte tooling approach.

Therefore, `svelte-preprocessor-with-civet` (when configured by the user) should be automatically invoked as part of this existing main Svelte preprocessing pipeline. The output of this pipeline (Svelte code where Civet has been transformed to JavaScript/TypeScript and the `lang` attribute likely updated) is then passed to `svelte2tsx`.

`svelte2tsx`'s role is to convert this already JS/TS-ified Svelte component structure into TSX for the TypeScript Language Service. It should not need to implement its own Civet (or other language-specific) preprocessor invocation logic.

**Current Status (Based on Logs and Isolated Tests):**
✅ The logs confirm that the Svelte Language Server is correctly identifying and invoking the script preprocessor for Civet code.
✅ Isolated tests (e.g., `testPreProcTest.mjs`) confirm that `svelte-preprocessor-with-civet` *can* correctly transpile the problematic Civet class syntax to JavaScript when called directly with appropriate content and attributes.
✅ Direct tests with `@danielx/civet` also confirm its capability to compile this syntax.

❌ **The Discrepancy:** Despite the above, when `svelte-preprocessor-with-civet` is invoked by the Svelte Language Server's internal preprocessing pipeline (via `svelte/compiler`'s `preprocess` function), it *fails* to transform these specific Civet class syntaxes:
    - The output code from the preprocessor (within the LS context) still contains the original Civet.
    - The preprocessed code (within the LS context) maintains `lang="civet"`.

- **New Root Cause Hypothesis:** The issue is **not** an inherent limitation in `@danielx/civet` or `svelte-preprocessor-with-civet` for this syntax. Instead, the problem likely lies in:
    -   The specific options, arguments, or environment provided to `svelte-preprocessor-with-civet` when it's invoked *by the Svelte Language Server's pipeline* (managed by `SvelteDocument.ts` and `svelte/compiler`).
    -   Differences in how the preprocessor behaves or is configured/initialized within the LS context versus standalone test scripts.
    -   The `svelte.config.js` loaded by the language server might differ or its preprocessor options for Civet might not be correctly interpreted/passed through the chain for these complex cases.
- ✅ Simpler Civet syntax (without these problematic class constructs) *is* correctly transpiled to JavaScript by `svelte-preprocessor-with-civet` *both* in isolated tests and (apparently) within the LS pipeline.

**Key Files & Dependencies for this Phase:**
*   `packages/language-server/src/plugins/svelte/SvelteDocument.ts`: Orchestrates the call to `document.compiler.preprocess`. This is where the primary Svelte preprocessing happens.
*   `packages/language-server/src/lib/documents/configLoader.ts`: Loads `svelte.config.js`, making preprocessor definitions available to `SvelteDocument.ts`.
*   `svelte/compiler` (external dependency): Its `preprocess` function is the core engine that runs all configured preprocessors.
*   `svelte-preprocessor-with-civet` (user project dependency): The actual Civet preprocessor that needs to be invoked by the `svelte/compiler::preprocess` step.
*   `packages/svelte2tsx/src/svelte2tsx/index.ts`: Consumes the output of the main preprocessing pipeline. Its script `lang` attribute recognition logic will help verify the pipeline's behavior.

**Tasks:**
*   [x] **Verify `svelte-preprocessor-with-civet` Invocation in Main Pipeline:**
    *   ✅ **Confirmed:** The logs show that the script preprocessor is being called with the correct language and attributes.
    *   ⚠️ **Sharpened Issue:** The preprocessor is invoked by the LS, but for certain class syntaxes, it does not return the expected JavaScript output, *even though isolated tests show it is capable of doing so*. This points to a discrepancy in how the preprocessor is used or behaves within the LS pipeline versus direct invocation.

*   [ ] **Debug the Svelte Language Server's Preprocessing Pipeline for Civet:**
    *   **Investigate Invocation Differences:**
        - Focus on `packages/language-server/src/plugins/svelte/SvelteDocument.ts` and its use of `svelte/compiler`'s `preprocess`.
        - Determine the exact content, filename, and attributes being passed to `svelte-preprocessor-with-civet` from within this pipeline for the problematic syntax.
        - Compare these with the successful invocation in `testPreProcTest.mjs`. Are there subtle differences in the `content` string (e.g., whitespace, newlines)? Are all necessary `attributes` (like `lang="civet"`) correctly passed and received?
        - Verify the options from `svelte.config.js` (loaded by `configLoader.ts`) are correctly reaching `svelte-preprocessor-with-civet` within the LS context.
    *   **Check `svelte-preprocessor-with-civet` Behavior In-LS-Context:**
        - If possible, add more detailed logging within `svelte-preprocessor-with-civet` (or a patched version) to see the options it receives and the exact input/output when run by the LS.
    *   ✅ **Key Test Insights (Direct `@danielx/civet` test, and `testPreProcTest.mjs` for `svelte-preprocessor-with-civet`):**
        - Direct tests show `@danielx/civet` *can* compile the class syntax in question.
        - Crucially, `testPreProcTest.mjs` shows `svelte-preprocessor-with-civet` *can also* correctly transpile this syntax when invoked directly. This strongly suggests the preprocessor itself is not faulty for this syntax.
        - The discrepancy arises when this preprocessor is invoked *within the Svelte Language Server's pipeline*.
    *   **Compare Configurations:** Review `svelte.config.js` and how it's loaded/interpreted by the LS via `configLoader.ts` vs. any setup in test scripts.

*   [ ] **Implement a Solution Based on Findings:**
    *   **Option 1 - Rectify LS Preprocessing Invocation/Context:**
        - Adjust how `SvelteDocument.ts` or `svelte/compiler`'s `preprocess` function passes data/options to `svelte-preprocessor-with-civet` to ensure it behaves as it does in isolated tests.
        - This might involve ensuring the correct preprocessor options from `svelte.config.js` are consistently applied for Civet.
        - If `svelte-preprocessor-with-civet` requires a specific environment or input format subtly different from what the LS pipeline provides, adapt the LS pipeline or the preprocessor.

*   [ ] **Ensure `svelte2tsx` Correctly Consumes Preprocessed JS/TS Output:**
    *   Once the preprocessor is correctly transforming Civet code, confirm that `svelte2tsx` processes the JavaScript/TypeScript output without errors.
    *   The `isTsFile` logic and general script handling within `svelte2tsx` should operate correctly based on the updated `lang` attribute it receives.

*   [ ] **Investigate and Validate End-to-End Source Map Chaining:**
    *   **Importance:** This is critical for all IDE language features (diagnostics, hover, go-to-definition, debugging) to map accurately from the analyzed TSX back to the original Civet source code.
    *   **Chain of Maps:**
        1.  `svelte-preprocessor-with-civet` should produce a source map (Civet -> JS/TS).
        2.  `svelte/compiler::preprocess` should combine maps if multiple preprocessors run. The `preprocessed.map` given to `SvelteDocument` should represent this combined map.
        3.  `SvelteDocument`'s `SourceMapDocumentMapper` uses this `preprocessed.map` to map between the original Svelte file (with Civet) and the fully preprocessed Svelte file (with JS/TS).
        4.  `svelte2tsx` then generates its own source map (preprocessed Svelte with JS/TS -> TSX).
    *   **Validation:** Test IDE features to ensure they point to the correct locations in the original Civet code. This involves checking how the language server combines or uses these two stages of source maps.

### 3.3 Refine Diagnostic Handling for Civet
   - [x] Update Civet plugin to suppress JavaScript diagnostics for Civet code (Initial step done)
   - [x] Modify TypeScript plugin to filter diagnostics rather than skip entirely (Initial step done)
   - [x] Implement `filterCivetDiagnostics` to include only module import errors (Initial step done)
   - [ ] **Enhance `filterCivetDiagnostics`:** Continue refining `filterCivetDiagnostics` in `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts` to accurately map and filter errors from transpiled Civet code, ensuring IDE errors point to the correct Civet source lines.
   - [ ] **Explore Direct Civet Diagnostics (Optional):** Investigate if the `CivetPlugin` can provide early-stage diagnostics directly from the Civet compiler output, if this offers benefits before `svelte2tsx` processing.
   - [ ] **Verify Civet-Specific Error Reporting:** Ensure that common Civet-specific errors (e.g., syntax errors, type errors if applicable in Civet's context) and module import issues are correctly reported and mapped.

### 3.4 Comprehensive Language Feature Verification for Civet
   - [ ] **Test Core Language Features:** Thoroughly test hover information, go-to-definition, auto-completions, and type inference for variables and functions within Civet script blocks.
   - [ ] **End-to-End Testing:** Develop and run end-to-end tests covering various scenarios, including:
        - Navigation between Civet code and other parts of Svelte components.
        - Type inference across Civet/JS/TS boundaries if applicable.
        - Correct behavior with complex Civet syntax and features.
   - [ ] **Documentation:**
        - [ ] Document any specific configuration steps required in `svelte.config.js` or project setup for optimal Civet support in `packages/svelte-vscode/README.md`.
        - [ ] Note any known limitations or unsupported Civet features.
        - [ ] Consider adding an `extensionDependencies` entry in `packages/svelte-vscode/package.json` for the Civet VS Code extension if it's deemed essential for the best user experience (e.g., for `.civet` file syntax highlighting that this work doesn't cover).

### Related File Checklist for Phase 3 (Tracking Progress)
- [x] `packages/language-server/src/plugins/civet/CivetPlugin.ts` - (Initial diagnostic suppression)
- [x] `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts` - (Initial diagnostic filtering)
- [x] `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts` - (Initial `filterCivetDiagnostics`)
- [x] `packages/language-server/src/lib/documents/Document.ts` - Verified Civet script identification (no changes needed).
- [x] `packages/language-server/src/lib/configLoader.ts` - Verified, loads preprocessor config correctly.
- [x] `packages/language-server/src/plugins/svelte/SvelteDocument.ts` - Verified, correctly invokes preprocessors. However, the focus now shifts to *how* it (and `svelte/compiler`) invokes them and what context/options are passed to `svelte-preprocessor-with-civet` that might cause different behavior than isolated tests.
- [x] `packages/svelte2tsx/src/svelte2tsx/index.ts` - `getAttributeValue` helper added for verification; main role is consuming preprocessed output. Verified it should receive JS/TS if preprocessing is successful.
- [ ] `svelte-preprocessor-with-civet` - Isolated tests confirm it *can* correctly transpile the problematic class syntax. The issue is its failure to do so when invoked *within the Svelte Language Server's pipeline*. Investigation should focus on the invocation differences.
- [ ] `packages/svelte-vscode/README.md` - (For user documentation)
- [ ] `packages/svelte-vscode/package.json` - (Potentially for `extensionDependencies`)

## Phase 4: Testing and Documentation
- [ ] `