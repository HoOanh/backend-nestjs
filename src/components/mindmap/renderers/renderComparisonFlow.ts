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

  // Parser thông minh cho mọi sơ đồ So Sánh (4.2)
  function normalizeBlockLines(rawLines: string[], defaultHeader: string): { headerTitle: string; points: string[] } {
    const cleaned = rawLines
      .map((l) => stripEmojis(l.trim()))
      .filter((l) => l.length > 0 && !l.startsWith('┌') && !l.startsWith('└─') && !l.startsWith('├─'));

    let headerTitle = defaultHeader;
    let bodyLines = cleaned;

    if (
      cleaned.length > 0 &&
      /^(?:MÔ HÌNH|KỊCH BẢN|THIẾT KẾ|PHƯƠNG ÁN|CÁCH TIẾP CẬN|KIẾN TRÚC)[^:]*:/i.test(cleaned[0])
    ) {
      headerTitle = cleaned[0];
      bodyLines = cleaned.slice(1);
    }

    const points: string[] = [];
    const fanInActors: string[] = [];
    let pendingFanInTarget = '';

    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];

      // Dòng mở đầu nhánh gộp: "Record 1 ──┐"
      if (/─+┐\s*$/.test(line)) {
        const actor = line.replace(/\s*─+┐\s*$/, '').trim();
        if (actor) fanInActors.push(actor);
        continue;
      }

      // Dòng giữa nhánh gộp: "Record 2 ──┼──► [ Target ] ──► ..."
      if (line.includes('┼')) {
        const parts = line.split(/─*┼─*►?/);
        const actor = (parts[0] || '').trim();
        if (actor) fanInActors.push(actor);
        pendingFanInTarget = parts.slice(1).join(' → ').trim();
        continue;
      }

      // Dòng đóng nhánh gộp: "Record 3 ──┘               │"
      if (line.includes('┘')) {
        const actor = line.replace(/\s*─+┘[\s│]*$/, '').trim();
        if (actor) fanInActors.push(actor);
        if (pendingFanInTarget) {
          points.push(`${fanInActors.join(', ')} → ${pendingFanInTarget.replace(/─+►/g, '→')}`);
          fanInActors.length = 0;
          pendingFanInTarget = '';
        }
        continue;
      }

      // Nếu còn nhánh gộp chưa đóng thì đẩy ra
      if (pendingFanInTarget) {
        points.push(`${fanInActors.join(', ')} → ${pendingFanInTarget.replace(/─+►/g, '→')}`);
        fanInActors.length = 0;
        pendingFanInTarget = '';
      }

      // Dòng nhánh rẽ phụ: "└──► Luôn hoạt động ────► ..."
      if (/^[└├]─+►/.test(line)) {
        const branchFlow = line
          .replace(/^[└├]─+►\s*/, '')
          .replace(/\s*─+►\s*/g, ' → ')
          .trim();
        if (branchFlow) {
          points.push(`Luồng xử lý song hành: ${branchFlow}`);
        }
        continue;
      }

      const normalLine = line
        .replace(/^[│├──└──\s]+/, '')
        .replace(/\s*─+►\s*/g, ' → ')
        .trim();
      if (normalLine) {
        points.push(normalLine);
      }
    }

    if (pendingFanInTarget) {
      points.push(`${fanInActors.join(', ')} → ${pendingFanInTarget.replace(/─+►/g, '→')}`);
    }

    return { headerTitle, points };
  }

  const allRawLines = text.trim().split(/\r?\n/);
  let splitIndex = -1;

  for (let i = 1; i < allRawLines.length; i++) {
    const trimmed = allRawLines[i].trim();
    if (
      /^(?:MÔ HÌNH HIỆN ĐẠI|MÔ HÌNH MỚI|MÔ HÌNH CHUẨN|KỊCH BẢN 2|THIẾT KẾ CHUẨN|PHƯƠNG ÁN TỐI ƯU)/i.test(
        trimmed
      )
    ) {
      splitIndex = i;
      break;
    }
  }

  let leftRaw: string[];
  let rightRaw: string[];

  if (splitIndex !== -1) {
    leftRaw = allRawLines.slice(0, splitIndex);
    rightRaw = allRawLines.slice(splitIndex);
  } else {
    const paragraphs = text.trim().split(/\r?\n\s*\r?\n/);
    if (paragraphs.length >= 2) {
      leftRaw = paragraphs[0].split(/\r?\n/);
      rightRaw = paragraphs.slice(1).join('\n').split(/\r?\n/);
    } else {
      const nonEmpty = allRawLines.filter((l) => l.trim().length > 0);
      const mid = Math.ceil(nonEmpty.length / 2);
      leftRaw = nonEmpty.slice(0, mid);
      rightRaw = nonEmpty.slice(mid);
    }
  }

  const leftParsed = normalizeBlockLines(leftRaw, 'MÔ HÌNH CŨ / RỦI RO NGHẼN HIỆU NĂNG');
  const rightParsed = normalizeBlockLines(rightRaw, 'MÔ HÌNH HIỆN ĐẠI / KIẾN TRÚC CHUẨN PRODUCTION');

  const formatPointHtml = (pt: string): string => {
    const eqIndex = pt.indexOf(' = ');
    if (eqIndex > 0 && eqIndex < 45) {
      const head = escapeHtml(pt.slice(0, eqIndex).trim());
      const tail = escapeHtml(pt.slice(eqIndex + 3).trim());
      return `<strong>${head}:</strong> ${tail}`;
    }
    const colonIndex = pt.indexOf(': ');
    if (colonIndex > 0 && colonIndex < 45) {
      const head = escapeHtml(pt.slice(0, colonIndex).trim());
      const tail = escapeHtml(pt.slice(colonIndex + 2).trim());
      return `<strong>${head}:</strong> ${tail}`;
    }
    return escapeHtml(pt);
  };

  const renderPoints = (ptLines: string[], isDanger: boolean) => {
    return ptLines
      .map((line, idx) => {
        if (!line) return '';
        const icon = isDanger ? (idx === ptLines.length - 1 && line.includes('=') ? '!' : '×') : '✓';
        return `
          <div class="comparison-point-row">
            <span class="point-icon">${icon}</span>
            <span class="point-text">${formatPointHtml(line)}</span>
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
                <div class="col-title">${escapeHtml(leftParsed.headerTitle)}</div>
                <div class="col-sub">Phân tích điểm nghẽn tài nguyên &amp; suy thoái hiệu năng</div>
              </div>
            </div>
            <div class="comparison-col-content">
              ${renderPoints(leftParsed.points, true)}
            </div>
          </div>

          <div class="comparison-column col-modern">
            <div class="comparison-col-header header-modern">
              <span class="col-status-icon">+</span>
              <div>
                <div class="col-title">${escapeHtml(rightParsed.headerTitle)}</div>
                <div class="col-sub">Kiến trúc tối ưu thông lượng &amp; bảo toàn tài nguyên phần cứng</div>
              </div>
            </div>
            <div class="comparison-col-content">
              ${renderPoints(rightParsed.points, false)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
