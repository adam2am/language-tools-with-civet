import { strict as assert } from 'assert';
import { getActualContentStartLine, getLineAndColumnForOffset } from '../../src/svelte2tsx/utils/civetUtils';

describe('civetUtils - String Manipulation', () => {
    describe('getLineAndColumnForOffset', () => {
        it('should handle basic cases with LF', () => {
            const content = "first line\nsecond line\nthird line";
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 0), { line: 1, column: 0 }, 'Offset 0');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 10), { line: 1, column: 10 }, 'Offset 10 on line 1'); // End of "first line"
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 11), { line: 2, column: 0 }, 'Offset 11 at start of line 2 (after \n)');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 22), { line: 2, column: 11 }, 'Offset 22 at end of "second line"');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 23), { line: 3, column: 0 }, 'Offset 23 at start of line 3 (after \n)');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, content.length), { line: 3, column: 10 }, 'Offset at end of content');
        });

        it('should handle basic cases with CRLF', () => {
            const content = "first line\r\nsecond line\r\nthird line";
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 0), { line: 1, column: 0 }, 'Offset 0 CRLF');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 10), { line: 1, column: 10 }, 'Offset 10 on line 1 CRLF'); // End of "first line"
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 12), { line: 2, column: 0 }, 'Offset 12 at start of line 2 CRLF (after \r\n)');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 23), { line: 2, column: 11 }, 'Offset 23 at end of "second line" CRLF');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 25), { line: 3, column: 0 }, 'Offset 25 at start of line 3 CRLF (after \r\n)');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, content.length), { line: 3, column: 10 }, 'Offset at end of content CRLF');
        });

        it('should handle offsets at exact newlines', () => {
            const content = "a\nbc\nd";
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 1), { line: 1, column: 1 }, 'Before LF');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 2), { line: 2, column: 0 }, 'After LF / Start of new line');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 4), { line: 2, column: 2 }, 'Before second LF');
            assert.deepStrictEqual(getLineAndColumnForOffset(content, 5), { line: 3, column: 0 }, 'After second LF / Start of new line');
        });

        it('should handle empty string', () => {
            assert.deepStrictEqual(getLineAndColumnForOffset('', 0), { line: 1, column: 0 });
        });

        it('should handle string with only newlines', () => {
            assert.deepStrictEqual(getLineAndColumnForOffset('\n\n', 0), { line: 1, column: 0 });
            assert.deepStrictEqual(getLineAndColumnForOffset('\n\n', 1), { line: 2, column: 0 });
            assert.deepStrictEqual(getLineAndColumnForOffset('\n\n', 2), { line: 3, column: 0 });
        });
    });

    describe('getActualContentStartLine', () => {
        const scriptTagStartLF = '<script lang="civet">\n';
        const scriptTagStartCRLF = '<script lang="civet">\r\n';

        it('should find content on next line (LF)', () => {
            const content = `${scriptTagStartLF}actualCode</script>`;
            const offset = scriptTagStartLF.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 2);
        });

        it('should find content on next line (CRLF)', () => {
            const content = `${scriptTagStartCRLF}actualCode</script>`;
            const offset = scriptTagStartCRLF.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 2);
        });

        it('should skip extra blank line (LF)', () => {
            const content = `${scriptTagStartLF}\nactualCode</script>`;
            const offset = scriptTagStartLF.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 3);
        });

        it('should skip extra blank line (CRLF)', () => {
            const content = `${scriptTagStartCRLF}\r\nactualCode</script>`;
            const offset = scriptTagStartCRLF.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 3);
        });

        it('should handle leading tabs (LF)', () => {
            const content = `${scriptTagStartLF}\tactualCode</script>`;
            const offset = scriptTagStartLF.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 2);
        });

        it('should handle leading tabs (CRLF)', () => {
            const content = `${scriptTagStartCRLF}\tactualCode</script>`;
            const offset = scriptTagStartCRLF.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 2);
        });

        it('should handle content on the same line as script tag', () => {
            const content = '<script lang="civet">actualCode</script>';
            const offset = '<script lang="civet">'.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 1);
        });

        it('should handle empty script tag', () => {
            const content = '<script lang="civet"></script>';
            const offset = '<script lang="civet">'.length;
            assert.strictEqual(getActualContentStartLine(content, offset), 1);
        });

        it('should handle script tag with only whitespace (LF)', () => {
            const content = '<script lang="civet">\n\t\n</script>'; // content[20]=\n, content[21]=\t, content[22]=\n, content[23]=<
            const offset = '<script lang="civet">'.length; // offset = 20
            // idx iterates: 20->21 (sees \n), 21->22 (sees \t), 22->23 (sees \n). Loop stops, idx=23.
            // getLineAndColumnForOffset(content, 23) -> line 3, col 0
            assert.strictEqual(getActualContentStartLine(content, offset), 3); 
        });

        it('should handle script tag with only whitespace (CRLF)', () => {
            const content = '<script lang="civet">\r\n\t\r\n</script>'; // content[20]=\r, content[21]=\n, content[22]=\t, content[23]=\r, content[24]=\n, content[25]=<
            const offset = '<script lang="civet">'.length; // offset = 20
            // idx iterates: 20->21 (sees \r), 21->22 (sees \n), 22->23 (sees \t), 23->24 (sees \r), 24->25 (sees \n). Loop stops, idx=25.
            // getLineAndColumnForOffset(content, 25) -> line 3, col 0
            assert.strictEqual(getActualContentStartLine(content, offset), 3);
        });

        it('should handle content after an empty line within script (LF)', () => {
            const svelteContent = '<script lang="civet">\n\n  const a = 1;\n</script>';
            const scriptOffset = svelteContent.indexOf('>') + 1;
            assert.strictEqual(getActualContentStartLine(svelteContent, scriptOffset), 3, 'Expected to find code on line 3');
        });

        it('should handle content after an empty line within script (CRLF)', () => {
            const svelteContent = '<script lang="civet">\r\n\r\n  const a = 1;\r\n</script>';
            const scriptOffset = svelteContent.indexOf('>') + 1;
            assert.strictEqual(getActualContentStartLine(svelteContent, scriptOffset), 3, 'Expected to find code on line 3 CRLF');
        });

         it('should handle script where content starts immediately after script tag on same line', () => {
            const svelteContent = '<script lang="civet">const a = 1;</script>';
            const scriptOffset = svelteContent.indexOf('>') + 1;
            assert.strictEqual(getActualContentStartLine(svelteContent, scriptOffset), 1, 'Content on same line');
        });

        it('should handle script with leading spaces before content on the same line', () => {
            const svelteContent = '<script lang="civet">  const a = 1;</script>';
            const scriptOffset = svelteContent.indexOf('>') + 1;
            assert.strictEqual(getActualContentStartLine(svelteContent, scriptOffset), 1, 'Content with leading spaces on same line');
        });
    });
}); 