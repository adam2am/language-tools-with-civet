import type { CompileOptions } from '@danielx/civet';
import type { StandardRawSourceMap } from './civetTypes';

// Dynamically load the Civet compiler to make it optional
let _civetModule: typeof import('@danielx/civet') | null | undefined;
function getCivetModule(): typeof import('@danielx/civet') | null {
  if (_civetModule !== undefined) return _civetModule;
  try {
    _civetModule = require('@danielx/civet');
  } catch (e) {
    console.warn('[civetNewMapLines] @danielx/civet not found. Civet compilation will not be available.');
    _civetModule = null;
  }
  return _civetModule;
}

export interface CivetV3CompileResult {
  code: string;
  rawMap?: StandardRawSourceMap;
}

const civetCompilerDebug = false;

/**
 * Compiles a Civet code snippet to TypeScript and generates a V3 standard sourcemap synchronously.
 */
export function compileCivetSnippetToV3MappedTS(
  snippet: string,
  filename: string,
  baseCompileOptions?: Partial<CompileOptions>
): CivetV3CompileResult {
  const civet = getCivetModule();
  if (!civet) {
    return { code: snippet, rawMap: undefined };
  }

  if (civetCompilerDebug) {
    console.log(`[civetNewMapLines-debug] Compiling Civet snippet for file: ${filename}`);
    console.log(`[civetNewMapLines-debug] Snippet content:\n${snippet}`);
  }

  const astOptions: CompileOptions = {
    ...baseCompileOptions,
    ast: true,        // Request AST
    sourceMap: false, // We will manage the SourceMap object directly for generation
    filename,
    js: false,        // Ensure TypeScript output
    // sync: true,    // Removed: compile for AST is typically sync by default without workers
  };

  let ast: any; // Using any for AST node type for now
  try {
    // When ast:true, civet.compile synchronously returns an object containing the ast.
    // The exact shape might vary or not be perfectly typed in CompileOptions for this specific case.
    const compileOutput = civet.compile(snippet, astOptions) as any; 
    ast = compileOutput.ast;

    if (!ast) {
      throw new Error('Civet AST was not generated.');
    }

    if (civetCompilerDebug) {
      console.log(`[civetNewMapLines-debug] Civet AST obtained for ${filename}`);
    }
  } catch (error) {
    console.error(`[civetNewMapLines] Error during Civet AST compilation for ${filename}:`, error);
    return { code: snippet, rawMap: undefined };
  }

  // Instantiate a Civet SourceMap object with the original snippet content
  const civetMapInstance = new civet.SourceMap(snippet);

  // Options for civet.generate()
  // Note: civet.generate can also take CompileOptions, but its handling of
  // sourceMap (expecting an instance) is specific.
  const generateOptions = {
    ...baseCompileOptions, // Carry over relevant options
    filename,              // Filename for context
    js: false,             // Ensure TypeScript output
    sourceMap: civetMapInstance, // Pass the SourceMap instance to be populated
    // sync: true,       // Removed: generate is typically sync by default
  };

  let generatedCode: string;
  try {
    // Generate TS from AST, populating the civetMapInstance.
    // Using 'as any' for generateOptions due to specific use of sourceMap instance
    // which might not align perfectly with a generic CompileOptions type.
    generatedCode = civet.generate(ast, generateOptions as any) as string;

    if (civetCompilerDebug) {
      console.log(`[civetNewMapLines-debug] Civet.generate TS code length: ${generatedCode.length} for ${filename}`);
      console.log(`[civetNewMapLines-debug] Civet.generate code snippet prefix: ${generatedCode.slice(0, 100).replace(/\n/g, '\n')}...`);
    }
  } catch (error) {
    console.error(`[civetNewMapLines] Error during Civet code generation for ${filename}:`, error);
    return { code: snippet, rawMap: undefined };
  }

  // Serialize the populated SourceMap instance to a V3 raw sourcemap JSON
  const rawV3Map = civetMapInstance.json(filename, filename) as StandardRawSourceMap;

  if (civetCompilerDebug) {
    console.log(`[civetNewMapLines-debug] Generated V3 rawMap for ${filename}:`, JSON.stringify(rawV3Map, null, 2).slice(0, 300) + '...');
  }

  return {
    code: generatedCode,
    rawMap: rawV3Map,
  };
}

// Example type for StandardRawSourceMap (should be in civetTypes.ts)
// export interface StandardRawSourceMap {
//   version: 3;
//   file?: string | null;
//   sourceRoot?: string | null;
//   sources: string[];
//   sourcesContent?: (string | null)[] | null;
//   names: string[];
//   mappings: string;
// } 