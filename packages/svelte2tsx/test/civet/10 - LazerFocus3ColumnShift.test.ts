/// <reference types="mocha" />
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

// Test suite for column offset issues on the first line of Civet script
describe('10 - LazerFocus3ColumnShift: mapping for first line tokens #current', () => {
  const fixtures = [
    {
      name: 'LazerFocus3-issue1.svelte',
      tokenName: 'problematicFoo',
      // Expected column (0-based) in the original Svelte file for 'problematicFoo'
      // <script lang="civet">\n  problematicFoo := ...
      //                           ^
      expectedOriginalColumn: 2 
    },
    {
      name: 'LazerFocus3-issue1.svelte',
      tokenName: 'allgoodToken',
      // <script lang="civet">\n  problematicFoo := ...
      // ...
      //   allgoodToken := ...
      //                           ^
      expectedOriginalColumn: 2
    },
    {
      name: 'LazerFocus3-issue2.svelte',
      tokenName: 'problematicFoo',
      // <script lang="civet">\n\tfunction problematicFoo() {
      //          ^
      expectedOriginalColumn: 10
    },
    {
      name: 'LazerFocus3-issue2.svelte',
      tokenName: 'allgood',
      // ...
      // \tallgood := ...
      //       ^
      expectedOriginalColumn: 1 
    }
  ];

  for (const { name, tokenName, expectedOriginalColumn } of fixtures) {
    it(`${name}: column mapping for '${tokenName}'`, () => {
      const fixturesDir = path.resolve(__dirname, 'fixtures', 'lazerfocusOffset');
      const sveltePath = path.join(fixturesDir, name);
      const content = fs.readFileSync(sveltePath, 'utf-8');
      const { code: tsxCode, map } = svelte2tsx(content, { filename: name });
      const tracer = new TraceMap(map as any);

      // Locate generated position of the token
      const idx = tsxCode.indexOf(tokenName);
      assert.ok(idx !== -1, `Token '${tokenName}' not found in TSX output for ${name}`);
      const pre = tsxCode.slice(0, idx);
      const genLine = pre.split('\n').length;
      const genCol = pre.slice(pre.lastIndexOf('\n') + 1).length;

      const pos = originalPositionFor(tracer, { line: genLine, column: genCol });
      assert.strictEqual(pos.source, name, 'Source should be the Svelte file');

      // Log the name from the sourcemap segment, if available
      const mappedName = pos.name;
      // Find the original line content for logging and easier debugging
      const originalLines = content.split('\n');
      const originalTokenLineContent = originalLines[pos.line -1];

      console.log(`Test: ${name} - Token: '${tokenName}'`);
      console.log(`  TSX Position: Line ${genLine}, Column ${genCol}`);
      console.log(`  Mapped Original Svelte Position: Line ${pos.line}, Column ${pos.column}`);
      console.log(`  Mapped Original Name: ${mappedName || 'N/A'}`);
      console.log(`  Expected Original Svelte Column: ${expectedOriginalColumn}`);
      console.log(`  Original Line Content: '${originalTokenLineContent}'`);

      assert.strictEqual(pos.column, expectedOriginalColumn,
        `Expected column ${expectedOriginalColumn} for '${tokenName}' in ${name}, got ${pos.column}. Line: ${pos.line}. Original line content: '${originalTokenLineContent}'`);
    });
  }
}); 