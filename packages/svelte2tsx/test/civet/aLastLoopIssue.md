
> svelte2tsx@0.7.35 test-current /home/user/Documents/repos/ltools-backup/packages/svelte2tsx
> mocha test/test.ts --grep "#current"



  2.1 - Preprocessor loop mapping differences #current

--- Scenario: Mapping for "for fruit, indexdd in fruits" and "for fruit in fruits" (lastLoopIssue.svelte) ---
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Initializing for /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Found <script lang="civet"> (instance) at content start 21, end 219
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Original snippet from Svelte (21-219):

	fruits := ["apple", "mango"]
	// no issue loop:
	for fruit in fruits
	  console.log `Fruit ${fruit}`
	
	// issue loop
	for fruit, indexdd in fruits
	  console.log `Fruit ${indexdd + 1}: ${fruit}`

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Dedent Info: removedIndentString="" (length: 0)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Dedented snippet (removed 0 chars of indent):
	fruits := ["apple", "mango"]
	// no issue loop:
	for fruit in fruits
	  console.log `Fruit ${fruit}`
	
	// issue loop
	for fruit, indexdd in fruits
	  console.log `Fruit ${indexdd + 1}: ${fruit}`

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Civet compiled to TS:
	const fruits = ["apple", "mango"]
	// no issue loop:
	for (const fruit in fruits) {
	  console.log(`Fruit ${fruit}`)
	}
	
	// issue loop
	for (const fruit in fruits) {const indexdd = fruits[fruit];
	  console.log(`Fruit ${indexdd + 1}: ${fruit}`)
	}

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Raw Civet-to-TS map (first 3 lines of mappings): [[[0,0,0,0],[1,0,0,7],[6,0,0,1],[6,0,0,7],[1,0,0,8],[1,0,0,10],[1,0,0,11],[1,0,0,12],[7,0,0,19],[1,0,0,20],[1,0,0,21],[7,0,0,28],[1,0,0,29]],[[0,0,1,0],[0,0,1,0],[1,0,1,1],[17,0,1,18]],[[0,0,2,0],[0,0,2,0],[1,0,2,1],[3,0,2,4],[1,0,2,5],[1,0,2,5],[6,0,2,5],[5,0,2,10],[1,0,2,11],[2,0,2,13],[1,0,2,14],[6,0,2,20],[1,0,2,20],[1,0,2,20],[1,0,2,20]]]
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Original content start in Svelte: line 2 (0-based offset: 1)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Normalizing Civet map. originalContentStartLine: 2, removedIndentLength: 0, filename: /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 1
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAO,MAAN,MAAM,CAAC,CAAE,CAAC,CAAC,OAAO,CAAC,CAAC,OAAO,CAAC;AAC7B,AAAA,CAAC,iBAAiB;AAClB,AAAA,CAAC,GAAG,CAAC,CAAA,MAAA,KAAK,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAA
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAO,MAAN,MAAM,CAAC,CAAE,CAAC,CAAC,OAAO,CAAC,CAAC,OAAO,CAAC;AAC7B,AAAA,CAAC,iBAAiB;AAClB,AAAA,CAAC,GAAG,CAAC,CAAA,MAAA,KAAK,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAA
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/lastLoopIssue.svelte] Reindented compiled TS code for insertion (indent: ""):

	const fruits = ["apple", "mango"]
	// no issue loop:
	for (const fruit in fruits) {
	  console.log(`Fruit ${fruit}`)
	}
	
	// issue loop
	for (const fruit in fruits) {const indexdd = fruits[fruit];
	  console.log(`Fruit ${indexdd + 1}: ${fruit}`)
	}

Original Svelte Content:
 <script lang="civet">
	fruits := ["apple", "mango"]
	// no issue loop:
	for fruit in fruits
	  console.log `Fruit ${fruit}`
	
	// issue loop
	for fruit, indexdd in fruits
	  console.log `Fruit ${indexdd + 1}: ${fruit}`
</script>
<div>{fruits}</div> 
Compiled TS Code (from preprocessor):
 	const fruits = ["apple", "mango"]
	// no issue loop:
	for (const fruit in fruits) {
	  console.log(`Fruit ${fruit}`)
	}
	
	// issue loop
	for (const fruit in fruits) {const indexdd = fruits[fruit];
	  console.log(`Fruit ${indexdd + 1}: ${fruit}`)
	}

Info from CivetBlockInfo:
  originalContentStartLine_1based: 2
  originalCivetLineCount: 10
  compiledTsLineCount: 12
Raw Civet-to-TS map lines: [
  [
    [ 0, 0, 0, 0 ],  [ 1, 0, 0, 7 ],
    [ 6, 0, 0, 1 ],  [ 6, 0, 0, 7 ],
    [ 1, 0, 0, 8 ],  [ 1, 0, 0, 10 ],
    [ 1, 0, 0, 11 ], [ 1, 0, 0, 12 ],
    [ 7, 0, 0, 19 ], [ 1, 0, 0, 20 ],
    [ 1, 0, 0, 21 ], [ 7, 0, 0, 28 ],
    [ 1, 0, 0, 29 ]
  ],
  [ [ 0, 0, 1, 0 ], [ 0, 0, 1, 0 ], [ 1, 0, 1, 1 ], [ 17, 0, 1, 18 ] ],
  [
    [ 0, 0, 2, 0 ],  [ 0, 0, 2, 0 ],
    [ 1, 0, 2, 1 ],  [ 3, 0, 2, 4 ],
    [ 1, 0, 2, 5 ],  [ 1, 0, 2, 5 ],
    [ 6, 0, 2, 5 ],  [ 5, 0, 2, 10 ],
    [ 1, 0, 2, 11 ], [ 2, 0, 2, 13 ],
    [ 1, 0, 2, 14 ], [ 6, 0, 2, 20 ],
    [ 1, 0, 2, 20 ], [ 1, 0, 2, 20 ],
    [ 1, 0, 2, 20 ]
  ],
  [
    [ 0, 0, 3, 0 ],  [ 0, 0, 3, 0 ],
    [ 3, 0, 3, 3 ],  [ 7, 0, 3, 10 ],
    [ 1, 0, 3, 11 ], [ 3, 0, 3, 14 ],
    [ 1, 0, 3, 14 ], [ 0, 0, 3, 15 ],
    [ 1, 0, 3, 16 ], [ 6, 0, 3, 22 ],
    [ 2, 0, 3, 24 ], [ 5, 0, 3, 29 ],
    [ 1, 0, 3, 30 ], [ 1, 0, 3, 31 ],
    [ 1 ]
  ],
  [ [ 1, 0, 3, 31 ], [ 1, 0, 3, 31 ] ],
  [ [ 0, 0, 4, 0 ], [ 0, 0, 4, 0 ], [ 1, 0, 4, 1 ] ],
  [ [ 0, 0, 5, 0 ], [ 0, 0, 5, 0 ], [ 1, 0, 5, 1 ], [ 13, 0, 5, 14 ] ],
  [
    [ 0, 0, 6, 0 ],  [ 0, 0, 6, 0 ],
    [ 1, 0, 6, 1 ],  [ 3, 0, 6, 4 ],
    [ 1, 0, 6, 5 ],  [ 1, 0, 6, 5 ],
    [ 6, 0, 6, 5 ],  [ 5, 0, 6, 19 ],
    [ 1, 0, 6, 20 ], [ 2, 0, 6, 22 ],
    [ 1, 0, 6, 23 ], [ 6, 0, 6, 29 ],
    [ 1, 0, 6, 29 ], [ 1, 0, 6, 29 ],
    [ 1, 0, 6, 11 ], [ 0, 0, 6, 12 ],
    [ 6, 0, 6, 12 ], [ 7 ],
    [ 3, 0, 6, 22 ], [ 0, 0, 6, 23 ],
    [ 6 ],           [ 1, 0, 6, 5 ],
    [ 5 ],           [ 1 ],
    [ 1, 0, 6, 29 ]
  ],
  [
    [ 0, 0, 7, 0 ],  [ 0, 0, 7, 0 ],
    [ 3, 0, 7, 3 ],  [ 7, 0, 7, 10 ],
    [ 1, 0, 7, 11 ], [ 3, 0, 7, 14 ],
    [ 1, 0, 7, 14 ], [ 0, 0, 7, 15 ],
    [ 1, 0, 7, 16 ], [ 6, 0, 7, 22 ],
    [ 2, 0, 7, 24 ], [ 7, 0, 7, 31 ],
    [ 1, 0, 7, 32 ], [ 1, 0, 7, 33 ],
    [ 1, 0, 7, 34 ], [ 1, 0, 7, 35 ],
    [ 1, 0, 7, 36 ], [ 2, 0, 7, 38 ],
    [ 2, 0, 7, 40 ], [ 5, 0, 7, 45 ],
    [ 1, 0, 7, 46 ], [ 1, 0, 7, 47 ],
    [ 1 ]
  ],
  [ [ 1, 0, 7, 47 ], [ 1, 0, 7, 47 ] ],
  [ [ 0, 0, 8, 0 ] ]
]
Normalized V3 map from Preprocessor (first 3 mapping lines):
AACA,CAAO,MAAN,MAAM,CAAC,CAAE,CAAC,CAAC,OAAO,CAAC,CAAC,OAAO,CAAC;AAC7B,AAAA,CAAC,iBAAiB;AAClB,AAAA,CAAC,GAAG,CAAC,CAAA,MAAA,KAAK,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAA
Decoded V3 mapping segments:
  TS Line 1: [0,0,1,0] [1,0,1,7] [7,0,1,1] [13,0,1,7] [14,0,1,8] [15,0,1,10] [16,0,1,11] [17,0,1,12] [24,0,1,19] [25,0,1,20] [26,0,1,21] [33,0,1,28] [34,0,1,29]
  TS Line 2: [0,0,2,0] [0,0,2,0] [1,0,2,1] [18,0,2,18]
  TS Line 3: [0,0,3,0] [0,0,3,0] [1,0,3,1] [4,0,3,4] [5,0,3,5] [6,0,3,5] [12,0,3,5] [17,0,3,10] [18,0,3,11] [20,0,3,13] [21,0,3,14] [27,0,3,20] [28,0,3,20] [29,0,3,20] [30,0,3,20]
  TS Line 4: [0,0,4,0] [0,0,4,0] [3,0,4,3] [10,0,4,10] [11,0,4,11] [14,0,4,14] [15,0,4,14] [15,0,4,15] [16,0,4,16] [22,0,4,22] [24,0,4,24] [29,0,4,29] [30,0,4,30] [31,0,4,31]
  TS Line 5: [1,0,4,31] [2,0,4,31]
  TS Line 6: [0,0,5,0] [0,0,5,0] [1,0,5,1]
  TS Line 7: [0,0,6,0] [0,0,6,0] [1,0,6,1] [14,0,6,14]
  TS Line 8: [0,0,7,0] [0,0,7,0] [1,0,7,1] [4,0,7,4] [5,0,7,5] [6,0,7,5] [12,0,7,5] [17,0,7,19] [18,0,7,20] [20,0,7,22] [21,0,7,23] [27,0,7,29] [28,0,7,29] [29,0,7,29] [30,0,7,11] [30,0,7,12] [36,0,7,12] [46,0,7,22] [46,0,7,23] [53,0,7,5] [60,0,7,29]
  TS Line 9: [0,0,8,0] [0,0,8,0] [3,0,8,3] [10,0,8,10] [11,0,8,11] [14,0,8,14] [15,0,8,14] [15,0,8,15] [16,0,8,16] [22,0,8,22] [24,0,8,24] [31,0,8,31] [32,0,8,32] [33,0,8,33] [34,0,8,34] [35,0,8,35] [36,0,8,36] [38,0,8,38] [40,0,8,40] [45,0,8,45] [46,0,8,46] [47,0,8,47]
  TS Line 10: [1,0,8,47] [2,0,8,47]
  TS Line 11: [0,0,9,0]
  Asserted token 'fruits_def' ('fruits'): TS(1:7) -> Original(2:1) - OK
  Asserted token 'no_issue_loop_fruit_iterator' ('fruit'): TS(3:12) -> Original(4:5) - OK
  Asserted token 'no_issue_loop_fruits_collection' ('fruits'): TS(3:21) -> Original(4:14) - OK
  Asserted token 'no_issue_log_console' ('console'): TS(4:3) -> Original(5:3) - OK
    1) should correctly map tokens for Mapping for "for fruit, indexdd in fruits" and "for fruit in fruits"


  0 passing (169ms)
  1 failing

  1) 2.1 - Preprocessor loop mapping differences #current
       should correctly map tokens for Mapping for "for fruit, indexdd in fruits" and "for fruit in fruits":

      AssertionError [ERR_ASSERTION]: Original column mismatch for token 'no_issue_log_fruit_usage'. Expected 23, got 24. TS Line: 4, Col: 24
      + expected - actual

      -24
      +23
      
      at /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/2.1 - current - loopsPreprocessor.test.ts:217:16
      at Generator.next (<anonymous>)
      at fulfilled (test/civet/2.1 - current - loopsPreprocessor.test.ts:38:58)



/home/user/Documents/repos/ltools-backup/packages/svelte2tsx:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  svelte2tsx@0.7.35 test-current: `mocha test/test.ts --grep "#current"`
Exit status 1
