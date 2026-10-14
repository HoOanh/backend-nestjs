import { escapeHtml } from '../../common/CodeViewer.tsx';
import type { ParsedFlowStep } from '../types.ts';
import { renderCleanBlueprint } from './renderCleanBlueprint.ts';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Renderer: Dòng Chảy Quy Trình Tuần Tự (Step-by-step Execution Pipeline)
 */
export function renderLifecycleFlow(text: string, title?: string): string {
  const displayTitle = stripEmojis(title || '') || 'DÒNG CHẢY QUY TRÌNH THỰC THI (EXECUTION PIPELINE)';
  const lines = text
    .split('\n')
    .map((l) => stripEmojis(l.trim()))
    .filter((l) => l.length > 0 && !l.startsWith('┌') && !l.startsWith('└') && !l.startsWith('├'));

  const steps: ParsedFlowStep[] = [];
  let stepCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const clean = raw.replace(/[│┌└├▼▲\─►\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
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
        <span class="mindmap-badge badge-flow">EXECUTION PIPELINE</span>
      </div>
      <div class="mindmap-body">
        <div class="flow-steps-track">
          ${stepsHtml}
        </div>
      </div>
    </div>
  `;
}
