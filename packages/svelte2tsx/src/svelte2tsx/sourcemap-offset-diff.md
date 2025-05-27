@sourcemap-offset-refactor.md ```diff

[X] diff --git a/packages/svelte2tsx/src/svelte2tsx/index.ts b/packages/svelte2tsx/src/svelte2tsx/index.ts
index 0cfb9d2..420d1e5 100644
--- a/packages/svelte2tsx/src/svelte2tsx/index.ts
+++ b/packages/svelte2tsx/src/svelte2tsx/index.ts
@@ -12,8 +12,8 @@
 import { parse, VERSION } from 'svelte/compiler';
 import { getTopLevelImports } from './utils/tsAst';
 import { preprocessCivet } from './utils/civetPreprocessor';
-import { chainMaps, ChainBlock } from './utils/civetMapChainer';
-import type { EncodedSourceMap } from './utils/civetMapChainer';
+import { chainMaps, EnhancedChainBlock } from './utils/civetMapChainer';
+import type { EncodedSourceMap } from './utils/civetMapChainer';
+import { getLineAndColumnForOffset } from './utils/civetUtils';
 
 const svelte2tsxDebug = false;
 
@@ -55,8 +55,6 @@
         if (svelte2tsxDebug && logOptions.preprocessCivetOutput) console.log(`[svelte2tsx-index.ts] preprocessCivet output: moduleInfo=${JSON.stringify(civetModuleInfo)}, instanceInfo=${JSON.stringify(civetInstanceInfo)}`);
     }
 
-    if (svelte2tsxDebug && logOptions.preprocessCivetOutput) console.log(`[svelte2tsx-index.ts] preprocessCivet output: moduleInfo=${JSON.stringify(civetModuleInfo)}, instanceInfo=${JSON.stringify(civetInstanceInfo)}`);
-
     if (svelte2tsxDebug) console.log('[svelte2tsx-index.ts] Svelte content after preprocessCivet (svelteWithTs):\n', svelteWithTs);
 
     const str = new MagicString(svelteWithTs);
@@ -221,24 +219,48 @@
         // Debug: log head of baseMap mappings
         if (svelte2tsxDebug && logOptions.baseMapMappingsHead) console.log(`[svelte2tsx-index.ts] baseMap mappings head: ${baseMap.mappings.split(';').slice(0,3).join(';')}`);
         // Collect Civet blocks for chaining
-        const blocks: ChainBlock[] = [];
+        const civetBlocksForChaining: EnhancedChainBlock[] = [];
+
         if (civetModuleInfo) {
             if (svelte2tsxDebug && logOptions.moduleChainingOffsets) console.log(`[svelte2tsx-index.ts] queueing module block map at offsets ${civetModuleInfo.tsStartInSvelteWithTs}-${civetModuleInfo.tsEndInSvelteWithTs}`);
-            blocks.push({
+            const { line: startLine, column: startCol } = getLineAndColumnForOffset(svelteWithTs, civetModuleInfo.tsStartInSvelteWithTs);
+            const { line: endLine } = getLineAndColumnForOffset(svelteWithTs, civetModuleInfo.tsEndInSvelteWithTs);
+            civetBlocksForChaining.push({
                 map: civetModuleInfo.map,
-                tsStart: civetModuleInfo.tsStartInSvelteWithTs,
-                tsEnd: civetModuleInfo.tsEndInSvelteWithTs
+                tsStartCharInSvelteWithTs: civetModuleInfo.tsStartInSvelteWithTs,
+                tsEndCharInSvelteWithTs: civetModuleInfo.tsEndInSvelteWithTs,
+                tsStartLineInSvelteWithTs: startLine,
+                tsStartColInSvelteWithTs: startCol,
+                tsEndLineInSvelteWithTs: endLine,
+                originalCivetLineCount: civetModuleInfo.originalCivetLineCount,
+                compiledTsLineCount: civetModuleInfo.compiledTsLineCount
             });
         }
         if (civetInstanceInfo) {
             if (svelte2tsxDebug && logOptions.instanceChainingOffsets) console.log(`[svelte2tsx-index.ts] queueing instance block map at offsets ${civetInstanceInfo.tsStartInSvelteWithTs}-${civetInstanceInfo.tsEndInSvelteWithTs}`);
-            blocks.push({
+            const { line: startLine, column: startCol } = getLineAndColumnForOffset(svelteWithTs, civetInstanceInfo.tsStartInSvelteWithTs);
+            const { line: endLine } = getLineAndColumnForOffset(svelteWithTs, civetInstanceInfo.tsEndInSvelteWithTs);
+            civetBlocksForChaining.push({
                 map: civetInstanceInfo.map,
-                tsStart: civetInstanceInfo.tsStartInSvelteWithTs,
-                tsEnd: civetInstanceInfo.tsEndInSvelteWithTs
+                tsStartCharInSvelteWithTs: civetInstanceInfo.tsStartInSvelteWithTs,
+                tsEndCharInSvelteWithTs: civetInstanceInfo.tsEndInSvelteWithTs,
+                tsStartLineInSvelteWithTs: startLine,
+                tsStartColInSvelteWithTs: startCol,
+                tsEndLineInSvelteWithTs: endLine,
+                originalCivetLineCount: civetInstanceInfo.originalCivetLineCount,
+                compiledTsLineCount: civetInstanceInfo.compiledTsLineCount
             });
         }
+
+        // Sort blocks by start character offset, crucial for cumulative delta calculation
+        civetBlocksForChaining.sort((a, b) => a.tsStartCharInSvelteWithTs - b.tsStartCharInSvelteWithTs);
+
         // Chain all blocks in one pass
         let finalMap = baseMap;
-        if (blocks.length) {
-            finalMap = chainMaps(baseMap, blocks);
+        if (civetBlocksForChaining.length) {
+            // Pass originalSvelteContent (named `svelte` here) and svelteWithTs (str.original)
+            finalMap = chainMaps(baseMap, civetBlocksForChaining, svelte, str.original);
             if (svelte2tsxDebug && logOptions.finalMapMappingsHead) console.log(`[svelte2tsx-index.ts] after chaining all blocks, mappings head: ${finalMap.mappings.split(';').slice(0,3).join(';')}`);
         }
         const finalTsxCode = str.toString();

[X] diff --git a/packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts b/packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts
index 608815d..720f885 100644
--- a/packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts
+++ b/packages/svelte2tsx/src/svelte2tsx/utils/civetMapChainer.ts
@@ -13,11 +13,18 @@
 }
 
 // A mapping block from a Civet-generated map to apply
-export interface ChainBlock {
+export interface EnhancedChainBlock {
   map: EncodedSourceMap;
-  tsStart: number;
-  tsEnd: number;
+  tsStartCharInSvelteWithTs: number;
+  tsEndCharInSvelteWithTs: number;
+  tsStartLineInSvelteWithTs: number; // 1-based
+  tsStartColInSvelteWithTs: number;  // 0-based
+  tsEndLineInSvelteWithTs: number;   // 1-based
+  originalCivetLineCount: number;
+  compiledTsLineCount: number;
 }
+
+const chainCivetDebug = false; // Master switch for all logs in this file (set to false for production)
 
-const chainCivetDebug = true; // Master switch for all logs in this file (enabled for debugging)
-
 const logOptions = {
   input: true,     // Logs input baseMap and civetMap details
   decodedBase: false, // Logs decoded baseMap segments
@@ -29,58 +36,165 @@
   encodedOutput: true  // Logs the final encoded mappings string
 };
 
+class LineOffsetCalculator {
+  private lineOffsets: number[];
+  constructor(private content: string) {
+      this.lineOffsets = [0]; // First line starts at offset 0
+      for (let i = 0; i < content.length; i++) {
+          if (content[i] === '\n') {
+              this.lineOffsets.push(i + 1);
+          }
+      }
+  }
+
+  getOffset(line1Based: number, col0Based: number): number {
+      if (line1Based < 1 || line1Based > this.lineOffsets.length) {
+          if (chainCivetDebug) console.warn(`[LineOffsetCalculator] Line ${line1Based} out of bounds (1-${this.lineOffsets.length}). Clamping.`);
+          line1Based = Math.max(1, Math.min(line1Based, this.lineOffsets.length));
+      }
+      const lineStartOffset = this.lineOffsets[line1Based - 1];
+      return lineStartOffset + col0Based;
+  }
+}
+
 /**
  * Chain multiple Civet-generated source maps into a base map.
  * This runs synchronously using trace-mapping and sourcemap-codec.
+ * This new version correctly handles line shifts for template content.
  */
 export function chainMaps(
   baseMap: EncodedSourceMap,
-  blocks: ChainBlock[]
+  blocks: EnhancedChainBlock[], // Assumed sorted by tsStartCharInSvelteWithTs
+  originalSvelteContent: string,
+  svelteWithTsContent: string // Content to which baseMap's original_lines/cols refer
 ): EncodedSourceMap {
-  if (chainCivetDebug && logOptions.input) console.log('[chainMaps] Starting chaining of Civet blocks');
-  // Decode base mappings once
-  let decoded = decode(baseMap.mappings);
-  if (chainCivetDebug && logOptions.decodedBase) console.log('[chainMaps] Decoded baseMap:', JSON.stringify(decoded, null, 2));
-  // For each Civet block, remap segments
-  for (const { map: civetMap } of blocks) {
-    if (chainCivetDebug && logOptions.tracerInit) console.log('[chainMaps] Init tracer with block mappings');
-    const tracer = new TraceMap({
-      version: 3,
-      sources: civetMap.sources,
-      names: civetMap.names,
-      mappings: civetMap.mappings,
-      file: civetMap.file,
-      sourcesContent: civetMap.sourcesContent,
-    });
-    decoded = decoded.map((lineSegments, lineIndex) => {
-      if (chainCivetDebug && logOptions.lineProcessing) console.log(`[chainMaps] Processing gen line ${lineIndex+1}`);
-      return lineSegments.map((segment) => {
-        if (chainCivetDebug && logOptions.segmentTrace) console.log('[chainMaps] Segment before trace:', segment);
-        const [genCol, sourceIdx, origLine, origCol, nameIdx] = segment as [number, number, number, number, number];
-        let traced: readonly number[] | null = null;
-        try {
-          traced = traceSegment(tracer, origLine, origCol);
-        } catch {
-          /* no trace available */
+  if (chainCivetDebug && logOptions.input) {
+    console.log('[chainMaps] Starting refactored chaining.');
+    console.log('[chainMaps] BaseMap sources:', baseMap.sources);
+    console.log('[chainMaps] Number of blocks:', blocks.length);
+    blocks.forEach((block, i) => console.log(`[chainMaps] Block ${i}: originalLines=${block.originalCivetLineCount}, compiledLines=${block.compiledTsLineCount}, tsStartChar=${block.tsStartCharInSvelteWithTs}, tsEndChar=${block.tsEndCharInSvelteWithTs}, tsStartLine=${block.tsStartLineInSvelteWithTs}`));
+  }
+
+  const svelteWithTsLineOffsets = new LineOffsetCalculator(svelteWithTsContent);
+  const decodedBaseMap = decode(baseMap.mappings);
+  if (chainCivetDebug && logOptions.decodedBase) console.log('[chainMaps] Decoded baseMap segments (first 5 lines):', JSON.stringify(decodedBaseMap.slice(0,5)));
+
+  const blockTracers = blocks.map(block => new TraceMap(block.map));
+
+  const cumulativeLineDeltas: number[] = [0]; 
+  let currentCumulativeDelta = 0;
+  for (let i = 0; i < blocks.length; i++) {
+    // Note: This delta is calculated based on line counts passed from preprocessCivet.
+    // It reflects the change in line count from original Civet to compiled TS for that block.
+    currentCumulativeDelta += (blocks[i].compiledTsLineCount - blocks[i].originalCivetLineCount);
+    cumulativeLineDeltas.push(currentCumulativeDelta);
+  }
+
+  const remappedLines: number[][][] = [];
+
+  for (const lineSegments of decodedBaseMap) {
+    const remappedLineSegments: number[][] = [];
+    for (const segment of lineSegments) {
+      const [
+        generatedCol, 
+        sourceIndex, 
+        origLine_0based_in_svelteWithTs, 
+        origCol_0based_in_svelteWithTs, 
+        nameIndex     
+      ] = segment;
+
+      const charOffsetInSvelteWithTs = svelteWithTsLineOffsets.getOffset(
+        origLine_0based_in_svelteWithTs + 1, 
+        origCol_0based_in_svelteWithTs
+      );
+
+      let targetBlock: EnhancedChainBlock | undefined = undefined;
+      let targetBlockIndex = -1;
+      for (let i = 0; i < blocks.length; i++) {
+        if (charOffsetInSvelteWithTs >= blocks[i].tsStartCharInSvelteWithTs &&
+            charOffsetInSvelteWithTs < blocks[i].tsEndCharInSvelteWithTs) {
+          targetBlock = blocks[i];
+          targetBlockIndex = i;
+          break;
         }
-        if (traced && traced.length >= 4) {
-          const [, , newLine, newCol] = traced;
-          return [genCol, 0, newLine, newCol, nameIdx] as [number, number, number, number, number];
+      }
+
+      if (targetBlock) {
+        const tracer = blockTracers[targetBlockIndex];
+        const relLine_0based_in_ts_snippet = (origLine_0based_in_svelteWithTs + 1) - targetBlock.tsStartLineInSvelteWithTs;
+        const relCol_0based_in_ts_snippet = (relLine_0based_in_ts_snippet === 0)
+          ? origCol_0based_in_svelteWithTs - targetBlock.tsStartColInSvelteWithTs
+          : origCol_0based_in_svelteWithTs;
+        
+        const finalRelCol = Math.max(0, relCol_0based_in_ts_snippet);
+
+        if (chainCivetDebug && logOptions.segmentTrace) {
+            console.log(`[chainMaps] Script seg: orig (sWTS) L${origLine_0based_in_svelteWithTs+1}C${origCol_0based_in_svelteWithTs} (@${charOffsetInSvelteWithTs}) -> Block ${targetBlockIndex} rel L${relLine_0based_in_ts_snippet}C${finalRelCol}`);
         }
-        // fallback to original segment
-        return [genCol, sourceIdx, origLine, origCol, nameIdx] as [number, number, number, number, number];
-      });
-    });
+
+        let traced = null;
+        if (relLine_0based_in_ts_snippet >= 0 && finalRelCol >= 0) {
+            try {
+                traced = traceSegment(tracer, relLine_0based_in_ts_snippet, finalRelCol);
+            } catch (e) { 
+                if (chainCivetDebug) console.warn(`[chainMaps] Error tracing script segment: L${relLine_0based_in_ts_snippet}C${finalRelCol}`, e);
+            }
+        }
+
+        if (traced && traced.length >= 4) {
+          remappedLineSegments.push([
+            generatedCol,
+            0, 
+            traced[2], 
+            traced[3], 
+            nameIndex 
+          ]);
+          if (chainCivetDebug && logOptions.segmentTrace) console.log(`[chainMaps] Script traced to (Svelte): L${traced[2]+1}C${traced[3]}`);
+        } else {
+          if (chainCivetDebug) console.warn(`[chainMaps] Failed to trace script segment or invalid trace for (sWTS) L${origLine_0based_in_svelteWithTs+1}C${origCol_0based_in_svelteWithTs} (rel L${relLine_0based_in_ts_snippet}C${finalRelCol}). Traced: ${JSON.stringify(traced)}`);
+          
+          let firstMappedOriginalLine0Based = -1;
+          try { // Fallback: map to start of script block in original svelte
+            const firstLineTrace = traceSegment(tracer, 0, 0);
+            if (firstLineTrace && firstLineTrace.length >= 3) firstMappedOriginalLine0Based = firstLineTrace[2];
+          } catch {}
+
+          if (firstMappedOriginalLine0Based !== -1) {
+             remappedLineSegments.push([generatedCol, 0, firstMappedOriginalLine0Based, 0, nameIndex]);
+             if (chainCivetDebug) console.warn(`[chainMaps] Fallback1: Mapped to L${firstMappedOriginalLine0Based+1}C0 (original Svelte)`);
+          } else { // Fallback 2: treat as template segment (adjust by cumulative delta)
+            const delta = cumulativeLineDeltas[targetBlockIndex]; // Delta from blocks *before* this one
+            const finalOriginalLine_0based_in_Svelte = origLine_0based_in_svelteWithTs - delta;
+            remappedLineSegments.push([generatedCol, 0, finalOriginalLine_0based_in_Svelte, origCol_0based_in_svelteWithTs, nameIndex]);
+            if (chainCivetDebug) console.warn(`[chainMaps] Fallback2: Mapped as template to L${finalOriginalLine_0based_in_Svelte+1}C${origCol_0based_in_svelteWithTs} (original Svelte)`);
+          }
+        }
+      } else {
+        // Template segment
+        let applicableDelta = 0;
+        // Find which block this template segment is after (or if it's before all blocks)
+        for (let k = 0; k < blocks.length; k++) {
+            if (charOffsetInSvelteWithTs < blocks[k].tsStartCharInSvelteWithTs) {
+                // Segment is before block k, so delta is from blocks 0 to k-1
+                applicableDelta = cumulativeLineDeltas[k];
+                break;
+            }
+            // If we iterated past block k (or segment is within its range but not handled as script),
+            // then the delta from block k (and all previous) applies.
+            applicableDelta = cumulativeLineDeltas[k+1];
+        }
+        // If charOffsetInSvelteWithTs is after all blocks, applicableDelta will be cumulativeLineDeltas[blocks.length].
+
+        const finalOriginalLine_0based_in_Svelte = origLine_0based_in_svelteWithTs - applicableDelta;
+        remappedLineSegments.push([
+          generatedCol,
+          0, 
+          finalOriginalLine_0based_in_Svelte,
+          origCol_0based_in_svelteWithTs, 
+          nameIndex
+        ]);
+        if (chainCivetDebug && logOptions.segmentTrace) console.log(`[chainMaps] Template seg: (sWTS) L${origLine_0based_in_svelteWithTs+1}C${origCol_0based_in_svelteWithTs} -> delta ${applicableDelta} -> (Svelte) L${finalOriginalLine_0based_in_Svelte+1}C${origCol_0based_in_svelteWithTs}`);
+      }
+    }
+    remappedLines.push(remappedLineSegments);
   }
-  // Encode the merged mappings
-  const mappings = encode(decoded);
-  if (chainCivetDebug && logOptions.encodedOutput) console.log('[chainMaps] Encoded chained mappings:', mappings);
-  // Return a new source map preserving baseMap metadata
-  return { ...baseMap, mappings };
+
+  if (chainCivetDebug && logOptions.remappedSegments) console.log('[chainMaps] Remapped segments (first 5 lines):', JSON.stringify(remappedLines.slice(0,5)));
+  if (chainCivetDebug && logOptions.remappedSummary) {
+    console.log('[chainMaps] Remapped summary (first 5 lines):');
+    remappedLines.slice(0,5).forEach((line, i) => console.log(`  Line ${i+1}: ${JSON.stringify(line)}`));
+  }
+  
+  const finalEncodedMappings = encode(remappedLines);
+  if (chainCivetDebug && logOptions.encodedOutput) console.log('[chainMaps] Final encoded mappings:', finalEncodedMappings.slice(0,100) + "...");
+
+  return {
+    version: 3,
+    sources: [baseMap.sources[0]], 
+    sourcesContent: [originalSvelteContent],
+    names: baseMap.names,
+    mappings: finalEncodedMappings,
+    file: baseMap.file 
+  };
 }
 
 // For backward compatibility: single-block chaining
 // This function's old signature is insufficient for the new chainMaps logic.
 // It would need full EnhancedChainBlock details.
 // If svelte2tsx/index.ts is updated to call the main chainMaps directly, this might become obsolete.
+// For now, it's updated to accept parts of EnhancedChainBlock, but it might not be practically callable
+// without significant changes at its call sites if they don't have all this information.
 export function chainSourceMaps(
   baseMap: EncodedSourceMap,
-  civetMap: EncodedSourceMap,
-  tsStart: number,
-  tsEnd: number
+  blockDetails: Omit<EnhancedChainBlock, 'map'> & { map: EncodedSourceMap },
+  originalSvelteContent: string,
+  svelteWithTsContent: string
 ): EncodedSourceMap {
-  return chainMaps(baseMap, [{ map: civetMap, tsStart, tsEnd }]);
+  const block: EnhancedChainBlock = {
+    map: blockDetails.map,
+    tsStartCharInSvelteWithTs: blockDetails.tsStartCharInSvelteWithTs,
+    tsEndCharInSvelteWithTs: blockDetails.tsEndCharInSvelteWithTs,
+    tsStartLineInSvelteWithTs: blockDetails.tsStartLineInSvelteWithTs,
+    tsStartColInSvelteWithTs: blockDetails.tsStartColInSvelteWithTs,
+    tsEndLineInSvelteWithTs: blockDetails.tsEndLineInSvelteWithTs,
+    originalCivetLineCount: blockDetails.originalCivetLineCount,
+    compiledTsLineCount: blockDetails.compiledTsLineCount,
+  };
+  return chainMaps(baseMap, [block], originalSvelteContent, svelteWithTsContent);
 } 

[X] diff --git a/packages/svelte2tsx/src/svelte2tsx/utils/civetPreprocessor.ts b/packages/svelte2tsx/src/svelte2tsx/utils/civetPreprocessor.ts
index 3215795..3d0b620 100644
--- a/packages/svelte2tsx/src/svelte2tsx/utils/civetPreprocessor.ts
+++ b/packages/svelte2tsx/src/svelte2tsx/utils/civetPreprocessor.ts
@@ -52,11 +52,17 @@
     // Replace the Civet snippet with the compiled TS code (dedented)
     ms.overwrite(start, end, compiledTsCode);
 
+    // Calculate line counts
+    const originalCivetLineCount = dedentedSnippet.split('\n').length;
+    const compiledTsLineCount = compiledTsCode.split('\n').length;
+
     const tsEndInSvelteWithTs = start + compiledTsCode.length;
     const blockData: CivetBlockInfo = {
       map,
       tsStartInSvelteWithTs: start,
       tsEndInSvelteWithTs,
-      originalContentStartLine: originalContentStartLine_1based
+      originalContentStartLine: originalContentStartLine_1based,
+      originalCivetLineCount,
+      compiledTsLineCount
     };
 
     if (isModule) {

[X] diff --git a/packages/svelte2tsx/src/svelte2tsx/utils/civetTypes.ts b/packages/svelte2tsx/src/svelte2tsx/utils/civetTypes.ts
index 58c9846..81e1b12 100644
--- a/packages/svelte2tsx/src/svelte2tsx/utils/civetTypes.ts
+++ b/packages/svelte2tsx/src/svelte2tsx/utils/civetTypes.ts
@@ -41,6 +41,10 @@
     tsEndInSvelteWithTs: number;
     /** 1-based line number in the original Svelte file where the Civet content started */
     originalContentStartLine: number;
+    /** Line count of the original (dedented) Civet snippet */
+    originalCivetLineCount: number;
+    /** Line count of the compiled TypeScript code for this block */
+    compiledTsLineCount: number;
 }
 
 /**