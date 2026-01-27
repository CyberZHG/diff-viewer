// @ts-ignore
import { init, createViewModel, processViewModel, LineKind, type ProcessedViewModel, type ProcessedLine, type InlineHighlight } from '../../wasm/index.js';

interface TabData {
  id: string;
  name: string;
  content: string;
  savedContent: string | null;
}

interface StorageData {
  leftTabs: TabData[];
  rightTabs: TabData[];
  leftActiveTab: string;
  rightActiveTab: string;
}

interface Elements {
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

interface State {
  isDarkMode: boolean;
  isSoftWrap: boolean;
  showConnector: boolean;
  indentSize: number;
  diffResult: ProcessedViewModel | null;
  scrollPending: boolean;
  resizeTimeout: number | null;
  leftTabs: TabData[];
  rightTabs: TabData[];
  leftActiveTabId: string;
  rightActiveTabId: string;
}

interface ConnectorBlock {
  type: 'added' | 'removed' | 'modified';
  startIndex: number;
  endIndex: number;
}

const LINE_HEIGHT = 20;
const PADDING_TOP = 8;
const SVG_WIDTH = 48;
const STORAGE_KEY = 'diffViewerData';
const MAX_STORAGE_SIZE = 1024 * 1024;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

class DiffEditor {
  private el: Elements;
  private state: State;

  constructor() {
    this.state = {
      isDarkMode: localStorage.getItem('darkMode') !== 'false',
      isSoftWrap: localStorage.getItem('softWrap') === 'true',
      showConnector: localStorage.getItem('showConnector') !== 'false',
      indentSize: parseInt(localStorage.getItem('indentSize') ?? '4', 10),
      diffResult: null,
      scrollPending: false,
      resizeTimeout: null,
      leftTabs: [],
      rightTabs: [],
      leftActiveTabId: '',
      rightActiveTabId: '',
    };

    this.el = this.queryElements();
    this.loadFromStorage();
    this.setup();
  }

  private queryElements(): Elements {
    return {
      leftEditor: document.getElementById('leftEditor') as HTMLTextAreaElement,
      rightEditor: document.getElementById('rightEditor') as HTMLTextAreaElement,
      leftHighlight: document.getElementById('leftHighlight') as HTMLDivElement,
      rightHighlight: document.getElementById('rightHighlight') as HTMLDivElement,
      leftContent: document.getElementById('leftContent') as HTMLDivElement,
      rightContent: document.getElementById('rightContent') as HTMLDivElement,
      leftLineNumbers: document.getElementById('leftLineNumbers') as HTMLDivElement,
      rightLineNumbers: document.getElementById('rightLineNumbers') as HTMLDivElement,
      leftStats: document.getElementById('leftStats') as HTMLDivElement,
      rightStats: document.getElementById('rightStats') as HTMLDivElement,
      connectorSvg: document.getElementById('connectorSvg') as unknown as SVGSVGElement,
      connectorContent: document.querySelector('.connector-content') as HTMLDivElement,
      diffConnector: document.getElementById('diffConnector') as HTMLDivElement,
      wrapBtn: document.getElementById('wrapBtn') as HTMLButtonElement,
      themeBtn: document.getElementById('themeBtn') as HTMLButtonElement,
      connectorBtn: document.getElementById('connectorBtn') as HTMLButtonElement,
      indentSelect: document.getElementById('indentSelect') as HTMLSelectElement,
      leftTabContainer: document.getElementById('leftTabContainer') as HTMLDivElement,
      rightTabContainer: document.getElementById('rightTabContainer') as HTMLDivElement,
      leftTabScrollLeft: document.getElementById('leftTabScrollLeft') as HTMLButtonElement,
      leftTabScrollRight: document.getElementById('leftTabScrollRight') as HTMLButtonElement,
      rightTabScrollLeft: document.getElementById('rightTabScrollLeft') as HTMLButtonElement,
      rightTabScrollRight: document.getElementById('rightTabScrollRight') as HTMLButtonElement,
      leftTabAdd: document.getElementById('leftTabAdd') as HTMLButtonElement,
      rightTabAdd: document.getElementById('rightTabAdd') as HTMLButtonElement,
      leftSave: document.getElementById('leftSave') as HTMLButtonElement,
      leftDownload: document.getElementById('leftDownload') as HTMLButtonElement,
      leftUpload: document.getElementById('leftUpload') as HTMLButtonElement,
      leftClear: document.getElementById('leftClear') as HTMLButtonElement,
      leftFileInput: document.getElementById('leftFileInput') as HTMLInputElement,
      rightSave: document.getElementById('rightSave') as HTMLButtonElement,
      rightDownload: document.getElementById('rightDownload') as HTMLButtonElement,
      rightUpload: document.getElementById('rightUpload') as HTMLButtonElement,
      rightClear: document.getElementById('rightClear') as HTMLButtonElement,
      rightFileInput: document.getElementById('rightFileInput') as HTMLInputElement,
      leftWrapper: document.querySelector('.editor-panel:first-of-type .editor-wrapper') as HTMLDivElement,
      rightWrapper: document.querySelector('.editor-panel:last-of-type .editor-wrapper') as HTMLDivElement,
    };
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: StorageData = JSON.parse(stored);
        this.state.leftTabs = data.leftTabs || [];
        this.state.rightTabs = data.rightTabs || [];
        this.state.leftActiveTabId = data.leftActiveTab || '';
        this.state.rightActiveTabId = data.rightActiveTab || '';
      }
    } catch {
    }

    for (const tab of this.state.leftTabs) {
      if (tab.savedContent === undefined) {
        tab.savedContent = tab.content;
      }
    }
    for (const tab of this.state.rightTabs) {
      if (tab.savedContent === undefined) {
        tab.savedContent = tab.content;
      }
    }

    if (this.state.leftTabs.length === 0) {
      const tab: TabData = { id: generateId(), name: 'Untitled', content: '', savedContent: null };
      this.state.leftTabs.push(tab);
      this.state.leftActiveTabId = tab.id;
    }
    if (this.state.rightTabs.length === 0) {
      const tab: TabData = { id: generateId(), name: 'Untitled', content: '', savedContent: null };
      this.state.rightTabs.push(tab);
      this.state.rightActiveTabId = tab.id;
    }

    if (!this.state.leftTabs.find(t => t.id === this.state.leftActiveTabId)) {
      this.state.leftActiveTabId = this.state.leftTabs[0].id;
    }
    if (!this.state.rightTabs.find(t => t.id === this.state.rightActiveTabId)) {
      this.state.rightActiveTabId = this.state.rightTabs[0].id;
    }
  }

  private saveToStorage(): void {
    const data: StorageData = {
      leftTabs: this.state.leftTabs,
      rightTabs: this.state.rightTabs,
      leftActiveTab: this.state.leftActiveTabId,
      rightActiveTab: this.state.rightActiveTabId,
    };
    const json = JSON.stringify(data);

    if (json.length > MAX_STORAGE_SIZE) {
      alert(`Warning: Data size (${(json.length / 1024 / 1024).toFixed(2)} MiB) exceeds 1 MiB.`);
    }

    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      alert('Failed to save to local storage. Data may be too large.');
    }
  }

  private setup(): void {
    this.el.indentSelect.value = String(this.state.indentSize);

    this.bindEvents();
    this.applyTheme();
    this.applyWrap();
    this.applyConnectorVisibility();
    this.loadActiveTabContent();
    this.renderTabs('left');
    this.renderTabs('right');
    this.updateDiff();

    requestAnimationFrame(() => {
      this.syncHeight(this.el.leftHighlight, this.el.leftEditor);
      this.syncHeight(this.el.rightHighlight, this.el.rightEditor);
    });
  }

  private loadActiveTabContent(): void {
    const leftTab = this.state.leftTabs.find(t => t.id === this.state.leftActiveTabId);
    const rightTab = this.state.rightTabs.find(t => t.id === this.state.rightActiveTabId);
    this.el.leftEditor.value = leftTab?.content ?? '';
    this.el.rightEditor.value = rightTab?.content ?? '';
  }

  private bindEvents(): void {
    this.el.leftEditor.addEventListener('input', () => this.onLeftInput());
    this.el.rightEditor.addEventListener('input', () => this.onRightInput());
    this.el.leftEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, this.el.leftEditor));
    this.el.rightEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, this.el.rightEditor));
    this.el.leftContent.addEventListener('scroll', () => this.handleLeftScroll());
    this.el.rightContent.addEventListener('scroll', () => this.handleRightScroll());
    this.el.wrapBtn.addEventListener('click', () => this.toggleWrap());
    this.el.themeBtn.addEventListener('click', () => this.toggleTheme());
    this.el.connectorBtn.addEventListener('click', () => this.toggleConnector());
    this.el.indentSelect.addEventListener('change', () => this.handleIndentChange());

    this.el.leftTabAdd.addEventListener('click', () => this.addTab('left'));
    this.el.rightTabAdd.addEventListener('click', () => this.addTab('right'));
    this.el.leftTabScrollLeft.addEventListener('click', () => this.scrollTabs('left', -100));
    this.el.leftTabScrollRight.addEventListener('click', () => this.scrollTabs('left', 100));
    this.el.rightTabScrollLeft.addEventListener('click', () => this.scrollTabs('right', -100));
    this.el.rightTabScrollRight.addEventListener('click', () => this.scrollTabs('right', 100));
    this.el.leftTabContainer.addEventListener('wheel', (e) => this.handleTabWheel(e, 'left'));
    this.el.rightTabContainer.addEventListener('wheel', (e) => this.handleTabWheel(e, 'right'));

    this.el.leftSave.addEventListener('click', () => this.saveCurrentTab('left'));
    this.el.rightSave.addEventListener('click', () => this.saveCurrentTab('right'));
    this.el.leftDownload.addEventListener('click', () => this.downloadCurrentTab('left'));
    this.el.rightDownload.addEventListener('click', () => this.downloadCurrentTab('right'));
    this.el.leftUpload.addEventListener('click', () => this.el.leftFileInput.click());
    this.el.rightUpload.addEventListener('click', () => this.el.rightFileInput.click());
    this.el.leftFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'left'));
    this.el.rightFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'right'));
    this.el.leftClear.addEventListener('click', () => this.clearEditor('left'));
    this.el.rightClear.addEventListener('click', () => this.clearEditor('right'));

    this.setupDragDrop(this.el.leftWrapper, 'left');
    this.setupDragDrop(this.el.rightWrapper, 'right');

    window.addEventListener('resize', () => {
      if (this.state.resizeTimeout) clearTimeout(this.state.resizeTimeout);
      this.state.resizeTimeout = window.setTimeout(() => {
        if (this.state.isSoftWrap) {
          this.syncHeight(this.el.leftHighlight, this.el.leftEditor);
          this.syncHeight(this.el.rightHighlight, this.el.rightEditor);
        }
        this.drawConnectors();
      }, 100);
    });
  }

  private setupDragDrop(wrapper: HTMLDivElement, side: 'left' | 'right'): void {
    wrapper.addEventListener('dragenter', (e) => {
      e.preventDefault();
      wrapper.classList.add('drag-over');
    });

    wrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    wrapper.addEventListener('dragleave', (e) => {
      if (!wrapper.contains(e.relatedTarget as Node)) {
        wrapper.classList.remove('drag-over');
      }
    });

    wrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      wrapper.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.loadFile(files[0], side);
      }
    });
  }

  private loadFile(file: File, side: 'left' | 'right'): void {
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const editor = side === 'left' ? this.el.leftEditor : this.el.rightEditor;
      editor.value = content;

      const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
      const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;
      const tab = tabs.find(t => t.id === activeId);
      if (tab) {
        tab.name = file.name;
        tab.content = content;
        this.renderTabs(side);
      }

      this.updateDiff();
    };
    reader.readAsText(file);
  }

  private handleFileUpload(e: Event, side: 'left' | 'right'): void {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.loadFile(files[0], side);
    }
    input.value = '';
  }

  private saveCurrentTab(side: 'left' | 'right'): void {
    const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
    const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;
    const editor = side === 'left' ? this.el.leftEditor : this.el.rightEditor;

    const tab = tabs.find(t => t.id === activeId);
    if (tab) {
      tab.content = editor.value;
      tab.savedContent = editor.value;
    }

    this.saveToStorage();
    this.renderTabs(side);
  }

  private downloadCurrentTab(side: 'left' | 'right'): void {
    const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
    const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;
    const editor = side === 'left' ? this.el.leftEditor : this.el.rightEditor;

    const tab = tabs.find(t => t.id === activeId);
    const filename = tab?.name || 'untitled.txt';
    const content = editor.value;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.includes('.') ? filename : `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private clearEditor(side: 'left' | 'right'): void {
    const editor = side === 'left' ? this.el.leftEditor : this.el.rightEditor;
    editor.value = '';
    this.saveCurrentTabContent(side);
    this.renderTabs(side);
    this.updateDiff();
  }

  private renderTabs(side: 'left' | 'right'): void {
    const container = side === 'left' ? this.el.leftTabContainer : this.el.rightTabContainer;
    const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
    const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;

    container.innerHTML = '';

    for (const tab of tabs) {
      const tabEl = document.createElement('div');
      const isActive = tab.id === activeId;
      tabEl.className = `tab${isActive ? ' active' : ''}`;
      tabEl.dataset.id = tab.id;

      const isUnsaved = this.isTabUnsaved(side, tab);

      const nameEl = document.createElement('span');
      nameEl.className = 'tab-name';
      nameEl.textContent = isUnsaved ? `*${tab.name}` : tab.name;
      tabEl.appendChild(nameEl);

      const closeEl = document.createElement('span');
      closeEl.className = 'tab-close';
      closeEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      closeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(side, tab.id);
      });
      tabEl.appendChild(closeEl);

      let clickTimeout: number | null = null;
      tabEl.addEventListener('click', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
          return;
        }
        clickTimeout = window.setTimeout(() => {
          clickTimeout = null;
          if (tab.id !== activeId) {
            this.selectTab(side, tab.id);
          }
        }, 200);
      });

      tabEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
        this.startEditTabName(side, tab.id, nameEl);
      });

      container.appendChild(tabEl);
    }

    this.updateTabScrollButtons(side);
  }

  private addTab(side: 'left' | 'right'): void {
    this.saveCurrentTabContent(side);

    const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
    const newTab: TabData = {
      id: generateId(),
      name: 'Untitled',
      content: '',
      savedContent: null,
    };
    tabs.push(newTab);

    if (side === 'left') {
      this.state.leftActiveTabId = newTab.id;
    } else {
      this.state.rightActiveTabId = newTab.id;
    }

    this.loadActiveTabContent();
    this.renderTabs(side);
    this.updateDiff();

    const container = side === 'left' ? this.el.leftTabContainer : this.el.rightTabContainer;
    requestAnimationFrame(() => {
      container.scrollLeft = container.scrollWidth;
    });
  }

  private closeTab(side: 'left' | 'right', tabId: string): void {
    const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
    const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;

    if (tabs.length <= 1) {
      const tab = tabs[0];
      tab.content = '';
      tab.savedContent = null;
      tab.name = 'Untitled';
      const editor = side === 'left' ? this.el.leftEditor : this.el.rightEditor;
      editor.value = '';
      this.renderTabs(side);
      this.updateDiff();
      return;
    }

    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    tabs.splice(index, 1);

    if (activeId === tabId) {
      const newActiveIndex = Math.min(index, tabs.length - 1);
      if (side === 'left') {
        this.state.leftActiveTabId = tabs[newActiveIndex].id;
      } else {
        this.state.rightActiveTabId = tabs[newActiveIndex].id;
      }
      this.loadActiveTabContent();
    }

    this.renderTabs(side);
    this.saveToStorage();
    this.updateDiff();
  }

  private isTabUnsaved(side: 'left' | 'right', tab: TabData): boolean {
    if (tab.savedContent === null) {
      return true;
    }
    const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;
    const editor = side === 'left' ? this.el.leftEditor : this.el.rightEditor;
    const currentContent = tab.id === activeId ? editor.value : tab.content;
    return currentContent !== tab.savedContent;
  }

  private selectTab(side: 'left' | 'right', tabId: string): void {
    this.saveCurrentTabContent(side);

    if (side === 'left') {
      this.state.leftActiveTabId = tabId;
    } else {
      this.state.rightActiveTabId = tabId;
    }

    this.loadActiveTabContent();
    this.renderTabs(side);
    this.updateDiff();
  }

  private saveCurrentTabContent(side: 'left' | 'right'): void {
    const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
    const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;
    const editor = side === 'left' ? this.el.leftEditor : this.el.rightEditor;

    const tab = tabs.find(t => t.id === activeId);
    if (tab) {
      tab.content = editor.value;
    }
  }

  private startEditTabName(side: 'left' | 'right', tabId: string, nameEl: HTMLSpanElement): void {
    const tabs = side === 'left' ? this.state.leftTabs : this.state.rightTabs;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-name-input';
    input.value = tab.name;

    let isFinishing = false;
    const finishEdit = () => {
      if (isFinishing) return;
      isFinishing = true;

      const newName = input.value.trim() || 'Untitled';
      tab.name = newName;
      this.saveToStorage();
      this.renderTabs(side);
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        isFinishing = true;
        this.renderTabs(side);
      }
    });

    nameEl.replaceWith(input);
    input.focus();
    input.select();
  }

  private scrollTabs(side: 'left' | 'right', delta: number): void {
    const container = side === 'left' ? this.el.leftTabContainer : this.el.rightTabContainer;
    container.scrollBy({ left: delta, behavior: 'smooth' });
    setTimeout(() => this.updateTabScrollButtons(side), 200);
  }

  private handleTabWheel(e: WheelEvent, side: 'left' | 'right'): void {
    e.preventDefault();
    const container = side === 'left' ? this.el.leftTabContainer : this.el.rightTabContainer;
    container.scrollLeft += e.deltaY;
    this.updateTabScrollButtons(side);
  }

  private updateTabScrollButtons(side: 'left' | 'right'): void {
    const container = side === 'left' ? this.el.leftTabContainer : this.el.rightTabContainer;
    const leftBtn = side === 'left' ? this.el.leftTabScrollLeft : this.el.rightTabScrollLeft;
    const rightBtn = side === 'left' ? this.el.leftTabScrollRight : this.el.rightTabScrollRight;

    leftBtn.disabled = container.scrollLeft <= 0;
    rightBtn.disabled = container.scrollLeft >= container.scrollWidth - container.clientWidth;
  }

  private onLeftInput(): void {
    this.saveCurrentTabContent('left');
    this.renderTabs('left');
    this.updateDiff();
  }

  private onRightInput(): void {
    this.saveCurrentTabContent('right');
    this.renderTabs('right');
    this.updateDiff();
  }

  private toggleTheme(): void {
    this.state.isDarkMode = !this.state.isDarkMode;
    localStorage.setItem('darkMode', String(this.state.isDarkMode));
    this.applyTheme();
  }

  private applyTheme(): void {
    document.body.classList.toggle('light-mode', !this.state.isDarkMode);
  }

  private toggleWrap(): void {
    this.state.isSoftWrap = !this.state.isSoftWrap;
    localStorage.setItem('softWrap', String(this.state.isSoftWrap));
    this.applyWrap();
  }

  private applyWrap(): void {
    const editors = [this.el.leftEditor, this.el.rightEditor, this.el.leftHighlight, this.el.rightHighlight];
    editors.forEach(el => el.classList.toggle('soft-wrap', this.state.isSoftWrap));
    this.el.wrapBtn.classList.toggle('active', this.state.isSoftWrap);

    requestAnimationFrame(() => {
      this.syncHeight(this.el.leftHighlight, this.el.leftEditor);
      this.syncHeight(this.el.rightHighlight, this.el.rightEditor);
    });
  }

  private toggleConnector(): void {
    this.state.showConnector = !this.state.showConnector;
    localStorage.setItem('showConnector', String(this.state.showConnector));
    this.applyConnectorVisibility();
  }

  private applyConnectorVisibility(): void {
    this.el.connectorBtn.classList.toggle('active', this.state.showConnector);
    if (this.state.showConnector) {
      this.drawConnectors();
    } else {
      while (this.el.connectorSvg.firstChild) {
        this.el.connectorSvg.removeChild(this.el.connectorSvg.firstChild);
      }
    }
  }

  private handleIndentChange(): void {
    this.state.indentSize = parseInt(this.el.indentSelect.value, 10);
    localStorage.setItem('indentSize', String(this.state.indentSize));
  }

  private handleKeyDown(e: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    e.shiftKey ? this.unindent(textarea) : this.indent(textarea);
  }

  private indent(textarea: HTMLTextAreaElement): void {
    const { selectionStart: start, selectionEnd: end, value: text } = textarea;
    const indent = ' '.repeat(this.state.indentSize);

    if (start === end) {
      textarea.value = text.slice(0, start) + indent + text.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + this.state.indentSize;
    } else {
      const lines = text.split('\n');
      let pos = 0, newStart = start, newEnd = end;

      for (let i = 0; i < lines.length; i++) {
        const lineStart = pos, lineEnd = pos + lines[i].length;
        if (lineEnd >= start && lineStart < end) {
          lines[i] = indent + lines[i];
          if (lineStart <= start) newStart += this.state.indentSize;
          if (lineStart < end) newEnd += this.state.indentSize;
        }
        pos = lineEnd + 1;
      }

      textarea.value = lines.join('\n');
      textarea.selectionStart = newStart;
      textarea.selectionEnd = newEnd;
    }
    textarea.dispatchEvent(new Event('input'));
  }

  private unindent(textarea: HTMLTextAreaElement): void {
    const { selectionStart: start, selectionEnd: end, value: text } = textarea;

    if (start === end) {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const before = text.slice(lineStart, start);
      let remove = 0;
      for (let i = before.length - 1; i >= 0 && remove < this.state.indentSize && before[i] === ' '; i--) {
        remove++;
      }
      if (remove > 0) {
        textarea.value = text.slice(0, start - remove) + text.slice(start);
        textarea.selectionStart = textarea.selectionEnd = start - remove;
        textarea.dispatchEvent(new Event('input'));
      }
    } else {
      const lines = text.split('\n');
      let pos = 0, newStart = start, newEnd = end;

      for (let i = 0; i < lines.length; i++) {
        const lineStart = pos, lineEnd = pos + lines[i].length;
        if (lineEnd >= start && lineStart < end) {
          let remove = 0;
          for (let j = 0; j < lines[i].length && j < this.state.indentSize && lines[i][j] === ' '; j++) {
            remove++;
          }
          if (remove > 0) {
            lines[i] = lines[i].slice(remove);
            if (lineStart <= start) newStart -= Math.min(remove, start - lineStart);
            if (lineStart < end) newEnd -= remove;
          }
        }
        pos = lineEnd + 1;
      }

      textarea.value = lines.join('\n');
      textarea.selectionStart = newStart;
      textarea.selectionEnd = newEnd;
      textarea.dispatchEvent(new Event('input'));
    }
  }

  private handleLeftScroll(): void {
    this.el.leftLineNumbers.scrollTop = this.el.leftContent.scrollTop;
    this.scheduleConnectorRedraw();
  }

  private handleRightScroll(): void {
    this.el.rightLineNumbers.scrollTop = this.el.rightContent.scrollTop;
    this.scheduleConnectorRedraw();
  }

  private scheduleConnectorRedraw(): void {
    if (this.state.scrollPending) return;
    this.state.scrollPending = true;
    requestAnimationFrame(() => {
      this.drawConnectors();
      this.state.scrollPending = false;
    });
  }

  private updateDiff(): void {
    const oldText = this.el.leftEditor.value;
    const newText = this.el.rightEditor.value;

    const vm = createViewModel(oldText, newText);
    this.state.diffResult = processViewModel(vm);

    this.updateEditor('left');
    this.updateEditor('right');
    this.updateStats();

    requestAnimationFrame(() => this.drawConnectors());
  }

  private updateEditor(side: 'left' | 'right'): void {
    const result = this.state.diffResult;
    if (!result) return;

    const isLeft = side === 'left';
    const highlight = isLeft ? this.el.leftHighlight : this.el.rightHighlight;
    const editor = isLeft ? this.el.leftEditor : this.el.rightEditor;
    const lineNumbers = isLeft ? this.el.leftLineNumbers : this.el.rightLineNumbers;

    const textareaLines = editor.value.split('\n');
    lineNumbers.innerHTML = textareaLines
      .map((_, i) => `<div class="line-number">${i + 1}</div>`)
      .join('');

    this.renderHighlights(highlight, editor, result, isLeft);
    this.syncHeight(highlight, editor);
  }

  private renderHighlights(
    highlight: HTMLDivElement,
    editor: HTMLTextAreaElement,
    result: ProcessedViewModel,
    isLeft: boolean
  ): void {
    const hasDiffs = result.lines.some(line => {
      const info = isLeft ? line.left : line.right;
      return info.kind !== LineKind.Context && info.kind !== LineKind.Blank;
    });

    if (!hasDiffs) {
      highlight.classList.remove('visible');
      editor.classList.remove('has-highlights');
      return;
    }

    highlight.classList.add('visible');
    editor.classList.add('has-highlights');

    const lineMap = new Map<number, { line: ProcessedLine; lineClass: string; highlights: InlineHighlight[] }>();
    for (const line of result.lines) {
      const leftInfo = line.left;
      const rightInfo = line.right;
      const info = isLeft ? leftInfo : rightInfo;

      if (info.kind === LineKind.Blank) continue;

      const lineClass = this.getLineClass(leftInfo.kind, rightInfo.kind, isLeft);
      const isModifiedPair = leftInfo.kind === LineKind.Removed && rightInfo.kind === LineKind.Added;
      const lineHighlights = isModifiedPair
        ? result.highlights.filter(h => h.row === line.index && h.isLeft === isLeft)
        : [];

      lineMap.set(info.lineNo, { line, lineClass, highlights: lineHighlights });
    }

    const textareaLines = editor.value.split('\n');
    const htmlParts: string[] = [];

    for (let i = 0; i < textareaLines.length; i++) {
      const lineNo = i + 1;
      const content = textareaLines[i];

      if (i > 0) htmlParts.push('\n');

      const lineInfo = lineMap.get(lineNo);
      const lineClass = lineInfo?.lineClass ?? '';
      const lineHighlights = lineInfo?.highlights ?? [];

      htmlParts.push(`<span class="hl-line ${lineClass}">`);

      if (lineHighlights.length > 0) {
        htmlParts.push(this.renderCharHighlights(content, lineHighlights, isLeft));
      } else {
        htmlParts.push(this.escapeHtml(content));
      }

      htmlParts.push('</span>');
    }

    highlight.innerHTML = htmlParts.join('');
  }

  private getLineClass(leftKind: number, rightKind: number, isLeft: boolean): string {
    if (leftKind === LineKind.Removed && rightKind === LineKind.Added) {
      return 'hl-modified';
    }

    if (isLeft) {
      if (leftKind === LineKind.Removed && rightKind === LineKind.Blank) {
        return 'hl-removed';
      }
    } else {
      if (rightKind === LineKind.Added && leftKind === LineKind.Blank) {
        return 'hl-added';
      }
    }

    return '';
  }

  private renderCharHighlights(
    content: string,
    highlights: InlineHighlight[],
    isLeft: boolean
  ): string {
    const sorted = [...highlights].sort((a, b) => a.start - b.start);
    const parts: string[] = [];
    let pos = 0;

    for (const h of sorted) {
      if (h.start > pos) {
        parts.push(this.escapeHtml(content.slice(pos, h.start)));
      }
      const cls = isLeft ? 'hl-char-removed' : 'hl-char-added';
      parts.push(`<span class="${cls}">${this.escapeHtml(content.slice(h.start, h.end))}</span>`);
      pos = h.end;
    }

    if (pos < content.length) {
      parts.push(this.escapeHtml(content.slice(pos)));
    }

    return parts.join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private syncHeight(highlight: HTMLDivElement, textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    void textarea.offsetHeight;
    const contentHeight = textarea.scrollHeight;
    const minHeight = textarea.parentElement?.clientHeight ?? 0;
    const height = Math.max(contentHeight, minHeight);
    textarea.style.height = `${height}px`;
    highlight.style.height = `${height}px`;
  }

  private updateStats(): void {
    const result = this.state.diffResult;
    if (!result) return;

    const removed = result.lines.filter(l => l.left.kind === LineKind.Removed).length;
    const added = result.lines.filter(l => l.right.kind === LineKind.Added).length;

    this.el.leftStats.innerHTML = removed > 0 ? `<span class="stat-removed">-${removed}</span>` : '';
    this.el.rightStats.innerHTML = added > 0 ? `<span class="stat-added">+${added}</span>` : '';
  }

  private buildConnectorBlocks(lines: ProcessedLine[]): ConnectorBlock[] {
    const blocks: ConnectorBlock[] = [];
    const rightUsed = new Set<number>();

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const leftKind = line.left.kind;
      const rightKind = line.right.kind;

      if (leftKind === LineKind.Context || leftKind === LineKind.Blank) {
        if (leftKind === LineKind.Context) rightUsed.add(i);
        i++;
        continue;
      }

      if (leftKind === LineKind.Removed) {
        const isModified = rightKind === LineKind.Added;
        const blockType = isModified ? 'modified' : 'removed';
        const startIndex = i;
        let endIndex = i;

        while (endIndex + 1 < lines.length) {
          const nextLine = lines[endIndex + 1];
          const nextLeftKind = nextLine.left.kind;
          const nextRightKind = nextLine.right.kind;
          const nextIsModified = nextLeftKind === LineKind.Removed && nextRightKind === LineKind.Added;
          const nextIsPureRemoved = nextLeftKind === LineKind.Removed && nextRightKind === LineKind.Blank;

          if ((blockType === 'modified' && nextIsModified) ||
              (blockType === 'removed' && nextIsPureRemoved)) {
            endIndex++;
          } else {
            break;
          }
        }

        for (let idx = startIndex; idx <= endIndex; idx++) {
          if (lines[idx].right.kind !== LineKind.Added || lines[idx].left.kind === LineKind.Removed) {
            rightUsed.add(idx);
          }
        }

        blocks.push({ type: blockType, startIndex, endIndex });
        i = endIndex + 1;
      } else {
        i++;
      }
    }

    i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (!rightUsed.has(i) && line.right.kind === LineKind.Added && line.left.kind === LineKind.Blank) {
        const startIndex = i;
        let endIndex = i;

        while (endIndex + 1 < lines.length) {
          const nextLine = lines[endIndex + 1];
          if (!rightUsed.has(endIndex + 1) &&
              nextLine.right.kind === LineKind.Added &&
              nextLine.left.kind === LineKind.Blank) {
            endIndex++;
          } else {
            break;
          }
        }

        blocks.push({ type: 'added', startIndex, endIndex });
        i = endIndex + 1;
      } else {
        i++;
      }
    }

    return blocks;
  }

  private drawConnectors(): void {
    const result = this.state.diffResult;
    if (!result || !this.state.showConnector) return;

    while (this.el.connectorSvg.firstChild) {
      this.el.connectorSvg.removeChild(this.el.connectorSvg.firstChild);
    }

    const viewportHeight = this.el.connectorContent.clientHeight;
    this.el.connectorSvg.setAttribute('width', String(SVG_WIDTH));
    this.el.connectorSvg.setAttribute('height', String(viewportHeight));
    this.el.connectorSvg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${viewportHeight}`);
    this.el.connectorSvg.setAttribute('preserveAspectRatio', 'none');

    const leftScroll = this.el.leftContent.scrollTop;
    const rightScroll = this.el.rightContent.scrollTop;

    const blocks = this.buildConnectorBlocks(result.lines);

    for (const block of blocks) {
      this.drawConnectorBlock(block, result.lines, leftScroll, rightScroll, viewportHeight);
    }
  }

  private drawConnectorBlock(
    block: ConnectorBlock,
    lines: ProcessedLine[],
    leftScroll: number,
    rightScroll: number,
    viewportHeight: number
  ): void {
    const leftPositions = this.getBlockDisplayPositions(lines, block, true);
    const rightPositions = this.getBlockDisplayPositions(lines, block, false);

    let leftStartY: number, leftEndY: number, rightStartY: number, rightEndY: number;

    if (block.type === 'added') {
      const insertionLineNo = this.getInsertionLineNo(lines, block.startIndex, true);
      const insertionPos = insertionLineNo - 1;
      leftStartY = PADDING_TOP + insertionPos * LINE_HEIGHT - leftScroll;
      leftEndY = leftStartY;
      rightStartY = PADDING_TOP + rightPositions.start * LINE_HEIGHT - rightScroll;
      rightEndY = PADDING_TOP + (rightPositions.end + 1) * LINE_HEIGHT - rightScroll;
    } else if (block.type === 'removed') {
      const deletionLineNo = this.getInsertionLineNo(lines, block.startIndex, false);
      const deletionPos = deletionLineNo - 1;
      leftStartY = PADDING_TOP + leftPositions.start * LINE_HEIGHT - leftScroll;
      leftEndY = PADDING_TOP + (leftPositions.end + 1) * LINE_HEIGHT - leftScroll;
      rightStartY = PADDING_TOP + deletionPos * LINE_HEIGHT - rightScroll;
      rightEndY = rightStartY;
    } else {
      leftStartY = PADDING_TOP + leftPositions.start * LINE_HEIGHT - leftScroll;
      leftEndY = PADDING_TOP + (leftPositions.end + 1) * LINE_HEIGHT - leftScroll;
      rightStartY = PADDING_TOP + rightPositions.start * LINE_HEIGHT - rightScroll;
      rightEndY = PADDING_TOP + (rightPositions.end + 1) * LINE_HEIGHT - rightScroll;
    }

    const minY = Math.min(leftStartY, rightStartY);
    const maxY = Math.max(leftEndY, rightEndY);
    if (maxY < 0 || minY > viewportHeight) return;

    this.drawConnectorShape(leftStartY, leftEndY, rightStartY, rightEndY, block.type);
  }

  private getBlockDisplayPositions(
    lines: ProcessedLine[],
    block: ConnectorBlock,
    isLeft: boolean
  ): { start: number; end: number } {
    let startLineNo = -1;
    let endLineNo = -1;

    for (let i = block.startIndex; i <= block.endIndex; i++) {
      const info = isLeft ? lines[i].left : lines[i].right;
      if (info.kind !== LineKind.Blank && info.lineNo > 0) {
        if (startLineNo === -1 || info.lineNo < startLineNo) {
          startLineNo = info.lineNo;
        }
        if (endLineNo === -1 || info.lineNo > endLineNo) {
          endLineNo = info.lineNo;
        }
      }
    }

    if (startLineNo === -1) {
      const insertionLineNo = this.getInsertionLineNo(lines, block.startIndex, isLeft);
      return { start: insertionLineNo - 1, end: insertionLineNo - 1 };
    }

    return { start: startLineNo - 1, end: endLineNo - 1 };
  }

  private getInsertionLineNo(lines: ProcessedLine[], index: number, isLeft: boolean): number {
    for (let i = index - 1; i >= 0; i--) {
      const info = isLeft ? lines[i].left : lines[i].right;
      if (info.kind !== LineKind.Blank && info.lineNo > 0) {
        return info.lineNo + 1;
      }
    }
    return 1;
  }

  private drawConnectorShape(
    leftTop: number,
    leftBottom: number,
    rightTop: number,
    rightBottom: number,
    type: 'added' | 'removed' | 'modified'
  ): void {
    const color = this.getConnectorColor(type);
    const cp1x = SVG_WIDTH * 0.4;
    const cp2x = SVG_WIDTH * 0.6;

    const fill = this.createSvgPath(
      `M 0,${leftTop} C ${cp1x},${leftTop} ${cp2x},${rightTop} ${SVG_WIDTH},${rightTop} ` +
      `L ${SVG_WIDTH},${rightBottom} C ${cp2x},${rightBottom} ${cp1x},${leftBottom} 0,${leftBottom} Z`,
      { fill: color, opacity: '0.3' }
    );

    const topBorder = this.createSvgPath(
      `M 0,${leftTop} C ${cp1x},${leftTop} ${cp2x},${rightTop} ${SVG_WIDTH},${rightTop}`,
      { stroke: color, 'stroke-width': '2', fill: 'none', opacity: '0.8' }
    );

    const bottomBorder = this.createSvgPath(
      `M 0,${leftBottom} C ${cp1x},${leftBottom} ${cp2x},${rightBottom} ${SVG_WIDTH},${rightBottom}`,
      { stroke: color, 'stroke-width': '2', fill: 'none', opacity: '0.8' }
    );

    this.el.connectorSvg.appendChild(fill);
    this.el.connectorSvg.appendChild(topBorder);
    this.el.connectorSvg.appendChild(bottomBorder);
  }

  private getConnectorColor(type: 'added' | 'removed' | 'modified'): string {
    const style = getComputedStyle(document.documentElement);
    switch (type) {
      case 'added': return style.getPropertyValue('--color-connector-added').trim();
      case 'removed': return style.getPropertyValue('--color-connector-removed').trim();
      default: return style.getPropertyValue('--color-connector-modified').trim();
    }
  }

  private createSvgPath(d: string, attrs: Record<string, string>): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    for (const [key, value] of Object.entries(attrs)) {
      path.setAttribute(key, value);
    }
    return path;
  }
}

init().then(() => new DiffEditor());
