// inspect-plain.js
import fs from 'fs';
import { svelte2tsx } from '../../src/svelte2tsx';
import path from 'path';

// Resolve fixture relative to this test file's directory
const fixture = path.resolve(__dirname, 'fixtures', 'funcTS.svelte');
const input = fs.readFileSync(fixture, 'utf-8');
const { code, map } = svelte2tsx(input, { filename: 'funcTS.svelte' });

console.log('=== TSX output ===\n', code);
console.log('=== Map.sources ===', map.sources);
console.log('=== Map.names ===', map.names);
console.log('=== Map.mappings ===\n', map.mappings);