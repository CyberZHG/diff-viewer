import type { Elements, State } from './types';
import { saveToStorage } from './storage';
import { renderTabs, updateTabUnsavedState, saveCurrentTabContent, type TabCallbacks } from './tabs';

export function setupDragDrop(
  wrapper: HTMLDivElement,
  side: 'left' | 'right',
  state: State,
  el: Elements,
  callbacks: TabCallbacks
): void {
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
      loadFile(files[0], side, state, el, callbacks);
    }
  });
}

export function loadFile(
  file: File,
  side: 'left' | 'right',
  state: State,
  el: Elements,
  callbacks: TabCallbacks
): void {
  const reader = new FileReader();
  reader.onload = () => {
    const content = reader.result as string;
    const editor = side === 'left' ? el.leftEditor : el.rightEditor;
    editor.value = content;

    const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
    const activeId = side === 'left' ? state.leftActiveTabId : state.rightActiveTabId;
    const tab = tabs.find(t => t.id === activeId);
    if (tab) {
      tab.name = file.name;
      tab.content = content;
      renderTabs(state, el, side, callbacks);
    }

    callbacks.onContentChange();
  };
  reader.readAsText(file);
}

export function handleFileUpload(
  e: Event,
  side: 'left' | 'right',
  state: State,
  el: Elements,
  callbacks: TabCallbacks
): void {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length > 0) {
    loadFile(files[0], side, state, el, callbacks);
  }
  input.value = '';
}

export function saveCurrentTab(
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
    tab.savedContent = editor.value;
  }

  saveToStorage(state);
  updateTabUnsavedState(state, el, side);
}

export function downloadCurrentTab(
  state: State,
  el: Elements,
  side: 'left' | 'right'
): void {
  const tabs = side === 'left' ? state.leftTabs : state.rightTabs;
  const activeId = side === 'left' ? state.leftActiveTabId : state.rightActiveTabId;
  const editor = side === 'left' ? el.leftEditor : el.rightEditor;

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

export function clearEditor(
  state: State,
  el: Elements,
  side: 'left' | 'right',
  callbacks: TabCallbacks
): void {
  const editor = side === 'left' ? el.leftEditor : el.rightEditor;
  editor.value = '';
  saveCurrentTabContent(state, el, side);
  updateTabUnsavedState(state, el, side);
  callbacks.onContentChange();
}
