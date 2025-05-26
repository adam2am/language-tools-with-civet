import { strict as assert } from 'assert';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';
import { SourceMapConsumer } from 'source-map';

describe('current preprocessCivet (dynamic scenarios)', () => {
  interface Scenario {
    name: string;
    civetSnippet: string;
    tokens: string[];
  }

  const scenarios: Scenario[] = [
    {
      name: 'basic declarations',
      civetSnippet: 'x := 1\ny := x + 2',
      tokens: ['x', '1', 'y', 'x', '2']
    },
    {
      name: 'simple function',
      civetSnippet: 'add := (a: number, b: number): number => a + b',
      tokens: ['add', 'a', 'b', 'a', 'b']
    },
    {
      name: 'reactive assignment',
      civetSnippet: 'reactiveValue := 42\nanotherVar := reactiveValue + 10',
      tokens: ['reactiveValue', '42', 'anotherVar', 'reactiveValue', '10']
    }
  ];

  for (const { name, civetSnippet, tokens } of scenarios) {
    it(`maps tokens correctly for ${name}`, async () => {
      const svelteContent = `<script lang="civet">\n${civetSnippet}\n</script>`;
      const filename = `${name.replace(/\s+/g, '')}.svelte`;
      const result = preprocessCivet(svelteContent, filename);

      // Ensure an instance block was processed
      assert.ok(result.instance, 'Expected instance block');
      const { map, tsStartInSvelteWithTs, tsEndInSvelteWithTs } = result.instance!;

      // Extract the compiled TS snippet
      const tsSnippet = result.code.slice(tsStartInSvelteWithTs, tsEndInSvelteWithTs);
      const tsLines = tsSnippet.split('\n');

      // Consume the sourcemap
      const consumer = await new SourceMapConsumer(map);
      for (const token of tokens) {
        const lineIndex = tsLines.findIndex(line => line.includes(token));
        assert.notStrictEqual(lineIndex, -1, `Token '${token}' not found in TS snippet`);
        const colIndex = tsLines[lineIndex].indexOf(token);
        const original = consumer.originalPositionFor({
          line: lineIndex + 1,
          column: colIndex,
          bias: SourceMapConsumer.GREATEST_LOWER_BOUND
        });
        assert.equal(original.source, filename, `Source mismatch for '${token}'`);
        assert.ok(typeof original.line === 'number' && original.line >= 1,
                  `Invalid original line for '${token}': ${original.line}`);
        assert.ok(typeof original.column === 'number' && original.column >= 0,
                  `Invalid original column for '${token}': ${original.column}`);
      }
      consumer.destroy();
    });
  }
}); 