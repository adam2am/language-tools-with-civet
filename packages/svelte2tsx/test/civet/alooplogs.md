
> svelte2tsx@0.7.35 test-current /home/user/Documents/repos/ltools-backup/packages/svelte2tsx
> mocha test/test.ts --grep "#current"



  1 - civet: generating source map raw lines #happy #current

--- Civet Code Test (Dedented) ---
Compiled TypeScript:
 // Loop example\nfor fruit, index of fruits\n  console.log `Fruit ${index + 1}: ${fruit}`\n\nfor fruit, index in fruits\n  console.log `Fruit ${index + 1}: ${fruit}`
Output Map: {
  "lines": [
    [
      [
        0,
        0,
        0,
        0
      ],
      [
        165,
        0,
        1,
        0
      ],
      [
        0,
        0,
        1,
        0
      ]
    ]
  ],
  "line": 0,
  "colOffset": 0,
  "srcLine": 1,
  "srcColumn": 0,
  "srcOffset": 165,
  "srcTable": [
    165
  ],
  "source": "// Loop example\\nfor fruit, index of fruits\\n  console.log `Fruit ${index + 1}: ${fruit}`\\n\\nfor fruit, index in fruits\\n  console.log `Fruit ${index + 1}: ${fruit}`"
}
    1) handles state and propFunc declarations (dedented)

  2 - normalizeCivetMap = converting lines to v3 (dynamic scenarios) #happy #current

--- Scenario: for loops (of vs in) ---

Civet Input:
 // Loop example\nfor fruit, index of fruits\n  console.log `Fruit ${index + 1}: ${fruit}`\n\nfor fruit, index in fruits\n  console.log `Fruit ${index + 1}: ${fruit}`
TypeScript Output:
 // Loop example\nfor fruit, index of fruits\n  console.log `Fruit ${index + 1}: ${fruit}`\n\nfor fruit, index in fruits\n  console.log `Fruit ${index + 1}: ${fruit}`
[MAP_TO_V3 test.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 0
[MAP_TO_V3 test.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): AAAA,qKACA,AAAA
Decoded V3 mapping segments per TS line:
Line 1: [0,0,0,0] [165,0,1,0] [165,0,1,0]
    ✔ should map tokens for for loops (of vs in) (55ms)


  1 passing (245ms)
  1 failing

  1) 1 - civet: generating source map raw lines #happy #current
       handles state and propFunc declarations (dedented):

      AssertionError [ERR_ASSERTION]: Expected for...of structure for "of" loop
      + expected - actual

      -false
      +true
      
      at Context.<anonymous> (test/civet/1 - current - mapRawLines.test.ts:19:12)
      at processImmediate (node:internal/timers:476:21)



/home/user/Documents/repos/ltools-backup/packages/svelte2tsx:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  svelte2tsx@0.7.35 test-current: `mocha test/test.ts --grep "#current"`
Exit status 1
