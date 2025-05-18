import MagicString from 'magic-string';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { decode } from '@jridgewell/sourcemap-codec';

console.log("---- MagicString Pre-compiled Script Inspection Test ----");

const svelteFileName = 'test-component-with-ts.svelte';

// This Svelte content ALREADY has TypeScript in its script tag.
// This simulates the state AFTER Stage A (Civet->TS compilation) and
// BEFORE Stage B (Svelte-with-TS -> TSX processing by MagicString).
const originalSvelteWithTsContent = `
<script>
  // This is pre-compiled TypeScript
  const message: string = "Hello from TS";
  function greet(name: string): string {
    return \`Hello, \${name}!\`;
  }
  console.log(greet("World"));
</script>

<h1>Svelte Markup</h1>

<style>
  h1 { color: blue; }
</style>
`;

const s = new MagicString(originalSvelteWithTsContent);

// The s.append() was causing confusion with line splitting for analysis.
// For testing MagicString's mapping of *original* content, it's not strictly necessary
// if we assume MagicString processes the whole file for map generation, which it does.
// s.append("\\n// Appended comment by MagicString"); 

const finalContent = s.toString(); // Recalculate finalContent if s.append is re-enabled
console.log("\\n---- Final Content (same as original if no append) ----");
console.log(finalContent);


const svelteToTsxMapJson = s.generateMap({
  source: svelteFileName,
  hires: true,
  includeContent: true,
});

console.log("\\n---- Generated Svelte-with-TS-to-TSX Sourcemap JSON ----");
console.log(JSON.stringify(svelteToTsxMapJson, null, 2));

const baseMap = new TraceMap(svelteToTsxMapJson);
const originalLines = originalSvelteWithTsContent.split('\n');

console.log("\\n---- Querying the Svelte-with-TS-to-TSX Map (for the TS script block) ----");

// Script content is on original lines 3-8 (0-indexed: 2-7)
const scriptOriginalStartLine = 2; // 0-indexed: line containing "  // This is pre-compiled TypeScript"
const scriptOriginalEndLine = 7;   // 0-indexed: line containing "  console.log(greet("World"));"

for (let originalLineIdx = scriptOriginalStartLine; originalLineIdx <= scriptOriginalEndLine; originalLineIdx++) {
    const currentOriginalLineText = originalLines[originalLineIdx];
    const originalLineNumForDisplay = originalLineIdx + 1; // 1-based for display

    // For MagicString, if content is unchanged, generated line should be original line.
    // If svelte2tsx were running, it would transform, but here we test raw MagicString mapping.
    // So, the generated line number in the query should be the same as original line number.
    const queryLineNum = originalLineNumForDisplay; 

    const columnsToTest = [0, 2, Math.max(0, Math.floor(currentOriginalLineText.length / 2)), Math.max(0, currentOriginalLineText.length -1)];

    console.log(`\n--- Queries for Original Svelte Line ${originalLineNumForDisplay} (text: "${currentOriginalLineText.trim()}") ---`);

    for (const col of columnsToTest) {
        if (col >= currentOriginalLineText.length && currentOriginalLineText.length > 0) { // Avoid query past EOL
             console.log(
                `Skipping Query: L${queryLineNum}C${col} - column out of bounds for original ('${currentOriginalLineText}') text.`
            );
            continue;
        }
        if (currentOriginalLineText.length === 0 && col > 0) { // For empty lines, only test col 0
            console.log(
                `Skipping Query: L${queryLineNum}C${col} - column out of bounds for empty original line.`
            );
            continue;
        }


        const queryPos = { line: queryLineNum, column: col };
        const mappedOriginalPos = originalPositionFor(baseMap, queryPos);
        
        const charInOriginal = currentOriginalLineText.charAt(col) || '';
        // Since finalContent is same as original here, charInFinal is same as charInOriginal
        const charInFinal = charInOriginal; 

        console.log(
            `Query in Final-like: L${queryPos.line}C${queryPos.column} (orig char: '${charInOriginal}') -> ` +
            `Mapped Svelte: L${mappedOriginalPos.line}C${mappedOriginalPos.column} (Source: ${mappedOriginalPos.source})`
        );
    }
}

console.log("\\n---- Segments for the script lines (decoded from map) ----");
const decoded = decode(svelteToTsxMapJson.mappings);

// originalLines[0] is the initial empty line from the template literal `
// originalLines[1] is <script>
// originalLines[2] is the first line of script content "  // This is pre-compiled TypeScript"
// So, the script lines in `decoded` correspond to these original lines.
// If MagicString hasn't changed line numbers, decoded[originalLineIdx] is the relevant segment array.

for (let originalLineIdx = scriptOriginalStartLine; originalLineIdx <= scriptOriginalEndLine; originalLineIdx++) {
    const originalLineNumForDisplay = originalLineIdx + 1;
    if (decoded[originalLineIdx]) {
        console.log(`Segments for Original Svelte Line ${originalLineNumForDisplay} (decoded[${originalLineIdx}]): ${JSON.stringify(decoded[originalLineIdx])}`);
    }
     else {
        console.log(`No segments found for Original Svelte Line ${originalLineNumForDisplay} (decoded[${originalLineIdx}])`);
    }
}

console.log("\\n---- Test Complete ----"); 