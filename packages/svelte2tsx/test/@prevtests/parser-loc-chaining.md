# Guidelines, main approach to chaining and nice mapping:
- Utilize the `svelte2tsx` function as the primary entry point for converting Svelte components with embedded Civet script blocks into TSX. This process yields both the TSX code and a chained source map.
- Ensure that Civet code within Svelte components is encapsulated in `<script lang="civet">...</script>` tags for `svelte2tsx` to correctly identify and process it.
- Employ the `@jridgewell/trace-mapping` library, specifically `TraceMap` and `originalPositionFor` (using the `LEAST_UPPER_BOUND` bias), to accurately trace positions from the generated TSX back to their original locations in the Svelte/Civet source.
- Convert 0-indexed offsets and 0-based column numbers from source map utilities to 1-based lines and human-friendly column numbers when creating assertions or displaying results.

# Findings, conclusions:
- The implemented source map chaining mechanism within `svelte2tsx` correctly maps string literals from the final TSX output back to their precise original positions within Civet code embedded in Svelte files.
- All tested edge cases (top-level assignment, literals in `if` and `else` branches, and multiple literals on a single line) demonstrated accurate mapping.
- The chaining process effectively handles variations in indentation and multi-line Civet code blocks.
- While tests focused on string literals, the underlying `chainSourceMaps` logic and debug output suggest that other AST nodes (identifiers, operators) are also being mapped, evidenced by continuous segment chaining.
    - Expand microtests to cover variable names, operators, comments, and other syntax constructs.
    - Consider programmatically validating *all* mapping segments by iterating through `TraceMap.decodedMappings` and checking each against the original Svelte/Civet content.
- The testing pattern (Svelte component with embedded language -> `svelte2tsx` -> chained map -> `originalPositionFor` validation) is a reusable model for verifying source map accuracy in multi-stage compilation pipelines.
✔✔✔ All edge-case microtests in `parser-loc-chaining-test.mjs` passed successfully, confirming accurate mapping for all defined scenarios.


## Further => edgecases with false parsing