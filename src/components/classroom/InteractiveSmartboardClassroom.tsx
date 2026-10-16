import React, { Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Code2,
  Cpu,
  Eraser,
  Gauge,
  GitBranch,
  Highlighter,
  Layers,
  Lightbulb,
  MousePointer2,
  Network,
  PenTool,
  Target,
  Redo2,
  Undo2
} from 'lucide-react';
import type {
  InstructorVisual,
  InstructorVisualNode
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
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import { Card } from '../ui/card.tsx';

const ProcessMemory3DScene = React.lazy(() => import('./ProcessMemory3DScene.tsx'));

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

function RevealCard({
  visible,
  children,
  className = ''
}: {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const SKETCH_COLORS: SketchColorKey[] = ['blue', 'green', 'yellow', 'pink', 'purple', 'mint'];

function SketchMarkup({ markup, label }: { markup: string; label: string }) {
  const diagramSvg = markup.trimStart().startsWith('<svg')
    ? markup
    : `<svg class="excalidraw-sketch-svg" viewBox="0 0 1280 640" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(label)}">${markup}</svg>`;
  const svg = diagramSvg.replace('<svg ', '<svg style="min-width:1100px;max-width:none" ');
  return (
    <div className="sketch-canvas-wrapper !mb-0 !max-w-full !p-2">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
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
  const cardWidth = Math.min(274, (width - 100) / Math.max(1, nodes.length));
  const gap = nodes.length > 1 ? (width - 80 - cardWidth * nodes.length) / (nodes.length - 1) : 0;
  const cardHeight = 148;
  const y = 245;
  const content: string[] = [];

  content.push(`<text x="54" y="96" class="sketch-loop-heading" font-size="24" fill="#3b6998">LUỒNG THỰC THI</text>`);
  visibleNodes.forEach((node, index) => {
    const x = 40 + index * (cardWidth + gap);
    if (index < visibleNodes.length - 1) {
      const nextX = 40 + (index + 1) * (cardWidth + gap);
      content.push(sketchCurvedArrow(x + cardWidth + 6, y + cardHeight / 2, (x + cardWidth + nextX) / 2, y + cardHeight / 2 - 26, nextX - 6, y + cardHeight / 2, { seed: `flow_arrow_${nodes[index].id}` }));
    }
    content.push(sketchNode(node, x, y, cardWidth, cardHeight, SKETCH_COLORS[index % SKETCH_COLORS.length], `BƯỚC 0${index + 1}`, `flow_${node.id}`));
  });
  return content.join('');
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

function InstructorVisualPanel({ visual, visibleCount }: { visual: InstructorVisual; visibleCount: number }) {
  if (visual.kind === 'text-slide') {
    const pointStartIndex = 1 + (visual.metrics?.length || 0);
    const questionIndex = pointStartIndex + (visual.points?.length || 0);

    return (
      <div className="mx-auto flex w-full flex-1 flex-col justify-center gap-4 py-2 sm:gap-5">
        <RevealCard visible={visibleCount >= 1}>
          <Card className="rounded-2xl border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white p-5 shadow-sm sm:p-8">
            {visual.eyebrow && (
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-sky-700 sm:text-sm">
                {visual.eyebrow}
              </p>
            )}
            <p className="max-w-6xl text-xl font-extrabold leading-snug text-stone-900 sm:text-3xl sm:leading-relaxed lg:text-4xl">
              {visual.lead}
            </p>
          </Card>
        </RevealCard>

        {visual.metrics && visual.metrics.length > 0 && (
          <div className={`grid gap-3 ${visual.metrics.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {visual.metrics.map((metric, index) => {
              const visible = visibleCount >= index + 2;
              return (
                <RevealCard key={metric.label} visible={visible}>
                  <Card className="h-full items-center justify-center rounded-2xl border-stone-200 bg-white px-3 py-4 text-center shadow-sm sm:py-6">
                    <strong className="text-3xl font-black tracking-tight text-sky-700 sm:text-5xl">{metric.value}</strong>
                    <span className="mt-1 text-xs font-bold leading-5 text-stone-600 sm:text-base">{metric.label}</span>
                  </Card>
                </RevealCard>
              );
            })}
          </div>
        )}

        {visual.points && visual.points.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {visual.points.map((point, index) => {
              const visible = visibleCount >= pointStartIndex + index + 1;
              return (
                <RevealCard key={point.title} visible={visible}>
                  <Card className="h-full flex-row items-start gap-3 rounded-2xl border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sm font-black text-sky-800">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold leading-6 text-stone-900 sm:text-lg">{point.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-stone-600 sm:text-base">{point.detail}</p>
                    </div>
                  </Card>
                </RevealCard>
              );
            })}
          </div>
        )}

        {visual.question && (
          <RevealCard visible={visibleCount >= questionIndex + 1}>
            <Card className="rounded-2xl border-amber-300 bg-amber-50 px-5 py-4 shadow-sm sm:px-7 sm:py-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Câu hỏi dẫn đường</p>
              <p className="mt-1.5 text-lg font-extrabold leading-snug text-stone-900 sm:text-2xl">{visual.question}</p>
            </Card>
          </RevealCard>
        )}

        {visual.note && visibleCount >= visualEntryCount(visual) && (
          <p className="text-center text-xs leading-5 text-stone-500 sm:text-sm">{visual.note}</p>
        )}
      </div>
    );
  }

  if (visual.kind === 'process-memory') {
    return (
      <Card className="gap-3 overflow-hidden rounded-2xl border-sky-200 bg-gradient-to-b from-sky-50 to-white p-3 text-stone-900 shadow-sm sm:p-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">Không gian địa chỉ</p>
            <h3 className="text-base font-black sm:text-lg">Một process · nhiều thread</h3>
          </div>
          <Badge variant="outline" className="border-sky-200 bg-white text-sky-800">PID</Badge>
        </div>
        <div className="h-[230px] overflow-hidden rounded-xl border border-sky-100 bg-white sm:h-[310px]">
          <Suspense fallback={<div className="p-6 text-sm text-stone-600">Đang dựng mô phỏng process và thread…</div>}>
            <ProcessMemory3DScene regions={visual.regions.slice(0, visibleCount)} />
          </Suspense>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {visual.regions.slice(0, visibleCount).map((region) => (
            <RevealCard key={region.id} visible>
              <div className="h-full rounded-lg border border-stone-200 bg-white px-2 py-2 sm:px-3">
                <strong className="text-[11px] font-extrabold sm:text-xs">{region.title}</strong>
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-stone-600 sm:text-xs sm:leading-5">{region.detail}</p>
              </div>
            </RevealCard>
          ))}
        </div>
      </Card>
    );
  }

  if (visual.kind === 'flow') return <SketchMarkup markup={flowSketch(visual.nodes, visibleCount)} label="Luồng thực thi vẽ tay" />;
  if (visual.kind === 'cycle') return <SketchMarkup markup={cycleSketch(visual, visibleCount)} label="Vòng lặp thực thi" />;
  if (visual.kind === 'decision-tree') return <SketchMarkup markup={decisionTreeSketch(visual, visibleCount)} label="Cây quyết định" />;
  if (visual.kind === 'architecture-comparison') return <SketchMarkup markup={architectureSketch(visual, visibleCount)} label="Đối chiếu hai luồng kiến trúc" />;
  if (visual.kind === 'comparison') return <SketchMarkup markup={comparisonSketch(visual, visibleCount)} label="Sơ đồ đối chiếu" />;
  if (visual.kind === 'latency-scale') return <SketchMarkup markup={latencySketch(visual, visibleCount)} label="Thang độ trễ" />;
  if (visual.kind === 'timeline') return <SketchMarkup markup={timelineSketch(visual, visibleCount)} label="Dòng thời gian" />;
  if (visual.kind === 'memory-map') return <SketchMarkup markup={memoryMapSketch(visual.regions, visibleCount)} label="Bản đồ bộ nhớ" />;
  return <SketchMarkup markup={connectionModelSketch(visual, visibleCount)} label="Mô hình connection và tài nguyên" />;
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
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
            {!props.continuousLesson && (
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-600 px-2.5 py-0.5 text-[13px] font-extrabold text-white">
                  PHẦN {props.stepIndex + 1}/{props.totalSteps}
                </span>
                <span className="max-w-[520px] truncate text-sm font-bold text-stone-800">
                  {props.stepTitle}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'keypoints', label: 'Ý chính', icon: Lightbulb },
                  { id: 'diagram', label: 'Sơ đồ', icon: GitBranch },
                  { id: 'code', label: 'Code', icon: Code2 }
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = props.boardMode === tab.id;
                return (
                  <Button
                    variant="ghost"
                    size="auto"
                    key={tab.id}
                    type="button"
                    onClick={() => props.onSwitchBoardMode?.(tab.id)}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-bold ${
                      active
                        ? 'bg-sky-600 text-white'
                        : 'border border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-white">
            <div
              className="grid h-full min-h-0 w-full grid-cols-1 overflow-y-auto p-3 sm:p-4 lg:p-5"
              style={{
                backgroundImage: 'radial-gradient(#d6dde6 0.8px, transparent 0.8px)',
                backgroundSize: '18px 18px'
              }}
            >
              <div className="flex min-h-full w-full flex-col">
                {props.boardMode === 'keypoints' && props.instructorVisual && (
                  <div className="mx-auto flex min-h-full w-full max-w-none flex-1 flex-col py-1">
                    <div className="mb-3 shrink-0">
                      <h2 className="text-[clamp(1.45rem,2.25vw,2.8rem)] font-black leading-tight text-stone-900">
                        {props.slideTitle || 'Nội dung bài học'}
                      </h2>
                      {props.slideSubtitle && (
                        <p className="mt-1.5 text-sm font-medium leading-6 text-stone-600 sm:text-base">
                          {props.slideSubtitle}
                        </p>
                      )}
                    </div>
                    <InstructorVisualPanel
                      visual={props.instructorVisual}
                      visibleCount={props.visualRevealCount ?? 0}
                    />
                    {(props.visualRevealCount ?? 0) > 0 && props.instructorVisual.kind !== 'architecture-comparison' && props.instructorVisual.kind !== 'text-slide' && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="mt-4 flex-row items-start gap-3 rounded-xl border-amber-200 bg-amber-50/80 p-4 text-stone-900 shadow-none">
                          <Lightbulb className="mt-0.5 shrink-0 text-amber-700" size={17} />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">Điểm cần nhớ</p>
                            <p className="mt-1 text-sm font-bold leading-6 sm:text-base">{props.slideTakeaway}</p>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </div>
                )}

                {props.boardMode === 'keypoints' && !props.instructorVisual && (
                  <div className="mx-auto flex min-h-full w-full max-w-none flex-col justify-center py-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-sm font-black text-white shadow-sm">
                        {String((props.slideIndex ?? props.activePointIndex) + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sky-700">
                          {props.lessonTitle}
                        </p>
                        <h2 className="mt-1 text-xl font-black leading-tight text-stone-900 sm:text-2xl lg:text-3xl">
                          {props.slideTitle || 'Nội dung bài học'}
                        </h2>
                      </div>
                    </div>
                    <div className="my-5 h-1 w-20 rounded-full bg-amber-400" />
                    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white p-5 shadow-sm sm:p-7">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">
                        <Lightbulb size={15} /> Ý cốt lõi
                      </div>
                      <p className="text-lg font-bold leading-8 text-stone-900 sm:text-xl">
                        {props.slideTakeaway || props.keyPoints[props.activePointIndex] || props.keyPoints[0]}
                      </p>
                    </div>
                    {(props.slidePoints?.length ?? 0) > 0 && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {props.slidePoints?.slice(0, 4).map((point, index) => {
                          const [label, ...detailParts] = point.split(/:\s+/, 2);
                          const hasLabel = detailParts.length > 0 && label.length < 72;
                          const searchText = point.toLocaleLowerCase('vi');
                          const PointIcon = /cpu|phần cứng|bộ xử lý|processor/.test(searchText)
                            ? Cpu
                            : /bộ nhớ|cache|ram|lưu trữ/.test(searchText)
                              ? Layers
                              : /mạng|i\/o|độ trễ|latency/.test(searchText)
                                ? Network
                                : /mục tiêu|đầu ra|kết quả/.test(searchText)
                                  ? Target
                                  : /đo lường|hiệu năng|tốc độ|throughput/.test(searchText)
                                    ? Gauge
                                    : GitBranch;
                          return (
                            <article
                              key={`${point}-${index}`}
                              className="flex min-h-28 gap-3 rounded-xl border border-stone-200 bg-white/95 p-4 shadow-[0_2px_8px_rgba(28,39,54,0.04)]"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                                <PointIcon size={19} strokeWidth={2.2} />
                              </span>
                              <div className="min-w-0">
                                {hasLabel && (
                                  <h3 className="mb-1 text-sm font-extrabold text-stone-900">
                                    {label}
                                  </h3>
                                )}
                                <p className="line-clamp-4 text-sm font-medium leading-6 text-stone-600">
                                  {hasLabel ? detailParts.join(': ') : point}
                                </p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {props.boardMode === 'code' && (
                  <div className="h-full overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-2 font-mono text-[13px]">
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
                  <pre className="h-full overflow-auto rounded-xl border border-sky-200 bg-sky-50/50 p-3 font-mono text-[12px] leading-relaxed text-stone-800">
                    {props.visualDiagramText
                      .replace(/```[a-zA-Z]*\n?/g, '')
                      .replace(/```/g, '')
                      .trim()}
                  </pre>
                )}

                {props.boardMode === 'question' && (
                  <div className="flex min-h-full w-full items-center justify-center p-4 sm:p-8">
                    <div className="w-full max-w-6xl rounded-3xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm sm:p-8 lg:p-10">
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
