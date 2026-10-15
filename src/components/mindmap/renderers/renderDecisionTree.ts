import { escapeHtml } from '../../common/CodeViewer.tsx';
import type { ParsedDecisionBranch } from '../types.ts';
import {
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

interface SketchBranchSpec {
  condition: string;
  outcomeTitle: string;
  subNote: string;
  badgeType: 'positive' | 'danger' | 'caution';
  badgeLabel: string;
}

/**
 * Tự động bố cục (Auto-Layout) và vẽ Cây Quyết Định Kỹ Thuật theo phong cách Excalidraw
 */
function buildDecisionTreeSketchSvg(
  rootQuestion: string,
  branches: SketchBranchSpec[],
  seedPrefix: string
): string {
  const count = Math.min(4, Math.max(2, branches.length));
  const items = branches.slice(0, count);
  const svgW = 1080;
  const svgH = 490;
  const centerX = svgW / 2;

  const rootW = 480;
  const rootH = 74;
  const rootX = centerX - rootW / 2;
  const rootY = 24;

  const rootNodeSvg = sketchLabeledNode({
    x: rootX,
    y: rootY,
    w: rootW,
    h: rootH,
    label: rootQuestion,
    badge: 'ĐIỂM QUYẾT ĐỊNH KIẾN TRÚC (ROOT)',
    color: 'purple',
    fontSize: 16,
    seed: `${seedPrefix}_root`,
  });

  const usableW = svgW - 100;
  const colW = usableW / count;
  const condW = Math.min(230, colW - 24);
  const condH = 66;
  const condY = 175;

  const outW = Math.min(246, colW - 16);
  const outH = 88;
  const outY = 308;

  const branchNodesSvg: string[] = [];
  const branchArrowsSvg: string[] = [];
  const colCenters: number[] = [];

  items.forEach((b, idx) => {
    const colCx = 50 + colW * idx + colW / 2;
    colCenters.push(colCx);

    const startOffset = (idx - (count - 1) / 2) * 70;
    const arrowStartX = centerX + startOffset;
    const arrowStartY = rootY + rootH + 6;
    const condTopY = condY - 6;

    // 1. Mũi tên cong từ Root Question xuống nút Điều kiện (Condition)
    branchArrowsSvg.push(
      sketchCurvedArrow(
        arrowStartX,
        arrowStartY,
        (arrowStartX + colCx) / 2,
        (arrowStartY + condTopY) / 2 - 10,
        colCx,
        condTopY,
        {
          label: `nhánh #${idx + 1}`,
          labelOffsetY: -8,
          labelFontSize: 13.5,
          seed: `${seedPrefix}_root_to_cond_${idx}`,
        }
      )
    );

    // 2. Hộp Điều kiện rẽ nhánh (Pastel Blue)
    const cleanCond = b.condition.replace(/^NẾU(?:\s+LÀ)?:\s*/i, '').trim();
    branchNodesSvg.push(
      sketchLabeledNode({
        x: colCx - condW / 2,
        y: condY,
        w: condW,
        h: condH,
        label: cleanCond,
        badge: 'ĐIỀU KIỆN RẼ NHÁNH',
        color: 'blue',
        fontSize: 14.5,
        seed: `${seedPrefix}_cond_box_${idx}`,
      })
    );

    // 3. Mũi tên từ nút Điều kiện xuống nút Kết quả (Outcome)
    branchArrowsSvg.push(
      sketchCurvedArrow(
        colCx,
        condY + condH + 6,
        colCx + (idx % 2 === 0 ? -8 : 8),
        (condY + condH + outY) / 2,
        colCx,
        outY - 6,
        {
          seed: `${seedPrefix}_cond_to_out_${idx}`,
        }
      )
    );

    // 4. Hộp Kết quả Kiến trúc (Màu theo mức độ: Green / Yellow / Pink)
    const outColor: SketchColorKey =
      b.badgeType === 'positive'
        ? 'green'
        : b.badgeType === 'danger'
          ? 'pink'
          : 'yellow';

    branchNodesSvg.push(
      sketchLabeledNode({
        x: colCx - outW / 2,
        y: outY,
        w: outW,
        h: outH,
        label: b.outcomeTitle,
        subLabel: b.subNote,
        badge: b.badgeLabel,
        color: outColor,
        fontSize: 15.5,
        seed: `${seedPrefix}_out_box_${idx}`,
      })
    );
  });

  // 5. Đường cong nét đứt phía dưới nối kết quả đầu và cuối (thể hiện đánh đổi / chuyển dịch vòng đời)
  let dashedBottomArc = '';
  if (colCenters.length >= 2) {
    const firstCx = colCenters[0];
    const lastCx = colCenters[colCenters.length - 1];
    dashedBottomArc = sketchCurvedArrow(
      firstCx + 24,
      outY + outH + 8,
      (firstCx + lastCx) / 2,
      outY + outH + 68,
      lastCx - 24,
      outY + outH + 8,
      {
        dashed: true,
        bidirectional: true,
        label: 'đánh đổi chi phí bộ nhớ, độ trễ & thông lượng xử lý',
        labelOffsetY: -14,
        labelFontSize: 14.5,
        seed: `${seedPrefix}_tradeoff_arc`,
      }
    );
  }

  const cpuIconLeft = sketchCenterIcon('cpu', 86, 62, 0.85);
  const layersIconRight = sketchCenterIcon('layers', svgW - 86, 62, 0.95);

  return `
    <div class="sketch-canvas-wrapper">
      <svg class="excalidraw-sketch-svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sơ đồ cây quyết định vẽ tay">
        ${cpuIconLeft}
        ${layersIconRight}
        ${branchArrowsSvg.join('')}
        ${dashedBottomArc}
        ${rootNodeSvg}
        ${branchNodesSvg.join('')}
      </svg>
    </div>
  `;
}

/**
 * Renderer: Cây Quyết Định Kỹ Thuật (Engineering Decision Tree - Excalidraw Sketch + Cards)
 */
export function renderDecisionTree(text: string, title?: string): string {
  const displayTitle =
    stripEmojis(title || '') ||
    'CÂY QUYẾT ĐỊNH KỸ THUẬT (ENGINEERING DECISION TREE)';

  // Trường hợp đặc thù Sơ đồ 3 Chapter 1: Phân vùng bộ nhớ V8
  if (
    text.includes('DỮ LIỆU CỦA BẠN SẼ NẰM Ở ĐÂU') ||
    text.includes('V8 STACK MEMORY') ||
    text.includes('YOUNG GENERATION')
  ) {
    const sketchSvg = buildDecisionTreeSketchSvg(
      'DỮ LIỆU CỦA TIẾN TRÌNH NẰM Ở VÙNG NHỚ NÀO?',
      [
        {
          condition: 'Kiểu Nguyên Thủy (Number, Bool, Con trỏ)',
          outcomeTitle: 'V8 STACK MEMORY',
          subNote: 'LIFO • 0% áp lực lên GC',
          badgeType: 'positive',
          badgeLabel: 'TỐI ƯU (RECOMMENDED)',
        },
        {
          condition: 'Object Ngắn Hạn (< 2 chu kỳ GC)',
          outcomeTitle: 'YOUNG GENERATION',
          subNote: 'From/To Space • Scavenge ~1ms',
          badgeType: 'positive',
          badgeLabel: 'CẤP PHÁT NHANH',
        },
        {
          condition: 'Object Sống Lâu / Singleton',
          outcomeTitle: 'OLD GENERATION',
          subNote: 'Mark-Sweep-Compact • Rủi ro Pause',
          badgeType: 'caution',
          badgeLabel: 'ĐÁNH ĐỔI VÒNG ĐỜI',
        },
      ],
      'c1_l1_v8_memory_decision_tree'
    );

    return `
      <div class="mindmap-container mindmap-decision-tree">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            </span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-tree">DECISION TREE SKETCH</span>
        </div>
        <div class="mindmap-body">
          ${sketchSvg}

          <div class="decision-branches-grid">
            <div class="decision-branch-card">
              <div class="branch-condition-strip">
                <span class="branch-arrow">→</span>
                <span class="branch-label">NẾU LÀ KIỂU NGUYÊN THỦY (Primitive: Number, Bool, Con trỏ)</span>
              </div>
              <div class="branch-outcome-card positive">
                <div class="outcome-header">
                  <span class="outcome-type-pill">TỐI ƯU (RECOMMENDED)</span>
                </div>
                <div class="outcome-action-text">
                  <strong>Lưu trữ tại [ V8 STACK MEMORY ]</strong>
                  <div>Cấp phát và giải phóng tức thì theo con trỏ Stack Pointer của CPU khi kết thúc khung hàm (LIFO).</div>
                </div>
                <div class="outcome-code-tag">0% Áp Lực Lên Garbage Collector (Zero GC Overhead)</div>
              </div>
            </div>

            <div class="decision-branch-card">
              <div class="branch-condition-strip">
                <span class="branch-arrow">→</span>
                <span class="branch-label">NẾU LÀ KIỂU PHỨC HỢP (Object, Array, Closure, Class Instance)</span>
              </div>
              <div class="branch-outcome-card caution">
                <div class="outcome-header">
                  <span class="outcome-type-pill">ĐÁNH ĐỔI VÒNG ĐỜI (TRADE-OFF)</span>
                </div>
                <div class="outcome-action-text">
                  <strong>Lưu trữ tại [ V8 HEAP SPACE ]</strong>
                  <div class="sub-branches-list">
                    <div class="sub-branch-item">
                      <strong>• Vòng đời ngắn (&lt; 2 chu kỳ GC):</strong> Nằm tại <em>Young Generation</em>. Thu gom rác bằng thuật toán Scavenge (~1ms).
                    </div>
                    <div class="sub-branch-item">
                      <strong>• Sống lâu / Singleton:</strong> Chuyển lên <em>Old Generation</em>. Thu gom bằng thuật toán Mark-Sweep-Compact (nguy cơ Stop-the-World nếu phình to).
                    </div>
                  </div>
                </div>
                <div class="outcome-code-tag">Cần kiểm soát tham chiếu tại Global Variables &amp; Event Listeners</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Parser tổng quát cho mọi Cây quyết định kỹ thuật (hỗ trợ cả ASCII Tree [ OUTCOME ] + bullets và dạng mũi tên ──►)
  const rawLines = text.split(/\r?\n/);
  const trimmedLines = rawLines
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith('│') &&
        !l.startsWith('┌') &&
        !l.startsWith('└') &&
        !l.startsWith('├') &&
        !l.startsWith('┬')
    );

  let rootQuestion = 'MỤC TIÊU / CÂU HỎI ĐIỀU PHỐI KIẾN TRÚC';
  for (let i = 0; i < Math.min(3, trimmedLines.length); i++) {
    const line = stripEmojis(
      trimmedLines[i].replace(/[│┌└├▼▲\─┬\/\\]/g, '').trim()
    );
    if (line.includes('?') || line === line.toUpperCase()) {
      rootQuestion = line;
      break;
    }
  }

  interface BoxBranch {
    condition: string;
    outcomeTitle: string;
    bullets: string[];
    badgeType: 'positive' | 'danger' | 'caution';
    badgeLabel: string;
    footerTag: string;
  }

  const boxBranches: BoxBranch[] = [];
  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const line = rawLines[lineIdx];
    const matches = [...line.matchAll(/\[\s*([^\]]+?)\s*\]/g)];
    if (matches.length === 0) continue;

    matches.forEach((m, mIdx) => {
      const outcomeTitle = stripEmojis(m[1].trim());
      const colStart = m.index ?? 0;
      const colCenter = colStart + m[0].length / 2;
      const nextMatch = matches[mIdx + 1];
      const colEnd = nextMatch
        ? (nextMatch.index ?? line.length)
        : line.length + 120;

      let condition = `NHÁNH QUYẾT ĐỊNH #${boxBranches.length + 1}`;
      for (let up = lineIdx - 1; up >= Math.max(0, lineIdx - 4); up--) {
        const upLine = rawLines[up];
        const tokens = [
          ...upLine.matchAll(/([^\s\/\\│▼▲][^\n\/\\│▼▲]*?)(?=\s{3,}|$)/g),
        ]
          .map((t) => ({
            text: stripEmojis(t[1].trim()),
            center: (t.index ?? 0) + t[1].length / 2,
            start: t.index ?? 0,
          }))
          .filter(
            (t) =>
              t.text.length >= 3 &&
              !t.text.startsWith('-') &&
              !t.text.startsWith('[') &&
              !t.text.endsWith('?')
          );

        if (tokens.length > 0) {
          let best = tokens[0];
          let bestDist = Math.abs(best.center - colCenter);
          for (const tk of tokens) {
            const d = Math.abs(tk.center - colCenter);
            if (d < bestDist) {
              best = tk;
              bestDist = d;
            }
          }
          if (bestDist < 45) {
            condition = `NẾU: ${best.text}`;
            break;
          }
        }
      }

      const bullets: string[] = [];
      for (let down = lineIdx + 1; down < rawLines.length; down++) {
        const downLine = rawLines[down];
        const subBoxes = [...downLine.matchAll(/\[\s*([^\]]+?)\s*\]/g)];
        if (
          subBoxes.some(
            (sb) =>
              (sb.index ?? 0) >= colStart - 10 && (sb.index ?? 0) < colEnd
          )
        ) {
          break;
        }

        const bulletMatches = [
          ...downLine.matchAll(
            /-\s+(.+?)(?=\s{3,}-\s+|\s{3,}[A-ZĐÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\/\\▼]|$)/g
          ),
        ];
        let foundInRow = false;
        for (const bm of bulletMatches) {
          const bStart = bm.index ?? 0;
          if (bStart >= colStart - 10 && bStart < colEnd) {
            bullets.push(stripEmojis(bm[1].trim()));
            foundInRow = true;
          }
        }
        if (!foundInRow && bullets.length > 0 && down > lineIdx + 3) {
          break;
        }
      }

      const combinedUpper = `${outcomeTitle} ${bullets.join(' ')}`.toUpperCase();
      const isPositive =
        (combinedUpper.includes('CHUẨN') ||
          combinedUpper.includes('TỐI ƯU') ||
          combinedUpper.includes('MONOMORPHIC') ||
          combinedUpper.includes('STACK') ||
          combinedUpper.includes('FAST')) &&
        !combinedUpper.includes('POLYMORPHIC');
      const isDanger =
        combinedUpper.includes('SLOW') ||
        combinedUpper.includes('DICTIONARY') ||
        combinedUpper.includes('PHÁ HỦY') ||
        combinedUpper.includes('CẤM') ||
        combinedUpper.includes('LỖI');

      const badgeType: 'positive' | 'danger' | 'caution' = isPositive
        ? 'positive'
        : isDanger
          ? 'danger'
          : 'caution';
      const badgeLabel = isPositive
        ? 'TỐI ƯU (RECOMMENDED)'
        : isDanger
          ? 'CẢNH BÁO HIỆU NĂNG'
          : 'ĐÁNH ĐỔI KIẾN TRÚC';
      const footerTag =
        bullets.length > 0
          ? bullets[bullets.length - 1]
          : 'Quyết định thiết kế cấu trúc dữ liệu & thực thi';

      boxBranches.push({
        condition,
        outcomeTitle,
        bullets,
        badgeType,
        badgeLabel,
        footerTag,
      });
    });
  }

  if (boxBranches.length >= 2) {
    const sketchSpecs: SketchBranchSpec[] = boxBranches.map((b) => ({
      condition: b.condition,
      outcomeTitle: b.outcomeTitle,
      subNote: b.bullets[0] || b.footerTag,
      badgeType: b.badgeType,
      badgeLabel: b.badgeLabel,
    }));

    const sketchSvg = buildDecisionTreeSketchSvg(
      rootQuestion,
      sketchSpecs,
      displayTitle
    );

    const cardsHtml = boxBranches
      .map((b) => {
        const bulletsHtml = b.bullets
          .map(
            (item) => `
              <div class="sub-branch-item">
                <strong>•</strong> ${escapeHtml(item)}
              </div>
            `
          )
          .join('');

        return `
          <div class="decision-branch-card">
            <div class="branch-condition-strip">
              <span class="branch-arrow">→</span>
              <span class="branch-label">${escapeHtml(b.condition)}</span>
            </div>
            <div class="branch-outcome-card ${b.badgeType}">
              <div class="outcome-header">
                <span class="outcome-type-pill">${escapeHtml(b.badgeLabel)}</span>
              </div>
              <div class="outcome-action-text">
                <strong>[ ${escapeHtml(b.outcomeTitle)} ]</strong>
                <div class="sub-branches-list">
                  ${bulletsHtml}
                </div>
              </div>
              <div class="outcome-code-tag">${escapeHtml(b.footerTag)}</div>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="mindmap-container mindmap-decision-tree">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            </span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-tree">DECISION TREE SKETCH</span>
        </div>
        <div class="mindmap-body">
          ${sketchSvg}
          <div class="decision-branches-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Dự phòng: Phân tích theo cú pháp mũi tên (Điều kiện ──► Khuyến nghị)
  const branches: ParsedDecisionBranch[] = [];
  for (let i = 0; i < trimmedLines.length; i++) {
    const rawLine = trimmedLines[i];
    const clean = stripEmojis(rawLine.replace(/^[├──└──│\─┬\s]+/, '').trim());
    if (!clean || clean === rootQuestion || clean.length < 3) continue;

    if (clean.includes('──►') || clean.includes('->')) {
      const parts = clean.split(/──►|->/);
      const condition = parts[0].trim();
      const rec = parts[1].trim();

      const isDanger =
        rec.includes('KHÔNG') ||
        rec.includes('CẤM') ||
        rec.includes('NGHẼN') ||
        rec.includes('CHẬM') ||
        rec.includes('LỖI');
      const isPositive =
        rec.includes('NÊN') ||
        rec.includes('TỐI ƯU') ||
        rec.includes('KHUYÊN') ||
        rec.includes('DÙNG') ||
        rec.includes('CHUẨN');

      branches.push({
        condition,
        recommendation: rec,
        badgeType: isDanger ? 'danger' : isPositive ? 'positive' : 'caution',
        badgeLabel: isDanger
          ? 'CẢNH BÁO'
          : isPositive
            ? 'KHUYÊN DÙNG'
            : 'CÂN NHẮC',
      });
    }
  }

  if (branches.length === 0) {
    return renderCleanBlueprint(text, displayTitle);
  }

  const sketchSpecs: SketchBranchSpec[] = branches.map((b) => ({
    condition: b.condition,
    outcomeTitle: b.recommendation,
    subNote: b.badgeLabel,
    badgeType: b.badgeType,
    badgeLabel: b.badgeLabel,
  }));

  const sketchSvg = buildDecisionTreeSketchSvg(
    rootQuestion,
    sketchSpecs,
    displayTitle
  );

  const branchesHtml = branches
    .map((b) => {
      return `
        <div class="decision-branch-card">
          <div class="branch-condition-strip">
            <span class="branch-arrow">→</span>
            <span class="branch-label">${escapeHtml(b.condition)}</span>
          </div>
          <div class="branch-outcome-card ${b.badgeType}">
            <div class="outcome-header">
              <span class="outcome-type-pill">${b.badgeLabel}</span>
            </div>
            <div class="outcome-action-text">${escapeHtml(b.recommendation)}</div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="mindmap-container mindmap-decision-tree">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
          </span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-tree">DECISION TREE SKETCH</span>
      </div>
      <div class="mindmap-body">
        ${sketchSvg}
        <div class="decision-branches-grid">
          ${branchesHtml}
        </div>
      </div>
    </div>
  `;
}
