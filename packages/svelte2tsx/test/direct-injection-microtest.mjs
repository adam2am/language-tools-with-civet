#!/usr/bin/env node
// direct-injection-microtest.mjs
// Standalone microtest for direct Civet injection in Svelte→TSX pipeline
// Run with: node direct-injection-microtest.mjs

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { svelte2tsx } from '../index.mjs';
import { TraceMap, originalPositionFor, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping';

const svelteFilePath = 'test-direct-injection.svelte';
const logFile = path.join(path.dirname(new URL(import.meta.url).pathname), 'direct-injection-microtest.log');

function offsetToPos(str, offset) {
  const segments = str.slice(0, offset).split('\n');
  return { line: segments.length, column: segments[segments.length - 1].length };
}

const testCases = [
  {
    name: 'Instance script literal',
    // inside <script lang="civet"> ... </script>
    svelteSnippet: `outputVar := \"Hello, World!\"`,
    literal: '"Hello, World!"'
  },
  {
    name: 'Module script literal',
    // <script context="module" lang="civet"> ... </script>
    svelteSnippet: `export greeting := \"Hi there\"`,
    literal: '"Hi there"'
  },  
  {
    name: 'Python-style randomizer snippet',
    svelteSnippet: `// Simple randomizer function that returns 1 or 2
randomInt := -> Math.floor(Math.random() * 2) + 1

// Alternative one-liner approach
getRandomOneOrTwo := -> if Math.random() < 0.5 then 1 else 2

// Usage example
randomValue := randomInt()

// Civet-style conditional expressions
let result: string
if randomValue is 1
  result = "condition is true"
else
  result = "condition is false"
console.log result`,
    literal: '"condition is true"'
  },
  {
    name: 'Parsing error',
    // <script context="module" lang="civet"> ... </script>
    svelteSnippet: `// Simple randomizer function that returns 1 or 2
if value 
      a := "yeap"
else  
      a: = "nope"
console.log at`,
    literal: 'if'
  },
];

let allPassed = true;
for (const { name, svelteSnippet, literal } of testCases) {
  try {
    const svelteContent = `<script lang=\"civet\">\n${svelteSnippet}\n</script>`;
    // for module test, inject context=module
    const fullContent = name.startsWith('Module')
      ? `<script context=\"module\" lang=\"civet\">\n${svelteSnippet}\n</script>`
      : svelteContent;

    // run pipeline
    const { code: tsxCode, map: finalMap } = svelte2tsx(fullContent, { filename: svelteFilePath, isTsFile: false });
    const tsxOffset = tsxCode.indexOf(literal);
    assert(tsxOffset !== -1, `${name}: literal not found in TSX code: ${literal}`);

    const tsxPos = offsetToPos(tsxCode, tsxOffset);
    const trace = new TraceMap(finalMap);
    const orig = originalPositionFor(trace, { line: tsxPos.line, column: tsxPos.column }, LEAST_UPPER_BOUND);

    const origOffset = fullContent.indexOf(literal);
    assert(origOffset !== -1, `${name}: literal not found in Svelte content: ${literal}`);
    const origPos = offsetToPos(fullContent, origOffset);

    assert.strictEqual(orig.source, svelteFilePath, `${name}: source mismatch`);
    assert.strictEqual(orig.line, origPos.line, `${name}: line mismatch`);
    assert.strictEqual(orig.column, origPos.column, `${name}: column mismatch`);

    console.log(`✔ ${name}: mapping correct (line ${orig.line}, col ${orig.column})`);
  } catch (err) {
    allPassed = false;
    const msg = typeof err.message === 'string' ? err.message : String(err);
    const detail = `--- ${name} FAILED ---\n${msg}\nSnippet: ${svelteSnippet}\n`;
    fs.writeFileSync(logFile, detail);
    console.error(`✖ ${name}: see log at ${logFile}`);
  }
}

if (allPassed) {
  console.log('✔ direct-injection-microtest: all cases passed');
  process.exit(0);
} else {
  process.exit(1);
} 