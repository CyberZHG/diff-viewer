export function init(): Promise<unknown>;
export function getModule(): unknown;

export const LineKind: {
    readonly Blank: 0;
    readonly Context: 1;
    readonly Removed: 2;
    readonly Added: 3;
};

export type LineKindValue = 0 | 1 | 2 | 3;

export function getKindValue(kind: unknown): LineKindValue;

export interface SideInfo {
    kind: LineKindValue;
    lineNo: number;
}

export interface ViewLine {
    left: SideInfo;
    right: SideInfo;
}

export interface InlineHighlight {
    row: number;
    start: number;
    end: number;
    isLeft: boolean;
}

export interface Connector {
    top: number;
    bottom: number;
    leftStart: number;
    leftEnd: number;
    rightStart: number;
    rightEnd: number;
}

export interface WasmVector<T> {
    size(): number;
    get(index: number): T;
}

export interface ViewModel {
    oldLines: WasmVector<string>;
    newLines: WasmVector<string>;
    lines: WasmVector<ViewLine>;
    highlights: WasmVector<InlineHighlight>;
    connectors: WasmVector<Connector>;
}

export function createViewModel(oldText: string, newText: string, context?: number): ViewModel;

export function toArray<T>(vec: WasmVector<T>): T[];

export function getLineContent(vm: ViewModel, side: SideInfo, isLeft: boolean): string;

export interface ProcessedSide {
    kind: LineKindValue;
    lineNo: number;
    content: string;
}

export interface ProcessedLine {
    index: number;
    left: ProcessedSide;
    right: ProcessedSide;
}

export interface ProcessedViewModel {
    lines: ProcessedLine[];
    highlights: InlineHighlight[];
    connectors: Connector[];
}

export function processViewModel(vm: ViewModel): ProcessedViewModel;
