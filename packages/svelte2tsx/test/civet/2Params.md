
> svelte2tsx@0.7.35 test-current /home/user/Documents/repos/ltools-backup/packages/svelte2tsx
> mocha test/test.ts --grep "#current"



  2.1 - Preprocessor loop mapping differences #current

--- Scenario: Mapping for function parameters with and without subsequent declarations (2Parameters.svelte) ---
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Initializing for /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Found <script lang="civet"> (instance) at content start 21, end 201
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Original snippet from Svelte (21-201):

	great .= $state(1)
	value .= $state(1)
	propsProbl := (ab: number, bc: number) =>
		value = ab * bc
	 
	propsGreat := (de: number, ef: number) =>
		great = de * ef
		ghk := 123 

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Dedent Info: removedIndentString="" (length: 0)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Dedented snippet (removed 0 chars of indent):
	great .= $state(1)
	value .= $state(1)
	propsProbl := (ab: number, bc: number) =>
		value = ab * bc
	 
	propsGreat := (de: number, ef: number) =>
		great = de * ef
		ghk := 123 

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Civet compiled to TS:
	let great = $state(1)
	let value = $state(1)
	const propsProbl = (ab: number, bc: number) => {
		return value = ab * bc
	}
	 
	const propsGreat = (de: number, ef: number) => {
		great = de * ef
		const ghk = 123;return ghk
	} 

[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Raw Civet-to-TS map (first 3 lines of mappings): [[[0,0,0,0],[1,0,0,6],[4,0,0,1],[5,0,0,6],[1,0,0,7],[1,0,0,9],[1,0,0,10],[6,0,0,16],[1,0,0,17],[1,0,0,18],[1,0,0,19]],[[0,0,1,0],[0,0,1,0],[1,0,1,6],[4,0,1,1],[5,0,1,6],[1,0,1,7],[1,0,1,9],[1,0,1,10],[6,0,1,16],[1,0,1,17],[1,0,1,18],[1,0,1,19]],[[0,0,2,0],[0,0,2,0],[1,0,2,11],[6,0,2,1],[10,0,2,11],[1,0,2,12],[1,0,2,14],[1,0,2,15],[1,0,2,16],[2,0,2,18],[1,0,2,19],[1,0,2,20],[6,0,2,26],[1,0,2,27],[1,0,2,28],[2,0,2,30],[1,0,2,31],[1,0,2,32],[6,0,2,38],[1,0,2,39],[1,0,2,40],[2,0,2,42],[1,0,2,42],[1,0,2,42]]]
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Original content start in Svelte: line 2 (0-based offset: 1)
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Normalizing Civet map. originalContentStartLine: 2, removedIndentLength: 0, filename: /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Normalizing Civet map. Snippet line offset in Svelte (0-based): 1
[MAP_TO_V3 /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Final Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAM,IAAL,KAAK,CAAC,CAAE,CAAC,MAAM,CAAC,CAAC,CAAC;AACnB,CAAM,IAAL,KAAK,CAAC,CAAE,CAAC,MAAM,CAAC,CAAC,CAAC;AACnB,CAAW,MAAV,UAAU,CAAC,CAAE,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAA,CAAA
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Normalized Civet-Svelte map (first 3 lines of mappings): AACA,CAAM,IAAL,KAAK,CAAC,CAAE,CAAC,MAAM,CAAC,CAAC,CAAC;AACnB,CAAM,IAAL,KAAK,CAAC,CAAE,CAAC,MAAM,CAAC,CAAC,CAAC;AACnB,CAAW,MAAV,UAAU,CAAC,CAAE,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAA,CAAA
[PREPROC_CIVET /home/user/Documents/repos/ltools-backup/packages/svelte2tsx/test/civet/fixtures/2Parameters.svelte] Reindented compiled TS code for insertion (indent: ""):

	let great = $state(1)
	let value = $state(1)
	const propsProbl = (ab: number, bc: number) => {
		return value = ab * bc
	}
	 
	const propsGreat = (de: number, ef: number) => {
		great = de * ef
		const ghk = 123;return ghk
	} 

Original Svelte Content:
 <script lang="civet">
	great .= $state(1)
	value .= $state(1)
	propsProbl := (ab: number, bc: number) =>
		value = ab * bc
	 
	propsGreat := (de: number, ef: number) =>
		great = de * ef
		ghk := 123 
</script>
<div>{fruits}</div> 
Compiled TS Code (from preprocessor):
 	let great = $state(1)
	let value = $state(1)
	const propsProbl = (ab: number, bc: number) => {
		return value = ab * bc
	}
	 
	const propsGreat = (de: number, ef: number) => {
		great = de * ef
		const ghk = 123;return ghk
	} 

Info from CivetBlockInfo:
  originalContentStartLine_1based: 2
  originalCivetLineCount: 10
  compiledTsLineCount: 12
Raw Civet-to-TS map lines:
  line 1 : [0,0,0,0][1,0,0,6][4,0,0,1][5,0,0,6][1,0,0,7][1,0,0,9][1,0,0,10][6,0,0,16][1,0,0,17][1,0,0,18][1,0,0,19]
  line 2 : [0,0,1,0][0,0,1,0][1,0,1,6][4,0,1,1][5,0,1,6][1,0,1,7][1,0,1,9][1,0,1,10][6,0,1,16][1,0,1,17][1,0,1,18][1,0,1,19]
  line 3 : [0,0,2,0][0,0,2,0][1,0,2,11][6,0,2,1][10,0,2,11][1,0,2,12][1,0,2,14][1,0,2,15][1,0,2,16][2,0,2,18][1,0,2,19][1,0,2,20][6,0,2,26][1,0,2,27][1,0,2,28][2,0,2,30][1,0,2,31][1,0,2,32][6,0,2,38][1,0,2,39][1,0,2,40][2,0,2,42][1,0,2,42][1,0,2,42]
  line 4 : [0,0,3,0][0,0,3,0][2][7,0,3,2][5,0,3,7][1][1,0,3,9][1,0,3,10][2,0,3,12][1,0,3,13][1,0,3,14][1,0,3,15][2]
  line 5 : [1,0,3,17][1,0,3,17]
  line 6 : [0,0,4,0][0,0,4,0][2,0,4,2]
  line 7 : [0,0,5,0][0,0,5,0][1,0,5,11][6,0,5,1][10,0,5,11][1,0,5,12][1,0,5,14][1,0,5,15][1,0,5,16][2,0,5,18][1,0,5,19][1,0,5,20][6,0,5,26][1,0,5,27][1,0,5,28][2,0,5,30][1,0,5,31][1,0,5,32][6,0,5,38][1,0,5,39][1,0,5,40][2,0,5,42][1,0,5,42][1,0,5,42]
  line 8 : [0,0,6,0][0,0,6,0][2,0,6,2][5,0,6,7][1][1,0,6,9][1,0,6,10][2,0,6,12][1,0,6,13][1,0,6,14][1,0,6,15][2,0,6,17]
  line 9 : [0,0,7,0][0,0,7,0][2,0,7,5][6,0,7,2][3,0,7,5][1,0,7,6][1,0,7,8][1,0,7,9][3][1][6][1,0,7,2][3]
  line 10 : [1,0,7,12][1,0,7,12]
  line 11 : [0,0,8,0]
Normalized V3 map from Preprocessor:
  Line 1: AACA,CAAM,IAAL,KAAK,CAAC,CAAE,CAAC,MAAM,CAAC,CAAC,CAAC
  Line 2: AACnB,CAAM,IAAL,KAAK,CAAC,CAAE,CAAC,MAAM,CAAC,CAAC,CAAC
  Line 3: AACnB,CAAW,MAAV,UAAU,CAAC,CAAE,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAA,CAAA
  Line 4: AAC1C,SAAE,KAAK,EAAE,CAAC,EAAE,CAAC,CAAC,CAAC
  Line 5: CAAE,CAAA
  Line 6: AACjB,EAAE
  Line 7: AACF,CAAW,MAAV,UAAU,CAAC,CAAE,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAC,CAAC,MAAM,CAAC,CAAC,EAAE,CAAA,CAAA
  Line 8: AAC1C,EAAE,KAAK,EAAE,CAAC,EAAE,CAAC,CAAC,CAAC,EAAE
  Line 9: AACjB,EAAK,MAAH,GAAG,CAAC,CAAE,CAAC,WAAP
  Line 10: CAAU,CAAA
  Line 11: AACZ
Decoded V3 mapping segments:
  TS Line 1: [0,0,1,0] [1,0,1,6] [5,0,1,1] [10,0,1,6] [11,0,1,7] [12,0,1,9] [13,0,1,10] [19,0,1,16] [20,0,1,17] [21,0,1,18] [22,0,1,19]
  TS Line 2: [0,0,2,0] [1,0,2,6] [5,0,2,1] [10,0,2,6] [11,0,2,7] [12,0,2,9] [13,0,2,10] [19,0,2,16] [20,0,2,17] [21,0,2,18] [22,0,2,19]
  TS Line 3: [0,0,3,0] [1,0,3,11] [7,0,3,1] [17,0,3,11] [18,0,3,12] [19,0,3,14] [20,0,3,15] [21,0,3,16] [23,0,3,18] [24,0,3,19] [25,0,3,20] [31,0,3,26] [32,0,3,27] [33,0,3,28] [35,0,3,30] [36,0,3,31] [37,0,3,32] [43,0,3,38] [44,0,3,39] [45,0,3,40] [47,0,3,42] [48,0,3,42] [49,0,3,42]
  TS Line 4: [0,0,4,0] [9,0,4,2] [14,0,4,7] [16,0,4,9] [17,0,4,10] [19,0,4,12] [20,0,4,13] [21,0,4,14] [22,0,4,15]
  TS Line 5: [1,0,4,17] [2,0,4,17]
  TS Line 6: [0,0,5,0] [2,0,5,2]
  TS Line 7: [0,0,6,0] [1,0,6,11] [7,0,6,1] [17,0,6,11] [18,0,6,12] [19,0,6,14] [20,0,6,15] [21,0,6,16] [23,0,6,18] [24,0,6,19] [25,0,6,20] [31,0,6,26] [32,0,6,27] [33,0,6,28] [35,0,6,30] [36,0,6,31] [37,0,6,32] [43,0,6,38] [44,0,6,39] [45,0,6,40] [47,0,6,42] [48,0,6,42] [49,0,6,42]
  TS Line 8: [0,0,7,0] [2,0,7,2] [7,0,7,7] [9,0,7,9] [10,0,7,10] [12,0,7,12] [13,0,7,13] [14,0,7,14] [15,0,7,15] [17,0,7,17]
  TS Line 9: [0,0,8,0] [2,0,8,5] [8,0,8,2] [11,0,8,5] [12,0,8,6] [13,0,8,8] [14,0,8,9] [25,0,8,2]
  TS Line 10: [1,0,8,12] [2,0,8,12]
  TS Line 11: [0,0,9,0]
  Asserted token 'propsProbl_ab_param' ('ab'): TS(3:21) -> Original(4:16) - OK
  Asserted token 'propsProbl_bc_param' ('bc'): TS(3:33) -> Original(4:28) - OK
  Asserted token 'propsGreat_de_param' ('de'): TS(7:21) -> Original(7:16) - OK
  Asserted token 'propsGreat_ef_param' ('ef'): TS(7:33) -> Original(7:28) - OK
  Asserted token 'propsGreat_ghk_decl' ('ghk'): TS(9:8) -> Original(9:2) - OK
  Asserted token 'propsProbl_ab_usage' ('ab'): TS(4:17) -> Original(5:10) - OK
  Asserted token 'propsProbl_bc_usage' ('bc'): TS(4:22) -> Original(5:15) - OK
  Asserted token 'propsGreat_de_usage' ('de'): TS(8:10) -> Original(8:10) - OK
  Asserted token 'propsGreat_ef_usage' ('ef'): TS(8:15) -> Original(8:15) - OK
    ✔ should correctly map tokens for Mapping for function parameters with and without subsequent declarations (129ms)


  1 passing (134ms)