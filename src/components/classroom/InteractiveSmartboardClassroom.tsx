import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, type MotionValue } from 'framer-motion';
import { resolveFocusCue } from './focusSequence.ts';
import { WorkedExampleSlide } from './WorkedExampleSlide.tsx';
import {
  Eraser,
  Highlighter,
  MousePointer2,
  PenTool,
  Redo2,
  Undo2
} from 'lucide-react';
import type {
  InstructorVisual,
  InstructorVisualNode,
  InstructorFocusCue,
  InstructorPresentationRole
} from '../../data/instructor-curriculum/types.ts';
import { escapeHtml } from '../common/CodeViewer.tsx';
import {
  computeCircleLoopArcArrow,
  sketchCenterIcon,
  sketchCurvedArrow,
  sketchLabeledNode,
  sketchRoundedBox,
  wrapSketchText,
  type SketchColorKey
} from '../mindmap/sketchEngine.ts';
import { Button } from '../ui/button.tsx';

export type BoardDisplayMode = 'keypoints' | 'diagram' | 'code' | 'question';
export type InstructorStagePose =
  | 'podium_speaking'
  | 'pointing_board'
  | 'asking_student'
  | 'listening_student'
  | 'celebrating';

export interface InteractiveSmartboardClassroomProps {
  lessonTitle: string;
  continuousLesson?: boolean;
  stepTitle: string;
  stepIndex: number;
  totalSteps: number;
  boardMode: BoardDisplayMode;
  keyPoints: string[];
  activePointIndex: number;
  slideTitle?: string;
  slideTakeaway?: string;
  slidePoints?: string[];
  slideSubtitle?: string;
  instructorVisual?: InstructorVisual;
  visualRevealCount?: number;
  visualFocusIndex?: number;
  visualProgress?: MotionValue<number>;
  visualPlaying?: boolean;
  visualFocusPlan?: InstructorFocusCue[];
  presentationRole?: InstructorPresentationRole;
  slideIndex?: number;
  slideCount?: number;
  visualDiagramText: string;
  codeSnippet: string;
  activeCodeLine: number;
  questionText?: string;
  questionOptions?: string[];
  selectedQuestionOption?: number;
  correctQuestionOption?: number;
  questionAnsweredCorrectly?: boolean;
  onSelectQuestionOption?: (optionIndex: number) => void;
  onSelectBoardPoint?: (index: number) => void;
  onSelectCodeLine?: (lineIndex: number, lineText: string) => void;
  onSwitchBoardMode?: (mode: BoardDisplayMode) => void;
}

type BoardTool = 'select' | 'pen' | 'marker' | 'eraser';

export function visualEntryCount(visual: InstructorVisual): number {
  switch (visual.kind) {
    case 'worked-example':
      return visual.steps.length + 2;
    case 'text-slide':
      return 1 + (visual.metrics?.length || 0) + (visual.points?.length || 0) + Number(Boolean(visual.question));
    case 'flow':
      return visual.nodes.length;
    case 'cycle':
      return visual.nodes.length;
    case 'decision-tree':
      return visual.branches.length + 1;
    case 'architecture-comparison':
      return visual.left.steps.length + visual.right.steps.length;
    case 'comparison':
      return visual.columns.reduce((total, column) => total + column.points.length, 0);
    case 'latency-scale':
      return visual.items.length;
    case 'timeline':
      return visual.events.length;
    case 'memory-map':
      return visual.regions.length;
    case 'process-memory':
      return visual.regions.length;
    case 'connection-model':
      return visual.strategies.length;
  }
}

const SKETCH_COLORS: SketchColorKey[] = ['blue', 'green', 'yellow', 'pink', 'purple', 'mint'];

interface SketchFocusGeometry {
  viewBox: string;
  box: DOMRect | SVGRect;
}

function SketchMarkup({
  markup,
  label,
  focusIndex = -1,
  focusCue = 'none',
  title,
  subtitle
}: {
  markup: string;
  label: string;
  focusIndex?: number;
  focusCue?: InstructorFocusCue;
  title?: string;
  subtitle?: string;
}) {
  const diagramSvg = markup.trimStart().startsWith('<svg')
    ? markup
    : `<svg class="excalidraw-sketch-svg" viewBox="0 0 1280 640" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(label)}">${markup}</svg>`;
  let nodeIndex = 0;
  const markedSvg = diagramSvg.replace(/<g class="(sketch-node-group(?: [^"]*)?)"/g, (_group, classes: string) => {
    const isFocused = nodeIndex === focusIndex && focusCue !== 'none';
    const markedGroup = `<g class="${classes}" data-focus-index="${nodeIndex}"${isFocused ? ` data-audio-focus="${focusCue}"` : ''}`;
    nodeIndex += 1;
    return markedGroup;
  });
  const focusStyle = '<style>@keyframes instructor-focus-pulse{0%,100%{filter:drop-shadow(0 0 4px rgba(220,38,38,.32))}50%{filter:drop-shadow(0 0 13px rgba(220,38,38,.72))}}.sketch-node-group{transition:filter .24s ease}.sketch-node-group[data-audio-focus="highlight"]{animation:instructor-focus-pulse .72s ease-in-out 2;filter:drop-shadow(0 0 7px rgba(220,38,38,.48))}.sketch-node-group[data-audio-focus="pointer"],.sketch-node-group[data-audio-focus="circle"]{filter:drop-shadow(0 0 4px rgba(220,38,38,.4))}</style>';
  const svg = markedSvg
    .replace('<svg ', '<svg style="width:100%;height:100%;max-width:100%;max-height:100%" ')
    .replace('>', `>${focusStyle}`);
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const [focusGeometry, setFocusGeometry] = useState<SketchFocusGeometry | null>(null);

  useLayoutEffect(() => {
    const rootSvg = svgHostRef.current?.querySelector('svg');
    if (!rootSvg) {
      setFocusGeometry(null);
      return;
    }
    const target = rootSvg.querySelector<SVGGElement>(`[data-focus-index="${focusIndex}"]`);
    const viewBox = rootSvg.getAttribute('viewBox') || '0 0 1280 640';
    setFocusGeometry(
      target && focusIndex >= 0 && (focusCue === 'pointer' || focusCue === 'circle')
        ? { viewBox, box: target.getBBox() }
        : null
    );
  }, [markup, label, focusIndex, focusCue]);

  const focusBox = focusGeometry?.box;
  const focusCenterX = focusBox ? focusBox.x + focusBox.width / 2 : 0;
  const focusCenterY = focusBox ? focusBox.y + focusBox.height / 2 : 0;
  const pointerStartX = focusBox ? Math.max(focusBox.x - 54, 12) : 0;
  const pointerStartY = focusBox ? Math.max(focusBox.y - 42, 12) : 0;

  return (
    <div className="sketch-canvas-wrapper !mb-0 !flex !h-full !min-h-0 !max-w-full !flex-1 !flex-col !overflow-hidden !p-2 sm:!p-3">
      {(title || subtitle) && (
        <header className="mb-2 shrink-0 border-b border-sky-100 pb-2">
          <h2
            className="text-sm font-extrabold leading-snug text-stone-900 sm:text-base lg:text-lg"
            style={{ fontFamily: "'Playpen Sans', 'Patrick Hand', 'Comic Sans MS', cursive" }}
          >
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs font-medium leading-5 text-stone-600 sm:text-sm">{subtitle}</p>}
        </header>
      )}
      <motion.div
        key={title || label}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative min-h-0 w-full flex-1 overflow-hidden"
      >
        <div ref={svgHostRef} className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        {focusGeometry && focusBox && (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={focusGeometry.viewBox} preserveAspectRatio="xMidYMid meet">
            {focusCue === 'circle' && (
              <motion.ellipse
                initial={{ opacity: 0, cx: focusCenterX, cy: focusCenterY, rx: focusBox.width / 2 + 3, ry: focusBox.height / 2 + 3 }}
                animate={{ opacity: 1, cx: focusCenterX, cy: focusCenterY, rx: focusBox.width / 2 + 10, ry: focusBox.height / 2 + 8 }}
                transition={{ duration: 0.42, ease: 'easeOut', repeat: 2, repeatType: 'reverse', repeatDelay: 0.08 }}
                fill="none"
                stroke="#dc2626"
                strokeWidth="3"
                strokeDasharray="8 6"
              />
            )}
            {focusCue === 'pointer' && (
              <>
                <motion.path
                  initial={{ opacity: 0, pathLength: 0 }}
                  animate={{ opacity: 1, pathLength: 1, d: `M ${pointerStartX} ${pointerStartY} Q ${(pointerStartX + focusCenterX) / 2} ${pointerStartY + 8} ${focusCenterX - 8} ${focusCenterY - 8}` }}
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="3"
                  strokeLinecap="round"
                  markerEnd="url(#sketch-focus-arrow)"
                />
                <motion.circle
                  initial={{ opacity: 0, r: 6 }}
                  animate={{ opacity: [0.35, 1, 0.35], r: [6, 12, 6] }}
                  transition={{ duration: 0.8, ease: 'easeInOut', repeat: 2, delay: 0.42 }}
                  cx={focusCenterX}
                  cy={focusCenterY}
                  fill="#f87171"
                  stroke="#b91c1c"
                  strokeWidth="2"
                />
              </>
            )}
            <defs>
              <marker id="sketch-focus-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8" fill="none" stroke="#dc2626" strokeWidth="2" />
              </marker>
            </defs>
          </svg>
        )}
      </motion.div>
    </div>
  );
}

function sketchNode(
  node: InstructorVisualNode,
  x: number,
  y: number,
  w: number,
  h: number,
  color: SketchColorKey,
  badge: string,
  seed: string
) {
  return sketchLabeledNode({
    x,
    y,
    w,
    h,
    label: node.title,
    subLabel: node.detail,
    color,
    badge,
    fontSize: 17,
    seed
  });
}

function flowSketch(nodes: InstructorVisualNode[], visibleCount: number): string {
  const visibleNodes = nodes.slice(0, visibleCount);
  const width = 1280;
  const cardWidth = nodes.length >= 4
    ? 520
    : nodes.length === 1
      ? 900
      : Math.min(390, (width - 100) / Math.max(1, nodes.length));
  const cardHeight = nodes.length >= 4 ? 164 : 190;
  const columns = nodes.length >= 4 ? 2 : Math.max(1, nodes.length);
  const gapX = columns > 1 ? (width - 80 - cardWidth * columns) / (columns - 1) : 0;
  const rowGap = 72;
  const rowCount = Math.ceil(nodes.length / columns);
  const height = 80 + rowCount * cardHeight + Math.max(0, rowCount - 1) * rowGap + 34;
  const content: string[] = [];

  content.push(`<text x="54" y="44" class="sketch-loop-heading" font-size="24" fill="#3b6998">LUỒNG THỰC THI</text>`);
  visibleNodes.forEach((node, index) => {
    const row = nodes.length >= 4 ? Math.floor(index / columns) : 0;
    const column = nodes.length >= 4 && row % 2 === 1 ? 1 - (index % columns) : index % columns;
    const x = columns === 1 ? (width - cardWidth) / 2 : 40 + column * (cardWidth + gapX);
    const y = 74 + row * (cardHeight + rowGap);
    if (index < visibleNodes.length - 1) {
      const nextIndex = index + 1;
      const nextRow = nodes.length >= 4 ? Math.floor(nextIndex / columns) : 0;
      const nextColumn = nodes.length >= 4 && nextRow % 2 === 1 ? 1 - (nextIndex % columns) : nextIndex % columns;
      const nextX = columns === 1 ? x : 40 + nextColumn * (cardWidth + gapX);
      const nextY = 74 + nextRow * (cardHeight + rowGap);
      if (row === nextRow && nextX > x) {
        content.push(sketchCurvedArrow(x + cardWidth + 6, y + cardHeight / 2, x + cardWidth + gapX / 2, y + cardHeight / 2 - 22, nextX - 6, nextY + cardHeight / 2, { seed: `flow_arrow_${nodes[index].id}` }));
      } else if (row === nextRow) {
        content.push(sketchCurvedArrow(x - 6, y + cardHeight / 2, x - gapX / 2, y + cardHeight / 2 - 22, nextX + cardWidth + 6, nextY + cardHeight / 2, { seed: `flow_arrow_${nodes[index].id}` }));
      } else {
        content.push(sketchCurvedArrow(x + cardWidth / 2, y + cardHeight + 6, x + cardWidth / 2 + 24, (y + nextY + cardHeight) / 2, nextX + cardWidth / 2, nextY - 6, { seed: `flow_arrow_${nodes[index].id}` }));
      }
    }
    content.push(sketchNode(node, x, y, cardWidth, cardHeight, SKETCH_COLORS[index % SKETCH_COLORS.length], `BƯỚC 0${index + 1}`, `flow_${node.id}`));
  });
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Luồng thực thi vẽ tay">${content.join('')}</svg>`;
}

function cycleSketch(visual: Extract<InstructorVisual, { kind: 'cycle' }>, visibleCount: number): string {
  const width = 1280;
  const height = 640;
  const cx = width / 2;
  const cy = 336;
  const radius = 224;
  const cardWidth = 248;
  const cardHeight = 102;
  const visibleNodes = visual.nodes.slice(0, visibleCount);
  const content: string[] = [];

  content.push(`<text x="56" y="54" class="sketch-loop-heading" font-size="24" fill="#3b6998">MỘT VÒNG EVENT LOOP</text>`);
  visibleNodes.forEach((node, index) => {
    const angle = -90 + (index * 360) / visual.nodes.length;
    const radians = (angle * Math.PI) / 180;
    const x = cx + radius * Math.cos(radians) - cardWidth / 2;
    const y = cy + radius * Math.sin(radians) - cardHeight / 2;
    const nextIndex = (index + 1) % visual.nodes.length;
    if (nextIndex < visibleNodes.length) {
      const nextAngle = -90 + (nextIndex * 360) / visual.nodes.length;
      content.push(computeCircleLoopArcArrow({
        cx, cy, radius, fromDeg: angle, toDeg: nextAngle,
        fromBoxW: cardWidth, fromBoxH: cardHeight,
        toBoxW: cardWidth, toBoxH: cardHeight,
        options: {
          label: nextIndex === 0 ? 'lượt tiếp theo' : undefined,
          dashed: nextIndex === 0,
          seed: `cycle_arrow_${node.id}`
        }
      }));
    }
    content.push(sketchNode(node, x, y, cardWidth, cardHeight, SKETCH_COLORS[index % SKETCH_COLORS.length], `PHASE 0${index + 1}`, `cycle_${node.id}`));
  });

  if (visibleCount > 0) {
    content.push(sketchCenterIcon('cpu', cx, cy, 1.05));
    content.push(`<text x="${cx}" y="${cy + 54}" text-anchor="middle" class="sketch-node-badge" fill="#334155">${escapeHtml(visual.centerLabel)}</text>`);
  }
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vòng event loop vẽ tay">${content.join('')}</svg>`;
}

function decisionTreeSketch(visual: Extract<InstructorVisual, { kind: 'decision-tree' }>, visibleCount: number): string {
  const width = 1280;
  const height = 640;
  const cx = width / 2;
  const visibleBranches = visual.branches.slice(0, Math.max(0, visibleCount - 1));
  const rootVisible = visibleCount > 0;
  const count = visual.branches.length;
  const columnCenters = count === 2 ? [390, 890] : count === 3 ? [220, 640, 1060] : [150, 475, 800, 1130];
  const rootWidth = 560;
  const branchWidth = count === 2 ? 360 : count === 3 ? 340 : 280;
  const content: string[] = [];

  content.push(`<text x="56" y="58" class="sketch-loop-heading" font-size="24" fill="#3b6998">CHẨN ĐOÁN THEO DẤU HIỆU</text>`);
  visibleBranches.forEach((branch, index) => {
    const branchX = columnCenters[index];
    content.push(sketchCurvedArrow(cx + (branchX - cx) * 0.35, 148, (cx + branchX) / 2, 174, branchX, 226, {
      label: `nhánh #${index + 1}`,
      labelOffsetY: -4,
      labelFontSize: 14,
      seed: `decision_root_${index}`
    }));
    content.push(sketchCurvedArrow(branchX, 326, branchX + (index % 2 === 0 ? 11 : -11), 350, branchX, 394, {
      seed: `decision_outcome_${index}`
    }));
  });

  if (visibleBranches.length > 1 && visibleBranches.length === visual.branches.length && visual.tradeoff) {
    content.push(sketchCurvedArrow(columnCenters[0] + 70, 535, cx, 586, columnCenters[columnCenters.length - 1] - 70, 535, {
      dashed: true,
      bidirectional: true,
      label: visual.tradeoff,
      labelOffsetY: -10,
      labelFontSize: 14,
      seed: 'decision_tradeoff'
    }));
  }

  if (rootVisible) {
    content.push(sketchLabeledNode({
      x: cx - rootWidth / 2, y: 70, w: rootWidth, h: 88,
      label: visual.rootTitle, subLabel: visual.rootSubtitle,
      color: 'purple', badge: 'ĐIỂM QUYẾT ĐỊNH', fontSize: 19, seed: 'decision_root'
    }));
  }

  visibleBranches.forEach((branch, index) => {
    const branchX = columnCenters[index];
    const outcomeColor: SketchColorKey = branch.tone === 'recommended' ? 'green' : branch.tone === 'tradeoff' ? 'yellow' : 'pink';
    content.push(sketchLabeledNode({
      x: branchX - branchWidth / 2, y: 226, w: branchWidth, h: 100,
      label: branch.condition, badge: 'ĐIỀU KIỆN RẼ NHÁNH',
      color: 'blue', fontSize: 16.5, seed: `decision_condition_${index}`
    }));
    content.push(sketchLabeledNode({
      x: branchX - branchWidth / 2, y: 394, w: branchWidth, h: 120,
      label: branch.outcome.title, subLabel: branch.outcome.detail,
      badge: branch.tone === 'recommended' ? 'HƯỚNG KIỂM TRA' : branch.tone === 'tradeoff' ? 'CẦN PHÂN BIỆT' : 'ĐỐI CHIẾU THÊM',
      color: outcomeColor, fontSize: 17, seed: `decision_out_${branch.outcome.id}`
    }));
  });

  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cây quyết định chẩn đoán vẽ tay">${content.join('')}</svg>`;
}

function architectureSketch(visual: Extract<InstructorVisual, { kind: 'architecture-comparison' }>, visibleCount: number): string {
  const width = 2200;
  const height = 640;
  const centers = [500, 1700];
  const centerY = 320;
  const radius = 142;
  const cardWidth = 194;
  const cardHeight = 92;
  const lanes = [visual.left, visual.right];
  const content: string[] = [];

  lanes.forEach((lane, laneIndex) => {
    const offset = laneIndex === 0 ? 0 : visual.left.steps.length;
    const count = Math.max(0, Math.min(lane.steps.length, visibleCount - offset));
    const headingColor = laneIndex === 0 ? '#3b6998' : '#246b43';
    const headingLines = wrapSketchText(lane.title, 42, 2);
    headingLines.forEach((line, index) => content.push(`<text x="${centers[laneIndex]}" y="${44 + index * 28}" text-anchor="middle" class="sketch-loop-heading" font-size="21" fill="${headingColor}">${escapeHtml(line)}</text>`));
    const subtitleLines = wrapSketchText(lane.subtitle, 62, 2);
    subtitleLines.forEach((line, index) => content.push(`<text x="${centers[laneIndex]}" y="${102 + index * 22}" text-anchor="middle" class="sketch-loop-subheading" font-size="15" fill="${headingColor}">${escapeHtml(line)}</text>`));

    lane.steps.slice(0, count).forEach((node, index) => {
      const angle = -90 + (index * 360) / lane.steps.length;
      const radians = (angle * Math.PI) / 180;
      const x = centers[laneIndex] + radius * Math.cos(radians) - cardWidth / 2;
      const y = centerY + radius * Math.sin(radians) - cardHeight / 2;
      const nextIndex = (index + 1) % lane.steps.length;
      if (nextIndex < count) {
        const nextAngle = -90 + (nextIndex * 360) / lane.steps.length;
        content.push(computeCircleLoopArcArrow({
          cx: centers[laneIndex], cy: centerY, radius, fromDeg: angle, toDeg: nextAngle,
          fromBoxW: cardWidth, fromBoxH: cardHeight,
          toBoxW: cardWidth, toBoxH: cardHeight,
          options: { dashed: nextIndex === 0, label: nextIndex === 0 ? 'lượt kế tiếp' : undefined, seed: `architecture_${laneIndex}_${index}` }
        }));
      }
      content.push(sketchNode(node, x, y, cardWidth, cardHeight, SKETCH_COLORS[(index + laneIndex * 2) % SKETCH_COLORS.length], `BƯỚC 0${index + 1}`, `architecture_node_${node.id}`));
    });
  });

  content.push(sketchCenterIcon('laptop', width / 2, centerY, 1.1));
  const bridgeLines = wrapSketchText(visual.bridge, 92, 2);
  bridgeLines.forEach((line, index) => content.push(`<text x="${width / 2}" y="${590 + index * 22}" text-anchor="middle" class="sketch-arrow-label" font-size="15">${escapeHtml(line)}</text>`));
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hai luồng kiến trúc vẽ tay">${content.join('')}</svg>`;
}

function comparisonSketch(visual: Extract<InstructorVisual, { kind: 'comparison' }>, visibleCount: number): string {
  const width = 1280;
  const height = 590;
  const columnCount = Math.min(3, visual.columns.length);
  const panelWidth = (width - 80 - (columnCount - 1) * 32) / columnCount;
  const panelXs = Array.from({ length: columnCount }, (_, index) => 40 + index * (panelWidth + 32));
  let entryIndex = 0;
  const content: string[] = [];

  visual.columns.slice(0, 3).forEach((column, columnIndex) => {
    const x = panelXs[columnIndex];
    const panelItems = column.points.map((point) => ({ point, index: entryIndex++ }));
    const visibleItems = panelItems.filter((item) => item.index < visibleCount);
    if (visibleItems.length === 0) return;
    const itemHeight = 92;
    const panelHeight = Math.min(height - 48, 90 + itemHeight * Math.max(visibleItems.length, 1));
    content.push(sketchRoundedBox(x, 52, panelWidth, panelHeight, { fill: '#fffef8', stroke: '#253346', rx: 22, seed: `comparison_panel_${columnIndex}` }));
    content.push(sketchLabeledNode({
      x: x + 18, y: 70, w: panelWidth - 36, h: 70,
      label: column.title, color: columnIndex === 0 ? 'blue' : 'purple',
      fontSize: 18, badge: `GÓC NHÌN 0${columnIndex + 1}`, seed: `comparison_heading_${columnIndex}`
    }));
    visibleItems.forEach(({ point, index }, rowIndex) => {
      const y = 166 + rowIndex * itemHeight;
      content.push(sketchLabeledNode({
        x: x + 38, y, w: panelWidth - 76, h: 74,
        label: point, color: SKETCH_COLORS[(columnIndex + rowIndex + 1) % SKETCH_COLORS.length],
        fontSize: 16, badge: `Ý ${String(index + 1).padStart(2, '0')}`, seed: `comparison_point_${index}`
      }));
    });
  });
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ so sánh vẽ tay">${content.join('')}</svg>`;
}

function timelineSketch(visual: Extract<InstructorVisual, { kind: 'timeline' }>, visibleCount: number): string {
  const width = 1280;
  const height = 640;
  const count = visual.events.length;
  const cardWidth = Math.min(230, (width - 96) / Math.max(1, count));
  const gap = count > 1 ? (width - 80 - cardWidth * count) / (count - 1) : 0;
  const axisY = 322;
  const content: string[] = [];

  content.push(`<text x="54" y="52" class="sketch-loop-heading" font-size="24" fill="#3b6998">DIỄN TIẾN THEO THỜI GIAN</text>`);
  content.push(`<path d="M 52 ${axisY} Q 630 ${axisY - 4} 1226 ${axisY + 2}" fill="none" stroke="#1e1e1e" stroke-width="2" stroke-linecap="round" />`);
  visual.events.slice(0, visibleCount).forEach((event, index) => {
    const x = 40 + index * (cardWidth + gap);
    const cardY = index % 2 === 0 ? 84 : 408;
    const cardHeight = 150;
    const centerX = x + cardWidth / 2;
    const dotY = axisY + (index % 2 === 0 ? -8 : 8);
    content.push(`<circle cx="${centerX}" cy="${dotY}" r="8" fill="${index % 2 === 0 ? '#a5d8ff' : '#ffec99'}" stroke="#1e1e1e" stroke-width="2" />`);
    content.push(`<path d="M ${centerX} ${index % 2 === 0 ? cardY + cardHeight : cardY} Q ${centerX + 10} ${(cardY + axisY) / 2} ${centerX} ${dotY}" fill="none" stroke="#1e1e1e" stroke-width="1.8" stroke-linecap="round" />`);
    content.push(sketchLabeledNode({
      x, y: cardY, w: cardWidth, h: cardHeight,
      label: `${event.time}\n${event.actor}\n${event.action}`,
      color: SKETCH_COLORS[index % SKETCH_COLORS.length],
      badge: `MỐC 0${index + 1}`,
      fontSize: 16,
      seed: `timeline_${event.actor}_${event.time}`
    }));
    if (index < Math.min(visibleCount - 1, count - 1)) {
      const nextCenterX = x + cardWidth + gap / 2;
      content.push(sketchCurvedArrow(centerX + 10, axisY, nextCenterX - 12, axisY - 20, nextCenterX + 4, axisY, { seed: `timeline_arrow_${index}` }));
    }
  });
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dòng thời gian vẽ tay">${content.join('')}</svg>`;
}

function memoryMapSketch(regions: InstructorVisualNode[], visibleCount: number): string {
  const width = 1160;
  const height = 560;
  const visibleRegions = regions.slice(0, visibleCount);
  const content: string[] = [];
  content.push(sketchRoundedBox(66, 86, 1028, 420, { fill: '#ffffff', stroke: '#52667a', rx: 28, seed: 'memory_address_space' }));
  content.push(sketchLabeledNode({
    x: 382, y: 20, w: 396, h: 90,
    label: 'PROCESS / RUNTIME MEMORY', badge: 'BẢN ĐỒ KHÔNG GIAN BỘ NHỚ',
    color: 'purple', fontSize: 18, seed: 'memory_root'
  }));
  const columns = Math.min(2, Math.max(1, Math.ceil(Math.sqrt(regions.length))));
  const rows = Math.ceil(regions.length / columns);
  const cardWidth = columns === 1 ? 780 : 444;
  const cardHeight = rows > 2 ? 92 : 126;
  const gapX = 42;
  const gapY = 24;
  const startX = (width - columns * cardWidth - (columns - 1) * gapX) / 2;
  const startY = rows === 1 ? 250 : 166;

  visibleRegions.forEach((region, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + column * (cardWidth + gapX);
    const y = startY + row * (cardHeight + gapY);
    const sourceY = row === 0 ? 112 : y - gapY + 5;
    content.push(sketchCurvedArrow(x + cardWidth / 2, sourceY, x + cardWidth / 2 + 7, sourceY + 16, x + cardWidth / 2, y - 8, { seed: `memory_arrow_${region.id}` }));
    content.push(sketchNode(region, x, y, cardWidth, cardHeight, SKETCH_COLORS[index % SKETCH_COLORS.length], `VÙNG 0${index + 1}`, `memory_${region.id}`));
  });
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bản đồ bộ nhớ vẽ tay">${content.join('')}</svg>`;
}

function latencySketch(visual: Extract<InstructorVisual, { kind: 'latency-scale' }>, visibleCount: number): string {
  const highestLog = Math.log10(Math.max(...visual.items.map((item) => item.latencyNs)) + 1);
  const content: string[] = [];
  content.push(`<text x="52" y="50" class="sketch-loop-heading" font-size="24" fill="#3b6998">ĐỘ TRỄ TĂNG THEO NHIỀU BẬC ĐỘ LỚN</text>`);
  content.push(`<text x="54" y="85" class="sketch-loop-subheading" font-size="16" fill="#475569">Thang logarit · mỗi vạch biểu thị một bậc 10</text>`);
  content.push(sketchCurvedArrow(330, 106, 700, 85, 1100, 106, { label: 'nhanh hơn → chậm hơn', labelOffsetY: -8, seed: 'latency_axis' }));
  visual.items.slice(0, visibleCount).forEach((item, index) => {
    const y = 142 + index * 76;
    const ratio = Math.max(0.02, Math.log10(item.latencyNs + 1) / highestLog);
    const barWidth = ratio * 626;
    content.push(sketchLabeledNode({ x: 48, y, w: 246, h: 58, label: item.title, color: SKETCH_COLORS[index % SKETCH_COLORS.length], fontSize: 16, seed: `latency_${item.title}` }));
    content.push(sketchRoundedBox(324, y + 17, 650, 24, { fill: '#f1f5f9', stroke: '#64748b', rx: 10, seed: `latency_track_${index}` }));
    content.push(sketchRoundedBox(324, y + 17, barWidth, 24, { fill: index < 3 ? '#a5d8ff' : index < 5 ? '#ffec99' : '#ffc9c9', stroke: '#1e1e1e', rx: 10, seed: `latency_bar_${index}` }));
    content.push(`<text x="1002" y="${y + 37}" class="sketch-node-text" font-size="17">${escapeHtml(item.label)}</text>`);
  });
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 1280 640" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Thang độ trễ vẽ tay">${content.join('')}</svg>`;
}

function connectionModelSketch(visual: Extract<InstructorVisual, { kind: 'connection-model' }>, visibleCount: number): string {
  const count = visual.strategies.length;
  const cardWidth = Math.min(340, (1200 - 100) / count);
  const gap = count > 1 ? (1200 - 80 - cardWidth * count) / (count - 1) : 0;
  const content: string[] = [];
  content.push(`<text x="52" y="56" class="sketch-loop-heading" font-size="24" fill="#3b6998">MỖI CONNECTION ĐANG GIỮ TÀI NGUYÊN GÌ?</text>`);
  visual.strategies.slice(0, visibleCount).forEach((strategy, index) => {
    const x = 40 + index * (cardWidth + gap);
    if (index < Math.min(visibleCount - 1, count - 1)) {
      content.push(sketchCurvedArrow(x + cardWidth + 5, 322, x + cardWidth + gap / 2, 292, x + cardWidth + gap - 5, 322, { seed: `connection_arrow_${index}` }));
    }
    content.push(sketchLabeledNode({
      x, y: 190, w: cardWidth, h: 250,
      label: `${strategy.title}\n${strategy.resource}\n${strategy.limitation}`,
      badge: `TÀI NGUYÊN / GIỚI HẠN 0${index + 1}`,
      color: SKETCH_COLORS[index % SKETCH_COLORS.length],
      fontSize: 17,
      seed: `connection_${strategy.title}`
    }));
  });
  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 1280 640" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mô hình connection vẽ tay">${content.join('')}</svg>`;
}

function textSlideSketch(visual: Extract<InstructorVisual, { kind: 'text-slide' }>, visibleCount: number): string {
  const width = 1280;
  const hasMetrics = Boolean(visual.metrics?.length);
  const hasPoints = Boolean(visual.points?.length);
  const compactIllustratedLayout = Boolean(visual.illustration && !hasPoints);
  const height = compactIllustratedLayout ? 500 : 720;
  const content: string[] = [];
  const metricStart = 2;
  const pointStart = 1 + (visual.metrics?.length ?? 0);
  const questionIndex = pointStart + (visual.points?.length ?? 0);

  if (visual.eyebrow) {
    content.push(`<text x="72" y="60" class="sketch-loop-heading" font-size="21" fill="#3b6998">${escapeHtml(visual.eyebrow)}</text>`);
  }
  if (visibleCount >= 1) content.push(sketchLabeledNode({
    x: 54,
    y: compactIllustratedLayout ? 76 : 82,
    w: compactIllustratedLayout ? 520 : visual.illustration ? 620 : 1172,
    h: compactIllustratedLayout ? 212 : 174,
    label: visual.lead,
    color: 'purple',
    fontSize: 25,
    seed: `text_slide_lead_${visual.lead}`
  }));

  if (visual.illustration && visibleCount >= 1) {
    const imageX = compactIllustratedLayout ? 610 : 700;
    const imageY = compactIllustratedLayout ? 58 : 82;
    const imageWidth = compactIllustratedLayout ? 616 : 526;
    const imageHeight = compactIllustratedLayout ? 264 : 322;
    content.push(`<image href="${escapeHtml(visual.illustration.src)}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(visual.illustration.alt)}" />`);
    if (visual.illustration.caption) {
      const captionX = compactIllustratedLayout ? imageX + imageWidth / 2 : 963;
      const captionY = compactIllustratedLayout ? 330 : 420;
      content.push(`<text x="${captionX}" y="${captionY}" text-anchor="middle" class="sketch-node-sub">${escapeHtml(visual.illustration.caption)}</text>`);
    }
  }

  if (hasMetrics) {
    const metrics = visual.metrics ?? [];
    const gap = 22;
    const cardWidth = (1172 - gap * (metrics.length - 1)) / metrics.length;
    metrics.forEach((metric, index) => {
      if (visibleCount < metricStart + index) return;
      const x = 54 + index * (cardWidth + gap);
      content.push(sketchLabeledNode({
        x,
        y: compactIllustratedLayout ? 350 : visual.illustration ? 438 : 286,
        w: cardWidth,
        h: compactIllustratedLayout ? 70 : 118,
        label: metric.value,
        subLabel: metric.label,
        color: SKETCH_COLORS[index % SKETCH_COLORS.length],
        badge: `SỐ LIỆU 0${index + 1}`,
        fontSize: 19,
        seed: `text_slide_metric_${metric.label}`
      }));
    });
  }

  if (hasPoints) {
    const points = visual.points ?? [];
    const columns = points.length > 2 ? 2 : points.length;
    const rows = Math.ceil(points.length / columns);
    const gapX = 20;
    const gapY = 14;
    const cardWidth = (1172 - gapX * (columns - 1)) / columns;
    const cardHeight = rows > 1 ? 112 : 142;
    const startY = visual.illustration ? (hasMetrics ? 570 : 438) : hasMetrics ? 430 : points.length > 2 ? 276 : 302;
    points.forEach((point, index) => {
      if (visibleCount < pointStart + index + 1) return;
      const x = 54 + (index % columns) * (cardWidth + gapX);
      const y = startY + Math.floor(index / columns) * (cardHeight + gapY);
      content.push(sketchLabeledNode({
        x,
        y,
        w: cardWidth,
        h: cardHeight,
        label: point.title,
        subLabel: point.detail,
        color: SKETCH_COLORS[(index + 1) % SKETCH_COLORS.length],
        badge: `Ý ${String(index + 1).padStart(2, '0')}`,
        fontSize: 17,
        seed: `text_slide_point_${point.title}`
      }));
    });
  }

  const hasQuestion = Boolean(visual.question);
  const pointRows = hasPoints ? Math.ceil((visual.points?.length ?? 0) / ((visual.points?.length ?? 0) > 2 ? 2 : (visual.points?.length ?? 1))) : 0;
  const contentBottom = hasPoints
    ? (visual.illustration ? (hasMetrics ? 570 : 438) : hasMetrics ? 430 : (visual.points?.length ?? 0) > 2 ? 276 : 302) + pointRows * (pointRows > 1 ? 112 : 142) + Math.max(0, pointRows - 1) * 14
    : visual.illustration ? hasMetrics ? 556 : 404 : hasMetrics ? 404 : 276;
  if (hasQuestion && visibleCount >= questionIndex + 1) {
    content.push(sketchLabeledNode({
      x: 54,
      y: compactIllustratedLayout ? 432 : Math.min(height - 92, contentBottom + 14),
      w: 1172,
      h: compactIllustratedLayout ? 58 : 82,
      label: visual.question ?? '',
      color: 'yellow',
      badge: 'CÂU HỎI DẪN ĐƯỜNG',
      fontSize: 17,
      seed: `text_slide_question_${visual.question}`
    }));
  }

  return `<svg class="excalidraw-sketch-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nội dung bài học viết tay">${content.join('')}</svg>`;
}

function markdownAsVisual(markdown: string, title: string): Extract<InstructorVisual, { kind: 'text-slide' }> {
  const diagramLabels = [...markdown.matchAll(/[A-Za-z0-9_-]+\[([^\]]+)\]|[A-Za-z0-9_-]+\(\(([^)]+)\)\)/g)]
    .map((match) => match[1] || match[2] || '');
  const lines = markdown
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:#+|[-*]|\d+\.)\s*/, '').replace(/[*_`]/g, '').trim())
    .filter((line) => line && !/^(?:flowchart|graph)\s+/i.test(line) && !/^(?:subgraph|end)$/i.test(line));
  const labels = diagramLabels.length > 0 ? diagramLabels : lines.slice(1, 7);

  return {
    kind: 'text-slide',
    eyebrow: diagramLabels.length > 0 ? 'SƠ ĐỒ LUỒNG' : 'GHI CHÚ TRÊN BẢNG',
    lead: lines[0] || title,
    points: labels.map((label, index) => ({ title: `Bước ${index + 1}`, detail: label }))
  };
}

function diagramNodeFocusIndex(visual: InstructorVisual, focusIndex: number, visibleCount: number): number {
  if (focusIndex < 0) return -1;
  if (visual.kind === 'process-memory' || visual.kind === 'memory-map') return focusIndex + 1;
  if (visual.kind === 'decision-tree') return focusIndex === 0 ? 0 : 1 + (focusIndex - 1) * 2;
  if (visual.kind === 'comparison') {
    let entryOffset = 0;
    let groupOffset = 0;
    for (const column of visual.columns) {
      const visibleInColumn = Math.min(column.points.length, Math.max(0, visibleCount - entryOffset));
      if (visibleInColumn > 0) {
        groupOffset += 1;
        if (focusIndex < entryOffset + visibleInColumn) return groupOffset + focusIndex - entryOffset;
        groupOffset += visibleInColumn;
      }
      entryOffset += column.points.length;
    }
    return -1;
  }
  return focusIndex;
}

function InstructorVisualPanel({
  visual,
  visibleCount,
  focusIndex = -1,
  focusPlan = [],
  progress,
  playing,
  title,
  subtitle
}: {
  visual: InstructorVisual;
  visibleCount: number;
  focusIndex?: number;
  focusPlan?: InstructorFocusCue[];
  progress?: MotionValue<number>;
  playing?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const nodeFocusIndex = diagramNodeFocusIndex(visual, focusIndex, visibleCount);
  const focusCue = resolveFocusCue(focusPlan, focusIndex);
  const renderSketch = (markup: string, label: string) => (
    <SketchMarkup
      markup={markup}
      label={label}
      focusIndex={nodeFocusIndex}
      focusCue={focusCue}
      title={title}
      subtitle={subtitle}
    />
  );
  if (visual.kind === 'worked-example') {
    return <WorkedExampleSlide visual={visual} title={title} subtitle={subtitle} visibleCount={visibleCount} focusIndex={focusIndex} progress={progress} playing={playing} />;
  }
  if (visual.kind === 'text-slide') {
    return renderSketch(textSlideSketch(visual, visibleCount), 'Slide nội dung viết tay');
  }

  if (visual.kind === 'process-memory') {
    return renderSketch(memoryMapSketch(visual.regions, visibleCount), 'Sơ đồ process và thread vẽ tay');
  }

  if (visual.kind === 'flow') {
    return renderSketch(flowSketch(visual.nodes, visibleCount), 'Luồng thực thi vẽ tay');
  }
  if (visual.kind === 'cycle') {
    return renderSketch(cycleSketch(visual, visibleCount), 'Vòng lặp thực thi');
  }
  if (visual.kind === 'decision-tree') {
    return renderSketch(decisionTreeSketch(visual, visibleCount), 'Cây quyết định');
  }
  if (visual.kind === 'architecture-comparison') {
    return renderSketch(architectureSketch(visual, visibleCount), 'Đối chiếu hai luồng kiến trúc');
  }
  if (visual.kind === 'comparison') {
    return renderSketch(comparisonSketch(visual, visibleCount), 'Sơ đồ đối chiếu');
  }
  if (visual.kind === 'latency-scale') {
    return renderSketch(latencySketch(visual, visibleCount), 'Thang độ trễ');
  }
  if (visual.kind === 'timeline') {
    return renderSketch(timelineSketch(visual, visibleCount), 'Dòng thời gian');
  }
  if (visual.kind === 'memory-map') {
    return renderSketch(memoryMapSketch(visual.regions, visibleCount), 'Bản đồ bộ nhớ');
  }
  return renderSketch(connectionModelSketch(visual, visibleCount), 'Mô hình connection và tài nguyên');
}

function TitleSlide({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center px-8 text-center">
      {subtitle && <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-sky-700 sm:text-sm">{subtitle}</p>}
      <h1
        className="max-w-6xl text-[clamp(2rem,4.5vw,5rem)] font-black leading-[1.12] text-stone-900"
        style={{ fontFamily: "'Playpen Sans', 'Patrick Hand', 'Comic Sans MS', cursive" }}
      >
        {title || 'Bài học hôm nay'}
      </h1>
    </div>
  );
}

const PEN_COLORS = ['#0284c7', '#059669', '#d97706', '#e11d48', '#1e293b'];

function SmartboardPanel(props: InteractiveSmartboardClassroomProps) {
  const [tool, setTool] = useState<BoardTool>('select');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [inkVersion, setInkVersion] = useState(0);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);

  const codeLines = (props.codeSnippet || '// Chưa có đoạn code mẫu cho bước này')
    .split('\n')
    .slice(0, 10);

  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas || tool === 'select') return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(2, Math.round(rect.width * 2));
    const height = Math.max(2, Math.round(rect.height * 2));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
  }, [tool]);

  useEffect(() => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    redoStack.current = [];
    setInkVersion((value) => value + 1);
  }, [props.stepIndex]);

  const snapshot = () => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > 14) undoStack.current.shift();
    redoStack.current = [];
  };

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const strokeStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 28;
      return;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
    ctx.globalAlpha = tool === 'marker' ? 0.32 : 1;
    ctx.lineWidth = tool === 'marker' ? 22 : 3.2;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    const point = pointFromEvent(event);
    if (!canvas || !ctx || !point) return;
    snapshot();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokeStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = inkRef.current?.getContext('2d');
    const point = pointFromEvent(event);
    if (!ctx || !point) return;
    strokeStyle(ctx);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const endStroke = () => {
    drawingRef.current = false;
    setInkVersion((value) => value + 1);
  };

  const restore = (from: ImageData[], to: ImageData[]) => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    const frame = from.pop();
    if (!canvas || !ctx || !frame) return;
    to.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(frame, 0, 0);
    setInkVersion((value) => value + 1);
  };

  return (
        <div className="pointer-events-auto flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#f8fafc] text-stone-800 shadow-[0_10px_32px_rgba(28,39,54,0.1)]">
          <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
            <div
              className="grid h-full min-h-0 w-full grid-cols-1 overflow-hidden p-2 sm:p-3 lg:p-4"
              style={{
                backgroundImage: 'radial-gradient(#d6dde6 0.8px, transparent 0.8px)',
                backgroundSize: '18px 18px'
              }}
            >
              <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                {props.boardMode === 'keypoints' && props.instructorVisual && (
                  <div className="mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden">
                    {props.presentationRole === 'title' ? (
                      <TitleSlide title={props.slideTitle} subtitle={props.slideSubtitle} />
                    ) : (
                      <InstructorVisualPanel
                        visual={props.instructorVisual}
                        visibleCount={props.visualRevealCount ?? 0}
                        focusIndex={props.visualFocusIndex}
                        progress={props.visualProgress}
                        playing={props.visualPlaying}
                        focusPlan={props.visualFocusPlan}
                        title={props.slideTitle}
                        subtitle={props.slideSubtitle}
                      />
                    )}
                  </div>
                )}

                {props.boardMode === 'keypoints' && !props.instructorVisual && (
                  <div
                    className={`mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden py-2 ${props.presentationRole === 'title' ? 'items-center justify-center px-8 text-center' : 'justify-center'}`}
                    style={{ fontFamily: "'Playpen Sans', 'Patrick Hand', 'Comic Sans MS', cursive" }}
                  >
                    {props.presentationRole === 'title' ? (
                      <TitleSlide title={props.slideTitle} subtitle={props.slideSubtitle} />
                    ) : null}
                    {props.presentationRole !== 'title' && <div className="min-h-0 flex-1">
                      <InstructorVisualPanel
                        visual={{
                          kind: 'text-slide',
                          eyebrow: 'Ý CHÍNH',
                          lead: props.slideTakeaway || props.keyPoints[props.activePointIndex] || props.keyPoints[0] || '',
                          points: props.slidePoints?.slice(0, 4).map((point, index) => {
                            const [label, ...detailParts] = point.split(/:\s+/, 2);
                            const hasLabel = detailParts.length > 0 && label.length < 72;
                            return {
                              title: hasLabel ? label : `Ý ${index + 1}`,
                              detail: hasLabel ? detailParts.join(': ') : point
                            };
                          })
                        }}
                        visibleCount={1 + (props.slidePoints?.slice(0, 4).length ?? 0)}
                        focusIndex={props.visualFocusIndex}
                        progress={props.visualProgress}
                        playing={props.visualPlaying}
                        title={props.slideTitle}
                        subtitle={props.slideSubtitle}
                      />
                    </div>}
                  </div>
                )}

                {props.boardMode === 'code' && (
                  <div className="h-full overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-2 font-mono text-[13px]">
                    {codeLines.map((lineText, index) => {
                      const focused = index === props.activeCodeLine;
                      return (
                        <Button
                          variant="ghost"
                          size="auto"
                          key={`${lineText}-${index}`}
                          type="button"
                          onClick={() => props.onSelectCodeLine?.(index, lineText)}
                          className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left ${
                            focused ? 'bg-sky-100 font-bold text-sky-950' : 'text-stone-700'
                          }`}
                        >
                          <span className="w-8 text-stone-400">#{index + 1}</span>
                          <span className="truncate">{lineText || ' '}</span>
                        </Button>
                      );
                    })}
                  </div>
                )}

                {props.boardMode === 'diagram' && (
                  <div className="flex h-full min-h-0 w-full overflow-hidden">
                    <InstructorVisualPanel
                      visual={props.instructorVisual || markdownAsVisual(props.visualDiagramText, props.slideTitle || 'Sơ đồ bài học')}
                      visibleCount={props.instructorVisual ? visualEntryCount(props.instructorVisual) : 7}
                      focusIndex={props.visualFocusIndex}
                        progress={props.visualProgress}
                        playing={props.visualPlaying}
                    />
                  </div>
                )}

                {props.boardMode === 'question' && (
                  <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-4 sm:p-8">
                    <div
                      className="w-full max-w-6xl rounded-3xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm sm:p-8 lg:p-10"
                      style={{ fontFamily: "'Playpen Sans', 'Patrick Hand', 'Comic Sans MS', cursive" }}
                    >
                      <div className="text-sm font-extrabold uppercase tracking-wide text-amber-800">
                        Câu hỏi tại lớp
                      </div>
                      <p className="mt-3 text-xl font-black leading-relaxed text-stone-900 sm:text-3xl lg:text-4xl">
                        {props.questionText}
                      </p>
                      {(props.questionOptions?.length ?? 0) > 0 && (
                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                          {props.questionOptions?.map((option, index) => {
                            const selected = props.selectedQuestionOption === index;
                            const isCorrect = index === props.correctQuestionOption;
                            const resultStyle = props.questionAnsweredCorrectly
                              ? selected
                                ? 'border-emerald-500 bg-emerald-100 text-emerald-950'
                                : isCorrect
                                  ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                                  : 'border-stone-200 bg-white text-stone-700'
                              : selected
                                ? 'border-rose-400 bg-rose-50 text-rose-950'
                                : 'border-stone-200 bg-white text-stone-800 hover:border-amber-500 hover:bg-amber-100/70';

                            return (
                              <Button
                                variant="ghost"
                                size="auto"
                                key={`${index}-${option}`}
                                type="button"
                                onClick={() => props.onSelectQuestionOption?.(index)}
                                className={`flex min-h-16 items-start gap-3 rounded-2xl border-2 p-4 text-left text-sm font-semibold leading-6 transition sm:min-h-20 sm:text-base ${resultStyle}`}
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-200 font-black text-amber-950">
                                  {String.fromCharCode(65 + index)}
                                </span>
                                <span>{option}</span>
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {tool !== 'select' && (
              <canvas
                ref={inkRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                className="absolute inset-0 z-20 h-full w-full cursor-crosshair touch-none"
              />
            )}
          </div>

          <div className="flex shrink-0 items-center justify-center gap-2 border-t border-stone-200 bg-white py-2">
            <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1">
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => setTool('select')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'select' ? 'bg-sky-600 text-white' : 'text-stone-500'}`}
                title="Chọn ý trên bảng"
              >
                <MousePointer2 size={14} />
              </Button>
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => setTool('pen')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'pen' ? 'bg-sky-600 text-white' : 'text-sky-600'}`}
                title="Bút viết"
              >
                <PenTool size={14} />
              </Button>
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => setTool('marker')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'marker' ? 'bg-amber-500 text-white' : 'text-amber-500'}`}
                title="Bút dạ"
              >
                <Highlighter size={14} />
              </Button>
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => setTool('eraser')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'eraser' ? 'bg-stone-700 text-white' : 'text-stone-500'}`}
                title="Tẩy"
              >
                <Eraser size={14} />
              </Button>
              <span className="mx-1 h-3.5 w-px bg-stone-200" />
              {PEN_COLORS.map((color) => (
                <Button
                  variant="ghost"
                  size="auto"
                  key={color}
                  type="button"
                  onClick={() => {
                    setPenColor(color);
                    if (tool === 'select' || tool === 'eraser') setTool('pen');
                  }}
                  style={{ backgroundColor: color }}
                  className={`h-3.5 w-3.5 cursor-pointer rounded-full ${
                    penColor === color ? 'ring-2 ring-sky-500 ring-offset-1' : ''
                  }`}
                />
              ))}
              <span className="mx-1 h-3.5 w-px bg-stone-200" />
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => restore(undoStack.current, redoStack.current)}
                disabled={undoStack.current.length === 0}
                className="cursor-pointer text-stone-500 disabled:opacity-30"
                title="Hoàn tác nét vẽ"
              >
                <Undo2 size={14} />
              </Button>
              <Button
                variant="ghost"
                size="auto"
                type="button"
                onClick={() => restore(redoStack.current, undoStack.current)}
                disabled={redoStack.current.length === 0}
                className="cursor-pointer text-stone-500 disabled:opacity-30"
                title="Làm lại nét vẽ"
              >
                <Redo2 size={14} />
              </Button>
              <span className="sr-only">nét {inkVersion}</span>
            </div>
          </div>
        </div>
  );
}

export const InteractiveSmartboardClassroom: React.FC<InteractiveSmartboardClassroomProps> = (props) => (
  <section className="absolute inset-0 isolate overflow-hidden bg-[#eee9df]" aria-label="Lớp học và bảng thông minh">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_12%,#fffdf8_0%,#f2ede3_58%,#e9e1d3_100%)]" />
    <div className="absolute inset-x-0 top-0 h-14 border-b border-[#d8cdbb]/70 bg-white/20" />
    <div className="absolute inset-x-0 bottom-0 h-20 border-t border-[#a58159]/50 bg-[linear-gradient(180deg,#b88b5d_0%,#a8794c_100%)]" />
    <div className="absolute inset-x-0 bottom-20 h-2 bg-[#806043]/80" />

    <div className="absolute inset-x-0 bottom-[112px] top-3 flex justify-center px-2 py-2 sm:bottom-[104px] sm:px-5">
      <div className="relative flex h-full w-full max-w-none items-center justify-center">
        <div className="h-full w-full rounded-[24px] border-[6px] border-[#72543a] bg-[#d9d0c1] p-1.5 shadow-[0_22px_55px_rgba(64,45,28,0.18)] sm:p-2.5">
          <div className="flex h-full items-center justify-center rounded-[18px] border border-[#c7baa6] bg-[#fafafa] p-2 shadow-inner sm:p-4">
            <SmartboardPanel {...props} />
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-3 left-1/2 h-4 w-1/3 -translate-x-1/2 rounded-full bg-[#60462f]/15 blur-md" />
      </div>
    </div>
  </section>
);
