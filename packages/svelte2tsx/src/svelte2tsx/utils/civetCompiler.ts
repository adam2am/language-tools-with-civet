import civet from '@danielx/civet';
import type { CivetCompileResult } from './civetTypes';

/**
 * Compile a Civet snippet into TypeScript code and a raw sourcemap.
 */
export function compileCivet(
  snippet: string,
  filename: string
): CivetCompileResult {
  const result = civet.compile(snippet, {
    js: false,
    sourceMap: true,
    inlineMap: false,
    filename,
    sync: true
  });
  return {
    code: result.code,
    rawMap: result.sourceMap as any
  };
} 