// @ts-ignore
import { LineKind, type ProcessedLine, type ProcessedViewModel } from '../../wasm/index.js';
import type { ConnectorBlock, Elements, State } from './types';
import { LINE_HEIGHT, PADDING_TOP, SVG_WIDTH } from './constants';

export function buildConnectorBlocks(lines: ProcessedLine[]): ConnectorBlock[] {
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

export function handleConnectorClick(
  e: MouseEvent,
  state: State,
  el: Elements
): void {
  const result = state.diffResult;
  if (!result || !state.showConnector) return;

  const rect = el.connectorContent.getBoundingClientRect();
  const clickY = e.clientY - rect.top;

  const blocks = buildConnectorBlocks(result.lines);
  const leftScroll = el.leftContent.scrollTop;
  const rightScroll = el.rightContent.scrollTop;

  for (const block of blocks) {
    const leftPositions = getBlockDisplayPositions(result.lines, block, true);
    const rightPositions = getBlockDisplayPositions(result.lines, block, false);

    let topY: number, bottomY: number;

    if (block.type === 'added') {
      const insertionLineNo = getInsertionLineNo(result.lines, block.startIndex, true);
      topY = PADDING_TOP + (insertionLineNo - 1) * LINE_HEIGHT - leftScroll;
      bottomY = PADDING_TOP + (rightPositions.end + 1) * LINE_HEIGHT - rightScroll;
    } else if (block.type === 'removed') {
      topY = PADDING_TOP + leftPositions.start * LINE_HEIGHT - leftScroll;
      const deletionLineNo = getInsertionLineNo(result.lines, block.startIndex, false);
      bottomY = PADDING_TOP + (deletionLineNo - 1) * LINE_HEIGHT - rightScroll;
    } else {
      topY = PADDING_TOP + leftPositions.start * LINE_HEIGHT - leftScroll;
      bottomY = PADDING_TOP + (rightPositions.end + 1) * LINE_HEIGHT - rightScroll;
    }

    const minY = Math.min(topY, PADDING_TOP + rightPositions.start * LINE_HEIGHT - rightScroll);
    const maxY = Math.max(bottomY, PADDING_TOP + (leftPositions.end + 1) * LINE_HEIGHT - leftScroll);

    if (clickY >= minY && clickY <= maxY) {
      const leftLineNo = block.type === 'added'
        ? getInsertionLineNo(result.lines, block.startIndex, true)
        : leftPositions.start + 1;
      const rightLineNo = block.type === 'removed'
        ? getInsertionLineNo(result.lines, block.startIndex, false)
        : rightPositions.start + 1;

      const leftScrollTarget = (leftLineNo - 1) * LINE_HEIGHT;
      const rightScrollTarget = (rightLineNo - 1) * LINE_HEIGHT;

      state.isScrolling = true;
      el.leftContent.scrollTo({ top: leftScrollTarget, behavior: 'smooth' });
      el.rightContent.scrollTo({ top: rightScrollTarget, behavior: 'smooth' });
      setTimeout(() => {
        state.isScrolling = false;
      }, 500);

      break;
    }
  }
}

export function drawConnectors(state: State, el: Elements): void {
  const result = state.diffResult;
  if (!result || !state.showConnector) return;

  while (el.connectorSvg.firstChild) {
    el.connectorSvg.removeChild(el.connectorSvg.firstChild);
  }

  const viewportHeight = el.connectorContent.clientHeight;
  el.connectorSvg.setAttribute('width', String(SVG_WIDTH));
  el.connectorSvg.setAttribute('height', String(viewportHeight));
  el.connectorSvg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${viewportHeight}`);
  el.connectorSvg.setAttribute('preserveAspectRatio', 'none');

  const leftScroll = el.leftContent.scrollTop;
  const rightScroll = el.rightContent.scrollTop;

  const blocks = buildConnectorBlocks(result.lines);

  for (const block of blocks) {
    drawConnectorBlock(el, block, result.lines, leftScroll, rightScroll, viewportHeight);
  }
}

function drawConnectorBlock(
  el: Elements,
  block: ConnectorBlock,
  lines: ProcessedLine[],
  leftScroll: number,
  rightScroll: number,
  viewportHeight: number
): void {
  const leftPositions = getBlockDisplayPositions(lines, block, true);
  const rightPositions = getBlockDisplayPositions(lines, block, false);

  let leftStartY: number, leftEndY: number, rightStartY: number, rightEndY: number;

  if (block.type === 'added') {
    const insertionLineNo = getInsertionLineNo(lines, block.startIndex, true);
    const insertionPos = insertionLineNo - 1;
    leftStartY = PADDING_TOP + insertionPos * LINE_HEIGHT - leftScroll;
    leftEndY = leftStartY;
    rightStartY = PADDING_TOP + rightPositions.start * LINE_HEIGHT - rightScroll;
    rightEndY = PADDING_TOP + (rightPositions.end + 1) * LINE_HEIGHT - rightScroll;
  } else if (block.type === 'removed') {
    const deletionLineNo = getInsertionLineNo(lines, block.startIndex, false);
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

  drawConnectorShape(el, leftStartY, leftEndY, rightStartY, rightEndY, block.type);
}

function getBlockDisplayPositions(
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
    const insertionLineNo = getInsertionLineNo(lines, block.startIndex, isLeft);
    return { start: insertionLineNo - 1, end: insertionLineNo - 1 };
  }

  return { start: startLineNo - 1, end: endLineNo - 1 };
}

function getInsertionLineNo(lines: ProcessedLine[], index: number, isLeft: boolean): number {
  for (let i = index - 1; i >= 0; i--) {
    const info = isLeft ? lines[i].left : lines[i].right;
    if (info.kind !== LineKind.Blank && info.lineNo > 0) {
      return info.lineNo + 1;
    }
  }
  return 1;
}

function drawConnectorShape(
  el: Elements,
  leftTop: number,
  leftBottom: number,
  rightTop: number,
  rightBottom: number,
  type: 'added' | 'removed' | 'modified'
): void {
  const color = getConnectorColor(type);
  const cp1x = SVG_WIDTH * 0.4;
  const cp2x = SVG_WIDTH * 0.6;

  const fill = createSvgPath(
    `M 0,${leftTop} C ${cp1x},${leftTop} ${cp2x},${rightTop} ${SVG_WIDTH},${rightTop} ` +
    `L ${SVG_WIDTH},${rightBottom} C ${cp2x},${rightBottom} ${cp1x},${leftBottom} 0,${leftBottom} Z`,
    { fill: color, opacity: '0.3' }
  );

  const topBorder = createSvgPath(
    `M 0,${leftTop} C ${cp1x},${leftTop} ${cp2x},${rightTop} ${SVG_WIDTH},${rightTop}`,
    { stroke: color, 'stroke-width': '2', fill: 'none', opacity: '0.8' }
  );

  const bottomBorder = createSvgPath(
    `M 0,${leftBottom} C ${cp1x},${leftBottom} ${cp2x},${rightBottom} ${SVG_WIDTH},${rightBottom}`,
    { stroke: color, 'stroke-width': '2', fill: 'none', opacity: '0.8' }
  );

  el.connectorSvg.appendChild(fill);
  el.connectorSvg.appendChild(topBorder);
  el.connectorSvg.appendChild(bottomBorder);
}

function getConnectorColor(type: 'added' | 'removed' | 'modified'): string {
  const style = getComputedStyle(document.documentElement);
  switch (type) {
    case 'added': return style.getPropertyValue('--color-connector-added').trim();
    case 'removed': return style.getPropertyValue('--color-connector-removed').trim();
    default: return style.getPropertyValue('--color-connector-modified').trim();
  }
}

function createSvgPath(d: string, attrs: Record<string, string>): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  for (const [key, value] of Object.entries(attrs)) {
    path.setAttribute(key, value);
  }
  return path;
}
