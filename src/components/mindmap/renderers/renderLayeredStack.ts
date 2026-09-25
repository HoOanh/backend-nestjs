import { escapeHtml } from '../../common/CodeViewer.tsx';
import type { ParsedLayer } from '../types.ts';
import { renderCleanBlueprint } from './renderCleanBlueprint.ts';

/**
 * Renderer: Kiến Trúc Phân Tầng Hệ Thống (Enterprise Layered Stack) & Sơ Đồ Tư Duy (Radial Mindmap)
 */
export function renderLayeredStack(text: string, title?: string): string {
  const displayTitle = title || 'BẢN ĐỒ TẦNG BẬC HỆ THỐNG (SYSTEM TAXONOMY MAP)';
  const uniqueId = 'tax_system_taxonomy_map';

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
            <button type="button" class="arch-tab-btn active" data-tab-target="stack" onclick="window.__switchArchTab && window.__switchArchTab(this, 'stack')">
              🏗️ Kiến Trúc Phân Tầng (Stack)
            </button>
            <button type="button" class="arch-tab-btn" data-tab-target="radial" onclick="window.__switchArchTab && window.__switchArchTab(this, 'radial')">
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
                  <!-- Main Stem from Hub to Card (Nối chuẩn vào cạnh trái của Card tại 1475, 260) -->
                  <path d="M 1330 520 C 1390 520, 1420 260, 1475 260" stroke="#8b5cf6" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 04 (translate 1530, 260, W=110, H=90) -->
                  <g class="branch-card-group tier-card-trigger" data-tier-id="t4" transform="translate(1530, 260)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-purple" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🏛️</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 04: NestJS</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Application & IoC</text>
                    <!-- Toggle badge cấp 1: Đặt tại cạnh phải Card (55, 0) -->
                    <g class="tier-toggle-badge badge-purple" transform="translate(55, 0)" title="Đóng/Mở nhánh NestJS">
                      <circle cx="0" cy="0" r="10" fill="#8b5cf6" stroke="#ffffff" stroke-width="2" />
                      <text x="0" y="3.5" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container (Cấp 2 & Cấp 3) -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector từ Card tới ngã ba -->
                    <path d="M 1585 260 L 1630 260" stroke="#8b5cf6" stroke-width="3.5" stroke-linecap="round" fill="none" />
                    <circle cx="1630" cy="260" r="4.5" class="fork-joint-circle circle-purple" />

                    <!-- Sub-branch 4A: Controllers & Routers (Y=140) -->
                    <g class="sub-branch-group" data-sub-id="t4-controllers">
                      <!-- Đường nhánh liên tục nối từ ngã ba qua dưới chữ tới nút toggle -->
                      <path d="M 1630 260 C 1660 260, 1660 140, 1690 140 L 1900 140" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="1700" y="132" text-anchor="start" class="sub-cat-title sub-title-trigger" cursor="pointer">Controllers & Routers</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(1900, 140)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 1900 140 C 1930 140, 1940 105, 1970 105 L 2280 105" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="1980" y="98" text-anchor="start" class="leaf-svg-text" data-node-id="t4-dto" cursor="pointer">DTO ValidationPipe (Class-validator, Whitelist & Transform)</text>
                        <path d="M 1900 140 C 1930 140, 1940 175, 1970 175 L 2280 175" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="1980" y="168" text-anchor="start" class="leaf-svg-text" data-node-id="t4-routes" cursor="pointer">Execution Pipeline: Guards → Interceptors → Pipes → Handler → Filters</text>
                      </g>
                    </g>

                    <!-- Sub-branch 4B: Services & Domain Logic (Y=260) -->
                    <g class="sub-branch-group" data-sub-id="t4-services">
                      <path d="M 1630 260 L 1920 260" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="1700" y="252" text-anchor="start" class="sub-cat-title sub-title-trigger" cursor="pointer">Services & Domain Logic</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(1920, 260)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 1920 260 C 1950 260, 1960 225, 1990 225 L 2300 225" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="2000" y="218" text-anchor="start" class="leaf-svg-text" data-node-id="t4-ioc" cursor="pointer">IoC Container: Singleton Lifecycle (Tránh Request-Scope gây vỡ GC Heap)</text>
                        <path d="M 1920 260 C 1950 260, 1960 295, 1990 295 L 2300 295" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="2000" y="288" text-anchor="start" class="leaf-svg-text" data-node-id="t4-services" cursor="pointer">Stateless Domain Services & Inversion of Control Dependency Injection</text>
                      </g>
                    </g>

                    <!-- Sub-branch 4C: Repositories & Caching (Y=380) -->
                    <g class="sub-branch-group" data-sub-id="t4-repos">
                      <path d="M 1630 260 C 1660 260, 1660 380, 1690 380 L 1910 380" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="1700" y="372" text-anchor="start" class="sub-cat-title sub-title-trigger" cursor="pointer">Repositories & Caching</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(1910, 380)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#8b5cf6" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 1910 380 C 1940 380, 1950 345, 1980 345 L 2290 345" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="1990" y="338" text-anchor="start" class="leaf-svg-text" data-node-id="t4-repos" cursor="pointer">Database Connection Pool: Max Clients vs Worker Threadpool Matching</text>
                        <path d="M 1910 380 C 1940 380, 1950 415, 1980 415 L 2290 415" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="1990" y="408" text-anchor="start" class="leaf-svg-text" data-node-id="t4-repos" cursor="pointer">Redis Multi-layer Cache: Cache-Aside Pattern & Dogpile Effect Prevention</text>
                      </g>
                    </g>
                  </g>
                </g>

                <!-- =================== 3. TIER 03: NODE.JS RUNTIME ENGINE (BOTTOM-RIGHT) =================== -->
                <g class="mindmap-tier-branch branch-sky" data-tier-id="t3">
                  <!-- Main Stem from Hub to Card (Nối chuẩn vào cạnh trái Card tại 1475, 820) -->
                  <path d="M 1330 560 C 1390 560, 1420 820, 1475 820" stroke="#0284c7" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 03 (translate 1530, 820, W=110, H=90) -->
                  <g class="branch-card-group tier-card-trigger" data-tier-id="t3" transform="translate(1530, 820)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-sky" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🔄</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 03: Runtime</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Node.js & Libuv</text>
                    <!-- Toggle badge cấp 1: Đặt tại cạnh phải Card (55, 0) -->
                    <g class="tier-toggle-badge badge-sky" transform="translate(55, 0)" title="Đóng/Mở nhánh Runtime">
                      <circle cx="0" cy="0" r="10" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
                      <text x="0" y="3.5" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container (Cấp 2 & Cấp 3) -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector -->
                    <path d="M 1585 820 L 1630 820" stroke="#0284c7" stroke-width="3.5" stroke-linecap="round" fill="none" />
                    <circle cx="1630" cy="820" r="4.5" class="fork-joint-circle circle-sky" />

                    <!-- Sub-branch 3A: Libuv Asynchronous Engine (Y=700) -->
                    <g class="sub-branch-group" data-sub-id="t3-libuv">
                      <path d="M 1630 820 C 1660 820, 1660 700, 1690 700 L 1930 700" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="1700" y="692" text-anchor="start" class="sub-cat-title sub-title-trigger" cursor="pointer">Libuv Asynchronous Engine</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(1930, 700)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 1930 700 C 1960 700, 1970 665, 2000 665 L 2320 665" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="2010" y="658" text-anchor="start" class="leaf-svg-text" data-node-id="t3-loop" cursor="pointer">1 Main Thread: 6 Pha Event Loop (Microtask Starvation: nextTick & Promise)</text>
                        <path d="M 1930 700 C 1960 700, 1970 735, 2000 735 L 2320 735" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="2010" y="728" text-anchor="start" class="leaf-svg-text" data-node-id="t3-threads" cursor="pointer">UV Threadpool (Default 4 Threads): fs, crypto pbkdf2, zlib, dns.lookup</text>
                      </g>
                    </g>

                    <!-- Sub-branch 3B: V8 Memory Architecture (Y=820) -->
                    <g class="sub-branch-group" data-sub-id="t3-v8">
                      <path d="M 1630 820 L 1920 820" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="1700" y="812" text-anchor="start" class="sub-cat-title sub-title-trigger" cursor="pointer">V8 Memory Architecture</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(1920, 820)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 1920 820 C 1950 820, 1960 785, 1990 785 L 2320 785" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="2000" y="778" text-anchor="start" class="leaf-svg-text" data-node-id="t3-stack" cursor="pointer">V8 Stack Space (LIFO Call Frames, Biến nguyên thủy, 0% GC Overhead)</text>
                        <path d="M 1920 820 C 1950 820, 1960 855, 1990 855 L 2320 855" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="2000" y="848" text-anchor="start" class="leaf-svg-text" data-node-id="t3-heap" cursor="pointer">V8 Heap: Young Gen (Scavenge Cheney ~1ms) & Old Gen (Mark-Sweep-Compact)</text>
                      </g>
                    </g>

                    <!-- Sub-branch 3C: C++ Non-Heap & Buffers (Y=940) -->
                    <g class="sub-branch-group" data-sub-id="t3-buffers">
                      <path d="M 1630 820 C 1660 820, 1660 940, 1690 940 L 1910 940" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="1700" y="932" text-anchor="start" class="sub-cat-title sub-title-trigger" cursor="pointer">C++ Non-Heap & Buffers</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(1910, 940)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 1910 940 C 1940 940, 1950 905, 1980 905 L 2300 905" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="1990" y="898" text-anchor="start" class="leaf-svg-text" data-node-id="t3-buffers" cursor="pointer">Node.js Buffers: C++ malloc() ngoài V8 Heap (Tránh max-old-space crash)</text>
                        <path d="M 1910 940 C 1940 940, 1950 975, 1980 975 L 2300 975" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="1990" y="968" text-anchor="start" class="leaf-svg-text" data-node-id="t3-libuv" cursor="pointer">Libuv C++ Bindings & POSIX Syscall Bridge (Direct OS I/O Abstraction)</text>
                      </g>
                    </g>
                  </g>
                </g>

                <!-- =================== 4. TIER 02: LINUX OS KERNEL (BOTTOM-LEFT) =================== -->
                <g class="mindmap-tier-branch branch-green" data-tier-id="t2">
                  <!-- Main Stem from Hub to Card (Nối chuẩn vào cạnh phải Card tại 925, 820) -->
                  <path d="M 1070 560 C 1010 560, 980 820, 925 820" stroke="#16a34a" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 02 (translate 870, 820, W=110, H=90) -->
                  <g class="branch-card-group tier-card-trigger" data-tier-id="t2" transform="translate(870, 820)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-green" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">🐧</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 02: Linux</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Kernel & Epoll</text>
                    <!-- Toggle badge cấp 1: Đặt tại cạnh trái Card (-55, 0) -->
                    <g class="tier-toggle-badge badge-green" transform="translate(-55, 0)" title="Đóng/Mở nhánh Linux Kernel">
                      <circle cx="0" cy="0" r="10" fill="#16a34a" stroke="#ffffff" stroke-width="2" />
                      <text x="0" y="3.5" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container (Cấp 2 & Cấp 3) -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector từ Card tới ngã ba bên trái -->
                    <path d="M 815 820 L 770 820" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" fill="none" />
                    <circle cx="770" cy="820" r="4.5" class="fork-joint-circle circle-green" />

                    <!-- Sub-branch 2A: Socket & Queue (Y=720) -->
                    <g class="sub-branch-group" data-sub-id="t2-sockets">
                      <!-- Đường nhánh liên tục chạy dưới chữ tới nút toggle bên trái -->
                      <path d="M 770 820 C 740 820, 740 720, 710 720 L 520 720" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="700" y="712" text-anchor="end" class="sub-cat-title sub-title-trigger" cursor="pointer">Socket & Queue</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(520, 720)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#16a34a" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 520 720 C 490 720, 470 685, 440 685 L 120 685" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="430" y="678" text-anchor="end" class="leaf-svg-text" data-node-id="t2-fd" cursor="pointer">File Descriptor Table [FD: 12]: O_NONBLOCK Flag & Inode Lookup</text>
                        <path d="M 520 720 C 490 720, 470 755, 440 755 L 120 755" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="430" y="748" text-anchor="end" class="leaf-svg-text" data-node-id="t2-buffers" cursor="pointer">Kernel TCP Buffers (Receive/Send Queue, Backlog Queue & Window Probing)</text>
                      </g>
                    </g>

                    <!-- Sub-branch 2B: Multiplexing & Memory (Y=920) -->
                    <g class="sub-branch-group" data-sub-id="t2-multiplexing">
                      <path d="M 770 820 C 740 820, 740 920, 710 920 L 480 920" stroke="#16a34a" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="700" y="912" text-anchor="end" class="sub-cat-title sub-title-trigger" cursor="pointer">Multiplexing & Memory</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(480, 920)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#16a34a" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves -->
                      <g class="sub-branch-leaves">
                        <path d="M 480 920 C 450 920, 430 885, 400 885 L 120 885" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="390" y="878" text-anchor="end" class="leaf-svg-text" data-node-id="t2-epoll" cursor="pointer">Epoll RB-Tree + Ready List: O(1) Demultiplexing cho 100K+ Concurrent Conns</text>
                        <path d="M 480 920 C 450 920, 430 955, 400 955 L 120 955" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="390" y="948" text-anchor="end" class="leaf-svg-text" data-node-id="t2-paging" cursor="pointer">Virtual Memory & Page Tables: RSS, Page Faults, MMU TLB & OOM Killer Guard</text>
                      </g>
                    </g>
                  </g>
                </g>

                <!-- =================== 5. TIER 01: PHYSICAL HARDWARE (TOP-LEFT) =================== -->
                <g class="mindmap-tier-branch branch-amber" data-tier-id="t1">
                  <!-- Main Stem from Hub to Card (Nối chuẩn vào cạnh phải Card tại 925, 260) -->
                  <path d="M 1070 520 C 1010 520, 980 260, 925 260" stroke="#d97706" stroke-width="5" stroke-linecap="round" fill="none" class="branch-stem" />

                  <!-- Main Category Card: Tier 01 (translate 870, 260, W=110, H=90) -->
                  <g class="branch-card-group tier-card-trigger" data-tier-id="t1" transform="translate(870, 260)" cursor="pointer">
                    <rect x="-55" y="-45" width="110" height="90" rx="16" class="node-card-bg card-border-amber" filter="url(#card-shadow)" />
                    <text x="0" y="-10" text-anchor="middle" font-size="28">⚡</text>
                    <text x="0" y="16" text-anchor="middle" class="card-svg-title">Tier 01: Phần Cứng</text>
                    <text x="0" y="32" text-anchor="middle" class="card-svg-sub">Hardware & 1-100ns</text>
                    <!-- Toggle badge cấp 1: Đặt tại cạnh trái Card (-55, 0) -->
                    <g class="tier-toggle-badge badge-amber" transform="translate(-55, 0)" title="Đóng/Mở nhánh Phần Cứng">
                      <circle cx="0" cy="0" r="10" fill="#d97706" stroke="#ffffff" stroke-width="2" />
                      <text x="0" y="3.5" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
                    </g>
                  </g>

                  <!-- Sub-branches container (Cấp 2 & Cấp 3) -->
                  <g class="tier-sub-branches">
                    <!-- Stem connector từ Card tới ngã ba bên trái -->
                    <path d="M 815 260 L 770 260" stroke="#d97706" stroke-width="3.5" stroke-linecap="round" fill="none" />
                    <circle cx="770" cy="260" r="4.5" class="fork-joint-circle circle-amber" />

                    <!-- Sub-branch 1A: CPU Cores & Cache (Y=160) -->
                    <g class="sub-branch-group" data-sub-id="t1-cpu">
                      <!-- Đường nhánh liên tục chạy cong từ ngã ba và chạy thẳng dưới chữ CPU Cores & Cache tới nút toggle -->
                      <path d="M 770 260 C 740 260, 740 160, 710 160 L 510 160" stroke="#d97706" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="700" y="152" text-anchor="end" class="sub-cat-title sub-title-trigger" cursor="pointer">CPU Cores & Cache</text>
                      <!-- Sub toggle badge cấp 2 nằm ở đầu đường nhánh (510, 160) -->
                      <g class="sub-toggle-badge" transform="translate(510, 160)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#d97706" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves tỏa tiếp sang trái -->
                      <g class="sub-branch-leaves">
                        <path d="M 510 160 C 480 160, 460 125, 430 125 L 120 125" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="420" y="118" text-anchor="end" class="leaf-svg-text" data-node-id="t1-l1l2l3" cursor="pointer">L1/L2/L3 Cache Hierarchy (1-10ns, 64-Byte Cache Line, Tránh False Sharing)</text>
                        <path d="M 510 160 C 480 160, 460 195, 430 195 L 120 195" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="420" y="188" text-anchor="end" class="leaf-svg-text" data-node-id="t1-pipeline" cursor="pointer">Branch Predictor & CPU Pipeline Stall (Mất 15-20 chu kỳ khi đoán sai rẽ nhánh)</text>
                      </g>
                    </g>

                    <!-- Sub-branch 1B: RAM Bus & Thiết Bị I/O (Y=360) -->
                    <g class="sub-branch-group" data-sub-id="t1-io-bus">
                      <path d="M 770 260 C 740 260, 740 360, 710 360 L 490 360" stroke="#d97706" stroke-width="3" stroke-linecap="round" fill="none" />
                      <text x="700" y="352" text-anchor="end" class="sub-cat-title sub-title-trigger" cursor="pointer">RAM Bus & Thiết Bị I/O</text>
                      <!-- Sub toggle badge cấp 2 -->
                      <g class="sub-toggle-badge" transform="translate(490, 360)" cursor="pointer" title="Đóng/Mở nhánh con">
                        <circle cx="0" cy="0" r="8" fill="#d97706" stroke="#ffffff" stroke-width="1.5" />
                        <text x="0" y="3" text-anchor="middle" font-size="10" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
                      </g>
                      <!-- Cấp 3: Leaves tỏa tiếp sang trái -->
                      <g class="sub-branch-leaves">
                        <path d="M 490 360 C 460 360, 440 325, 410 325 L 120 325" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="400" y="318" text-anchor="end" class="leaf-svg-text" data-node-id="t1-ram" cursor="pointer">Physical RAM Bus DDR4/DDR5 (~60-100ns, NUMA Node Memory Access Penalty)</text>
                        <path d="M 490 360 C 460 360, 440 395, 410 395 L 120 395" stroke="#d97706" stroke-width="2.5" stroke-linecap="round" fill="none" />
                        <text x="400" y="388" text-anchor="end" class="leaf-svg-text" data-node-id="t1-nvme-nic" cursor="pointer">PCIe 4.0 / NVMe SSD (~10-50µs) & 10GbE Network NIC Ring Buffer (Ring Drops)</text>
                      </g>
                    </g>
                  </g>
                </g>
              </svg>
            </div>

            <!-- Gợi ý tương tác nhanh nổi góc dưới -->
            <div class="mindmap-interaction-hint">
              <span>✋ Kéo chuột để di chuyển • 🔍 Cuộn chuột phóng to/thu nhỏ • 💡 Bấm vào nhánh hoặc nút [＋]/[−] để mở/đóng cây con từng cấp</span>
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
