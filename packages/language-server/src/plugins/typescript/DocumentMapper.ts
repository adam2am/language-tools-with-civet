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
        console.log('[ConsumerDocumentMapper] getOriginalPosition called with (TSX 0-based):', generatedPosition);

        // Step 1: map from TSX -> Svelte original positions (svelte2tsx map)
        // originalPositionFor expects 1-based lines
        const tsxMapped = originalPositionFor(this.traceMap, {
            line: generatedPosition.line + 1, // Use generatedPosition directly
            column: generatedPosition.character
        });
        console.log('[ConsumerDocumentMapper] raw svelte2tsx originalPositionFor result (1-based Svelte as svelte2tsx saw it):', tsxMapped);
        if (!tsxMapped || tsxMapped.line == null || tsxMapped.column == null) {
            console.log('[ConsumerDocumentMapper] no tsxMapped, returning -1');
            return { line: -1, character: -1 };
        }

        // initialPos is 0-based in the Svelte file content that svelte2tsx processed
        const initialPos: Position = {
            line: (tsxMapped.line || 0) - 1,
            character: tsxMapped.column || 0
        };
        console.log('[ConsumerDocumentMapper] initialPos after tsx mapping (0-based Svelte as svelte2tsx saw it):', initialPos);

        // Region-aware: if the generatedPosition lies within the TS snippet region,
        // always map through the Civet (preprocessor) mapper
        if (this.snippetRegion && this.parentMapper) {
            console.log('[ConsumerDocumentMapper] snippetRegion (TSX 0-based) bounds:', this.snippetRegion);
            const { start, end } = this.snippetRegion;
            // Check if generatedPosition (TSX 0-based) is in the snippetRegion (TSX 0-based)
            const inTsxSnippetRegion =
                (generatedPosition.line > start.line ||
                 (generatedPosition.line === start.line && generatedPosition.character >= start.character)) &&
                (generatedPosition.line < end.line ||
                 (generatedPosition.line === end.line && generatedPosition.character <= end.character));
            console.log('[ConsumerDocumentMapper] generatedPosition (TSX 0-based) is in snippetRegion (TSX 0-based):', inTsxSnippetRegion);
            if (inTsxSnippetRegion) {
                console.log('[ConsumerDocumentMapper] taking parentMapper branch for initialPos (0-based Svelte as svelte2tsx saw it):', initialPos);
                return this.parentMapper.getOriginalPosition(initialPos);
            }
        }
        console.log('[ConsumerDocumentMapper] returning initialPos (0-based Svelte as svelte2tsx saw it) for template/non-snippet content:', initialPos);
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
            // generatedPositionFor expects 1-based lines
            const tsxMapped = generatedPositionFor(this.traceMap, {
                line: originalPosition.line + 1,
                column: originalPosition.character,
                source: this.sourceUri
            });
            if (!tsxMapped || tsxMapped.line == null || tsxMapped.column == null) {
                return { line: -1, character: -1 };
            }
            // tsxMapped is 1-based, convert to 0-based for Position
            result = {
                line: tsxMapped.line - 1,
                character: tsxMapped.column
            };
        }
        // DO NOT re-add nrPrependedLines here. The svelte2tsx sourcemap
        // already maps to the TSX that includes the prepended lines from the Civet preprocessor.
        // The nrPrependedLines is for adjusting positions when creating the *final* TSX content
        // that TS Server sees, not for mapping between intermediate stages.
        // result.line += this.nrPrependedLines; // This was likely incorrect
        return result;
    }

    isInGenerated(): boolean {
        // always return true and map outliers case by case
        return true;
    }
}
