import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
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
        // Step 1: map from TSX->TS using this traceMap
        const tsxMapped = originalPositionFor(this.traceMap, {
            line: adjusted.line + 1,
            column: adjusted.character
        });
        if (!tsxMapped) {
            return { line: -1, character: -1 };
        }
        let pos: Position = {
            line: (tsxMapped.line || 0) - 1,
            character: tsxMapped.column || 0
        };
        // Step 2: if there is a parent mapper, map from TS->original (Civet)
        if (this.parentMapper) {
            pos = this.parentMapper.getOriginalPosition(pos);
        }
        return pos;
    }

    getGeneratedPosition(originalPosition: Position): Position {
        // Map original (Civet) -> TS snippet -> TSX, preserving offsets
        const result = super.getGeneratedPosition(originalPosition);
        // Re-add any prepended lines offset
        result.line += this.nrPrependesLines;
        return result;
    }

    isInGenerated(): boolean {
        // always return true and map outliers case by case
        return true;
    }
}
