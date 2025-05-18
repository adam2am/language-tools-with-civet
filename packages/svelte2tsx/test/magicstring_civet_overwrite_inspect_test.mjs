import MagicString from 'magic-string';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { decode } from '@jridgewell/sourcemap-codec';

console.log("---- MagicString Civet Overwrite Inspection Test ----");

const svelteFileName = 'test-component.svelte';
const originalSvelteContent = `
<script lang="civet">
  # Original Civet code line 1
  # Original Civet code line 2
  # Original Civet code line 3
</script>

<h1>Hello</h1>
`;

// Simulate the start and end of the Civet code within the <script> tag
// Based on originalSvelteContent:
// <script lang="civet">
//   # Original Civet code line 1...
// 12345678901234567890123
const scriptContentStartOffset = 23; // After "<script lang="civet">\n"

const scriptContentEndOffset = originalSvelteContent.indexOf('</script>', scriptContentStartOffset);

const originalCivetBlock = originalSvelteContent.substring(scriptContentStartOffset, scriptContentEndOffset);
console.log("Original Civet Block to be overwritten:");
console.log("--------------------");
console.log(originalCivetBlock);
console.log("--------------------");
console.log(`(Offsets in Svelte: ${scriptContentStartOffset} to ${scriptContentEndOffset})`);


// This is what we'll overwrite the Civet code with.
// Imagine this is the TypeScript output from the Civet compiler.
const compiledTsCode = `
const var1 = "compiled TS line 1";
function func1() {
  return "compiled TS line 3";
}
const var2 = "compiled TS line 5";
`; // Note the leading and trailing newlines for realism if Civet adds them.

const s = new MagicString(originalSvelteContent);

// Perform the overwrite, similar to svelte2tsx/index.ts
s.overwrite(scriptContentStartOffset, scriptContentEndOffset, compiledTsCode);

console.log("\n---- MagicString content after overwrite ----");
const finalContent = s.toString();
console.log(finalContent);

const svelteToTsxMapJson = s.generateMap({
  source: svelteFileName,
  hires: true,
  includeContent: true,
});

console.log("\n---- Generated Svelte-to-TSX Sourcemap JSON (from MagicString) ----");
console.log(JSON.stringify(svelteToTsxMapJson, null, 2));

const baseMap = new TraceMap(svelteToTsxMapJson);

console.log("\n---- Querying the Svelte-to-TSX Map (for the overwritten TS block) ----");

// Calculate the start line of the compiledTsCode in the finalContent
const finalContentLines = finalContent.split('\n');
let compiledTsStartLineInFinal = -1;
const firstLineOfTsCode = compiledTsCode.trim().split('\n')[0];

for (let i = 0; i < finalContentLines.length; i++) {
  if (finalContentLines[i].includes(firstLineOfTsCode)) {
    compiledTsStartLineInFinal = i + 1; // 1-based
    break;
  }
}
console.log(`Compiled TS code seems to start on line ${compiledTsStartLineInFinal} in final output.`);

// Lines of the *compiled TS code itself* (0-based for easy iteration)
const compiledTsCodeLines = compiledTsCode.trimEnd().split('\n');

if (compiledTsStartLineInFinal !== -1) {
  for (let i = 0; i < compiledTsCodeLines.length; i++) {
    const currentTsLineInFinal = compiledTsStartLineInFinal + i; // 1-based line in finalContent
    const tsLineContent = compiledTsCodeLines[i];

    // Test a few columns on this line of compiled TS
    const columnsToTest = [0, 1, Math.max(0, Math.floor(tsLineContent.length / 2)), Math.max(0, tsLineContent.length -1)];
    
    for (const col of columnsToTest) {
      if (col >= tsLineContent.length && tsLineContent.length > 0) continue; // Avoid querying past line end

      const queryPos = { line: currentTsLineInFinal, column: col };
      const originalPos = originalPositionFor(baseMap, queryPos);

      console.log(
        `Query in TSX: L${queryPos.line}C${queryPos.column} (text: "${tsLineContent.charAt(col) || ''}" in "${tsLineContent}") -> ` +
        `Original Svelte: L${originalPos.line}C${originalPos.column} (Source: ${originalPos.source})`
      );
    }
  }
} else {
  console.log("Could not determine start line of compiled TS code in final output.");
}

console.log("\n---- Segments for the script lines (decoded) ----");
const decoded = decode(svelteToTsxMapJson.mappings);
if (compiledTsStartLineInFinal !== -1) {
    for (let i = 0; i < compiledTsCodeLines.length; i++) {
        const lineIdx = compiledTsStartLineInFinal + i - 1; // 0-based for decoded array
        if (decoded[lineIdx]) {
            console.log(`TSX Line ${lineIdx + 1} segments: ${JSON.stringify(decoded[lineIdx])}`);
        }
    }
}


console.log("\n---- Test Complete ----"); 