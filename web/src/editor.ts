// @ts-ignore
import { LineKind, type ProcessedViewModel, type InlineHighlight } from '../../wasm/index.js';
import type { Elements, State } from './types';
import { escapeHtml } from './utils';

export function updateEditor(
  state: State,
  el: Elements,
  side: 'left' | 'right'
): void {
  const result = state.diffResult;
  if (!result) return;

  const isLeft = side === 'left';
  const highlight = isLeft ? el.leftHighlight : el.rightHighlight;
  const editor = isLeft ? el.leftEditor : el.rightEditor;
  const lineNumbers = isLeft ? el.leftLineNumbers : el.rightLineNumbers;

  const textareaLines = editor.value.split('\n');
  lineNumbers.innerHTML = textareaLines
    .map((_, i) => `<div class="line-number">${i + 1}</div>`)
    .join('');

  renderHighlights(highlight, editor, result, isLeft);
  syncHeight(highlight, editor);
}

function renderHighlights(
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

  const lineMap = new Map<number, { lineClass: string; highlights: InlineHighlight[] }>();
  for (const line of result.lines) {
    const leftInfo = line.left;
    const rightInfo = line.right;
    const info = isLeft ? leftInfo : rightInfo;

    if (info.kind === LineKind.Blank) continue;

    const lineClass = getLineClass(leftInfo.kind, rightInfo.kind, isLeft);
    const isModifiedPair = leftInfo.kind === LineKind.Removed && rightInfo.kind === LineKind.Added;
    const lineHighlights = isModifiedPair
      ? result.highlights.filter(h => h.row === line.index && h.isLeft === isLeft)
      : [];

    lineMap.set(info.lineNo, { lineClass, highlights: lineHighlights });
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
      htmlParts.push(renderCharHighlights(content, lineHighlights, isLeft));
    } else {
      htmlParts.push(escapeHtml(content));
    }

    htmlParts.push('</span>');
  }

  highlight.innerHTML = htmlParts.join('');
}

function getLineClass(leftKind: number, rightKind: number, isLeft: boolean): string {
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

function renderCharHighlights(
  content: string,
  highlights: InlineHighlight[],
  isLeft: boolean
): string {
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let pos = 0;

  for (const h of sorted) {
    if (h.start > pos) {
      parts.push(escapeHtml(content.slice(pos, h.start)));
    }
    const cls = isLeft ? 'hl-char-removed' : 'hl-char-added';
    parts.push(`<span class="${cls}">${escapeHtml(content.slice(h.start, h.end))}</span>`);
    pos = h.end;
  }

  if (pos < content.length) {
    parts.push(escapeHtml(content.slice(pos)));
  }

  return parts.join('');
}

export function syncHeight(highlight: HTMLDivElement, textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  void textarea.offsetHeight;
  const contentHeight = textarea.scrollHeight;
  const minHeight = textarea.parentElement?.clientHeight ?? 0;
  const height = Math.max(contentHeight, minHeight);
  textarea.style.height = `${height}px`;
  highlight.style.height = `${height}px`;
}

export function updateStats(state: State, el: Elements): void {
  const result = state.diffResult;
  if (!result) return;

  const removed = result.lines.filter(l => l.left.kind === LineKind.Removed).length;
  const added = result.lines.filter(l => l.right.kind === LineKind.Added).length;

  el.leftStats.innerHTML = removed > 0 ? `<span class="stat-removed">-${removed}</span>` : '';
  el.rightStats.innerHTML = added > 0 ? `<span class="stat-added">+${added}</span>` : '';
}

export function indent(textarea: HTMLTextAreaElement, indentSize: number): void {
  const { selectionStart: start, selectionEnd: end, value: text } = textarea;
  const indentStr = ' '.repeat(indentSize);

  if (start === end) {
    textarea.value = text.slice(0, start) + indentStr + text.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + indentSize;
  } else {
    const lines = text.split('\n');
    let pos = 0, newStart = start, newEnd = end;

    for (let i = 0; i < lines.length; i++) {
      const lineStart = pos, lineEnd = pos + lines[i].length;
      if (lineEnd >= start && lineStart < end) {
        lines[i] = indentStr + lines[i];
        if (lineStart <= start) newStart += indentSize;
        if (lineStart < end) newEnd += indentSize;
      }
      pos = lineEnd + 1;
    }

    textarea.value = lines.join('\n');
    textarea.selectionStart = newStart;
    textarea.selectionEnd = newEnd;
  }
  textarea.dispatchEvent(new Event('input'));
}

export function unindent(textarea: HTMLTextAreaElement, indentSize: number): void {
  const { selectionStart: start, selectionEnd: end, value: text } = textarea;

  if (start === end) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const before = text.slice(lineStart, start);
    let remove = 0;
    for (let i = before.length - 1; i >= 0 && remove < indentSize && before[i] === ' '; i--) {
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
        for (let j = 0; j < lines[i].length && j < indentSize && lines[i][j] === ' '; j++) {
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
