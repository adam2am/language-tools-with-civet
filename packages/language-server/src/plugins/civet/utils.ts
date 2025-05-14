import { dirname, resolve } from 'path';

/**
 * Resolves and returns the Civet transformer function from svelte-preprocess-with-civet.
 */
export function getCivetTransformer() {
  const civetPkgIndex = require.resolve('svelte-preprocess-with-civet');
  const civetPkgDir = dirname(civetPkgIndex);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { transformer } = require(resolve(civetPkgDir, 'transformers', 'civet.js'));
  return transformer;
} 