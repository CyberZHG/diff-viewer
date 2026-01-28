export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function queryElements() {
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
    syncScrollBtn: document.getElementById('syncScrollBtn') as HTMLButtonElement,
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
