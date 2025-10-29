// @ts-ignore
import { init, createViewModel, processViewModel, LineKind, type ProcessedViewModel, type ProcessedLine, type Connector } from '../wasm/index.js';

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
  wrapBtn: HTMLButtonElement;
  themeBtn: HTMLButtonElement;
  indentSelect: HTMLSelectElement;
}

interface State {
  isDarkMode: boolean;
  isSoftWrap: boolean;
  indentSize: number;
  diffResult: ProcessedViewModel | null;
  scrollPending: boolean;
  resizeTimeout: number | null;
}

const LINE_HEIGHT = 20;
const PADDING_TOP = 8;
const SVG_WIDTH = 48;

const SAMPLE_OLD = `aaa
bcb
ddd`;

const SAMPLE_NEW = `aaa
bbb
ddd`;

class DiffEditor {
  private el: Elements;
  private state: State;

  constructor() {
    this.state = {
      isDarkMode: localStorage.getItem('darkMode') !== 'false',
      isSoftWrap: localStorage.getItem('softWrap') === 'true',
      indentSize: parseInt(localStorage.getItem('indentSize') ?? '4', 10),
      diffResult: null,
      scrollPending: false,
      resizeTimeout: null,
    };

    this.el = this.queryElements();
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
      wrapBtn: document.getElementById('wrapBtn') as HTMLButtonElement,
      themeBtn: document.getElementById('themeBtn') as HTMLButtonElement,
      indentSelect: document.getElementById('indentSelect') as HTMLSelectElement,
    };
  }

  private setup(): void {
    this.el.leftEditor.value = SAMPLE_OLD;
    this.el.rightEditor.value = SAMPLE_NEW;
    this.el.indentSelect.value = String(this.state.indentSize);

    this.bindEvents();
    this.applyTheme();
    this.applyWrap();
    this.updateDiff();

    requestAnimationFrame(() => {
      this.syncHeight(this.el.leftHighlight, this.el.leftEditor);
      this.syncHeight(this.el.rightHighlight, this.el.rightEditor);
    });
  }

  private bindEvents(): void {
    this.el.leftEditor.addEventListener('input', () => this.updateDiff());
    this.el.rightEditor.addEventListener('input', () => this.updateDiff());
    this.el.leftEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, this.el.leftEditor));
    this.el.rightEditor.addEventListener('keydown', (e) => this.handleKeyDown(e, this.el.rightEditor));
    this.el.leftContent.addEventListener('scroll', () => this.handleLeftScroll());
    this.el.rightContent.addEventListener('scroll', () => this.handleRightScroll());
    this.el.wrapBtn.addEventListener('click', () => this.toggleWrap());
    this.el.themeBtn.addEventListener('click', () => this.toggleTheme());
    this.el.indentSelect.addEventListener('change', () => this.handleIndentChange());

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

    const relevantLines = result.lines.filter(line => {
      const info = isLeft ? line.left : line.right;
      return info.kind !== LineKind.Blank;
    });

    lineNumbers.innerHTML = relevantLines
      .map(line => {
        const info = isLeft ? line.left : line.right;
        return `<div class="line-number">${info.lineNo || ''}</div>`;
      })
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

    const htmlParts: string[] = [];
    let first = true;

    for (const line of result.lines) {
      const info = isLeft ? line.left : line.right;
      if (info.kind === LineKind.Blank) continue;

      if (!first) htmlParts.push('\n');
      first = false;

      const lineClass = this.getLineClass(info.kind);
      const lineHighlights = result.highlights.filter(h => h.row === line.index && h.isLeft === isLeft);

      htmlParts.push(`<span class="hl-line ${lineClass}">`);

      if (lineHighlights.length > 0) {
        htmlParts.push(this.renderCharHighlights(info.content, lineHighlights, isLeft));
      } else {
        htmlParts.push(this.escapeHtml(info.content));
      }

      htmlParts.push('</span>');
    }

    highlight.innerHTML = htmlParts.join('');
  }

  private renderCharHighlights(
    content: string,
    highlights: ProcessedViewModel['highlights'],
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

  private getLineClass(kind: number): string {
    switch (kind) {
      case LineKind.Added: return 'hl-added';
      case LineKind.Removed: return 'hl-removed';
      default: return '';
    }
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

  private drawConnectors(): void {
    const result = this.state.diffResult;
    if (!result) return;

    while (this.el.connectorSvg.firstChild) {
      this.el.connectorSvg.removeChild(this.el.connectorSvg.firstChild);
    }

    const viewportHeight = this.el.connectorContent.clientHeight;
    this.el.connectorSvg.setAttribute('width', String(SVG_WIDTH));
    this.el.connectorSvg.setAttribute('height', String(viewportHeight));
    this.el.connectorSvg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${viewportHeight}`);

    const leftScroll = this.el.leftContent.scrollTop;
    const rightScroll = this.el.rightContent.scrollTop;

    for (const conn of result.connectors) {
      this.drawConnector(conn, leftScroll, rightScroll, viewportHeight, result.lines);
    }
  }

  private drawConnector(
    conn: Connector,
    leftScroll: number,
    rightScroll: number,
    viewportHeight: number,
    lines: ProcessedLine[]
  ): void {
    const leftTopRow = this.getDisplayRow(lines, conn.top, true);
    const leftBottomRow = this.getDisplayRow(lines, conn.bottom, true);
    const rightTopRow = this.getDisplayRow(lines, conn.top, false);
    const rightBottomRow = this.getDisplayRow(lines, conn.bottom, false);

    const leftTop = PADDING_TOP + leftTopRow * LINE_HEIGHT - leftScroll;
    const leftBottom = PADDING_TOP + (leftBottomRow + 1) * LINE_HEIGHT - leftScroll;
    const rightTop = PADDING_TOP + rightTopRow * LINE_HEIGHT - rightScroll;
    const rightBottom = PADDING_TOP + (rightBottomRow + 1) * LINE_HEIGHT - rightScroll;

    const minY = Math.min(leftTop, rightTop);
    const maxY = Math.max(leftBottom, rightBottom);
    if (maxY < 0 || minY > viewportHeight) return;

    const type = this.getConnectorType(conn, lines);
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

  private getDisplayRow(lines: ProcessedLine[], viewRow: number, isLeft: boolean): number {
    let displayRow = 0;
    for (let i = 0; i < viewRow && i < lines.length; i++) {
      const info = isLeft ? lines[i].left : lines[i].right;
      if (info.kind !== LineKind.Blank) displayRow++;
    }
    return displayRow;
  }

  private getConnectorType(conn: Connector, lines: ProcessedLine[]): 'added' | 'removed' | 'modified' {
    let hasAdded = false, hasRemoved = false;
    for (let i = conn.top; i <= conn.bottom && i < lines.length; i++) {
      if (lines[i].left.kind === LineKind.Removed) hasRemoved = true;
      if (lines[i].right.kind === LineKind.Added) hasAdded = true;
    }
    if (hasAdded && hasRemoved) return 'modified';
    if (hasAdded) return 'added';
    return 'removed';
  }

  private getConnectorColor(type: 'added' | 'removed' | 'modified'): string {
    const style = getComputedStyle(document.documentElement);
    switch (type) {
      case 'added': return style.getPropertyValue('--connector-added').trim();
      case 'removed': return style.getPropertyValue('--connector-removed').trim();
      default: return style.getPropertyValue('--connector-modified').trim();
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
