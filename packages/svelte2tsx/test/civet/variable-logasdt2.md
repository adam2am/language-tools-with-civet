
> svelte2tsx@0.7.35 test-current /home/user/Documents/repos/ltools-backup/packages/svelte2tsx
> mocha test/test.ts --grep "#current"



  2.1 - Preprocessor loop mapping differences #current

--- Scenario: Testing sourcemap accuracy for return statements with and without trailing semicolon in Civet and variable assignments. (0returnCase.svelte) ---
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Initializing for /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Found <script lang="civet"> (instance) at content start 21, end 224
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Original snippet from Svelte (21-224):

	funcIssue := () =>
		number1 := 1; // line 2
		return number1

	funcGreat := () =>
		number2 := 1; // line 6
		return number2;

	varIssue := () =>
		number3 .= va 

	varGreat := () =>
		number4 .= z 


[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Dedent Info: removedIndentString="" (length: 0)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Dedented snippet (removed 0 chars of indent):
	funcIssue := () =>
		number1 := 1; // line 2
		return number1

	funcGreat := () =>
		number2 := 1; // line 6
		return number2;

	varIssue := () =>
		number3 .= va 

	varGreat := () =>
		number4 .= z 


[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Civet compiled to TS:
	const funcIssue = () => {
		const number1 = 1; // line 2
		return number1
	}

	const funcGreat = () => {
		const number2 = 1; // line 6
		return number2;
	}

	const varIssue = () => {
		let number3 = va;return number3
	} 

	const varGreat = () => {
		let number4 = z;return number4
	} 


[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Raw Civet-to-TS map (first 3 lines of mappings): [[[0,0,0,0],[1,0,0,10],[6,0,0,1],[9,0,0,10],[1,0,0,11],[1,0,0,13],[1,0,0,14],[1,0,0,15],[1,0,0,16],[1,0,0,17],[2,0,0,19],[1,0,0,19],[1,0,0,19]],[[0,0,1,0],[0,0,1,0],[2,0,1,9],[6,0,1,2],[7,0,1,9],[1,0,1,10],[1,0,1,12],[1,0,1,13],[1,0,1,14],[1,0,1,15],[1,0,1,16],[9,0,1,25]],[[0,0,2,0],[0,0,2,0],[2,0,2,2],[6,0,2,8],[1,0,2,9],[7]]]
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Original content start in Svelte: line 2 (0-based offset: 1)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Normalizing Civet map. originalContentStartLine: 2, removedIndentLength: 0, filename: /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 1
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAU,MAAT,SAAS,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA,CAAC;AACpB,EAAS,MAAP,OAAO,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,SAAS,CAAC;AAC1B,EAAE,MAAM,CAAC,OAAO
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAU,MAAT,SAAS,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA,CAAC;AACpB,EAAS,MAAP,OAAO,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,SAAS,CAAC;AAC1B,EAAE,MAAM,CAAC,OAAO
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/0returnCase.svelte] Reindented compiled TS code for insertion (indent: ""):

	const funcIssue = () => {
		const number1 = 1; // line 2
		return number1
	}

	const funcGreat = () => {
		const number2 = 1; // line 6
		return number2;
	}

	const varIssue = () => {
		let number3 = va;return number3
	} 

	const varGreat = () => {
		let number4 = z;return number4
	} 


--- Preprocessed TypeScript Code ---
 <script lang="ts">
	const funcIssue = () => {
		const number1 = 1; // line 2
		return number1
	}

	const funcGreat = () => {
		const number2 = 1; // line 6
		return number2;
	}

	const varIssue = () => {
		let number3 = va;return number3
	} 

	const varGreat = () => {
		let number4 = z;return number4
	} 
</script>
<div>{funcGreat()}</div> 
Original Svelte Content:
 <script lang="civet">
	funcIssue := () =>
		number1 := 1; // line 2
		return number1

	funcGreat := () =>
		number2 := 1; // line 6
		return number2;

	varIssue := () =>
		number3 .= va 

	varGreat := () =>
		number4 .= z 

</script>
<div>{funcGreat()}</div> 
Compiled TS Code (from preprocessor):
 	const funcIssue = () => {
		const number1 = 1; // line 2
		return number1
	}

	const funcGreat = () => {
		const number2 = 1; // line 6
		return number2;
	}

	const varIssue = () => {
		let number3 = va;return number3
	} 

	const varGreat = () => {
		let number4 = z;return number4
	} 

Info from CivetBlockInfo:
  originalContentStartLine_1based: 2
  originalCivetLineCount: 16
  compiledTsLineCount: 19
Raw Civet-to-TS map lines:
  line 1 : [0,0,0,0][1,0,0,10][6,0,0,1][9,0,0,10][1,0,0,11][1,0,0,13][1,0,0,14][1,0,0,15][1,0,0,16][1,0,0,17][2,0,0,19][1,0,0,19][1,0,0,19][1]
  line 2 : [0,0,1,0][0,0,1,0][2,0,1,9][6,0,1,2][7,0,1,9][1,0,1,10][1,0,1,12][1,0,1,13][1,0,1,14][1,0,1,15][1,0,1,16][9,0,1,25][1]
  line 3 : [0,0,2,0][0,0,2,0][2,0,2,2][6,0,2,8][1,0,2,9][7][1]
  line 4 : [1,0,2,16][1,0,2,16][1]
  line 5 : [0,0,3,0][0,0,3,0][1]
  line 6 : [0,0,4,0][0,0,4,0][1,0,4,10][6,0,4,1][9,0,4,10][1,0,4,11][1,0,4,13][1,0,4,14][1,0,4,15][1,0,4,16][1,0,4,17][2,0,4,19][1,0,4,19][1,0,4,19][1]
  line 7 : [0,0,5,0][0,0,5,0][2,0,5,9][6,0,5,2][7,0,5,9][1,0,5,10][1,0,5,12][1,0,5,13][1,0,5,14][1,0,5,15][1,0,5,16][9,0,5,25][1]
  line 8 : [0,0,6,0][0,0,6,0][2,0,6,2][6,0,6,8][1,0,6,9][7,0,6,16][1][1]
  line 9 : [1,0,6,17][1,0,6,17][1]
  line 10 : [0,0,7,0][0,0,7,0][1]
  line 11 : [0,0,8,0][0,0,8,0][1,0,8,9][6,0,8,1][8,0,8,9][1,0,8,10][1,0,8,12][1,0,8,13][1,0,8,14][1,0,8,15][1,0,8,16][2,0,8,18][1,0,8,18][1,0,8,18][1]
  line 12 : [0,0,9,0][0,0,9,0][2,0,9,9][4,0,9,2][7,0,9,9][1,0,9,10][1,0,9,12][1,0,9,13][2][1][6][1,0,9,2][7][1]
  line 13 : [1,0,9,15][1,0,9,15][1,0,9,16][1]
  line 14 : [0,0,10,0][0,0,10,0][1]
  line 15 : [0,0,11,0][0,0,11,0][1,0,11,9][6,0,11,1][8,0,11,9][1,0,11,10][1,0,11,12][1,0,11,13][1,0,11,14][1,0,11,15][1,0,11,16][2,0,11,18][1,0,11,18][1,0,11,18][1]
  line 16 : [0,0,12,0][0,0,12,0][2,0,12,9][4,0,12,2][7,0,12,9][1,0,12,10][1,0,12,12][1,0,12,13][1][1][6][1,0,12,2][7][1]
  line 17 : [1,0,12,14][1,0,12,14][1]
  line 18 : [0,0,13,0][1]
  line 19 : [0,0,14,0][1]
Normalized V3 map from Preprocessor:
  Line 1: AACA,CAAU,MAAT,SAAS,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA,CAAC
  Line 2: AACpB,EAAS,MAAP,OAAO,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,SAAS,CAAC
  Line 3: AAC1B,EAAE,MAAM,CAAC,OAAO
  Line 4: CAAA,CAAA,CAAC
  Line 5: AACjB,CAAC
  Line 6: AACD,CAAU,MAAT,SAAS,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA,CAAC
  Line 7: AACpB,EAAS,MAAP,OAAO,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,SAAS,CAAC
  Line 8: AAC1B,EAAE,MAAM,CAAC,OAAO,CAAC
  Line 9: CAAA,CAAA,CAAC
  Line 10: AAClB,CAAC
  Line 11: AACD,CAAS,MAAR,QAAQ,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA,CAAC
  Line 12: AACnB,EAAS,IAAP,OAAO,CAAC,CAAE,CAAC,EAAE,QAAb,OAAO
  Line 13: CAAM,CAAA,CAAC,CAAC
  Line 14: AACjB,CAAC
  Line 15: AACD,CAAS,MAAR,QAAQ,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,EAAE,CAAA,CAAA,CAAC
  Line 16: AACnB,EAAS,IAAP,OAAO,CAAC,CAAE,CAAC,CAAC,QAAZ,OAAO
  Line 17: CAAK,CAAA,CAAC
  Line 18: AACf,CAAC
  Line 19: AACD,CAAC
Decoded V3 mapping segments:
  TS Line 1: [0,0,1,0] [1,0,1,10] [7,0,1,1] [16,0,1,10] [17,0,1,11] [18,0,1,13] [19,0,1,14] [20,0,1,15] [21,0,1,16] [22,0,1,17] [24,0,1,19] [25,0,1,19] [26,0,1,19] [27,0,1,20]
  TS Line 2: [0,0,2,0] [2,0,2,9] [8,0,2,2] [15,0,2,9] [16,0,2,10] [17,0,2,12] [18,0,2,13] [19,0,2,14] [20,0,2,15] [21,0,2,16] [30,0,2,25] [31,0,2,26]
  TS Line 3: [0,0,3,0] [2,0,3,2] [8,0,3,8] [9,0,3,9] [16,0,3,16]
  TS Line 4: [1,0,3,16] [2,0,3,16] [3,0,3,17]
  TS Line 5: [0,0,4,0] [1,0,4,1]
  TS Line 6: [0,0,5,0] [1,0,5,10] [7,0,5,1] [16,0,5,10] [17,0,5,11] [18,0,5,13] [19,0,5,14] [20,0,5,15] [21,0,5,16] [22,0,5,17] [24,0,5,19] [25,0,5,19] [26,0,5,19] [27,0,5,20]
  TS Line 7: [0,0,6,0] [2,0,6,9] [8,0,6,2] [15,0,6,9] [16,0,6,10] [17,0,6,12] [18,0,6,13] [19,0,6,14] [20,0,6,15] [21,0,6,16] [30,0,6,25] [31,0,6,26]
  TS Line 8: [0,0,7,0] [2,0,7,2] [8,0,7,8] [9,0,7,9] [16,0,7,16] [17,0,7,17]
  TS Line 9: [1,0,7,17] [2,0,7,17] [3,0,7,18]
  TS Line 10: [0,0,8,0] [1,0,8,1]
  TS Line 11: [0,0,9,0] [1,0,9,9] [7,0,9,1] [15,0,9,9] [16,0,9,10] [17,0,9,12] [18,0,9,13] [19,0,9,14] [20,0,9,15] [21,0,9,16] [23,0,9,18] [24,0,9,18] [25,0,9,18] [26,0,9,19]
  TS Line 12: [0,0,10,0] [2,0,10,9] [6,0,10,2] [13,0,10,9] [14,0,10,10] [15,0,10,12] [16,0,10,13] [18,0,10,15] [26,0,10,2] [33,0,10,9]
  TS Line 13: [1,0,10,15] [2,0,10,15] [3,0,10,16] [4,0,10,17]
  TS Line 14: [0,0,11,0] [1,0,11,1]
  TS Line 15: [0,0,12,0] [1,0,12,9] [7,0,12,1] [15,0,12,9] [16,0,12,10] [17,0,12,12] [18,0,12,13] [19,0,12,14] [20,0,12,15] [21,0,12,16] [23,0,12,18] [24,0,12,18] [25,0,12,18] [26,0,12,19]
  TS Line 16: [0,0,13,0] [2,0,13,9] [6,0,13,2] [13,0,13,9] [14,0,13,10] [15,0,13,12] [16,0,13,13] [17,0,13,14] [25,0,13,2] [32,0,13,9]
  TS Line 17: [1,0,13,14] [2,0,13,14] [3,0,13,15]
  TS Line 18: [0,0,14,0] [1,0,14,1]
  TS Line 19: [0,0,15,0] [1,0,15,1]
  Asserted token 'funcIssue_decl' ('funcIssue'): TS(1:7) -> Original(2:1) - OK
  Asserted token 'number1_decl_issue' ('number1'): TS(2:8) -> Original(3:2) - OK
  Asserted token 'number1_return_issue' ('number1'): TS(3:9) -> Original(4:9) - OK
  Asserted token 'funcGreat_decl' ('funcGreat'): TS(6:7) -> Original(6:1) - OK
  Asserted token 'number2_decl_great' ('number2'): TS(7:8) -> Original(7:2) - OK
  Asserted token 'number2_return_great' ('number2'): TS(8:9) -> Original(8:9) - OK
  Asserted token 'varIssue_decl' ('varIssue'): TS(11:7) -> Original(10:1) - OK
  Asserted token 'number3_decl_varIssue' ('number3'): TS(12:6) -> Original(11:2) - OK
  Asserted token 'varGreat_decl' ('varGreat'): TS(15:7) -> Original(13:1) - OK
  Asserted token 'number4_decl_varGreat' ('number4'): TS(16:6) -> Original(14:2) - OK
    ✔ should correctly map tokens for Testing sourcemap accuracy for return statements with and without trailing semicolon in Civet and variable assignments. (334ms)


  1 passing (347ms)

