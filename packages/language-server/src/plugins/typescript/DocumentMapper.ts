import { TraceMap, originalPositionFor, generatedPositionFor } from '@jridgewell/trace-mapping';
import { Position } from 'vscode-languageserver';
import { SourceMapDocumentMapper, DocumentMapper } from '../../lib/documents';

export class ConsumerDocumentMapper extends SourceMapDocumentMapper {
    // Keep a reference to parent mapper for custom chaining
    protected parentMapper?: DocumentMapper;
    constructor(
        traceMap: TraceMap,
        sourceUri: string,
        private nrPrependesLines: number,
        parent?: DocumentMapper
    ) {
        super(traceMap, sourceUri, parent);
        this.parentMapper = parent;
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
        // Step 2: only apply preprocessor (Civet) mapping if it yields a valid position
        if (this.parentMapper) {
            const parentMapped = this.parentMapper.getOriginalPosition(initialPos);
            if (parentMapped.line >= 0 && parentMapped.character >= 0) {
                return parentMapped;
            }
        }
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
