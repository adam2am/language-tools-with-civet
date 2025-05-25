import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { decode } from '@jridgewell/sourcemap-codec';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { svelte2tsx } from '../../src/svelte2tsx';

// Define expectedMappings for IntegrationAccuracy.svelte: [svelte line, code fragment] pairs
const expectedMappings: [number, string][] = [
  [2, 'function funcForTest(name: string): string'],
  [3, 'console.log "hello, world"']
];


describe('Civet mapping accuracy - IntegrationAccuracy.svelte', () => {
  const fixture = 'IntegrationAccuracy.svelte';
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const input = fs.readFileSync(path.join(fixturesDir, fixture), 'utf-8');
  const { code: tsx, map } = svelte2tsx(input, { filename: fixture });
  const decoded = decode(map.mappings);
  const tracer = new TraceMap(map as any);

  it('should map each Civet code line to the correct Svelte line', () => {
    for (const [svelteLine, codeFragmentRaw] of expectedMappings) {
      const codeFragment = String(codeFragmentRaw);
      // Find a generated segment that maps to this Svelte line
      let found = false;
      for (let genLineIdx = 0; genLineIdx < decoded.length; genLineIdx++) {
        for (const segment of decoded[genLineIdx]) {
          const [genCol, , origLine0, origCol0] = segment;
          const pos = originalPositionFor(tracer, { line: genLineIdx + 1, column: genCol });
          if (pos.line === svelteLine) {
            found = true;
            // Optionally, check that the code at that Svelte line contains the expected fragment
            const svelteLineText = input.split('\n')[svelteLine - 1];
            assert(
              svelteLineText.includes(codeFragment),
              `Expected Svelte line ${svelteLine} to contain '${codeFragment}', got: '${svelteLineText}'`
            );
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        // Log all mappings for debugging
        console.error(`No mapping found for Svelte line ${svelteLine} (${codeFragment})`);
        for (let genLineIdx = 0; genLineIdx < decoded.length; genLineIdx++) {
          for (const segment of decoded[genLineIdx]) {
            const [genCol, , origLine0, origCol0] = segment;
            const pos = originalPositionFor(tracer, { line: genLineIdx + 1, column: genCol });
            if (pos.line) {
              const svelteLineText = input.split('\n')[pos.line - 1];
              console.error(`  Gen line ${genLineIdx + 1}, col ${genCol} -> Svelte line ${pos.line}: '${svelteLineText.trim()}'`);
            }
          }
        }
      }
      assert.ok(found, `No mapping found for Svelte line ${svelteLine} (${codeFragment})`);
    }
  });
}); 