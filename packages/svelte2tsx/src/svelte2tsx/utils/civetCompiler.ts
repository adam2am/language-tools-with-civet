import civet, { type SourceMap as CivetSourceMapClass } from '@danielx/civet';
import type { CivetCompileResult, CivetOutputMap, StandardRawSourceMap, CivetLinesSourceMap } from './civetTypes';

/**
 * Compile a Civet snippet into TypeScript code and a raw sourcemap.
 */
export function compileCivet(
  snippet: string,
  filename: string,
  options?: { outputStandardV3Map?: boolean }
): CivetCompileResult {
  const compileOpts = {
    js: false,
    sourceMap: true,
    inlineMap: false,
    filename,
    sync: true
  };

  // Cast through unknown to bypass complex conditional type inference issues for civet.compile
  const civetResult = civet.compile(snippet, compileOpts) as unknown as { code: string; sourceMap: CivetSourceMapClass };

  let finalMap: CivetOutputMap | undefined = undefined;

  if (civetResult.sourceMap) {
    if (options?.outputStandardV3Map === true) {
      finalMap = civetResult.sourceMap.json(filename, filename) as StandardRawSourceMap;
    } else {
      finalMap = civetResult.sourceMap as unknown as CivetLinesSourceMap;
    }
  }

  return {
    code: civetResult.code,
    rawMap: finalMap
  };
} 