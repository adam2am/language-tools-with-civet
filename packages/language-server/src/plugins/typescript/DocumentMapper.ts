import { TraceMap, originalPositionFor, generatedPositionFor } from '@jridgewell/trace-mapping';
import { Position } from 'vscode-languageserver';
import { SourceMapDocumentMapper, DocumentMapper } from '../../lib/documents';

export class ConsumerDocumentMapper extends SourceMapDocumentMapper {
    // Keep a reference to parent mapper for custom chaining
    protected parentMapper?: DocumentMapper;
    // Optional region in TSX space corresponding to the injected Civet TS snippet
    private snippetRegion?: { start: Position; end: Position };
    constructor(
        traceMap: TraceMap,
        sourceUri: string,
        private nrPrependesLines: number,
        parent?: DocumentMapper,
        snippetRegion?: { start: Position; end: Position }
    ) {
        super(traceMap, sourceUri, parent);
        this.parentMapper = parent;
        this.snippetRegion = snippetRegion;
    }

    getOriginalPosition(generatedPosition: Position): Position {
        // First adjust for any prepended lines
        const adjusted: Position = Position.create(
                generatedPosition.line - this.nrPrependesLines,
                generatedPosition.character
        );
        // Step 1: map from TSX -> Svelte original positions
        const tsxMapped = originalPositionFor(this.traceMap, {
            line: adjusted.line + 1,
            column: adjusted.character
        });
        if (!tsxMapped) {
            return { line: -1, character: -1 };
        }
        const initialPos: Position = {
            line: (tsxMapped.line || 0) - 1,
            character: tsxMapped.column || 0
        };
        // Region-aware: if the generatedPosition lies within the TS snippet region,
        // always map through the Civet (preprocessor) mapper
        if (this.snippetRegion && this.parentMapper) {
            const { start, end } = this.snippetRegion;
            if (
                (generatedPosition.line > start.line ||
                 (generatedPosition.line === start.line && generatedPosition.character >= start.character)) &&
                (generatedPosition.line < end.line ||
                 (generatedPosition.line === end.line && generatedPosition.character <= end.character))
            ) {
                return this.parentMapper.getOriginalPosition(initialPos);
            }
        }
        // Outside the injected snippet region, return pure TSX→Svelte mapping
        return initialPos;
    }

    getGeneratedPosition(originalPosition: Position): Position {
        let result: Position;
        try {
            // Attempt mapping through both TSX map and preprocessor map
            result = super.getGeneratedPosition(originalPosition);
        } catch {
            // Fallback: map using only the TSX map for positions outside script
            const tsxMapped = generatedPositionFor(this.traceMap, {
                line: originalPosition.line + 1,
                column: originalPosition.character,
                source: this.sourceUri
            });
            if (!tsxMapped) {
                return { line: -1, character: -1 };
            }
            result = {
                line: (tsxMapped.line || 0) - 1,
                character: tsxMapped.column || 0
            };
        }
        // Re-add any prepended lines offset
        result.line += this.nrPrependesLines;
        return result;
    }

    isInGenerated(): boolean {
        // always return true and map outliers case by case
        return true;
    }
}
