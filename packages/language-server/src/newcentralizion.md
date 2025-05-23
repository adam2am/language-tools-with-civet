# Civet Mapping Centralization Plan

This document tracks our two-phase effort to collapse all Civet sourcemap and mapping logic into a single shared module within the Svelte extension.

---

## Phase 1: Extract & centralize helper functions

- [x] Create `src/plugins/civet/util.ts` with:
  - [x] Re-export of `remapPosition`, `remapRange`, `flattenDiagnosticMessageText` from our existing `ts-diagnostics.ts`.
  - [x] Copy in `forwardMap` (raw VLQ) from `civetUtils.ts` and name it `forwardMapRaw`.
  - [x] Copy in these helpers from `civetUtils.ts`:
    - `svelteDocPositionToCivetContentRelative`
    - `civetContentPositionToSvelteDocRelative`
    - `adjustTsPositionForLeadingNewline`

- [x] Migrate imports in:
  - [x] `CivetPlugin.ts`
  - [x] `features/CivetCompletionsProvider.ts`
  - [x] `features/CivetHoverProvider.ts`
  - [x] `features/CivetDiagnosticsProvider.ts`
  - [x] `features/CivetDefinitionsProvider.ts`
  - [x] `features/CivetCodeActionsProvider.ts`
  - (any other Civet feature under `features/`)

- [ ] Remove or deprecate `civetUtils.ts` once all functions are migrated.

- [x] Remove the flat-entry `remapPosition` in `CivetPlugin.ts`.

- [ ] Smoke-test: verify completions, hover, definitions, and diagnostics still work in `<script lang="civet">` blocks.

---

## Phase 2: Centralize high-level converters

- [ ] In `src/plugins/civet/util.ts`, implement unified converter functions:
  - `convertCompletions(tsCompletions, hostCode, rawSourcemapLines, scriptStartPos, originalContentLineOffset): CompletionList`
  - `convertDiagnostics(tsDiagnostics, svelteDoc, rawSourcemapLines): Diagnostic[]`
  - `convertDefinitions(tsDefs, svelteDoc, rawSourcemapLines): DefinitionLink[]`
  - `convertHover(tsQuickInfo, svelteDoc, rawSourcemapLines): Hover`
  - (and any others needed: code-actions, selection-range, document-symbols)

- [ ] Refactor each provider under `src/plugins/civet/features/` to call the new converter functions instead of manual mapping.

- [ ] Refactor `CivetPlugin.ts` to leverage the new converters for diagnostics, hover, and definitions.

- [ ] Update tests under `packages/language-server/test/plugins/civet/` to expect ranges and outputs from the new converters; adjust snapshots if needed.

- [ ] Final cleanup:
  - Delete any leftover unused helpers (`civetContentPositionToSvelteDocRelative` duplicates, inline offset loops, duplicate `adjustTsPositionForLeadingNewline`).

- [ ] Perform an end-to-end integration test with a Svelte + Civet file to confirm full feature parity.

---

## Consolidated Civet Pipeline (Post-Centralization)

Here's how the LSP pipeline will handle `<script lang="civet">` blocks once all mapping logic is centralized into `src/plugins/civet/util.ts`:

1.  **User opens/edits a `.svelte` file.**

2.  **`DocumentManager` (`server.ts`)**
    *   Creates/updates a `Document` object for the Svelte file.
    *   Notifies `CivetPlugin` (and other plugins) via `handleDocumentChange`.

3.  **`CivetPlugin.ts` (`handleDocumentChange`)**
    *   Checks if the document is already in `compiledCivetCache` and up-to-date. If so, re-pushes to host and exits.
    *   Calls `getCivetTagInfo` (from `CivetPlugin.ts`) to find the `<script lang="civet">` block's content and start position.
    *   If no Civet script, deletes cache entry and updates host with empty content.
    *   **NEW**: Uses `adjustTsPositionForLeadingNewline` (now in `util.ts`) to handle potential leading blank lines and gets an `originalContentLineOffset`.
    *   Calls `civet.compile(civetCode, { sourceMap: true })` to get compiled TS and raw VLQ `sourceMap.lines`.
    *   **OLD (removed)**: No longer calls `transformCivetSourcemapLines` here.
    *   Caches `{ compiledTsCode, rawSourcemapLines (VLQ), originalContentLineOffset, version }`.
    *   Updates `CivetLanguageServiceHost` (`typescriptServiceHost.ts`) with the `document.uri`, `compiledTsCode`, and an **empty array** for sourcemap lines (as the host itself doesn't use them for mapping, only providers do).

4.  **LSP Feature Request (e.g., Completions, Hover, Diagnostics)**
    *   `PluginHost.ts` receives the request (e.g., `getCompletions`).
    *   It calls the corresponding method on `CivetPlugin.ts` (e.g., `CivetPlugin.getCompletions`).

5.  **`CivetPlugin.ts` (Feature Method - e.g., `getCompletions`)**
    *   Calls `ensureDocumentProcessed` which runs `handleDocumentChange` (steps above) if needed.
    *   Delegates to the specific feature provider (e.g., `CivetCompletionsProvider.getCompletions`).

6.  **Feature Provider (e.g., `CivetCompletionsProvider.ts`)**
    *   Retrieves cached `{ compiledTsCode, rawSourcemapLines, originalContentLineOffset }` and `scriptStartPosition`.
    *   **NEW**: Calls a single, high-level converter function from `util.ts`:
        *   e.g., `util.convertCompletions(document, position, completionContext, civetLanguageServiceHost, cachedData, scriptStartPosition)`.

7.  **Centralized `util.ts` (Converter Function - e.g., `convertCompletions`)**
    *   **Internal Mapping Logic (all within this one function/module):**
        1.  Uses `svelteDocPositionToCivetContentRelative` (from `util.ts`) to get Civet-content relative position.
        2.  Adjusts for `originalContentLineOffset`.
        3.  Uses `forwardMapRaw` (from `util.ts`, operating on `rawSourcemapLines`) to map Civet position to generated TS position.
        4.  Calls the appropriate method on `civetLanguageServiceHost` (e.g., `getCompletions(document.uri, tsPosition, options)`).
        5.  For each result from the TS service (e.g., each completion item's `replacementSpan`):
            a.  Converts TS offsets back to `Position` objects (using an internal helper or `document.positionAt` on the `hostTsCode`).
            b.  Uses `adjustTsPositionForLeadingNewline` (from `util.ts`) if the `hostTsCode` had a prepended newline (though this might be redundant if `originalContentLineOffset` already handles this consistently at the source mapping stage).
            c.  Uses `remapPosition` (from `ts-diagnostics.ts` via `util.ts`, operating on `rawSourcemapLines`) to map TS `Position` back to Civet-content relative `Position`.
            d.  Uses `civetContentPositionToSvelteDocRelative` (from `util.ts`) to map Civet-content relative `Position` back to Svelte document `Position`.
        6.  Constructs and returns the final LSP-compliant response (e.g., `CompletionList`).

8.  **Response bubbles up** through Provider -> Plugin -> PluginHost -> LSP Client.

### Files Involved & Their Roles (Post-Centralization):

*   **`server.ts`**: LSP entry point, initializes `DocumentManager`, `LSConfigManager`, `PluginHost`, and `CivetPlugin` (with `LSAndTSDocResolver` and `CivetLanguageServiceHost`).
*   **`ls-config.ts`**: Manages configuration, including enabling/disabling Civet features. Read by `CivetPlugin` and providers.
*   **`PluginHost.ts`**: Routes LSP requests to registered plugins. `CivetPlugin` is one of them.
*   **`plugins/civet/index.ts`**: Barrel file, exports `CivetPlugin`.
*   **`plugins/civet/CivetPlugin.ts`**: 
    *   Core orchestrator for Civet.
    *   Implements `handleDocumentChange` for compilation and caching.
    *   Delegates feature requests (completions, hover, etc.) to specific providers.
*   **`plugins/civet/features/*.ts` (e.g., `CivetCompletionsProvider.ts`)**: 
    *   Minimal providers that primarily call the new high-level `convert<Feature>` functions in `util.ts`.
*   **`plugins/civet/util.ts` (NEW & CENTRAL)**:
    *   Re-exports `remapPosition`, `remapRange`, `flattenDiagnosticMessageText` from `ts-diagnostics.ts`.
    *   Contains `forwardMapRaw` (the raw VLQ forward-mapper).
    *   Contains `svelteDocPositionToCivetContentRelative`, `civetContentPositionToSvelteDocRelative`, `adjustTsPositionForLeadingNewline`.
    *   **Crucially, contains all the new `convert<Feature>` functions** (e.g., `convertCompletions`, `convertHover`) which encapsulate the entire mapping and TS interaction logic for each LSP feature.
*   **`plugins/civet/ts-diagnostics.ts`**: Our local copy of Civet's sourcemap remapping functions (`remapPosition`, `remapRange`, `flattenDiagnosticMessageText`). Used by `util.ts`.
*   **`typescriptServiceHost.ts` (`CivetLanguageServiceHost`)**: 
    *   The in-memory TypeScript service sandbox for compiled Civet code.
    *   Its methods (`getCompletions`, `getQuickInfo`, etc.) are called by the `convert<Feature>` functions in `util.ts`.
    *   It does **not** perform any sourcemapping itself.

### Optimality & Comparison to `server.mts` (Civet Reference LSP):

This centralized approach becomes **very similar in spirit and structure to the reference `server.mts` and `util.mts`**. 

*   Our `plugins/civet/util.ts` will become analogous to their `util.mjs`, holding all conversion and mapping logic.
*   Our `CivetPlugin.ts` and `CivetCompletionsProvider.ts` (etc.) become much thinner, primarily dispatching to `util.ts` methods, much like `server.mts` dispatches to its own util helpers after getting data from `TSService`.
*   The key difference is that we are a *plugin* within a larger Svelte LSP, so `CivetPlugin.ts` still handles the Svelte document interaction, compilation, and caching, whereas their `server.mts` *is* the entire server and manages the `TSService` (our `CivetLanguageServiceHost`) directly.

**Is it optimal?**

*   **Yes, for our plugin architecture.** It significantly reduces code duplication, centralizes complex mapping logic making it easier to maintain and debug, and aligns well with the proven pattern in the reference Civet LSP.
*   It keeps the `CivetLanguageServiceHost`职责单一 (single responsibility) – just being a TS service for snippets – which is good.
*   The main overhead is the initial Civet compilation, but that's inherent to supporting Civet. The mapping itself, once centralized, should be efficient.

This refactoring will make the Civet integration much cleaner and more robust.

_Write progress updates here as tasks are completed._
