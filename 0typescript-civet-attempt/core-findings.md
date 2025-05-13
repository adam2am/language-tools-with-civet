# Core Findings: Civet Source Map Generation & Preprocessor Integration

This document summarizes the investigation into enabling source maps for Civet code when used with `svelte-preprocess-with-civet`.

## Initial Problem:

When attempting to enable source maps in `svelte-preprocess-with-civet` (e.g., by passing `sourceMap: true` in its options), the preprocessor would throw an error:
`SyntaxError: Unexpected token o in JSON at position 1`
This indicated an issue with how the preprocessor was handling the output from the `@danielx/civet` compiler when source maps were requested.

## Investigation & Discoveries with `@danielx/civet` (`Civet.compile()`):

We tested `Civet.compile()` directly with various options:

1.  **`Civet.compile(civetCode, { sourceMap: true, js: false })` (Implicitly Synchronous Call):**
    *   **Result:** Returned an empty object `{}`.
    *   **Conclusion:** This is not the correct way to get a source map object or inline map for TS output in a synchronous call.

2.  **`Civet.compile(civetCode, { inlineMap: true, js: false })` (Implicitly Synchronous Call):**
    *   **Result:** Also returned an empty object `{}`.
    *   **Conclusion:** Same as above.

3.  **`await Civet.compile(civetCode, { inlineMap: true, js: false })` (Asynchronous Call):**
    *   **Result:** Successfully returned a **string** containing the compiled TypeScript code, followed by an inline source map comment (e.g., `//# sourceMappingURL=data:application/json;charset=utf-8;base64,...`).
    *   **Conclusion:** `@danielx/civet` can produce inline source maps for TypeScript output when its `compile` function is `await`ed and `inlineMap: true` is used. This was a key breakthrough.

4.  **`Civet.compile(civetCode, { inlineMap: true, sync: true, js: false })` (Explicitly Synchronous Call):**
    *   **Result:** Successfully returned a **string** containing the compiled TypeScript code with the inline source map comment.
    *   **Conclusion:** This is the correct way to get TypeScript code with an inline source map from `@danielx/civet` if the preprocessor needs to call it synchronously.

## Testing `svelte-preprocess-with-civet` with Corrected Civet Options:

Based on the above, we configured `svelte-preprocess-with-civet` to use the options `{ civet: { inlineMap: true, sync: true } }`.

*   **Result:**
    1.  The `SyntaxError: Unexpected token o in JSON...` **error was resolved**.
    2.  The preprocessor successfully transformed Civet code to TypeScript.
    3.  The `result.code` string returned by the preprocessor **contained the compiled TypeScript AND the raw inline source map comment** (e.g., `//# sourceMappingURL=...`).
    4.  The `result.map` property in the object returned by the preprocessor was **undefined/missing**.

## Current Status & Next Steps for `svelte-preprocess-with-civet`:

While `svelte-preprocess-with-civet` now correctly calls the Civet compiler using appropriate options to get an inline source map in the output string, it **does not yet process this inline map**.

To fully support source maps, `svelte-preprocess-with-civet` needs to be modified to:
1.  After receiving the string output from `Civet.compile({ inlineMap: true, sync: true, ... })`:
    *   Identify and extract the base64 encoded source map from the `//# sourceMappingURL=...` comment.
    *   Decode the base64 data.
    *   Parse the resulting JSON string into a JavaScript map object.
2.  Populate the `map` property of its return object with this parsed map object (e.g., `return { code: "...", map: parsedMapObject };`).
3.  Remove the `//# sourceMappingURL=...` comment from the `code` string it returns, as the map is now provided separately in the `map` property.

This will ensure that the Svelte compiler and downstream tools receive the source map in the expected format for correct source mapping from the final JavaScript back to the original Civet code.
