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

## Phase 3: Language Server Diagnostics and Preprocessor Support

### 3.1 Fix Language Server Diagnostics for Civet
- [x] Update the Civet plugin to suppress JavaScript diagnostics for Civet code
- [x] Modify the TypeScript plugin to ignore Civet script blocks
- [x] Implement a mechanism to prevent JS/TS validation on Civet code
- [ ] Re-enable TypeScript type checking for module imports in Civet code
  - [ ] Modify `TypeScriptPlugin.getDiagnostics()` to selectively process Civet files instead of skipping them entirely
  - [ ] Create a `filterCivetDiagnostics()` function in `DiagnosticsProvider.ts` that keeps only module import diagnostics
  - [ ] Add a flag to indicate when a document contains Civet code to the diagnostics provider
  - [ ] Test with sample Civet code that includes valid and invalid imports

### 3.2 Add Extension Dependency or Integration
- [x] Decide not to depend on the VSCode Civet extension directly
- [ ] Document how users should install and configure the Civet extension alongside the Svelte extension
  - [ ] Add section to README explaining the Civet extension requirement
  - [ ] Include installation instructions and configuration tips
  - [ ] Explain how the extensions work together

### 3.3 Verify Preprocessor Support
- [ ] Confirm the language server's configLoader already loads preprocessors from svelte.config.js
  - [ ] Review `configLoader.ts` to verify it handles custom preprocessors
  - [ ] Check how preprocessor configuration is passed to the language server
  - [ ] Verify the preprocessor chain includes support for non-standard languages
- [ ] Test with a project using `svelte-preprocessor-with-civet` to verify it works
  - [ ] Create a test project with the preprocessor configured
  - [ ] Verify compilation works correctly
  - [ ] Ensure IDE features work with preprocessed code
- [ ] Document any specific configuration needed for the preprocessor
  - [ ] Add configuration examples to documentation
  - [ ] Include troubleshooting tips

### 3.4 Update Document Manager to Handle Civet
- [ ] Ensure Document class can handle Civet script content
  - [ ] Review `Document.ts` to verify it correctly identifies Civet script tags
  - [ ] Check how language attributes are processed
  - [ ] Ensure Civet is recognized as a valid script language
- [ ] Verify script tag detection recognizes Civet
  - [ ] Test with various script tag formats
  - [ ] Ensure both `<script lang="civet">` and `<script type="text/civet">` are recognized
- [ ] Handle Civet script content appropriately
  - [ ] Ensure content is correctly extracted and processed
  - [ ] Verify position mapping works correctly for Civet content

### 3.5 Update svelte2tsx to Handle Civet
- [ ] Add support for converting Civet script content to TSX
  - [ ] Modify `svelte2tsx` to recognize Civet script tags
  - [ ] Integrate with Civet compiler to transform Civet to TypeScript
  - [ ] Ensure source maps are correctly generated
- [ ] Detect Civet script tags
  - [ ] Update script tag detection logic to recognize Civet
  - [ ] Handle both module and instance scripts
- [ ] Use the appropriate method to convert Civet to JavaScript/TypeScript
  - [ ] Integrate with Civet compiler from the original repository
  - [ ] Ensure correct TypeScript output is generated
  - [ ] Maintain source mapping information for error reporting

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

## Phase 3: Language Server Diagnostics and Preprocessor Support
- [x] `packages/language-server/src/plugins/civet/CivetPlugin.ts` - Update to suppress JS diagnostics for Civet code
- [x] `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts` - Modify to ignore Civet script blocks
- [ ] `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts` - Modify to selectively process Civet files
- [ ] `packages/language-server/src/plugins/typescript/features/DiagnosticsProvider.ts` - Add filterCivetDiagnostics function
- [ ] `packages/svelte-vscode/package.json` - Add extension dependency if needed
- [ ] `packages/svelte-vscode/README.md` - Document Civet extension requirements
- [ ] `packages/language-server/src/plugins/svelte/SveltePlugin.ts` - Verify preprocessor support
- [ ] `packages/language-server/src/lib/documents/Document.ts` - Verify Civet script handling
- [ ] `packages/svelte2tsx/src/index.ts` - Add support for converting Civet to TSX

## Phase 4: Testing and Documentation
- [ ] `packages/svelte-vscode/package.json` - Verify configuration
- [ ] Create new file `packages/svelte-vscode/test/suite/civet.test.ts` - End-to-end tests
- [ ] `packages/svelte-vscode/README.md` - Update documentation
- [ ] `README.md` - Update main documentation

## Phase 5: Release and Distribution
- [ ] `packages/svelte-vscode/package.json` - Version bump
- [ ] `packages/language-server/package.json` - Version bump
- [ ] `CHANGELOG.md` - Add Civet support entries