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
- Next: create Svelte test sample for Civet

# Implementation Tree

## Phase 1: Complete TextMate Grammar Integration

### 1.1 Replace Dummy Civet Grammar with Real Implementation
- Copy the real Civet TextMate grammar `civet.json` from `civet-syntax/syntaxes` into `packages/svelte-vscode/syntaxes/civet.tmLanguage.json`
- (Optionally) copy supporting files like `civet-configuration.json` or `codeblock.json` as needed
- Remove the dummy Civet grammar `packages/svelte-vscode/test/grammar/dummy/civet.tmLanguage-dummy.json`
- Ensure the grammar's `scopeName` is `source.civet` and that it correctly tokenizes Civet constructs per the cheatsheet

### 1.2 Update Svelte Grammar to Properly Handle Civet
- Ensure the Civet injection pattern is correctly configured
- Verify the pattern `'L:meta.script.svelte meta.lang.civet - (meta source)'` works correctly
- Add any additional patterns needed for Civet-specific features in Svelte context

### 1.3 Create Test Samples for Civet in Svelte
- Create test samples with `<script lang="civet">` content
- Include various Civet syntax features to test grammar highlighting
- Ensure test snapshots are generated and verified

### 1.4 Build and Test Grammar Changes
- Run `pnpm run build:grammar` in `packages/svelte-vscode`
- Run `pnpm run test` to verify grammar tests pass

## Phase 2: Language Server Integration

### 2.1 Update Language Server Configuration
- Add Civet configuration to the language server config
- Add a new `civet` section to the `LSConfig` interface
- Add default configuration values for Civet

### 2.2 Create Civet Language Service
- Create a plugin for Civet language support
- Implement a service similar to TypeScript/JavaScript services
- Handle language features like diagnostics, hover, completions

### 2.3 Register Civet Plugin in Plugin Host
- Register the Civet plugin in the plugin host
- Add Civet plugin to the exported plugins
- Register the plugin in the server initialization

### 2.4 Add Civet Dependencies
- Add any necessary Civet-related dependencies
- Add Civet parser/compiler as a dependency if needed
- Add any other tools needed for Civet language support

## Phase 3: Preprocessor Integration

### 3.1 Verify Configured Preprocessors Are Supported
- The language server's configLoader already loads any preprocessors defined in svelte.config.js
- Verify that if a project uses `svelte-preprocessor-with-civet`, it is correctly executed during SvelteDocument transpilation
- Only add custom integration if any CPS-specific hook is needed

### 3.2 Update Document Manager to Handle Civet
- Ensure Document class can handle Civet script content
- Update script tag detection to recognize Civet
- Handle Civet script content appropriately

### 3.3 Update svelte2tsx to Handle Civet
- Add support for converting Civet script content to TSX
- Detect Civet script tags
- Convert Civet to JavaScript/TypeScript before processing

## Phase 4: IDE Integration and Testing

### 4.1 Update Extension Configuration
- Ensure extension properly activates for Civet files
- Verify `embeddedLanguages` configuration is correct
- Add any additional configuration options needed

### 4.2 Add End-to-End Tests
- Add tests for Civet language features in the IDE
- Test syntax highlighting
- Test language features like completions, hover, etc.

### 4.3 Update Documentation
- Add documentation about Civet support
- Document how to use Civet in Svelte files
- Document any configuration options

## Phase 5: Release and Distribution

### 5.1 Version Bump and Changelog
- Update version numbers and changelog
- Bump version numbers appropriately
- Add changelog entries for Civet support

### 5.2 Build and Package
- Build and package the extension for distribution
- Run `pnpm run build` at the root
- Run `pnpm run package` in `packages/svelte-vscode`

### 5.3 Publish
- Publish the updated extension to the VS Code marketplace
- Run `pnpm run publish` in `packages/svelte-vscode`

# Files to be Modified

## Phase 1: TextMate Grammar Integration
- [x] Copy `civet-syntax/syntaxes/civet.json` to `packages/svelte-vscode/syntaxes/civet.tmLanguage.json`
- [x] Remove `packages/svelte-vscode/test/grammar/dummy/civet.tmLanguage-dummy.json`
- [x] Verify Civet injection patterns in `packages/svelte-vscode/syntaxes/svelte.tmLanguage.src.yaml`
- [x] Create `packages/svelte-vscode/test/grammar/samples/script-civet/input.svelte` test sample

## Phase 2: Language Server Integration
5. `packages/language-server/src/ls-config.ts` - Add Civet configuration
6. Create new files:
   - `packages/language-server/src/plugins/civet/index.ts`
   - `packages/language-server/src/plugins/civet/CivetPlugin.ts`
   - `packages/language-server/src/plugins/civet/service.ts`
7. `packages/language-server/src/plugins/index.ts` - Export Civet plugin
8. `packages/language-server/src/server.ts` - Register Civet plugin
9. `packages/language-server/package.json` - Add Civet dependencies

## Phase 3: Preprocessor Integration
10. `packages/language-server/src/plugins/svelte/SveltePlugin.ts` - Add Civet preprocessor support
11. `packages/language-server/src/lib/documents/Document.ts` - Update to handle Civet scripts
12. `packages/svelte2tsx/src/index.ts` - Add support for converting Civet to TSX

## Phase 4: IDE Integration and Testing
13. `packages/svelte-vscode/package.json` - Verify configuration
14. Create new file `packages/svelte-vscode/test/suite/civet.test.ts` - End-to-end tests
15. `packages/svelte-vscode/README.md` - Update documentation
16. `README.md` - Update main documentation

## Phase 5: Release and Distribution
17. `packages/svelte-vscode/package.json` - Version bump
18. `packages/language-server/package.json` - Version bump
19. `CHANGELOG.md` - Add Civet support entries