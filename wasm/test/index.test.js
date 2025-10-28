import { describe, it, expect, beforeAll } from 'vitest';
import { init, createViewModel, processViewModel, toArray, LineKind, getKindValue } from '../index.js';

beforeAll(async () => {
    await init();
});

describe('createViewModel', () => {
    it('handles empty inputs', () => {
        const vm = createViewModel('', '');
        expect(toArray(vm.lines).length).toBe(0);
        expect(toArray(vm.connectors).length).toBe(0);
    });

    it('handles identical texts', () => {
        const vm = createViewModel('a\nb\nc', 'a\nb\nc');
        const lines = toArray(vm.lines);
        expect(lines.length).toBe(3);
        lines.forEach(line => {
            expect(getKindValue(line.left.kind)).toBe(LineKind.Context);
            expect(getKindValue(line.right.kind)).toBe(LineKind.Context);
        });
        expect(toArray(vm.connectors).length).toBe(0);
    });

    it('detects insertions', () => {
        const vm = createViewModel('a\nc', 'a\nb\nc');
        const lines = toArray(vm.lines);
        const added = lines.find(l => getKindValue(l.right.kind) === LineKind.Added);
        expect(added, `should find an added line. Lines: ${JSON.stringify(lines.map(l => ({
            left: { kind: getKindValue(l.left.kind), lineNo: l.left.lineNo },
            right: { kind: getKindValue(l.right.kind), lineNo: l.right.lineNo }
        })))}`).toBeTruthy();
        expect(vm.newLines.get(added.right.lineNo - 1)).toBe('b');
    });

    it('detects deletions', () => {
        const vm = createViewModel('a\nb\nc', 'a\nc');
        const lines = toArray(vm.lines);
        const removed = lines.find(l => getKindValue(l.left.kind) === LineKind.Removed);
        expect(removed, 'should find a removed line').toBeTruthy();
        expect(vm.oldLines.get(removed.left.lineNo - 1)).toBe('b');
    });

    it('detects modifications with inline highlights', () => {
        const vm = createViewModel('hello', 'hallo');
        expect(toArray(vm.highlights).length).toBeGreaterThan(0);
    });

    it('creates connectors for hunks', () => {
        const vm = createViewModel('a\nb', 'a\nx');
        const connectors = toArray(vm.connectors);
        expect(connectors.length).toBe(1);
        expect(connectors[0].top).toBeLessThanOrEqual(connectors[0].bottom);
    });
});

describe('processViewModel', () => {
    it('converts to plain JS objects', () => {
        const vm = createViewModel('old', 'new');
        const processed = processViewModel(vm);

        expect(Array.isArray(processed.lines)).toBe(true);
        expect(Array.isArray(processed.highlights)).toBe(true);
        expect(Array.isArray(processed.connectors)).toBe(true);
    });

    it('includes line content', () => {
        const vm = createViewModel('foo', 'bar');
        const processed = processViewModel(vm);

        const hasContent = processed.lines.some(
            l => l.left.content === 'foo' || l.right.content === 'bar'
        );
        expect(hasContent, 'should include line content').toBe(true);
    });

    it('handles blank lines correctly', () => {
        const vm = createViewModel('a\nb', 'a');
        const processed = processViewModel(vm);

        const blankRight = processed.lines.find(
            l => l.left.kind === LineKind.Removed && l.right.kind === LineKind.Blank
        );
        if (blankRight) {
            expect(blankRight.right.content).toBe('');
        }
    });
});

describe('LineKind', () => {
    it('has correct values', () => {
        expect(LineKind.Blank).toBe(0);
        expect(LineKind.Context).toBe(1);
        expect(LineKind.Removed).toBe(2);
        expect(LineKind.Added).toBe(3);
    });
});

describe('toArray', () => {
    it('converts WASM vector to array', () => {
        const vm = createViewModel('a\nb', 'a\nb');
        const arr = toArray(vm.lines);
        expect(Array.isArray(arr)).toBe(true);
        expect(arr.length).toBe(vm.lines.size());
    });
});
