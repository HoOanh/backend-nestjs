import { escapeHtml } from '../../common/CodeViewer.tsx';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Renderer: So Sánh Mô Hình Kiến Trúc 2 Cột (Side-by-side Comparison Matrix)
 */
export function renderComparisonFlow(text: string, title?: string): string {
  const displayTitle = stripEmojis(title || '') || 'SO SÁNH MÔ HÌNH KIẾN TRÚC & DÒNG CHẢY THỰC THI';

  // Trường hợp đặc thù Sơ đồ 2 Chapter 1: Thread-per-request vs Event loop
  if (text.includes('THREAD-PER-REQUEST') || text.includes('APACHE / PHP-FPM')) {
    return `
      <div class="mindmap-container mindmap-comparison">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-comparison">COMPARISON MATRIX</span>
        </div>
        <div class="mindmap-body">
          <div class="comparison-grid">
            <!-- CỘT TRUYỀN THỐNG -->
            <div class="comparison-column col-legacy">
              <div class="comparison-col-header header-legacy">
                <span class="col-status-icon">−</span>
                <div>
                  <div class="col-title">MÔ HÌNH CŨ: THREAD-PER-REQUEST (APACHE / PHP-FPM)</div>
                  <div class="col-sub">Mỗi client kết nối chiếm 1 luồng hệ điều hành riêng biệt (1-2MB Stack)</div>
                </div>
              </div>
              <div class="comparison-col-content">
                <div class="comparison-point-row">
                  <span class="point-icon">×</span>
                  <span class="point-text"><strong>Client 1 → [ OS Thread 1 (2MB Stack) ] → Chờ I/O:</strong> Luồng bị khóa cứng (Block) trong lúc chờ đĩa hoặc mạng.</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">×</span>
                  <span class="point-text"><strong>Client 2 → [ OS Thread 2 (2MB Stack) ] → Chờ I/O:</strong> Cấp phát thêm luồng mới, tăng chi phí chuyển ngữ cảnh CPU.</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">!</span>
                  <span class="point-text"><strong>Giới hạn C10K:</strong> 10,000 kết nối đồng thời tiêu tốn ~20GB RAM chỉ để giữ Call Stack của các luồng đang chờ I/O.</span>
                </div>
              </div>
            </div>

            <!-- CỘT HIỆN ĐẠI -->
            <div class="comparison-column col-modern">
              <div class="comparison-col-header header-modern">
                <span class="col-status-icon">+</span>
                <div>
                  <div class="col-title">MÔ HÌNH HIỆN ĐẠI: EVENT LOOP & NON-BLOCKING I/O</div>
                  <div class="col-sub">1 Main Thread duy nhất tiếp nhận kết nối, ủy thác I/O cho Linux Kernel</div>
                </div>
              </div>
              <div class="comparison-col-content">
                <div class="comparison-point-row">
                  <span class="point-icon">✓</span>
                  <span class="point-text"><strong>Client 1, 2, 3... → [ 1 Main Thread Duy Nhất ]:</strong> Tiếp nhận kết nối tức thì và đăng ký sự kiện I/O với Kernel qua epoll.</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">✓</span>
                  <span class="point-text"><strong>Phi chặn (Non-blocking):</strong> Main Thread quay lại Event Loop xử lý ngay các kết nối tiếp theo mà không chờ I/O hoàn tất.</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">✓</span>
                  <span class="point-text"><strong>Tối ưu tài nguyên:</strong> 10,000 kết nối đồng thời chỉ tiêu tốn vài chục MB RAM, giảm thiểu chi phí Context Switching.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Parser tổng quát cho các so sánh khác
  const lines = text
    .split('\n')
    .map((l) => stripEmojis(l.trim()))
    .filter((l) => l.length > 0 && !l.startsWith('┌') && !l.startsWith('└') && !l.startsWith('├'));

  const mid = Math.ceil(lines.length / 2);
  const leftLines = lines.slice(0, mid);
  const rightLines = lines.slice(mid);

  const renderPoints = (ptLines: string[], isDanger: boolean) => {
    return ptLines
      .map((line) => {
        const clean = line.replace(/^[│├──└──\[\]\s\─►]+/, '').trim();
        if (!clean) return '';
        const icon = isDanger ? '×' : '✓';
        return `
          <div class="comparison-point-row">
            <span class="point-icon">${icon}</span>
            <span class="point-text">${escapeHtml(clean)}</span>
          </div>
        `;
      })
      .join('');
  };

  return `
    <div class="mindmap-container mindmap-comparison">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-comparison">COMPARISON MATRIX</span>
      </div>
      <div class="mindmap-body">
        <div class="comparison-grid">
          <div class="comparison-column col-legacy">
            <div class="comparison-col-header header-legacy">
              <span class="col-status-icon">−</span>
              <div>
                <div class="col-title">MÔ HÌNH TRUYỀN THỐNG / RỦI RO NGHẼN</div>
                <div class="col-sub">Hạn chế về tài nguyên & chi phí I/O cao</div>
              </div>
            </div>
            <div class="comparison-col-content">
              ${renderPoints(leftLines, true)}
            </div>
          </div>

          <div class="comparison-column col-modern">
            <div class="comparison-col-header header-modern">
              <span class="col-status-icon">+</span>
              <div>
                <div class="col-title">MÔ HÌNH HIỆN ĐẠI TỐI ƯU (RECOMMENDED)</div>
                <div class="col-sub">Non-blocking, Event-Driven & Hiệu năng cao</div>
              </div>
            </div>
            <div class="comparison-col-content">
              ${renderPoints(rightLines, false)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
