# Civet AST-Driven Source Map Pipeline Roadmap

This document outlines a multi-phase plan to migrate the current Civet→TSX mapping to an AST-driven approach using Civet's V3 sourcemaps and standard remapping libraries.

---

## Checklist

- [ ] **Phase 1: Enable AST-Based V3 Map in `compileCivet`**
    - [ ] Update `compileCivet` to:
        - Call `civet.compile(snippet, { ast: true, sourceMap: true, filename })` to get an AST + raw Civet map object.
        - Instantiate a `new SourceMap(snippet)` wrapper.
        - Run `civet.generate(ast, { js: false, sourceMap: civetMap })` so all mappings are recorded.
        - Call `civetMap.json(filename, filename)` to emit a proper Raw V3 map.
        - Return `{ code, rawMap: v3Map }`.
    - [ ] Add `outputStandardV3Map: true` flag or equivalent option in `compileCivet` call sites.
    - [ ] Validate by inspecting a few Civet snippets in isolation and confirming the `.mappings` string aligns with expected token positions.
    - [ ] **Deliverable**: Unit tests for direct Civet snippet→TS mapping, asserting key tokens map back to correct source lines/columns.

- [ ] **Phase 2: Simplify `preprocessCivet` (Prototyped in `civetNewPreprocessor.ts`)**
    - [ ] Create a new file (e.g., `civetNewPreprocessor.ts`) to prototype these changes.
    - [ ] Remove calls to `normalizeCivetMap`.
    - [ ] In the new preprocessor, once `compileCivet` yields `rawMap`, directly assign that V3 map to each `CivetBlockInfo`.
    - [ ] Retain only the logic that computes TSX-within-Svelte offsets (start/end offsets, line/col starts).
    - [ ] **Deliverable**: Confirm that the prototype preprocessor still places TS code in the right location, and that each `block.map` is a valid V3 map. Once validated, integrate into the main `preprocessCivet`.

- [ ] **Phase 3: Prototype New Map Chainer Using `@jridgewell/gen-mapping` (in `civetNewMapChainer.ts`)**
    - [ ] Install dependencies:
        ```bash
        pnpm add -D @jridgewell/gen-mapping @jridgewell/sourcemap-codec @jridgewell/trace-mapping
        ```
    - [ ] Create the prototype module `src/utils/civetNewMapChainer.ts`:
        ```ts
        import { decode as decodeMappings, encode as encodeMappings } from '@jridgewell/sourcemap-codec';
        import { GenMapping, setSourceContent, addMapping, toEncodedMap } from '@jridgewell/gen-mapping';
        import { TraceMap, traceSegment } from '@jridgewell/trace-mapping';
        import type { EncodedSourceMap } from './civetTypes'; // Adjust path as needed
        import type { CivetBlockInfo } from './civetPreprocessor'; // Adjust path as needed

        export function chainMapsV3(
          baseMap: EncodedSourceMap,
          blocks: CivetBlockInfo[], // block.map is now a V3 map
          originalSvelte: string,
          svelteWithTs: string // Output of svelte2tsx before Civet processing
        ): EncodedSourceMap {
          // 1) Decode the base map (Svelte -> Svelte_with_TSX_placeholders)
          const decodedBase = decodeMappings(baseMap.mappings);
          const gen = new GenMapping({ file: baseMap.file, sourceRoot: baseMap.sourceRoot });
          
          if (baseMap.sources && baseMap.sources[0]) {
            setSourceContent(gen, baseMap.sources[0], originalSvelte);
          }

          // Placeholder for logic to map through Civet blocks
          // This will iterate `decodedBase` segments.
          // If a segment maps to a region managed by a Civet block:
          //   - Use the block's V3 map (block.map) to trace back to original Civet in Svelte
          //   - Add mapping to `gen` from final TSX to original Civet in Svelte
          // Else (segment is outside a Civet block, e.g., template code):
          //   - Add mapping to `gen` directly using original segment data (adjusted for Svelte file)

          // Example (very simplified, actual logic needs to correlate TSX output lines/cols with Civet blocks):
          decodedBase.forEach((segments, lineIdx) => {
            segments.forEach(seg => {
              const [genCol, sourceIdx, origLine0, origCol0, nameIdx] = seg;
              // THIS IS A SIMPLIFICATION - PROPER LOGIC NEEDED HERE
              // Check if this segment falls within a processed Civet block in `svelteWithTs`
              // If yes, use block.map (which is Civet snippet -> TS snippet) and baseMap to trace
              // If no, use baseMap directly
              
              // Fallback for now - direct mapping (needs enhancement)
              if (baseMap.sources && baseMap.sources[sourceIdx] !== undefined) {
                addMapping(gen, {
                  generated: { line: lineIdx + 1, column: genCol },
                  original: { line: origLine0 + 1, column: origCol0 },
                  source: baseMap.sources[sourceIdx],
                  name: nameIdx !== undefined && baseMap.names ? baseMap.names[nameIdx] : undefined,
                });
              }
            });
          });

          const out = toEncodedMap(gen);
          out.mappings = encodeMappings((gen as any).toDecodedMappings()); // Re-encode
          return out;
        }
        ```
    - [ ] In `svelte2tsx/index.ts` (or a duplicated test file), switch to your prototype:
        ```ts
        // import { chainMapsV3 } from './utils/civetMapChainer'; // old
        import { chainMapsV3 } from './utils/civetNewMapChainer'; // new
        // …
        // const finalMap = chainMapsV3(baseMap, civetBlocksForChaining, svelte, str.original);
        ```
    - [ ] Compare to unplugin's workflow for inspiration if needed (AST + SourceMap wrapper, bundler composition, diagnostics remapping).
    - [ ] Run and validate:
        - Write new unit tests for `chainMapsV3`, feeding in a small baseMap + snippetMap pair.
        - Confirm key tokens (`*`, `;`, variable names) map back correctly from final TSX to original Svelte (via Civet).
    - [ ] Once `chainMapsV3` proves correct, fold it into the main pipeline, deprecate the old `civetMapChainer.ts`, and rename modules from `civetNew*` to `civet*`.

- [ ] **Phase 4: Cleanup, Documentation & Long-Term Stability**
    - [ ] Delete legacy mapping utilities (old chainer, `normalizeCivetMap` related code) and dead code.
    - [ ] Update `README.md` and internal docs (like `CIVET-AST-MAPPING-PLAN.md`) to describe the new pipeline: "AST → V3 → remapping."
    - [ ] Add end-to-end integration tests (Civet in a real Svelte project) to guard against future regressions.
    - [ ] Evaluate performance impact; if necessary, batch or cache remapping calls for large codebases.

---

**Next Steps**: Prioritize Phase 1, then iterate quickly through Phases 2–3. This approach aims for bulletproof mapping precision and aims to remove complex custom VLQ-stitching logic. 