
> svelte2tsx@0.7.35 test C:\Users\user\Documents\GitHub\language-tools-with-civet\packages\svelte2tsx
> mocha test/test.ts



  normalizeCivetMap

--- Scenario 1: Simple function ---
Original Civet: add := (a: number, b: number): number => a + b
Compiled TS: const add = (a: number, b: number): number => a + b
Raw CivetLinesSourceMap: {
  "lines": [
    [
      [
        0,
        0,
        0,
        3
      ],
      [
        6,
        0,
        0,
        0
      ],
      [
        3,
        0,
        0,
        3
      ],
      [
        1,
        0,
        0,
        4
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
        7
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
        6,
        0,
        0,
        17
      ],
      [
        1,
        0,
        0,
        18
      ],
      [
        1,
        0,
        0,
        19
      ],
      [
        1,
        0,
        0,
        20
      ],
      [
        1,
        0,
        0,
        21
      ],
      [
        1,
        0,
        0,
        22
      ],
      [
        6,
        0,
        0,
        28
      ],
      [
        1,
        0,
        0,
        29
      ],
      [
        1,
        0,
        0,
        30
      ],
      [
        1,
        0,
        0,
        31
      ],
      [
        6,
        0,
        0,
        37
      ],
      [
        1,
        0,
        0,
        38
      ],
      [
        2,
        0,
        0,
        40
      ],
      [
        1,
        0,
        0,
        41
      ],
      [
        1,
        0,
        0,
        42
      ],
      [
        1,
        0,
        0,
        43
      ],
      [
        1,
        0,
        0,
        44
      ],
      [
        1,
        0,
        0,
        45
      ]
    ]
  ],
  "line": 0,
  "colOffset": 1,
  "srcLine": 0,
  "srcColumn": 46,
  "srcOffset": 46,
  "srcTable": [
    46
  ],
  "source": "add := (a: number, b: number): number => a + b"
}

[normalizeCivetMap DEBUG] Processing Generated Line: 1
[normalizeCivetMap DEBUG] Sorted Segments for Gen Line 1: [{"genCol":0,"segment":[0,0,0,3]},{"genCol":6,"segment":[6,0,0,0]},{"genCol":9,"segment":[3,0,0,3]},{"genCol":10,"segment":[1,0,0,4]},{"genCol":11,"segment":[1,0,0,6]},{"genCol":12,"segment":[1,0,0,7]},{"genCol":13,"segment":[1,0,0,8]},{"genCol":14,"segment":[1,0,0,9]},{"genCol":15,"segment":[1,0,0,10]},{"genCol":16,"segment":[1,0,0,11]},{"genCol":22,"segment":[6,0,0,17]},{"genCol":23,"segment":[1,0,0,18]},{"genCol":24,"segment":[1,0,0,19]},{"genCol":25,"segment":[1,0,0,20]},{"genCol":26,"segment":[1,0,0,21]},{"genCol":27,"segment":[1,0,0,22]},{"genCol":33,"segment":[6,0,0,28]},{"genCol":34,"segment":[1,0,0,29]},{"genCol":35,"segment":[1,0,0,30]},{"genCol":36,"segment":[1,0,0,31]},{"genCol":42,"segment":[6,0,0,37]},{"genCol":43,"segment":[1,0,0,38]},{"genCol":45,"segment":[2,0,0,40]},{"genCol":46,"segment":[1,0,0,41]},{"genCol":47,"segment":[1,0,0,42]},{"genCol":48,"segment":[1,0,0,43]},{"genCol":49,"segment":[1,0,0,44]},{"genCol":50,"segment":[1,0,0,45]}]
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C0: {"source":"scenario1.svelte","original":{"line":3,"column":5},"generated":{"line":1,"column":0}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C6: {"source":"scenario1.svelte","original":{"line":3,"column":2},"generated":{"line":1,"column":6}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C9: {"source":"scenario1.svelte","original":{"line":3,"column":5},"generated":{"line":1,"column":9}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C10: {"source":"scenario1.svelte","original":{"line":3,"column":6},"generated":{"line":1,"column":10}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C11: {"source":"scenario1.svelte","original":{"line":3,"column":8},"generated":{"line":1,"column":11}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C12: {"source":"scenario1.svelte","original":{"line":3,"column":9},"generated":{"line":1,"column":12}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C13: {"source":"scenario1.svelte","original":{"line":3,"column":10},"generated":{"line":1,"column":13}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C14: {"source":"scenario1.svelte","original":{"line":3,"column":11},"generated":{"line":1,"column":14}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C15: {"source":"scenario1.svelte","original":{"line":3,"column":12},"generated":{"line":1,"column":15}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C16: {"source":"scenario1.svelte","original":{"line":3,"column":13},"generated":{"line":1,"column":16}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C22: {"source":"scenario1.svelte","original":{"line":3,"column":19},"generated":{"line":1,"column":22}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C23: {"source":"scenario1.svelte","original":{"line":3,"column":20},"generated":{"line":1,"column":23}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C24: {"source":"scenario1.svelte","original":{"line":3,"column":21},"generated":{"line":1,"column":24}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C25: {"source":"scenario1.svelte","original":{"line":3,"column":22},"generated":{"line":1,"column":25}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C26: {"source":"scenario1.svelte","original":{"line":3,"column":23},"generated":{"line":1,"column":26}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C27: {"source":"scenario1.svelte","original":{"line":3,"column":24},"generated":{"line":1,"column":27}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C33: {"source":"scenario1.svelte","original":{"line":3,"column":30},"generated":{"line":1,"column":33}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C34: {"source":"scenario1.svelte","original":{"line":3,"column":31},"generated":{"line":1,"column":34}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C35: {"source":"scenario1.svelte","original":{"line":3,"column":32},"generated":{"line":1,"column":35}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C36: {"source":"scenario1.svelte","original":{"line":3,"column":33},"generated":{"line":1,"column":36}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C42: {"source":"scenario1.svelte","original":{"line":3,"column":39},"generated":{"line":1,"column":42}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C43: {"source":"scenario1.svelte","original":{"line":3,"column":40},"generated":{"line":1,"column":43}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C45: {"source":"scenario1.svelte","original":{"line":3,"column":42},"generated":{"line":1,"column":45}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C46: {"source":"scenario1.svelte","original":{"line":3,"column":43},"generated":{"line":1,"column":46}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C47: {"source":"scenario1.svelte","original":{"line":3,"column":44},"generated":{"line":1,"column":47}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C48: {"source":"scenario1.svelte","original":{"line":3,"column":45},"generated":{"line":1,"column":48}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C49: {"source":"scenario1.svelte","original":{"line":3,"column":46},"generated":{"line":1,"column":49}}
[normalizeCivetMap DEBUG] Adding mapping for Gen L1C50: {"source":"scenario1.svelte","original":{"line":3,"column":47},"generated":{"line":1,"column":50}}
[normalizeCivetMap DEBUG] Final Raw V3 Map from generator.toJSON(): {"version":3,"sources":["scenario1.svelte"],"names":[],"mappings":"AAEK,MAAH,GAAG,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,CAAC,MAAM,CAAC,CAAC,CAAC,CAAC,CAAC,MAAM,CAAC,CAAC,CAAC,MAAM,CAAC,EAAE,CAAC,CAAC,CAAC,CAAC,CAAC","file":"scenario1.svelte","sourcesContent":["\n<script lang=\"civet\">\n  add := (a: number, b: number): number => a + b\n</script>\n<div></div>\n    "]}
Normalized StandardRawSourceMap: {
  "version": 3,
  "sources": [
    "scenario1.svelte"
  ],
  "names": [],
  "mappings": "AAEK,MAAH,GAAG,CAAC,CAAE,CAAC,CAAC,CAAC,CAAC,CAAC,MAAM,CAAC,CAAC,CAAC,CAAC,CAAC,MAAM,CAAC,CAAC,CAAC,MAAM,CAAC,EAAE,CAAC,CAAC,CAAC,CAAC,CAAC",
  "file": "scenario1.svelte",
  "sourcesContent": [
    "\n<script lang=\"civet\">\n  add := (a: number, b: number): number => a + b\n</script>\n<div></div>\n    "
  ]
}
--- Param mapping debug: TS columns 10..16 ---
TS [1,10] -> { source: 'scenario1.svelte', line: 3, column: 6, name: null }
TS [1,11] -> { source: 'scenario1.svelte', line: 3, column: 8, name: null }
TS [1,12] -> { source: 'scenario1.svelte', line: 3, column: 9, name: null }
TS [1,13] -> { source: 'scenario1.svelte', line: 3, column: 10, name: null }
TS [1,14] -> { source: 'scenario1.svelte', line: 3, column: 11, name: null }
TS [1,15] -> { source: 'scenario1.svelte', line: 3, column: 12, name: null }
TS [1,16] -> { source: 'scenario1.svelte', line: 3, column: 13, name: null }
DEBUG simple function param a mapping: { source: 'scenario1.svelte', line: 3, column: 10, name: null }
    1) normalizes a simple function declaration


  0 passing (87ms)
  1 failing

  1) normalizeCivetMap
       normalizes a simple function declaration:

      AssertionError [ERR_ASSERTION]: Original column for "a" in expression

39 !== 41

      + expected - actual

      -39
      +41
      
      at C:\Users\user\Documents\GitHub\language-tools-with-civet\packages\svelte2tsx\test\civet\mapNormalizer.test.ts:164:12
      at Generator.next (<anonymous>)
      at fulfilled (test\civet\mapNormalizer.test.ts:5:58)



тАЙELIFECYCLEтАЙ Test failed. See above for more details.


Focus only on our 1 it onl y test, then gonna move further if needed,

# Please manually calculate the civet lines sourcemap and each array showcase what it is about and mark - CORRECT/Plausible/ODD

| seg | runningGenCol (TS col) | Civet pos (L0,C) | TS char / Civet char | Verdict |
|---------------------------|------------------------|--------------------|-----------------------------------------------------------|------------|
| [0,0,0,3] | 0 | L0,C3 | TS “c” in “const” → Civet “:” in “add :=” | CORRECT |
| [6,0,0,0] | 6 | L0,C0 | TS “a” in “add” → Civet “a” in “add” | CORRECT |
| [3,0,0,3] | 9 | L0,C3 | TS space after “add” → Civet “:” | PLAUSIBLE |
| [1,0,0,4] | 10 | L0,C4 | TS “=” → Civet “=” | CORRECT |
| [1,0,0,6] | 11 | L0,C6 | TS space → Civet “(” | PLAUSIBLE |
| [1,0,0,7] | 12 | L0,C7 | TS “(” → Civet “a” (first param) | CORRECT |
| [1,0,0,8] | 13 | L0,C8 | TS “a” → Civet space before “:” | PLAUSIBLE |
| [1,0,0,9] | 14 | L0,C9 | TS “:” → Civet “:” | CORRECT |
| [1,0,0,10] | 15 | L0,C10 | TS space → Civet “n” | PLAUSIBLE |
| [1,0,0,11] | 16 | L0,C11 | TS “n” → Civet “u” | PLAUSIBLE |
| [6,0,0,17] | 22 | L0,C17 | TS “)” after second param → Civet “)” | CORRECT |
| [1,0,0,18] | 23 | L0,C18 | TS space → Civet “,” | PLAUSIBLE |
| [1,0,0,19] | 24 | L0,C19 | TS “b” (second param) → Civet “b” | CORRECT |
| [1,0,0,20] | 25 | L0,C20 | TS “:” after “b” → Civet “:” | CORRECT |
| [1,0,0,21] | 26 | L0,C21 | TS space → Civet space | PLAUSIBLE |
| [1,0,0,22] | 27 | L0,C22 | TS “n” in “number” → Civet “n” | CORRECT |
| [6,0,0,28] | 33 | L0,C28 | TS “)” closing return type → Civet “)” | CORRECT |
| [1,0,0,29] | 34 | L0,C29 | TS “:” before arrow → Civet “:” | CORRECT |
| [1,0,0,30] | 35 | L0,C30 | TS space → Civet space | PLAUSIBLE |
| [1,0,0,31] | 36 | L0,C31 | TS “=” of “=>” → Civet “=” | CORRECT |
| [6,0,0,37] | 42 | L0,C37 | TS “a” in expression → Civet “a” | CORRECT |
| [1,0,0,38] | 43 | L0,C38 | TS space → Civet space | PLAUSIBLE |
| [2,0,0,40] | 45 | L0,C40 | TS “+” → Civet “+” | CORRECT |
| [1,0,0,41] | 46 | L0,C41 | TS space → Civet space | PLAUSIBLE |
| [1,0,0,42] | 47 | L0,C42 | TS “b” → Civet “b” | CORRECT |
| [1,0,0,43] | 48 | L0,C43 | TS end-of-line → Civet end-of-line | PLAUSIBLE |
| [1,0,0,44] | 49 | L0,C44 | TS extra char → Civet extra (if any) | PLAUSIBLE |
| [1,0,0,45] | 50 | L0,C45 | TS extra char → Civet extra (if any) | PLAUSIBLE |




# 2 scenario 
| Segment # | genCol | TS char @genCol | origLine,origCol → Svelte (line,col) | Civet char @origCol | Verdict |
|-----------|--------|----------------------|---------------------------------------|---------------------|----------|
| 1 | 0 | ‘c’ in “const” | L3,C14 (0+2+1, 12+2) | snippet[0][12]=' ' | ❌ odd |
| 2 | 6 | ‘p’ in processArray | L3,C2 (0+2+1, 0+2) | snippet[0][ 0]='p' | ✅ correct |
| 3 | 18 | space after ‘y’ | L3,C14 (0+2+1, 12+2) | snippet[0][12]=' ' | ⚠️ plausible |
| 4 | 19 | ‘=’ after name | L3,C15 (0+2+1, 13+2) | snippet[0][13]=':' | ⚠️ plausible (“:=”→“=”) |
| 5 | 20 | space | L3,C17 (0+2+1, 15+2) | snippet[0][15]=' ' | ⚠️ plausible |
| 6 | 21 | ‘(’ before arr | L3,C18 (0+2+1, 16+2) | snippet[0][16]='(' | ✅ correct |
| 7 | 22 | ‘a’ of arr | L3,C19 (0+2+1, 17+2) | snippet[0][17]='a' | ✅ correct |
| 8 | 25 | ‘:’ in “: number” | L3,C22 (0+2+1, 20+2) | snippet[0][20]=':' | ✅ correct |
| 9 | 26 | space | L3,C23 (0+2+1, 21+2) | snippet[0][21]=' ' | ⚠️ plausible |
| 10 | 27 | ‘n’ in “number” | L3,C24 (0+2+1, 22+2) | snippet[0][22]='n' | ✅ correct |
| 11 | 33 | ‘]’ of “number[]” | L3,C30 (0+2+1, 28+2) | snippet[0][28]=']' | ✅ correct |
| 12 | 34 | ‘:’ for return type | L3,C31 (0+2+1, 29+2) | snippet[0][29]=':' | ✅ correct |
| 13 | 35 | space | L3,C32 (0+2+1, 30+2) | snippet[0][30]=' ' | ⚠️ plausible |
| 14 | 36 | ‘[’ of second “[]” | L3,C33 (0+2+1, 31+2) | snippet[0][31]='[' | ✅ correct |
| 15 | 37 | ‘]’ | L3,C34 (0+2+1, 32+2) | snippet[0][32]=']' | ✅ correct |
| 16 | 38 | space | L3,C35 (0+2+1, 33+2) | snippet[0][33]=' ' | ⚠️ plausible |
| 17 | 44 | ‘>’ of “=>” | L3,C41 (0+2+1, 39+2) | snippet[0][39]='>' | ✅ correct |
| 18 | 45 | space | L3,C42 (0+2+1, 40+2) | snippet[0][40]=' ' | ⚠️ plausible |
| 19 | 46 | { | L3,C43 (0+2+1, 41+2) | snippet end – fallback | ⚠️ plausible |
| 20–23 | 47–51 | out‐of‐range TS chars | all map to snippet col 44 (last char) | fallback | ⚠️ plausible |
Gen Line 2 (TS L2: return arr.filter((n) => n > 0)):
Segments (raw → debug) produce mappings like:
genCol 0 → snippet L1C0 (“ ” indent): plausible
genCol 7 → snippet L1C2 (‘a’ of arr) : ✅ correct
genCol 10 → snippet L1C5 (‘f’ of filter): ✅ correct
genCol 11 → snippet L1C6 (‘i’ of filter): ✅ correct
genCol 17 → snippet L1C12(‘n’ in (n)): ✅ correct
genCol 18 → snippet L1C12(‘n’ in (n)) reused: plausible
genCol 19 → snippet L1C14(‘>’ in > 0): ✅ correct
genCol 20 → snippet L1C15(‘ ‘ before 0): plausible
genCol 21 → snippet L1C16(‘0’): ✅ correct
etc. (remaining segments map to whitespace or end‐of‐line: plausible)