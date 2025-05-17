import * as assert from 'assert';
import { Position, Range } from 'vscode-languageserver';
import { convertRange, rangeToTextSpan } from '../../../src/plugins/typescript/utils';

// Mock document implementing positionAt and offsetAt
class MockDoc {
    text: string;
    constructor(text: string) {
        this.text = text;
    }
    positionAt(offset: number): Position {
        const lines = this.text.slice(0, offset).split(/\r?\n/);
        const line = lines.length - 1;
        const character = lines[lines.length - 1].length;
        return Position.create(line, character);
    }
    offsetAt(pos: Position): number {
        const lines = this.text.split(/\r?\n/);
        let offset = 0;
        for (let i = 0; i < pos.line; i++) {
            offset += lines[i].length + 1; // +1 for newline
        }
        offset += pos.character;
        return offset;
    }
}

describe('TypeScript utils', () => {
    const sample = 'hello world\nthis is a test\nline three';
    const doc = new MockDoc(sample);

    it('convertRange maps start and end correctly', () => {
        // textSpan from offset 6 ('world') length 5 should map to 'world'
        const range: Range = convertRange(doc, { start: 6, length: 5 });
        assert.strictEqual(range.start.line, 0);
        assert.strictEqual(range.start.character, 6);
        assert.strictEqual(range.end.line, 0);
        assert.strictEqual(range.end.character, 11);
    });

    it('rangeToTextSpan round-trips range -> textSpan', () => {
        // define a range 'is a' in second line
        const startPos = Position.create(1, 5); // 'this ' (5 chars)
        const endPos = Position.create(1, 9);   // 'is a' ends at char 9
        const range: Range = Range.create(startPos, endPos);
        const textSpan = rangeToTextSpan(range, doc);
        // textSpan.start should be offsetAt startPos
        assert.strictEqual(textSpan.start, doc.offsetAt(startPos));
        // length should be end - start
        assert.strictEqual(textSpan.length, doc.offsetAt(endPos) - doc.offsetAt(startPos));
    });

    it('convertRange maps multi-line spans correctly', () => {
        // spans from 'world' into second line 'this is a test'
        // start at offset 6 ('w' of 'world') length 20
        const multi: Range = convertRange(doc, { start: 6, length: 20 });
        // offset 6 maps to line 0, char 6
        assert.strictEqual(multi.start.line, 0);
        assert.strictEqual(multi.start.character, 6);
        // offset 6+20=26 maps to start of newline after second line => line 1, char 14
        assert.strictEqual(multi.end.line, 1);
        assert.strictEqual(multi.end.character, 14);
    });
}); 