import { escapeHtml } from './CodeViewer.tsx';

/**
 * Các phân loại sơ đồ trực quan được tự động nhận diện
 */
export type DiagramCategory =
  | 'memory-layout'
  | 'layered-stack'
  | 'decision-tree'
  | 'comparison'
  | 'lifecycle-flow'
  | 'blueprint';

interface ParsedDecisionBranch {
  condition: string;
  recommendation: string;
  badgeType: 'positive' | 'caution' | 'danger';
  badgeLabel: string;
  codeSnippet?: string;
  details?: string[];
}

interface ParsedLayer {
  layerNumber: string;
  layerTitle: string;
  connectorText?: string;
  items: Array<{ title: string; subtitle?: string }>;
}

interface ParsedFlowStep {
  stepNumber: number;
  title: string;
  subtitle?: string;
}

/**
 * Nhận diện loại sơ đồ thông minh dựa trên nội dung và tiêu đề
 */
export function detectDiagramCategory(text: string, title?: string): DiagramCategory {
  const clean = text.trim();
  const lowerTitle = (title || '').toLowerCase();

  // 1. Nhận diện ưu tiên theo Tiêu đề mục (Explicit Title Classification)
  if (lowerTitle.includes('cây quyết định') || lowerTitle.includes('decision tree')) {
    return 'decision-tree';
  }

  if (lowerTitle.includes('so sánh') || lowerTitle.includes('comparison') || lowerTitle.includes('vs')) {
    return 'comparison';
  }

  if (
    lowerTitle.includes('bản đồ') ||
    lowerTitle.includes('taxonomy') ||
    lowerTitle.includes('stack map') ||
    lowerTitle.includes('architecture map') ||
    lowerTitle.includes('phân cấp') ||
    lowerTitle.includes('phân phối') ||
    lowerTitle.includes('tầng bậc')
  ) {
    return 'layered-stack';
  }

  if (lowerTitle.includes('resident set size') || lowerTitle.includes('phân vùng bộ nhớ') || lowerTitle.includes('rss')) {
    return 'memory-layout';
  }

  if (
    lowerTitle.includes('dòng chảy') ||
    lowerTitle.includes('flow') ||
    lowerTitle.includes('lifecycle') ||
    lowerTitle.includes('vòng đời') ||
    lowerTitle.includes('quy trình')
  ) {
    return 'lifecycle-flow';
  }

  // 2. Nhận diện dự phòng theo Nội dung sơ đồ (Content Classification)
  if (
    clean.includes('RESIDENT SET SIZE') ||
    clean.includes('V8 HEAP SPACE') ||
    clean.includes('V8 STACK SPACE') ||
    clean.includes('C++ NON-HEAP')
  ) {
    return 'memory-layout';
  }

  if (
    clean.includes('MÔ HÌNH CŨ:') ||
    clean.includes('KỊCH BẢN 1:') ||
    clean.includes('GHÉP NỐI CHẶT') ||
    clean.includes('GHÉP CHUỖI NGUY HIỂM')
  ) {
    return 'comparison';
  }

  if (
    clean.includes('DỮ LIỆU CỦA BẠN SẼ NẰM Ở ĐÂU') ||
    clean.includes('BẠN CẦN CHỌN') ||
    clean.includes('BẠN ĐANG THIẾT KẾ') ||
    clean.includes('BẠN CẦN GIỚI HẠN') ||
    clean.includes('BẠN CẦN BẢO VỆ') ||
    clean.includes('JOB XỬ LÝ TRONG WORKER BỊ LỖI?') ||
    clean.includes('LÀM THẾ NÀO ĐỂ BẢO VỆ CONSUMER') ||
    clean.includes('HỆ THỐNG GẶP SỰ CỐ VỀ CACHE?') ||
    clean.includes('BẠN CẦN LƯU TRỮ DỮ LIỆU GÌ') ||
    clean.includes('Kiểu dữ liệu là gì?')
  ) {
    return 'decision-tree';
  }

  if (
    clean.includes('TẦNG VẬT LÝ') ||
    clean.includes('HARDWARE LAYER') ||
    clean.includes('LINUX OS KERNEL') ||
    clean.includes('NODE.JS INTERNALS') ||
    /(?:│\s*)?\d+\.\s+TẦNG/i.test(clean) ||
    clean.includes('Three Pillars') ||
    clean.includes('3 TRỤ CỘT')
  ) {
    return 'layered-stack';
  }

  if (clean.includes('──►') || clean.includes('INCOMING HTTP REQUEST') || clean.includes('Poll Phase')) {
    return 'lifecycle-flow';
  }

  return 'blueprint';
}

/**
 * 1. Renderer: Sơ Đồ Phân Vùng Bộ Nhớ Vật Lý RSS (Memory Architecture Widget)
 */
export function renderMemoryLayout(text: string, title?: string): string {
  const displayTitle = title || '3. PHÂN VÙNG BỘ NHỚ RESIDENT SET SIZE (RSS) CỦA TIẾN TRÌNH';

  return `
    <div class="mindmap-container mindmap-memory-layout">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon">💾</span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-memory">MEMORY ARCHITECTURE</span>
      </div>
      <div class="mindmap-body">
        <div class="memory-rss-wrapper">
          <div class="memory-rss-banner">
            <div class="rss-banner-left">
              <span class="rss-tag">RESIDENT SET SIZE (RSS)</span>
              <span class="rss-desc">Tổng dung lượng RAM vật lý hệ điều hành cấp phát cho tiến trình Node.js</span>
            </div>
            <div class="rss-banner-right">
              <code>process.memoryUsage().rss</code>
            </div>
          </div>

          <div class="memory-zones-grid">
            <!-- VÙNG 1: V8 HEAP SPACE -->
            <div class="memory-zone-card zone-heap">
              <div class="zone-card-header header-heap">
                <span class="zone-icon">📦</span>
                <div>
                  <div class="zone-title">V8 HEAP SPACE</div>
                  <div class="zone-sub">Vùng nhớ động quản lý bởi V8 Garbage Collector</div>
                </div>
              </div>
              <div class="zone-sub-cards">
                <div class="zone-sub-card sub-young">
                  <div class="sub-card-title">
                    <span>🌱 Young Generation</span>
                    <span class="sub-pill pill-fast">Siêu Tốc ~1ms</span>
                  </div>
                  <div class="sub-algo">Thuật toán Scavenge (From / To Space)</div>
                  <div class="sub-detail">Nơi sinh ra của hầu hết Objects. Tỷ lệ dọn rác cực nhanh, sống qua 2 lần GC sẽ chuyển lên Old Gen.</div>
                </div>

                <div class="zone-sub-card sub-old">
                  <div class="sub-card-title">
                    <span>🏛️ Old Generation</span>
                    <span class="sub-pill pill-heavy">Nặng CPU</span>
                  </div>
                  <div class="sub-algo">Thuật toán Mark-Sweep-Compact</div>
                  <div class="sub-detail">Chứa Singletons, Closures, Caching sống lâu. Quét dọn tốn xung nhịp (nguy cơ Stop-The-World nếu rò rỉ RAM).</div>
                </div>
              </div>
            </div>

            <!-- VÙNG 2: V8 STACK SPACE -->
            <div class="memory-zone-card zone-stack">
              <div class="zone-card-header header-stack">
                <span class="zone-icon">🥞</span>
                <div>
                  <div class="zone-title">V8 STACK SPACE</div>
                  <div class="zone-sub">Ngăn xếp thực thi hàm theo cơ chế LIFO</div>
                </div>
              </div>
              <div class="zone-features-list">
                <div class="zone-feature-item">
                  <span class="feat-icon">⚡</span>
                  <div>
                    <strong>Call Frames (Ngăn xếp gọi hàm):</strong>
                    <span>Lưu ngữ cảnh hàm đang thực thi, tự động giải phóng khi hàm \`return\`.</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">🔢</span>
                  <div>
                    <strong>Biến nguyên thủy (Primitives):</strong>
                    <span>Number, Boolean, BigInt, Symbol được lưu giá trị trực tiếp trên Stack.</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">🎯</span>
                  <div>
                    <strong>Con trỏ tham chiếu (Pointers):</strong>
                    <span>Chứa địa chỉ bộ nhớ 64-bit trỏ sang các đối tượng thực nằm bên V8 Heap.</span>
                  </div>
                </div>
              </div>
              <div class="zone-stat-badge stat-stack">
                <span>0% GC Overhead (CPU Stack Pointer thu hồi tức thì)</span>
              </div>
            </div>

            <!-- VÙNG 3: C++ NON-HEAP -->
            <div class="memory-zone-card zone-external">
              <div class="zone-card-header header-external">
                <span class="zone-icon">⚙️</span>
                <div>
                  <div class="zone-title">C++ NON-HEAP (EXTERNAL)</div>
                  <div class="zone-sub">Cấp phát ngoài Heap do tầng C++ Node.js quản lý</div>
                </div>
              </div>
              <div class="zone-features-list">
                <div class="zone-feature-item">
                  <span class="feat-icon">📁</span>
                  <div>
                    <strong>Node.js Buffers:</strong>
                    <span>Vùng nhớ đọc ghi File, Streams, I/O được cấp phát trực tiếp qua \`malloc()\`.</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">🌐</span>
                  <div>
                    <strong>Kernel Sockets Buffer:</strong>
                    <span>Hàng đợi Receive/Send Queue của kết nối mạng TCP/HTTP.</span>
                  </div>
                </div>
                <div class="zone-feature-item">
                  <span class="feat-icon">🔐</span>
                  <div>
                    <strong>Crypto & TLS Context:</strong>
                    <span>Khóa mã hóa RSA/ECDSA và ngữ cảnh kết nối bảo mật HTTPS.</span>
                  </div>
                </div>
              </div>
              <div class="zone-stat-badge stat-external">
                <span>Không chịu giới hạn của V8 --max-old-space-size</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 2. Renderer: Bản Đồ Phân Tầng Kiến Trúc Hệ Thống (Layered Taxonomy Stack)
 */
export function renderLayeredStack(text: string, title?: string): string {
  const displayTitle = title || 'BẢN ĐỒ TẦNG BẬC HỆ THỐNG (SYSTEM TAXONOMY MAP)';

  // Kiểm tra nếu là Sơ đồ 1 của Chapter 1 (Hardware -> Kernel -> Runtime)
  if (text.includes('HARDWARE LAYER') || text.includes('TẦNG VẬT LÝ')) {
    return `
      <div class="mindmap-container mindmap-layered-architecture">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon">🗺️</span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-stack">ARCHITECTURE STACK</span>
        </div>
        <div class="mindmap-body">
          <div class="architecture-stack">
            <!-- TẦNG 1 -->
            <div class="architecture-layer-card layer-card-hardware">
              <div class="layer-card-header">
                <span class="layer-badge-number">TẦNG 1</span>
                <div class="layer-title-text">TẦNG VẬT LÝ & PHẦN CỨNG (HARDWARE LAYER)</div>
              </div>
              <div class="layer-items-grid">
                <div class="layer-item-chip">
                  <span class="chip-icon">⚡</span>
                  <div>
                    <div class="chip-title">CPU Cores & Cache L1/L2/L3</div>
                    <div class="chip-subtitle">Xung nhịp GHz, độ trễ truy xuất nano-giây (1-10ns)</div>
                  </div>
                </div>
                <div class="layer-item-chip">
                  <span class="chip-icon">🧠</span>
                  <div>
                    <div class="chip-title">RAM Vật Lý (Memory Bus)</div>
                    <div class="chip-subtitle">Băng thông cao, độ trễ ~50-100ns</div>
                  </div>
                </div>
                <div class="layer-item-chip">
                  <span class="chip-icon">💾</span>
                  <div>
                    <div class="chip-title">NVMe SSD & Card Mạng (NIC)</div>
                    <div class="chip-subtitle">I/O lưu trữ đĩa cứng và thiết bị ngoại vi</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CONNECTOR 1 -> 2 -->
            <div class="layer-connector-band">
              <div class="connector-line"></div>
              <div class="connector-badge">
                <span class="connector-icon">▼</span>
                <span>System Calls: epoll_ctl, epoll_wait, socket, read/write syscalls</span>
              </div>
              <div class="connector-line"></div>
            </div>

            <!-- TẦNG 2 -->
            <div class="architecture-layer-card layer-card-kernel">
              <div class="layer-card-header">
                <span class="layer-badge-number">TẦNG 2</span>
                <div class="layer-title-text">TẦNG NHÂN HỆ ĐIỀU HÀNH (LINUX OS KERNEL)</div>
              </div>
              <div class="layer-items-grid">
                <div class="layer-item-chip">
                  <span class="chip-icon">📑</span>
                  <div>
                    <div class="chip-title">File Descriptor Table</div>
                    <div class="chip-subtitle">Bảng chỉ mục Socket [FD: 12] (Listening Port 3000)</div>
                  </div>
                </div>
                <div class="layer-item-chip">
                  <span class="chip-icon">📥</span>
                  <div>
                    <div class="chip-title">Kernel TCP Buffers</div>
                    <div class="chip-subtitle">Hàng đợi Receive Queue / Send Queue trong Kernel</div>
                  </div>
                </div>
                <div class="layer-item-chip">
                  <span class="chip-icon">🎯</span>
                  <div>
                    <div class="chip-title">Epoll / Kqueue Ready List</div>
                    <div class="chip-subtitle">Theo dõi trạng thái I/O của hàng chục nghìn Socket cùng lúc O(1)</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CONNECTOR 2 -> 3 -->
            <div class="layer-connector-band">
              <div class="connector-line"></div>
              <div class="connector-badge">
                <span class="connector-icon">▼</span>
                <span>Libuv C-Bindings (Cầu nối C++ System Calls vào Node.js)</span>
              </div>
              <div class="connector-line"></div>
            </div>

            <!-- TẦNG 3 -->
            <div class="architecture-layer-card layer-card-runtime">
              <div class="layer-card-header">
                <span class="layer-badge-number">TẦNG 3</span>
                <div class="layer-title-text">TẦNG RUNTIME CẤP THẤP (NODE.JS INTERNALS)</div>
              </div>
              <div class="layer-items-grid">
                <div class="layer-item-chip">
                  <span class="chip-icon">🔄</span>
                  <div>
                    <div class="chip-title">Libuv Event Loop (Poll Phase)</div>
                    <div class="chip-subtitle">Đọc dữ liệu từ Socket không chặn luồng trên 1 Main Thread duy nhất</div>
                  </div>
                </div>
                <div class="layer-item-chip">
                  <span class="chip-icon">🧵</span>
                  <div>
                    <div class="chip-title">Libuv Threadpool (4 Threads)</div>
                    <div class="chip-subtitle">Chạy tác vụ nặng: Đọc ghi File, Crypto băm, DNS lookup</div>
                  </div>
                </div>
                <div class="layer-item-chip">
                  <span class="chip-icon">🚀</span>
                  <div>
                    <div class="chip-title">V8 Engine (Google C++)</div>
                    <div class="chip-subtitle">Thực thi JavaScript, quản lý Call Stack & V8 Heap Memory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Parser tổng quát cho các bản đồ phân tầng khác
  const lines = text.split('\n');
  const layers: ParsedLayer[] = [];
  let currentLayer: ParsedLayer | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('┌') || rawLine.startsWith('└') || rawLine.startsWith('├') || rawLine === '│') continue;

    // Nhận diện dòng Tầng: "1. TẦNG...", "2. LAYER...", "│ 1. TẦNG..."
    const layerMatch = rawLine.match(/(?:│\s*)?(\d+)\.\s+([^│\n]+)(?:│)?/);
    if (layerMatch && (rawLine.includes('TẦNG') || rawLine.includes('LAYER') || rawLine.includes('PILLARS') || rawLine.includes('TRỤ CỘT') || rawLine.includes('REGISTRY') || rawLine.includes('INDEX'))) {
      if (currentLayer) {
        layers.push(currentLayer);
      }
      currentLayer = {
        layerNumber: layerMatch[1],
        layerTitle: layerMatch[2].replace(/[│┌└├\─]/g, '').trim(),
        items: [],
      };
      continue;
    }

    // Nhận diện Connector nối giữa các tầng
    if (rawLine.includes('Calls') || rawLine.includes('Bindings') || rawLine.includes('IPC') || rawLine.includes('Network') || rawLine.includes('Bridge')) {
      if (currentLayer) {
        currentLayer.connectorText = rawLine.replace(/[│┌└├▼▲\─]/g, '').trim();
      }
      continue;
    }

    // Bóc tách items bên trong tầng
    if (currentLayer) {
      const cleanItem = rawLine.replace(/^[│├──└──\[\]\s]+/, '').replace(/[│\]]+$/, '').trim();
      if (cleanItem && cleanItem.length > 2 && !cleanItem.startsWith('---')) {
        const parts = cleanItem.split(':');
        currentLayer.items.push({
          title: parts[0].trim(),
          subtitle: parts.length > 1 ? parts.slice(1).join(':').trim() : undefined,
        });
      }
    }
  }

  if (currentLayer) {
    layers.push(currentLayer);
  }

  if (layers.length === 0) {
    return renderCleanBlueprint(text, displayTitle);
  }

  const layersHtml = layers
    .map((l, index) => {
      const connectorHtml = l.connectorText
        ? `
          <div class="layer-connector-band">
            <div class="connector-line"></div>
            <div class="connector-badge">
              <span class="connector-icon">▼</span>
              <span>${escapeHtml(l.connectorText)}</span>
            </div>
            <div class="connector-line"></div>
          </div>
        `
        : '';

      const itemsHtml = l.items
        .map((it) => {
          return `
            <div class="layer-item-chip">
              <span class="chip-icon">❖</span>
              <div>
                <div class="chip-title">${escapeHtml(it.title)}</div>
                ${it.subtitle ? `<div class="chip-subtitle">${escapeHtml(it.subtitle)}</div>` : ''}
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div class="architecture-layer-card layer-index-${index}">
          <div class="layer-card-header">
            <span class="layer-badge-number">TẦNG ${escapeHtml(l.layerNumber)}</span>
            <div class="layer-title-text">${escapeHtml(l.layerTitle)}</div>
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
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-stack">ARCHITECTURE STACK</span>
      </div>
      <div class="mindmap-body">
        <div class="architecture-stack">
          ${layersHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * 3. Renderer: Cây Quyết Định Kỹ Thuật (Engineering Decision Tree)
 */
export function renderDecisionTree(text: string, title?: string): string {
  const displayTitle = title || 'CÂY QUYẾT ĐỊNH KỸ THUẬT (ENGINEERING DECISION TREE)';

  // Trường hợp đặc thù Sơ đồ 3 Chapter 1: Phân vùng bộ nhớ V8
  if (text.includes('DỮ LIỆU CỦA BẠN SẼ NẰM Ở ĐÂU') || text.includes('V8 STACK MEMORY') || text.includes('YOUNG GENERATION')) {
    return `
      <div class="mindmap-container mindmap-decision-tree">
        <div class="mindmap-header">
          <div class="mindmap-title-wrap">
            <span class="mindmap-type-icon">🌳</span>
            <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
          </div>
          <span class="mindmap-badge badge-tree">DECISION TREE</span>
        </div>
        <div class="mindmap-body">
          <div class="decision-root-banner">
            <span class="root-badge">🎯 CÂU HỎI ĐIỀU PHỐI</span>
            <div class="root-question">DỮ LIỆU CỦA BẠN SẼ NẰM Ở ĐÂU TRONG RAM TIẾN TRÌNH?</div>
          </div>

          <div class="decision-branches-grid">
            <!-- NHÁNH 1: NGUYÊN THỦY -->
            <div class="decision-branch-card">
              <div class="branch-condition-strip">
                <span class="branch-arrow">⌥</span>
                <span class="branch-label">NẾU LÀ KIỂU NGUYÊN THỦY (Primitive: Number, Bool, Con trỏ)</span>
              </div>
              <div class="branch-outcome-card positive">
                <div class="outcome-header">
                  <span class="outcome-type-pill">⚡ TỐI ƯU TUYỆT ĐỐI (RECOMMENDED)</span>
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
                <span class="branch-arrow">⌥</span>
                <span class="branch-label">NẾU LÀ KIỂU PHỨC HỢP (Object, Array, Closure, Class Instance)</span>
              </div>
              <div class="branch-outcome-card caution">
                <div class="outcome-header">
                  <span class="outcome-type-pill">⚖️ CÂN NHẮC VÒNG ĐỜI (TRADE-OFF)</span>
                </div>
                <div class="outcome-action-text">
                  <strong>Lưu trữ tại [ V8 HEAP SPACE ]</strong>
                  <div class="sub-branches-list">
                    <div class="sub-branch-item">
                      <strong>• Vòng đời ngắn (&lt; 2 chu kỳ GC):</strong> Nằm tại <em>Young Generation</em>. Thu gom rác bằng thuật toán Scavenge siêu tốc (~1ms).
                    </div>
                    <div class="sub-branch-item">
                      <strong>• Sống lâu / Singleton:</strong> Chuyển lên <em>Old Generation</em>. Thu gom bằng thuật toán Mark-Sweep-Compact (nguy cơ Stop-the-World nếu phình to).
                    </div>
                  </div>
                </div>
                <div class="outcome-code-tag">Cần tránh rò rỉ bộ nhớ qua Global Variables & Unclosed Listeners</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Parser tổng quát cho các Cây quyết định khác
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('│') && !l.startsWith('┌') && !l.startsWith('└') && !l.startsWith('├') && !l.startsWith('┬'));

  let rootQuestion = 'MỤC TIÊU / CÂU HỎI ĐIỀU PHỐI KIẾN TRÚC';
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].replace(/[│┌└├▼▲\─┬\/\\]/g, '').trim();
    if (line.includes('?') || line === line.toUpperCase()) {
      rootQuestion = line;
      break;
    }
  }

  const branches: ParsedDecisionBranch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const clean = rawLine.replace(/^[├──└──│\─┬\s]+/, '').trim();
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
            <span class="branch-arrow">⌥</span>
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
          <span class="mindmap-type-icon">🌳</span>
          <span class="mindmap-main-title">${escapeHtml(displayTitle)}</span>
        </div>
        <span class="mindmap-badge badge-tree">DECISION TREE</span>
      </div>
      <div class="mindmap-body">
        <div class="decision-root-banner">
          <span class="root-badge">🎯 CÂU HỎI ĐIỀU PHỐI</span>
          <div class="root-question">${escapeHtml(rootQuestion)}</div>
        </div>
        <div class="decision-branches-grid">
          ${branchesHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * 4. Renderer: So Sánh Mô Hình Kiến Trúc 2 Cột (Side-by-side Comparison Matrix)
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

/**
 * 5. Renderer: Dòng Chảy Quy Trình Tuần Tự (Step-by-step Execution Pipeline)
 */
export function renderLifecycleFlow(text: string, title?: string): string {
  const displayTitle = title || 'DÒNG CHẢY QUY TRÌNH THỰC THI (EXECUTION PIPELINE)';
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('┌') && !l.startsWith('└') && !l.startsWith('├'));

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
          ${!isLast ? '<div class="flow-step-arrow">➔</div>' : ''}
        </div>
      `;
    })
    .join('');

  return `
    <div class="mindmap-container mindmap-lifecycle-flow">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon">⚡</span>
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

/**
 * 6. Fallback Blueprint: Sơ Đồ Khối Đồ Họa Thanh Lịch (Thích Ứng Light/Dark Theme Tuyệt Đối)
 */
export function renderCleanBlueprint(text: string, title?: string): string {
  const displayTitle = title || 'BẢN VẼ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE BLUEPRINT)';
  const cleanDiagram = escapeHtml(text.replace(/^\n+|\n+$/g, ''));

  return `
    <div class="mindmap-container mindmap-blueprint-view">
      <div class="mindmap-header">
        <div class="mindmap-title-wrap">
          <span class="mindmap-type-icon">📐</span>
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

/**
 * Hàm phân phối tổng quát: Tự động chọn parser trực quan phù hợp nhất
 */
export function renderSmartMindMapHtml(diagramText: string, title?: string): string {
  const category = detectDiagramCategory(diagramText, title);

  switch (category) {
    case 'memory-layout':
      return renderMemoryLayout(diagramText, title);
    case 'layered-stack':
      return renderLayeredStack(diagramText, title);
    case 'decision-tree':
      return renderDecisionTree(diagramText, title);
    case 'comparison':
      return renderComparisonFlow(diagramText, title);
    case 'lifecycle-flow':
      return renderLifecycleFlow(diagramText, title);
    case 'blueprint':
    default:
      return renderCleanBlueprint(diagramText, title);
  }
}
