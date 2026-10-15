import { escapeHtml } from '../../common/CodeViewer.tsx';
import {
  sketchCenterIcon,
  sketchCurvedArrow,
  sketchRoundedBox,
} from '../sketchEngine.ts';
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

export type MindmapTopologyKind =
  | 'taxonomy-tree'
  | 'pipeline-feedback-loop'
  | 'dual-cycle-loop'
  | 'orbital-cycle';

/**
 * Phân loại tự động (hoặc theo tag [TOPOLOGY: ...]) cấu trúc Sơ đồ tư duy phù hợp nhất với nội dung học thuật của từng bài
 */
export function detectMindmapTopology(
  text: string,
  title: string,
  layerCount: number
): MindmapTopologyKind {
  const tagMatch = text.match(/\[TOPOLOGY:\s*(taxonomy-tree|pipeline-feedback-loop|dual-cycle-loop|orbital-cycle)\]/i);
  if (tagMatch) {
    return tagMatch[1].toLowerCase() as MindmapTopologyKind;
  }

  const corpus = `${title} ${text}`.toUpperCase();

  // 1. Dual-Cycle Loop (Vòng lặp trong ↔ Vòng lặp ngoài): GC Young/Old Gen, Orinoco, Event Loop Microtask vs Macrotask
  if (
    (corpus.includes('YOUNG GEN') && corpus.includes('OLD GEN')) ||
    (corpus.includes('MINOR GC') && corpus.includes('MAJOR GC')) ||
    corpus.includes('ORINOCO') ||
    (corpus.includes('MICROTASK') &&
      (corpus.includes('MACROTASK') || corpus.includes('6 PHA') || corpus.includes('6-PHASE'))) ||
    (corpus.includes('INNER LOOP') && corpus.includes('OUTER LOOP'))
  ) {
    return 'dual-cycle-loop';
  }

  // 2. Pipeline & Feedback Loop (Chuỗi đường ống thực thi & vòng phản hồi/thoát lui): V8 JIT Ignition/TurboFan, Worker Transfer, Request/Stream Pipeline
  if (
    corpus.includes('PIPELINE') ||
    (corpus.includes('IGNITION') && corpus.includes('TURBOFAN')) ||
    (corpus.includes('PARSER') && corpus.includes('BYTECODE')) ||
    (corpus.includes('GUARD') && corpus.includes('INTERCEPTOR') && corpus.includes('PIPE')) ||
    corpus.includes('TRANSFERLIST') ||
    corpus.includes('MULTI-ISOLATE')
  ) {
    return 'pipeline-feedback-loop';
  }

  // 3. System Taxonomy Tree (Cây phân nhánh đa tầng >= 4 tầng)
  if (
    layerCount >= 4 ||
    corpus.includes('(HARDWARE LAYER)') ||
    corpus.includes('TẦNG VẬT LÝ & PHẦN CỨNG')
  ) {
    return 'taxonomy-tree';
  }

  // 4. Orbital Multi-Pillar Cycle (Chu trình đa trụ cột cân đối cho 2-3 tầng)
  return 'orbital-cycle';
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

const WING_SKETCH_COLORS: Record<
  'purple' | 'sky' | 'amber' | 'green',
  { tierFill: string; subFill: string; leafFill: string; badgeText: string }
> = {
  purple: {
    tierFill: '#d0bfff',
    subFill: '#e5dbff',
    leafFill: '#f3f0ff',
    badgeText: '#5f3dc4',
  },
  sky: {
    tierFill: '#a5d8ff',
    subFill: '#d0ebff',
    leafFill: '#e7f5ff',
    badgeText: '#1864ab',
  },
  amber: {
    tierFill: '#ffec99',
    subFill: '#fff3bf',
    leafFill: '#fff9db',
    badgeText: '#d9480f',
  },
  green: {
    tierFill: '#b2f2bb',
    subFill: '#d3f9d8',
    leafFill: '#ebfbee',
    badgeText: '#2b8a3e',
  },
};

function renderSketchHubAndFeedbackArcs(params: {
  uniqueId: string;
  hubNodeId: string;
  hubTitle: string;
  hubSub: string;
  extraHubAttrs?: string;
  topFeedbackLabel?: string;
  bottomFeedbackLabel?: string;
  topIcon?: 'laptop' | 'cloud' | 'cpu' | 'layers';
  bottomIcon?: 'laptop' | 'cloud' | 'cpu' | 'layers';
}): string {
  const {
    uniqueId,
    hubNodeId,
    hubTitle,
    hubSub,
    extraHubAttrs = '',
    topFeedbackLabel = 'luồng yêu cầu & phản hồi xuyên tầng (cross-tier feedback loop)',
    bottomFeedbackLabel = 'ủy thác I/O bất đồng bộ & sự kiện phần cứng (syscall / epoll)',
    topIcon = 'laptop',
    bottomIcon = 'cloud',
  } = params;

  const outerDashedBox = sketchRoundedBox(-154, -52, 308, 104, {
    fill: 'none',
    stroke: '#1e1e1e',
    strokeWidth: 1.75,
    rx: 22,
    dashed: true,
    seed: `${uniqueId}_hub_outer`,
  });

  const innerPastelBox = sketchRoundedBox(-140, -42, 280, 84, {
    fill: '#ffc9c9',
    stroke: '#1e1e1e',
    strokeWidth: 2.25,
    rx: 18,
    seed: `${uniqueId}_hub_inner`,
    extraClass: 'node-card-bg',
  });

  const topDashedLoop = sketchCurvedArrow(
    1020,
    244,
    1300,
    115,
    1580,
    244,
    {
      dashed: true,
      bidirectional: true,
      label: topFeedbackLabel,
      labelOffsetY: -18,
      labelFontSize: 16,
      seed: `${uniqueId}_top_feedback`,
    }
  );

  const bottomDashedLoop = sketchCurvedArrow(
    1580,
    956,
    1300,
    1085,
    1020,
    956,
    {
      dashed: true,
      bidirectional: true,
      label: bottomFeedbackLabel,
      labelOffsetY: 22,
      labelFontSize: 16,
      seed: `${uniqueId}_bottom_feedback`,
    }
  );

  const topCenterIcon = sketchCenterIcon(topIcon, 1300, 430, 1.35);
  const bottomCenterIcon = sketchCenterIcon(bottomIcon, 1300, 770, 1.4);

  return `
    ${topDashedLoop}
    ${bottomDashedLoop}
    ${topCenterIcon}
    ${bottomCenterIcon}
    <g class="mindmap-hub mindmap-interactive-node" data-node-id="${escapeHtml(hubNodeId)}" ${extraHubAttrs} transform="translate(1300, 600)" cursor="pointer">
      ${outerDashedBox}
      ${innerPastelBox}
      <text x="0" y="-4" text-anchor="middle" class="hub-svg-title">${escapeHtml(hubTitle)}</text>
      <text x="0" y="18" text-anchor="middle" class="hub-svg-sub">${escapeHtml(hubSub)}</text>
    </g>
  `;
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

  const palette = WING_SKETCH_COLORS[colorClass];

  const subBranchesSvg = subBranches
    .map((sb) => {
      const leavesSvg = sb.leaves
        .map((leaf) => {
          const boxX = 2065;
          const boxY = leaf.y - 31;
          const arrowToLeaf = sketchCurvedArrow(
            2025,
            sb.y,
            2044,
            (sb.y + leaf.y) / 2,
            boxX - 4,
            leaf.y,
            {
              stroke: '#1e1e1e',
              strokeWidth: 1.85,
              arrowSize: 11,
              seed: `${leaf.nodeId}_arrow`,
            }
          );
          const leafBox = sketchRoundedBox(0, 0, 424, 62, {
            fill: palette.leafFill,
            stroke: '#1e1e1e',
            strokeWidth: 1.75,
            rx: 12,
            seed: `${leaf.nodeId}_box`,
            extraClass: `leaf-card-bg card-border-${colorClass}`,
          });

          return `
            ${arrowToLeaf}
            <g class="leaf-node-card mindmap-interactive-node" data-node-id="${leaf.nodeId}" transform="translate(${boxX}, ${boxY})" cursor="pointer">
              ${leafBox}
              <rect x="6" y="12" width="4.5" height="38" rx="2" fill="${strokeColor}" />
              <text x="20" y="25" text-anchor="start" class="leaf-svg-title">${escapeHtml(leaf.title)}</text>
              <text x="20" y="45" text-anchor="start" class="leaf-svg-sub">${escapeHtml(leaf.subtitle)}</text>
            </g>
          `;
        })
        .join('');

      const subBoxX = 1795;
      const subBoxY = sb.y - 23;
      const subConnector = sketchCurvedArrow(
        1755,
        cardY,
        1774,
        (cardY + sb.y) / 2,
        subBoxX - 4,
        sb.y,
        {
          stroke: '#1e1e1e',
          strokeWidth: 2,
          arrowSize: 11.5,
          seed: `${sb.subId}_conn`,
        }
      );
      const subBox = sketchRoundedBox(0, 0, 220, 46, {
        fill: palette.subFill,
        stroke: '#1e1e1e',
        strokeWidth: 1.85,
        rx: 12,
        seed: `${sb.subId}_box`,
        extraClass: `sub-card-bg card-border-${colorClass}`,
      });

      return `
        <g class="sub-branch-group" data-sub-id="${sb.subId}">
          ${subConnector}
          <g class="sub-node-card sub-title-trigger mindmap-interactive-node" data-node-id="${sb.nodeId}" transform="translate(${subBoxX}, ${subBoxY})" cursor="pointer">
            ${subBox}
            <text x="106" y="28" text-anchor="middle" class="sub-cat-title">${escapeHtml(sb.title)}</text>
          </g>
          <g class="sub-toggle-badge" transform="translate(2015, ${sb.y})" cursor="pointer" title="Đóng/Mở nhánh con">
            <circle cx="0" cy="0" r="10.5" fill="${strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
            <text x="0" y="3.8" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
          </g>
          <g class="sub-branch-leaves">
            ${leavesSvg}
          </g>
        </g>
      `;
    })
    .join('');

  const mainStemArrow = sketchCurvedArrow(
    1442,
    hubExitY,
    1465,
    (hubExitY + cardY) / 2,
    1484,
    cardY,
    {
      stroke: '#1e1e1e',
      strokeWidth: 2.4,
      arrowSize: 13.5,
      seed: `${tierId}_main_stem`,
    }
  );

  const tierCardBox = sketchRoundedBox(-112, -44, 224, 88, {
    fill: palette.tierFill,
    stroke: '#1e1e1e',
    strokeWidth: 2.1,
    rx: 16,
    seed: `${nodeId}_tier_card`,
    extraClass: `node-card-bg card-border-${colorClass}`,
  });

  return `
    <g class="mindmap-tier-branch branch-${colorClass}" data-tier-id="${tierId}">
      ${mainStemArrow}

      <g class="branch-card-group" transform="translate(1600, ${cardY})">
        <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="${tierId}" data-node-id="${nodeId}" cursor="pointer">
          ${tierCardBox}
          <text x="0" y="-17" text-anchor="middle" font-size="11.5" font-weight="800" fill="${palette.badgeText}" letter-spacing="0.6" class="sketch-node-badge">${escapeHtml(tierBadge)}</text>
          <text x="0" y="7" text-anchor="middle" class="card-svg-title">${escapeHtml(tierTitle)}</text>
          <text x="0" y="27" text-anchor="middle" class="card-svg-sub">${escapeHtml(tierSub)}</text>
        </g>
        <g class="tier-toggle-badge badge-${colorClass}" transform="translate(112, 0)" cursor="pointer" title="Đóng/Mở nhánh ${escapeHtml(tierTitle)}">
          <circle cx="0" cy="0" r="11.5" fill="${strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
          <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
        </g>
      </g>

      <g class="tier-sub-branches">
        <path d="M 1722 ${cardY} L 1755 ${cardY}" stroke="#1e1e1e" stroke-width="2.2" stroke-linecap="round" fill="none" />
        <circle cx="1755" cy="${cardY}" r="4.5" class="fork-joint-circle circle-${colorClass}" stroke="#1e1e1e" stroke-width="2" />
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

  const palette = WING_SKETCH_COLORS[colorClass];

  const subBranchesSvg = subBranches
    .map((sb) => {
      const leavesSvg = sb.leaves
        .map((leaf) => {
          const boxX = 111;
          const boxRight = 535;
          const boxY = leaf.y - 31;
          const arrowToLeaf = sketchCurvedArrow(
            575,
            sb.y,
            556,
            (sb.y + leaf.y) / 2,
            boxRight + 4,
            leaf.y,
            {
              stroke: '#1e1e1e',
              strokeWidth: 1.85,
              arrowSize: 11,
              seed: `${leaf.nodeId}_arrow`,
            }
          );
          const leafBox = sketchRoundedBox(0, 0, 424, 62, {
            fill: palette.leafFill,
            stroke: '#1e1e1e',
            strokeWidth: 1.75,
            rx: 12,
            seed: `${leaf.nodeId}_box`,
            extraClass: `leaf-card-bg card-border-${colorClass}`,
          });

          return `
            ${arrowToLeaf}
            <g class="leaf-node-card mindmap-interactive-node" data-node-id="${leaf.nodeId}" transform="translate(${boxX}, ${boxY})" cursor="pointer">
              ${leafBox}
              <rect x="413" y="12" width="4.5" height="38" rx="2" fill="${strokeColor}" />
              <text x="18" y="25" text-anchor="start" class="leaf-svg-title">${escapeHtml(leaf.title)}</text>
              <text x="18" y="45" text-anchor="start" class="leaf-svg-sub">${escapeHtml(leaf.subtitle)}</text>
            </g>
          `;
        })
        .join('');

      const subBoxX = 585;
      const subBoxRight = 805;
      const subBoxY = sb.y - 23;
      const subConnector = sketchCurvedArrow(
        845,
        cardY,
        826,
        (cardY + sb.y) / 2,
        subBoxRight + 4,
        sb.y,
        {
          stroke: '#1e1e1e',
          strokeWidth: 2,
          arrowSize: 11.5,
          seed: `${sb.subId}_conn`,
        }
      );
      const subBox = sketchRoundedBox(0, 0, 220, 46, {
        fill: palette.subFill,
        stroke: '#1e1e1e',
        strokeWidth: 1.85,
        rx: 12,
        seed: `${sb.subId}_box`,
        extraClass: `sub-card-bg card-border-${colorClass}`,
      });

      return `
        <g class="sub-branch-group" data-sub-id="${sb.subId}">
          ${subConnector}
          <g class="sub-node-card sub-title-trigger mindmap-interactive-node" data-node-id="${sb.nodeId}" transform="translate(${subBoxX}, ${subBoxY})" cursor="pointer">
            ${subBox}
            <text x="114" y="28" text-anchor="middle" class="sub-cat-title">${escapeHtml(sb.title)}</text>
          </g>
          <g class="sub-toggle-badge" transform="translate(585, ${sb.y})" cursor="pointer" title="Đóng/Mở nhánh con">
            <circle cx="0" cy="0" r="10.5" fill="${strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
            <text x="0" y="3.8" text-anchor="middle" font-size="12" font-weight="900" fill="#ffffff" class="sub-toggle-text">−</text>
          </g>
          <g class="sub-branch-leaves">
            ${leavesSvg}
          </g>
        </g>
      `;
    })
    .join('');

  const mainStemArrow = sketchCurvedArrow(
    1158,
    hubExitY,
    1135,
    (hubExitY + cardY) / 2,
    1116,
    cardY,
    {
      stroke: '#1e1e1e',
      strokeWidth: 2.4,
      arrowSize: 13.5,
      seed: `${tierId}_main_stem`,
    }
  );

  const tierCardBox = sketchRoundedBox(-112, -44, 224, 88, {
    fill: palette.tierFill,
    stroke: '#1e1e1e',
    strokeWidth: 2.1,
    rx: 16,
    seed: `${nodeId}_tier_card`,
    extraClass: `node-card-bg card-border-${colorClass}`,
  });

  return `
    <g class="mindmap-tier-branch branch-${colorClass}" data-tier-id="${tierId}">
      ${mainStemArrow}

      <g class="branch-card-group" transform="translate(1000, ${cardY})">
        <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="${tierId}" data-node-id="${nodeId}" cursor="pointer">
          ${tierCardBox}
          <text x="0" y="-17" text-anchor="middle" font-size="11.5" font-weight="800" fill="${palette.badgeText}" letter-spacing="0.6" class="sketch-node-badge">${escapeHtml(tierBadge)}</text>
          <text x="0" y="7" text-anchor="middle" class="card-svg-title">${escapeHtml(tierTitle)}</text>
          <text x="0" y="27" text-anchor="middle" class="card-svg-sub">${escapeHtml(tierSub)}</text>
        </g>
        <g class="tier-toggle-badge badge-${colorClass}" transform="translate(-112, 0)" cursor="pointer" title="Đóng/Mở nhánh ${escapeHtml(tierTitle)}">
          <circle cx="0" cy="0" r="11.5" fill="${strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
          <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
        </g>
      </g>

      <g class="tier-sub-branches">
        <path d="M 878 ${cardY} L 845 ${cardY}" stroke="#1e1e1e" stroke-width="2.2" stroke-linecap="round" fill="none" />
        <circle cx="845" cy="${cardY}" r="4.5" class="fork-joint-circle circle-${colorClass}" stroke="#1e1e1e" stroke-width="2" />
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

  // Trường hợp đặc thù Sơ đồ 1 của Bài 1 Chương 1 (Hardware / Kernel / Libuv / V8 Engine / NestJS)
  if (text.includes('(HARDWARE LAYER)') || text.includes('TẦNG VẬT LÝ & PHẦN CỨNG')) {
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
      <div class="system-architecture-board" id="${uniqueId}" data-board-key="${uniqueId}" data-mindmap-topology="taxonomy-tree">
        <!-- Header với Tab Switcher -->
        <div class="arch-board-header">
          <div class="arch-title-wrap">
            <span class="arch-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            </span>
            <div>
              <span class="arch-main-title">${escapeHtml(cleanedTitle)}</span>
              <span class="arch-subtitle">Sơ Đồ Tư Duy Phân Nhánh Đa Tầng (System Taxonomy Tree) • 4 Tầng Kiến Trúc</span>
            </div>
          </div>
          <div class="arch-view-switcher">
            <button type="button" class="arch-tab-btn active" data-tab-target="radial">
              Sơ Đồ Tư Duy (Mindmap)
            </button>
            <button type="button" class="arch-tab-btn" data-tab-target="stack">
              Kiến Trúc Phân Tầng (Stack)
            </button>
          </div>
        </div>

        <!-- VIEW 1: KIẾN TRÚC PHÂN TẦNG ĐA TẦNG CHUẨN XÁC -->
        <div class="arch-stack-container" style="display: none;">
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

        <!-- VIEW 2: SƠ ĐỒ TƯ DUY 4 TẦNG ĐỒNG BỘ TOÀN DIỆN (EXCALIDRAW SKETCH DEFAULT) -->
        <div class="arch-radial-container" id="radial_${uniqueId}" data-board-id="${uniqueId}" style="display: flex;">
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
              <svg class="mindmap-master-svg excalidraw-sketch-svg" data-topology="taxonomy-tree" viewBox="0 0 2600 1200" width="2600" height="1200" fill="none" xmlns="http://www.w3.org/2000/svg">
                ${renderSketchHubAndFeedbackArcs({
                  uniqueId,
                  hubNodeId: 'hub',
                  hubTitle: 'Runtime Taxonomy',
                  hubSub: 'HỆ THỐNG ĐA TẦNG TOÀN CẢNH',
                })}

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

  // Parser tổng quát cho các Bản đồ phân tầng khác (hỗ trợ đầy đủ 2 Tab: Stack + Multi-Topology Interactive Mindmap)
  interface EnrichedLayer extends ParsedLayer {
    connectorToNext?: string;
  }

  const lines = text.split('\n');
  const layers: EnrichedLayer[] = [];
  let currentLayer: EnrichedLayer | null = null;
  let inBox = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || /^\[TOPOLOGY:\s*[a-z0-9_-]+\]$/i.test(rawLine)) continue;

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
                subtitle: parenMatch[2].trim(),
              });
            } else if (seg.includes(':')) {
              const colonParts = seg.split(':');
              currentLayer!.items.push({
                title: colonParts[0].trim(),
                subtitle: colonParts.slice(1).join(':').trim(),
              });
            } else {
              const peers = segments.filter((_, idx) => idx !== segIdx).join(' ↔ ');
              currentLayer!.items.push({
                title: seg,
                subtitle: peers ? `Tương tác đồng cấp: ${peers}` : currentLayer!.layerTitle,
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

  const truncateLabel = (str: string, maxLen: number): string =>
    str.length > maxLen ? `${str.slice(0, maxLen - 1).trim()}…` : str;

  const extractTierTitles = (
    layer: EnrichedLayer
  ): { shortTitle: string; shortSub: string; fullBadge: string } => {
    const parenMatch = layer.layerTitle.match(/^([^(]+)\(([^)]+)\)/);
    const rawShort = parenMatch
      ? parenMatch[2].replace(/\bLAYER\b/gi, '').trim()
      : layer.layerTitle.replace(/^\d+\.\s*/, '').replace(/^TẦNG\s+/i, '').trim();
    const rawSub = parenMatch
      ? parenMatch[1].replace(/^\d+\.\s*/, '').replace(/^TẦNG\s+/i, '').trim()
      : `${layer.items.length} thành phần cốt lõi`;
    return {
      shortTitle: truncateLabel(rawShort || `Tier ${layer.layerNumber}`, 26),
      shortSub: truncateLabel(rawSub, 34),
      fullBadge: `TIER ${String(layer.layerNumber).padStart(2, '0')}`,
    };
  };

  const buildNodeDataAttrs = (params: {
    nodeId: string;
    tierBadge: string;
    tierColor: string;
    title: string;
    concept: string;
    specs?: Array<{ label: string; value: string }>;
    gotchas?: string;
  }): string => {
    const specsAttr = params.specs
      ? ` data-node-specs="${escapeHtml(JSON.stringify(params.specs))}"`
      : '';
    return `data-node-id="${escapeHtml(params.nodeId)}" data-tier-number="${escapeHtml(params.tierBadge)}" data-tier-color="${escapeHtml(params.tierColor)}" data-node-title="${escapeHtml(params.title)}" data-node-concept="${escapeHtml(params.concept)}"${specsAttr} data-node-gotchas="${escapeHtml(params.gotchas || 'Tuân thủ bất biến kiến trúc tại tầng thực thi này.')}"`;
  };

  const topology = detectMindmapTopology(text, cleanedTitle, layers.length);

  const topologyMeta: Record<
    MindmapTopologyKind,
    { badge: string; viewBox: string; width: number; height: number }
  > = {
    'dual-cycle-loop': {
      badge: 'Sơ Đồ Tư Duy Vòng Lặp Kép (Inner ↔ Outer Cycle Loop)',
      viewBox: '0 0 2500 1180',
      width: 2500,
      height: 1180,
    },
    'pipeline-feedback-loop': {
      badge: 'Sơ Đồ Tư Duy Đường Ống Thực Thi & Phản Hồi (Execution Pipeline & Feedback Loop)',
      viewBox: '0 0 2500 1160',
      width: 2500,
      height: 1160,
    },
    'orbital-cycle': {
      badge: 'Sơ Đồ Tư Duy Chu Trình Đa Trụ Cột (Orbital Multi-Pillar Map)',
      viewBox: '0 0 2500 1160',
      width: 2500,
      height: 1160,
    },
    'taxonomy-tree': {
      badge: 'Sơ Đồ Tư Duy Phân Nhánh Đa Tầng (System Taxonomy Tree)',
      viewBox: '0 0 2600 1200',
      width: 2600,
      height: 1200,
    },
  };

  // ============================================================================
  // TOPOLOGY A: DUAL-CYCLE LOOP (Vòng lặp trong ↔ Vòng lặp ngoài + Ranh giới tầng 1)
  // Áp dụng cho: Bài 3 (c1-l3 V8 Young Gen Scavenger ↔ Old Gen Orinoco GC), Bài c2-l1 (Microtask ↔ Libuv 6-Phase Loop)...
  // ============================================================================
  const renderDualCycleSvg = (): string => {
    const topLayer = layers[0];
    const leftLoopLayer = layers[1] || layers[0];
    const rightLoopLayer = layers[2] || layers[layers.length - 1];

    // 1. Tầng 1: Thanh ranh giới kiến trúc phía trên (Top Foundation Boundary Bar)
    const p1 = tierPalettes[0];
    const t1Meta = extractTierTitles(topLayer);
    const t1Items =
      topLayer.items.length > 0
        ? topLayer.items
        : [{ title: topLayer.layerTitle, subtitle: topLayer.connectorToNext || 'Tầng nền tảng' }];

    const t1HubBox = sketchRoundedBox(-235, -36, 470, 72, {
      fill: WING_SKETCH_COLORS.amber.tierFill,
      stroke: '#1e1e1e',
      strokeWidth: 2.15,
      rx: 16,
      seed: `${uniqueId}_t1_bar_hub`,
      extraClass: 'node-card-bg card-border-amber',
    });

    const t1Count = t1Items.length;
    const t1Spacing = t1Count <= 1 ? 0 : Math.min(580, 1280 / (t1Count - 1));
    const t1StartX = 1250 - ((t1Count - 1) * t1Spacing) / 2;

    const t1LeavesSvg = t1Items
      .map((it, idx) => {
        const itemCx = Math.round(t1StartX + idx * t1Spacing);
        const itemCy = 212;
        const leafId = `${uniqueId}_t1_leaf_${idx + 1}`;
        const leafBox = sketchRoundedBox(-205, -33, 410, 66, {
          fill: WING_SKETCH_COLORS.amber.leafFill,
          stroke: '#1e1e1e',
          strokeWidth: 1.85,
          rx: 13,
          seed: `${leafId}_box`,
          extraClass: 'leaf-card-bg card-border-amber',
        });
        const dataAttrs = buildNodeDataAttrs({
          nodeId: leafId,
          tierBadge: t1Meta.fullBadge,
          tierColor: p1.strokeColor,
          title: it.title,
          concept: it.subtitle || topLayer.layerTitle,
          specs: [
            { label: 'Phân tầng', value: `${t1Meta.fullBadge} (${t1Meta.shortTitle})` },
            { label: 'Thành phần', value: it.title },
            { label: 'Chuyển tiếp', value: topLayer.connectorToNext || 'Tương tác trực tiếp' },
          ],
          gotchas: topLayer.connectorToNext,
        });

        const peerArrow =
          idx < t1Count - 1
            ? sketchCurvedArrow(
                itemCx + 210,
                itemCy,
                Math.round(itemCx + t1Spacing / 2),
                itemCy - 10,
                Math.round(itemCx + t1Spacing - 210),
                itemCy,
                {
                  stroke: '#1e1e1e',
                  strokeWidth: 2,
                  bidirectional: true,
                  arrowSize: 10.5,
                  seed: `${leafId}_peer_arrow`,
                }
              )
            : '';

        return `
          ${peerArrow}
          <g class="leaf-node-card mindmap-interactive-node" ${dataAttrs} transform="translate(${itemCx}, ${itemCy})" cursor="pointer">
            ${leafBox}
            <rect x="-195" y="-21" width="4.5" height="42" rx="2" fill="${p1.strokeColor}" />
            <text x="-178" y="-4" text-anchor="start" class="leaf-svg-title">${escapeHtml(truncateLabel(it.title, 36))}</text>
            <text x="-178" y="18" text-anchor="start" class="leaf-svg-sub">${escapeHtml(truncateLabel(it.subtitle || topLayer.layerTitle, 52))}</text>
          </g>
        `;
      })
      .join('');

    const feederLeftArrow = sketchCurvedArrow(920, 248, 740, 305, 620, 358, {
      stroke: '#1e1e1e',
      strokeWidth: 2.1,
      dashed: true,
      arrowSize: 12,
      seed: `${uniqueId}_t1_to_left_loop`,
    });
    const feederRightArrow = sketchCurvedArrow(1580, 248, 1760, 305, 1880, 358, {
      stroke: '#1e1e1e',
      strokeWidth: 2.1,
      dashed: true,
      arrowSize: 12,
      seed: `${uniqueId}_t1_to_right_loop`,
    });

    const t1BridgeLabel = truncateLabel(
      topLayer.connectorToNext || 'Cấp phát & Điều phối xuống các Vòng lặp Thực thi',
      68
    );

    const tier1GroupSvg = `
      <g class="mindmap-tier-branch branch-amber" data-tier-id="t1">
        <g class="branch-card-group" transform="translate(1250, 86)">
          <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="t1" ${buildNodeDataAttrs({
            nodeId: `${uniqueId}_t1_root`,
            tierBadge: t1Meta.fullBadge,
            tierColor: p1.strokeColor,
            title: topLayer.layerTitle,
            concept: t1Items.map((x) => `${x.title}${x.subtitle ? `: ${x.subtitle}` : ''}`).join(' • '),
            gotchas: topLayer.connectorToNext,
          })} cursor="pointer">
            ${t1HubBox}
            <text x="0" y="-13" text-anchor="middle" font-size="11.5" font-weight="800" fill="${WING_SKETCH_COLORS.amber.badgeText}" letter-spacing="0.6" class="sketch-node-badge">${escapeHtml(t1Meta.fullBadge)} • FOUNDATION BAR</text>
            <text x="0" y="9" text-anchor="middle" class="card-svg-title">${escapeHtml(t1Meta.shortTitle)}</text>
            <text x="0" y="27" text-anchor="middle" class="card-svg-sub">${escapeHtml(t1Meta.shortSub)}</text>
          </g>
          <g class="tier-toggle-badge badge-amber" transform="translate(235, 0)" cursor="pointer" title="Đóng/Mở nhánh ${escapeHtml(t1Meta.shortTitle)}">
            <circle cx="0" cy="0" r="11.5" fill="${p1.strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
            <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
          </g>
        </g>
        <g class="tier-sub-branches">
          <path d="M 1250 122 L 1250 176" stroke="#1e1e1e" stroke-width="2.1" stroke-dasharray="5 4" />
          ${t1LeavesSvg}
          ${feederLeftArrow}
          ${feederRightArrow}
          <text x="1250" y="302" text-anchor="middle" class="sketch-arrow-label" font-size="15.5">${escapeHtml(t1BridgeLabel)}</text>
        </g>
      </g>
    `;

    // Helper dựng 1 Vòng Lặp Tròn (Circular Loop) theo đúng phong cách Excalidraw Reference
    const renderCircularLoopGroup = (params: {
      layer: EnrichedLayer;
      tierIdx: number;
      cx: number;
      cy: number;
      loopRoleBadge: string;
      iconKind: 'cpu' | 'cloud' | 'laptop' | 'layers';
      nodeFills: string[];
    }): string => {
      const { layer, tierIdx, cx, cy, loopRoleBadge, iconKind, nodeFills } = params;
      const palette = tierPalettes[tierIdx % tierPalettes.length];
      const wingPalette = WING_SKETCH_COLORS[palette.colorClass];
      const tierId = `t${tierIdx + 1}`;
      const meta = extractTierTitles(layer);
      const items =
        layer.items.length > 0
          ? layer.items
          : [{ title: layer.layerTitle, subtitle: 'Chu trình xử lý khép kín' }];

      const outerHalo = sketchRoundedBox(-152, -48, 304, 96, {
        fill: 'none',
        stroke: '#1e1e1e',
        strokeWidth: 1.7,
        rx: 20,
        dashed: true,
        seed: `${uniqueId}_${tierId}_halo`,
      });
      const centerCard = sketchRoundedBox(-140, -40, 280, 80, {
        fill: wingPalette.tierFill,
        stroke: '#1e1e1e',
        strokeWidth: 2.2,
        rx: 16,
        seed: `${uniqueId}_${tierId}_center`,
        extraClass: `node-card-bg card-border-${palette.colorClass}`,
      });
      const centerIconSvg = sketchCenterIcon(iconKind, cx, cy - 82, 1.3);

      // Tọa độ các Node vệ tinh quay quanh tâm (cx, cy) tạo thành vòng lặp tròn
      const count = items.length;
      const orbitPos: Array<{ x: number; y: number }> =
        count === 1
          ? [{ x: cx, y: cy - 255 }]
          : count === 2
            ? [
                { x: cx, y: cy - 255 },
                { x: cx, y: cy + 245 },
              ]
            : count === 3
              ? [
                  { x: cx, y: cy - 255 }, // Top (-90 deg)
                  { x: cx + 295, y: cy + 195 }, // Bottom-Right (30 deg)
                  { x: cx - 295, y: cy + 195 }, // Bottom-Left (150 deg)
                ]
              : items.slice(0, 4).map((_, i) => {
                  const rad = ((-90 + i * 90) * Math.PI) / 180;
                  return {
                    x: Math.round(cx + 345 * Math.cos(rad)),
                    y: Math.round(cy + 245 * Math.sin(rad)),
                  };
                });

      // Vẽ cung mũi tên nối vòng tròn khép kín (Clockwise Circular Arc Arrows)
      const loopArcsSvg =
        orbitPos.length === 3
          ? [
              // Top -> Bottom-Right
              sketchCurvedArrow(
                cx + 192,
                cy - 245,
                cx + 385,
                cy - 65,
                cx + 335,
                cy + 152,
                {
                  stroke: '#1e1e1e',
                  strokeWidth: 2.35,
                  arrowSize: 13,
                  seed: `${uniqueId}_${tierId}_arc_0_1`,
                }
              ),
              // Bottom-Right -> Bottom-Left
              sketchCurvedArrow(
                cx + 105,
                cy + 225,
                cx,
                cy + 305,
                cx - 105,
                cy + 225,
                {
                  stroke: '#1e1e1e',
                  strokeWidth: 2.35,
                  arrowSize: 13,
                  seed: `${uniqueId}_${tierId}_arc_1_2`,
                }
              ),
              // Bottom-Left -> Top
              sketchCurvedArrow(
                cx - 335,
                cy + 152,
                cx - 385,
                cy - 65,
                cx - 192,
                cy - 245,
                {
                  stroke: '#1e1e1e',
                  strokeWidth: 2.35,
                  arrowSize: 13,
                  seed: `${uniqueId}_${tierId}_arc_2_0`,
                }
              ),
            ].join('')
          : orbitPos
              .map((pos, idx) => {
                const next = orbitPos[(idx + 1) % orbitPos.length];
                const midX = (pos.x + next.x) / 2 + (pos.y < next.y ? 110 : -110);
                const midY = (pos.y + next.y) / 2 + (pos.x > next.x ? 75 : -75);
                return sketchCurvedArrow(pos.x, pos.y, midX, midY, next.x, next.y, {
                  stroke: '#1e1e1e',
                  strokeWidth: 2.2,
                  arrowSize: 12.5,
                  seed: `${uniqueId}_${tierId}_arc_${idx}`,
                });
              })
              .join('');

      const orbitNodesSvg = orbitPos
        .map((pos, idx) => {
          const it = items[idx];
          const leafId = `${uniqueId}_${tierId}_leaf_${idx + 1}`;
          const fill = nodeFills[idx % nodeFills.length];
          const nodeBox = sketchRoundedBox(-188, -37, 376, 74, {
            fill,
            stroke: '#1e1e1e',
            strokeWidth: 1.95,
            rx: 14,
            seed: `${leafId}_orbit_box`,
            extraClass: `leaf-card-bg card-border-${palette.colorClass}`,
          });
          const dataAttrs = buildNodeDataAttrs({
            nodeId: leafId,
            tierBadge: meta.fullBadge,
            tierColor: palette.strokeColor,
            title: it.title,
            concept: it.subtitle || layer.layerTitle,
            specs: [
              { label: 'Chu trình', value: `${meta.fullBadge} (${loopRoleBadge})` },
              { label: 'Bước vòng lặp', value: `0${idx + 1}. ${it.title}` },
              { label: 'Cơ chế', value: it.subtitle || layer.connectorToNext || 'Tuần hoàn khép kín' },
            ],
            gotchas: layer.connectorToNext,
          });

          return `
            <g class="leaf-node-card mindmap-interactive-node" ${dataAttrs} transform="translate(${pos.x}, ${pos.y})" cursor="pointer">
              ${nodeBox}
              <rect x="-178" y="-23" width="4.5" height="46" rx="2" fill="${palette.strokeColor}" />
              <text x="-162" y="-4" text-anchor="start" class="leaf-svg-title">${escapeHtml(truncateLabel(it.title, 34))}</text>
              <text x="-162" y="19" text-anchor="start" class="leaf-svg-sub">${escapeHtml(truncateLabel(it.subtitle || layer.layerTitle, 48))}</text>
            </g>
          `;
        })
        .join('');

      return `
        <g class="mindmap-tier-branch branch-${palette.colorClass}" data-tier-id="${tierId}">
          ${centerIconSvg}
          <g class="branch-card-group" transform="translate(${cx}, ${cy + 18})">
            <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="${tierId}" ${buildNodeDataAttrs({
              nodeId: `${uniqueId}_${tierId}_root`,
              tierBadge: meta.fullBadge,
              tierColor: palette.strokeColor,
              title: layer.layerTitle,
              concept: items.map((x) => `${x.title}${x.subtitle ? `: ${x.subtitle}` : ''}`).join(' • '),
              gotchas: layer.connectorToNext,
            })} cursor="pointer">
              ${outerHalo}
              ${centerCard}
              <text x="0" y="-14" text-anchor="middle" font-size="11" font-weight="800" fill="${wingPalette.badgeText}" letter-spacing="0.6" class="sketch-node-badge">${escapeHtml(meta.fullBadge)} • ${escapeHtml(loopRoleBadge)}</text>
              <text x="0" y="8" text-anchor="middle" class="card-svg-title">${escapeHtml(meta.shortTitle)}</text>
              <text x="0" y="26" text-anchor="middle" class="card-svg-sub">${escapeHtml(meta.shortSub)}</text>
            </g>
            <g class="tier-toggle-badge badge-${palette.colorClass}" transform="translate(140, 0)" cursor="pointer" title="Đóng/Mở vòng lặp ${escapeHtml(meta.shortTitle)}">
              <circle cx="0" cy="0" r="11.5" fill="${palette.strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
              <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
            </g>
          </g>
          <g class="tier-sub-branches">
            ${loopArcsSvg}
            ${orbitNodesSvg}
          </g>
        </g>
      `;
    };

    const leftLoopSvg = renderCircularLoopGroup({
      layer: leftLoopLayer,
      tierIdx: 1,
      cx: 620,
      cy: 690,
      loopRoleBadge: 'INNER LOOP',
      iconKind: 'cpu',
      nodeFills: ['#d3f9d8', '#fff3bf', '#a5d8ff', '#ffd8a8'],
    });

    const rightLoopSvg = renderCircularLoopGroup({
      layer: rightLoopLayer,
      tierIdx: 2,
      cx: 1880,
      cy: 690,
      loopRoleBadge: 'OUTER LOOP',
      iconKind: 'cloud',
      nodeFills: ['#a5d8ff', '#e5dbff', '#ffc9c9', '#b2f2bb'],
    });

    // Cầu nối giữa 2 vòng lặp (Inner Loop -> Outer Loop Promotion/Escalation Bridge)
    const centerBridgeText = truncateLabel(
      leftLoopLayer.connectorToNext || 'Chuyển tiếp từ Vòng lặp trong sang Vòng lặp ngoài',
      58
    );
    const centerBridgeArrow = sketchCurvedArrow(790, 680, 1250, 565, 1710, 680, {
      stroke: '#1e1e1e',
      strokeWidth: 2.75,
      arrowSize: 14.5,
      label: centerBridgeText,
      labelOffsetY: -18,
      labelFontSize: 16.5,
      seed: `${uniqueId}_dual_center_bridge`,
    });

    // Vòng phản hồi nét đứt phía dưới nối ngược từ Outer Loop về Inner Loop
    const bottomFeedbackArrow = sketchCurvedArrow(1880, 965, 1250, 1135, 620, 965, {
      dashed: true,
      bidirectional: true,
      label: truncateLabel(
        `Vòng phản hồi & Kiểm soát bất biến xuyên chu trình (${topLayer.connectorToNext || rightLoopLayer.layerTitle})`,
        84
      ),
      labelOffsetY: 22,
      labelFontSize: 16,
      seed: `${uniqueId}_dual_bottom_feedback`,
    });

    return `
      ${tier1GroupSvg}
      ${centerBridgeArrow}
      ${bottomFeedbackArrow}
      ${leftLoopSvg}
      ${rightLoopSvg}
    `;
  };

  // ============================================================================
  // TOPOLOGY B: PIPELINE & FEEDBACK LOOP (Chuỗi Đường Ống Thực Thi & Vòng Thoát Lui)
  // Áp dụng cho: Bài 2 (c1-l2 V8 Frontend Parsing -> Ignition Bytecode & IC -> TurboFan JIT + OSR Bailout), c2-l3...
  // ============================================================================
  const renderPipelineFeedbackSvg = (): string => {
    const stageCount = layers.length;
    const stageXs =
      stageCount === 2
        ? [720, 1780]
        : stageCount === 3
          ? [450, 1250, 2050]
          : layers.map((_, idx) => Math.round(360 + (idx * 1780) / Math.max(1, stageCount - 1)));
    const spineY = 560;
    const stageIcons: Array<'laptop' | 'cpu' | 'layers' | 'cloud'> = ['laptop', 'cpu', 'layers', 'cloud'];

    // Mũi tên chuyển tiếp dọc theo trục ngang giữa các chặng Pipeline
    const stageConnectorsSvg = layers
      .slice(0, -1)
      .map((l, idx) => {
        const x1 = stageXs[idx] + 172;
        const x2 = stageXs[idx + 1] - 172;
        const midX = Math.round((x1 + x2) / 2);
        const connLabel = truncateLabel(l.connectorToNext || `Chuyển tiếp sang Chặng 0${idx + 2}`, 48);
        return sketchCurvedArrow(x1, spineY, midX, spineY - 26, x2, spineY, {
          stroke: '#1e1e1e',
          strokeWidth: 2.75,
          arrowSize: 14,
          label: connLabel,
          labelOffsetY: -18,
          labelFontSize: 15.5,
          seed: `${uniqueId}_pipe_conn_${idx}`,
        });
      })
      .join('');

    // Vòng phản hồi Tối ưu hóa phía trên (Top Speculative / Forward Loop) & Thoát lui phía dưới (Bottom Bailout Loop)
    const firstX = stageXs[0];
    const lastX = stageXs[stageXs.length - 1];
    const topPipelineLoop = sketchCurvedArrow(firstX, 145, 1250, 48, lastX, 145, {
      dashed: true,
      label: truncateLabel(
        `Luồng Tối ưu hóa Xuyên Chặng (End-to-End Pipeline): ${layers[0]?.connectorToNext || ''} → ${layers[layers.length - 2]?.connectorToNext || 'Thực thi đích'}`,
        92
      ),
      labelOffsetY: -16,
      labelFontSize: 16,
      seed: `${uniqueId}_pipe_top_loop`,
    });

    const bottomPipelineLoop = sketchCurvedArrow(
      lastX,
      975,
      1250,
      1090,
      stageXs[Math.max(0, stageXs.length - 2)],
      975,
      {
        dashed: true,
        bidirectional: true,
        label: truncateLabel(
          `Vòng Phản hồi & Thoát lui An toàn (Deoptimization / Backpressure Bailout Guard)`,
          88
        ),
        labelOffsetY: 22,
        labelFontSize: 16,
        seed: `${uniqueId}_pipe_bottom_loop`,
      }
    );

    const stagesSvg = layers
      .map((l, idx) => {
        const palette = tierPalettes[idx % tierPalettes.length];
        const wingPalette = WING_SKETCH_COLORS[palette.colorClass];
        const cx = stageXs[idx];
        const tierId = `t${idx + 1}`;
        const meta = extractTierTitles(l);
        const items =
          l.items.length > 0
            ? l.items
            : [{ title: l.layerTitle, subtitle: 'Thành phần trong chặng đường ống' }];

        const outerDashed = sketchRoundedBox(-174, -56, 348, 112, {
          fill: 'none',
          stroke: '#1e1e1e',
          strokeWidth: 1.65,
          rx: 20,
          dashed: true,
          seed: `${uniqueId}_${tierId}_pipe_halo`,
        });
        const stageCard = sketchRoundedBox(-162, -46, 324, 92, {
          fill: wingPalette.tierFill,
          stroke: '#1e1e1e',
          strokeWidth: 2.2,
          rx: 16,
          seed: `${uniqueId}_${tierId}_pipe_stage`,
          extraClass: `node-card-bg card-border-${palette.colorClass}`,
        });
        const stageIcon = sketchCenterIcon(
          stageIcons[idx % stageIcons.length],
          cx,
          spineY - 94,
          1.22
        );

        // Phân bổ các thẻ thành phần (Leaves) lên nửa trên (y=220, 335) và nửa dưới (y=775, 890) của Chặng
        const topItems = items.filter((_, i) => i % 2 === 0);
        const bottomItems = items.filter((_, i) => i % 2 === 1);

        const renderStageLeaves = (
          groupItems: typeof items,
          isTopGroup: boolean
        ): string =>
          groupItems
            .map((it, localIdx) => {
              const globalIdx = isTopGroup ? localIdx * 2 : localIdx * 2 + 1;
              const leafId = `${uniqueId}_${tierId}_leaf_${globalIdx + 1}`;
              const cardY = isTopGroup
                ? groupItems.length === 1
                  ? 285
                  : 215 + localIdx * 118
                : groupItems.length === 1
                  ? 830
                  : 775 + localIdx * 118;

              const anchorStartY = isTopGroup ? spineY - 56 : spineY + 56;
              const anchorEndY = isTopGroup ? cardY + 38 : cardY - 38;
              const ctrlX = cx + (localIdx % 2 === 0 ? -42 : 42);

              const arrowSvg = sketchCurvedArrow(
                cx,
                anchorStartY,
                ctrlX,
                Math.round((anchorStartY + anchorEndY) / 2),
                cx,
                anchorEndY,
                {
                  stroke: '#1e1e1e',
                  strokeWidth: 1.9,
                  arrowSize: 11,
                  seed: `${leafId}_pipe_arrow`,
                }
              );

              const leafBox = sketchRoundedBox(-215, -35, 430, 70, {
                fill: wingPalette.leafFill,
                stroke: '#1e1e1e',
                strokeWidth: 1.85,
                rx: 13,
                seed: `${leafId}_pipe_box`,
                extraClass: `leaf-card-bg card-border-${palette.colorClass}`,
              });

              const dataAttrs = buildNodeDataAttrs({
                nodeId: leafId,
                tierBadge: meta.fullBadge,
                tierColor: palette.strokeColor,
                title: it.title,
                concept: it.subtitle || l.layerTitle,
                specs: [
                  { label: 'Chặng Pipeline', value: `STAGE 0${idx + 1} (${meta.shortTitle})` },
                  { label: 'Cơ chế kỹ thuật', value: it.title },
                  { label: 'Đầu ra chặng', value: l.connectorToNext || 'Hoàn tất xử lý đích' },
                ],
                gotchas: l.connectorToNext,
              });

              return `
                ${arrowSvg}
                <g class="leaf-node-card mindmap-interactive-node" ${dataAttrs} transform="translate(${cx}, ${cardY})" cursor="pointer">
                  ${leafBox}
                  <rect x="-204" y="-22" width="4.5" height="44" rx="2" fill="${palette.strokeColor}" />
                  <text x="-188" y="-4" text-anchor="start" class="leaf-svg-title">${escapeHtml(truncateLabel(it.title, 38))}</text>
                  <text x="-188" y="18" text-anchor="start" class="leaf-svg-sub">${escapeHtml(truncateLabel(it.subtitle || l.layerTitle, 54))}</text>
                </g>
              `;
            })
            .join('');

        return `
          <g class="mindmap-tier-branch branch-${palette.colorClass}" data-tier-id="${tierId}">
            ${stageIcon}
            <g class="branch-card-group" transform="translate(${cx}, ${spineY})">
              <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="${tierId}" ${buildNodeDataAttrs({
                nodeId: `${uniqueId}_${tierId}_root`,
                tierBadge: meta.fullBadge,
                tierColor: palette.strokeColor,
                title: l.layerTitle,
                concept: items.map((x) => `${x.title}${x.subtitle ? `: ${x.subtitle}` : ''}`).join(' • '),
                gotchas: l.connectorToNext,
              })} cursor="pointer">
                ${outerDashed}
                ${stageCard}
                <text x="0" y="-16" text-anchor="middle" font-size="11.5" font-weight="800" fill="${wingPalette.badgeText}" letter-spacing="0.6" class="sketch-node-badge">STAGE 0${idx + 1} • ${escapeHtml(meta.fullBadge)}</text>
                <text x="0" y="7" text-anchor="middle" class="card-svg-title">${escapeHtml(meta.shortTitle)}</text>
                <text x="0" y="27" text-anchor="middle" class="card-svg-sub">${escapeHtml(meta.shortSub)}</text>
              </g>
              <g class="tier-toggle-badge badge-${palette.colorClass}" transform="translate(162, 0)" cursor="pointer" title="Đóng/Mở chặng ${escapeHtml(meta.shortTitle)}">
                <circle cx="0" cy="0" r="11.5" fill="${palette.strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
                <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
              </g>
            </g>
            <g class="tier-sub-branches">
              ${renderStageLeaves(topItems, true)}
              ${renderStageLeaves(bottomItems, false)}
            </g>
          </g>
        `;
      })
      .join('');

    return `
      ${topPipelineLoop}
      ${bottomPipelineLoop}
      ${stageConnectorsSvg}
      ${stagesSvg}
    `;
  };

  // ============================================================================
  // TOPOLOGY C: ORBITAL CYCLE & TAXONOMY TREE (Nối trực tiếp Tier -> Leaf, KHÔNG lặp hộp trung gian)
  // ============================================================================
  const renderDirectWingBranch = (params: {
    layer: EnrichedLayer;
    tierIdx: number;
    side: 'left' | 'right';
    hubExitY: number;
    cardY: number;
    leafSpanOverride?: number;
  }): string => {
    const { layer, tierIdx, side, hubExitY, cardY, leafSpanOverride } = params;
    const palette = tierPalettes[tierIdx % tierPalettes.length];
    const wingPalette = WING_SKETCH_COLORS[palette.colorClass];
    const tierId = `t${tierIdx + 1}`;
    const meta = extractTierTitles(layer);
    const items =
      layer.items.length > 0
        ? layer.items
        : [{ title: layer.layerTitle, subtitle: 'Thành phần kiến trúc cốt lõi' }];

    const span =
      leafSpanOverride ??
      Math.min(380, Math.max(150, (items.length - 1) * 145));
    const startY = cardY - span / 2;

    const cardCenterX = side === 'left' ? 930 : 1570;
    const hubExitX = side === 'left' ? 1100 : 1400;
    const cardEdgeHubX = side === 'left' ? cardCenterX + 125 : cardCenterX - 125;
    const forkX = side === 'left' ? 765 : 1735;

    const mainStemArrow = sketchCurvedArrow(
      hubExitX,
      hubExitY,
      Math.round((hubExitX + cardEdgeHubX) / 2),
      Math.round((hubExitY + cardY) / 2),
      cardEdgeHubX,
      cardY,
      {
        stroke: '#1e1e1e',
        strokeWidth: 2.4,
        arrowSize: 13.5,
        seed: `${uniqueId}_${tierId}_direct_stem`,
      }
    );

    const tierCardBox = sketchRoundedBox(-122, -46, 244, 92, {
      fill: wingPalette.tierFill,
      stroke: '#1e1e1e',
      strokeWidth: 2.15,
      rx: 16,
      seed: `${uniqueId}_${tierId}_direct_card`,
      extraClass: `node-card-bg card-border-${palette.colorClass}`,
    });

    const leavesSvg = items
      .map((it, itemIdx) => {
        const leafY =
          items.length === 1
            ? cardY
            : Math.round(startY + (itemIdx * span) / (items.length - 1));
        const leafId = `${uniqueId}_${tierId}_leaf_${itemIdx + 1}`;
        const boxW = 470;
        const boxH = 72;
        const boxX = side === 'left' ? 155 : 1875;
        const boxY = leafY - boxH / 2;
        const arrowTargetX = side === 'left' ? boxX + boxW + 6 : boxX - 6;

        const arrowToLeaf = sketchCurvedArrow(
          forkX,
          cardY,
          Math.round((forkX + arrowTargetX) / 2),
          Math.round((cardY + leafY) / 2),
          arrowTargetX,
          leafY,
          {
            stroke: '#1e1e1e',
            strokeWidth: 2,
            arrowSize: 11.5,
            seed: `${leafId}_direct_arrow`,
          }
        );

        const leafBox = sketchRoundedBox(0, 0, boxW, boxH, {
          fill: wingPalette.leafFill,
          stroke: '#1e1e1e',
          strokeWidth: 1.85,
          rx: 13,
          seed: `${leafId}_direct_box`,
          extraClass: `leaf-card-bg card-border-${palette.colorClass}`,
        });

        const dataAttrs = buildNodeDataAttrs({
          nodeId: leafId,
          tierBadge: meta.fullBadge,
          tierColor: palette.strokeColor,
          title: it.title,
          concept: it.subtitle || layer.connectorToNext || layer.layerTitle,
          specs: [
            { label: 'Phân tầng', value: `${meta.fullBadge} (${meta.shortTitle})` },
            { label: 'Thành phần', value: it.title },
            { label: 'Liên kết', value: layer.connectorToNext || 'Thực thi nội tầng' },
          ],
          gotchas: layer.connectorToNext,
        });

        const accentX = side === 'left' ? boxW - 12 : 8;
        const textX = side === 'left' ? 18 : 22;

        return `
          ${arrowToLeaf}
          <g class="leaf-node-card mindmap-interactive-node" ${dataAttrs} transform="translate(${boxX}, ${boxY})" cursor="pointer">
            ${leafBox}
            <rect x="${accentX}" y="13" width="4.5" height="46" rx="2" fill="${palette.strokeColor}" />
            <text x="${textX}" y="28" text-anchor="start" class="leaf-svg-title">${escapeHtml(truncateLabel(it.title, 40))}</text>
            <text x="${textX}" y="52" text-anchor="start" class="leaf-svg-sub">${escapeHtml(truncateLabel(it.subtitle || layer.connectorToNext || layer.layerTitle, 56))}</text>
          </g>
        `;
      })
      .join('');

    const toggleOffsetX = side === 'left' ? -122 : 122;
    const stemStartX = side === 'left' ? cardCenterX - 122 : cardCenterX + 122;

    return `
      <g class="mindmap-tier-branch branch-${palette.colorClass}" data-tier-id="${tierId}">
        ${mainStemArrow}
        <g class="branch-card-group" transform="translate(${cardCenterX}, ${cardY})">
          <g class="tier-card-trigger mindmap-interactive-node" data-tier-id="${tierId}" ${buildNodeDataAttrs({
            nodeId: `${uniqueId}_${tierId}_root`,
            tierBadge: meta.fullBadge,
            tierColor: palette.strokeColor,
            title: layer.layerTitle,
            concept: items.map((x) => `${x.title}${x.subtitle ? `: ${x.subtitle}` : ''}`).join(' • '),
            gotchas: layer.connectorToNext,
          })} cursor="pointer">
            ${tierCardBox}
            <text x="0" y="-17" text-anchor="middle" font-size="11.5" font-weight="800" fill="${wingPalette.badgeText}" letter-spacing="0.6" class="sketch-node-badge">${escapeHtml(meta.fullBadge)}</text>
            <text x="0" y="7" text-anchor="middle" class="card-svg-title">${escapeHtml(meta.shortTitle)}</text>
            <text x="0" y="27" text-anchor="middle" class="card-svg-sub">${escapeHtml(meta.shortSub)}</text>
          </g>
          <g class="tier-toggle-badge badge-${palette.colorClass}" transform="translate(${toggleOffsetX}, 0)" cursor="pointer" title="Đóng/Mở nhánh ${escapeHtml(meta.shortTitle)}">
            <circle cx="0" cy="0" r="11.5" fill="${palette.strokeColor}" stroke="#1e1e1e" stroke-width="1.8" />
            <text x="0" y="4" text-anchor="middle" font-size="13" font-weight="900" fill="#ffffff" class="toggle-text">−</text>
          </g>
        </g>
        <g class="tier-sub-branches">
          <path d="M ${stemStartX} ${cardY} L ${forkX} ${cardY}" stroke="#1e1e1e" stroke-width="2.2" stroke-linecap="round" fill="none" />
          <circle cx="${forkX}" cy="${cardY}" r="4.5" class="fork-joint-circle circle-${palette.colorClass}" stroke="#1e1e1e" stroke-width="2" />
          ${leavesSvg}
        </g>
      </g>
    `;
  };

  const renderOrbitalOrTaxonomySvg = (): string => {
    const shortHubTitle = truncateLabel(
      cleanedTitle
        .replace(/^Sơ đồ \d+:\s*/i, '')
        .replace(/^Bản Đồ Tầng Bậc Hệ Thống\s*/i, '')
        .replace(/\([^)]*\)/g, '')
        .trim() || 'System Architecture',
      22
    );

    const topFeedback = truncateLabel(
      layers[0]?.connectorToNext || 'Luồng điều phối & chuyển tiếp dữ liệu giữa các tầng',
      74
    );
    const bottomFeedback = truncateLabel(
      layers[1]?.connectorToNext ||
        layers[layers.length - 1]?.connectorToNext ||
        'Phản hồi trạng thái & đồng bộ sự kiện xuyên tầng',
      74
    );

    // Nếu bài có đúng 3 tầng (Orbital 3-Pillar): Cân đối 2 tầng bên trái (y=310, y=850) và 1 tầng lớn bên phải (y=580)
    if (layers.length === 3) {
      const leftTopWing = renderDirectWingBranch({
        layer: layers[0],
        tierIdx: 0,
        side: 'left',
        hubExitY: 555,
        cardY: 310,
      });
      const leftBottomWing = renderDirectWingBranch({
        layer: layers[1],
        tierIdx: 1,
        side: 'left',
        hubExitY: 605,
        cardY: 850,
      });
      const rightCenterWing = renderDirectWingBranch({
        layer: layers[2],
        tierIdx: 2,
        side: 'right',
        hubExitY: 580,
        cardY: 580,
        leafSpanOverride: 440,
      });

      const outerHubBox = sketchRoundedBox(-154, -52, 308, 104, {
        fill: 'none',
        stroke: '#1e1e1e',
        strokeWidth: 1.75,
        rx: 22,
        dashed: true,
        seed: `${uniqueId}_orbital_hub_outer`,
      });
      const innerHubBox = sketchRoundedBox(-140, -42, 280, 84, {
        fill: '#ffc9c9',
        stroke: '#1e1e1e',
        strokeWidth: 2.25,
        rx: 18,
        seed: `${uniqueId}_orbital_hub_inner`,
        extraClass: 'node-card-bg',
      });

      const arcTier1ToTier3 = sketchCurvedArrow(930, 245, 1250, 105, 1570, 515, {
        dashed: true,
        bidirectional: true,
        label: topFeedback,
        labelOffsetY: -18,
        labelFontSize: 16,
        seed: `${uniqueId}_orbital_top_arc`,
      });

      const arcTier2ToTier3 = sketchCurvedArrow(930, 915, 1250, 1055, 1570, 645, {
        dashed: true,
        bidirectional: true,
        label: bottomFeedback,
        labelOffsetY: 22,
        labelFontSize: 16,
        seed: `${uniqueId}_orbital_bottom_arc`,
      });

      return `
        ${arcTier1ToTier3}
        ${arcTier2ToTier3}
        ${sketchCenterIcon('layers', 1250, 420, 1.32)}
        ${sketchCenterIcon('cpu', 1250, 740, 1.32)}
        <g class="mindmap-hub mindmap-interactive-node" ${buildNodeDataAttrs({
          nodeId: `${uniqueId}_hub`,
          tierBadge: 'ORBITAL ARCHITECTURE',
          tierColor: '#e03131',
          title: cleanedTitle,
          concept: `Chu trình kiến trúc 3 trụ cột đồng bộ: ${layers.map((x) => x.layerTitle).join(' → ')}`,
          gotchas: topFeedback,
        })} transform="translate(1250, 580)" cursor="pointer">
          ${outerHubBox}
          ${innerHubBox}
          <text x="0" y="-4" text-anchor="middle" class="hub-svg-title">${escapeHtml(shortHubTitle)}</text>
          <text x="0" y="18" text-anchor="middle" class="hub-svg-sub">CHU TRÌNH 3 TẦNG ĐỒNG BỘ</text>
        </g>
        ${leftTopWing}
        ${leftBottomWing}
        ${rightCenterWing}
      `;
    }

    // Trường hợp >= 4 tầng (Taxonomy Tree)
    const branchesSvg = layers
      .map((l, idx) => {
        const isLeft = idx % 2 === 0;
        const isTop = idx < 2;
        const cardY = layers.length <= 2 ? 600 : isTop ? 320 : 880;
        const hubExitY = layers.length <= 2 ? 600 : isTop ? 580 : 620;
        return renderDirectWingBranch({
          layer: l,
          tierIdx: idx,
          side: isLeft ? 'left' : 'right',
          hubExitY,
          cardY,
        });
      })
      .join('');

    return `
      ${renderSketchHubAndFeedbackArcs({
        uniqueId,
        hubNodeId: `${uniqueId}_hub`,
        hubTitle: shortHubTitle,
        hubSub: `KIẾN TRÚC ${layers.length} TẦNG ĐỒNG BỘ`,
        topFeedbackLabel: topFeedback,
        bottomFeedbackLabel: bottomFeedback,
        topIcon: 'layers',
        bottomIcon: 'cpu',
        extraHubAttrs: buildNodeDataAttrs({
          nodeId: `${uniqueId}_hub`,
          tierBadge: 'SYSTEM TAXONOMY',
          tierColor: '#e03131',
          title: cleanedTitle,
          concept: `Bản đồ tổng thể kết nối ${layers.length} tầng kiến trúc: ${layers.map((x) => x.layerTitle).join(' → ')}`,
          gotchas: topFeedback,
        }),
      })}
      ${branchesSvg}
    `;
  };

  const mindmapSvgInner =
    topology === 'dual-cycle-loop'
      ? renderDualCycleSvg()
      : topology === 'pipeline-feedback-loop'
        ? renderPipelineFeedbackSvg()
        : renderOrbitalOrTaxonomySvg();

  const activeMeta = topologyMeta[topology];

  const filterChipsHtml = layers
    .map((l, idx) => {
      const palette = tierPalettes[idx % tierPalettes.length];
      const meta = extractTierTitles(l);
      return `<button type="button" class="mindmap-chip chip-${palette.colorClass}" data-filter="${palette.colorClass}"><span class="chip-dot"></span> ${escapeHtml(meta.fullBadge)}: ${escapeHtml(truncateLabel(meta.shortTitle, 18))}</button>`;
    })
    .join('');

  return `
    <div class="system-architecture-board" id="${uniqueId}" data-board-key="${uniqueId}" data-mindmap-topology="${topology}">
      <div class="arch-board-header">
        <div class="arch-title-wrap">
          <span class="arch-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </span>
          <div>
            <span class="arch-main-title">${escapeHtml(cleanedTitle)}</span>
            <span class="arch-subtitle">${escapeHtml(activeMeta.badge)} • ${layers.length} Tầng Kiến Trúc</span>
          </div>
        </div>
        <div class="arch-view-switcher">
          <button type="button" class="arch-tab-btn active" data-tab-target="radial">
            Sơ Đồ Tư Duy (Mindmap)
          </button>
          <button type="button" class="arch-tab-btn" data-tab-target="stack">
            Kiến Trúc Phân Tầng (Stack)
          </button>
        </div>
      </div>

      <!-- VIEW 1: KIẾN TRÚC PHÂN TẦNG -->
      <div class="arch-stack-container" style="display: none;">
        ${tiersHtml}
      </div>

      <!-- VIEW 2: SƠ ĐỒ TƯ DUY TƯƠNG TÁC ĐA TOPOLOGY THEO NỘI DUNG BÀI HỌC (EXCALIDRAW SKETCH DEFAULT) -->
      <div class="arch-radial-container" id="radial_${uniqueId}" data-board-id="${uniqueId}" style="display: flex;">
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
            <svg class="mindmap-master-svg excalidraw-sketch-svg" data-topology="${topology}" viewBox="${activeMeta.viewBox}" width="${activeMeta.width}" height="${activeMeta.height}" fill="none" xmlns="http://www.w3.org/2000/svg">
              ${mindmapSvgInner}
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
                <div class="spec-cell"><span class="spec-k">Topology:</span><span class="spec-v">${escapeHtml(activeMeta.badge)}</span></div>
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

