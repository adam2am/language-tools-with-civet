# Civet AST-Driven Source Map Pipeline Plan

This document sketches a multi-phase roadmap to migrate our current hand-rolled Civet→TSX mapping into an AST-driven, precision-first approach using Civet's own V3 sourcemaps combined with a standard remapping library.

---

## Phase 1: Enable AST-Based V3 Map in `compileCivet`

**Goal**: Produce a fully-formed, standard V3 sourcemap directly from Civet, mapping the original Svelte snippet to generated TS, without manual "lines" decoding.

1.  Update `compileCivet` to:
    - Call `civet.compile(snippet, { ast: true, sourceMap: true, filename })` to get an AST + raw Civet map object.
    - Instantiate a `new SourceMap(snippet)` wrapper.
    - Run `civet.generate(ast, { js: false, sourceMap: civetMap })` so all mappings are recorded.
    - Call `civetMap.json(filename, filename)` to emit a proper Raw V3 map.
    - Return `{ code, rawMap: v3Map }`.

2.  Add `outputStandardV3Map: true` flag or equivalent option in our `compileCivet` call sites.

3.  Validate by inspecting a few Civet snippets in isolation and confirming the `.mappings` string aligns with expected token positions.

**Deliverable**: Unit tests for direct Civet snippet→TS mapping, asserting key tokens map back to correct source lines/columns.

---

## Phase 2: Simplify `preprocessCivet`

**Goal**: Stop manual normalizing of Civet's "lines" arrays; simply attach the V3 map produced in Phase 1.

1.  Remove calls to `normalizeCivetMap`.
2.  In `preprocessCivet`, once `compileCivet` yields `rawMap`, directly assign that V3 map to each `CivetBlockInfo`.
3.  Retain only the logic that computes TSX-within-Svelte offsets (start/end offsets, line/col starts).

**Deliverable**: Confirm that the preprocessor still places TS code in the right location, and that each `block.map` is a valid V3 map.

---

## Phase 3: Prototype New Map Chainer Using `@jridgewell/gen-mapping`

**Goal**: Build a new map chainer that composes our base Svelte→TSX V3 map with Civet's V3 snippet maps using `@jridgewell/gen-mapping` and `@jridgewell/sourcemap-codec`, without the old `chainMaps` logic.

1.  Install dependencies:
    ```bash
    pnpm add -D @jridgewell/gen-mapping @jridgewell/sourcemap-codec @jridgewell/trace-mapping
    ```

2.  Create a parallel prototype module `src/utils/civetNewMapChainer.ts`:
    ```ts
    import { decode as decodeMappings, encode as encodeMappings } from '@jridgewell/sourcemap-codec';
    import { GenMapping, setSourceContent, addMapping, toEncodedMap } from '@jridgewell/gen-mapping';
    import { TraceMap, traceSegment } from '@jridgewell/trace-mapping';
    import type { EncodedSourceMap } from './civetTypes';
    import type { CivetBlockInfo } from './civetPreprocessor';

    /**
     * Compose a base V3 map (Svelte→TSX) with one or more Civet snippet maps (snippet→TS).
     */
    export function chainMapsV3(
      baseMap: EncodedSourceMap,
      blocks: CivetBlockInfo[],        // block.map is now a V3 map
      originalSvelte: string,
      svelteWithTs: string
    ): EncodedSourceMap {
      // 1) Decode the base map
      const decoded = decodeMappings(baseMap.mappings);

      // 2) Initialize a generator for the final map
      const gen = new GenMapping({ file: baseMap.file });
      setSourceContent(gen, baseMap.sources[0], originalSvelte);

      // 3) For each generated line and segment:
      decoded.forEach((segments, lineIdx) => {
        segments.forEach(seg => {
          const [genCol, , origLine0, origCol0, nameIdx] = seg;
          // Determine whether this segment falls inside a Civet block...
          // (compute charOffset in svelteWithTs, find matching block)
          // If inside block:
          //   - let tracer = new TraceMap(block.map)
          //   - const [_,__,origLine0InSvelte, origColInSvelte] = traceSegment(tracer, relLine, relCol)
          //   - addMapping(gen, { generated:{line: lineIdx+1, column: genCol}, original:{line: origLine0InSvelte+1, column: origColInSvelte}, name: baseMap.names[nameIdx] })
          // Else (template segment):
          //   - addMapping(gen, { generated:{...}, original:{line: origLine0+1, column: origCol0}, name })
        });
      });

      // 4) Emit the final encoded mappings
      //    (gen.toDecodedMappings() yields array-of-array of segments)
      const decodedOut = (gen as any).toDecodedMappings();
      const mappings = encodeMappings(decodedOut);
      const out = toEncodedMap(gen);
      out.mappings = mappings;
      return out;
    }
    ```

3.  In `svelte2tsx/index.ts`, switch to your prototype:
    ```ts
    import { chainMapsV3 } from './utils/civetNewMapChainer';
    // …
    const finalMap = chainMapsV3(baseMap, civetBlocksForChaining, svelte, str.original);
    ```

4.  Compare to unplugin's workflow:
    - **AST + SourceMap wrapper**
      ```js
      const ast = civet.compile(source, { ast: true, sourceMap: true, filename });
      const civetMap = new SourceMap(source);
      const code = civet.generate(ast, { js: false, sourceMap: civetMap });
      const rawV3 = civetMap.json(filename, filename);
      ```
    - **Bundler composition**: Rollup/Vite auto-merges your `{code, map: rawV3}` with upstream maps.
    - **Diagnostics**: later `remapRange(diagnosticRange, civetMap.lines)` gives exact offsets in `.civet`.

5.  Run and validate:
    - Write new tests for `chainMapsV3`, feeding in a small baseMap + snippetMap pair.
    - Confirm key tokens (`*`, `;`, variable names) map back correctly.

6.  Once `chainMapsV3` proves correct, fold it into the main pipeline, deprecate `civetMapChainer.ts`, and rename modules from `civetNew*` to `civet*`.

---

## Phase 4: Cleanup, Documentation & Long-Term Stability

1.  Delete legacy mapping utilities and dead code.
2.  Update `README.md` and internal docs to describe the new pipeline: "AST → V3 → remapping."
3.  Add end-to-end integration tests (Civet in a real Svelte project) to guard against future regressions.
4.  Evaluate performance impact; if necessary, batch or cache remapping calls for large codebases.

---

**Next Steps**: Prioritize Phase 1, then iterate quickly through Phases 2–3. This approach will give us bulletproof mapping precision (thanks to Civet's AST) and remove hundreds of lines of custom VLQ-stitching logic. 