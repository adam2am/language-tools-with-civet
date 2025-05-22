import { strict as assert } from 'assert';
import { CivetLanguageServiceHost } from '../src/plugins/civet/CivetLanguageServiceHost.js';
import civet from '@danielx/civet';

// LSP Position type
const pos = (line, character) => ({ line, character });

const civetCode = `
x = 42
export x
`;

const uri = 'file:///test.civet';

// Compile Civet to TS
const result = civet.compile(civetCode, {
    filename: uri,
    sync: true,
    sourceMap: true,
    inlineMap: false,
    js: false
});
const tsCode = result.code;
const sourcemapLines = result.sourceMap?.lines || [];

describe('CivetLanguageServiceHost', () => {
    let host;
    beforeEach(() => {
        host = new CivetLanguageServiceHost();
        host.updateCivetFile(uri, tsCode, sourcemapLines);
    });

    it('should provide quick info for exported variable', () => {
        // Find position of 'x' in 'export x'
        const lineIdx = tsCode.split('\n').findIndex(l => l.includes('export'));
        const charIdx = tsCode.split('\n')[lineIdx].indexOf('x');
        const info = host.getQuickInfo(uri, pos(lineIdx, charIdx));
        assert(info, 'QuickInfo should be returned');
        assert(info.displayParts.some(p => p.text.includes('x')), 'QuickInfo should mention x');
    });

    it('should provide definitions for exported variable', () => {
        // Find position of 'x' in 'export x'
        const lineIdx = tsCode.split('\n').findIndex(l => l.includes('export'));
        const charIdx = tsCode.split('\n')[lineIdx].indexOf('x');
        const defs = host.getDefinitions(uri, pos(lineIdx, charIdx));
        assert(defs && defs.length > 0, 'Definitions should be returned');
        assert(defs[0].fileName === uri, 'Definition should be in the same file');
    });

    it('should provide completions in the file', () => {
        // Find position after 'export '
        const lineIdx = tsCode.split('\n').findIndex(l => l.includes('export'));
        const charIdx = tsCode.split('\n')[lineIdx].length;
        const completions = host.getCompletions(uri, pos(lineIdx, charIdx));
        assert(completions && completions.entries.length > 0, 'Completions should be returned');
        assert(completions.entries.some(e => e.name === 'x'), 'Completions should include x');
    });
}); 