import DiffViewModule from './wasm/DiffViewWASM.js';

let module = null;

export async function init() {
    if (!module) {
        module = await DiffViewModule();
    }
    return module;
}

export function getModule() {
    if (!module) {
        throw new Error('Call init() first');
    }
    return module;
}

export const LineKind = {
    Blank: 0,
    Context: 1,
    Removed: 2,
    Added: 3,
};

// Extract numeric value from embind enum (handles both plain numbers and embind enum objects)
export function getKindValue(kind) {
    if (typeof kind === 'number') {
        return kind;
    }
    if (typeof kind === 'object' && kind !== null) {
        if ('value' in kind) {
            return kind.value;
        }
    }
    return kind;
}

export function createViewModel(oldText, newText, context = 3) {
    return getModule().createViewModel(oldText, newText, context);
}

export function toArray(vec) {
    const arr = [];
    for (let i = 0; i < vec.size(); i++) {
        arr.push(vec.get(i));
    }
    return arr;
}

export function getLineContent(vm, side, isLeft) {
    if (getKindValue(side.kind) === LineKind.Blank || side.lineNo === 0) {
        return '';
    }
    const lines = isLeft ? vm.oldLines : vm.newLines;
    return lines.get(side.lineNo - 1);
}

export function processViewModel(vm) {
    const lines = toArray(vm.lines).map((line, idx) => ({
        index: idx,
        left: {
            kind: getKindValue(line.left.kind),
            lineNo: line.left.lineNo,
            content: getLineContent(vm, line.left, true),
        },
        right: {
            kind: getKindValue(line.right.kind),
            lineNo: line.right.lineNo,
            content: getLineContent(vm, line.right, false),
        },
    }));

    const highlights = toArray(vm.highlights).map(h => ({
        row: h.row,
        start: h.start,
        end: h.end,
        isLeft: h.isLeft,
    }));

    const connectors = toArray(vm.connectors).map(c => ({
        top: c.top,
        bottom: c.bottom,
        leftStart: c.leftStart,
        leftEnd: c.leftEnd,
        rightStart: c.rightStart,
        rightEnd: c.rightEnd,
    }));

    return { lines, highlights, connectors };
}
