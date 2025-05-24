import { strict as assert } from 'assert';
import { SourceMapConsumer } from 'source-map';
import * as fs from 'fs';
import * as path from 'path';
import { preprocessCivet } from '../../src/svelte2tsx/utils/civetPreprocessor';

const lazerFocusDebug = true 
// Debug flags for specific test cases
const debug = {
  scenario1: false, // Set to true to enable debug output for scenario1
  scenario2: true,  // Set to true to enable debug output for scenario2
  scenario3: false,
  scenario4: true   // Set to true to enable debug output for scenario4
};

describe('preprocessCivet', () => {
  const svelte = `
<script lang="civet">
  a := 1
  b := a + 2
</script>
<p>{b}</p>
`;
  const filename = 'TestComponent.svelte';

  it('replaces Civet snippet with TS and returns a valid map', async () => {
    const result = preprocessCivet(svelte, filename);
    if (lazerFocusDebug && debug.scenario1) console.log('Result:', result.code);

    // TS code should appear in output
    assert.match(result.code, /const a = 1/);
    assert.match(result.code, /const b = a \+ 2/);

    // Instance block metadata must be defined
    assert.ok(result.instance, 'Expected instance block data');
    const { map } = result.instance!;

    // Map should be a standard V3 RawSourceMap
    assert.equal(map.version, 3);
    assert.deepEqual(map.sources, [filename]);
    assert.deepEqual(map.sourcesContent, [svelte]);

    // Validate one mapping: TS "a" in "const a = 1" maps back to Civet line
    const consumer = await new SourceMapConsumer(map);
    // For the compiled TS snippet "const a = 1\nconst b = a + 2", 
    // we query at generated line 1, column 0 (start of the snippet).
    const pos = consumer.originalPositionFor({ line: 1, column: 0, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    
    if (lazerFocusDebug && debug.scenario1) {
      console.log('--- Debug preprocessCivet Mapping ---');
      console.log('Generated TS coords -> line:', pos.line, 'col:', pos.column);
      console.log('Raw map.mappings string:', map.mappings);
      console.log('All mappings:');
      consumer.eachMapping(m => console.log(m));
      console.log('originalPositionFor result:', pos);
    }
    
    // The mapping at generated (1,0) should point back to the start of "a := 1" in the Svelte source,
    // which is line 3, column 2 (2 spaces indent before 'a').
    assert.strictEqual(pos.line, 3, 'Original line should be 3');
    assert.strictEqual(pos.column, 2, 'Original column should be 2');
  });

  it('scenario 2:handles module and instance scripts with more complex Civet', async () => {
    const complexFixturePath = path.join(__dirname, 'fixtures', '2scripts.svelte');
    const complexSvelte = fs.readFileSync(complexFixturePath, 'utf-8');
    const complexFilename = 'ComplexComponent.svelte'; // Keep original filename for map source

    const result = preprocessCivet(complexSvelte, complexFilename);

    if (lazerFocusDebug && debug.scenario2) {
      console.log('\n--- Complex Svelte Test (scenario 2) ---');
      console.log('Result Code:\n', result.code);
      if (result.module) console.log('Module Map:\n', JSON.stringify(result.module.map, null, 2));
      if (result.instance) console.log('Instance Map:\n', JSON.stringify(result.instance.map, null, 2));
    }

    // Check module script transformation
    assert.ok(result.module, 'Expected module block data');
    assert.match(result.code, /export (?:const|var) greet = \(name: string\): string => \{/);
    assert.match(result.code, /if \(name == \"Bot\"\)/);
    assert.match(result.code, /return "Hello, #\{name\}!"/);

    // Check instance script transformation
    assert.ok(result.instance, 'Expected instance block data');
    assert.match(result.code, /const reactiveValue = 42/);
    assert.match(result.code, /const message = greet\(reactiveValue > 40 \? "Human" : "Bot"\)/);

    // --- Test Module Map ---
    const moduleMap = result.module!.map;
    const moduleConsumer = await new SourceMapConsumer(moduleMap);

    // Test mapping for "greet" in module script export
    let modPos = moduleConsumer.originalPositionFor({ line: 1, column: 0, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    if (lazerFocusDebug && debug.scenario2) console.log('--- [DEBUG] Module mapping entries for greet snippet (scenario 2) ---');
    if (lazerFocusDebug && debug.scenario2) moduleConsumer.eachMapping(m => console.log(m));
    if (lazerFocusDebug && debug.scenario2) console.log('[DEBUG] modPos for greet mapping (scenario 2):', modPos);
    assert.strictEqual(modPos.line, 3, 'Module: Original line for greet (start of snippet)');
    assert.strictEqual(modPos.column, 2, 'Module: Original column for greet (start of snippet)');

    modPos = moduleConsumer.originalPositionFor({ line: 3, column: 8, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.strictEqual(modPos.line, 5, 'Module: Original line for name in if');
    assert.strictEqual(modPos.column, 10, 'Module: Original column for name in if');

    // --- Test Instance Map ---
    const instanceMap = result.instance!.map;
    const instanceConsumer = await new SourceMapConsumer(instanceMap);

    if (lazerFocusDebug && debug.scenario2) {
      console.log('--- [DEBUG] Instance mapping entries (scenario 2) ---');
      instanceConsumer.eachMapping(m => console.log(m));
      console.log('Querying instance map for GenLine 5, GenCol 6 (reactiveValue) (scenario 2):');
      console.log(instanceConsumer.originalPositionFor({ line: 5, column: 6, bias: SourceMapConsumer.LEAST_UPPER_BOUND }));
      console.log('Querying instance map for GenLine 5, GenCol 0 (scenario 2):');
      console.log(instanceConsumer.originalPositionFor({ line: 5, column: 0, bias: SourceMapConsumer.LEAST_UPPER_BOUND }));
      console.log('Querying instance map for GenLine 6, GenCol 14 (greet call) (scenario 2):');
      console.log(instanceConsumer.originalPositionFor({ line: 6, column: 14, bias: SourceMapConsumer.LEAST_UPPER_BOUND }));
    }

    let instPos = instanceConsumer.originalPositionFor({ line: 5, column: 6, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.strictEqual(instPos.line, 16, 'Instance: Original line for reactiveValue');
    assert.strictEqual(instPos.column, 2, 'Instance: Original column for reactiveValue');

    instPos = instanceConsumer.originalPositionFor({ line: 6, column: 14, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    assert.strictEqual(instPos.line, 17, 'Instance: Original line for greet call');
    assert.strictEqual(instPos.column, 12, 'Instance: Original column for greet call');
  });

  it.only('scenario 4: single instance script from fixture', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'scenario.svelte');
    const svelteContent = fs.readFileSync(fixturePath, 'utf-8');
    const fixtureFilename = 'scenario.svelte'; // Use the actual fixture name for map source

    const result = preprocessCivet(svelteContent, fixtureFilename);

    if (lazerFocusDebug && debug.scenario4) {
      console.log('\n--- Single Script Test (scenario 4) ---');
      console.log('Result Code:\n', result.code);
      if (result.instance) console.log('Instance Map:\n', JSON.stringify(result.instance.map, null, 2));
    }

    assert.ok(result.instance, 'Expected instance block data for single script');
    assert.match(result.code, /const reactiveValue = 42/);
    assert.match(result.code, /const anotherVar = reactiveValue \+ 10/);

    const instanceMap = result.instance!.map;
    const consumer = await new SourceMapConsumer(instanceMap);

    // TS for reactiveValue: const reactiveValue = 42; (Gen Line 3 of its snippet)
    // Civet: reactiveValue := 42 (Original Svelte Line 3, Col 2)
    // Note: Civet script content starts on Svelte file line 2, actual code `reactiveValue` on Svelte line 3.
    // The compiled TS snippet from Civet for this scenario.svelte:
    // // Instance script
    // const reactiveValue = 42;
    // const anotherVar = reactiveValue + 10;
    // console.log(anotherVar);
    // So, `const reactiveValue = 42` is on line 2 of the *compiled TS snippet*

    if (lazerFocusDebug && debug.scenario4) {
      console.log('--- [DEBUG] Instance mapping entries (scenario 4) ---');
      consumer.eachMapping(m => console.log(m));
    }

    // Query for `reactiveValue` which is `const reactiveValue = 42;`
    // This is expected to be on generated line 2, column 6 of the TS snippet from Civet.
    const pos = consumer.originalPositionFor({ line: 2, column: 6, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    
    if (lazerFocusDebug && debug.scenario4) {
        console.log('Querying instance map for GenLine 2, GenCol 6 (reactiveValue) (scenario 4):');
        console.log(pos);
        console.log('Querying instance map for GenLine 2, GenCol 0 (scenario 4):');
        console.log(consumer.originalPositionFor({ line: 2, column: 0, bias: SourceMapConsumer.LEAST_UPPER_BOUND }));
    }

    assert.strictEqual(pos.line, 3, 'Single Script: Original line for reactiveValue');
    assert.strictEqual(pos.column, 2, 'Single Script: Original column for reactiveValue');
  });

  it('scenario 3:stress tests unplugin.civet code', async () => {
    const stressSvelte = `
<script lang="civet">
  // Generate a random number between min and max (inclusive)
  generateRandomNumber := (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min

  // Simple condition example
  age := 25
  if age >= 18
    console.log "You are an adult"
  else
    console.log "You are a minor"

  // Array example
  fruits := ["apple", "banana", "orange", "grape", "mango"]

  // Loop example
  for fruit, index of fruits
    console.log \`Fruit \${index + 1}: \${fruit}\`

  // Array with map
  numbers := [1, 2, 3, 4, 5]
  doubledNumbers := numbers.map (num) => num * 2

  // Filter example
  evenNumbers := numbers.filter (num) => num % 2 === 0

  // Reduce example
  sum := numbers.reduce ((acc, num) => acc + num), 0
</script>
<p>{sum}</p>
`;
    const stressFilename = 'StressComponent.svelte';

    const result = preprocessCivet(stressSvelte, stressFilename);
    assert.ok(result.instance, 'Expected instance block');
    const code = result.code;

    // Ensure the Civet code was compiled to TS
    assert.match(code, /generateRandomNumber/, 'Should compile the function name');
    assert.match(code, /const age = 25/, 'Should compile simple assignment');
    assert.match(code, /fruits = \[/, 'Should compile array literal');
    assert.match(code, /for \(/, 'Should compile loop');
    assert.match(code, /numbers = \[/, 'Should compile map array');
    assert.match(code, /(?:const|let|var) sum =/, 'Should compile reduce assignment');

    const { map, tsStartInSvelteWithTs, tsEndInSvelteWithTs } = result.instance!;
    const consumer = await new SourceMapConsumer(map);
    const snippet = code.slice(tsStartInSvelteWithTs, tsEndInSvelteWithTs);
    const lines = snippet.split('\n');
    // Find the TS line containing 'generateRandomNumber'
    const idx = lines.findIndex(l => l.includes('generateRandomNumber')) + 1;
    const col = lines[idx - 1].indexOf('generateRandomNumber');

    const pos = consumer.originalPositionFor({ line: idx, column: col, bias: SourceMapConsumer.LEAST_UPPER_BOUND });
    console.log('Stress test mapping for generateRandomNumber ->', pos);
    assert.equal(pos.source, stressFilename, 'Mapping source should match');
    assert.ok(pos.line != null && pos.column != null, 'Mapping should return a valid line/column');
  });
});
