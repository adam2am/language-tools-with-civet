### 6 - userReportedHover# LOGS : 



> svelte2tsx@0.7.35 test C:\Users\user\Documents\GitHub\language-tools-with-civet\packages\svelte2tsx
> mocha test/test.ts "--grep" "#current"

[civetPreprocessor.ts] Civet snippet after trimming leading blank lines:
	function funcForTest(name: string): string 
		console.log "hello, world"

[preprocessCivet] Detected <script lang="civet"> (instance) at offsets 21-96
[preprocessCivet] Original snippet content:

	function funcForTest(name: string): string 
		console.log "hello, world"

[civetPreprocessor.ts] Civet snippet after dedent (removed indent: "	"):
function funcForTest(name: string): string 
	console.log "hello, world"

[preprocessCivet] Dedented snippet content:
function funcForTest(name: string): string 
	console.log "hello, world"

[civetPreprocessor.ts] Compiled TS code from Civet:
function funcForTest(name: string): string { 
	return console.log("hello, world")
}

[preprocessCivet] compileCivet output code length: 84, rawMap lines count: 4
[civetPreprocessor.ts] Raw Civet Map (rawMap.lines[0]) for first line of dedented snippet ("function funcForTest(name: string): string ") segments:
  Segment 0: genCol=0, srcFileIndex=0, srcLine_0based=0, srcCol_0based=0
  Segment 1: genCol=8, srcFileIndex=0, srcLine_0based=0, srcCol_0based=8
  Segment 2: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=9
  Segment 3: genCol=11, srcFileIndex=0, srcLine_0based=0, srcCol_0based=20
  Segment 4: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=21
  Segment 5: genCol=4, srcFileIndex=0, srcLine_0based=0, srcCol_0based=25
  Segment 6: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=26
  Segment 7: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=27
  Segment 8: genCol=6, srcFileIndex=0, srcLine_0based=0, srcCol_0based=33
  Segment 9: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=34
  Segment 10: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=35
  Segment 11: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=36
  Segment 12: genCol=6, srcFileIndex=0, srcLine_0based=0, srcCol_0based=42
  Segment 13: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=42
  Segment 14: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=42
  Segment 15: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=43
[preprocessCivet] Civet snippet offsets 21-96 -> Svelte line 2
[preprocessCivet] originalContentStartLine_1based: 2, snippet offset (0-based): 1
[civetPreprocessor.ts] Inputs to normalizeCivetMap:
  originalCivetSnippetLineOffset_0based: 1
  svelteFilePath: IntegrationAccuracy.svelte
  removedCivetContentIndentLength: 1
[civetPreprocessor.ts] normalized map first semicolon segment: AACC,QAAQ,CAAC,WAAW,CAAC,IAAI,CAAC,CAAC,MAAM,CAAC,CAAC,CAAC,MAAM,CAAA,CAAA,CAAC
[preprocessCivet] normalizeCivetMap returned map mappings length: 4
[chainMaps] Starting refactored chaining.
[chainMaps] BaseMap sources: [ 'IntegrationAccuracy.svelte' ]
[chainMaps] Number of blocks: 1
[chainMaps] Block 0: originalLines=4, compiledLines=4, tsStartChar=21, tsEndChar=105, tsStartLine=1
[chainMaps] Decoded baseMap segments (first 5 lines): [[],[[0,0,0,0],[1,0,0,1]],[[0,0,0,18],[1,0,0,19],[2,0,0,20],[3,0,0,21],[4,0,0,22],[5,0,0,23],[6,0,0,24],[7,0,0,25],[8,0,0,26],[9,0,0,27],[10,0,0,28],[11,0,0,29],[12,0,0,30],[13,0,0,31],[14,0,0,32],[15,0,0,33],[16,0,0,34],[17,0,0,35],[18,0,0,36],[19,0,0,37],[20,0,0,38],[21,0,0,39],[22,0,0,40],[23,0,0,41],[24,0,0,42],[25,0,0,43],[26,0,0,44],[27,0,0,45],[28,0,0,46],[29,0,0,47],[30,0,0,48],[31,0,0,49],[32,0,0,50],[33,0,0,51],[34,0,0,52],[35,0,0,53],[36,0,0,54],[37,0,0,55],[38,0,0,56],[39,0,0,57],[40,0,0,58],[41,0,0,59],[42,0,0,60],[43,0,0,61],[44,0,0,62],[45,0,0,63]],[[0,0,1,0],[1,0,1,1],[2,0,1,2],[3,0,1,3],[4,0,1,4],[5,0,1,5],[6,0,1,6],[7,0,1,7],[8,0,1,8],[9,0,1,9],[10,0,1,10],[11,0,1,11],[12,0,1,12],[13,0,1,13],[14,0,1,14],[15,0,1,15],[16,0,1,16],[17,0,1,17],[18,0,1,18],[19,0,1,19],[20,0,1,20],[21,0,1,21],[22,0,1,22],[23,0,1,23],[24,0,1,24],[25,0,1,25],[26,0,1,26],[27,0,1,27],[28,0,1,28],[29,0,1,29],[30,0,1,30],[31,0,1,31],[32,0,1,32],[33,0,1,33],[34,0,1,34],[35,0,1,35]],[[0,0,2,0],[1,0,2,1]]]
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[8,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[20,0,1,21], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[21,0,1,22], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[21,0,1,22], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[21,0,1,22], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[21,0,1,22], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[25,0,1,26], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[26,0,1,27], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[27,0,1,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[27,0,1,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[27,0,1,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[27,0,1,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[27,0,1,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[27,0,1,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[33,0,1,34], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[34,0,1,35], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[35,0,1,36], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[36,0,1,37], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[36,0,1,37], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[36,0,1,37], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[36,0,1,37], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[36,0,1,37], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[36,0,1,37], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[42,0,1,43], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[14,0,2,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,2,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,2,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,2,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[18,0,2,13], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,13], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[33,0,2,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[33,0,2,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[33,0,2,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,2,28], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,3,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,3,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] Remapped segments (first 5 lines): [[],[[0,0,0,0,null],[1,0,0,1,null]],[[0,0,0,18,null],[1,0,0,19,null],[2,0,0,20,null],[3,0,1,1,null],[4,0,1,1,null],[5,0,1,1,null],[6,0,1,1,null],[7,0,1,1,null],[8,0,1,1,null],[9,0,1,1,null],[10,0,1,1,null],[11,0,1,9,null],[12,0,1,10,null],[13,0,1,10,null],[14,0,1,10,null],[15,0,1,10,null],[16,0,1,10,null],[17,0,1,10,null],[18,0,1,10,null],[19,0,1,10,null],[20,0,1,10,null],[21,0,1,10,null],[22,0,1,10,null],[23,0,1,21,null],[24,0,1,22,null],[25,0,1,22,null],[26,0,1,22,null],[27,0,1,22,null],[28,0,1,26,null],[29,0,1,27,null],[30,0,1,28,null],[31,0,1,28,null],[32,0,1,28,null],[33,0,1,28,null],[34,0,1,28,null],[35,0,1,28,null],[36,0,1,34,null],[37,0,1,35,null],[38,0,1,36,null],[39,0,1,37,null],[40,0,1,37,null],[41,0,1,37,null],[42,0,1,37,null],[43,0,1,37,null],[44,0,1,37,null],[45,0,1,43,null]],[[0,0,2,1,null],[1,0,2,1,null],[2,0,2,1,null],[3,0,2,1,null],[4,0,2,1,null],[5,0,2,1,null],[6,0,2,1,null],[7,0,2,2,null],[8,0,2,2,null],[9,0,2,2,null],[10,0,2,2,null],[11,0,2,2,null],[12,0,2,2,null],[13,0,2,2,null],[14,0,2,9,null],[15,0,2,10,null],[16,0,2,10,null],[17,0,2,10,null],[18,0,2,13,null],[19,0,2,13,null],[20,0,2,14,null],[21,0,2,14,null],[22,0,2,14,null],[23,0,2,14,null],[24,0,2,14,null],[25,0,2,14,null],[26,0,2,14,null],[27,0,2,14,null],[28,0,2,14,null],[29,0,2,14,null],[30,0,2,14,null],[31,0,2,14,null],[32,0,2,14,null],[33,0,2,28,null],[34,0,2,28,null],[35,0,2,28,null]],[[0,0,2,28,null],[1,0,2,28,null]]]
[chainMaps] Remapped summary (first 5 lines):
  Line 1: []
  Line 2: [[0,0,0,0,null],[1,0,0,1,null]]
  Line 3: [[0,0,0,18,null],[1,0,0,19,null],[2,0,0,20,null],[3,0,1,1,null],[4,0,1,1,null],[5,0,1,1,null],[6,0,1,1,null],[7,0,1,1,null],[8,0,1,1,null],[9,0,1,1,null],[10,0,1,1,null],[11,0,1,9,null],[12,0,1,10,null],[13,0,1,10,null],[14,0,1,10,null],[15,0,1,10,null],[16,0,1,10,null],[17,0,1,10,null],[18,0,1,10,null],[19,0,1,10,null],[20,0,1,10,null],[21,0,1,10,null],[22,0,1,10,null],[23,0,1,21,null],[24,0,1,22,null],[25,0,1,22,null],[26,0,1,22,null],[27,0,1,22,null],[28,0,1,26,null],[29,0,1,27,null],[30,0,1,28,null],[31,0,1,28,null],[32,0,1,28,null],[33,0,1,28,null],[34,0,1,28,null],[35,0,1,28,null],[36,0,1,34,null],[37,0,1,35,null],[38,0,1,36,null],[39,0,1,37,null],[40,0,1,37,null],[41,0,1,37,null],[42,0,1,37,null],[43,0,1,37,null],[44,0,1,37,null],[45,0,1,43,null]]
  Line 4: [[0,0,2,1,null],[1,0,2,1,null],[2,0,2,1,null],[3,0,2,1,null],[4,0,2,1,null],[5,0,2,1,null],[6,0,2,1,null],[7,0,2,2,null],[8,0,2,2,null],[9,0,2,2,null],[10,0,2,2,null],[11,0,2,2,null],[12,0,2,2,null],[13,0,2,2,null],[14,0,2,9,null],[15,0,2,10,null],[16,0,2,10,null],[17,0,2,10,null],[18,0,2,13,null],[19,0,2,13,null],[20,0,2,14,null],[21,0,2,14,null],[22,0,2,14,null],[23,0,2,14,null],[24,0,2,14,null],[25,0,2,14,null],[26,0,2,14,null],[27,0,2,14,null],[28,0,2,14,null],[29,0,2,14,null],[30,0,2,14,null],[31,0,2,14,null],[32,0,2,14,null],[33,0,2,28,null],[34,0,2,28,null],[35,0,2,28,null]]
  Line 5: [[0,0,2,28,null],[1,0,2,28,null]]
[chainMaps] Final encoded mappings: ;AAAAA,CAACA;AAAiBA,CAACA,CAACA,CACnBA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAQA,CAACA,CAAAA,C...
[chainMaps] Final decoded mappings (first 3 lines): [
  [],
  [
    [
      0,
      0,
      0,
      0,
      0
    ],
    [
      1,
      0,
      0,
      1,
      0
    ]
  ],
  [
    [
      0,
      0,
      0,
      18,
      0
    ],
    [
      1,
      0,
      0,
      19,
      0
    ],
    [
      2,
      0,
      0,
      20,
      0
    ],
    [
      3,
      0,
      1,
      1,
      0
    ],
    [
      4,
      0,
      1,
      1,
      0
    ],
    [
      5,
      0,
      1,
      1,
      0
    ],
    [
      6,
      0,
      1,
      1,
      0
    ],
    [
      7,
      0,
      1,
      1,
      0
    ],
    [
      8,
      0,
      1,
      1,
      0
    ],
    [
      9,
      0,
      1,
      1,
      0
    ],
    [
      10,
      0,
      1,
      1,
      0
    ],
    [
      11,
      0,
      1,
      9,
      0
    ],
    [
      12,
      0,
      1,
      10,
      0
    ],
    [
      13,
      0,
      1,
      10,
      0
    ],
    [
      14,
      0,
      1,
      10,
      0
    ],
    [
      15,
      0,
      1,
      10,
      0
    ],
    [
      16,
      0,
      1,
      10,
      0
    ],
    [
      17,
      0,
      1,
      10,
      0
    ],
    [
      18,
      0,
      1,
      10,
      0
    ],
    [
      19,
      0,
      1,
      10,
      0
    ],
    [
      20,
      0,
      1,
      10,
      0
    ],
    [
      21,
      0,
      1,
      10,
      0
    ],
    [
      22,
      0,
      1,
      10,
      0
    ],
    [
      23,
      0,
      1,
      21,
      0
    ],
    [
      24,
      0,
      1,
      22,
      0
    ],
    [
      25,
      0,
      1,
      22,
      0
    ],
    [
      26,
      0,
      1,
      22,
      0
    ],
    [
      27,
      0,
      1,
      22,
      0
    ],
    [
      28,
      0,
      1,
      26,
      0
    ],
    [
      29,
      0,
      1,
      27,
      0
    ],
    [
      30,
      0,
      1,
      28,
      0
    ],
    [
      31,
      0,
      1,
      28,
      0
    ],
    [
      32,
      0,
      1,
      28,
      0
    ],
    [
      33,
      0,
      1,
      28,
      0
    ],
    [
      34,
      0,
      1,
      28,
      0
    ],
    [
      35,
      0,
      1,
      28,
      0
    ],
    [
      36,
      0,
      1,
      34,
      0
    ],
    [
      37,
      0,
      1,
      35,
      0
    ],
    [
      38,
      0,
      1,
      36,
      0
    ],
    [
      39,
      0,
      1,
      37,
      0
    ],
    [
      40,
      0,
      1,
      37,
      0
    ],
    [
      41,
      0,
      1,
      37,
      0
    ],
    [
      42,
      0,
      1,
      37,
      0
    ],
    [
      43,
      0,
      1,
      37,
      0
    ],
    [
      44,
      0,
      1,
      37,
      0
    ],
    [
      45,
      0,
      1,
      43,
      0
    ]
  ]
]
DEBUG [Step 0] rawSnippet: "\n    alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet\n"
DEBUG [Step 0] snippetTrimmed for stripCommonIndent: "    alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet\n"
DEBUG [Step 0] dedentedSnippet: "alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet\n"
DEBUG [Step 0] removedIndent length: 4
DEBUG [Step 1] compiledTs snippet: "const alpha = 1 // This is line 2 in Svelte, line 0 in original Civet snippet\n"
DEBUG [Step 1] rawMap lines: [
  [
    [
      0,
      0,
      0,
      5
    ],
    [
      6,
      0,
      0,
      0
    ],
    [
      5,
      0,
      0,
      5
    ],
    [
      1,
      0,
      0,
      6
    ],
    [
      1,
      0,
      0,
      8
    ],
    [
      1,
      0,
      0,
      9
    ],
    [
      1,
      0,
      0,
      10
    ],
    [
      1,
      0,
      0,
      11
    ],
    [
      61,
      0,
      0,
      72
    ]
  ],
  [
    [
      0,
      0,
      1,
      0
    ]
  ]
]
DEBUG [Step 1] rawMap.lines[0] for genLine 1: [
  [
    0,
    0,
    0,
    5
  ],
  [
    6,
    0,
    0,
    0
  ],
  [
    5,
    0,
    0,
    5
  ],
  [
    1,
    0,
    0,
    6
  ],
  [
    1,
    0,
    0,
    8
  ],
  [
    1,
    0,
    0,
    9
  ],
  [
    1,
    0,
    0,
    10
  ],
  [
    1,
    0,
    0,
    11
  ],
  [
    61,
    0,
    0,
    72
  ]
]
DEBUG [Step 2] normalized mappings: AACS,MAAL,KAAK,CAAC,CAAE,CAAC,CAAC,CAAC,6DAA6D;AACxE
DEBUG [Step 2] decoded normalized: [
  [
    [
      0,
      0,
      1,
      9
    ],
    [
      6,
      0,
      1,
      4
    ],
    [
      11,
      0,
      1,
      9
    ],
    [
      12,
      0,
      1,
      10
    ],
    [
      13,
      0,
      1,
      12
    ],
    [
      14,
      0,
      1,
      13
    ],
    [
      15,
      0,
      1,
      14
    ],
    [
      16,
      0,
      1,
      15
    ],
    [
      77,
      0,
      1,
      76
    ]
  ],
  [
    [
      0,
      0,
      2,
      4
    ]
  ]
]
DEBUG [Step 2] normPos: { source: 'LazerFocus.svelte', line: 2, column: 9, name: null }
[civetPreprocessor.ts] Civet snippet after trimming leading blank lines:
    alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet

[preprocessCivet] Detected <script lang="civet"> (instance) at offsets 21-99
[preprocessCivet] Original snippet content:

    alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet

[civetPreprocessor.ts] Civet snippet after dedent (removed indent: "    "):
alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet

[preprocessCivet] Dedented snippet content:
alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet

[civetPreprocessor.ts] Compiled TS code from Civet:
const alpha = 1 // This is line 2 in Svelte, line 0 in original Civet snippet

[preprocessCivet] compileCivet output code length: 78, rawMap lines count: 2
[civetPreprocessor.ts] Raw Civet Map (rawMap.lines[0]) for first line of dedented snippet ("alpha := 1 // This is line 2 in Svelte, line 0 in original Civet snippet") segments:
  Segment 0: genCol=0, srcFileIndex=0, srcLine_0based=0, srcCol_0based=5
  Segment 1: genCol=6, srcFileIndex=0, srcLine_0based=0, srcCol_0based=0
  Segment 2: genCol=5, srcFileIndex=0, srcLine_0based=0, srcCol_0based=5
  Segment 3: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=6
  Segment 4: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=8
  Segment 5: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=9
  Segment 6: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=10
  Segment 7: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=11
  Segment 8: genCol=61, srcFileIndex=0, srcLine_0based=0, srcCol_0based=72
[preprocessCivet] Civet snippet offsets 21-99 -> Svelte line 2
[preprocessCivet] originalContentStartLine_1based: 2, snippet offset (0-based): 1
[civetPreprocessor.ts] Inputs to normalizeCivetMap:
  originalCivetSnippetLineOffset_0based: 1
  svelteFilePath: LazerFocus.svelte
  removedCivetContentIndentLength: 4
[civetPreprocessor.ts] normalized map first semicolon segment: AACS,MAAL,KAAK,CAAC,CAAE,CAAC,CAAC,CAAC,6DAA6D
[preprocessCivet] normalizeCivetMap returned map mappings length: 2
[chainMaps] Starting refactored chaining.
[chainMaps] BaseMap sources: [ 'LazerFocus.svelte' ]
[chainMaps] Number of blocks: 1
[chainMaps] Block 0: originalLines=3, compiledLines=2, tsStartChar=21, tsEndChar=99, tsStartLine=1
[chainMaps] Decoded baseMap segments (first 5 lines): [[],[[0,0,0,0],[1,0,0,1]],[[0,0,0,18],[1,0,0,19],[2,0,0,20],[3,0,0,21],[4,0,0,22],[5,0,0,23],[6,0,0,24],[7,0,0,25],[8,0,0,26],[9,0,0,27],[10,0,0,28],[11,0,0,29],[12,0,0,30],[13,0,0,31],[14,0,0,32],[15,0,0,33],[16,0,0,34],[17,0,0,35],[18,0,0,36],[19,0,0,37],[20,0,0,38],[21,0,0,39],[22,0,0,40],[23,0,0,41],[24,0,0,42],[25,0,0,43],[26,0,0,44],[27,0,0,45],[28,0,0,46],[29,0,0,47],[30,0,0,48],[31,0,0,49],[32,0,0,50],[33,0,0,51],[34,0,0,52],[35,0,0,53],[36,0,0,54],[37,0,0,55],[38,0,0,56],[39,0,0,57],[40,0,0,58],[41,0,0,59],[42,0,0,60],[43,0,0,61],[44,0,0,62],[45,0,0,63],[46,0,0,64],[47,0,0,65],[48,0,0,66],[49,0,0,67],[50,0,0,68],[51,0,0,69],[52,0,0,70],[53,0,0,71],[54,0,0,72],[55,0,0,73],[56,0,0,74],[57,0,0,75],[58,0,0,76],[59,0,0,77],[60,0,0,78],[61,0,0,79],[62,0,0,80],[63,0,0,81],[64,0,0,82],[65,0,0,83],[66,0,0,84],[67,0,0,85],[68,0,0,86],[69,0,0,87],[70,0,0,88],[71,0,0,89],[72,0,0,90],[73,0,0,91],[74,0,0,92],[75,0,0,93],[76,0,0,94],[77,0,0,95]],[[0,0,1,0]],[[0,0,1,0],[13,0,1,9]]]
[chainMaps] traceSegment returned traced=[0,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[6,0,1,4], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[6,0,1,4], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[6,0,1,4], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[6,0,1,4], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[6,0,1,4], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[11,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[12,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[13,0,1,12], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[14,0,1,13], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,1,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[16,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,4], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,4], civetNameIndex=undefined, civetName=undefined
[chainMaps] Remapped segments (first 5 lines): [[],[[0,0,0,0,null],[1,0,0,1,null]],[[0,0,0,18,null],[1,0,0,19,null],[2,0,0,20,null],[3,0,1,9,null],[4,0,1,9,null],[5,0,1,9,null],[6,0,1,9,null],[7,0,1,9,null],[8,0,1,9,null],[9,0,1,4,null],[10,0,1,4,null],[11,0,1,4,null],[12,0,1,4,null],[13,0,1,4,null],[14,0,1,9,null],[15,0,1,10,null],[16,0,1,12,null],[17,0,1,13,null],[18,0,1,14,null],[19,0,1,15,null],[20,0,1,15,null],[21,0,1,15,null],[22,0,1,15,null],[23,0,1,15,null],[24,0,1,15,null],[25,0,1,15,null],[26,0,1,15,null],[27,0,1,15,null],[28,0,1,15,null],[29,0,1,15,null],[30,0,1,15,null],[31,0,1,15,null],[32,0,1,15,null],[33,0,1,15,null],[34,0,1,15,null],[35,0,1,15,null],[36,0,1,15,null],[37,0,1,15,null],[38,0,1,15,null],[39,0,1,15,null],[40,0,1,15,null],[41,0,1,15,null],[42,0,1,15,null],[43,0,1,15,null],[44,0,1,15,null],[45,0,1,15,null],[46,0,1,15,null],[47,0,1,15,null],[48,0,1,15,null],[49,0,1,15,null],[50,0,1,15,null],[51,0,1,15,null],[52,0,1,15,null],[53,0,1,15,null],[54,0,1,15,null],[55,0,1,15,null],[56,0,1,15,null],[57,0,1,15,null],[58,0,1,15,null],[59,0,1,15,null],[60,0,1,15,null],[61,0,1,15,null],[62,0,1,15,null],[63,0,1,15,null],[64,0,1,15,null],[65,0,1,15,null],[66,0,1,15,null],[67,0,1,15,null],[68,0,1,15,null],[69,0,1,15,null],[70,0,1,15,null],[71,0,1,15,null],[72,0,1,15,null],[73,0,1,15,null],[74,0,1,15,null],[75,0,1,15,null],[76,0,1,15,null],[77,0,1,15,null]],[[0,0,2,4,null]],[[0,0,2,4,null],[13,0,2,9,null]]]
[chainMaps] Remapped summary (first 5 lines):
  Line 1: []
  Line 2: [[0,0,0,0,null],[1,0,0,1,null]]
  Line 3: [[0,0,0,18,null],[1,0,0,19,null],[2,0,0,20,null],[3,0,1,9,null],[4,0,1,9,null],[5,0,1,9,null],[6,0,1,9,null],[7,0,1,9,null],[8,0,1,9,null],[9,0,1,4,null],[10,0,1,4,null],[11,0,1,4,null],[12,0,1,4,null],[13,0,1,4,null],[14,0,1,9,null],[15,0,1,10,null],[16,0,1,12,null],[17,0,1,13,null],[18,0,1,14,null],[19,0,1,15,null],[20,0,1,15,null],[21,0,1,15,null],[22,0,1,15,null],[23,0,1,15,null],[24,0,1,15,null],[25,0,1,15,null],[26,0,1,15,null],[27,0,1,15,null],[28,0,1,15,null],[29,0,1,15,null],[30,0,1,15,null],[31,0,1,15,null],[32,0,1,15,null],[33,0,1,15,null],[34,0,1,15,null],[35,0,1,15,null],[36,0,1,15,null],[37,0,1,15,null],[38,0,1,15,null],[39,0,1,15,null],[40,0,1,15,null],[41,0,1,15,null],[42,0,1,15,null],[43,0,1,15,null],[44,0,1,15,null],[45,0,1,15,null],[46,0,1,15,null],[47,0,1,15,null],[48,0,1,15,null],[49,0,1,15,null],[50,0,1,15,null],[51,0,1,15,null],[52,0,1,15,null],[53,0,1,15,null],[54,0,1,15,null],[55,0,1,15,null],[56,0,1,15,null],[57,0,1,15,null],[58,0,1,15,null],[59,0,1,15,null],[60,0,1,15,null],[61,0,1,15,null],[62,0,1,15,null],[63,0,1,15,null],[64,0,1,15,null],[65,0,1,15,null],[66,0,1,15,null],[67,0,1,15,null],[68,0,1,15,null],[69,0,1,15,null],[70,0,1,15,null],[71,0,1,15,null],[72,0,1,15,null],[73,0,1,15,null],[74,0,1,15,null],[75,0,1,15,null],[76,0,1,15,null],[77,0,1,15,null]]
  Line 4: [[0,0,2,4,null]]
  Line 5: [[0,0,2,4,null],[13,0,2,9,null]]
[chainMaps] Final encoded mappings: ;AAAAA,CAACA;AAAiBA,CAACA,CAACA,CACXA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAALA,CAAAA,CAAAA,CAAAA,CAAAA,CA...
[chainMaps] Final decoded mappings (first 3 lines): [
  [],
  [
    [
      0,
      0,
      0,
      0,
      0
    ],
    [
      1,
      0,
      0,
      1,
      0
    ]
  ],
  [
    [
      0,
      0,
      0,
      18,
      0
    ],
    [
      1,
      0,
      0,
      19,
      0
    ],
    [
      2,
      0,
      0,
      20,
      0
    ],
    [
      3,
      0,
      1,
      9,
      0
    ],
    [
      4,
      0,
      1,
      9,
      0
    ],
    [
      5,
      0,
      1,
      9,
      0
    ],
    [
      6,
      0,
      1,
      9,
      0
    ],
    [
      7,
      0,
      1,
      9,
      0
    ],
    [
      8,
      0,
      1,
      9,
      0
    ],
    [
      9,
      0,
      1,
      4,
      0
    ],
    [
      10,
      0,
      1,
      4,
      0
    ],
    [
      11,
      0,
      1,
      4,
      0
    ],
    [
      12,
      0,
      1,
      4,
      0
    ],
    [
      13,
      0,
      1,
      4,
      0
    ],
    [
      14,
      0,
      1,
      9,
      0
    ],
    [
      15,
      0,
      1,
      10,
      0
    ],
    [
      16,
      0,
      1,
      12,
      0
    ],
    [
      17,
      0,
      1,
      13,
      0
    ],
    [
      18,
      0,
      1,
      14,
      0
    ],
    [
      19,
      0,
      1,
      15,
      0
    ],
    [
      20,
      0,
      1,
      15,
      0
    ],
    [
      21,
      0,
      1,
      15,
      0
    ],
    [
      22,
      0,
      1,
      15,
      0
    ],
    [
      23,
      0,
      1,
      15,
      0
    ],
    [
      24,
      0,
      1,
      15,
      0
    ],
    [
      25,
      0,
      1,
      15,
      0
    ],
    [
      26,
      0,
      1,
      15,
      0
    ],
    [
      27,
      0,
      1,
      15,
      0
    ],
    [
      28,
      0,
      1,
      15,
      0
    ],
    [
      29,
      0,
      1,
      15,
      0
    ],
    [
      30,
      0,
      1,
      15,
      0
    ],
    [
      31,
      0,
      1,
      15,
      0
    ],
    [
      32,
      0,
      1,
      15,
      0
    ],
    [
      33,
      0,
      1,
      15,
      0
    ],
    [
      34,
      0,
      1,
      15,
      0
    ],
    [
      35,
      0,
      1,
      15,
      0
    ],
    [
      36,
      0,
      1,
      15,
      0
    ],
    [
      37,
      0,
      1,
      15,
      0
    ],
    [
      38,
      0,
      1,
      15,
      0
    ],
    [
      39,
      0,
      1,
      15,
      0
    ],
    [
      40,
      0,
      1,
      15,
      0
    ],
    [
      41,
      0,
      1,
      15,
      0
    ],
    [
      42,
      0,
      1,
      15,
      0
    ],
    [
      43,
      0,
      1,
      15,
      0
    ],
    [
      44,
      0,
      1,
      15,
      0
    ],
    [
      45,
      0,
      1,
      15,
      0
    ],
    [
      46,
      0,
      1,
      15,
      0
    ],
    [
      47,
      0,
      1,
      15,
      0
    ],
    [
      48,
      0,
      1,
      15,
      0
    ],
    [
      49,
      0,
      1,
      15,
      0
    ],
    [
      50,
      0,
      1,
      15,
      0
    ],
    [
      51,
      0,
      1,
      15,
      0
    ],
    [
      52,
      0,
      1,
      15,
      0
    ],
    [
      53,
      0,
      1,
      15,
      0
    ],
    [
      54,
      0,
      1,
      15,
      0
    ],
    [
      55,
      0,
      1,
      15,
      0
    ],
    [
      56,
      0,
      1,
      15,
      0
    ],
    [
      57,
      0,
      1,
      15,
      0
    ],
    [
      58,
      0,
      1,
      15,
      0
    ],
    [
      59,
      0,
      1,
      15,
      0
    ],
    [
      60,
      0,
      1,
      15,
      0
    ],
    [
      61,
      0,
      1,
      15,
      0
    ],
    [
      62,
      0,
      1,
      15,
      0
    ],
    [
      63,
      0,
      1,
      15,
      0
    ],
    [
      64,
      0,
      1,
      15,
      0
    ],
    [
      65,
      0,
      1,
      15,
      0
    ],
    [
      66,
      0,
      1,
      15,
      0
    ],
    [
      67,
      0,
      1,
      15,
      0
    ],
    [
      68,
      0,
      1,
      15,
      0
    ],
    [
      69,
      0,
      1,
      15,
      0
    ],
    [
      70,
      0,
      1,
      15,
      0
    ],
    [
      71,
      0,
      1,
      15,
      0
    ],
    [
      72,
      0,
      1,
      15,
      0
    ],
    [
      73,
      0,
      1,
      15,
      0
    ],
    [
      74,
      0,
      1,
      15,
      0
    ],
    [
      75,
      0,
      1,
      15,
      0
    ],
    [
      76,
      0,
      1,
      15,
      0
    ],
    [
      77,
      0,
      1,
      15,
      0
    ]
  ]
]


  6 - User Reported Hover Issues #current
[civetPreprocessor.ts] Civet snippet after trimming leading blank lines:
	function foo1() {
		kekw := "hello, world"
	}

[preprocessCivet] Detected <script lang="civet"> (instance) at offsets 21-69
[preprocessCivet] Original snippet content:

	function foo1() {
		kekw := "hello, world"
	}

[civetPreprocessor.ts] Civet snippet after dedent (removed indent: "	"):
function foo1() {
	kekw := "hello, world"
}

[preprocessCivet] Dedented snippet content:
function foo1() {
	kekw := "hello, world"
}

[civetPreprocessor.ts] Compiled TS code from Civet:
function foo1() {
	const kekw = "hello, world";return kekw
}

[preprocessCivet] compileCivet output code length: 61, rawMap lines count: 4
[civetPreprocessor.ts] Raw Civet Map (rawMap.lines[0]) for first line of dedented snippet ("function foo1() {") segments:
  Segment 0: genCol=0, srcFileIndex=0, srcLine_0based=0, srcCol_0based=0
  Segment 1: genCol=8, srcFileIndex=0, srcLine_0based=0, srcCol_0based=8
  Segment 2: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=9
  Segment 3: genCol=4, srcFileIndex=0, srcLine_0based=0, srcCol_0based=13
  Segment 4: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=14
  Segment 5: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=15
  Segment 6: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=16
  Segment 7: genCol=1, srcFileIndex=0, srcLine_0based=0, srcCol_0based=17
[preprocessCivet] Civet snippet offsets 21-69 -> Svelte line 2
[preprocessCivet] originalContentStartLine_1based: 2, snippet offset (0-based): 1
[civetPreprocessor.ts] Inputs to normalizeCivetMap:
  originalCivetSnippetLineOffset_0based: 1
  svelteFilePath: C:\Users\user\Documents\GitHub\language-tools-with-civet\packages\svelte2tsx\test\civet\fixtures\twoFooUserRequest.svelte
  removedCivetContentIndentLength: 1
[civetPreprocessor.ts] normalized map first semicolon segment: AACC,QAAQ,CAAC,IAAI,CAAC,CAAC,CAAC,CAAC
[preprocessCivet] normalizeCivetMap returned map mappings length: 4
[chainMaps] Starting refactored chaining.
[chainMaps] BaseMap sources: [
  'C:/Users/user/Documents/GitHub/language-tools-with-civet/packages/svelte2tsx/test/civet/fixtures/twoFooUserRequest.svelte'
]
[chainMaps] Number of blocks: 1
[chainMaps] Block 0: originalLines=5, compiledLines=4, tsStartChar=21, tsEndChar=82, tsStartLine=1
[chainMaps] Decoded baseMap segments (first 5 lines): [[],[[0,0,0,0],[1,0,0,1]],[[0,0,0,18],[1,0,0,19],[2,0,0,20],[3,0,0,21],[4,0,0,22],[5,0,0,23],[6,0,0,24],[7,0,0,25],[8,0,0,26],[9,0,0,27],[10,0,0,28],[11,0,0,29],[12,0,0,30],[13,0,0,31],[14,0,0,32],[15,0,0,33],[16,0,0,34],[17,0,0,35]],[[0,0,1,0],[1,0,1,1],[2,0,1,2],[3,0,1,3],[4,0,1,4],[5,0,1,5],[6,0,1,6],[7,0,1,7],[8,0,1,8],[9,0,1,9],[10,0,1,10],[11,0,1,11],[12,0,1,12],[13,0,1,13],[14,0,1,14],[15,0,1,15],[16,0,1,16],[17,0,1,17],[18,0,1,18],[19,0,1,19],[20,0,1,20],[21,0,1,21],[22,0,1,22],[23,0,1,23],[24,0,1,24],[25,0,1,25],[26,0,1,26],[27,0,1,27],[28,0,1,28],[29,0,1,29],[30,0,1,30],[31,0,1,31],[32,0,1,32],[33,0,1,33],[34,0,1,34],[35,0,1,35],[36,0,1,36],[37,0,1,37],[38,0,1,38],[39,0,1,39],[40,0,1,40]],[[0,0,2,0],[1,0,2,1]]]
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,1,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[8,0,1,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[9,0,1,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[13,0,1,14], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[14,0,1,15], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,2,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,2,6], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,2,6], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,2,6], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,2,6], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,2,6], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,2,6], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[7,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[11,0,2,6], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[12,0,2,7], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[13,0,2,9], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[14,0,2,10], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[15,0,2,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[19,0,2,24], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,3,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[1,0,3,2], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,4,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] traceSegment returned traced=[0,0,4,1], civetNameIndex=undefined, civetName=undefined
[chainMaps] Remapped segments (first 5 lines): [[],[[0,0,0,0,null],[1,0,0,1,null]],[[0,0,0,18,null],[1,0,0,19,null],[2,0,0,20,null],[3,0,1,1,null],[4,0,1,1,null],[5,0,1,1,null],[6,0,1,1,null],[7,0,1,1,null],[8,0,1,1,null],[9,0,1,1,null],[10,0,1,1,null],[11,0,1,9,null],[12,0,1,10,null],[13,0,1,10,null],[14,0,1,10,null],[15,0,1,10,null],[16,0,1,14,null],[17,0,1,15,null]],[[0,0,2,1,null],[1,0,2,6,null],[2,0,2,6,null],[3,0,2,6,null],[4,0,2,6,null],[5,0,2,6,null],[6,0,2,6,null],[7,0,2,2,null],[8,0,2,2,null],[9,0,2,2,null],[10,0,2,2,null],[11,0,2,6,null],[12,0,2,7,null],[13,0,2,9,null],[14,0,2,10,null],[15,0,2,2,null],[16,0,2,2,null],[17,0,2,2,null],[18,0,2,2,null],[19,0,2,24,null],[20,0,2,24,null],[21,0,2,24,null],[22,0,2,24,null],[23,0,2,24,null],[24,0,2,24,null],[25,0,2,24,null],[26,0,2,24,null],[27,0,2,24,null],[28,0,2,24,null],[29,0,2,24,null],[30,0,2,24,null],[31,0,2,24,null],[32,0,2,24,null],[33,0,2,24,null],[34,0,2,24,null],[35,0,2,24,null],[36,0,2,24,null],[37,0,2,24,null],[38,0,2,24,null],[39,0,2,24,null],[40,0,2,24,null]],[[0,0,3,1,null],[1,0,3,2,null]]]
[chainMaps] Remapped summary (first 5 lines):
  Line 1: []
  Line 2: [[0,0,0,0,null],[1,0,0,1,null]]
  Line 3: [[0,0,0,18,null],[1,0,0,19,null],[2,0,0,20,null],[3,0,1,1,null],[4,0,1,1,null],[5,0,1,1,null],[6,0,1,1,null],[7,0,1,1,null],[8,0,1,1,null],[9,0,1,1,null],[10,0,1,1,null],[11,0,1,9,null],[12,0,1,10,null],[13,0,1,10,null],[14,0,1,10,null],[15,0,1,10,null],[16,0,1,14,null],[17,0,1,15,null]]
  Line 4: [[0,0,2,1,null],[1,0,2,6,null],[2,0,2,6,null],[3,0,2,6,null],[4,0,2,6,null],[5,0,2,6,null],[6,0,2,6,null],[7,0,2,2,null],[8,0,2,2,null],[9,0,2,2,null],[10,0,2,2,null],[11,0,2,6,null],[12,0,2,7,null],[13,0,2,9,null],[14,0,2,10,null],[15,0,2,2,null],[16,0,2,2,null],[17,0,2,2,null],[18,0,2,2,null],[19,0,2,24,null],[20,0,2,24,null],[21,0,2,24,null],[22,0,2,24,null],[23,0,2,24,null],[24,0,2,24,null],[25,0,2,24,null],[26,0,2,24,null],[27,0,2,24,null],[28,0,2,24,null],[29,0,2,24,null],[30,0,2,24,null],[31,0,2,24,null],[32,0,2,24,null],[33,0,2,24,null],[34,0,2,24,null],[35,0,2,24,null],[36,0,2,24,null],[37,0,2,24,null],[38,0,2,24,null],[39,0,2,24,null],[40,0,2,24,null]]
  Line 5: [[0,0,3,1,null],[1,0,3,2,null]]
[chainMaps] Final encoded mappings: ;AAAAA,CAACA;AAAiBA,CAACA,CAACA,CACnBA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAQA,CAACA,CAAAA,C...
[chainMaps] Final decoded mappings (first 3 lines): [
  [],
  [
    [
      0,
      0,
      0,
      0,
      0
    ],
    [
      1,
      0,
      0,
      1,
      0
    ]
  ],
  [
    [
      0,
      0,
      0,
      18,
      0
    ],
    [
      1,
      0,
      0,
      19,
      0
    ],
    [
      2,
      0,
      0,
      20,
      0
    ],
    [
      3,
      0,
      1,
      1,
      0
    ],
    [
      4,
      0,
      1,
      1,
      0
    ],
    [
      5,
      0,
      1,
      1,
      0
    ],
    [
      6,
      0,
      1,
      1,
      0
    ],
    [
      7,
      0,
      1,
      1,
      0
    ],
    [
      8,
      0,
      1,
      1,
      0
    ],
    [
      9,
      0,
      1,
      1,
      0
    ],
    [
      10,
      0,
      1,
      1,
      0
    ],
    [
      11,
      0,
      1,
      9,
      0
    ],
    [
      12,
      0,
      1,
      10,
      0
    ],
    [
      13,
      0,
      1,
      10,
      0
    ],
    [
      14,
      0,
      1,
      10,
      0
    ],
    [
      15,
      0,
      1,
      10,
      0
    ],
    [
      16,
      0,
      1,
      14,
      0
    ],
    [
      17,
      0,
      1,
      15,
      0
    ]
  ]
]
--- Generated TSX Code ---
///<reference types="svelte" />
;function $$render() {
function foo1() {
	const kekw = "hello, world";return kekw
}
;
async () => {

 { svelteHTML.createElement("div", {});
	abc;
 }};
return { props: {} as Record<string, never>, slots: {}, events: {} }}

export default class TwoFooUserRequest__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event($$render())) {
}
--- Final SourceMap ---
{
  "version": 3,
  "sources": [
    "C:/Users/user/Documents/GitHub/language-tools-with-civet/packages/svelte2tsx/test/civet/fixtures/twoFooUserRequest.svelte"
  ],
  "sourcesContent": [
    "<script lang=\"civet\">\n\tfunction foo1() {\n\t\tkekw := \"hello, world\"\n\t}\n</script>\n\n<div>\n\t{abc}\n</div>"
  ],
  "names": [],
  "mappings": ";AAAAA,CAACA;AAAiBA,CAACA,CAACA,CACnBA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAQA,CAACA,CAAAA,CAAAA,CAAAA,CAAIA,CAACA;AACdA,CAAKA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAJA,CAAAA,CAAAA,CAAAA,CAAIA,CAACA,CAAEA,CAACA,CAARA,CAAAA,CAAAA,CAAAA,CAAsBA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA,CAAAA;AACvBA,CAACA;AACDA;AAAAA,aAAQA;AAAAA;AAETA,6BAACA,CAACA,CAACA,QAAEA;AAAAA,CACHA,CAACA,CAACA,CAACA,CAACA;AACLA"
}
[Test] Checking mapping for Svelte token: "foo1" (occurrence 1) at TSX L3C9
    1) should correctly map tokens from TSX back to original Svelte positions


  0 passing (23ms)
  1 failing

  1) 6 - User Reported Hover Issues #current
       should correctly map tokens from TSX back to original Svelte positions:

      AssertionError [ERR_ASSERTION]: Column mismatch for "foo1". Expected 9, got 1. TSX L3C9

1 !== 9

      + expected - actual

      -1
      +9
      
      at Context.<anonymous> (test\civet\6 - userReportedHover#current.test.ts:160:14)
      at processImmediate (node:internal/timers:485:21)

