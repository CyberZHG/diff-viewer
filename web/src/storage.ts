import type { TabData, StorageData, State } from './types';
import { STORAGE_KEY, MAX_STORAGE_SIZE } from './constants';
import { generateId } from './utils';

export function loadFromStorage(state: State): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: StorageData = JSON.parse(stored);
      state.leftTabs = data.leftTabs || [];
      state.rightTabs = data.rightTabs || [];
      state.leftActiveTabId = data.leftActiveTab || '';
      state.rightActiveTabId = data.rightActiveTab || '';
    }
  } catch {
  }

  for (const tab of state.leftTabs) {
    if (tab.savedContent === undefined) {
      tab.savedContent = tab.content;
    }
  }
  for (const tab of state.rightTabs) {
    if (tab.savedContent === undefined) {
      tab.savedContent = tab.content;
    }
  }

  if (state.leftTabs.length === 0) {
    const tab: TabData = { id: generateId(), name: 'Untitled', content: '', savedContent: null };
    state.leftTabs.push(tab);
    state.leftActiveTabId = tab.id;
  }
  if (state.rightTabs.length === 0) {
    const tab: TabData = { id: generateId(), name: 'Untitled', content: '', savedContent: null };
    state.rightTabs.push(tab);
    state.rightActiveTabId = tab.id;
  }

  if (!state.leftTabs.find(t => t.id === state.leftActiveTabId)) {
    state.leftActiveTabId = state.leftTabs[0].id;
  }
  if (!state.rightTabs.find(t => t.id === state.rightActiveTabId)) {
    state.rightActiveTabId = state.rightTabs[0].id;
  }
}

export function saveToStorage(state: State): void {
  const data: StorageData = {
    leftTabs: state.leftTabs,
    rightTabs: state.rightTabs,
    leftActiveTab: state.leftActiveTabId,
    rightActiveTab: state.rightActiveTabId,
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
