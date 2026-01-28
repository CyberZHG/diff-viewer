// @ts-ignore
import { createViewModel, processViewModel } from '../../wasm/index.js';
import type { Elements, State } from './types';
import { DIFF_DEBOUNCE_MS } from './constants';
import { queryElements } from './utils';
import { loadFromStorage } from './storage';
import {
  renderTabs,
  updateTabUnsavedState,
  addTab,
  closeTab,
  selectTab,
  saveCurrentTabContent,
  loadActiveTabContent,
  scrollTabs,
  handleTabWheel,
  type TabCallbacks,
} from './tabs';
import { drawConnectors, handleConnectorClick } from './connector';
import { updateEditor, syncHeight, updateStats, indent, unindent } from './editor';
import {
  setupDragDrop,
  handleFileUpload,
  saveCurrentTab,
  downloadCurrentTab,
  clearEditor,
} from './file-handler';

export class DiffEditor {
  private el: Elements;
  private state: State;
  private tabCallbacks: TabCallbacks;

  constructor() {
    this.state = {
      isDarkMode: localStorage.getItem('darkMode') !== 'false',
      isSoftWrap: localStorage.getItem('softWrap') === 'true',
      showConnector: localStorage.getItem('showConnector') !== 'false',
      syncScroll: localStorage.getItem('syncScroll') === 'true',
      indentSize: parseInt(localStorage.getItem('indentSize') ?? '4', 10),
      diffResult: null,
      scrollPending: false,
      resizeTimeout: null,
      diffDebounceTimeout: null,
      leftTabs: [],
      rightTabs: [],
      leftActiveTabId: '',
      rightActiveTabId: '',
      isScrolling: false,
      lastFocusedSide: 'left',
    };

    this.el = queryElements();

    this.tabCallbacks = {
      onTabSelect: (side, tabId) => this.handleTabSelect(side, tabId),
      onTabClose: (side, tabId) => this.handleTabClose(side, tabId),
      onTabAdd: (side) => this.handleTabAdd(side),
      onContentChange: () => this.updateDiffDebounced(),
    };

    loadFromStorage(this.state);
    this.setup();
  }

  private setup(): void {
    this.el.indentSelect.value = String(this.state.indentSize);

    this.bindEvents();
    this.applyTheme();
    this.applyWrap();
    this.applyConnectorVisibility();
    this.applySyncScroll();
    loadActiveTabContent(this.state, this.el);
    renderTabs(this.state, this.el, 'left', this.tabCallbacks);
    renderTabs(this.state, this.el, 'right', this.tabCallbacks);
    this.updateDiffImmediate();

    requestAnimationFrame(() => {
      syncHeight(this.el.leftHighlight, this.el.leftEditor);
      syncHeight(this.el.rightHighlight, this.el.rightEditor);
    });
  }

  private bindEvents(): void {
    this.el.leftEditor.addEventListener('input', () => this.onLeftInput());
    this.el.rightEditor.addEventListener('input', () => this.onRightInput());
    this.el.leftEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, this.el.leftEditor));
    this.el.rightEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, this.el.rightEditor));
    this.el.leftEditor.addEventListener('focus', () => this.state.lastFocusedSide = 'left');
    this.el.rightEditor.addEventListener('focus', () => this.state.lastFocusedSide = 'right');
    this.el.leftContent.addEventListener('scroll', () => this.handleLeftScroll());
    this.el.rightContent.addEventListener('scroll', () => this.handleRightScroll());
    this.el.wrapBtn.addEventListener('click', () => this.toggleWrap());
    this.el.themeBtn.addEventListener('click', () => this.toggleTheme());
    this.el.connectorBtn.addEventListener('click', () => this.toggleConnector());
    this.el.syncScrollBtn.addEventListener('click', () => this.toggleSyncScroll());
    this.el.indentSelect.addEventListener('change', () => this.handleIndentChange());

    this.el.leftTabAdd.addEventListener('click', () => this.handleTabAdd('left'));
    this.el.rightTabAdd.addEventListener('click', () => this.handleTabAdd('right'));
    this.el.leftTabScrollLeft.addEventListener('click', () => scrollTabs(this.el, 'left', -100));
    this.el.leftTabScrollRight.addEventListener('click', () => scrollTabs(this.el, 'left', 100));
    this.el.rightTabScrollLeft.addEventListener('click', () => scrollTabs(this.el, 'right', -100));
    this.el.rightTabScrollRight.addEventListener('click', () => scrollTabs(this.el, 'right', 100));
    this.el.leftTabContainer.addEventListener('wheel', (e) => handleTabWheel(this.el, e, 'left'));
    this.el.rightTabContainer.addEventListener('wheel', (e) => handleTabWheel(this.el, e, 'right'));

    this.el.leftSave.addEventListener('click', () => saveCurrentTab(this.state, this.el, 'left'));
    this.el.rightSave.addEventListener('click', () => saveCurrentTab(this.state, this.el, 'right'));
    this.el.leftDownload.addEventListener('click', () => downloadCurrentTab(this.state, this.el, 'left'));
    this.el.rightDownload.addEventListener('click', () => downloadCurrentTab(this.state, this.el, 'right'));
    this.el.leftUpload.addEventListener('click', () => this.el.leftFileInput.click());
    this.el.rightUpload.addEventListener('click', () => this.el.rightFileInput.click());
    this.el.leftFileInput.addEventListener('change', (e) => handleFileUpload(e, 'left', this.state, this.el, this.tabCallbacks));
    this.el.rightFileInput.addEventListener('change', (e) => handleFileUpload(e, 'right', this.state, this.el, this.tabCallbacks));
    this.el.leftClear.addEventListener('click', () => clearEditor(this.state, this.el, 'left', this.tabCallbacks));
    this.el.rightClear.addEventListener('click', () => clearEditor(this.state, this.el, 'right', this.tabCallbacks));

    setupDragDrop(this.el.leftWrapper, 'left', this.state, this.el, this.tabCallbacks);
    setupDragDrop(this.el.rightWrapper, 'right', this.state, this.el, this.tabCallbacks);

    this.el.connectorContent.addEventListener('click', (e) => handleConnectorClick(e, this.state, this.el));

    document.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));

    window.addEventListener('resize', () => {
      if (this.state.resizeTimeout) clearTimeout(this.state.resizeTimeout);
      this.state.resizeTimeout = window.setTimeout(() => {
        if (this.state.isSoftWrap) {
          syncHeight(this.el.leftHighlight, this.el.leftEditor);
          syncHeight(this.el.rightHighlight, this.el.rightEditor);
        }
        drawConnectors(this.state, this.el);
      }, 100);
    });
  }

  private handleGlobalKeyDown(e: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.key === 's') {
      e.preventDefault();
      saveCurrentTab(this.state, this.el, 'left');
      saveCurrentTab(this.state, this.el, 'right');
    } else if (modKey && e.key === 't') {
      e.preventDefault();
      this.handleTabAdd(this.state.lastFocusedSide);
    } else if (modKey && e.key === 'w') {
      e.preventDefault();
      const side = this.state.lastFocusedSide;
      const activeId = side === 'left' ? this.state.leftActiveTabId : this.state.rightActiveTabId;
      this.handleTabClose(side, activeId);
    }
  }

  private handleTabSelect(side: 'left' | 'right', tabId: string): void {
    selectTab(this.state, this.el, side, tabId, this.tabCallbacks);
  }

  private handleTabClose(side: 'left' | 'right', tabId: string): void {
    closeTab(this.state, this.el, side, tabId, this.tabCallbacks);
  }

  private handleTabAdd(side: 'left' | 'right'): void {
    addTab(this.state, this.el, side, this.tabCallbacks);
  }

  private onLeftInput(): void {
    saveCurrentTabContent(this.state, this.el, 'left');
    updateTabUnsavedState(this.state, this.el, 'left');
    this.updateDiffDebounced();
  }

  private onRightInput(): void {
    saveCurrentTabContent(this.state, this.el, 'right');
    updateTabUnsavedState(this.state, this.el, 'right');
    this.updateDiffDebounced();
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
    this.el.wrapBtn.setAttribute('aria-pressed', String(this.state.isSoftWrap));

    requestAnimationFrame(() => {
      syncHeight(this.el.leftHighlight, this.el.leftEditor);
      syncHeight(this.el.rightHighlight, this.el.rightEditor);
    });
  }

  private toggleConnector(): void {
    this.state.showConnector = !this.state.showConnector;
    localStorage.setItem('showConnector', String(this.state.showConnector));
    this.applyConnectorVisibility();
  }

  private applyConnectorVisibility(): void {
    this.el.connectorBtn.classList.toggle('active', this.state.showConnector);
    this.el.connectorBtn.setAttribute('aria-pressed', String(this.state.showConnector));
    if (this.state.showConnector) {
      drawConnectors(this.state, this.el);
    } else {
      while (this.el.connectorSvg.firstChild) {
        this.el.connectorSvg.removeChild(this.el.connectorSvg.firstChild);
      }
    }
  }

  private toggleSyncScroll(): void {
    this.state.syncScroll = !this.state.syncScroll;
    localStorage.setItem('syncScroll', String(this.state.syncScroll));
    this.applySyncScroll();
  }

  private applySyncScroll(): void {
    this.el.syncScrollBtn.classList.toggle('active', this.state.syncScroll);
    this.el.syncScrollBtn.setAttribute('aria-pressed', String(this.state.syncScroll));
  }

  private handleIndentChange(): void {
    this.state.indentSize = parseInt(this.el.indentSelect.value, 10);
    localStorage.setItem('indentSize', String(this.state.indentSize));
  }

  private handleKeyDown(e: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    e.shiftKey ? unindent(textarea, this.state.indentSize) : indent(textarea, this.state.indentSize);
  }

  private handleLeftScroll(): void {
    this.el.leftLineNumbers.scrollTop = this.el.leftContent.scrollTop;

    if (this.state.syncScroll && !this.state.isScrolling) {
      this.state.isScrolling = true;
      this.el.rightContent.scrollTop = this.el.leftContent.scrollTop;
      this.el.rightLineNumbers.scrollTop = this.el.leftContent.scrollTop;
      requestAnimationFrame(() => {
        this.state.isScrolling = false;
      });
    }

    this.scheduleConnectorRedraw();
  }

  private handleRightScroll(): void {
    this.el.rightLineNumbers.scrollTop = this.el.rightContent.scrollTop;

    if (this.state.syncScroll && !this.state.isScrolling) {
      this.state.isScrolling = true;
      this.el.leftContent.scrollTop = this.el.rightContent.scrollTop;
      this.el.leftLineNumbers.scrollTop = this.el.rightContent.scrollTop;
      requestAnimationFrame(() => {
        this.state.isScrolling = false;
      });
    }

    this.scheduleConnectorRedraw();
  }

  private scheduleConnectorRedraw(): void {
    if (this.state.scrollPending) return;
    this.state.scrollPending = true;
    requestAnimationFrame(() => {
      drawConnectors(this.state, this.el);
      this.state.scrollPending = false;
    });
  }

  private updateDiffDebounced(): void {
    if (this.state.diffDebounceTimeout) {
      clearTimeout(this.state.diffDebounceTimeout);
    }
    this.state.diffDebounceTimeout = window.setTimeout(() => {
      this.updateDiffImmediate();
    }, DIFF_DEBOUNCE_MS);
  }

  private updateDiffImmediate(): void {
    const oldText = this.el.leftEditor.value;
    const newText = this.el.rightEditor.value;

    const vm = createViewModel(oldText, newText);
    this.state.diffResult = processViewModel(vm);

    updateEditor(this.state, this.el, 'left');
    updateEditor(this.state, this.el, 'right');
    updateStats(this.state, this.el);

    requestAnimationFrame(() => drawConnectors(this.state, this.el));
  }
}
