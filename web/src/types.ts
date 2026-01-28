// @ts-ignore
import type { ProcessedViewModel } from '../../wasm/index.js';

export interface TabData {
  id: string;
  name: string;
  content: string;
  savedContent: string | null;
}

export interface StorageData {
  leftTabs: TabData[];
  rightTabs: TabData[];
  leftActiveTab: string;
  rightActiveTab: string;
}

export interface Elements {
  leftEditor: HTMLTextAreaElement;
  rightEditor: HTMLTextAreaElement;
  leftHighlight: HTMLDivElement;
  rightHighlight: HTMLDivElement;
  leftContent: HTMLDivElement;
  rightContent: HTMLDivElement;
  leftLineNumbers: HTMLDivElement;
  rightLineNumbers: HTMLDivElement;
  leftStats: HTMLDivElement;
  rightStats: HTMLDivElement;
  connectorSvg: SVGSVGElement;
  connectorContent: HTMLDivElement;
  diffConnector: HTMLDivElement;
  wrapBtn: HTMLButtonElement;
  themeBtn: HTMLButtonElement;
  connectorBtn: HTMLButtonElement;
  syncScrollBtn: HTMLButtonElement;
  indentSelect: HTMLSelectElement;
  leftTabContainer: HTMLDivElement;
  rightTabContainer: HTMLDivElement;
  leftTabScrollLeft: HTMLButtonElement;
  leftTabScrollRight: HTMLButtonElement;
  rightTabScrollLeft: HTMLButtonElement;
  rightTabScrollRight: HTMLButtonElement;
  leftTabAdd: HTMLButtonElement;
  rightTabAdd: HTMLButtonElement;
  leftSave: HTMLButtonElement;
  leftDownload: HTMLButtonElement;
  leftUpload: HTMLButtonElement;
  leftClear: HTMLButtonElement;
  leftFileInput: HTMLInputElement;
  rightSave: HTMLButtonElement;
  rightDownload: HTMLButtonElement;
  rightUpload: HTMLButtonElement;
  rightClear: HTMLButtonElement;
  rightFileInput: HTMLInputElement;
  leftWrapper: HTMLDivElement;
  rightWrapper: HTMLDivElement;
}

export interface State {
  isDarkMode: boolean;
  isSoftWrap: boolean;
  showConnector: boolean;
  syncScroll: boolean;
  indentSize: number;
  diffResult: ProcessedViewModel | null;
  scrollPending: boolean;
  resizeTimeout: number | null;
  diffDebounceTimeout: number | null;
  leftTabs: TabData[];
  rightTabs: TabData[];
  leftActiveTabId: string;
  rightActiveTabId: string;
  isScrolling: boolean;
  lastFocusedSide: 'left' | 'right';
}

export interface ConnectorBlock {
  type: 'added' | 'removed' | 'modified';
  startIndex: number;
  endIndex: number;
}
