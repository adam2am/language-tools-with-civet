// **`CivetLanguageServiceHost.ts` (The TypeScript Specialist):**
//     *   **Role:** Its primary job is to be a compliant `ts.LanguageServiceHost` for the TypeScript analsyis engine. It deals purely with the "TypeScript world" for the code generated from Civet script blocks.
//     *   **Responsibilities (as per step 1.2 of your plan):**
//         *   Implementing the `ts.LanguageServiceHost` interface (methods like `getScriptSnapshot`, `getScriptVersion`, `getCompilationSettings`, etc.).
//         *   Managing an in-memory representation of the TypeScript code that Civet compiles to (`this.civetFiles`, `updateCivetFile`).
//         *   Providing direct wrappers around the TypeScript language service calls for these in-memory files (e.g., `this.languageService.getQuickInfoAtPosition(...)` inside its own `getQuickInfo` method).
//     *   **Think of it as:** A dedicated, mini-environment that knows how to "speak TypeScript" for the temporary TS code derived from your Civet snippets.
import * as ts from 'typescript';
import type { Position } from 'vscode-languageserver';

// Define SourceMapLines if not already available globally or from @danielx/civet
interface SourceMapLinesEntry {
    originalLine: number;
    originalColumn: number;
    generatedLine: number;
    generatedColumn: number;
}
export interface SourceMap {
    lines: SourceMapLinesEntry[];
}

export interface QuickInfo extends ts.QuickInfo {}
export type Definition = readonly ts.DefinitionInfo[];
export interface CompletionList extends ts.CompletionInfo {}

interface CivetFileInfo {
    code: string;
    version: number;
    sourcemapLines: SourceMap['lines'];
    scriptSnapshot?: ts.IScriptSnapshot;
}

/**
 * CivetLanguageServiceHost: drives an in-memory TS file for each <script lang="civet"> block.
 */
export class CivetLanguageServiceHost implements ts.LanguageServiceHost {
    private civetFiles = new Map<string, CivetFileInfo>();
    private compilerOptions: ts.CompilerOptions;
    private languageService: ts.LanguageService;

    constructor() {
        this.compilerOptions = {
            allowNonTsExtensions: true,
            allowJs: true,
            lib: ['lib.esnext.d.ts'],
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            jsx: ts.JsxEmit.Preserve,
        };
        this.languageService = ts.createLanguageService(this, ts.createDocumentRegistry());
    }

    // --- ts.LanguageServiceHost implementation ---
    getCompilationSettings(): ts.CompilerOptions {
        return this.compilerOptions;
    }

    getScriptFileNames(): string[] {
        return Array.from(this.civetFiles.keys());
    }

    getScriptVersion(fileName: string): string {
        return this.civetFiles.get(fileName)?.version.toString() || '0';
    }

    getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
        const fileInfo = this.civetFiles.get(fileName);
        if (fileInfo && !fileInfo.scriptSnapshot) {
            fileInfo.scriptSnapshot = ts.ScriptSnapshot.fromString(fileInfo.code);
        }
        return fileInfo?.scriptSnapshot;
    }

    getCurrentDirectory(): string {
        return process.cwd();
    }

    getDefaultLibFileName(options: ts.CompilerOptions): string {
        return ts.getDefaultLibFilePath(options);
    }

    readFile(path: string, encoding?: string): string | undefined {
        console.warn(`readFile called for ${path}, not implemented in CivetLanguageServiceHost.`);
        return undefined;
    }

    fileExists(path: string): boolean {
        return this.civetFiles.has(path);
    }

    // --- Custom Civet management methods ---

    /**
     * Update or add the compiled TS code for a given Svelte URI.
     */
    public updateCivetFile(uri: string, compiledTsCode: string, sourcemapLines: SourceMap['lines']): void {
        const existing = this.civetFiles.get(uri);
        const version = existing ? existing.version + 1 : 1;
        this.civetFiles.set(uri, {
            code: compiledTsCode,
            version,
            sourcemapLines,
            scriptSnapshot: ts.ScriptSnapshot.fromString(compiledTsCode),
        });
    }

    /**
     * Get hover/QuickInfo at a TS position in the Civet snippet.
     */
    public getQuickInfo(uri: string, position: Position): QuickInfo | undefined {
        const offset = this.positionToOffset(uri, position);
        if (offset === -1) return undefined;
        return this.languageService.getQuickInfoAtPosition(uri, offset);
    }

    /**
     * Get definitions at a TS position in the Civet snippet.
     */
    public getDefinitions(uri: string, position: Position): Definition | undefined {
        const offset = this.positionToOffset(uri, position);
        if (offset === -1) return undefined;
        return this.languageService.getDefinitionAtPosition(uri, offset);
    }

    /**
     * Get completions at a TS position in the Civet snippet.
     */
    public getCompletions(
        uri: string,
        position: Position,
        options?: ts.GetCompletionsAtPositionOptions
    ): CompletionList | undefined {
        const offset = this.positionToOffset(uri, position);
        if (offset === -1) return undefined;
        return this.languageService.getCompletionsAtPosition(uri, offset, options);
    }

    /**
     * Convert an LSP Position into a TS offset in the in-memory code.
     */
    private positionToOffset(uri: string, position: Position): number {
        const fileInfo = this.civetFiles.get(uri);
        if (!fileInfo) return -1;
        const lines = fileInfo.code.split('\n');
        if (position.line >= lines.length) {
            return fileInfo.code.length;
        }
        let offset = 0;
        for (let i = 0; i < position.line; i++) {
            offset += lines[i].length + 1;
        }
        const line = lines[position.line] ?? '';
        offset += Math.min(position.character, line.length);
        return Math.min(offset, fileInfo.code.length);
    }
} 