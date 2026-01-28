import type { TabData, Elements, State } from './types';
import { generateId } from './utils';
import { saveToStorage } from './storage';

export interface TabCallbacks {
  onTabSelect: (side: 'left' | 'right', tabId: string) => void;
  onTabClose: (side: 'left' | 'right', tabId: string) => void;
  onTabAdd: (side: 'left' | 'right') => void;
  onContentChange: () => void;
}

export function isTabUnsaved(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  tab: TabData
): boolean {
  if (tab.savedContent === null) {
    return true;
  }
  const activeId = side === 'left' ? state.leftActiveTabId : state.rightActiveTabId;
  const editor = side === 'left' ? el.leftEditor : el.rightEditor;
  const currentContent = tab.id === activeId ? editor.value : tab.content;
  return currentContent !== tab.savedContent;
}

export function renderTabs(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  callbacks: TabCallbacks
): void {
  const container = side === 'left' ? el.leftTabContainer : el.rightTabContainer;
  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
  const activeId = side === 'left' ? state.leftActiveTabId : state.rightActiveTabId;

  container.innerHTML = '';

  for (const tab of tabs) {
    const tabEl = document.createElement('div');
    const isActive = tab.id === activeId;
    tabEl.className = `tab${isActive ? ' active' : ''}`;
    tabEl.dataset.id = tab.id;
    tabEl.setAttribute('role', 'tab');
    tabEl.setAttribute('aria-selected', String(isActive));
    tabEl.setAttribute('tabindex', isActive ? '0' : '-1');

    const unsaved = isTabUnsaved(state, el, side, tab);

    const nameEl = document.createElement('span');
    nameEl.className = 'tab-name';
    nameEl.textContent = unsaved ? `*${tab.name}` : tab.name;
    tabEl.appendChild(nameEl);

    const closeEl = document.createElement('span');
    closeEl.className = 'tab-close';
    closeEl.setAttribute('role', 'button');
    closeEl.setAttribute('aria-label', `Close ${tab.name}`);
    closeEl.setAttribute('tabindex', '0');
    closeEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onTabClose(side, tab.id);
    });
    closeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        callbacks.onTabClose(side, tab.id);
      }
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
          callbacks.onTabSelect(side, tab.id);
        }
      }, 200);
    });

    tabEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }
      startEditTabName(state, el, side, tab.id, nameEl, callbacks);
    });

    tabEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        startEditTabName(state, el, side, tab.id, nameEl, callbacks);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        navigateTab(state, el, side, e.key === 'ArrowLeft' ? -1 : 1, callbacks);
      }
    });

    container.appendChild(tabEl);
  }

  updateTabScrollButtons(el, side);
}

export function updateTabUnsavedState(
  state: State,
  el: Elements,
  side: 'left' | 'right'
): void {
  const container = side === 'left' ? el.leftTabContainer : el.rightTabContainer;
  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;

  const tabElements = container.querySelectorAll('.tab');
  tabElements.forEach((tabEl, index) => {
    if (index < tabs.length) {
      const tab = tabs[index];
      const unsaved = isTabUnsaved(state, el, side, tab);
      const nameEl = tabEl.querySelector('.tab-name');
      if (nameEl) {
        nameEl.textContent = unsaved ? `*${tab.name}` : tab.name;
      }
    }
  });
}

function navigateTab(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  direction: number,
  callbacks: TabCallbacks
): void {
  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
  const activeId = side === 'left' ? state.leftActiveTabId : state.rightActiveTabId;
  const currentIndex = tabs.findIndex(t => t.id === activeId);
  const newIndex = Math.max(0, Math.min(tabs.length - 1, currentIndex + direction));

  if (newIndex !== currentIndex) {
    callbacks.onTabSelect(side, tabs[newIndex].id);
    const container = side === 'left' ? el.leftTabContainer : el.rightTabContainer;
    const newTabEl = container.children[newIndex] as HTMLElement;
    newTabEl?.focus();
  }
}

export function addTab(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  callbacks: TabCallbacks
): void {
  saveCurrentTabContent(state, el, side);

  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
  const newTab: TabData = {
    id: generateId(),
    name: 'Untitled',
    content: '',
    savedContent: null,
  };
  tabs.push(newTab);

  if (side === 'left') {
    state.leftActiveTabId = newTab.id;
  } else {
    state.rightActiveTabId = newTab.id;
  }

  loadActiveTabContent(state, el);
  renderTabs(state, el, side, callbacks);
  callbacks.onContentChange();

  const container = side === 'left' ? el.leftTabContainer : el.rightTabContainer;
  requestAnimationFrame(() => {
    container.scrollLeft = container.scrollWidth;
  });
}

export function closeTab(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  tabId: string,
  callbacks: TabCallbacks
): void {
  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
  const activeId = side === 'left' ? state.leftActiveTabId : state.rightActiveTabId;

  if (tabs.length <= 1) {
    const tab = tabs[0];
    tab.content = '';
    tab.savedContent = null;
    tab.name = 'Untitled';
    const editor = side === 'left' ? el.leftEditor : el.rightEditor;
    editor.value = '';
    renderTabs(state, el, side, callbacks);
    callbacks.onContentChange();
    return;
  }

  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  tabs.splice(index, 1);

  if (activeId === tabId) {
    const newActiveIndex = Math.min(index, tabs.length - 1);
    if (side === 'left') {
      state.leftActiveTabId = tabs[newActiveIndex].id;
    } else {
      state.rightActiveTabId = tabs[newActiveIndex].id;
    }
    loadActiveTabContent(state, el);
  }

  renderTabs(state, el, side, callbacks);
  saveToStorage(state);
  callbacks.onContentChange();
}

export function selectTab(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  tabId: string,
  callbacks: TabCallbacks
): void {
  saveCurrentTabContent(state, el, side);

  if (side === 'left') {
    state.leftActiveTabId = tabId;
  } else {
    state.rightActiveTabId = tabId;
  }

  loadActiveTabContent(state, el);
  renderTabs(state, el, side, callbacks);
  callbacks.onContentChange();
}

export function saveCurrentTabContent(
  state: State,
  el: Elements,
  side: 'left' | 'right'
): void {
  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
  const activeId = side === 'left' ? state.leftActiveTabId : state.rightActiveTabId;
  const editor = side === 'left' ? el.leftEditor : el.rightEditor;

  const tab = tabs.find(t => t.id === activeId);
  if (tab) {
    tab.content = editor.value;
  }
}

export function loadActiveTabContent(state: State, el: Elements): void {
  const leftTab = state.leftTabs.find(t => t.id === state.leftActiveTabId);
  const rightTab = state.rightTabs.find(t => t.id === state.rightActiveTabId);
  el.leftEditor.value = leftTab?.content ?? '';
  el.rightEditor.value = rightTab?.content ?? '';
}

function startEditTabName(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  tabId: string,
  nameEl: HTMLSpanElement,
  callbacks: TabCallbacks
): void {
  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tab-name-input';
  input.value = tab.name;
  input.setAttribute('aria-label', 'Tab name');

  let isFinishing = false;
  const finishEdit = () => {
    if (isFinishing) return;
    isFinishing = true;

    const newName = input.value.trim() || 'Untitled';
    tab.name = newName;
    saveToStorage(state);
    renderTabs(state, el, side, callbacks);
  };

  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isFinishing = true;
      renderTabs(state, el, side, callbacks);
    }
  });

  nameEl.replaceWith(input);
  input.focus();
  input.select();
}

export function scrollTabs(
  el: Elements,
  side: 'left' | 'right',
  delta: number
): void {
  const container = side === 'left' ? el.leftTabContainer : el.rightTabContainer;
  container.scrollBy({ left: delta, behavior: 'smooth' });
  setTimeout(() => updateTabScrollButtons(el, side), 200);
}

export function handleTabWheel(
  el: Elements,
  e: WheelEvent,
  side: 'left' | 'right'
): void {
  e.preventDefault();
  const container = side === 'left' ? el.leftTabContainer : el.rightTabContainer;
  container.scrollLeft += e.deltaY;
  updateTabScrollButtons(el, side);
}

function updateTabScrollButtons(el: Elements, side: 'left' | 'right'): void {
  const container = side === 'left' ? el.leftTabContainer : el.rightTabContainer;
  const leftBtn = side === 'left' ? el.leftTabScrollLeft : el.rightTabScrollLeft;
  const rightBtn = side === 'left' ? el.leftTabScrollRight : el.rightTabScrollRight;

  leftBtn.disabled = container.scrollLeft <= 0;
  rightBtn.disabled = container.scrollLeft >= container.scrollWidth - container.clientWidth;
}
