import { escapeHtml } from '../../common/CodeViewer.tsx';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fallback Blueprint: Sơ Đồ Khối Đồ Họa Thanh Lịch (Thích Ứng Light/Dark Theme)
 */
export function renderCleanBlueprint(text: string, title?: string): string {
  const displayTitle = stripEmojis(title || '') || 'BẢN VẼ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE BLUEPRINT)';
  const cleanDiagram = escapeHtml(text.replace(/^\n+|\n+$/g, ''));

  return `
    <div class="mindmap-container mindmap-blueprint-view">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-blueprint">TECHNICAL BLUEPRINT</span>
      </div>
      <div class="mindmap-body blueprint-body-styled">
        <pre class="blueprint-diagram-text">${cleanDiagram}</pre>
      </div>
    </div>
  `;
}
