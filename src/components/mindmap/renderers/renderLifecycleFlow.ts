import { escapeHtml } from '../../common/CodeViewer.tsx';
import type { ParsedFlowStep } from '../types.ts';
import {
  computeCircleLoopArcArrow,
  sketchCenterIcon,
  sketchCurvedArrow,
  sketchLabeledNode,
  type SketchColorKey,
} from '../sketchEngine.ts';
import { renderCleanBlueprint } from './renderCleanBlueprint.ts';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LOOP_COLORS: SketchColorKey[] = [
  'blue',
  'green',
  'yellow',
  'pink',
  'purple',
  'mint',
];

function buildLifecycleLoopSketchSvg(
  steps: ParsedFlowStep[],
  seedPrefix: string
): string {
  const displaySteps = steps.slice(0, 6);
  const count = Math.max(3, displaySteps.length);
  const svgW = 1040;
  const svgH = 470;
  const cx = svgW / 2;
  const cy = 242;
  const radius = 158;
  const boxW = 156;
  const boxH = 74;

  const nodesSvg: string[] = [];
  const arrowsSvg: string[] = [];

  for (let i = 0; i < count; i++) {
    const step = displaySteps[i] || {
      stepNumber: i + 1,
      title: `Phase 0${i + 1}`,
      subtitle: 'Execution Tick',
    };
    const deg = -90 + (i * 360) / count;
    const nextDeg = -90 + (((i + 1) % count) * 360) / count;
    const rad = (deg * Math.PI) / 180;
    const x = cx + radius * Math.cos(rad) - boxW / 2;
    const y = cy + radius * Math.sin(rad) - boxH / 2;

    nodesSvg.push(
      sketchLabeledNode({
        x,
        y,
        w: boxW,
        h: boxH,
        label: step.title,
        badge: `STEP 0${step.stepNumber}`,
        color: LOOP_COLORS[i % LOOP_COLORS.length],
        fontSize: 15,
        seed: `${seedPrefix}_flow_node_${i}`,
      })
    );

    const isClosingLoop = i === count - 1;
    arrowsSvg.push(
      computeCircleLoopArcArrow({
        cx,
        cy,
        radius,
        fromDeg: deg,
        toDeg: nextDeg,
        fromBoxW: boxW,
        fromBoxH: boxH,
        toBoxW: boxW,
        toBoxH: boxH,
        options: {
          dashed: isClosingLoop,
          label: isClosingLoop ? 'chu kỳ tiếp theo' : undefined,
          labelOffsetY: -12,
          labelFontSize: 13.5,
          seed: `${seedPrefix}_flow_arc_${i}`,
        },
      })
    );
  }

  const centerIcon = sketchCenterIcon('cpu', cx, cy, 1.1);
  const leftLaptop = sketchCenterIcon('laptop', 120, cy, 0.9);
  const rightCloud = sketchCenterIcon('cloud', svgW - 120, cy, 0.95);

  const entryArrow = sketchCurvedArrow(
    170,
    cy - 10,
    255,
    cy - 85,
    cx - radius * 0.85,
    cy - radius * 0.55,
    {
      dashed: true,
      label: 'incoming events',
      labelOffsetY: -14,
      labelFontSize: 14,
      seed: `${seedPrefix}_entry_arrow`,
    }
  );

  const exitArrow = sketchCurvedArrow(
    cx + radius * 0.85,
    cy - radius * 0.55,
    svgW - 255,
    cy - 85,
    svgW - 170,
    cy - 10,
    {
      dashed: true,
      label: 'io callbacks / response',
      labelOffsetY: -14,
      labelFontSize: 14,
      seed: `${seedPrefix}_exit_arrow`,
    }
  );

  return `
    <div class="sketch-canvas-wrapper">
      <svg class="excalidraw-sketch-svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ vòng lặp thực thi">
        ${centerIcon}
        ${leftLaptop}
        ${rightCloud}
        ${entryArrow}
        ${exitArrow}
        ${arrowsSvg.join('')}
        ${nodesSvg.join('')}
      </svg>
    </div>
  `;
}

/**
 * Renderer: Dòng Chảy Quy Trình Tuần Tự (Step-by-step Execution Pipeline - Excalidraw Loop)
 */
export function renderLifecycleFlow(text: string, title?: string): string {
  const displayTitle =
    stripEmojis(title || '') ||
    'DÒNG CHẢY QUY TRÌNH THỰC THI (EXECUTION PIPELINE)';
  const lines = text
    .split('\n')
    .map((l) => stripEmojis(l.trim()))
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith('┌') &&
        !l.startsWith('└') &&
        !l.startsWith('├')
    );

  const steps: ParsedFlowStep[] = [];
  let stepCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const clean = raw
      .replace(/[│┌└├▼▲\─►\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length > 3 && !clean.startsWith('---')) {
      stepCount++;
      const parts = clean.split(':');
      steps.push({
        stepNumber: stepCount,
        title: parts[0].trim(),
        subtitle: parts.length > 1 ? parts.slice(1).join(':').trim() : undefined,
      });
    }
  }

  if (steps.length === 0) {
    return renderCleanBlueprint(text, displayTitle);
  }

  const loopSvg = buildLifecycleLoopSketchSvg(steps, displayTitle);

  const stepsHtml = steps
    .map((s, idx) => {
      const isLast = idx === steps.length - 1;
      return `
        <div class="flow-step-node">
          <div class="flow-step-card">
            <span class="flow-step-number">${String(s.stepNumber).padStart(2, '0')}</span>
            <div class="flow-step-content">
              <div class="flow-step-title">${escapeHtml(s.title)}</div>
              ${s.subtitle ? `<div class="flow-step-desc">${escapeHtml(s.subtitle)}</div>` : ''}
            </div>
          </div>
          ${!isLast ? '<div class="flow-step-arrow">→</div>' : ''}
        </div>
      `;
    })
    .join('');

  return `
    <div class="mindmap-container mindmap-lifecycle-flow">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-flow">CYCLE LOOP SKETCH</span>
      </div>
      <div class="mindmap-body">
        ${loopSvg}
        <div class="flow-steps-track">
          ${stepsHtml}
        </div>
      </div>
    </div>
  `;
}
