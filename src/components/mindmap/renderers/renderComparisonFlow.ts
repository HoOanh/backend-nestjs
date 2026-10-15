import { escapeHtml } from '../../common/CodeViewer.tsx';
import {
  computeCircleLoopArcArrow,
  sketchCenterIcon,
  sketchCurvedArrow,
  sketchLabeledNode,
  type SketchColorKey,
} from '../sketchEngine.ts';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNodeToken(raw: string): string {
  return raw
    .replace(/^[\[\(\s•\-×✓!]+|[\]\)\s]+$/g, '')
    .replace(/^(?:Luồng xử lý song hành|Bước \d+):\s*/i, '')
    .trim();
}

/**
 * Tự động rút trích đúng 4 Node cho một vòng lặp (Circular Loop) từ danh sách các dòng mô tả luồng
 */
function extractFourLoopNodes(points: string[], fallbackLabels: [string, string, string, string]): [string, string, string, string] {
  const tokens: string[] = [];

  for (const pt of points) {
    const parts = pt
      .split(/\s*(?:→|──►|->|=|:)\s*/)
      .map(cleanNodeToken)
      .filter((s) => s.length >= 3);

    for (const part of parts) {
      const normalized = part.length > 34 ? `${part.slice(0, 32).trim()}…` : part;
      if (
        normalized &&
        !tokens.some((existing) => existing.toLowerCase() === normalized.toLowerCase())
      ) {
        tokens.push(normalized);
      }
    }
  }

  if (tokens.length >= 4) {
    return [
      tokens[0],
      tokens[1],
      tokens[2],
      tokens[tokens.length - 1],
    ];
  }

  const out: string[] = [...tokens];
  let idx = 0;
  while (out.length < 4) {
    out.push(fallbackLabels[idx % 4]);
    idx++;
  }
  return [out[0], out[1], out[2], out[3]];
}

/**
 * Vẽ sơ đồ Dual-Loop Excalidraw (Inner Loop vs Outer Loop) tự động từ dữ liệu hai mô hình
 */
function buildDualLoopSketchSvg(params: {
  leftHeading: string;
  leftSub: string;
  leftNodes: [string, string, string, string];
  rightHeading: string;
  rightSub: string;
  rightNodes: [string, string, string, string];
  bridgeLabel: string;
  topFeedbackLabel: string;
  bottomFeedbackLabel: string;
  seedPrefix: string;
}): string {
  const {
    leftHeading,
    leftSub,
    leftNodes,
    rightHeading,
    rightSub,
    rightNodes,
    bridgeLabel,
    topFeedbackLabel,
    bottomFeedbackLabel,
    seedPrefix,
  } = params;

  const leftCx = 265;
  const rightCx = 815;
  const loopCy = 292;
  const radius = 148;
  const boxW = 142;
  const boxH = 74;

  // Cấu hình 4 vị trí quanh vòng tròn trái (Top -> Left -> Bottom -> Right, ngược chiều kim đồng hồ giống ảnh mẫu)
  const leftSpecs: Array<{ deg: number; label: string; color: SketchColorKey }> = [
    { deg: -90, label: leftNodes[0], color: 'blue' },
    { deg: 180, label: leftNodes[1], color: 'green' },
    { deg: 90, label: leftNodes[2], color: 'yellow' },
    { deg: 0, label: leftNodes[3], color: 'pink' },
  ];

  // Cấu hình 4 vị trí quanh vòng tròn phải (Left -> Top -> Right -> Bottom, thuận chiều kim đồng hồ giống ảnh mẫu)
  const rightSpecs: Array<{ deg: number; label: string; color: SketchColorKey }> = [
    { deg: 180, label: rightNodes[0], color: 'blue' },
    { deg: -90, label: rightNodes[1], color: 'purple' },
    { deg: 0, label: rightNodes[2], color: 'green' },
    { deg: 90, label: rightNodes[3], color: 'yellow' },
  ];

  const leftBoxesSvg = leftSpecs
    .map((sp, i) => {
      const rad = (sp.deg * Math.PI) / 180;
      const x = leftCx + radius * Math.cos(rad) - boxW / 2;
      const y = loopCy + radius * Math.sin(rad) - boxH / 2;
      return sketchLabeledNode({
        x,
        y,
        w: boxW,
        h: boxH,
        label: sp.label,
        color: sp.color,
        fontSize: 15.5,
        seed: `${seedPrefix}_L_node_${i}`,
      });
    })
    .join('');

  const leftArrowsSvg = leftSpecs
    .map((sp, i) => {
      const next = leftSpecs[(i + 1) % leftSpecs.length];
      return computeCircleLoopArcArrow({
        cx: leftCx,
        cy: loopCy,
        radius,
        fromDeg: sp.deg,
        toDeg: next.deg,
        fromBoxW: boxW,
        fromBoxH: boxH,
        toBoxW: boxW,
        toBoxH: boxH,
        options: {
          seed: `${seedPrefix}_L_arc_${i}`,
          strokeWidth: 1.85,
        },
      });
    })
    .join('');

  const rightBoxesSvg = rightSpecs
    .map((sp, i) => {
      const rad = (sp.deg * Math.PI) / 180;
      const x = rightCx + radius * Math.cos(rad) - boxW / 2;
      const y = loopCy + radius * Math.sin(rad) - boxH / 2;
      return sketchLabeledNode({
        x,
        y,
        w: boxW,
        h: boxH,
        label: sp.label,
        color: sp.color,
        fontSize: 15.5,
        seed: `${seedPrefix}_R_node_${i}`,
      });
    })
    .join('');

  const rightArrowsSvg = rightSpecs
    .map((sp, i) => {
      const next = rightSpecs[(i + 1) % rightSpecs.length];
      return computeCircleLoopArcArrow({
        cx: rightCx,
        cy: loopCy,
        radius,
        fromDeg: sp.deg,
        toDeg: next.deg,
        fromBoxW: boxW,
        fromBoxH: boxH,
        toBoxW: boxW,
        toBoxH: boxH,
        options: {
          seed: `${seedPrefix}_R_arc_${i}`,
          strokeWidth: 1.85,
        },
      });
    })
    .join('');

  // 1. Mũi tên thẳng ở chính giữa nối Node Phải của Vòng 1 -> Node Trái của Vòng 2
  const leftRightNodeEdgeX = leftCx + radius + boxW / 2 + 8;
  const rightLeftNodeEdgeX = rightCx - radius - boxW / 2 - 8;
  const centerBridgeArrow = sketchCurvedArrow(
    leftRightNodeEdgeX,
    loopCy,
    (leftRightNodeEdgeX + rightLeftNodeEdgeX) / 2,
    loopCy - 2,
    rightLeftNodeEdgeX,
    loopCy,
    {
      label: bridgeLabel,
      labelOffsetY: -16,
      labelFontSize: 15.5,
      seed: `${seedPrefix}_center_bridge`,
    }
  );

  // 2. Mũi tên cong nét đứt phía trên (Feedback / Contrast Loop từ Vòng 2 sang Vòng 1)
  const topDashedArrow = sketchCurvedArrow(
    rightCx - radius * 0.65,
    loopCy - radius * 0.72,
    (leftCx + rightCx) / 2,
    loopCy - radius - 42,
    leftCx + radius * 0.65,
    loopCy - radius * 0.72,
    {
      dashed: true,
      label: topFeedbackLabel,
      labelOffsetY: -22,
      labelFontSize: 15,
      seed: `${seedPrefix}_top_dashed`,
    }
  );

  // 3. Mũi tên cong nét đứt phía dưới (Feedback / Root Cause Loop từ Vòng 2 về Vòng 1)
  const bottomDashedArrow = sketchCurvedArrow(
    rightCx - boxW / 2 - 12,
    loopCy + radius + 6,
    (leftCx + rightCx) / 2,
    loopCy + radius + 64,
    leftCx + boxW / 2 + 12,
    loopCy + radius + 6,
    {
      dashed: true,
      label: bottomFeedbackLabel,
      labelOffsetY: -18,
      labelFontSize: 15,
      seed: `${seedPrefix}_bottom_dashed`,
    }
  );

  const leftIconSvg = sketchCenterIcon('laptop', leftCx, loopCy, 1.05);
  const rightIconSvg = sketchCenterIcon('cloud', rightCx, loopCy, 1.08);

  return `
    <div class="sketch-canvas-wrapper">
      <svg class="excalidraw-sketch-svg" viewBox="0 0 1080 545" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ vòng lặp đối chiếu kiến trúc">
        <!-- Tiêu đề góc trái (INNER / LEGACY LOOP) -->
        <g transform="translate(145, 34)">
          <text x="0" y="0" text-anchor="middle" class="sketch-loop-heading sketch-heading-blue">${escapeHtml(leftHeading)}</text>
          <text x="0" y="22" text-anchor="middle" class="sketch-loop-subheading sketch-heading-blue">${escapeHtml(leftSub)}</text>
        </g>

        <!-- Tiêu đề góc phải (OUTER / MODERN LOOP) -->
        <g transform="translate(925, 34)">
          <text x="0" y="0" text-anchor="middle" class="sketch-loop-heading sketch-heading-green">${escapeHtml(rightHeading)}</text>
          <text x="0" y="22" text-anchor="middle" class="sketch-loop-subheading sketch-heading-green">${escapeHtml(rightSub)}</text>
        </g>

        <!-- Biểu tượng vẽ tay ở tâm 2 vòng tròn -->
        ${leftIconSvg}
        ${rightIconSvg}

        <!-- Các cung mũi tên tròn và mũi tên liên thông -->
        ${leftArrowsSvg}
        ${rightArrowsSvg}
        ${centerBridgeArrow}
        ${topDashedArrow}
        ${bottomDashedArrow}

        <!-- Các khối hộp Pastel vẽ tay -->
        ${leftBoxesSvg}
        ${rightBoxesSvg}
      </svg>
    </div>
  `;
}

/**
 * Renderer: So Sánh Mô Hình Kiến Trúc (Dual-Loop Excalidraw Sketch + Comparison Summary)
 */
export function renderComparisonFlow(text: string, title?: string): string {
  const displayTitle =
    stripEmojis(title || '') || 'SO SÁNH MÔ HÌNH KIẾN TRÚC & DÒNG CHẢY THỰC THI';

  // Trường hợp đặc thù Sơ đồ 2 Chapter 1: Thread-per-request vs Event loop
  if (text.includes('THREAD-PER-REQUEST') || text.includes('APACHE / PHP-FPM')) {
    const dualLoopSvg = buildDualLoopSketchSvg({
      leftHeading: 'MÔ HÌNH CŨ: THREAD-PER-REQUEST',
      leftSub: '(Blocking I/O • 2MB Stack / Thread)',
      leftNodes: [
        'Client Request\nĐổ Về',
        'Cấp OS Thread\n(2MB Stack)',
        'Chờ Đợi I/O\n(CPU Bị Khóa)',
        'Nghẽn C10K\n(~20GB RAM)',
      ],
      rightHeading: 'MÔ HÌNH HIỆN ĐẠI: EVENT LOOP',
      rightSub: '(Non-Blocking • Epoll O(1) Demux)',
      rightNodes: [
        '1 Main Thread\nTiếp Nhận',
        'Ủy Thác Kernel\n(Linux epoll)',
        'Rảnh Tay Đón\nClient Mới',
        'Ready List\nTrả Callback',
      ],
      bridgeLabel: 'nâng cấp',
      topFeedbackLabel: 'loại bỏ hoàn toàn 10,000 luồng ngủ chờ I/O',
      bottomFeedbackLabel: 'giảm từ ~20GB RAM xuống vài chục MB & 0 Context Switch',
      seedPrefix: 'c1_l1_thread_vs_eventloop',
    });

    return `
      <div class="mindmap-container mindmap-comparison">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-comparison">DUAL-LOOP SKETCH</span>
        </div>
        <div class="mindmap-body">
          ${dualLoopSvg}
          <div class="comparison-grid">
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

            <div class="comparison-column col-modern">
              <div class="comparison-col-header header-modern">
                <span class="col-status-icon">+</span>
                <div>
                  <div class="col-title">MÔ HÌNH HIỆN ĐẠI: EVENT LOOP &amp; NON-BLOCKING I/O</div>
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

  // Parser thông minh cho mọi sơ đồ So Sánh (4.2) trong toàn bộ giáo trình
  function normalizeBlockLines(
    rawLines: string[],
    defaultHeader: string
  ): { headerTitle: string; points: string[] } {
    const cleaned = rawLines
      .map((l) => stripEmojis(l.trim()))
      .filter(
        (l) =>
          l.length > 0 &&
          !l.startsWith('┌') &&
          !l.startsWith('└─') &&
          !l.startsWith('├─')
      );

    let headerTitle = defaultHeader;
    let bodyLines = cleaned;

    if (
      cleaned.length > 0 &&
      /^(?:MÔ HÌNH|KỊCH BẢN|THIẾT KẾ|PHƯƠNG ÁN|CÁCH TIẾP CẬN|KIẾN TRÚC)[^:]*:/i.test(
        cleaned[0]
      )
    ) {
      headerTitle = cleaned[0];
      bodyLines = cleaned.slice(1);
    }

    const points: string[] = [];
    const fanInActors: string[] = [];
    let pendingFanInTarget = '';

    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];

      if (/─+┐\s*$/.test(line)) {
        const actor = line.replace(/\s*─+┐\s*$/, '').trim();
        if (actor) fanInActors.push(actor);
        continue;
      }

      if (line.includes('┼')) {
        const parts = line.split(/─*┼─*►?/);
        const actor = (parts[0] || '').trim();
        if (actor) fanInActors.push(actor);
        pendingFanInTarget = parts.slice(1).join(' → ').trim();
        continue;
      }

      if (line.includes('┘')) {
        const actor = line.replace(/\s*─+┘[\s│]*$/, '').trim();
        if (actor) fanInActors.push(actor);
        if (pendingFanInTarget) {
          points.push(
            `${fanInActors.join(', ')} → ${pendingFanInTarget.replace(/─+►/g, '→')}`
          );
          fanInActors.length = 0;
          pendingFanInTarget = '';
        }
        continue;
      }

      if (pendingFanInTarget) {
        points.push(
          `${fanInActors.join(', ')} → ${pendingFanInTarget.replace(/─+►/g, '→')}`
        );
        fanInActors.length = 0;
        pendingFanInTarget = '';
      }

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
      points.push(
        `${fanInActors.join(', ')} → ${pendingFanInTarget.replace(/─+►/g, '→')}`
      );
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

  const leftParsed = normalizeBlockLines(
    leftRaw,
    'MÔ HÌNH CŨ / RỦI RO NGHẼN HIỆU NĂNG'
  );
  const rightParsed = normalizeBlockLines(
    rightRaw,
    'MÔ HÌNH HIỆN ĐẠI / KIẾN TRÚC CHUẨN PRODUCTION'
  );

  const leftShortHeader =
    leftParsed.headerTitle.length > 36
      ? `${leftParsed.headerTitle.slice(0, 34).trim()}…`
      : leftParsed.headerTitle;
  const rightShortHeader =
    rightParsed.headerTitle.length > 36
      ? `${rightParsed.headerTitle.slice(0, 34).trim()}…`
      : rightParsed.headerTitle;

  const leftFourNodes = extractFourLoopNodes(leftParsed.points, [
    'Tiếp Nhận\nĐầu Vào',
    'Xử Lý Đồng Bộ\nTuần Tự',
    'Chờ Tài Nguyên\nPhản Hồi',
    'Điểm Nghẽn\nHệ Thống',
  ]);
  const rightFourNodes = extractFourLoopNodes(rightParsed.points, [
    'Điều Phối\nTức Thì',
    'Thực Thi\nTối Ưu',
    'Giải Phóng\nTài Nguyên',
    'Thông Lượng\nỔn Định',
  ]);

  const lastLeftSummary =
    leftParsed.points[leftParsed.points.length - 1] ||
    'loại bỏ điểm nghẽn kiến trúc cũ';
  const lastRightSummary =
    rightParsed.points[rightParsed.points.length - 1] ||
    'bảo toàn tài nguyên & tối ưu thông lượng';

  const topFeedback =
    lastLeftSummary.length > 52
      ? `${lastLeftSummary.slice(0, 50).trim()}…`
      : lastLeftSummary;
  const bottomFeedback =
    lastRightSummary.length > 52
      ? `${lastRightSummary.slice(0, 50).trim()}…`
      : lastRightSummary;

  const dualLoopSvg = buildDualLoopSketchSvg({
    leftHeading: leftShortHeader,
    leftSub: '(Anti-Pattern / Điểm nghẽn cũ)',
    leftNodes: leftFourNodes,
    rightHeading: rightShortHeader,
    rightSub: '(Production-Grade / Tối ưu)',
    rightNodes: rightFourNodes,
    bridgeLabel: 'tối ưu',
    topFeedbackLabel: topFeedback,
    bottomFeedbackLabel: bottomFeedback,
    seedPrefix: displayTitle,
  });

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
        const icon = isDanger
          ? idx === ptLines.length - 1 && line.includes('=')
            ? '!'
            : '×'
          : '✓';
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
        <span class="mindmap-badge badge-comparison">DUAL-LOOP SKETCH</span>
      </div>
      <div class="mindmap-body">
        ${dualLoopSvg}
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
