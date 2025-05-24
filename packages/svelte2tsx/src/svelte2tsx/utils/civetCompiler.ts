import civet, { type SourceMap as CivetSourceMapClass } from '@danielx/civet';
import type { CivetCompileResult, CivetOutputMap, StandardRawSourceMap, CivetLinesSourceMap } from './civetTypes';

const civetCompilerDebug = true;

/**
 * Compile a Civet snippet into TypeScript code and a raw sourcemap.
 */
export function compileCivet(
  snippet: string,
  filename: string,
  options?: { outputStandardV3Map?: boolean }
): CivetCompileResult {
  if (civetCompilerDebug) {
    console.log(`[compileCivet-debug] Compiling Civet snippet for file: ${filename}`);
    console.log(`[compileCivet-debug] Snippet content:\n${snippet}`);
  }
  const compileOpts = {
    js: false,
    sourceMap: true,
    inlineMap: false,
    filename,
    sync: true
  };

  // Cast through unknown to bypass complex conditional type inference issues for civet.compile
  const civetResult = civet.compile(snippet, compileOpts) as unknown as { code: string; sourceMap: CivetSourceMapClass };
  if (civetCompilerDebug) {
    console.log(`[compileCivet-debug] Civet.compile returned code length: ${civetResult.code.length}`);
    console.log(`[compileCivet-debug] Civet.compile code snippet prefix: ${civetResult.code.slice(0, 100).replace(/\n/g, '\n')}...`);
  }

  let finalMap: CivetOutputMap | undefined = undefined;

  if (civetResult.sourceMap) {
    if (options?.outputStandardV3Map === true) {
      finalMap = civetResult.sourceMap.json(filename, filename) as StandardRawSourceMap;
    } else {
      finalMap = civetResult.sourceMap as unknown as CivetLinesSourceMap;
    }
    if (civetCompilerDebug) console.log(`[compileCivet-debug] rawMap type: ${finalMap && 'lines' in finalMap ? 'CivetLinesSourceMap' : 'StandardRawSourceMap'}`);
  }

  return {
    code: civetResult.code,
    rawMap: finalMap
  };
} 