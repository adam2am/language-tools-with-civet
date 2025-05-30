import { strict as assert } from 'assert';
import { svelte2tsx } from '../../src/svelte2tsx';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import fs from 'fs';
import path from 'path';

describe('12 - unless Condition Mapping Behavior #current', () => {
  const fixtureDir = path.join(__dirname, 'fixtures');
  const unlessFixtureFile = path.join(fixtureDir, 'unlessConditionMapping.svelte');

  function normalizePath(filePath: string) {
    return filePath.replace(/\\/g, '/');
  }

  it('should map foo1 correctly in an unless condition', () => {
    const svelteContent = fs.readFileSync(unlessFixtureFile, 'utf-8');
    const { code: tsxCode, map: mapJson } = svelte2tsx(svelteContent, { filename: unlessFixtureFile, isTsFile: true });
    const tracer = new (TraceMap as any)(mapJson);
    const tsxLines = tsxCode.split('\n');

    // Find 'foo1' in the compiled 'unless' condition.
    // Civet: `unless foo1 is 'foo1'`
    // TS: `if (!(foo1 === 'foo1'))`
    // We need to find the `foo1` inside the `if (!(` part.
    let unlessFoo1Line = -1;
    let unlessFoo1Col = -1;

    for (let i = 0; i < tsxLines.length; i++) {
      const line = tsxLines[i];
      // A heuristic to find the transpiled unless condition.
      // This will be fragile if the exact transpilation changes.
      const ifNotIndex = line.indexOf('if (!(');
      if (ifNotIndex !== -1) {
        const foo1Index = line.indexOf('foo1', ifNotIndex);
        if (foo1Index !== -1) {
          unlessFoo1Line = i + 1;
          unlessFoo1Col = foo1Index;
          break;
        }
      }
    }

    assert.notStrictEqual(unlessFoo1Line, -1, 'Token "foo1" (in unless) not found in TSX');

    const unlessOrigPos = originalPositionFor(tracer, { line: unlessFoo1Line, column: unlessFoo1Col });
    assert.ok(unlessOrigPos, 'originalPositionFor returned null for "foo1" in unless');
    assert.strictEqual(normalizePath(unlessOrigPos.source), normalizePath(unlessFixtureFile));
    // Original Civet: `unless foo1 is 'foo1'`
    // `foo1` is at line 3 (1-based), column 8 (0-based for `f` in `foo1` because of the preceding tab)
    assert.strictEqual(unlessOrigPos.line, 3, 'Expected "foo1" (in unless) to map to Svelte L3');
    assert.strictEqual(unlessOrigPos.column, 8, 'Expected "foo1" (in unless) to map to Svelte C8 (0-indexed)');
  });

  it('should map foo1 correctly in a subsequent if condition', () => {
    const svelteContent = fs.readFileSync(unlessFixtureFile, 'utf-8');
    const { code: tsxCode, map: mapJson } = svelte2tsx(svelteContent, { filename: unlessFixtureFile, isTsFile: true });
    const tracer = new (TraceMap as any)(mapJson);
    const tsxLines = tsxCode.split('\n');

    // Find 'foo1' in the compiled 'if' condition.
    // Civet: `if foo1 is 'foo1'`
    // TS: `if (foo1 === 'foo1')`
    let ifFoo1Line = -1;
    let ifFoo1Col = -1;
    let foundIfBlock = false;

    for (let i = 0; i < tsxLines.length; i++) {
        const line = tsxLines[i];
        // Heuristic: find the `if (foo1 === 'foo1')` that is NOT negated.
        if (line.includes("if (!(")) { // Skip the 'unless' block
            continue;
        }
        const ifIndex = line.indexOf('if (');
        if (ifIndex !== -1) {
            const foo1Index = line.indexOf('foo1', ifIndex);
            if (foo1Index !== -1 && line.indexOf('foo1 === \'foo1\'', foo1Index) !== -1 && !line.substring(ifIndex, foo1Index).includes('!')) {
                 // Make sure we are past the 'unless' block; this is a simple heuristic.
                 // A better way would be to count 'if' blocks or use AST.
                 // For now, we assume the second `if (foo1 === 'foo1')` is the one we want.
                if (foundIfBlock) { // If we already found the first transpiled 'if' (from 'unless'), this is the second.
                    ifFoo1Line = i + 1;
                    ifFoo1Col = foo1Index;
                    break;
                }
                // A more robust way would be to check the line number of the svelte `if`
                // and ensure we are looking at the TSX generated from that.
                // For now, let's try to find the one that doesn't have the ! negation immediately
                // and isn't the first if block if an unless was present.
                // This is tricky because civet 'unless' becomes 'if (!...)'
                // and civet 'if' becomes 'if (...)'
                // Let's assume the test case is simple enough for now that the second 'if (foo1 === ...'
                // without a '!' directly after 'if (' is the target.

                // Simplified: Find the *second* `if (...)` block that contains `foo1`
                // This depends on the specific output structure.
                const allIfLines = tsxLines.map((l, index) => ({l, index})).filter(item => item.l.includes("if (") && item.l.includes("foo1"));
                if (allIfLines.length > 1) {
                    const targetIfLineInfo = allIfLines[1]; // Get the second one
                    const targetLineContent = targetIfLineInfo.l;
                    const targetFoo1Index = targetLineContent.indexOf('foo1', targetLineContent.indexOf('if ('));
                     if (targetFoo1Index !== -1) {
                        ifFoo1Line = targetIfLineInfo.index + 1;
                        ifFoo1Col = targetFoo1Index;
                        break;
                    }
                } else if (allIfLines.length === 1 && !svelteContent.includes("unless")) { // if only one if, and no unless
                     const targetIfLineInfo = allIfLines[0];
                     const targetLineContent = targetIfLineInfo.l;
                     const targetFoo1Index = targetLineContent.indexOf('foo1', targetLineContent.indexOf('if ('));
                     if (targetFoo1Index !== -1) {
                        ifFoo1Line = targetIfLineInfo.index + 1;
                        ifFoo1Col = targetFoo1Index;
                        break;
                    }
                }


            }
        }
    }


    assert.notStrictEqual(ifFoo1Line, -1, 'Token "foo1" (in if) not found in TSX');

    const ifOrigPos = originalPositionFor(tracer, { line: ifFoo1Line, column: ifFoo1Col });
    assert.ok(ifOrigPos, 'originalPositionFor returned null for "foo1" in if');
    assert.strictEqual(normalizePath(ifOrigPos.source), normalizePath(unlessFixtureFile));
    // Original Civet: `if foo1 is 'foo1'`
    // `foo1` is at line 7 (1-based), column 4 (0-based for `f` in `foo1` because of the preceding tab)
    assert.strictEqual(ifOrigPos.line, 7, 'Expected "foo1" (in if) to map to Svelte L7');
    assert.strictEqual(ifOrigPos.column, 4, 'Expected "foo1" (in if) to map to Svelte C4 (0-indexed)');
  });
}); 