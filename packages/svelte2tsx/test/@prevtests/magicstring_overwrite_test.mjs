import MagicString from 'magic-string';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import path from 'path';

console.log("---- MagicString Overwrite Sourcemap Test ----");

const originalFile = 'original.txt';
const originalContent = `Line 1 of the original content.
Start of CHUNK_TO_REPLACE.
  Original line inside chunk. More text.
  Another original line in chunk.
End of CHUNK_TO_REPLACE.
Last line of the original content.
`;

const replacementContent = `  Replaced line A.
  Replaced line B.
  Replaced line C.
`;

const s = new MagicString(originalContent);

const chunkStartMarker = "Start of CHUNK_TO_REPLACE.";
const chunkEndMarker = "End of CHUNK_TO_REPLACE.";

const overwriteStart = originalContent.indexOf(chunkStartMarker) + chunkStartMarker.length + 1; // +1 for newline
const overwriteEnd = originalContent.indexOf(chunkEndMarker);

s.overwrite(overwriteStart, overwriteEnd, replacementContent);

const generatedContent = s.toString();
const map = s.generateMap({ source: originalFile, file: 'generated.txt', hires: true, includeContent: true });

console.log("\n---- Original Content ----");
console.log(originalContent);
console.log("\n---- Generated Content (after overwrite) ----");
console.log(generatedContent);
console.log("\n---- Generated Sourcemap JSON ----");
console.log(JSON.stringify(map, null, 2));

const traceMap = new TraceMap(map);

console.log("\n---- Querying the Map (Generated -> Original) ----");

// Test 1: Generated position in the NEW content (start of replacement)
let testGenPos1 = { line: 3, column: 0 }; 
let mappedOrig1 = originalPositionFor(traceMap, testGenPos1);
console.log(`Query Generated (new content start): L${testGenPos1.line}C${testGenPos1.column} -> Mapped to Original: L${mappedOrig1.line}C${mappedOrig1.column} (Source: ${mappedOrig1.source}, Name: ${mappedOrig1.name})`);

// Test 2: Generated position in the NEW content (middle of replacement)
let testGenPos2 = { line: 4, column: 0 };
let mappedOrig2 = originalPositionFor(traceMap, testGenPos2);
console.log(`Query Generated (new content middle): L${testGenPos2.line}C${testGenPos2.column} -> Mapped to Original: L${mappedOrig2.line}C${mappedOrig2.column} (Source: ${mappedOrig2.source}, Name: ${mappedOrig2.name})`);

// Test 3: Generated position in the NEW content (specific char in replacement)
let testGenPos3 = { line: 4, column: 10 };
let mappedOrig3 = originalPositionFor(traceMap, testGenPos3);
console.log(`Query Generated (new content specific char): L${testGenPos3.line}C${testGenPos3.column} -> Mapped to Original: L${mappedOrig3.line}C${mappedOrig3.column} (Source: ${mappedOrig3.source}, Name: ${mappedOrig3.name})`);

// Test 4: Generated position BEFORE the overwritten chunk
let testGenPos4 = { line: 1, column: 0 };
let mappedOrig4 = originalPositionFor(traceMap, testGenPos4);
console.log(`Query Generated (before overwritten): L${testGenPos4.line}C${testGenPos4.column} -> Mapped to Original: L${mappedOrig4.line}C${mappedOrig4.column} (Source: ${mappedOrig4.source}, Name: ${mappedOrig4.name})`);

// Test 5: Generated position AFTER the overwritten chunk
let testGenPos5 = { line: 6, column: 0 };
let mappedOrig5 = originalPositionFor(traceMap, testGenPos5);
console.log(`Query Generated (after overwritten): L${testGenPos5.line}C${testGenPos5.column} -> Mapped to Original: L${mappedOrig5.line}C${mappedOrig5.column} (Source: ${mappedOrig5.source}, Name: ${mappedOrig5.name})`);

console.log("\n---- Test Complete ----"); 