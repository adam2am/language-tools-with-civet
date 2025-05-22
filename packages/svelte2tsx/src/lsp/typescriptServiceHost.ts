import * as ts from 'typescript';

// Local minimal Position interface (will be replaced by official LSP types when adding dependencies)
interface Position {
    line: number;
    character: number;
}

// Define SourceMapLines if not already available globally or from @danielx/civet
// For demonstration, let's assume a simplified structure:
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
// Changed Definition to be readonly to match ts.LanguageService return type
export type Definition = readonly ts.DefinitionInfo[]; 
export interface CompletionList extends ts.CompletionInfo {}

interface CivetFileInfo {
    code: string;
    version: number;
    sourcemapLines: SourceMap['lines'];
    scriptSnapshot?: ts.IScriptSnapshot;
}

export class CivetLanguageServiceHost implements ts.LanguageServiceHost {
    private civetFiles = new Map<string, CivetFileInfo>();
    private compilerOptions: ts.CompilerOptions;
    private languageService: ts.LanguageService;

    constructor() {
        this.compilerOptions = {
            allowNonTsExtensions: true,
            allowJs: true,
            lib: ['lib.esnext.d.ts'], // Basic lib for standalone TS features
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            jsx: ts.JsxEmit.Preserve, // Or other as appropriate for Svelte context
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
        // This might need to be more sophisticated depending on project structure
        return process.cwd(); 
    }

    getDefaultLibFileName(options: ts.CompilerOptions): string {
        return ts.getDefaultLibFilePath(options);
    }

    readFile(path: string, encoding?: string): string | undefined {
        // For in-memory files, this might not be directly used if all files are managed via updateCivetFile
        // If external .d.ts files are needed, this would need to read from disk.
        console.warn(`readFile called for ${path}, not implemented for general disk access in this host.`);
        return undefined;
    }

    fileExists(path: string): boolean {
        return this.civetFiles.has(path);
    }
    
    // --- Custom methods for Civet script management ---

    public updateCivetFile(uri: string, compiledTsCode: string, sourcemapLines: SourceMap['lines']): void {
        const existingFile = this.civetFiles.get(uri);
        const version = existingFile ? existingFile.version + 1 : 1;
        this.civetFiles.set(uri, {
            code: compiledTsCode,
            version,
            sourcemapLines,
            scriptSnapshot: ts.ScriptSnapshot.fromString(compiledTsCode) // Update snapshot immediately
        });
        // Optionally, notify the language service of the update if needed for specific scenarios
        // this.languageService.getProgram()?.getSourceFile(uri); // This is one way to trigger update
    }

    public getQuickInfo(uri: string, tsPosition: Position): QuickInfo | undefined {
        const offset = this.positionToOffset(uri, tsPosition);
        if (offset === -1) return undefined;
        return this.languageService.getQuickInfoAtPosition(uri, offset);
    }

    public getDefinitions(uri: string, tsPosition: Position): Definition | undefined { // Return type updated to Definition (which is readonly)
        const offset = this.positionToOffset(uri, tsPosition);
        if (offset === -1) return undefined;
        return this.languageService.getDefinitionAtPosition(uri, offset);
    }

    public getCompletions(uri: string, tsPosition: Position, options?: ts.GetCompletionsAtPositionOptions): CompletionList | undefined {
        const offset = this.positionToOffset(uri, tsPosition);
        if (offset === -1) return undefined;
        return this.languageService.getCompletionsAtPosition(uri, offset, options);
    }

    // Helper to convert LSP Position to TS offset
    private positionToOffset(uri: string, position: Position): number {
        const fileInfo = this.civetFiles.get(uri);
        if (!fileInfo) return -1;
        
        // Use TypeScript's own text utilities for accurate offset calculation if a SourceFile object is available
        // For now, keeping the manual split-based approach for simplicity as SourceFile objects might not be readily available for pure in-memory content without more involved TS program setup.
        // If this host were to manage full ts.Program instances, then:
        // const sourceFile = this.languageService.getProgram()?.getSourceFile(uri);
        // if (sourceFile) return ts.getPositionOfLineAndCharacter(sourceFile, position.line, position.character);

        const lines = fileInfo.code.split('\n');
        if (position.line >= lines.length && lines.length > 0) { // Position is beyond the last line
            // If the request is for a line that doesn't exist, point to the end of the document or handle as an error.
            // For simplicity, let's clamp to the end of the last actual line's characters if line is too high.
            // Or, more strictly, return -1 if position.line is out of bounds.
            // Let's be strict for now.
            if (position.line >= lines.length) return -1; 
        }

        let offset = 0;
        for (let i = 0; i < position.line; i++) {
            //This check should be redundant if the above lines.length check is present and position.line is valid
            //if (i < lines.length) { 
            offset += lines[i].length + 1; // +1 for newline character
            //} else { return -1; /* Line out of bounds */ }
        }
        
        const lineContent = lines[position.line];
        if (lineContent === undefined) return -1; // Should not happen if line is in bounds

        // Clamp character to the line length to prevent offset errors
        const char = Math.min(position.character, lineContent.length);
        offset += char;
        
        // Final validation: offset should not exceed code length
        if (offset > fileInfo.code.length) {
            return fileInfo.code.length; // Clamp to the end of the code
        }
        return offset;
    }
} 