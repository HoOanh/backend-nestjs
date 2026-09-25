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
 * 2. Renderer: Kiến Trúc Phân Tầng Hệ Thống (Enterprise Layered Stack) & Sơ Đồ Tư Duy (Radial Mindmap)
 */
export function renderLayeredStack(text: string, title?: string): string {
  const displayTitle = title || 'BẢN ĐỒ TẦNG BẬC HỆ THỐNG (SYSTEM TAXONOMY MAP)';
  const uniqueId = 'tax_' + Math.random().toString(36).substring(2, 9);

  // Trường hợp đặc thù Sơ đồ 1 của Chapter 1 (Hardware / Kernel / Libuv / V8 Engine / NestJS)
  if (text.includes('HARDWARE LAYER') || text.includes('TẦNG VẬT LÝ')) {
    return `
      <div class="system-architecture-board" id="${uniqueId}">
        <!-- Header với Tab Switcher -->
        <div class="arch-board-header">
          <div class="arch-title-wrap">
            <span class="arch-icon">🏗️</span>
            <div>
              <span class="arch-main-title">${escapeHtml(displayTitle)}</span>
              <span class="arch-subtitle">Kiến trúc đa tầng từ Phần cứng vật lý đến NestJS Application Framework</span>
            </div>
          </div>
          <div class="arch-view-switcher">
            <button class="arch-tab-btn active" onclick="
              const board = document.getElementById('${uniqueId}');
              board.querySelector('.arch-stack-container').style.display = 'flex';
              board.querySelector('.arch-radial-container').style.display = 'none';
              board.querySelectorAll('.arch-tab-btn').forEach(b => b.classList.remove('active'));
              this.classList.add('active');
            ">
              🏗️ Kiến Trúc Phân Tầng (Stack)
            </button>
            <button class="arch-tab-btn" onclick="
              const board = document.getElementById('${uniqueId}');
              if (board) {
                board.querySelector('.arch-stack-container').style.display = 'none';
                board.querySelector('.arch-radial-container').style.display = 'flex';
                board.querySelectorAll('.arch-tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                if (window.initMindMapControllers) {
                  window.initMindMapControllers(board);
                }
                window.dispatchEvent(new CustomEvent('mindmap:tab-switch', { detail: { boardId: '${uniqueId}' } }));
              }
            ">
              🧠 Sơ Đồ Tư Duy (Mindmap)
            </button>
          </div>
        </div>

        <!-- VIEW 1: KIẾN TRÚC PHÂN TẦNG ĐA TẦNG CHUẨN XÁC (DEFAULT) -->
        <div class="arch-stack-container" style="display: flex;">
          <!-- TẦNG 4: NESTJS APPLICATION LAYER (TRÊN CÙNG) -->
          <div class="arch-tier-card tier-app">
            <div class="tier-card-header header-app">
              <div class="tier-badge-wrap">
                <span class="tier-number-badge badge-app">TIER 04</span>
                <span class="tier-scope-tag">BUSINESS LOGIC & TRANSPORT</span>
              </div>
              <div class="tier-title">TẦNG ỨNG DỤNG DOANH NGHIỆP (NESTJS APPLICATION FRAMEWORK)</div>
            </div>
            <div class="tier-components-grid">
              <div class="component-block block-app">
                <div class="comp-head">
                  <span class="comp-icon">🎮</span>
                  <strong>Controllers & Routers</strong>
                </div>
                <p>Tiếp nhận HTTP request, ánh xạ URL, validate payload qua DTO và ValidationPipe.</p>
              </div>
              <div class="component-block block-app">
                <div class="comp-head">
                  <span class="comp-icon">⚙️</span>
                  <strong>Services & Domain Logic</strong>
                </div>
                <p>Singleton Providers xử lý nghiệp vụ thuần túy, tuyệt đối không lưu trạng thái request.</p>
              </div>
              <div class="component-block block-app">
                <div class="comp-head">
                  <span class="comp-icon">🗄️</span>
                  <strong>Repositories & Cache</strong>
                </div>
                <p>TypeORM / Prisma giao tiếp database (PostgreSQL), Redis Client lưu cache phân tán.</p>
              </div>
            </div>
          </div>

          <!-- CONNECTOR 3: NestJS IoC & Event Demux -->
          <div class="arch-connector-bridge bridge-app-runtime">
            <div class="connector-line"></div>
            <div class="connector-pill pill-app-runtime">
              <span class="connector-direction">▲</span>
              <span>NestJS Inversion of Control (IoC) & V8 Main Thread Callback Dispatcher</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>

          <!-- TẦNG 3: NODE.JS RUNTIME ENGINE (LIBUV + V8) -->
          <div class="arch-tier-card tier-runtime">
            <div class="tier-card-header header-runtime">
              <div class="tier-badge-wrap">
                <span class="tier-number-badge badge-runtime">TIER 03</span>
                <span class="tier-scope-tag">CORE ENGINE RUNTIME</span>
              </div>
              <div class="tier-title">TẦNG RUNTIME CẤP THẤP (NODE.JS / LIBUV & V8 JIT ENGINE)</div>
            </div>
            <div class="tier-runtime-split">
              <!-- Cột 1: Libuv Internals -->
              <div class="runtime-column col-libuv">
                <div class="column-header">
                  <span class="col-icon">🔄</span>
                  <strong>Libuv Core (Asynchronous I/O Engine)</strong>
                </div>
                <div class="comp-sub-list">
                  <div class="sub-item">
                    <span class="item-bullet">⚡</span>
                    <div>
                      <strong>Libuv Event Loop (1 Main Thread):</strong>
                      <span>Tuần hoàn 6 pha (Timers, Pending, Poll, Check, Close) điều phối mọi sự kiện I/O.</span>
                    </div>
                  </div>
                  <div class="sub-item">
                    <span class="item-bullet">🧵</span>
                    <div>
                      <strong>Libuv Worker Threadpool (4 Threads):</strong>
                      <span>Xử lý bất đồng bộ các tác vụ blocking: crypto băm, fs đọc ghi file, dns.lookup.</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Cột 2: V8 Memory Architecture -->
              <div class="runtime-column col-v8">
                <div class="column-header">
                  <span class="col-icon">🚀</span>
                  <strong>V8 Engine & Bộ Nhớ RSS (Google V8 Internals)</strong>
                </div>
                <div class="comp-sub-list">
                  <div class="sub-item">
                    <span class="item-bullet">🥞</span>
                    <div>
                      <strong>V8 Stack Space (LIFO):</strong>
                      <span>Lưu Call Frames và biến nguyên thủy, tự động pop khi hàm return (0% GC overhead).</span>
                    </div>
                  </div>
                  <div class="sub-item">
                    <span class="item-bullet">🌱</span>
                    <div>
                      <strong>V8 Heap (Young & Old Gen):</strong>
                      <span>Young Gen (Scavenge ~1ms) và Old Gen (Mark-Sweep-Compact giải phóng rác và chống phân mảnh).</span>
                    </div>
                  </div>
                  <div class="sub-item">
                    <span class="item-bullet">⚙️</span>
                    <div>
                      <strong>C++ Non-Heap (External Memory):</strong>
                      <span>Node.js Buffers cấp phát qua malloc(), nằm ngoài sự kiểm soát của V8 GC.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CONNECTOR 2: Libuv C++ System Bindings -->
          <div class="arch-connector-bridge bridge-runtime-kernel">
            <div class="connector-line"></div>
            <div class="connector-pill pill-runtime-kernel">
              <span class="connector-direction">▲</span>
              <span>Libuv C++ Bindings & POSIX Syscall Bridge (Event Demultiplexing)</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>

          <!-- TẦNG 2: LINUX OS KERNEL & SOCKET MULTIPLEXING -->
          <div class="arch-tier-card tier-kernel">
            <div class="tier-card-header header-kernel">
              <div class="tier-badge-wrap">
                <span class="tier-number-badge badge-kernel">TIER 02</span>
                <span class="tier-scope-tag">OPERATING SYSTEM LAYER</span>
              </div>
              <div class="tier-title">TẦNG NHÂN HỆ ĐIỀU HÀNH (LINUX OS KERNEL & I/O MULTIPLEXING)</div>
            </div>
            <div class="tier-components-grid">
              <div class="component-block block-kernel">
                <div class="comp-head">
                  <span class="comp-icon">📑</span>
                  <strong>File Descriptor Table</strong>
                </div>
                <p>Quản lý Socket Port 3000 <code>[FD: 12]</code> với cờ phi chặn <code>O_NONBLOCK</code>.</p>
              </div>
              <div class="component-block block-kernel">
                <div class="comp-head">
                  <span class="comp-icon">📥</span>
                  <strong>Kernel TCP Buffers</strong>
                </div>
                <p>Hàng đợi Receive Queue (RX) và Send Queue (TX) do mạng quản lý trong bộ nhớ kernel.</p>
              </div>
              <div class="component-block block-kernel">
                <div class="comp-head">
                  <span class="comp-icon">🎯</span>
                  <strong>Epoll / Kqueue Multiplexing</strong>
                </div>
                <p>Giám sát 10,000+ socket đồng thời với độ phức tạp <code>O(1)</code>, đánh thức tiến trình qua Ready List.</p>
              </div>
              <div class="component-block block-kernel">
                <div class="comp-head">
                  <span class="comp-icon">🗺️</span>
                  <strong>Virtual Memory & Page Tables</strong>
                </div>
                <p>Quản lý Resident Set Size (RSS), nạp trang bộ nhớ (Page Fault) và ngăn ngừa OOM Killer.</p>
              </div>
            </div>
          </div>

          <!-- CONNECTOR 1: Hardware Bus & Interrupts -->
          <div class="arch-connector-bridge bridge-kernel-hardware">
            <div class="connector-line"></div>
            <div class="connector-pill pill-kernel-hardware">
              <span class="connector-direction">▲</span>
              <span>Hardware Interrupts (IRQ), DMA Controllers & Memory Bus Protocols</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>

          <!-- TẦNG 1: PHYSICAL HARDWARE LAYER (NỀN TẢNG DƯỚI CÙNG) -->
          <div class="arch-tier-card tier-hardware">
            <div class="tier-card-header header-hardware">
              <div class="tier-badge-wrap">
                <span class="tier-number-badge badge-hardware">TIER 01</span>
                <span class="tier-scope-tag">PHYSICAL INFRASTRUCTURE</span>
              </div>
              <div class="tier-title">TẦNG VẬT LÝ & PHẦN CỨNG (CPU, RAM & I/O DEVICES)</div>
            </div>
            <div class="tier-components-grid">
              <div class="component-block block-hardware">
                <div class="comp-head">
                  <span class="comp-icon">⚡</span>
                  <strong>CPU Cores & L1/L2/L3 Cache</strong>
                </div>
                <p>Xung nhịp GHz, truy xuất Cache siêu tốc độ trễ <strong>1 - 10 nanoseconds</strong>.</p>
              </div>
              <div class="component-block block-hardware">
                <div class="comp-head">
                  <span class="comp-icon">🧠</span>
                  <strong>RAM Bus Vật Lý (DDR4 / DDR5)</strong>
                </div>
                <p>Băng thông bộ nhớ chính, độ trễ vật lý <strong>~50 - 100 nanoseconds</strong>.</p>
              </div>
              <div class="component-block block-hardware">
                <div class="comp-head">
                  <span class="comp-icon">💾</span>
                  <strong>NVMe SSD & Card Mạng (NIC)</strong>
                </div>
                <p>Ổ cứng đĩa và Network Interface Card 10Gbps, độ trễ <strong>10 - 100 microseconds</strong>.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- VIEW 2: SƠ ĐỒ TƯ DUY TỎA NHÁNH HỮU CƠ TƯƠNG TÁC (ORGANIC VECTOR MINDMAP CANVAS) -->
        <div class="arch-radial-container" id="radial_${uniqueId}" data-board-id="${uniqueId}" style="display: none;">
          <!-- Thanh điều khiển trên cùng (Filter Chips & Pan/Zoom Controls) -->
          <div class="mindmap-top-bar">
            <!-- Nhóm bộ lọc nhánh tương tác -->
            <div class="mindmap-legend-group">
              <button type="button" class="mindmap-chip chip-all active" data-filter="all">Tất cả</button>
              <button type="button" class="mindmap-chip chip-blue" data-filter="blue"><span class="chip-dot"></span> Phần Cứng</button>
              <button type="button" class="mindmap-chip chip-green" data-filter="green"><span class="chip-dot"></span> Linux Kernel</button>
              <button type="button" class="mindmap-chip chip-sky" data-filter="sky"><span class="chip-dot"></span> Libuv Core</button>
              <button type="button" class="mindmap-chip chip-rose" data-filter="rose"><span class="chip-dot"></span> V8 & Bộ Nhớ</button>
            </div>

            <!-- Nhóm công cụ Thu phóng & Kéo Canvas -->
            <div class="mindmap-ctrl-group">
              <button type="button" class="mindmap-ctrl-btn btn-zoom-out" title="Thu nhỏ (Cuộn chuột xuống)">−</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-level" title="Bấm để đặt lại tỉ lệ chuẩn 100%">100%</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-in" title="Phóng to (Cuộn chuột lên)">+</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-fit" title="Thu phóng vừa vặn toàn màn hình">🎯 Vừa vặn</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-reset" title="Đặt lại vị trí trung tâm">🔄 Đặt lại</button>
              <button type="button" class="mindmap-ctrl-btn btn-fullscreen" title="Phóng to toàn màn hình (Esc để thoát)">⛶ Toàn màn hình</button>
            </div>
          </div>

          <!-- Viewport tương tác Pan & Zoom -->
          <div class="mindmap-viewport" id="viewport_${uniqueId}">
            <div class="mindmap-stage" id="stage_${uniqueId}">
              <svg class="mindmap-master-svg" viewBox="0 0 2050 700" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <!-- Gradients for Stems -->
                  <linearGradient id="stem-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#38bdf8" />
                    <stop offset="100%" stop-color="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="stem-green" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#34d399" />
                    <stop offset="100%" stop-color="#16a34a" />
                  </linearGradient>
                  <linearGradient id="stem-sky" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#38bdf8" />
                    <stop offset="100%" stop-color="#0284c7" />
                  </linearGradient>
                  <linearGradient id="stem-rose" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fb7185" />
                    <stop offset="100%" stop-color="#e11d48" />
                  </linearGradient>
                  <linearGradient id="hub-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#14b8a6" />
                    <stop offset="100%" stop-color="#0d9488" />
                  </linearGradient>

                  <!-- Drop Shadows -->
                  <filter id="card-shadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.12" />
                  </filter>
                  <filter id="hub-shadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0d9488" flood-opacity="0.35" />
                  </filter>
                </defs>

                <!-- =================== 1. CENTER HUB =================== -->
                <g class="mindmap-hub" transform="translate(1025, 350)">
                  <rect x="-125" y="-35" width="250" height="70" rx="20" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-opacity="0.35" stroke-dasharray="4 4" />
                  <rect x="-115" y="-28" width="230" height="56" rx="16" fill="url(#hub-bg)" filter="url(#hub-shadow)" />
                  <text x="0" y="-3" text-anchor="middle" class="hub-svg-title">Runtime Taxonomy</text>
                  <text x="0" y="16" text-anchor="middle" class="hub-svg-sub">HỆ QUẢN TRỊ TOÀN CẢNH</text>
                </g>

                <!-- =================== 2. BRANCH 1: PHẦN CỨNG & VẬT LÝ (TOP-LEFT) =================== -->
                <g class="mindmap-branch branch-blue">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 900 336 C 810 336, 760 160, 710 160" stroke="#3b82f6" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Phần Cứng (translate 660, 160) -->
                  <g class="branch-card-group" transform="translate(660, 160)">
                    <rect x="-50" y="-45" width="100" height="90" rx="16" class="node-card-bg card-border-blue" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">⚙️</text>
                    <text x="0" y="18" text-anchor="middle" class="card-svg-title">Phần Cứng</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">1 - 100ns</text>
                  </g>

                  <!-- Fork connector from Card to 2 Sub-branches -->
                  <path d="M 610 160 L 580 160" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="580" cy="160" r="4.5" class="fork-joint-circle circle-blue" />

                  <!-- Sub-branch 1A (UP): CPU & Bộ Nhớ -->
                  <path d="M 580 160 C 555 160, 540 95, 510 95" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="510" cy="95" r="4" class="sub-joint-circle circle-blue" />
                  <text x="495" y="99" text-anchor="end" class="sub-cat-title">CPU & Bộ Nhớ</text>

                  <!-- Fork from CPU & Bộ Nhớ to 2 Leaves -->
                  <path d="M 390 95 L 365 95" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="365" cy="95" r="3.5" class="leaf-joint-circle circle-blue" />
                  <path d="M 365 95 C 345 95, 335 65, 310 65" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="300" y="69" text-anchor="end" class="leaf-svg-text">CPU Cores & Cache (1-10ns clock)</text>

                  <path d="M 365 95 C 345 95, 335 125, 310 125" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="300" y="129" text-anchor="end" class="leaf-svg-text">RAM Bus DDR4/DDR5 (~50-100ns)</text>

                  <!-- Sub-branch 1B (DOWN): Thiết Bị I/O -->
                  <path d="M 580 160 C 555 160, 540 225, 510 225" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="510" cy="225" r="4" class="sub-joint-circle circle-blue" />
                  <text x="495" y="229" text-anchor="end" class="sub-cat-title">Thiết Bị I/O</text>

                  <!-- Fork from Thiết Bị I/O to 2 Leaves -->
                  <path d="M 405 225 L 380 225" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="380" cy="225" r="3.5" class="leaf-joint-circle circle-blue" />
                  <path d="M 380 225 C 360 225, 350 195, 325 195" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="315" y="199" text-anchor="end" class="leaf-svg-text">NVMe SSD PCIe 4.0 (10-100μs I/O)</text>

                  <path d="M 380 225 C 360 225, 350 255, 325 255" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="315" y="259" text-anchor="end" class="leaf-svg-text">Card Mạng NIC 10Gbps (RX/TX Queue)</text>
                </g>

                <!-- =================== 3. BRANCH 2: LINUX OS KERNEL (BOTTOM-LEFT) =================== -->
                <g class="mindmap-branch branch-green">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 900 364 C 810 364, 760 540, 710 540" stroke="#16a34a" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Linux Kernel (translate 660, 540) -->
                  <g class="branch-card-group" transform="translate(660, 540)">
                    <rect x="-50" y="-45" width="100" height="90" rx="16" class="node-card-bg card-border-green" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🐧</text>
                    <text x="0" y="18" text-anchor="middle" class="card-svg-title">Linux Kernel</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Syscalls O(1)</text>
                  </g>

                  <!-- Fork connector from Card to 2 Sub-branches -->
                  <path d="M 610 540 L 580 540" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="580" cy="540" r="4.5" class="fork-joint-circle circle-green" />

                  <!-- Sub-branch 2A (UP): Socket & Queue -->
                  <path d="M 580 540 C 555 540, 540 475, 510 475" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="510" cy="475" r="4" class="sub-joint-circle circle-green" />
                  <text x="495" y="479" text-anchor="end" class="sub-cat-title">Socket & Queue</text>

                  <!-- Fork to 2 Leaves -->
                  <path d="M 380 475 L 355 475" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="355" cy="475" r="3.5" class="leaf-joint-circle circle-green" />
                  <path d="M 355 475 C 335 475, 325 445, 300 445" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="290" y="449" text-anchor="end" class="leaf-svg-text">File Descriptor Table [FD: 12]</text>

                  <path d="M 355 475 C 335 475, 325 505, 300 505" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="290" y="509" text-anchor="end" class="leaf-svg-text">Kernel TCP Buffers (Receive/Send)</text>

                  <!-- Sub-branch 2B (DOWN): Multiplexing -->
                  <path d="M 580 540 C 555 540, 540 605, 510 605" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="510" cy="605" r="4" class="sub-joint-circle circle-green" />
                  <text x="495" y="609" text-anchor="end" class="sub-cat-title">Multiplexing</text>

                  <!-- Fork to 2 Leaves -->
                  <path d="M 395 605 L 370 605" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="370" cy="605" r="3.5" class="leaf-joint-circle circle-green" />
                  <path d="M 370 605 C 350 605, 340 575, 315 575" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="305" y="579" text-anchor="end" class="leaf-svg-text">Epoll / Kqueue (10K+ Sockets O(1))</text>

                  <path d="M 370 605 C 350 605, 340 635, 315 635" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="305" y="639" text-anchor="end" class="leaf-svg-text">Virtual Memory & Page Tables (RSS)</text>
                </g>

                <!-- =================== 4. BRANCH 3: LIBUV INTERNALS (TOP-RIGHT) =================== -->
                <g class="mindmap-branch branch-sky">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 1150 336 C 1240 336, 1290 160, 1340 160" stroke="#0284c7" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Libuv Core (translate 1390, 160) -->
                  <g class="branch-card-group" transform="translate(1390, 160)">
                    <rect x="-50" y="-45" width="100" height="90" rx="16" class="node-card-bg card-border-sky" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🔄</text>
                    <text x="0" y="18" text-anchor="middle" class="card-svg-title">Libuv Core</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Async I/O Loop</text>
                  </g>

                  <!-- Fork connector from Card to 2 Sub-branches -->
                  <path d="M 1440 160 L 1470 160" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="1470" cy="160" r="4.5" class="fork-joint-circle circle-sky" />

                  <!-- Sub-branch 3A (UP): Event Loop -->
                  <path d="M 1470 160 C 1495 160, 1510 95, 1540 95" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="1540" cy="95" r="4" class="sub-joint-circle circle-sky" />
                  <text x="1555" y="99" text-anchor="start" class="sub-cat-title">Event Loop</text>

                  <!-- Fork to 2 Leaves -->
                  <path d="M 1645 95 L 1670 95" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="1670" cy="95" r="3.5" class="leaf-joint-circle circle-sky" />
                  <path d="M 1670 95 C 1690 95, 1700 65, 1725 65" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="69" text-anchor="start" class="leaf-svg-text">1 Main Thread duy nhất tuần hoàn 6 pha</text>

                  <path d="M 1670 95 C 1690 95, 1700 125, 1725 125" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="129" text-anchor="start" class="leaf-svg-text">Libuv C-Bindings cầu nối Syscalls vào JS</text>

                  <!-- Sub-branch 3B (DOWN): Threadpool -->
                  <path d="M 1470 160 C 1495 160, 1510 225, 1540 225" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="1540" cy="225" r="4" class="sub-joint-circle circle-sky" />
                  <text x="1555" y="229" text-anchor="start" class="sub-cat-title">Threadpool</text>

                  <!-- Fork to 2 Leaves -->
                  <path d="M 1645 225 L 1670 225" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="1670" cy="225" r="3.5" class="leaf-joint-circle circle-sky" />
                  <path d="M 1670 225 C 1690 225, 1700 195, 1725 195" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="199" text-anchor="start" class="leaf-svg-text">4 Worker Threads (fs file, crypto băm)</text>

                  <path d="M 1670 225 C 1690 225, 1700 255, 1725 255" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="259" text-anchor="start" class="leaf-svg-text">Chặn blocking I/O gây đóng băng Main Loop</text>
                </g>

                <!-- =================== 5. BRANCH 4: V8 ENGINE & RSS MEMORY (BOTTOM-RIGHT) =================== -->
                <g class="mindmap-branch branch-rose">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 1150 364 C 1240 364, 1290 540, 1340 540" stroke="#f43f5e" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: V8 & Bộ Nhớ (translate 1390, 540) -->
                  <g class="branch-card-group" transform="translate(1390, 540)">
                    <rect x="-50" y="-45" width="100" height="90" rx="16" class="node-card-bg card-border-rose" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🚀</text>
                    <text x="0" y="18" text-anchor="middle" class="card-svg-title">V8 & Bộ Nhớ</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">GC Heap & RSS</text>
                  </g>

                  <!-- Fork connector from Card to 2 Sub-branches -->
                  <path d="M 1440 540 L 1470 540" stroke="#f43f5e" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="1470" cy="540" r="4.5" class="fork-joint-circle circle-rose" />

                  <!-- Sub-branch 4A (UP): Bộ Nhớ V8 -->
                  <path d="M 1470 540 C 1495 540, 1510 475, 1540 475" stroke="#f43f5e" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="1540" cy="475" r="4" class="sub-joint-circle circle-rose" />
                  <text x="1555" y="479" text-anchor="start" class="sub-cat-title">Bộ Nhớ V8</text>

                  <!-- Fork to 2 Leaves -->
                  <path d="M 1645 475 L 1670 475" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="1670" cy="475" r="3.5" class="leaf-joint-circle circle-rose" />
                  <path d="M 1670 475 C 1690 475, 1700 445, 1725 445" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="449" text-anchor="start" class="leaf-svg-text">V8 Stack: Call Frames (0% GC overhead)</text>

                  <path d="M 1670 475 C 1690 475, 1700 505, 1725 505" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="509" text-anchor="start" class="leaf-svg-text">Young & Old Gen Heap: Scavenge & Mark-Sweep</text>

                  <!-- Sub-branch 4B (DOWN): Bộ Nhớ C++ -->
                  <path d="M 1470 540 C 1495 540, 1510 605, 1540 605" stroke="#f43f5e" stroke-width="3" stroke-linecap="round" fill="none" />
                  <circle cx="1540" cy="605" r="4" class="sub-joint-circle circle-rose" />
                  <text x="1555" y="609" text-anchor="start" class="sub-cat-title">Bộ Nhớ C++</text>

                  <!-- Fork to 2 Leaves -->
                  <path d="M 1645 605 L 1670 605" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <circle cx="1670" cy="605" r="3.5" class="leaf-joint-circle circle-rose" />
                  <path d="M 1670 605 C 1690 605, 1700 575, 1725 575" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="579" text-anchor="start" class="leaf-svg-text">C++ Buffers malloc() quản trị ngoài V8 Heap</text>

                  <path d="M 1670 605 C 1690 605, 1700 635, 1725 635" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
                  <text x="1735" y="639" text-anchor="start" class="leaf-svg-text">Resident Set Size (RSS) tổng tiêu thụ bộ nhớ</text>
                </g>
              </svg>
            </div>

            <!-- Gợi ý tương tác nhanh nổi góc dưới -->
            <div class="mindmap-interaction-hint">
              <span>✋ Giữ chuột kéo để di chuyển canvas • 🔍 Cuộn chuột để Phóng to / Thu nhỏ</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Parser tổng quát cho các Bản đồ phân tầng khác (Fallback Parser)
  const lines = text.split('\n');
  const layers: ParsedLayer[] = [];
  let currentLayer: ParsedLayer | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith('┌') || rawLine.startsWith('└') || rawLine.startsWith('├') || rawLine === '│') continue;

    const layerMatch = rawLine.match(/(?:│\s*)?(\d+)\.\s+([^│\n]+)(?:│)?/);
    if (layerMatch && (rawLine.includes('TẦNG') || rawLine.includes('LAYER') || rawLine.includes('PILLARS') || rawLine.includes('TRỤ CỘT') || rawLine.includes('CẤP'))) {
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

  // Render các tầng theo thứ tự phân tầng dọc (Vertical Architecture Stack)
  const tiersHtml = layers
    .map((l, index) => {
      const itemsHtml = l.items
        .map((it) => `
          <div class="component-block">
            <div class="comp-head">
              <span class="comp-icon">❖</span>
              <strong>${escapeHtml(it.title)}</strong>
            </div>
            ${it.subtitle ? `<p>${escapeHtml(it.subtitle)}</p>` : ''}
          </div>
        `)
        .join('');

      const connectorHtml = index < layers.length - 1
        ? `
          <div class="arch-connector-bridge">
            <div class="connector-line"></div>
            <div class="connector-pill">
              <span class="connector-direction">▲</span>
              <span>Dòng Dữ Liệu & Gọi Hàm Hệ Thống</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>
        `
        : '';

      return `
        <div class="arch-tier-card tier-general">
          <div class="tier-card-header">
            <div class="tier-badge-wrap">
              <span class="tier-number-badge">CẤP ${escapeHtml(l.layerNumber)}</span>
            </div>
            <div class="tier-title">${escapeHtml(l.layerTitle)}</div>
          </div>
          <div class="tier-components-grid">
            ${itemsHtml}
          </div>
        </div>
        ${connectorHtml}
      `;
    })
    .join('');

  return `
    <div class="system-architecture-board">
      <div class="arch-board-header">
        <div class="arch-title-wrap">
          <span class="arch-icon">🏗️</span>
          <div>
            <span class="arch-main-title">${escapeHtml(displayTitle)}</span>
            <span class="arch-subtitle">Mô hình phân tầng kiến trúc chuyên sâu</span>
          </div>
        </div>
        <div class="arch-view-badge">ENTERPRISE STACK</div>
      </div>
      <div class="arch-stack-container">
        ${tiersHtml}
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

declare global {
  interface Window {
    initMindMapControllers?: (root?: HTMLElement | Document | null) => () => void;
  }
}

/**
 * Khởi tạo bộ điều khiển tương tác (Pan, Zoom, Fit, Fullscreen, Filter) cho Sơ đồ Mindmap
 */
export function initMindMapControllers(root?: HTMLElement | Document | null): () => void {
  const container = root || (typeof document !== 'undefined' ? document : null);
  if (!container) return () => {};

  const boards = container.querySelectorAll<HTMLElement>('.system-architecture-board');
  const cleanups: Array<() => void> = [];

  boards.forEach((board) => {
    if (board.dataset.mindmapInit === 'true') return;
    board.dataset.mindmapInit = 'true';

    const radialContainer = board.querySelector<HTMLElement>('.arch-radial-container');
    const viewport = board.querySelector<HTMLElement>('.mindmap-viewport');
    const stage = board.querySelector<HTMLElement>('.mindmap-stage');
    const zoomLevelBtn = board.querySelector<HTMLElement>('.btn-zoom-level');
    const zoomInBtn = board.querySelector<HTMLElement>('.btn-zoom-in');
    const zoomOutBtn = board.querySelector<HTMLElement>('.btn-zoom-out');
    const zoomFitBtn = board.querySelector<HTMLElement>('.btn-zoom-fit');
    const zoomResetBtn = board.querySelector<HTMLElement>('.btn-zoom-reset');
    const fullscreenBtn = board.querySelector<HTMLElement>('.btn-fullscreen');
    const chips = board.querySelectorAll<HTMLButtonElement>('.mindmap-chip');
    const hintBadge = board.querySelector<HTMLElement>('.mindmap-interaction-hint');

    if (!viewport || !stage) return;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const hideHint = () => {
      if (hintBadge) {
        hintBadge.style.opacity = '0';
        setTimeout(() => {
          if (hintBadge) hintBadge.style.display = 'none';
        }, 500);
      }
    };

    const updateTransform = () => {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      if (zoomLevelBtn) {
        zoomLevelBtn.textContent = `${Math.round(scale * 100)}%`;
      }
    };

    const fitToScreen = () => {
      const vpWidth = viewport.clientWidth || 1000;
      const vpHeight = viewport.clientHeight || 600;
      const svgWidth = 2050;
      const svgHeight = 700;
      const scaleX = vpWidth / svgWidth;
      const scaleY = vpHeight / svgHeight;
      // Thu phóng vừa vặn toàn bộ sơ đồ với lề an toàn 94%
      scale = Math.max(0.35, Math.min(1.2, Math.min(scaleX, scaleY) * 0.94));
      panX = 0;
      panY = 0;
      updateTransform();
    };

    // Chuột kéo di chuyển (Pan)
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.mindmap-ctrl-btn, .mindmap-chip')) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      viewport.style.cursor = 'grabbing';
      hideHint();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        viewport.style.cursor = 'grab';
      }
    };

    // Cuộn chuột thu phóng (Zoom)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      hideHint();
      const zoomFactor = e.deltaY < 0 ? 0.12 : -0.12;
      scale = Math.min(2.8, Math.max(0.35, scale + zoomFactor));
      updateTransform();
    };

    // Cảm ứng Touch Pan & Pinch Zoom trên di động/trackpad
    let touchStartDist = 0;
    let initialTouchScale = 1;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.mindmap-ctrl-btn, .mindmap-chip')) return;
      hideHint();
      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialTouchScale = scale;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        updateTransform();
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / touchStartDist;
        scale = Math.min(2.8, Math.max(0.35, initialTouchScale * ratio));
        updateTransform();
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
      touchStartDist = 0;
    };

    // Nút Zoom
    const onZoomIn = () => {
      hideHint();
      scale = Math.min(2.8, scale + 0.15);
      updateTransform();
    };

    const onZoomOut = () => {
      hideHint();
      scale = Math.max(0.35, scale - 0.15);
      updateTransform();
    };

    const onZoomReset = () => {
      hideHint();
      scale = 1.0;
      panX = 0;
      panY = 0;
      updateTransform();
    };

    const onZoomFit = () => {
      hideHint();
      fitToScreen();
    };

    // Bật/tắt chế độ toàn màn hình
    const toggleFullscreen = () => {
      const isFs = board.classList.toggle('is-fullscreen');
      if (fullscreenBtn) {
        fullscreenBtn.textContent = isFs ? '✕ Thu nhỏ' : '⛶ Toàn màn hình';
      }
      setTimeout(fitToScreen, 120);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && board.classList.contains('is-fullscreen')) {
        board.classList.remove('is-fullscreen');
        if (fullscreenBtn) fullscreenBtn.textContent = '⛶ Toàn màn hình';
        setTimeout(fitToScreen, 120);
      }
    };

    // Lọc nhánh tương tác
    const onChipClick = (chip: HTMLButtonElement) => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.filter || 'all';

      const branches = stage.querySelectorAll<SVGElement>('.mindmap-branch');
      branches.forEach((b) => {
        if (filter === 'all') {
          b.classList.remove('is-dimmed', 'is-highlighted');
        } else {
          if (b.classList.contains(`branch-${filter}`)) {
            b.classList.remove('is-dimmed');
            b.classList.add('is-highlighted');
          } else {
            b.classList.add('is-dimmed');
            b.classList.remove('is-highlighted');
          }
        }
      });
    };

    // Lắng nghe sự kiện chuyển tab
    const onTabChange = (e: Event) => {
      const customEvt = e as CustomEvent<{ boardId: string }>;
      if (customEvt.detail?.boardId === board.id) {
        setTimeout(fitToScreen, 60);
      }
    };

    // Gắn sự kiện
    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);

    zoomInBtn?.addEventListener('click', onZoomIn);
    zoomOutBtn?.addEventListener('click', onZoomOut);
    zoomResetBtn?.addEventListener('click', onZoomReset);
    zoomLevelBtn?.addEventListener('click', onZoomReset);
    zoomFitBtn?.addEventListener('click', onZoomFit);
    fullscreenBtn?.addEventListener('click', toggleFullscreen);
    window.addEventListener('keydown', onKeyDown);

    chips.forEach((chip) => {
      chip.addEventListener('click', () => onChipClick(chip));
    });

    window.addEventListener('mindmap:tab-switch', onTabChange);

    // Tự động căn chỉnh nếu Mindmap đang hiển thị
    if (radialContainer && radialContainer.style.display !== 'none') {
      setTimeout(fitToScreen, 60);
    }

    cleanups.push(() => {
      viewport.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);

      zoomInBtn?.removeEventListener('click', onZoomIn);
      zoomOutBtn?.removeEventListener('click', onZoomOut);
      zoomResetBtn?.removeEventListener('click', onZoomReset);
      zoomLevelBtn?.removeEventListener('click', onZoomReset);
      zoomFitBtn?.removeEventListener('click', onZoomFit);
      fullscreenBtn?.removeEventListener('click', toggleFullscreen);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mindmap:tab-switch', onTabChange);
      board.removeAttribute('data-mindmap-init');
    });
  });

  return () => {
    cleanups.forEach((c) => c());
  };
}

// Khai báo hook toàn cục
if (typeof window !== 'undefined') {
  window.initMindMapControllers = initMindMapControllers;
}

