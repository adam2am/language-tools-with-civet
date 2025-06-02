
The thing you’re bumping into here isn’t some new bug in our normalization code, it’s that Civet’s raw `map.lines` for these two loop forms is *shockingly* noisy and redundant, and our `normalizeCivetMap` is faithfully lifting every 4-element segment straight into the V3 map. Concretely:

1) **for…of fruits**  
   Civet compiles your first loop into  
   ```ts
   let i = 0;
   for (const fruit of fruits) { const index = i++; … }
   ```  
   and its raw map for that big “for(…fruit…fruits)…” line has dozens of 4-element segments, many mapping the *same* generated columns back to the same original columns (you can see repeated `[0,0,1,0]`, `[1,0,1,4]`, etc.). When we translate them one-for-one, the final V3 map has overlapping mappings for “fruit” (and even the surrounding `const` and `for(`), so your LS/IDE winds up “over‐hovering” – it picks up the very first mapping on that token, which often points to the start of the entire snippet, not just the `fruit` identifier.

2) **for…in fruits**  
   The raw map for the `for (const fruit in fruits)` line is *just as noisy* (lots of repeated segments and inconsistent deltas). We again lift every 4-element seg into V3, so now hovering “fruit” or “in” can hit the wrong one of those dozens of mappings, and you get seemingly “misplaced” hovers.

In short, **our granularity is literally “one mapping per raw Civet segment”**, and Civet is emitting hundreds of tiny segments on those loop lines. The normalize function isn’t collapsing or coalescing them; it trusts Civet completely. That abundance of overlapping mappings is exactly why:

- Your first loop’s `fruit` ends up hover–highlighting far beyond just the identifier.  
- Your second loop’s mappings get “misplaced” onto the wrong original positions.  

If you want clean, token-level hovers here, you’ll need to *post-process* the V3 map after normalization. For example:

• Group all mappings on a single generated line that share the same original span and only emit one.  
• Or detect contiguous segments whose `original` coords all increment in lockstep (like the characters of “fruit”) and merge them into a single mapping for the whole token.  

Without that kind of de-duplication or coalescing layer on top of `normalizeCivetMap`, the IDE will keep stumbling over Civet’s raw verbosity on these loop constructs.
