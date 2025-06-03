
> svelte2tsx@0.7.35 test-current /home/user/Documents/repos/ltools-backup/packages/svelte2tsx
> mocha test/test.ts --grep "#current"



  2.1 - Preprocessor loop mapping differences #current

--- Scenario: Decompose mapping for fruit loops (0fruitCase.svelte) (0fruitCase.svelte) ---
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Initializing for /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Found <script lang="civet"> (instance) at content start 21, end 304
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Original snippet from Svelte (21-304):

	fruits := ["apple", "mango"]
	// issue loop
	for fruit1, index of fruits
		console.log `Fruit ${index + 1}: ${fruit1}`
	// great loop
	for fruit2 of fruits
		console.log `Fruit ${fruit2}`
	// great loop
	for fruit3, index2 in fruits
	  console.log `Fruit ${index2 + 1}: ${fruit3}`

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Dedent Info: removedIndentString="" (length: 0)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Dedented snippet (removed 0 chars of indent):
	fruits := ["apple", "mango"]
	// issue loop
	for fruit1, index of fruits
		console.log `Fruit ${index + 1}: ${fruit1}`
	// great loop
	for fruit2 of fruits
		console.log `Fruit ${fruit2}`
	// great loop
	for fruit3, index2 in fruits
	  console.log `Fruit ${index2 + 1}: ${fruit3}`

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Civet compiled to TS:
	const fruits = ["apple", "mango"]
	// issue loop
	let i = 0;for (const fruit1 of fruits) {const index = i++;
		console.log(`Fruit ${index + 1}: ${fruit1}`)
	}
	// great loop
	for (const fruit2 of fruits) {
		console.log(`Fruit ${fruit2}`)
	}
	// great loop
	for (const fruit3 in fruits) {const index2 = fruits[fruit3];
	  console.log(`Fruit ${index2 + 1}: ${fruit3}`)
	}

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Raw Civet-to-TS map (first 3 lines of mappings): [[[0,0,0,0],[1,0,0,7],[6,0,0,1],[6,0,0,7],[1,0,0,8],[1,0,0,10],[1,0,0,11],[1,0,0,12],[7,0,0,19],[1,0,0,20],[1,0,0,21],[7,0,0,28],[1,0,0,29]],[[0,0,1,0],[0,0,1,0],[1,0,1,1],[13,0,1,14]],[[0,0,2,0],[0,0,2,0],[1],[4],[1],[4],[1,0,2,1],[3,0,2,4],[1,0,2,5],[1,0,2,5],[6,0,2,5],[6,0,2,18],[1,0,2,19],[2,0,2,21],[1,0,2,22],[6,0,2,28],[1,0,2,28],[1,0,2,28],[1,0,2,12],[0,0,2,13],[6,0,2,13],[5],[3],[1],[2],[1,0,2,28]]]
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Original content start in Svelte: line 2 (0-based offset: 1)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Normalizing Civet map. originalContentStartLine: 2, removedIndentLength: 0, filename: /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 1
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAO,MAAN,MAAM,CAAC,CAAE,CAAC,CAAC,OAAO,CAAC,CAAC,OAAO,CAAC;AAC7B,CAAC,aAAa;AACd,KAAI,KAAA,CAAH,GAAG,CAAC,CAAA,MAAA,MAAa,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAhB,MAAC,KAAK,GAAF,GAAD,CAAa
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAO,MAAN,MAAM,CAAC,CAAE,CAAC,CAAC,OAAO,CAAC,CAAC,OAAO,CAAC;AAC7B,CAAC,aAAa;AACd,KAAI,KAAA,CAAH,GAAG,CAAC,CAAA,MAAA,MAAa,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAhB,MAAC,KAAK,GAAF,GAAD,CAAa
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0fruitCase.svelte] Reindented compiled TS code for insertion (indent: ""):

	const fruits = ["apple", "mango"]
	// issue loop
	let i = 0;for (const fruit1 of fruits) {const index = i++;
		console.log(`Fruit ${index + 1}: ${fruit1}`)
	}
	// great loop
	for (const fruit2 of fruits) {
		console.log(`Fruit ${fruit2}`)
	}
	// great loop
	for (const fruit3 in fruits) {const index2 = fruits[fruit3];
	  console.log(`Fruit ${index2 + 1}: ${fruit3}`)
	}


--- Preprocessed TypeScript Code ---
 <script lang="ts">
	const fruits = ["apple", "mango"]
	// issue loop
	let i = 0;for (const fruit1 of fruits) {const index = i++;
		console.log(`Fruit ${index + 1}: ${fruit1}`)
	}
	// great loop
	for (const fruit2 of fruits) {
		console.log(`Fruit ${fruit2}`)
	}
	// great loop
	for (const fruit3 in fruits) {const index2 = fruits[fruit3];
	  console.log(`Fruit ${index2 + 1}: ${fruit3}`)
	}
</script>
<div>{fruits}</div> 
Original Svelte Content:
 <script lang="civet">
	fruits := ["apple", "mango"]
	// issue loop
	for fruit1, index of fruits
		console.log `Fruit ${index + 1}: ${fruit1}`
	// great loop
	for fruit2 of fruits
		console.log `Fruit ${fruit2}`
	// great loop
	for fruit3, index2 in fruits
	  console.log `Fruit ${index2 + 1}: ${fruit3}`
</script>
<div>{fruits}</div> 
Compiled TS Code (from preprocessor):
 	const fruits = ["apple", "mango"]
	// issue loop
	let i = 0;for (const fruit1 of fruits) {const index = i++;
		console.log(`Fruit ${index + 1}: ${fruit1}`)
	}
	// great loop
	for (const fruit2 of fruits) {
		console.log(`Fruit ${fruit2}`)
	}
	// great loop
	for (const fruit3 in fruits) {const index2 = fruits[fruit3];
	  console.log(`Fruit ${index2 + 1}: ${fruit3}`)
	}

Info from CivetBlockInfo:
  originalContentStartLine_1based: 2
  originalCivetLineCount: 12
  compiledTsLineCount: 15
Raw Civet-to-TS map lines:
  line 1 : [0,0,0,0][1,0,0,7][6,0,0,1][6,0,0,7][1,0,0,8][1,0,0,10][1,0,0,11][1,0,0,12][7,0,0,19][1,0,0,20][1,0,0,21][7,0,0,28][1,0,0,29][1]
  line 2 : [0,0,1,0][0,0,1,0][1,0,1,1][13,0,1,14][1]
  line 3 : [0,0,2,0][0,0,2,0][1][4][1][4][1,0,2,1][3,0,2,4][1,0,2,5][1,0,2,5][6,0,2,5][6,0,2,18][1,0,2,19][2,0,2,21][1,0,2,22][6,0,2,28][1,0,2,28][1,0,2,28][1,0,2,12][0,0,2,13][6,0,2,13][5][3][1][2][1,0,2,28][1]
  line 4 : [0,0,3,0][0,0,3,0][2,0,3,2][7,0,3,9][1,0,3,10][3,0,3,13][1,0,3,13][0,0,3,14][1,0,3,15][6,0,3,21][2,0,3,23][5,0,3,28][1,0,3,29][1,0,3,30][1,0,3,31][1,0,3,32][1,0,3,33][2,0,3,35][2,0,3,37][6,0,3,43][1,0,3,44][1,0,3,45][1][1]
  line 5 : [1,0,3,45][1,0,3,45][1]
  line 6 : [0,0,4,0][0,0,4,0][1,0,4,1][13,0,4,14][1]
  line 7 : [0,0,5,0][0,0,5,0][1,0,5,1][3,0,5,4][1,0,5,5][1,0,5,5][6,0,5,5][6,0,5,11][1,0,5,12][2,0,5,14][1,0,5,15][6,0,5,21][1,0,5,21][1,0,5,21][1,0,5,21][1]
  line 8 : [0,0,6,0][0,0,6,0][2,0,6,2][7,0,6,9][1,0,6,10][3,0,6,13][1,0,6,13][0,0,6,14][1,0,6,15][6,0,6,21][2,0,6,23][6,0,6,29][1,0,6,30][1,0,6,31][1][1]
  line 9 : [1,0,6,31][1,0,6,31][1]
  line 10 : [0,0,7,0][0,0,7,0][1,0,7,1][13,0,7,14][1]
  line 11 : [0,0,8,0][0,0,8,0][1,0,8,1][3,0,8,4][1,0,8,5][1,0,8,5][6,0,8,5][6,0,8,19][1,0,8,20][2,0,8,22][1,0,8,23][6,0,8,29][1,0,8,29][1,0,8,29][1,0,8,12][0,0,8,13][6,0,8,13][6][3,0,8,22][0,0,8,23][6][1,0,8,5][6][1][1,0,8,29][1]
  line 12 : [0,0,9,0][0,0,9,0][3,0,9,3][7,0,9,10][1,0,9,11][3,0,9,14][1,0,9,14][0,0,9,15][1,0,9,16][6,0,9,22][2,0,9,24][6,0,9,30][1,0,9,31][1,0,9,32][1,0,9,33][1,0,9,34][1,0,9,35][2,0,9,37][2,0,9,39][6,0,9,45][1,0,9,46][1,0,9,47][1][1]
  line 13 : [1,0,9,47][1,0,9,47][1]
  line 14 : [0,0,10,0][1]
Normalized V3 map from Preprocessor:
  Line 1: AACA,CAAO,MAAN,MAAM,CAAC,CAAE,CAAC,CAAC,OAAO,CAAC,CAAC,OAAO,CAAC
  Line 2: AAC7B,CAAC,aAAa
  Line 3: AACd,KAAI,KAAA,CAAH,GAAG,CAAC,CAAA,MAAA,MAAa,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAhB,MAAC,KAAK,GAAF,GAAD,CAAa
  Line 4: AAC5B,EAAE,OAAO,CAAC,GAAG,CAAA,CAAE,MAAM,EAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,EAAE,EAAE,MAAM,CAAC,CAAC
  Line 5: CAAA,CAAA
  Line 6: AAC7C,CAAC,aAAa
  Line 7: AACd,CAAC,GAAG,CAAC,CAAA,MAAA,MAAM,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAA
  Line 8: AACrB,EAAE,OAAO,CAAC,GAAG,CAAA,CAAE,MAAM,EAAE,MAAM,CAAC,CAAC
  Line 9: CAAA,CAAA
  Line 10: AAC/B,CAAC,aAAa
  Line 11: AACd,CAAC,GAAG,CAAC,CAAA,MAAA,MAAc,CAAC,EAAE,CAAC,MAAM,CAAA,CAAA,CAAjB,MAAC,MAAM,GAAG,MAAM,CAAvB,MAAM,EAAkB
  Line 12: AAC7B,GAAG,OAAO,CAAC,GAAG,CAAA,CAAE,MAAM,EAAE,MAAM,CAAC,CAAC,CAAC,CAAC,CAAC,EAAE,EAAE,MAAM,CAAC,CAAC
  Line 13: CAAA,CAAA
  Line 14: AAC/C
Decoded V3 mapping segments:
  TS Line 1: [0,0,1,0] [1,0,1,7] [7,0,1,1] [13,0,1,7] [14,0,1,8] [15,0,1,10] [16,0,1,11] [17,0,1,12] [24,0,1,19] [25,0,1,20] [26,0,1,21] [33,0,1,28] [34,0,1,29]
  TS Line 2: [0,0,2,0] [1,0,2,1] [14,0,2,14]
  TS Line 3: [0,0,3,0] [5,0,3,4] [10,0,3,4] [11,0,3,1] [14,0,3,4] [15,0,3,5] [16,0,3,5] [22,0,3,5] [28,0,3,18] [29,0,3,19] [31,0,3,21] [32,0,3,22] [38,0,3,28] [39,0,3,28] [40,0,3,28] [41,0,3,12] [47,0,3,13] [52,0,3,18] [55,0,3,16] [58,0,3,15] [59,0,3,28]
  TS Line 4: [0,0,4,0] [2,0,4,2] [9,0,4,9] [10,0,4,10] [13,0,4,13] [14,0,4,13] [15,0,4,15] [21,0,4,21] [23,0,4,23] [28,0,4,28] [29,0,4,29] [30,0,4,30] [31,0,4,31] [32,0,4,32] [33,0,4,33] [35,0,4,35] [37,0,4,37] [43,0,4,43] [44,0,4,44] [45,0,4,45]
  TS Line 5: [1,0,4,45] [2,0,4,45]
  TS Line 6: [0,0,5,0] [1,0,5,1] [14,0,5,14]
  TS Line 7: [0,0,6,0] [1,0,6,1] [4,0,6,4] [5,0,6,5] [6,0,6,5] [12,0,6,5] [18,0,6,11] [19,0,6,12] [21,0,6,14] [22,0,6,15] [28,0,6,21] [29,0,6,21] [30,0,6,21] [31,0,6,21]
  TS Line 8: [0,0,7,0] [2,0,7,2] [9,0,7,9] [10,0,7,10] [13,0,7,13] [14,0,7,13] [15,0,7,15] [21,0,7,21] [23,0,7,23] [29,0,7,29] [30,0,7,30] [31,0,7,31]
  TS Line 9: [1,0,7,31] [2,0,7,31]
  TS Line 10: [0,0,8,0] [1,0,8,1] [14,0,8,14]
  TS Line 11: [0,0,9,0] [1,0,9,1] [4,0,9,4] [5,0,9,5] [6,0,9,5] [12,0,9,5] [18,0,9,19] [19,0,9,20] [21,0,9,22] [22,0,9,23] [28,0,9,29] [29,0,9,29] [30,0,9,29] [31,0,9,12] [37,0,9,13] [43,0,9,19] [46,0,9,22] [52,0,9,28] [53,0,9,5] [59,0,9,11] [61,0,9,29]
  TS Line 12: [0,0,10,0] [3,0,10,3] [10,0,10,10] [11,0,10,11] [14,0,10,14] [15,0,10,14] [16,0,10,16] [22,0,10,22] [24,0,10,24] [30,0,10,30] [31,0,10,31] [32,0,10,32] [33,0,10,33] [34,0,10,34] [35,0,10,35] [37,0,10,37] [39,0,10,39] [45,0,10,45] [46,0,10,46] [47,0,10,47]
  TS Line 13: [1,0,10,47] [2,0,10,47]
  TS Line 14: [0,0,11,0]
    ✔ should correctly map tokens for Decompose mapping for fruit loops (0fruitCase.svelte) (157ms)


  1 passing (162ms)

