
> svelte2tsx@0.7.35 test-current /home/user/Documents/repos/ltools-backup/packages/svelte2tsx
> mocha test/test.ts --grep "#current"



  1 - civet: generating source map raw lines #happy #current

--- Civet Raw Map Test: var i ---
Compiled TS code:
let i1 = 0;for (const fruit of fruits) {const i = i1++;
  console.log(`Fruit ${i + 1}: ${fruit}`)
}
Raw map lines:
Line 1:[4] [2] [4] [1,0,0,0] [3,0,0,3] [1,0,0,4] [1,0,0,4] [6,0,0,4] [5,0,0,12] [1,0,0,13] [2,0,0,15] [1,0,0,16] [6,0,0,22] [1,0,0,22] [1,0,0,22] [1,0,0,10] [0,0,0,11] [6,0,0,11] [1] [3] [2] [2] [1,0,0,22]
Line 2:[0,0,1,0] [0,0,1,0] [2,0,1,2] [7,0,1,9] [1,0,1,10] [3,0,1,13] [1,0,1,13] [0,0,1,14] [1,0,1,15] [6,0,1,21] [2,0,1,23] [1,0,1,24] [1,0,1,25] [1,0,1,26] [1,0,1,27] [1,0,1,28] [1,0,1,29] [2,0,1,31] [2,0,1,33] [5,0,1,38] [1,0,1,39] [1,0,2,0] [1]
Line 3:[0,0,2,0]
    ✔ raw map for snippet with index var i (82ms)

--- Civet Raw Map Test: var index ---
Compiled TS code:
let i = 0;for (const fruit of fruits) {const index = i++;
  console.log(`Fruit ${index + 1}: ${fruit}`)
}
Raw map lines:
Line 1:[4] [1] [4] [1,0,0,0] [3,0,0,3] [1,0,0,4] [1,0,0,4] [6,0,0,4] [5,0,0,16] [1,0,0,17] [2,0,0,19] [1,0,0,20] [6,0,0,26] [1,0,0,26] [1,0,0,26] [1,0,0,10] [0,0,0,11] [6,0,0,11] [5] [3] [1] [2] [1,0,0,26]
Line 2:[0,0,1,0] [0,0,1,0] [2,0,1,2] [7,0,1,9] [1,0,1,10] [3,0,1,13] [1,0,1,13] [0,0,1,14] [1,0,1,15] [6,0,1,21] [2,0,1,23] [5,0,1,28] [1,0,1,29] [1,0,1,30] [1,0,1,31] [1,0,1,32] [1,0,1,33] [2,0,1,35] [2,0,1,37] [5,0,1,42] [1,0,1,43] [1,0,2,0] [1]
Line 3:[0,0,2,0]
    ✔ raw map for snippet with index var index

  2 - normalizeCivetMap = converting lines to v3 (dynamic scenarios) #happy #current

--- Scenario: for fruit, i of fruits ---

Civet Input:
for fruit, i of fruits
  console.log `Fruit ${i + 1}: ${fruit}`
TypeScript Output:
let i1 = 0;for (const fruit of fruits) {const i = i1++;
  console.log(`Fruit ${i + 1}: ${fruit}`)
}
[MAP_TO_V3 test.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 0
[MAP_TO_V3 test.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): WAAA,GAAG,CAAC,CAAA,MAAA,KAAQ,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAZ,AAAC,MAAA,SAAW;AACtB,AAAA,EAAE,OAAO,CAAC,GAAG,CAAA,AAAC,CAAC,MAAM,EAAE,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,EAAE,EAAE,KAAK,CAAC,CACvC;AAAA
Decoded V3 mapping segments per TS line:
Line 1: [11,0,0,0] [14,0,0,3] [15,0,0,4] [16,0,0,4] [22,0,0,4] [27,0,0,12] [28,0,0,13] [30,0,0,15] [31,0,0,16] [37,0,0,22] [38,0,0,22] [39,0,0,22] [40,0,0,10] [40,0,0,11] [46,0,0,11] [55,0,0,22]
Line 2: [0,0,1,0] [0,0,1,0] [2,0,1,2] [9,0,1,9] [10,0,1,10] [13,0,1,13] [14,0,1,13] [14,0,1,14] [15,0,1,15] [21,0,1,21] [23,0,1,23] [24,0,1,24] [25,0,1,25] [26,0,1,26] [27,0,1,27] [28,0,1,28] [29,0,1,29] [31,0,1,31] [33,0,1,33] [38,0,1,38] [39,0,1,39] [40,0,2,0]
Line 3: [0,0,2,0]
    1) should map tokens for for fruit, i of fruits

--- Scenario: for fruit, index of fruits ---

Civet Input:
for fruit, index of fruits
  console.log `Fruit ${index + 1}: ${fruit}`
TypeScript Output:
let i = 0;for (const fruit of fruits) {const index = i++;
  console.log(`Fruit ${index + 1}: ${fruit}`)
}
[MAP_TO_V3 test.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 0
[MAP_TO_V3 test.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): UAAA,GAAG,CAAC,CAAA,MAAA,KAAY,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAhB,AAAC,MAAA,YAAe;AAC1B,AAAA,EAAE,OAAO,CAAC,GAAG,CAAA,AAAC,CAAC,MAAM,EAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,EAAE,EAAE,KAAK,CAAC,CAC3C;AAAA
Decoded V3 mapping segments per TS line:
Line 1: [10,0,0,0] [13,0,0,3] [14,0,0,4] [15,0,0,4] [21,0,0,4] [26,0,0,16] [27,0,0,17] [29,0,0,19] [30,0,0,20] [36,0,0,26] [37,0,0,26] [38,0,0,26] [39,0,0,10] [39,0,0,11] [45,0,0,11] [57,0,0,26]
Line 2: [0,0,1,0] [0,0,1,0] [2,0,1,2] [9,0,1,9] [10,0,1,10] [13,0,1,13] [14,0,1,13] [14,0,1,14] [15,0,1,15] [21,0,1,21] [23,0,1,23] [28,0,1,28] [29,0,1,29] [30,0,1,30] [31,0,1,31] [32,0,1,32] [33,0,1,33] [35,0,1,35] [37,0,1,37] [42,0,1,42] [43,0,1,43] [44,0,2,0]
Line 3: [0,0,2,0]
    ✔ should map tokens for for fruit, index of fruits


  3 passing (250ms)
  1 failing

  1) 2 - normalizeCivetMap = converting lines to v3 (dynamic scenarios) #happy #current
       should map tokens for for fruit, i of fruits:
     AssertionError [ERR_ASSERTION]: Source mismatch for token "i"
      at /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/2 - current - mapToV3.test.ts:90:16
      at Generator.next (<anonymous>)
      at fulfilled (test/civet/2 - current - mapToV3.test.ts:5:58)



/home/user/Documents/repos/ltools-backup/packages/svelte2tsx:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  svelte2tsx@0.7.35 test-current: `mocha test/test.ts --grep "#current"`
Exit status 1
