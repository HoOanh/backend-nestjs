import { escapeHtml } from '../../common/CodeViewer.tsx';
import type { ParsedDecisionBranch } from '../types.ts';
import { renderCleanBlueprint } from './renderCleanBlueprint.ts';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Renderer: Cây Quyết Định Kỹ Thuật (Engineering Decision Tree)
 */
export function renderDecisionTree(text: string, title?: string): string {
  const displayTitle = stripEmojis(title || '') || 'CÂY QUYẾT ĐỊNH KỸ THUẬT (ENGINEERING DECISION TREE)';

  // Trường hợp đặc thù Sơ đồ 3 Chapter 1: Phân vùng bộ nhớ V8
  if (text.includes('DỮ LIỆU CỦA BẠN SẼ NẰM Ở ĐÂU') || text.includes('V8 STACK MEMORY') || text.includes('YOUNG GENERATION')) {
    return `
      <div class="mindmap-container mindmap-decision-tree">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            </span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-tree">DECISION TREE</span>
        </div>
        <div class="mindmap-body">
          <div class="decision-root-banner">
            <span class="root-badge">ĐIỀU PHỐI KIẾN TRÚC</span>
            <div class="root-question">DỮ LIỆU CỦA TIẾN TRÌNH ĐƯỢC LƯU TRỮ Ở VÙNG NHỚ NÀO?</div>
          </div>

          <div class="decision-branches-grid">
            <!-- NHÁNH 1: NGUYÊN THỦY -->
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

            <!-- NHÁNH 2: PHỨC HỢP -->
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
                <div class="outcome-code-tag">Cần kiểm soát tham chiếu tại Global Variables & Event Listeners</div>
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
    .filter((l) => l.length > 0 && !l.startsWith('│') && !l.startsWith('┌') && !l.startsWith('└') && !l.startsWith('├') && !l.startsWith('┬'));

  let rootQuestion = 'MỤC TIÊU / CÂU HỎI ĐIỀU PHỐI KIẾN TRÚC';
  for (let i = 0; i < Math.min(3, trimmedLines.length); i++) {
    const line = stripEmojis(trimmedLines[i].replace(/[│┌└├▼▲\─┬\/\\]/g, '').trim());
    if (line.includes('?') || line === line.toUpperCase()) {
      rootQuestion = line;
      break;
    }
  }

  // 1. Thử phân tích cấu trúc Cây Quyết Định ASCII có các hộp kết quả [ TÊN KẾT QUẢ ] kèm gạch đầu dòng '-'
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
      const colEnd = nextMatch ? (nextMatch.index ?? line.length) : line.length + 120;

      // Tìm nhãn điều kiện rẽ nhánh phía trên (cách 2-4 dòng phía trên hộp [ ... ])
      let condition = `NHÁNH QUYẾT ĐỊNH #${boxBranches.length + 1}`;
      for (let up = lineIdx - 1; up >= Math.max(0, lineIdx - 4); up--) {
        const upLine = rawLines[up];
        // Loại bỏ phần thuộc hộp kết quả khác hoặc gạch đầu dòng ở cột trái
        const tokens = [...upLine.matchAll(/([^\s\/\\│▼▲][^\n\/\\│▼▲]*?)(?=\s{3,}|$)/g)]
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

      // Thu thập các dòng '- bullet' ngay bên dưới hộp [ ... ] trong cùng vùng cột
      const bullets: string[] = [];
      for (let down = lineIdx + 1; down < rawLines.length; down++) {
        const downLine = rawLines[down];
        // Dừng nếu gặp hộp [ ... ] mới trong cùng vùng cột
        const subBoxes = [...downLine.matchAll(/\[\s*([^\]]+?)\s*\]/g)];
        if (subBoxes.some((sb) => (sb.index ?? 0) >= colStart - 10 && (sb.index ?? 0) < colEnd)) {
          break;
        }

        const bulletMatches = [...downLine.matchAll(/-\s+(.+?)(?=\s{3,}-\s+|\s{3,}[A-ZĐÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\/\\▼]|$)/g)];
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
          ? 'CẢNH BÁO HIỆU NĂNG (ANTI-PATTERN)'
          : 'ĐÁNH ĐỔI KIẾN TRÚC (TRADE-OFF)';
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
          <span class="mindmap-badge badge-tree">DECISION TREE</span>
        </div>
        <div class="mindmap-body">
          <div class="decision-root-banner">
            <span class="root-badge">ĐIỀU PHỐI KIẾN TRÚC</span>
            <div class="root-question">${escapeHtml(rootQuestion)}</div>
          </div>
          <div class="decision-branches-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // 2. Dự phòng: Phân tích theo cú pháp mũi tên (Điều kiện ──► Khuyến nghị)
  const branches: ParsedDecisionBranch[] = [];
  for (let i = 0; i < trimmedLines.length; i++) {
    const rawLine = trimmedLines[i];
    const clean = stripEmojis(rawLine.replace(/^[├──└──│\─┬\s]+/, '').trim());
    if (!clean || clean === rootQuestion || clean.length < 3) continue;

    if (clean.includes('──►') || clean.includes('->')) {
      const parts = clean.split(/──►|->/);
      const condition = parts[0].trim();
      const rec = parts[1].trim();

      const isDanger = rec.includes('KHÔNG') || rec.includes('CẤM') || rec.includes('NGHẼN') || rec.includes('CHẬM') || rec.includes('LỖI');
      const isPositive = rec.includes('NÊN') || rec.includes('TỐI ƯU') || rec.includes('KHUYÊN') || rec.includes('DÙNG') || rec.includes('CHUẨN');

      branches.push({
        condition,
        recommendation: rec,
        badgeType: isDanger ? 'danger' : isPositive ? 'positive' : 'caution',
        badgeLabel: isDanger ? 'CẢNH BÁO' : isPositive ? 'KHUYÊN DÙNG' : 'CÂN NHẮC',
      });
    }
  }

  if (branches.length === 0) {
    return renderCleanBlueprint(text, displayTitle);
  }

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
        <span class="mindmap-badge badge-tree">DECISION TREE</span>
      </div>
      <div class="mindmap-body">
        <div class="decision-root-banner">
          <span class="root-badge">ĐIỀU PHỐI KIẾN TRÚC</span>
          <div class="root-question">${escapeHtml(rootQuestion)}</div>
        </div>
        <div class="decision-branches-grid">
          ${branchesHtml}
        </div>
      </div>
    </div>
  `;
}
