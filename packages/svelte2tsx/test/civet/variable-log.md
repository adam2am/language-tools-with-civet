
> svelte2tsx@0.7.35 test-current /home/user/Documents/repos/ltools-backup/packages/svelte2tsx
> mocha test/test.ts --grep "#current"



  2.1 - Preprocessor loop mapping differences #current

--- Scenario: Testing sourcemap accuracy for multi-character variables at line-end (no semicolon) vs. single-char variables, based on user report. (multi-char-var.svelte) ---
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Initializing for /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Found <script lang="civet"> (instance) at content start 21, end 131
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Original snippet from Svelte (21-131):

	z .= 4
	vari .= 123
	number1 .= vari
	varIssue := () =>
		number2 .= vari
	varGreat := () =>
		number2 .= z

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Dedent Info: removedIndentString="" (length: 0)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Dedented snippet (removed 0 chars of indent):
	z .= 4
	vari .= 123
	number1 .= vari
	varIssue := () =>
		number2 .= vari
	varGreat := () =>
		number2 .= z

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Civet compiled to TS:
	let z = 4
	let vari = 123
	let number1 = vari
	const varIssue = () => {
		let number2 = vari;return number2
	}
	const varGreat = () => {
		let number2 = z;return number2
	}

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Raw Civet-to-TS map (first 3 lines of mappings): [[[0,0,0,0],[1,0,0,2],[4,0,0,1],[1,0,0,2],[1,0,0,3],[1,0,0,5],[1,0,0,6],[1,0,0,7]],[[0,0,1,0],[0,0,1,0],[1,0,1,5],[4,0,1,1],[4,0,1,5],[1,0,1,6],[1,0,1,8],[1,0,1,9],[3,0,1,12]],[[0,0,2,0],[0,0,2,0],[1,0,2,8],[4,0,2,1],[7,0,2,8],[1,0,2,9],[1,0,2,11],[1,0,2,12],[4,0,2,16]]]
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Original content start in Svelte: line 2 (0-based offset: 1)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Normalizing Civet map. originalContentStartLine: 2, removedIndentLength: 0, filename: /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 1
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAE,IAAD,CAAC,CAAC,CAAE,CAAC,CAAC;AACP,CAAK,IAAJ,IAAI,CAAC,CAAE,CAAC,GAAG;AACZ,CAAQ,IAAP,OAAO,CAAC,CAAE,CAAC,IAAI
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAE,IAAD,CAAC,CAAC,CAAE,CAAC,CAAC;AACP,CAAK,IAAJ,IAAI,CAAC,CAAE,CAAC,GAAG;AACZ,CAAQ,IAAP,OAAO,CAAC,CAAE,CAAC,IAAI
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/multi-char-var.svelte] Reindented compiled TS code for insertion (indent: ""):

	let z = 4
	let vari = 123
	let number1 = vari
	const varIssue = () => {
		let number2 = vari;return number2
	}
	const varGreat = () => {
		let number2 = z;return number2
	}

Original Svelte Content:
 <script lang="civet">
	z .= 4
	vari .= 123
	number1 .= vari
	varIssue := () =>
		number2 .= vari
	varGreat := () =>
		number2 .= z
</script>
<div>{fruits}</div> 
Compiled TS Code (from preprocessor):
 	let z = 4
	let vari = 123
	let number1 = vari
	const varIssue = () => {
		let number2 = vari;return number2
	}
	const varGreat = () => {
		let number2 = z;return number2
	}

Info from CivetBlockInfo:
  originalContentStartLine_1based: 2
  originalCivetLineCount: 9
  compiledTsLineCount: 11
Raw Civet-to-TS map lines:
  line 1 : [0,0,0,0][1,0,0,2][4,0,0,1][1,0,0,2][1,0,0,3][1,0,0,5][1,0,0,6][1,0,0,7][1]
  line 2 : [0,0,1,0][0,0,1,0][1,0,1,5][4,0,1,1][4,0,1,5][1,0,1,6][1,0,1,8][1,0,1,9][3,0,1,12][1]
  line 3 : [0,0,2,0][0,0,2,0][1,0,2,8][4,0,2,1][7,0,2,8][1,0,2,9][1,0,2,11][1,0,2,12][4,0,2,16][1]
  line 4 : [0,0,3,0][0,0,3,0][1,0,3,9][6,0,3,1][8,0,3,9][1,0,3,10][1,0,3,12][1,0,3,13][1,0,3,14][1,0,3,15][1,0,3,16][2,0,3,18][1,0,3,18][1,0,3,18][1]
  line 5 : [0,0,4,0][0,0,4,0][2,0,4,9][4,0,4,2][7,0,4,9][1,0,4,10][1,0,4,12][1,0,4,13][4][1][6][1,0,4,2][7][1]
  line 6 : [1,0,4,17][1,0,4,17][1]
  line 7 : [0,0,5,0][0,0,5,0][1,0,5,9][6,0,5,1][8,0,5,9][1,0,5,10][1,0,5,12][1,0,5,13][1,0,5,14][1,0,5,15][1,0,5,16][2,0,5,18][1,0,5,18][1,0,5,18][1]
  line 8 : [0,0,6,0][0,0,6,0][2,0,6,9][4,0,6,2][7,0,6,9][1,0,6,10][1,0,6,12][1,0,6,13][1][1][6][1,0,6,2][7][1]
  line 9 : [1,0,6,14][1,0,6,14][1]
  line 10 : [0,0,7,0][1]
Normalized V3 map from Preprocessor:
  Line 1: AACA,CAAE,IAAD,CAAC,CAAC,CAAE,CAAC,CAAC
  Line 2: AACP,CAAK,IAAJ,IAAI,CAAC,CAAE,CAAC,GAAG
  Line 3: AACZ,CAAQ,IAAP,OAAO,CAAC,CAAE,CAAC,IAAI
  Line 4: AAChB,CAAS,MAAR,QAAQ,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA
  Line 5: AAClB,EAAS,IAAP,OAAO,CAAC,CAAE,CAAC,YAAX
  Line 6: CAAe,CAAA
  Line 7: AACjB,CAAS,MAAR,QAAQ,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA
  Line 8: AAClB,EAAS,IAAP,OAAO,CAAC,CAAE,CAAC,SAAX
  Line 9: CAAY,CAAA
  Line 10: AACd
Decoded V3 mapping segments:
  TS Line 1: [0,0,1,0] [1,0,1,2] [5,0,1,1] [6,0,1,2] [7,0,1,3] [8,0,1,5] [9,0,1,6] [10,0,1,7]
  TS Line 2: [0,0,2,0] [1,0,2,5] [5,0,2,1] [9,0,2,5] [10,0,2,6] [11,0,2,8] [12,0,2,9] [15,0,2,12]
  TS Line 3: [0,0,3,0] [1,0,3,8] [5,0,3,1] [12,0,3,8] [13,0,3,9] [14,0,3,11] [15,0,3,12] [19,0,3,16]
  TS Line 4: [0,0,4,0] [1,0,4,9] [7,0,4,1] [15,0,4,9] [16,0,4,10] [17,0,4,12] [18,0,4,13] [19,0,4,14] [20,0,4,15] [21,0,4,16] [23,0,4,18] [24,0,4,18] [25,0,4,18]
  TS Line 5: [0,0,5,0] [2,0,5,9] [6,0,5,2] [13,0,5,9] [14,0,5,10] [15,0,5,12] [16,0,5,13] [28,0,5,2]
  TS Line 6: [1,0,5,17] [2,0,5,17]
  TS Line 7: [0,0,6,0] [1,0,6,9] [7,0,6,1] [15,0,6,9] [16,0,6,10] [17,0,6,12] [18,0,6,13] [19,0,6,14] [20,0,6,15] [21,0,6,16] [23,0,6,18] [24,0,6,18] [25,0,6,18]
  TS Line 8: [0,0,7,0] [2,0,7,9] [6,0,7,2] [13,0,7,9] [14,0,7,10] [15,0,7,12] [16,0,7,13] [25,0,7,2]
  TS Line 9: [1,0,7,14] [2,0,7,14]
  TS Line 10: [0,0,8,0]
  Asserted token 'z_decl' ('z'): TS(1:5) -> Original(2:1) - OK
  Asserted token 'vari_decl' ('vari'): TS(2:5) -> Original(3:1) - OK
  Asserted token 'number1_decl' ('number1'): TS(3:5) -> Original(4:1) - OK
  Asserted token 'vari_in_number1' ('vari'): TS(3:15) -> Original(4:12) - OK
  Asserted token 'number2_decl_in_varIssue' ('number2'): TS(5:6) -> Original(6:2) - OK
  Asserted token 'vari_in_varIssue_problematic' ('vari'): TS(5:16) -> Original(6:13) - OK
  Asserted token 'z_in_varGreat_control' ('z'): TS(8:16) -> Original(8:13) - OK
    ✔ should correctly map tokens for Testing sourcemap accuracy for multi-character variables at line-end (no semicolon) vs. single-char variables, based on user report. (181ms)


  1 passing (193ms)

