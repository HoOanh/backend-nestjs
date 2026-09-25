import { escapeHtml } from '../../common/CodeViewer.tsx';

/**
 * Renderer: So Sánh Mô Hình Kiến Trúc 2 Cột (Side-by-side Comparison Matrix)
 */
export function renderComparisonFlow(text: string, title?: string): string {
  const displayTitle = title || 'SO SÁNH MÔ HÌNH KIẾN TRÚC & DÒNG CHẢY THỰC THI';

  // Trường hợp đặc thù Sơ đồ 2 Chapter 1: Thread-per-request vs Event loop
  if (text.includes('THREAD-PER-REQUEST') || text.includes('APACHE / PHP-FPM')) {
    return `
      <div class="mindmap-container mindmap-comparison">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon">🔄</span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-comparison">COMPARISON MATRIX</span>
        </div>
        <div class="mindmap-body">
          <div class="comparison-grid">
            <!-- CỘT TRUYỀN THỐNG -->
            <div class="comparison-column col-legacy">
              <div class="comparison-col-header header-legacy">
                <span class="col-status-icon">⚠️</span>
                <div>
                  <div class="col-title">MÔ HÌNH CŨ: THREAD-PER-REQUEST (APACHE / PHP-FPM)</div>
                  <div class="col-sub">Mỗi client kết nối ngốn 1 luồng hệ điều hành riêng biệt (1-2MB Stack)</div>
                </div>
              </div>
              <div class="comparison-col-content">
                <div class="comparison-point-row">
                  <span class="point-icon">❌</span>
                  <span class="point-text"><strong>Client 1 ──► [ OS Thread 1 (2MB Stack) ] ──► Chờ I/O:</strong> CPU bị khóa cứng (Block) không làm gì trong lúc chờ đĩa/mạng.</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">❌</span>
                  <span class="point-text"><strong>Client 2 ──► [ OS Thread 2 (2MB Stack) ] ──► Chờ I/O:</strong> CPU tiếp tục bị nghẽn, lãng phí hàng chục triệu chu kỳ xung nhịp.</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">💥</span>
                  <span class="point-text"><strong>Rào cản C10K sụp đổ:</strong> 10,000 Users = Lãng phí 20GB RAM chỉ để giữ các Call Stack của luồng đang ngủ! Chi phí Context Switching tốn 70% CPU.</span>
                </div>
              </div>
            </div>

            <!-- CỘT HIỆN ĐẠI -->
            <div class="comparison-column col-modern">
              <div class="comparison-col-header header-modern">
                <span class="col-status-icon">🚀</span>
                <div>
                  <div class="col-title">MÔ HÌNH HIỆN ĐẠI: EVENT LOOP & NON-BLOCKING I/O</div>
                  <div class="col-sub">1 Main Thread duy nhất tiếp nhận tất cả kết nối, ủy thác I/O cho Linux Kernel</div>
                </div>
              </div>
              <div class="comparison-col-content">
                <div class="comparison-point-row">
                  <span class="point-icon">✅</span>
                  <span class="point-text"><strong>Client 1, 2, 3... ──► [ 1 Main Thread Duy Nhất ]:</strong> Tiếp nhận kết nối tức thì và giao việc chờ I/O cho Kernel thông qua \`epoll\`.</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">✅</span>
                  <span class="point-text"><strong>Không bao giờ ngủ (Never Sleep):</strong> Main Thread lập tức rảnh tay quay lại Event Loop đón tiếp Client 4, 5, 6...</span>
                </div>
                <div class="comparison-point-row">
                  <span class="point-icon">🏆</span>
                  <span class="point-text"><strong>Bứt phá hiệu năng:</strong> 10,000 Users chỉ tốn vài chục MB RAM. 0% chi phí chuyển đổi ngữ cảnh (Context Switching Overhead = 0).</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Parser tổng quát cho các so sánh khác
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('┌') && !l.startsWith('└') && !l.startsWith('├'));

  const mid = Math.ceil(lines.length / 2);
  const leftLines = lines.slice(0, mid);
  const rightLines = lines.slice(mid);

  const renderPoints = (ptLines: string[], isDanger: boolean) => {
    return ptLines
      .map((line) => {
        const clean = line.replace(/^[│├──└──\[\]\s\─►]+/, '').trim();
        if (!clean) return '';
        const icon = isDanger ? '❌' : '✅';
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
          <span class="mindmap-type-icon">🔄</span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-comparison">COMPARISON MATRIX</span>
      </div>
      <div class="mindmap-body">
        <div class="comparison-grid">
          <div class="comparison-column col-legacy">
            <div class="comparison-col-header header-legacy">
              <span class="col-status-icon">⚠️</span>
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
              <span class="col-status-icon">🚀</span>
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
