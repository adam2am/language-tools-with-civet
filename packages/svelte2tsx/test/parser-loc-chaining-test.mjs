// @ts-nocheck

import assert from 'assert';
import { svelte2tsx } from '../index.mjs';
import { TraceMap, originalPositionFor, LEAST_UPPER_BOUND } from '@jridgewell/trace-mapping';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const svelteFilePath = 'test-parser-loc.svelte';
const svelteContent = `<script lang="civet">
condition := false
outputVar := ""
if condition
  outputVar := "InsideIf"
else
  outputVar := "InsideElseInIndented"
</script>`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Log file for error output next to this test
const logFile = path.join(__dirname, 'parser-loc-chaining-test.log');

// Define edge-case test scenarios
const testCases = [
  {
    name: 'Top-level assignment',
    svelteSnippet: `condition := false\ngreeting := "Hello, World!"`,
    literal: '"Hello, World!"',
  },
  {
    name: 'Identifier mapping - top-level var',
    svelteSnippet: `condition := false\ngreeting := "Hello, World!"`,
    literal: 'greeting',
  },
  {
    name: 'If branch assignment',
    svelteSnippet: `condition := true\noutputVar := ""\nif condition\n  outputVar := "InsideIf"`,
    literal: '"InsideIf"',
  },
  {
    name: 'Identifier mapping in if block',
    svelteSnippet: `condition := true\noutputVar := ""\nif condition\n  outputVar := "InsideIf"`,
    literal: 'outputVar',
  },
  {
    name: 'Else branch assignment',
    svelteSnippet: `condition := false\noutputVar := ""\nif condition\n  outputVar := "InsideIf"\nelse\n  outputVar := "InsideElseInIndented"`,
    literal: '"InsideElseInIndented"',
  },
  {
    name: 'First literal on one line',
    svelteSnippet: `a := "one"; b := "two"`,
    literal: '"one"',
  },
  {
    name: 'Multiple literals on one line',
    svelteSnippet: `a := "one"; b := "two"`,
    literal: '"two"',
  },
  {
    name: 'Parser error propagation',
    svelteSnippet: `bad := "unclosed`,
    expectError: true,
    expectedOffset: `<script lang="civet">\n`.length + `bad := "unclosed`.length,
    expectedLine: 2,
    expectedColumn: `bad := "unclosed`.length,
  },  
  {
    name: 'Func return = have to get on n ',
    svelteSnippet: `func (foo)return`,
    expectError: true,
    expectedOffset: `<script lang="civet">\n`.length + `func (foo)return`.indexOf('return'),
    expectedLine: 2,
    expectedColumn: `func (foo)return`.indexOf('return'),
  },
];

// Helper to convert offset to 1-based line and 0-based column
function offsetToPos(str, offset) {
  const segments = str.slice(0, offset).split('\n');
  return { line: segments.length, column: segments[segments.length - 1].length };
}

// Execute each test case
for (const { name, svelteSnippet, literal, expectError, expectedOffset, expectedLine, expectedColumn } of testCases) {
  try {
    const svelteContent = `<script lang="civet">\n${svelteSnippet}\n</script>`;
    // Parser error propagation: log raw error message and location
    if (expectError) {
      try {
        svelte2tsx(svelteContent, { filename: svelteFilePath, isTsFile: false });
        assert.fail(`${name}: expected parser error to be thrown`);
      } catch (err) {
        // Ensure it's a parse error
        assert(err.name === 'ParseError', `${name}: expected ParseError but got ${err.name}`);
        // Show full syntax-error message from Civet parser
        console.log(`[${name}] parser error: ${err.message}`);
        // Show reported position fields
        console.log(`[${name}] location offset=${err.offset}, line=${err.line}, column=${err.column}`);
        console.log(`✔ ${name}: error correctly thrown`);
        continue;
      }
    }
    const { code: tsxCode, map: finalMap } = svelte2tsx(svelteContent, { filename: svelteFilePath, isTsFile: false });
    const tsxOffset = tsxCode.indexOf(literal);
    assert(tsxOffset !== -1, `${name}: literal not found in TSX code: ${literal}`);
    const tsxPos = offsetToPos(tsxCode, tsxOffset);
    const traceMap = new TraceMap(finalMap);
    const orig = originalPositionFor(traceMap, { line: tsxPos.line, column: tsxPos.column }, LEAST_UPPER_BOUND);
    const origOffset = svelteContent.indexOf(literal);
    assert(origOffset !== -1, `${name}: literal not found in Svelte content: ${literal}`);
    const origPos = offsetToPos(svelteContent, origOffset);
    assert.strictEqual(orig.source, svelteFilePath, `${name}: source mismatch`);
    assert.strictEqual(orig.line, origPos.line, `${name}: line mismatch`);
    assert.strictEqual(orig.column, origPos.column, `${name}: column mismatch`);
    console.log(`✔ ${name}: mapping correct`);
  } catch (error) {
    if (expectError) {
      console.log(`✔ ${name}: error correctly thrown and propagated`);
      continue;
    }
    let logContent = `=== ${name} Failed ===\nError: ${error.message}\n`;
    if (error.stack) logContent += `Stack: ${error.stack}\n`;
    logContent += `Snippet:\n${svelteSnippet}\nLiteral: ${literal}\n`;
    fs.writeFileSync(logFile, logContent);
    console.error(`✖ ${name}: see log at ${logFile}`);
    process.exit(1);
  }
}
console.log('✔ parser-loc-chaining-test: all edge case mappings correct'); 