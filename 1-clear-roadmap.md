# Main Idea
The thing is - projects with civet in .svelte nicely working with svelte-preprocessor-with-civet
but only in a runtime, the IDE (Vscode/Cursor IDE) itself doesn't seem to recognize
civet syntax in `<script lang="civet"></script>`.

So this repo is designed to bridge/connect this gap.

Currently, we want to implement Civet into language tools of Svelte so IDE would recognize the language,
but it's only partially implemented.

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
   - Add: A function that filters TypeScript diagnostics to only keep module import related ones
   - Code:
     ```typescript
     function filterCivetDiagnostics(diagnostics: ts.Diagnostic[]): ts.Diagnostic[] {
         // Keep only module resolution diagnostics (code 2307: Cannot find module 'x')
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

## Phase 3: Civet Preprocessor Integration, `svelte2tsx` Enhancement, and Language Feature Enablement

This phase focuses on enabling the Svelte Language Server to understand and provide rich features for Civet code within `<script lang="civet">` tags by integrating with the project's configured Civet preprocessor and enhancing the `svelte2tsx` transpilation process.

### 3.1 Civet Preprocessor Integration with Language Server
   - [ ] **Investigate `configLoader` for Preprocessor Discovery:** Confirm how the language server's `configLoader` discovers and utilizes project-defined Svelte preprocessors from `svelte.config.js`.
   - [ ] **Ensure Civet Preprocessor Loading:** Verify and ensure the `configLoader` can correctly identify and load `svelte-preprocessor-with-civet` (or any compatible Civet preprocessor specified in the project's Svelte configuration).
   - [ ] **Update Document Handling for Civet Scripts:** Modify `packages/language-server/src/lib/documents/Document.ts` (or relevant document processing logic) to accurately identify `<script lang="civet">` blocks and prepare their content for the preprocessor.

### 3.2 Enhance `svelte2tsx` for Civet Transpilation
   - [ ] **Add Civet Script Recognition to `svelte2tsx`:** Update `packages/svelte2tsx/src/index.ts` to recognize `<script lang="civet">` tags.
   - [ ] **Integrate Civet Compilation in `svelte2tsx`:** Implement logic in `svelte2tsx` to invoke the project-configured Civet compiler (via the loaded preprocessor) for script blocks.
   - [ ] **Embed Transpiled Output:** Ensure the JavaScript/TypeScript output from the Civet compiler is correctly embedded into the TSX generated by `svelte2tsx`.
   - [ ] **Implement Civet Source Mapping:** Generate and manage accurate source maps from the original Civet code to the transpiled JavaScript/TypeScript within the TSX, crucial for diagnostics and navigation.

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
- [ ] `packages/language-server/src/lib/documents/Document.ts` - (For Civet script identification and preprocessor content preparation)
- [ ] `packages/language-server/src/lib/configLoader.ts` (or related modules) - (For preprocessor discovery and loading)
- [ ] `packages/svelte2tsx/src/index.ts` (and related `svelte2tsx` modules) - (For Civet script recognition, compilation invocation, source mapping)
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

## Phase 3: Civet Preprocessor Integration, `svelte2tsx` Enhancement, and Language Feature Enablement
- [ ] `packages/language-server/src/lib/documents/Document.ts` - Verify Civet script handling
- [ ] `packages/svelte2tsx/src/index.ts` - Add support for converting Civet to TSX
- [ ] `packages/svelte-vscode/README.md` - Update documentation
- [ ] `README.md` - Update main documentation

## Phase 4: Testing and Documentation
- [ ] `packages/svelte-vscode/package.json` - Verify configuration
- [ ] Create new file `packages/svelte-vscode/test/suite/civet.test.ts` - End-to-end tests
- [ ] `packages/svelte-vscode/README.md` - Update documentation
- [ ] `README.md` - Update main documentation

## Phase 5: Release and Distribution
- [ ] `packages/svelte-vscode/package.json` - Version bump
- [ ] `packages/language-server/package.json` - Version bump
- [ ] `CHANGELOG.md` - Add Civet support entries