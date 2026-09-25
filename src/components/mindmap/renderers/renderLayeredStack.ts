import { escapeHtml } from '../../common/CodeViewer.tsx';
import type { ParsedLayer } from '../types.ts';
import { renderCleanBlueprint } from './renderCleanBlueprint.ts';

/**
 * Renderer: Kiến Trúc Phân Tầng Hệ Thống (Enterprise Layered Stack) & Sơ Đồ Tư Duy (Radial Mindmap)
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

        <!-- VIEW 2: SƠ ĐỒ TƯ DUY 4 TẦNG ĐỒNG BỘ TOÀN DIỆN (COLLAPSIBLE 4-TIER MINDMAP CANVAS) -->
        <div class="arch-radial-container" id="radial_${uniqueId}" data-board-id="${uniqueId}" style="display: none;">
          <!-- Thanh điều khiển trên cùng (Filter Chips, Tree Collapse/Expand & Pan/Zoom Controls) -->
          <div class="mindmap-top-bar">
            <!-- Nhóm bộ lọc 4 Tầng tương tác -->
            <div class="mindmap-legend-group">
              <button type="button" class="mindmap-chip chip-all active" data-filter="all">Tất cả (4 Tầng)</button>
              <button type="button" class="mindmap-chip chip-purple" data-filter="purple"><span class="chip-dot"></span> Tier 04: NestJS</button>
              <button type="button" class="mindmap-chip chip-sky" data-filter="sky"><span class="chip-dot"></span> Tier 03: Node.js & Libuv</button>
              <button type="button" class="mindmap-chip chip-green" data-filter="green"><span class="chip-dot"></span> Tier 02: Linux Kernel</button>
              <button type="button" class="mindmap-chip chip-amber" data-filter="amber"><span class="chip-dot"></span> Tier 01: Phần Cứng</button>
            </div>

            <!-- Nhóm nút Đóng/Mở nhanh tất cả nhánh -->
            <div class="mindmap-tree-ctrl-group">
              <button type="button" class="mindmap-ctrl-btn btn-expand-all" title="Mở rộng toàn bộ các nhánh con của 4 Tầng">📂 Mở tất cả</button>
              <button type="button" class="mindmap-ctrl-btn btn-collapse-all" title="Thu gọn tất cả các nhánh con, chỉ hiển thị 4 Tầng chính">📁 Thu gọn</button>
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
              <svg class="mindmap-master-svg" viewBox="0 0 2400 1080" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <!-- Gradients for Stems -->
                  <linearGradient id="stem-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#a855f7" />
                    <stop offset="100%" stop-color="#7c3aed" />
                  </linearGradient>
                  <linearGradient id="stem-sky" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#38bdf8" />
                    <stop offset="100%" stop-color="#0284c7" />
                  </linearGradient>
                  <linearGradient id="stem-green" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#34d399" />
                    <stop offset="100%" stop-color="#16a34a" />
                  </linearGradient>
                  <linearGradient id="stem-amber" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fbbf24" />
                    <stop offset="100%" stop-color="#d97706" />
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
                <g class="mindmap-hub mindmap-interactive-node" data-node-id="hub" transform="translate(1200, 540)" cursor="pointer">
                  <rect x="-140" y="-38" width="280" height="76" rx="20" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-opacity="0.4" stroke-dasharray="5 5" />
                  <rect x="-130" y="-30" width="260" height="60" rx="16" fill="url(#hub-bg)" filter="url(#hub-shadow)" />
                  <text x="0" y="-4" text-anchor="middle" class="hub-svg-title">Runtime Taxonomy</text>
                  <text x="0" y="16" text-anchor="middle" class="hub-svg-sub">HỆ THỐNG ĐA TẦNG TOÀN CẢNH</text>
                </g>

                <!-- =================== 2. TIER 04: NESTJS APPLICATION (TOP-RIGHT) =================== -->
                <g class="mindmap-tier-branch branch-purple" data-tier-id="t4">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 1340 515 C 1420 515, 1470 260, 1530 260" stroke="#8b5cf6" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 04 (translate 1530, 260) -->
                  <g class="branch-card-group mindmap-interactive-node" data-node-id="t4-root" transform="translate(1530, 260)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-purple" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🏛️</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 04: NestJS</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Application & IoC</text>
                    <!-- Toggle collapse badge -->
                    <g class="tier-toggle-badge badge-purple" transform="translate(42, -34)">
                      <rect x="-12" y="-10" width="24" height="20" rx="6" fill="#8b5cf6" />
                      <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector -->
                    <path d="M 1585 260 L 1630 260" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1630" cy="260" r="4.5" class="fork-joint-circle circle-purple" />

                    <!-- Sub-branch 4A: Controllers & Routers (Y=140) -->
                    <path d="M 1630 260 C 1660 260, 1680 140, 1720 140" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1720" cy="140" r="4" class="sub-joint-circle circle-purple" />
                    <text x="1735" y="144" text-anchor="start" class="sub-cat-title mindmap-interactive-node" data-node-id="t4-controllers" cursor="pointer">Controllers & Routers</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 1910 140 L 1940 140" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="1940" cy="140" r="3.5" class="leaf-joint-circle circle-purple" />
                    <path d="M 1940 140 C 1965 140, 1975 110, 2005 110" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2015" y="114" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t4-dto" cursor="pointer">DTO ValidationPipe (Class-validator & Whitelist)</text>

                    <path d="M 1940 140 C 1965 140, 1975 170, 2005 170" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2015" y="174" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t4-routes" cursor="pointer">Route Context & Interceptors Pipeline (AOP)</text>

                    <!-- Sub-branch 4B: Services & Domain Logic (Y=260) -->
                    <path d="M 1630 260 L 1720 260" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1720" cy="260" r="4" class="sub-joint-circle circle-purple" />
                    <text x="1735" y="264" text-anchor="start" class="sub-cat-title mindmap-interactive-node" data-node-id="t4-services" cursor="pointer">Services & Domain Logic</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 1945 260 L 1975 260" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="1975" cy="260" r="3.5" class="leaf-joint-circle circle-purple" />
                    <path d="M 1975 260 C 2000 260, 2010 230, 2040 230" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2050" y="234" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t4-ioc" cursor="pointer">IoC Container & Singleton Lifecycle</text>

                    <path d="M 1975 260 C 2000 260, 2010 290, 2040 290" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2050" y="294" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t4-services" cursor="pointer">Stateless Pure Business Logic Services</text>

                    <!-- Sub-branch 4C: Repositories & Caching (Y=380) -->
                    <path d="M 1630 260 C 1660 260, 1680 380, 1720 380" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1720" cy="380" r="4" class="sub-joint-circle circle-purple" />
                    <text x="1735" y="384" text-anchor="start" class="sub-cat-title mindmap-interactive-node" data-node-id="t4-repos" cursor="pointer">Repositories & Caching</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 1930 380 L 1960 380" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="1960" cy="380" r="3.5" class="leaf-joint-circle circle-purple" />
                    <path d="M 1960 380 C 1985 380, 1995 350, 2025 350" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2035" y="354" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t4-repos" cursor="pointer">TypeORM / Prisma Pool (PostgreSQL)</text>

                    <path d="M 1960 380 C 1985 380, 1995 410, 2025 410" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2035" y="414" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t4-repos" cursor="pointer">Redis Distributed Multi-tier Cache</text>
                  </g>
                </g>

                <!-- =================== 3. TIER 03: NODE.JS RUNTIME ENGINE (BOTTOM-RIGHT) =================== -->
                <g class="mindmap-tier-branch branch-sky" data-tier-id="t3">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 1340 565 C 1420 565, 1470 820, 1530 820" stroke="#0284c7" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 03 (translate 1530, 820) -->
                  <g class="branch-card-group mindmap-interactive-node" data-node-id="t3-root" transform="translate(1530, 820)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-sky" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🔄</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 03: Runtime</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Node.js & Libuv</text>
                    <!-- Toggle collapse badge -->
                    <g class="tier-toggle-badge badge-sky" transform="translate(42, -34)">
                      <rect x="-12" y="-10" width="24" height="20" rx="6" fill="#0284c7" />
                      <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector -->
                    <path d="M 1585 820 L 1630 820" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1630" cy="820" r="4.5" class="fork-joint-circle circle-sky" />

                    <!-- Sub-branch 3A: Libuv Asynchronous Engine (Y=700) -->
                    <path d="M 1630 820 C 1660 820, 1680 700, 1720 700" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1720" cy="700" r="4" class="sub-joint-circle circle-sky" />
                    <text x="1735" y="704" text-anchor="start" class="sub-cat-title mindmap-interactive-node" data-node-id="t3-libuv" cursor="pointer">Libuv Asynchronous Engine</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 1965 700 L 1995 700" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="1995" cy="700" r="3.5" class="leaf-joint-circle circle-sky" />
                    <path d="M 1995 700 C 2020 700, 2030 670, 2060 670" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2070" y="674" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t3-loop" cursor="pointer">1 Main Thread Event Loop (Tuần hoàn 6 pha)</text>

                    <path d="M 1995 700 C 2020 700, 2030 730, 2060 730" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2070" y="734" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t3-threads" cursor="pointer">4 Worker Threads (fs, crypto băm, dns)</text>

                    <!-- Sub-branch 3B: V8 Memory Architecture (Y=820) -->
                    <path d="M 1630 820 L 1720 820" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1720" cy="820" r="4" class="sub-joint-circle circle-sky" />
                    <text x="1735" y="824" text-anchor="start" class="sub-cat-title mindmap-interactive-node" data-node-id="t3-v8" cursor="pointer">V8 Memory Architecture</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 1945 820 L 1975 820" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="1975" cy="820" r="3.5" class="leaf-joint-circle circle-sky" />
                    <path d="M 1975 820 C 2000 820, 2010 790, 2040 790" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2050" y="794" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t3-stack" cursor="pointer">V8 Stack Space: Call Frames (0% GC overhead)</text>

                    <path d="M 1975 820 C 2000 820, 2010 850, 2040 850" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2050" y="854" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t3-heap" cursor="pointer">V8 Heap: Young Scavenge & Old Mark-Sweep</text>

                    <!-- Sub-branch 3C: C++ Non-Heap & Buffers (Y=940) -->
                    <path d="M 1630 820 C 1660 820, 1680 940, 1720 940" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="1720" cy="940" r="4" class="sub-joint-circle circle-sky" />
                    <text x="1735" y="944" text-anchor="start" class="sub-cat-title mindmap-interactive-node" data-node-id="t3-buffers" cursor="pointer">C++ Non-Heap & Buffers</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 1935 940 L 1965 940" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="1965" cy="940" r="3.5" class="leaf-joint-circle circle-sky" />
                    <path d="M 1965 940 C 1990 940, 2000 910, 2030 910" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2040" y="914" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t3-buffers" cursor="pointer">Node.js Buffers malloc() ngoài V8 Heap</text>

                    <path d="M 1965 940 C 1990 940, 2000 970, 2030 970" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="2040" y="974" text-anchor="start" class="leaf-svg-text mindmap-interactive-node" data-node-id="t3-libuv" cursor="pointer">Libuv C-Bindings & Syscall POSIX Bridge</text>
                  </g>
                </g>

                <!-- =================== 4. TIER 02: LINUX OS KERNEL (BOTTOM-LEFT) =================== -->
                <g class="mindmap-tier-branch branch-green" data-tier-id="t2">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 1060 565 C 980 565, 930 820, 870 820" stroke="#16a34a" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 02 (translate 870, 820) -->
                  <g class="branch-card-group mindmap-interactive-node" data-node-id="t2-root" transform="translate(870, 820)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-green" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🐧</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 02: Linux</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Kernel & Epoll</text>
                    <!-- Toggle collapse badge -->
                    <g class="tier-toggle-badge badge-green" transform="translate(-42, -34)">
                      <rect x="-12" y="-10" width="24" height="20" rx="6" fill="#16a34a" />
                      <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector -->
                    <path d="M 815 820 L 770 820" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="770" cy="820" r="4.5" class="fork-joint-circle circle-green" />

                    <!-- Sub-branch 2A: Socket & Queue (Y=720) -->
                    <path d="M 770 820 C 740 820, 720 720, 680 720" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="680" cy="720" r="4" class="sub-joint-circle circle-green" />
                    <text x="665" y="724" text-anchor="end" class="sub-cat-title mindmap-interactive-node" data-node-id="t2-sockets" cursor="pointer">Socket & Queue</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 525 720 L 495 720" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="495" cy="720" r="3.5" class="leaf-joint-circle circle-green" />
                    <path d="M 495 720 C 470 720, 460 690, 430 690" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="420" y="694" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t2-fd" cursor="pointer">File Descriptor Table [FD: 12] (O_NONBLOCK)</text>

                    <path d="M 495 720 C 470 720, 460 750, 430 750" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="420" y="754" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t2-buffers" cursor="pointer">Kernel TCP Buffers (Receive/Send Queue)</text>

                    <!-- Sub-branch 2B: Multiplexing & Memory (Y=920) -->
                    <path d="M 770 820 C 740 820, 720 920, 680 920" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="680" cy="920" r="4" class="sub-joint-circle circle-green" />
                    <text x="665" y="924" text-anchor="end" class="sub-cat-title mindmap-interactive-node" data-node-id="t2-multiplexing" cursor="pointer">Multiplexing & Memory</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 490 920 L 460 920" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="460" cy="920" r="3.5" class="leaf-joint-circle circle-green" />
                    <path d="M 460 920 C 435 920, 425 890, 395 890" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="385" y="894" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t2-epoll" cursor="pointer">Epoll / Kqueue (10K+ Sockets O(1) demux)</text>

                    <path d="M 460 920 C 435 920, 425 950, 395 950" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="385" y="954" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t2-paging" cursor="pointer">Virtual Memory & Page Tables (RSS & OOM Guard)</text>
                  </g>
                </g>

                <!-- =================== 5. TIER 01: PHYSICAL HARDWARE (TOP-LEFT) =================== -->
                <g class="mindmap-tier-branch branch-amber" data-tier-id="t1">
                  <!-- Main Stem from Hub to Card -->
                  <path d="M 1060 515 C 980 515, 930 260, 870 260" stroke="#d97706" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 01 (translate 870, 260) -->
                  <g class="branch-card-group mindmap-interactive-node" data-node-id="t1-root" transform="translate(870, 260)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-amber" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">⚡</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 01: Phần Cứng</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Hardware & 1-100ns</text>
                    <!-- Toggle collapse badge -->
                    <g class="tier-toggle-badge badge-amber" transform="translate(-42, -34)">
                      <rect x="-12" y="-10" width="24" height="20" rx="6" fill="#d97706" />
                      <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector -->
                    <path d="M 815 260 L 770 260" stroke="#d97706" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="770" cy="260" r="4.5" class="fork-joint-circle circle-amber" />

                    <!-- Sub-branch 1A: CPU Cores & Cache (Y=160) -->
                    <path d="M 770 260 C 740 260, 720 160, 680 160" stroke="#d97706" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="680" cy="160" r="4" class="sub-joint-circle circle-amber" />
                    <text x="665" y="164" text-anchor="end" class="sub-cat-title mindmap-interactive-node" data-node-id="t1-cpu" cursor="pointer">CPU Cores & Cache</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 515 160 L 485 160" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="485" cy="160" r="3.5" class="leaf-joint-circle circle-amber" />
                    <path d="M 485 160 C 460 160, 450 130, 420 130" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="410" y="134" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t1-l1l2l3" cursor="pointer">CPU Cores & L1/L2/L3 Cache (1-10ns clock)</text>

                    <path d="M 485 160 C 460 160, 450 190, 420 190" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="410" y="194" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t1-pipeline" cursor="pointer">Branch Predictor & Instructions Pipeline</text>

                    <!-- Sub-branch 1B: RAM Bus & Thiết Bị I/O (Y=360) -->
                    <path d="M 770 260 C 740 260, 720 360, 680 360" stroke="#d97706" stroke-width="3" stroke-linecap="round" fill="none" />
                    <circle cx="680" cy="360" r="4" class="sub-joint-circle circle-amber" />
                    <text x="665" y="364" text-anchor="end" class="sub-cat-title mindmap-interactive-node" data-node-id="t1-io-bus" cursor="pointer">RAM Bus & Thiết Bị I/O</text>

                    <!-- Fork to 2 Leaves -->
                    <path d="M 485 360 L 455 360" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <circle cx="455" cy="360" r="3.5" class="leaf-joint-circle circle-amber" />
                    <path d="M 455 360 C 430 360, 420 330, 390 330" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="380" y="334" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t1-ram" cursor="pointer">RAM Bus Vật Lý DDR4/DDR5 (~50-100ns)</text>

                    <path d="M 455 360 C 430 360, 420 390, 390 390" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                    <text x="380" y="394" text-anchor="end" class="leaf-svg-text mindmap-interactive-node" data-node-id="t1-nvme-nic" cursor="pointer">NVMe SSD PCIe 4.0 & Card Mạng NIC 10Gbps</text>
                  </g>
                </g>
              </svg>
            </div>

            <!-- Gợi ý tương tác nhanh nổi góc dưới -->
            <div class="mindmap-interaction-hint">
              <span>✋ Kéo chuột để di chuyển canvas • 🔍 Cuộn chuột phóng to / thu nhỏ • 💡 Bấm vào bất kỳ thành phần nào để mở chi tiết kiến thức</span>
            </div>
          </div>

          <!-- Bảng xem chi tiết kiến thức chuyên sâu (Deep Knowledge Inspector Drawer) -->
          <div class="mindmap-inspector-drawer" id="inspector_${uniqueId}">
            <div class="inspector-header">
              <div class="inspector-header-left">
                <span class="inspector-tier-tag" id="insp_tag_${uniqueId}">TIER 04</span>
                <h3 class="inspector-title" id="insp_title_${uniqueId}">Khám Phá Chi Tiết Kiến Trúc</h3>
              </div>
              <button type="button" class="inspector-close-btn" title="Đóng bảng chi tiết (Esc)">✕</button>
            </div>
            <div class="inspector-body">
              <!-- 1. Bản chất kiến trúc -->
              <div class="inspector-card-section">
                <div class="section-label">💡 NGUYÊN LÝ KIẾN TRÚC BẢN CHẤT</div>
                <p class="inspector-concept-text" id="insp_concept_${uniqueId}">Nhấp chuột vào bất kỳ thành phần nào trên sơ đồ tư duy để tra cứu thông số kỹ thuật, code mẫu thực chiến và cạm bẫy cần tránh.</p>
              </div>
              <!-- 2. Thông số kỹ thuật & Độ trễ -->
              <div class="inspector-card-section">
                <div class="section-label">⚡ THÔNG SỐ VẬN HÀNH & ĐỘ TRỄ (SPECS)</div>
                <div class="inspector-specs-grid" id="insp_specs_${uniqueId}">
                  <div class="spec-cell"><span class="spec-k">Hệ thống:</span><span class="spec-v">4 Tiers Fullstack Architecture</span></div>
                </div>
              </div>
              <!-- 3. Mã nguồn chuẩn Production -->
              <div class="inspector-card-section">
                <div class="section-label">💻 MÃ NGUỒN CHUẨN PRODUCTION</div>
                <div class="inspector-code-box">
                  <pre><code class="inspector-code-content" id="insp_code_${uniqueId}">// Chọn một Node để xem code mẫu chuẩn Enterprise</code></pre>
                </div>
              </div>
              <!-- 4. Cạm bẫy thực chiến & Phòng ngừa -->
              <div class="inspector-card-section section-gotchas">
                <div class="section-label">⚠️ CẠM BẪY THỰC CHIẾN & PHÒNG NGỪA</div>
                <div class="inspector-gotchas-box" id="insp_gotchas_${uniqueId}">Chọn một thành phần để xem kinh nghiệm xử lý lỗi thực tế từ môi trường Production.</div>
              </div>
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
