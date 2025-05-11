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
- ❌ Despite correct syntax highlighting, the language server is still treating Civet code as JavaScript for error checking
- ❌ JavaScript errors are shown for valid Civet syntax (e.g., `:=` operator shows "Expression expected" error)
- Next: Fix language server diagnostics for Civet code

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
- [ ] Update the Civet plugin to suppress JavaScript diagnostics for Civet code
- [ ] Modify the TypeScript plugin to ignore Civet script blocks
- [ ] Implement a mechanism to prevent JS/TS validation on Civet code

### 3.2 Add Extension Dependency or Integration
- [x] Decide not to depend on the VSCode Civet extension directly
- [ ] Document how users should install and configure the Civet extension alongside the Svelte extension

### 3.3 Verify Preprocessor Support
- [ ] Confirm the language server's configLoader already loads preprocessors from svelte.config.js
- [ ] Test with a project using `svelte-preprocessor-with-civet` to verify it works
- [ ] Document any specific configuration needed for the preprocessor

### 3.4 Update Document Manager to Handle Civet
- [ ] Ensure Document class can handle Civet script content
- [ ] Verify script tag detection recognizes Civet
- [ ] Handle Civet script content appropriately

### 3.5 Update svelte2tsx to Handle Civet
- [ ] Add support for converting Civet script content to TSX
- [ ] Detect Civet script tags
- [ ] Use the appropriate method to convert Civet to JavaScript/TypeScript

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
- [ ] `packages/language-server/src/plugins/civet/CivetPlugin.ts` - Update to suppress JS diagnostics for Civet code
- [ ] `packages/language-server/src/plugins/typescript/TypeScriptPlugin.ts` - Modify to ignore Civet script blocks
- [ ] `packages/svelte-vscode/package.json` - Add extension dependency if needed
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