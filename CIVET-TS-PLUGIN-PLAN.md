# TODO: Integrate Civet support into Svelte TypeScript plugin (Approach A)

We want TypeScript in VS Code (and any tsserver-based IDE) to recognize and type-check `.civet` modules exactly like `.svelte.ts` files, but only when Civet is a dependency in the project.

---

## Context & Goals

- Current `module-loader.ts` in `packages/typescript-plugin/src/` patches resolution for `.svelte` → `.svelte.ts`.
- [X] We need an analogous hook for `.civet` files that:
  1. Detects `.civet` imports
  2. Compiles them via Civet API to TSX in memory
  3. Feeds generated code and sourcemaps into TS's virtual FS
- Only activate when `@danielx/civet` is present in `package.json`.

---

## Checklist

- [X] Detect Civet dependency
  - In `src/ls-config.ts` or plugin entry (`src/index.ts`), read `package.json` to set a flag `enableCivet` if `@danielx/civet` exists.

- [X] Extend `patchModuleLoader` (in `src/module-loader.ts`)
  - [X] Add `isCivetFilePath(fileName: string): boolean` (similar to `isSvelteFilePath`).
  - [X] In `resolveModuleNames` and `resolveModuleNameLiterals`, for each moduleName:
    - If `enableCivet` && `isCivetFilePath(moduleName)`, then:
      1. Resolve the absolute Civet filename (with implicit `.civet` if needed)
      2. Read raw Civet source from disk
      3. [ ] Compile via `import('@danielx/civet').then(civet => civet.compile(..., { sync: true, js: false, ts: true, sourceMap: true }))`
      4. Store generated TS code in the loader's `fsMap` under `<file>.civet.tsx`
      5. Return a virtual module specifier ending in `.civet.tsx`
  - [ ] Mirror above in `loadInclude` and `load` if necessary

- [ ] Sourcemap support
  - Ensure the plugin's existing sourcemap remapping (in Svelte snapshot manager) also applies to `.civet.tsx` files.

- [X] Expose a config option
  - In `config-manager.ts`, add under `Configuration`: `civet?: { enable: boolean }`
  - Wire into the module loader guard so users can disable Civet integration explicitly.

- [ ] Tests & validation
  - [ ] Add a sample `.civet` file import to `packages/typescript-plugin/test/` and ensure `tsserver` returns no errors.
  - [ ] In a dummy SvelteKit + Civet repo, import a Civet class inside `<script lang="ts">` in `.svelte` and verify hover/definition/completion.

- [ ] Documentation
  - [ ] Update `README.md` to describe the new `civet` config option and its effect
  - [ ] Reference this plan in docs (e.g. create a doc entry linking to `CIVET-TS-PLUGIN-PLAN.md`)

---

## Next steps

1. ✅ Kick off by reading `package.json` in plugin entry and setting `enableCivet` flag.
2. ✅ Prototype the Civet compile hook inside `patchModuleLoader` for one `.civet` import.
   - Added `isCivetFilePath` and related helpers to `utils.ts`.
   - Updated `module-loader.ts` to recognize `.civet` files and (currently) simulate resolution to `.civet.tsx`.
   - Added `civet` configuration to `config-manager.ts` to fix linter errors.
3. 🔴 Implement actual Civet compilation within `resolveCivetModuleName` in `module-loader.ts`.
4. 🔴 Add unit tests for resolution & TS diagnostics.
5. 🔴 Polish error handling, refactor shared logic into `utils.ts` (e.g. `extractCivetFilename`).
6. 🔴 Document release & publish new plugin version.

> _Feel free to check off tasks as you progress!_