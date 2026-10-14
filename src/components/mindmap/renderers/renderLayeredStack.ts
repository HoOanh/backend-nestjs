import { escapeHtml } from '../../common/CodeViewer.tsx';
import type { ParsedLayer } from '../types.ts';
import { renderCleanBlueprint } from './renderCleanBlueprint.ts';

function stripEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeBoardId(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `arch_board_${slug || 'system_taxonomy'}`;
}

interface LeafSpec {
  nodeId: string;
  y: number;
  title: string;
  subtitle: string;
}

interface SubBranchSpec {
  subId: string;
  nodeId: string;
  y: number;
  title: string;
  leaves: LeafSpec[];
}

function renderRightWingBranch(params: {
  tierId: string;
  nodeId: string;
  colorClass: 'purple' | 'sky';
  strokeColor: string;
  hubExitY: number;
  cardY: number;
  tierBadge: string;
  tierTitle: string;
  tierSub: string;
  subBranches: SubBranchSpec[];
}): string {
  const {
    tierId,
    nodeId,
    colorClass,
    strokeColor,
    hubExitY,
    cardY,
    tierBadge,
    tierTitle,
    tierSub,
    subBranches,
  } = params;

  const subBranchesSvg = subBranches
    .map((sb) => {
      const leavesSvg = sb.leaves
        .map((leaf) => {
          const boxX = 2065;
          const boxY = leaf.y - 29;
          return `
            <path d="M 2015 ${sb.y} C 2038 ${sb.y}, 2042 ${leaf.y}, ${boxX} ${leaf.y}" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" fill="none" />
            <g class="leaf-node-card mindmap-interactive-node" data-node-id="${leaf.nodeId}" transform="translate(${boxX}, ${boxY})" cursor="pointer">
              <rect x="0" y="0" width="420" height="58" rx="10" class="leaf-card-bg card-border-${colorClass}" />
              <rect x="0" y="10" width="4" height="38" rx="2" fill="${strokeColor}" />
              <text x="16" y="23" text-anchor="start" class="leaf-svg-title">${escapeHtml(leaf.title)}</text>
              <text x="16" y="43" text-anchor="start" class="leaf-svg-sub">${escapeHtml(leaf.subtitle)}</text>
            </g>
          `;
        })
        .join('');

      const subBoxX = 1795;
      const subBoxY = sb.y - 21;
      const pathD =
        sb.y === cardY
          ? `M 1755 ${cardY} L ${subBoxX} ${sb.y}`
          : `M 1755 ${cardY} C 1775 ${cardY}, 1775 ${sb.y}, ${subBoxX} ${sb.y}`;

      return `
        <g class="sub-branch-group" data-sub-id="${sb.subId}">
          <path d="${pathD}" stroke="${strokeColor}" stroke-width="2.8" stroke-linecap="round" fill="none" />
          <g class="sub-node-card sub-title-trigger mindmap-interactive-node" data-node-id="${sb.nodeId}" transform="translate(${subBoxX}, ${subBoxY})" cursor="pointer">
            <rect x="0" y="0" width="220" height="42" rx="10" class="sub-card-bg card-border-${colorClass}" />
            <text x="104" y="25" text-anchor="middle" class="sub-cat-title">${escapeHtml(sb.title)}</text>
          </g>
          <g class="sub-toggle-badge" transform="translate(2015, ${sb.y})" cursor="pointer" title="Đóng/Mở nhánh con">
            <circle cx="0" cy="0" r="10" fill="${strokeColor}" stroke="#ffffff" stroke-width="2" />
            <text x="0" y="3.5" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
          </g>
          <g class="sub-branch-leaves">
            ${leavesSvg}
          </g>
        </g>
      `;
    })
    .join('');

  return `
    <g class="mindmap-tier-branch branch-${colorClass}" data-tier-id="${tierId}">
      <path d="M 1430 ${hubExitY} C 1460 ${hubExitY}, 1460 ${cardY}, 1490 ${cardY}" stroke="${strokeColor}" stroke-width="4.5" stroke-linecap="round" fill="none" class="branch-stem" />

      <g class="branch-card-group" transform="translate(1600, ${cardY})">
        <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="${tierId}" data-node-id="${nodeId}" cursor="pointer">
          <rect x="-110" y="-42" width="220" height="84" rx="14" class="node-card-bg card-border-${colorClass}" filter="url(#card-shadow)" />
          <rect x="-46" y="-31" width="92" height="18" rx="5" fill="${strokeColor}" fill-opacity="0.14" />
          <text x="0" y="-19" text-anchor="middle" font-size="10" font-weight="800" fill="${strokeColor}" letter-spacing="0.6">${escapeHtml(tierBadge)}</text>
          <text x="0" y="6" text-anchor="middle" class="card-svg-title">${escapeHtml(tierTitle)}</text>
          <text x="0" y="25" text-anchor="middle" class="card-svg-sub">${escapeHtml(tierSub)}</text>
        </g>
        <g class="tier-toggle-badge badge-${colorClass}" transform="translate(110, 0)" cursor="pointer" title="Đóng/Mở nhánh ${escapeHtml(tierTitle)}">
          <circle cx="0" cy="0" r="11" fill="${strokeColor}" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
        </g>
      </g>

      <g class="tier-sub-branches">
        <path d="M 1710 ${cardY} L 1755 ${cardY}" stroke="${strokeColor}" stroke-width="3.2" stroke-linecap="round" fill="none" />
        <circle cx="1755" cy="${cardY}" r="4.5" class="fork-joint-circle circle-${colorClass}" stroke-width="2.5" />
        ${subBranchesSvg}
      </g>
    </g>
  `;
}

function renderLeftWingBranch(params: {
  tierId: string;
  nodeId: string;
  colorClass: 'amber' | 'green';
  strokeColor: string;
  hubExitY: number;
  cardY: number;
  tierBadge: string;
  tierTitle: string;
  tierSub: string;
  subBranches: SubBranchSpec[];
}): string {
  const {
    tierId,
    nodeId,
    colorClass,
    strokeColor,
    hubExitY,
    cardY,
    tierBadge,
    tierTitle,
    tierSub,
    subBranches,
  } = params;

  const subBranchesSvg = subBranches
    .map((sb) => {
      const leavesSvg = sb.leaves
        .map((leaf) => {
          const boxX = 115;
          const boxRight = 535;
          const boxY = leaf.y - 29;
          return `
            <path d="M 585 ${sb.y} C 562 ${sb.y}, 558 ${leaf.y}, ${boxRight} ${leaf.y}" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" fill="none" />
            <g class="leaf-node-card mindmap-interactive-node" data-node-id="${leaf.nodeId}" transform="translate(${boxX}, ${boxY})" cursor="pointer">
              <rect x="0" y="0" width="420" height="58" rx="10" class="leaf-card-bg card-border-${colorClass}" />
              <rect x="416" y="10" width="4" height="38" rx="2" fill="${strokeColor}" />
              <text x="16" y="23" text-anchor="start" class="leaf-svg-title">${escapeHtml(leaf.title)}</text>
              <text x="16" y="43" text-anchor="start" class="leaf-svg-sub">${escapeHtml(leaf.subtitle)}</text>
            </g>
          `;
        })
        .join('');

      const subBoxX = 585;
      const subBoxRight = 805;
      const subBoxY = sb.y - 21;
      const pathD =
        sb.y === cardY
          ? `M 845 ${cardY} L ${subBoxRight} ${sb.y}`
          : `M 845 ${cardY} C 825 ${cardY}, 825 ${sb.y}, ${subBoxRight} ${sb.y}`;

      return `
        <g class="sub-branch-group" data-sub-id="${sb.subId}">
          <path d="${pathD}" stroke="${strokeColor}" stroke-width="2.8" stroke-linecap="round" fill="none" />
          <g class="sub-node-card sub-title-trigger mindmap-interactive-node" data-node-id="${sb.nodeId}" transform="translate(${subBoxX}, ${subBoxY})" cursor="pointer">
            <rect x="0" y="0" width="220" height="42" rx="10" class="sub-card-bg card-border-${colorClass}" />
            <text x="116" y="25" text-anchor="middle" class="sub-cat-title">${escapeHtml(sb.title)}</text>
          </g>
          <g class="sub-toggle-badge" transform="translate(585, ${sb.y})" cursor="pointer" title="Đóng/Mở nhánh con">
            <circle cx="0" cy="0" r="10" fill="${strokeColor}" stroke="#ffffff" stroke-width="2" />
            <text x="0" y="3.5" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
          </g>
          <g class="sub-branch-leaves">
            ${leavesSvg}
          </g>
        </g>
      `;
    })
    .join('');

  return `
    <g class="mindmap-tier-branch branch-${colorClass}" data-tier-id="${tierId}">
      <path d="M 1170 ${hubExitY} C 1140 ${hubExitY}, 1140 ${cardY}, 1110 ${cardY}" stroke="${strokeColor}" stroke-width="4.5" stroke-linecap="round" fill="none" class="branch-stem" />

      <g class="branch-card-group" transform="translate(1000, ${cardY})">
        <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="${tierId}" data-node-id="${nodeId}" cursor="pointer">
          <rect x="-110" y="-42" width="220" height="84" rx="14" class="node-card-bg card-border-${colorClass}" filter="url(#card-shadow)" />
          <rect x="-46" y="-31" width="92" height="18" rx="5" fill="${strokeColor}" fill-opacity="0.14" />
          <text x="0" y="-19" text-anchor="middle" font-size="10" font-weight="800" fill="${strokeColor}" letter-spacing="0.6">${escapeHtml(tierBadge)}</text>
          <text x="0" y="6" text-anchor="middle" class="card-svg-title">${escapeHtml(tierTitle)}</text>
          <text x="0" y="25" text-anchor="middle" class="card-svg-sub">${escapeHtml(tierSub)}</text>
        </g>
        <g class="tier-toggle-badge badge-${colorClass}" transform="translate(-110, 0)" cursor="pointer" title="Đóng/Mở nhánh ${escapeHtml(tierTitle)}">
          <circle cx="0" cy="0" r="11" fill="${strokeColor}" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
        </g>
      </g>

      <g class="tier-sub-branches">
        <path d="M 890 ${cardY} L 845 ${cardY}" stroke="${strokeColor}" stroke-width="3.2" stroke-linecap="round" fill="none" />
        <circle cx="845" cy="${cardY}" r="4.5" class="fork-joint-circle circle-${colorClass}" stroke-width="2.5" />
        ${subBranchesSvg}
      </g>
    </g>
  `;
}

/**
 * Renderer: Kiến Trúc Phân Tầng Hệ Thống (Enterprise Layered Stack) & Sơ Đồ Tư Duy (Radial Mindmap)
 */
export function renderLayeredStack(text: string, title?: string): string {
  const cleanedTitle = stripEmojis(title || '') || 'BẢN ĐỒ TẦNG BẬC HỆ THỐNG (SYSTEM TAXONOMY MAP)';
  const uniqueId = makeBoardId(cleanedTitle);

  // Trường hợp đặc thù Sơ đồ 1 của Chapter 1 (Hardware / Kernel / Libuv / V8 Engine / NestJS)
  if (text.includes('HARDWARE LAYER') || text.includes('TẦNG VẬT LÝ')) {
    const tier4Svg = renderRightWingBranch({
      tierId: 't4',
      nodeId: 't4-root',
      colorClass: 'purple',
      strokeColor: '#8b5cf6',
      hubExitY: 580,
      cardY: 300,
      tierBadge: 'TIER 04',
      tierTitle: 'NestJS Framework',
      tierSub: 'Application & IoC',
      subBranches: [
        {
          subId: 't4-controllers',
          nodeId: 't4-controllers',
          y: 150,
          title: 'Controllers & Routers',
          leaves: [
            {
              nodeId: 't4-dto',
              y: 115,
              title: 'DTO & ValidationPipe',
              subtitle: 'Class-validator, Whitelist & Transform payload',
            },
            {
              nodeId: 't4-routes',
              y: 185,
              title: 'Execution Pipeline & AOP',
              subtitle: 'Guards → Interceptors → Pipes → Handler → Filters',
            },
          ],
        },
        {
          subId: 't4-services',
          nodeId: 't4-services',
          y: 300,
          title: 'Services & Domain Logic',
          leaves: [
            {
              nodeId: 't4-ioc',
              y: 265,
              title: 'IoC Container & Singleton Scope',
              subtitle: 'Khởi tạo DAG tại Bootstrap, tránh Request-Scope GC',
            },
            {
              nodeId: 't4-services',
              y: 335,
              title: 'Stateless Domain Services',
              subtitle: 'Xử lý nghiệp vụ thuần túy, chống Race Condition',
            },
          ],
        },
        {
          subId: 't4-repos',
          nodeId: 't4-repos',
          y: 450,
          title: 'Repositories & Caching',
          leaves: [
            {
              nodeId: 't4-repos',
              y: 415,
              title: 'Database Connection Pool',
              subtitle: 'Giới hạn kết nối Prisma / TypeORM đồng bộ Worker Pool',
            },
            {
              nodeId: 't4-repos',
              y: 485,
              title: 'Redis Distributed Cache',
              subtitle: 'Cache-Aside Pattern, TTL & chống Cache Stampede',
            },
          ],
        },
      ],
    });

    const tier3Svg = renderRightWingBranch({
      tierId: 't3',
      nodeId: 't3-root',
      colorClass: 'sky',
      strokeColor: '#0284c7',
      hubExitY: 620,
      cardY: 900,
      tierBadge: 'TIER 03',
      tierTitle: 'Node.js Runtime',
      tierSub: 'Libuv & V8 Engine',
      subBranches: [
        {
          subId: 't3-libuv',
          nodeId: 't3-libuv',
          y: 750,
          title: 'Libuv Asynchronous Engine',
          leaves: [
            {
              nodeId: 't3-loop',
              y: 715,
              title: 'Event Loop (1 Main Thread - 6 Pha)',
              subtitle: 'Timers, Pending, Poll, Check, Close & Microtask Queue',
            },
            {
              nodeId: 't3-threads',
              y: 785,
              title: 'UV Worker Threadpool (Default 4 Threads)',
              subtitle: 'Xử lý tác vụ blocking: fs, crypto, zlib, dns.lookup',
            },
          ],
        },
        {
          subId: 't3-v8',
          nodeId: 't3-v8',
          y: 900,
          title: 'V8 Memory Architecture',
          leaves: [
            {
              nodeId: 't3-stack',
              y: 865,
              title: 'V8 Stack Space (LIFO Call Frames)',
              subtitle: 'Lưu biến nguyên thủy & con trỏ, 0% GC Overhead',
            },
            {
              nodeId: 't3-heap',
              y: 935,
              title: 'V8 Heap Space (Young & Old Gen)',
              subtitle: 'Scavenge Cheney (~1ms) & Mark-Sweep-Compact GC',
            },
          ],
        },
        {
          subId: 't3-buffers',
          nodeId: 't3-buffers',
          y: 1050,
          title: 'C++ Non-Heap & Buffers',
          leaves: [
            {
              nodeId: 't3-buffers',
              y: 1015,
              title: 'Node.js Buffers (C++ External Memory)',
              subtitle: 'Cấp phát libc malloc() ngoài giới hạn V8 Heap',
            },
            {
              nodeId: 't3-libuv',
              y: 1085,
              title: 'Libuv C++ Bindings & Syscall Bridge',
              subtitle: 'Cầu nối trực tiếp từ V8 JS xuống POSIX OS I/O',
            },
          ],
        },
      ],
    });

    const tier1Svg = renderLeftWingBranch({
      tierId: 't1',
      nodeId: 't1-root',
      colorClass: 'amber',
      strokeColor: '#d97706',
      hubExitY: 580,
      cardY: 300,
      tierBadge: 'TIER 01',
      tierTitle: 'Physical Hardware',
      tierSub: 'CPU, RAM & 1-100ns',
      subBranches: [
        {
          subId: 't1-cpu',
          nodeId: 't1-cpu',
          y: 210,
          title: 'CPU Cores & Cache',
          leaves: [
            {
              nodeId: 't1-l1l2l3',
              y: 175,
              title: 'L1 / L2 / L3 Cache Hierarchy (1 - 10ns)',
              subtitle: '64-Byte Cache Line, tối ưu Spatial Locality & tránh False Sharing',
            },
            {
              nodeId: 't1-pipeline',
              y: 245,
              title: 'Branch Predictor & CPU Pipeline',
              subtitle: 'Mã Monomorphic tránh phạt 15-20 chu kỳ khi đoán sai rẽ nhánh',
            },
          ],
        },
        {
          subId: 't1-io-bus',
          nodeId: 't1-io-bus',
          y: 390,
          title: 'RAM Bus & Thiết Bị I/O',
          leaves: [
            {
              nodeId: 't1-ram',
              y: 355,
              title: 'Physical RAM Bus DDR4 / DDR5 (~60 - 100ns)',
              subtitle: 'Nơi lưu trữ Resident Set Size (RSS) & phạt truy xuất NUMA',
            },
            {
              nodeId: 't1-nvme-nic',
              y: 425,
              title: 'PCIe 4.0 NVMe SSD & 10GbE NIC (~10 - 50µs)',
              subtitle: 'DMA Controller, Ring Buffer & phân tải ngắt phần cứng IRQ',
            },
          ],
        },
      ],
    });

    const tier2Svg = renderLeftWingBranch({
      tierId: 't2',
      nodeId: 't2-root',
      colorClass: 'green',
      strokeColor: '#16a34a',
      hubExitY: 620,
      cardY: 900,
      tierBadge: 'TIER 02',
      tierTitle: 'Linux OS Kernel',
      tierSub: 'Epoll & Sockets',
      subBranches: [
        {
          subId: 't2-sockets',
          nodeId: 't2-sockets',
          y: 810,
          title: 'Socket & Queue',
          leaves: [
            {
              nodeId: 't2-fd',
              y: 775,
              title: 'File Descriptor Table [FD: 12]',
              subtitle: 'Cờ phi chặn O_NONBLOCK, tra cứu Inode O(1) & giới hạn ulimit',
            },
            {
              nodeId: 't2-buffers',
              y: 845,
              title: 'Kernel TCP Buffers (Receive & Send Queue)',
              subtitle: 'Hàng đợi RX/TX trong Kernel Space, Backlog & TCP Window',
            },
          ],
        },
        {
          subId: 't2-multiplexing',
          nodeId: 't2-multiplexing',
          y: 990,
          title: 'Multiplexing & Memory',
          leaves: [
            {
              nodeId: 't2-epoll',
              y: 955,
              title: 'Epoll RB-Tree + Ready List (O(1) Demux)',
              subtitle: 'Giám sát 100,000+ kết nối đồng thời, chỉ đánh thức khi có I/O',
            },
            {
              nodeId: 't2-paging',
              y: 1025,
              title: 'Virtual Memory & Page Tables',
              subtitle: 'Ánh xạ MMU TLB, Page Faults, quản lý RSS & Linux OOM Killer',
            },
          ],
        },
      ],
    });

    return `
      <div class="system-architecture-board" id="${uniqueId}" data-board-key="${uniqueId}">
        <!-- Header với Tab Switcher -->
        <div class="arch-board-header">
          <div class="arch-title-wrap">
            <span class="arch-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            </span>
            <div>
              <span class="arch-main-title">${escapeHtml(cleanedTitle)}</span>
              <span class="arch-subtitle">Kiến trúc đa tầng từ Phần cứng vật lý đến NestJS Application Framework</span>
            </div>
          </div>
          <div class="arch-view-switcher">
            <button type="button" class="arch-tab-btn active" data-tab-target="stack">
              Kiến Trúc Phân Tầng (Stack)
            </button>
            <button type="button" class="arch-tab-btn" data-tab-target="radial">
              Sơ Đồ Tư Duy (Mindmap)
            </button>
          </div>
        </div>

        <!-- VIEW 1: KIẾN TRÚC PHÂN TẦNG ĐA TẦNG CHUẨN XÁC (DEFAULT) -->
        <div class="arch-stack-container" style="display: flex;">
          <!-- TẦNG 4: NESTJS APPLICATION LAYER -->
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
                  <span class="comp-icon">01</span>
                  <strong>Controllers & Routers</strong>
                </div>
                <p>Tiếp nhận HTTP request, ánh xạ URL, kiểm tra payload qua DTO và ValidationPipe.</p>
              </div>
              <div class="component-block block-app">
                <div class="comp-head">
                  <span class="comp-icon">02</span>
                  <strong>Services & Domain Logic</strong>
                </div>
                <p>Singleton Providers xử lý nghiệp vụ thuần túy, không lưu trạng thái request cục bộ.</p>
              </div>
              <div class="component-block block-app">
                <div class="comp-head">
                  <span class="comp-icon">03</span>
                  <strong>Repositories & Cache</strong>
                </div>
                <p>TypeORM / Prisma giao tiếp cơ sở dữ liệu PostgreSQL, Redis Client lưu cache phân tán.</p>
              </div>
            </div>
          </div>

          <div class="arch-connector-bridge bridge-app-runtime">
            <div class="connector-line"></div>
            <div class="connector-pill pill-app-runtime">
              <span class="connector-direction">▲</span>
              <span>NestJS Inversion of Control (IoC) & V8 Main Thread Callback Dispatcher</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>

          <!-- TẦNG 3: NODE.JS RUNTIME ENGINE -->
          <div class="arch-tier-card tier-runtime">
            <div class="tier-card-header header-runtime">
              <div class="tier-badge-wrap">
                <span class="tier-number-badge badge-runtime">TIER 03</span>
                <span class="tier-scope-tag">CORE ENGINE RUNTIME</span>
              </div>
              <div class="tier-title">TẦNG RUNTIME CẤP THẤP (NODE.JS / LIBUV & V8 JIT ENGINE)</div>
            </div>
            <div class="tier-runtime-split">
              <div class="runtime-column col-libuv">
                <div class="column-header">
                  <strong>Libuv Core (Asynchronous I/O Engine)</strong>
                </div>
                <div class="comp-sub-list">
                  <div class="sub-item">
                    <span class="item-bullet">•</span>
                    <div>
                      <strong>Libuv Event Loop (1 Main Thread):</strong>
                      <span>Tuần hoàn 6 pha (Timers, Pending, Poll, Check, Close) điều phối sự kiện I/O.</span>
                    </div>
                  </div>
                  <div class="sub-item">
                    <span class="item-bullet">•</span>
                    <div>
                      <strong>Libuv Worker Threadpool (4 Threads):</strong>
                      <span>Xử lý bất đồng bộ các tác vụ blocking: crypto băm mật khẩu, fs đọc ghi file, dns.lookup.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="runtime-column col-v8">
                <div class="column-header">
                  <strong>V8 Engine & Bộ Nhớ RSS (Google V8 Internals)</strong>
                </div>
                <div class="comp-sub-list">
                  <div class="sub-item">
                    <span class="item-bullet">•</span>
                    <div>
                      <strong>V8 Stack Space (LIFO):</strong>
                      <span>Lưu Call Frames và biến nguyên thủy, thu hồi tức thì khi hàm return (0% GC overhead).</span>
                    </div>
                  </div>
                  <div class="sub-item">
                    <span class="item-bullet">•</span>
                    <div>
                      <strong>V8 Heap (Young & Old Gen):</strong>
                      <span>Young Gen (Scavenge ~1ms) và Old Gen (Mark-Sweep-Compact giải phóng rác và chống phân mảnh).</span>
                    </div>
                  </div>
                  <div class="sub-item">
                    <span class="item-bullet">•</span>
                    <div>
                      <strong>C++ Non-Heap (External Memory):</strong>
                      <span>Node.js Buffers cấp phát qua malloc(), nằm ngoài giới hạn V8 GC.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="arch-connector-bridge bridge-runtime-kernel">
            <div class="connector-line"></div>
            <div class="connector-pill pill-runtime-kernel">
              <span class="connector-direction">▲</span>
              <span>Libuv C++ Bindings & POSIX Syscall Bridge (Event Demultiplexing)</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>

          <!-- TẦNG 2: LINUX OS KERNEL -->
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
                  <span class="comp-icon">01</span>
                  <strong>File Descriptor Table</strong>
                </div>
                <p>Quản lý Socket Port 3000 <code>[FD: 12]</code> với cờ phi chặn <code>O_NONBLOCK</code>.</p>
              </div>
              <div class="component-block block-kernel">
                <div class="comp-head">
                  <span class="comp-icon">02</span>
                  <strong>Kernel TCP Buffers</strong>
                </div>
                <p>Hàng đợi Receive Queue (RX) và Send Queue (TX) trong bộ nhớ kernel.</p>
              </div>
              <div class="component-block block-kernel">
                <div class="comp-head">
                  <span class="comp-icon">03</span>
                  <strong>Epoll / Kqueue Multiplexing</strong>
                </div>
                <p>Giám sát 10,000+ socket đồng thời với độ phức tạp <code>O(1)</code> qua Ready List.</p>
              </div>
              <div class="component-block block-kernel">
                <div class="comp-head">
                  <span class="comp-icon">04</span>
                  <strong>Virtual Memory & Page Tables</strong>
                </div>
                <p>Quản lý Resident Set Size (RSS), nạp trang bộ nhớ (Page Fault) và OOM Killer.</p>
              </div>
            </div>
          </div>

          <div class="arch-connector-bridge bridge-kernel-hardware">
            <div class="connector-line"></div>
            <div class="connector-pill pill-kernel-hardware">
              <span class="connector-direction">▲</span>
              <span>Hardware Interrupts (IRQ), DMA Controllers & Memory Bus Protocols</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>

          <!-- TẦNG 1: PHYSICAL HARDWARE LAYER -->
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
                  <span class="comp-icon">01</span>
                  <strong>CPU Cores & L1/L2/L3 Cache</strong>
                </div>
                <p>Xung nhịp GHz, truy xuất Cache tốc độ cao với độ trễ <strong>1 - 10 nanoseconds</strong>.</p>
              </div>
              <div class="component-block block-hardware">
                <div class="comp-head">
                  <span class="comp-icon">02</span>
                  <strong>RAM Bus Vật Lý (DDR4 / DDR5)</strong>
                </div>
                <p>Băng thông bộ nhớ chính, độ trễ vật lý <strong>~50 - 100 nanoseconds</strong>.</p>
              </div>
              <div class="component-block block-hardware">
                <div class="comp-head">
                  <span class="comp-icon">03</span>
                  <strong>NVMe SSD & Card Mạng (NIC)</strong>
                </div>
                <p>Lưu trữ NVMe và Network Interface Card 10Gbps, độ trễ <strong>10 - 100 microseconds</strong>.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- VIEW 2: SƠ ĐỒ TƯ DUY 4 TẦNG ĐỒNG BỘ TOÀN DIỆN -->
        <div class="arch-radial-container" id="radial_${uniqueId}" data-board-id="${uniqueId}" style="display: none;">
          <div class="mindmap-top-bar">
            <div class="mindmap-legend-group">
              <button type="button" class="mindmap-chip chip-all active" data-filter="all">Tất cả (4 Tầng)</button>
              <button type="button" class="mindmap-chip chip-purple" data-filter="purple"><span class="chip-dot"></span> Tier 04: NestJS</button>
              <button type="button" class="mindmap-chip chip-sky" data-filter="sky"><span class="chip-dot"></span> Tier 03: Node.js & Libuv</button>
              <button type="button" class="mindmap-chip chip-green" data-filter="green"><span class="chip-dot"></span> Tier 02: Linux Kernel</button>
              <button type="button" class="mindmap-chip chip-amber" data-filter="amber"><span class="chip-dot"></span> Tier 01: Phần Cứng</button>
            </div>

            <div class="mindmap-tree-ctrl-group">
              <button type="button" class="mindmap-ctrl-btn btn-expand-all" title="Mở rộng toàn bộ các nhánh con của 4 Tầng">+ Mở tất cả</button>
              <button type="button" class="mindmap-ctrl-btn btn-collapse-all" title="Thu gọn tất cả các nhánh con, chỉ hiển thị 4 Tầng chính">− Thu gọn</button>
            </div>

            <div class="mindmap-ctrl-group">
              <button type="button" class="mindmap-ctrl-btn btn-zoom-out" title="Thu nhỏ (Cuộn chuột xuống)">−</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-level" title="Bấm để đặt lại tỉ lệ chuẩn 100%">100%</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-in" title="Phóng to (Cuộn chuột lên)">+</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-fit" title="Thu phóng vừa vặn toàn màn hình">Vừa khung</button>
              <button type="button" class="mindmap-ctrl-btn btn-zoom-reset" title="Đặt lại vị trí trung tâm">Đặt lại</button>
              <button type="button" class="mindmap-ctrl-btn btn-fullscreen" title="Phóng to toàn màn hình (Esc để thoát)">Toàn màn hình</button>
            </div>
          </div>

          <div class="mindmap-viewport" id="viewport_${uniqueId}">
            <div class="mindmap-stage" id="stage_${uniqueId}">
              <svg class="mindmap-master-svg" viewBox="0 0 2600 1200" width="2600" height="1200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="hub-bg-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0d9488" />
                    <stop offset="100%" stop-color="#0f766e" />
                  </linearGradient>
                  <filter id="card-shadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.10" />
                  </filter>
                  <filter id="hub-shadow" x="-10%" y="-10%" width="125%" height="125%">
                    <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0d9488" flood-opacity="0.30" />
                  </filter>
                </defs>

                <!-- 1. CENTER HUB -->
                <g class="mindmap-hub mindmap-interactive-node" data-node-id="hub" transform="translate(1300, 600)" cursor="pointer">
                  <rect x="-140" y="-44" width="280" height="88" rx="20" fill="none" stroke="#14b8a6" stroke-width="2" stroke-opacity="0.45" stroke-dasharray="5 5" />
                  <rect x="-130" y="-36" width="260" height="72" rx="16" fill="url(#hub-bg-${uniqueId})" filter="url(#hub-shadow)" />
                  <text x="0" y="-4" text-anchor="middle" class="hub-svg-title">Runtime Taxonomy</text>
                  <text x="0" y="16" text-anchor="middle" class="hub-svg-sub">HỆ THỐNG ĐA TẦNG TOÀN CẢNH</text>
                </g>

                ${tier4Svg}
                ${tier3Svg}
                ${tier2Svg}
                ${tier1Svg}
              </svg>
            </div>

            <div class="mindmap-interaction-hint">
              <span>Kéo chuột để di chuyển • Cuộn chuột để thu phóng • Nhấp vào thẻ để xem chi tiết kỹ thuật • Bấm [＋]/[−] để đóng/mở nhánh</span>
            </div>
          </div>

          <!-- Bảng xem chi tiết kiến thức chuyên sâu -->
          <div class="mindmap-inspector-drawer" id="inspector_${uniqueId}">
            <div class="inspector-header">
              <div class="inspector-header-left">
                <span class="inspector-tier-tag" id="insp_tag_${uniqueId}">TIER 04</span>
                <h3 class="inspector-title" id="insp_title_${uniqueId}">Khám Phá Chi Tiết Kiến Trúc</h3>
              </div>
              <button type="button" class="inspector-close-btn" title="Đóng bảng chi tiết (Esc)">✕</button>
            </div>
            <div class="inspector-body">
              <div class="inspector-card-section">
                <div class="section-label">NGUYÊN LÝ KIẾN TRÚC BẢN CHẤT</div>
                <p class="inspector-concept-text" id="insp_concept_${uniqueId}">Nhấp chuột vào bất kỳ thành phần nào trên sơ đồ tư duy để tra cứu thông số kỹ thuật, code mẫu thực tế và các lưu ý vận hành.</p>
              </div>
              <div class="inspector-card-section">
                <div class="section-label">THÔNG SỐ VẬN HÀNH & ĐỘ TRỄ (SPECS)</div>
                <div class="inspector-specs-grid" id="insp_specs_${uniqueId}">
                  <div class="spec-cell"><span class="spec-k">Hệ thống:</span><span class="spec-v">4 Tiers Fullstack Architecture</span></div>
                </div>
              </div>
              <div class="inspector-card-section">
                <div class="section-label">MÃ NGUỒN CHUẨN PRODUCTION</div>
                <div class="inspector-code-box">
                  <pre><code class="inspector-code-content" id="insp_code_${uniqueId}">// Chọn một Node để xem code mẫu</code></pre>
                </div>
              </div>
              <div class="inspector-card-section section-gotchas">
                <div class="section-label">LƯU Ý VẬN HÀNH & PHÒNG NGỪA SỰ CỐ</div>
                <div class="inspector-gotchas-box" id="insp_gotchas_${uniqueId}">Chọn một thành phần để xem kinh nghiệm xử lý lỗi thực tế từ môi trường Production.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Parser tổng quát cho các Bản đồ phân tầng khác (hỗ trợ đầy đủ 2 Tab: Stack + Interactive Radial Mindmap)
  interface EnrichedLayer extends ParsedLayer {
    connectorToNext?: string;
  }

  const lines = text.split('\n');
  const layers: EnrichedLayer[] = [];
  let currentLayer: EnrichedLayer | null = null;
  let inBox = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    if (rawLine.startsWith('┌')) {
      inBox = true;
      continue;
    }
    if (rawLine.startsWith('└')) {
      inBox = false;
      continue;
    }
    if (rawLine.startsWith('├') || rawLine === '│') continue;

    // Dòng kết nối nằm giữa 2 hộp (ngoài khung ┌...┘)
    if (!inBox) {
      const connText = rawLine.replace(/^[│▼▲\s]+/, '').replace(/[│▼▲\s]+$/, '').trim();
      if (connText && layers.length > 0) {
        layers[layers.length - 1].connectorToNext = connText;
      } else if (connText && currentLayer) {
        currentLayer.connectorToNext = connText;
      }
      continue;
    }

    const layerMatch = rawLine.match(/(?:│\s*)?(\d+)\.\s+([^│\n]+)(?:│)?/);
    if (
      layerMatch &&
      (rawLine.includes('TẦNG') ||
        rawLine.includes('LAYER') ||
        rawLine.includes('PILLARS') ||
        rawLine.includes('TRỤ CỘT') ||
        rawLine.includes('CẤP') ||
        rawLine.includes('GIAI ĐOẠN') ||
        rawLine.includes('PHA'))
    ) {
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
      const innerLine = rawLine.replace(/^│\s*/, '').replace(/\s*│$/, '').trim();
      if (!innerLine || innerLine.startsWith('---')) continue;

      // Trường hợp dòng chứa chuỗi thành phần ngang: [ A ] ◄───► [ B ] ◄───► [ C ]
      if (
        (innerLine.includes('◄') || innerLine.includes('──►') || innerLine.includes('<-->')) &&
        innerLine.includes('[')
      ) {
        const segments = innerLine
          .split(/◄?─+►|<--+>|──►/)
          .map((s) => s.replace(/^[\[\s]+|[\]\s]+$/g, '').trim())
          .filter((s) => s.length > 0);
        if (segments.length >= 2) {
          segments.forEach((seg, segIdx) => {
            const parenMatch = seg.match(/^([^(]+)\(([^)]+)\)$/);
            if (parenMatch) {
              currentLayer!.items.push({
                title: parenMatch[1].trim(),
                subtitle: `Bước ${segIdx + 1} trong chuỗi thực thi: ${parenMatch[2].trim()}`,
              });
            } else {
              currentLayer!.items.push({
                title: seg,
                subtitle: `Thành phần thứ ${segIdx + 1} trong luồng xử lý tầng ${currentLayer!.layerNumber}`,
              });
            }
          });
          continue;
        }
      }

      const cleanItem = innerLine.replace(/^[│├──└──•\[\]\s]+/, '').replace(/[│\]]+$/, '').trim();
      if (cleanItem && cleanItem.length > 2) {
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
    return renderCleanBlueprint(text, cleanedTitle);
  }

  const tierPalettes: Array<{
    tierClass: string;
    headerClass: string;
    badgeClass: string;
    blockClass: string;
    colorClass: 'amber' | 'green' | 'sky' | 'purple';
    strokeColor: string;
  }> = [
    {
      tierClass: 'tier-hardware',
      headerClass: 'header-hardware',
      badgeClass: 'badge-hardware',
      blockClass: 'block-hardware',
      colorClass: 'amber',
      strokeColor: '#d97706',
    },
    {
      tierClass: 'tier-kernel',
      headerClass: 'header-kernel',
      badgeClass: 'badge-kernel',
      blockClass: 'block-kernel',
      colorClass: 'green',
      strokeColor: '#16a34a',
    },
    {
      tierClass: 'tier-runtime',
      headerClass: 'header-runtime',
      badgeClass: 'badge-runtime',
      blockClass: 'block-runtime',
      colorClass: 'sky',
      strokeColor: '#0284c7',
    },
    {
      tierClass: 'tier-app',
      headerClass: 'header-app',
      badgeClass: 'badge-app',
      blockClass: 'block-app',
      colorClass: 'purple',
      strokeColor: '#8b5cf6',
    },
  ];

  const tiersHtml = layers
    .map((l, index) => {
      const palette = tierPalettes[index % tierPalettes.length];
      const tierNumStr = String(l.layerNumber).padStart(2, '0');
      const itemsHtml = l.items
        .map(
          (it, itemIdx) => `
          <div class="component-block ${palette.blockClass}">
            <div class="comp-head">
              <span class="comp-icon">${String(itemIdx + 1).padStart(2, '0')}</span>
              <strong>${escapeHtml(it.title)}</strong>
            </div>
            ${it.subtitle ? `<p>${escapeHtml(it.subtitle)}</p>` : ''}
          </div>
        `
        )
        .join('');

      const bridgeLabel = l.connectorToNext || 'Dòng Dữ Liệu & Chuyển Tiếp Giữa Các Tầng';
      const connectorHtml =
        index < layers.length - 1
          ? `
          <div class="arch-connector-bridge">
            <div class="connector-line"></div>
            <div class="connector-pill">
              <span class="connector-direction">▲</span>
              <span>${escapeHtml(bridgeLabel)}</span>
              <span class="connector-direction">▼</span>
            </div>
            <div class="connector-line"></div>
          </div>
        `
          : '';

      return `
        <div class="arch-tier-card ${palette.tierClass}">
          <div class="tier-card-header ${palette.headerClass}">
            <div class="tier-badge-wrap">
              <span class="tier-number-badge ${palette.badgeClass}">TIER ${escapeHtml(tierNumStr)}</span>
              <span class="tier-scope-tag">ARCHITECTURE LAYER ${escapeHtml(tierNumStr)}</span>
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

  // Xây dựng Sơ đồ tư duy Radial SVG động cho mọi bài học
  const truncateLabel = (str: string, maxLen: number): string =>
    str.length > maxLen ? `${str.slice(0, maxLen - 1).trim()}…` : str;

  const radialBranchesSvg = layers
    .map((l, idx) => {
      const palette = tierPalettes[idx % tierPalettes.length];
      const isLeft = idx % 2 === 0; // idx 0, 2 -> bên trái; idx 1, 3 -> bên phải
      const isTop = idx < 2; // idx 0, 1 -> nửa trên (cardY=320); idx 2, 3 -> nửa dưới (cardY=880)
      const cardY = layers.length <= 2 ? 600 : isTop ? 320 : 880;
      const hubExitY = layers.length <= 2 ? 600 : isTop ? 580 : 620;
      const tierId = `t${idx + 1}`;
      const tierBadge = `TIER ${String(l.layerNumber).padStart(2, '0')}`;

      // Tách tên ngắn gọn cho thẻ Tier
      const parenMatch = l.layerTitle.match(/^([^(]+)\(([^)]+)\)/);
      const rawShortTitle = parenMatch
        ? parenMatch[2].replace(/LAYER/i, '').trim()
        : l.layerTitle.replace(/^\d+\.\s*/, '').replace(/^TẦNG\s+/i, '').trim();
      const tierTitle = truncateLabel(rawShortTitle || `Tier ${l.layerNumber}`, 22);
      const tierSub = truncateLabel(
        parenMatch ? parenMatch[1].replace(/^TẦNG\s+/i, '').trim() : `${l.items.length} thành phần cốt lõi`,
        26
      );

      const items = l.items.length > 0 ? l.items : [{ title: l.layerTitle, subtitle: 'Thành phần kiến trúc' }];
      const span = Math.min(340, Math.max(140, (items.length - 1) * 145));
      const startY = cardY - span / 2;

      const subBranches: SubBranchSpec[] = items.map((it, itemIdx) => {
        const subY = items.length === 1 ? cardY : Math.round(startY + (itemIdx * span) / (items.length - 1));
        const subId = `${tierId}-sub-${itemIdx + 1}`;
        const leafId = `${uniqueId}_${tierId}_leaf_${itemIdx + 1}`;
        return {
          subId,
          nodeId: leafId,
          y: subY,
          title: truncateLabel(it.title, 22),
          leaves: [
            {
              nodeId: leafId,
              y: subY,
              title: truncateLabel(it.title, 38),
              subtitle: truncateLabel(it.subtitle || l.connectorToNext || l.layerTitle, 54),
            },
          ],
        };
      });

      const rawSvg = isLeft
        ? renderLeftWingBranch({
            tierId,
            nodeId: `${uniqueId}_${tierId}_root`,
            colorClass: palette.colorClass as 'amber' | 'green',
            strokeColor: palette.strokeColor,
            hubExitY,
            cardY,
            tierBadge,
            tierTitle,
            tierSub,
            subBranches,
          })
        : renderRightWingBranch({
            tierId,
            nodeId: `${uniqueId}_${tierId}_root`,
            colorClass: palette.colorClass as 'purple' | 'sky',
            strokeColor: palette.strokeColor,
            hubExitY,
            cardY,
            tierBadge,
            tierTitle,
            tierSub,
            subBranches,
          });

      // Gắn metadata cho Inspector Drawer lên các node
      let enrichedSvg = rawSvg.replace(
        `data-node-id="${uniqueId}_${tierId}_root"`,
        `data-node-id="${uniqueId}_${tierId}_root" data-tier-number="${escapeHtml(tierBadge)}" data-tier-color="${palette.strokeColor}" data-node-title="${escapeHtml(l.layerTitle)}" data-node-concept="${escapeHtml(l.items.map((x) => `${x.title}${x.subtitle ? `: ${x.subtitle}` : ''}`).join(' • '))}" data-node-gotchas="${escapeHtml(l.connectorToNext || 'Tuân thủ chặt chẽ ranh giới giữa các tầng để đạt hiệu năng tối đa.')}"`
      );

      items.forEach((it, itemIdx) => {
        const leafId = `${uniqueId}_${tierId}_leaf_${itemIdx + 1}`;
        const specsJson = JSON.stringify([
          { label: 'Phân tầng', value: `${tierBadge} (${tierTitle})` },
          { label: 'Thành phần', value: it.title },
          { label: 'Liên kết', value: l.connectorToNext || 'Nội bộ tầng thực thi' },
        ]);
        enrichedSvg = enrichedSvg.replaceAll(
          `data-node-id="${leafId}"`,
          `data-node-id="${leafId}" data-tier-number="${escapeHtml(tierBadge)}" data-tier-color="${palette.strokeColor}" data-node-title="${escapeHtml(it.title)}" data-node-concept="${escapeHtml(it.subtitle || it.title)}" data-node-specs="${escapeHtml(specsJson)}" data-node-gotchas="${escapeHtml(l.connectorToNext || 'Đảm bảo thực thi đúng quy chuẩn kiến trúc ở tầng này.')}"`
        );
      });

      return enrichedSvg;
    })
    .join('');

  const filterChipsHtml = layers
    .map((l, idx) => {
      const palette = tierPalettes[idx % tierPalettes.length];
      const tierBadge = `Tier ${String(l.layerNumber).padStart(2, '0')}`;
      return `<button type="button" class="mindmap-chip chip-${palette.colorClass}" data-filter="${palette.colorClass}"><span class="chip-dot"></span> ${escapeHtml(tierBadge)}</button>`;
    })
    .join('');

  return `
    <div class="system-architecture-board" id="${uniqueId}" data-board-key="${uniqueId}">
      <div class="arch-board-header">
        <div class="arch-title-wrap">
          <span class="arch-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </span>
          <div>
            <span class="arch-main-title">${escapeHtml(cleanedTitle)}</span>
            <span class="arch-subtitle">Kiến trúc phân tầng &amp; Bản đồ tư duy tương tác (${layers.length} Tầng)</span>
          </div>
        </div>
        <div class="arch-view-switcher">
          <button type="button" class="arch-tab-btn active" data-tab-target="stack">
            Kiến Trúc Phân Tầng (Stack)
          </button>
          <button type="button" class="arch-tab-btn" data-tab-target="radial">
            Sơ Đồ Tư Duy (Mindmap)
          </button>
        </div>
      </div>

      <!-- VIEW 1: KIẾN TRÚC PHÂN TẦNG -->
      <div class="arch-stack-container" style="display: flex;">
        ${tiersHtml}
      </div>

      <!-- VIEW 2: SƠ ĐỒ TƯ DUY TƯƠNG TÁC -->
      <div class="arch-radial-container" id="radial_${uniqueId}" data-board-id="${uniqueId}" style="display: none;">
        <div class="mindmap-top-bar">
          <div class="mindmap-legend-group">
            <button type="button" class="mindmap-chip chip-all active" data-filter="all">Tất cả (${layers.length} Tầng)</button>
            ${filterChipsHtml}
          </div>

          <div class="mindmap-tree-ctrl-group">
            <button type="button" class="mindmap-ctrl-btn btn-expand-all" title="Mở rộng toàn bộ các nhánh con">+ Mở tất cả</button>
            <button type="button" class="mindmap-ctrl-btn btn-collapse-all" title="Thu gọn tất cả các nhánh con">− Thu gọn</button>
          </div>

          <div class="mindmap-ctrl-group">
            <button type="button" class="mindmap-ctrl-btn btn-zoom-out" title="Thu nhỏ (Cuộn chuột xuống)">−</button>
            <button type="button" class="mindmap-ctrl-btn btn-zoom-level" title="Bấm để đặt lại tỉ lệ chuẩn 100%">100%</button>
            <button type="button" class="mindmap-ctrl-btn btn-zoom-in" title="Phóng to (Cuộn chuột lên)">+</button>
            <button type="button" class="mindmap-ctrl-btn btn-zoom-fit" title="Thu phóng vừa vặn toàn màn hình">Vừa khung</button>
            <button type="button" class="mindmap-ctrl-btn btn-zoom-reset" title="Đặt lại vị trí trung tâm">Đặt lại</button>
            <button type="button" class="mindmap-ctrl-btn btn-fullscreen" title="Phóng to toàn màn hình (Esc để thoát)">Toàn màn hình</button>
          </div>
        </div>

        <div class="mindmap-viewport" id="viewport_${uniqueId}">
          <div class="mindmap-stage" id="stage_${uniqueId}">
            <svg class="mindmap-master-svg" viewBox="0 0 2600 1200" width="2600" height="1200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hub-bg-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0d9488" />
                  <stop offset="100%" stop-color="#0f766e" />
                </linearGradient>
                <filter id="card-shadow" x="-10%" y="-10%" width="125%" height="125%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.10" />
                </filter>
                <filter id="hub-shadow" x="-10%" y="-10%" width="125%" height="125%">
                  <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0d9488" flood-opacity="0.30" />
                </filter>
              </defs>

              <g class="mindmap-hub mindmap-interactive-node" data-node-id="${uniqueId}_hub" data-tier-number="SYSTEM TAXONOMY" data-tier-color="#14b8a6" data-node-title="${escapeHtml(cleanedTitle)}" data-node-concept="Bản đồ tổng thể kết nối ${layers.length} tầng kiến trúc từ cấp thấp lên cấp cao." transform="translate(1300, 600)" cursor="pointer">
                <rect x="-140" y="-44" width="280" height="88" rx="20" fill="none" stroke="#14b8a6" stroke-width="2" stroke-opacity="0.45" stroke-dasharray="5 5" />
                <rect x="-130" y="-36" width="260" height="72" rx="16" fill="url(#hub-bg-${uniqueId})" filter="url(#hub-shadow)" />
                <text x="0" y="-4" text-anchor="middle" class="hub-svg-title">System Taxonomy</text>
                <text x="0" y="16" text-anchor="middle" class="hub-svg-sub">${escapeHtml(truncateLabel(cleanedTitle.replace(/^Sơ đồ \d+:\s*/i, ''), 24).toUpperCase())}</text>
              </g>

              ${radialBranchesSvg}
            </svg>
          </div>

          <div class="mindmap-interaction-hint">
            <span>Kéo chuột để di chuyển • Cuộn chuột để thu phóng • Nhấp vào thẻ để xem chi tiết kỹ thuật • Bấm [＋]/[−] để đóng/mở nhánh</span>
          </div>
        </div>

        <div class="mindmap-inspector-drawer" id="inspector_${uniqueId}">
          <div class="inspector-header">
            <div class="inspector-header-left">
              <span class="inspector-tier-tag" id="insp_tag_${uniqueId}">TIER 01</span>
              <h3 class="inspector-title" id="insp_title_${uniqueId}">Khám Phá Chi Tiết Kiến Trúc</h3>
            </div>
            <button type="button" class="inspector-close-btn" title="Đóng bảng chi tiết (Esc)">✕</button>
          </div>
          <div class="inspector-body">
            <div class="inspector-card-section">
              <div class="section-label">NGUYÊN LÝ KIẾN TRÚC BẢN CHẤT</div>
              <p class="inspector-concept-text" id="insp_concept_${uniqueId}">Nhấp chuột vào bất kỳ thành phần nào trên sơ đồ tư duy để tra cứu thông số kỹ thuật và vai trò trong hệ thống.</p>
            </div>
            <div class="inspector-card-section">
              <div class="section-label">THÔNG SỐ VẬN HÀNH &amp; LIÊN KẾT (SPECS)</div>
              <div class="inspector-specs-grid" id="insp_specs_${uniqueId}">
                <div class="spec-cell"><span class="spec-k">Hệ thống:</span><span class="spec-v">${layers.length} Tiers Architecture</span></div>
              </div>
            </div>
            <div class="inspector-card-section">
              <div class="section-label">MÃ NGUỒN CHUẨN PRODUCTION</div>
              <div class="inspector-code-box">
                <pre><code class="inspector-code-content" id="insp_code_${uniqueId}">// Chọn một Node để xem thông tin</code></pre>
              </div>
            </div>
            <div class="inspector-card-section section-gotchas">
              <div class="section-label">LƯU Ý VẬN HÀNH &amp; CHUYỂN TIẾP TẦNG</div>
              <div class="inspector-gotchas-box" id="insp_gotchas_${uniqueId}">Chọn một thành phần để xem cơ chế kết nối giữa các tầng.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
