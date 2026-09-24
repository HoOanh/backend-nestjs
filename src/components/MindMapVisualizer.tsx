import { escapeHtml } from './CodeViewer.tsx';

/**
 * Kiểu loại sơ đồ tư duy được tự động nhận diện từ nội dung
 */
export type DiagramCategory = 'decision-tree' | 'layered-stack' | 'lifecycle-flow' | 'comparison' | 'blueprint';

interface ParsedDecisionBranch {
  condition: string;
  recommendation: string;
  codeSnippet?: string;
  subBranches?: Array<{ condition: string; recommendation: string }>;
}

interface ParsedDecisionTree {
  rootQuestion: string;
  branches: ParsedDecisionBranch[];
}

interface ParsedLayer {
  layerNumber: string;
  layerTitle: string;
  connectorText?: string;
  items: Array<{ title: string; subtitle?: string }>;
}

interface ParsedStepFlow {
  steps: Array<{
    stepNumber: number;
    title: string;
    details?: string;
    subNotes?: string[];
  }>;
}

interface ParsedComparison {
  leftTitle: string;
  leftSubtitle?: string;
  leftPoints: string[];
  rightTitle: string;
  rightSubtitle?: string;
  rightPoints: string[];
}

/**
 * Nhận diện loại sơ đồ tư duy dựa vào văn bản
 */
export function detectDiagramCategory(text: string): DiagramCategory {
  const clean = text.trim();

  // 1. So sánh 2 mô hình (MÔ HÌNH CŨ vs MÔ HÌNH HIỆN ĐẠI, KỊCH BẢN 1 vs KỊCH BẢN 2)
  if (
    (clean.includes('MÔ HÌNH CŨ:') || clean.includes('KỊCH BẢN 1:')) &&
    (clean.includes('MÔ HÌNH HIỆN ĐẠI:') || clean.includes('KỊCH BẢN 2:'))
  ) {
    return 'comparison';
  }

  // 2. Cây quyết định (Decision Tree)
  if (
    clean.includes('├──') ||
    clean.includes('└──►') ||
    clean.includes('Kiểu dữ liệu là gì?') ||
    clean.includes('CÂY QUYẾT ĐỊNH') ||
    (clean.includes('?') && (clean.includes('DÙNG') || clean.includes('NÊN') || clean.includes('TUYỆT ĐỐI')))
  ) {
    return 'decision-tree';
  }

  // 3. Phân tầng kiến trúc (Layered Architecture / Taxonomy Map)
  if (
    /\d+\.\s+TẦNG\s+/i.test(clean) ||
    /\d+\.\s+LAYER\s+/i.test(clean) ||
    clean.includes('1. METADATA REGISTRY') ||
    clean.includes('1. SINGLETON REGISTRY') ||
    clean.includes('1. SCAN NODES') ||
    clean.includes('1. HARDWARE LAYER') ||
    clean.includes('1. B-TREE INDEX')
  ) {
    return 'layered-stack';
  }

  // 4. Dòng chảy tuần tự (Lifecycle / Pipeline Flow)
  if (
    clean.includes('──►') ||
    clean.includes('INCOMING HTTP REQUEST') ||
    clean.includes('Khởi động Container') ||
    clean.includes('Câu lệnh SQL được gửi đến')
  ) {
    return 'lifecycle-flow';
  }

  return 'blueprint';
}

/**
 * 1. Parser & Renderer: Cây Quyết Định Kỹ Thuật (Decision Tree Mind Map)
 */
export function renderDecisionTree(text: string, title: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('│') && l !== '│' && !l.startsWith('┌') && !l.startsWith('└'));

  let rootQuestion = 'MỤC TIÊU / CÂU HỎI QUYẾT ĐỊNH KỸ THUẬT';
  const branches: ParsedDecisionBranch[] = [];

  // Tìm câu hỏi gốc ở các dòng đầu tiên
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i];
    if (line.includes('?') || line === line.toUpperCase()) {
      rootQuestion = line.replace(/[│┌└├▼▲\─]/g, '').trim();
      break;
    }
  }

  // Nhận diện các nhánh cây
  let currentBranch: ParsedDecisionBranch | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = rawLine.replace(/^[├──└──│\s]+/, '').trim();

    if (!cleanLine || cleanLine === rootQuestion) continue;

    if (cleanLine.includes('?') || rawLine.startsWith('├──') || rawLine.startsWith('└──')) {
      if (cleanLine.includes('──►')) {
        // Trường hợp 1 dòng chứa cả điều kiện và kết luận
        const parts = cleanLine.split('──►');
        branches.push({
          condition: parts[0].trim(),
          recommendation: parts[1].trim(),
        });
      } else {
        // Mở một nhánh điều kiện mới
        if (currentBranch) {
          branches.push(currentBranch);
        }
        currentBranch = {
          condition: cleanLine,
          recommendation: '',
        };
      }
    } else if (cleanLine.includes('──►') || cleanLine.startsWith('└──►') || cleanLine.startsWith('├──►')) {
      const rec = cleanLine.replace(/^[├──└──►\s]+/, '').trim();
      if (currentBranch) {
        currentBranch.recommendation = rec;
      } else {
        branches.push({
          condition: 'Trường hợp mặc định',
          recommendation: rec,
        });
      }
    } else if (cleanLine.startsWith('{') || cleanLine.startsWith('CREATE') || cleanLine.startsWith('providers:')) {
      if (currentBranch) {
        currentBranch.codeSnippet = cleanLine;
      }
    } else if (currentBranch && !currentBranch.recommendation) {
      currentBranch.recommendation = cleanLine;
    }
  }

  if (currentBranch) {
    branches.push(currentBranch);
  }

  // Nếu parse không ra nhánh nào, trả về blueprint
  if (branches.length === 0) {
    return renderCleanBlueprint(text, title);
  }

  const branchesHtml = branches
    .map((b, idx) => {
      const isOptimal =
        b.recommendation.toLowerCase().includes('tốt nhất') ||
        b.recommendation.toLowerCase().includes('chuẩn') ||
        b.recommendation.toLowerCase().includes('khuyên dùng') ||
        b.recommendation.toLowerCase().includes('tối ưu');
      const isWarning =
        b.recommendation.toLowerCase().includes('không nên') ||
        b.recommendation.toLowerCase().includes('tuyệt đối') ||
        b.recommendation.toLowerCase().includes('tạm thời');

      const badgeType = isOptimal ? 'badge-optimal' : isWarning ? 'badge-warning' : 'badge-choice';
      const badgeText = isOptimal ? '✨ GIẢI PHÁP TỐI ƯU' : isWarning ? '⚠️ LƯU Ý / ĐÁNH ĐỔI' : `NHÁNH 0${idx + 1}`;

      return `
        <div class="decision-card">
          <div class="decision-card-left">
            <div class="decision-condition-badge">
              <span class="decision-num">0${idx + 1}</span>
              <span class="decision-text">${escapeHtml(b.condition)}</span>
            </div>
          </div>
          <div class="decision-arrow-wrap">
            <span class="decision-flow-arrow">➔</span>
          </div>
          <div class="decision-card-right">
            <div class="decision-outcome-header">
              <span class="decision-status-pill ${badgeType}">${badgeText}</span>
            </div>
            <div class="decision-recommendation">${escapeHtml(b.recommendation)}</div>
            ${
              b.codeSnippet
                ? `<div class="decision-code-snippet"><code>${escapeHtml(b.codeSnippet)}</code></div>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="mindmap-container mindmap-decision-tree">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon">🌳</span>
          <span class="mindmap-main-title">${escapeHtml(title || 'CÂY QUYẾT ĐỊNH KỸ THUẬT (ENGINEERING DECISION TREE)')}</span>
        </div>
        <span class="mindmap-badge badge-decision">DECISION MINDMAP</span>
      </div>
      <div class="mindmap-body">
        <div class="decision-root-box">
          <div class="decision-root-tag">🎯 CÂU HỎI ĐIỀU PHỐI KIẾN TRÚC</div>
          <div class="decision-root-question">${escapeHtml(rootQuestion)}</div>
        </div>
        <div class="decision-branches-container">
          ${branchesHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * 2. Parser & Renderer: Bản Đồ Phân Tầng Hệ Thống (Layered Architecture Map)
 */
export function renderLayeredStack(text: string, title: string): string {
  const lines = text.split('\n');
  const layers: ParsedLayer[] = [];
  let currentLayer: ParsedLayer | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('┌') || line.startsWith('└') || line.startsWith('├') || line === '│') continue;

    // Phát hiện đầu mục tầng: "│ 1. TẦNG..." hoặc "1. TẦNG..." hoặc "1. METADATA REGISTRY"
    const layerHeaderMatch = line.match(/(?:│\s*)?(\d+)\.\s+([A-Z0-9\s&_\-\(\)]+)(?:│)?/i);

    if (layerHeaderMatch && (line.includes('TẦNG') || line.includes('LAYER') || line.includes('REGISTRY') || line.includes('NODES') || line.includes('INDEX') || line.includes('PHẦN CỨNG') || line.includes('NHÂN'))) {
      if (currentLayer) {
        layers.push(currentLayer);
      }
      currentLayer = {
        layerNumber: layerHeaderMatch[1],
        layerTitle: layerHeaderMatch[2].replace(/[│┌└├\─]/g, '').trim(),
        items: [],
      };
      continue;
    }

    // Phát hiện connector giữa các tầng: "│ System Calls..." hoặc "System Calls..."
    if (line.includes('System Calls') || line.includes('Libuv C-Bindings') || line.includes('IPC') || line.includes('Network Bus')) {
      if (currentLayer) {
        currentLayer.connectorText = line.replace(/[│┌└├▼▲\─]/g, '').trim();
      }
      continue;
    }

    // Bóc tách item bên trong tầng
    if (currentLayer) {
      const cleanItem = line.replace(/^[│├──└──\[\]\s]+/, '').replace(/[│\]]+$/, '').trim();
      if (cleanItem && cleanItem.length > 2 && !cleanItem.startsWith('---')) {
        const itemParts = cleanItem.split(':');
        currentLayer.items.push({
          title: itemParts[0].trim(),
          subtitle: itemParts.length > 1 ? itemParts.slice(1).join(':').trim() : undefined,
        });
      }
    }
  }

  if (currentLayer) {
    layers.push(currentLayer);
  }

  if (layers.length === 0) {
    return renderCleanBlueprint(text, title);
  }

  const layersHtml = layers
    .map((l, index) => {
      const colors = ['layer-cyan', 'layer-indigo', 'layer-emerald', 'layer-amber', 'layer-rose'];
      const colorClass = colors[index % colors.length];

      const itemsHtml = l.items
        .map((it) => {
          return `
            <div class="layer-item-pill">
              <span class="item-pill-bullet">🔹</span>
              <span class="item-pill-title">${escapeHtml(it.title)}</span>
              ${it.subtitle ? `<span class="item-pill-desc">${escapeHtml(it.subtitle)}</span>` : ''}
            </div>
          `;
        })
        .join('');

      const connectorHtml = l.connectorText
        ? `
          <div class="layer-connector-wrap">
            <div class="layer-connector-line"></div>
            <div class="layer-connector-badge">
              <span class="connector-arrow">⬇️</span>
              <span class="connector-label">${escapeHtml(l.connectorText)}</span>
            </div>
            <div class="layer-connector-line"></div>
          </div>
        `
        : index < layers.length - 1
        ? `
          <div class="layer-connector-wrap simple-gap">
            <span class="connector-simple-arrow">⬇️</span>
          </div>
        `
        : '';

      return `
        <div class="architecture-layer-card ${colorClass}">
          <div class="layer-card-header">
            <span class="layer-badge-num">TẦNG 0${escapeHtml(l.layerNumber)}</span>
            <span class="layer-card-title">${escapeHtml(l.layerTitle)}</span>
          </div>
          <div class="layer-items-grid">
            ${itemsHtml}
          </div>
        </div>
        ${connectorHtml}
      `;
    })
    .join('');

  return `
    <div class="mindmap-container mindmap-layered-architecture">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon">🗺️</span>
          <span class="mindmap-main-title">${escapeHtml(title || 'BẢN ĐỒ TẦNG BẬC HỆ THỐNG (SYSTEM TAXONOMY MAP)')}</span>
        </div>
        <span class="mindmap-badge badge-taxonomy">LAYERED STACK</span>
      </div>
      <div class="mindmap-body">
        <div class="architecture-stack-wrap">
          ${layersHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * 3. Parser & Renderer: So Sánh 2 Mô Hình / Kịch Bản (Comparison Flow)
 */
export function renderComparisonFlow(text: string, title: string): string {
  const parts = text.split(/(?:MÔ HÌNH HIỆN ĐẠI:|KỊCH BẢN 2:)/i);
  if (parts.length < 2) {
    return renderCleanBlueprint(text, title);
  }

  const leftRaw = parts[0].replace(/(?:MÔ HÌNH CŨ:|KỊCH BẢN 1:)/i, '').trim();
  const rightRaw = parts[1].trim();

  const leftLines = leftRaw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('┌') && !l.startsWith('└'));
  const rightLines = rightRaw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('┌') && !l.startsWith('└'));

  const renderPoints = (lines: string[], isDanger: boolean) => {
    return lines
      .map((l) => {
        const clean = l.replace(/[│┌└├▼▲\─►]/g, '').trim();
        if (!clean) return '';
        const icon = isDanger ? '❌' : '✅';
        return `<div class="comparison-point-row"><span class="point-icon">${icon}</span><span class="point-text">${escapeHtml(clean)}</span></div>`;
      })
      .join('');
  };

  return `
    <div class="mindmap-container mindmap-comparison">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon">🔄</span>
          <span class="mindmap-main-title">${escapeHtml(title || 'SO SÁNH MÔ HÌNH & DÒNG CHẢY QUY TRÌNH')}</span>
        </div>
        <span class="mindmap-badge badge-comparison">COMPARISON MATRIX</span>
      </div>
      <div class="mindmap-body">
        <div class="comparison-grid">
          <div class="comparison-column col-legacy">
            <div class="comparison-col-header header-legacy">
              <span class="col-status-icon">⚠️</span>
              <div class="col-header-text">
                <div class="col-title">MÔ HÌNH TRUYỀN THỐNG / GÂY NGHẼN</div>
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
              <div class="col-header-text">
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

/**
 * 4. Fallback Blueprint: Sơ Đồ Kiến Trúc Đồ Họa Thanh Lịch (Thích Ứng Light/Dark Theme Tuyệt Đối)
 */
export function renderCleanBlueprint(text: string, title: string = 'BẢN VẼ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE BLUEPRINT)'): string {
  const cleanDiagram = escapeHtml(text.replace(/^\n+|\n+$/g, ''));
  return `
    <div class="mindmap-container mindmap-blueprint-view">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon">📐</span>
          <span class="mindmap-main-title">${escapeHtml(title)}</span>
        </div>
        <span class="mindmap-badge badge-blueprint">TECHNICAL BLUEPRINT</span>
      </div>
      <div class="mindmap-body blueprint-body-styled">
        <pre class="blueprint-diagram-text">${cleanDiagram}</pre>
      </div>
    </div>
  `;
}

/**
 * Hàm phân phối tổng quát: Tự động chọn parser trực quan phù hợp nhất
 */
export function renderSmartMindMapHtml(diagramText: string, title?: string): string {
  const category = detectDiagramCategory(diagramText);

  switch (category) {
    case 'decision-tree':
      return renderDecisionTree(diagramText, title || 'CÂY QUYẾT ĐỊNH KỸ THUẬT (ENGINEERING DECISION TREE)');
    case 'layered-stack':
      return renderLayeredStack(diagramText, title || 'BẢN ĐỒ TẦNG BẬC HỆ THỐNG (SYSTEM TAXONOMY MAP)');
    case 'comparison':
      return renderComparisonFlow(diagramText, title || 'SO SÁNH MÔ HÌNH KIẾN TRÚC & DÒNG CHẢY THỰC THI');
    case 'lifecycle-flow':
    case 'blueprint':
    default:
      return renderCleanBlueprint(diagramText, title || 'BẢN VẼ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE BLUEPRINT)');
  }
}
