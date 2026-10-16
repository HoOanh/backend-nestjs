import { escapeHtml } from '../common/CodeViewer.tsx';

/**
 * Excalidraw / Rough.js Hand-Drawn SVG Vector & Auto-Layout Engine
 * Sinh tự động các khối bo góc nét vẽ tay đôi (double-stroke sketchy rounded boxes),
 * mũi tên cong nét liền / nét đứt (curved & dashed feedback arrows), và icon vẽ tay.
 */

export type SketchColorKey =
  | 'blue'
  | 'green'
  | 'yellow'
  | 'pink'
  | 'purple'
  | 'peach'
  | 'mint';

export interface SketchPaletteItem {
  fill: string;
  stroke: string;
  accent: string;
  badgeText: string;
}

export const EXCALIDRAW_PALETTE: Record<SketchColorKey, SketchPaletteItem> = {
  blue: {
    fill: '#a5d8ff',
    stroke: '#1e1e1e',
    accent: '#1971c2',
    badgeText: '#1864ab',
  },
  green: {
    fill: '#b2f2bb',
    stroke: '#1e1e1e',
    accent: '#2f9e44',
    badgeText: '#2b8a3e',
  },
  yellow: {
    fill: '#ffec99',
    stroke: '#1e1e1e',
    accent: '#e67700',
    badgeText: '#d9480f',
  },
  pink: {
    fill: '#ffc9c9',
    stroke: '#1e1e1e',
    accent: '#e03131',
    badgeText: '#c92a2a',
  },
  purple: {
    fill: '#d0bfff',
    stroke: '#1e1e1e',
    accent: '#6741d9',
    badgeText: '#5f3dc4',
  },
  peach: {
    fill: '#ffd8a8',
    stroke: '#1e1e1e',
    accent: '#e8590c',
    badgeText: '#d9480f',
  },
  mint: {
    fill: '#96f2d7',
    stroke: '#1e1e1e',
    accent: '#099268',
    badgeText: '#087f5b',
  },
};

/**
 * Bộ sinh số giả ngẫu nhiên tất định (Deterministic Seeded PRNG - Mulberry32)
 * Giúp nét vẽ tay tự nhiên nhưng không bị nhấp nháy khi render lại.
 */
export function createSeededRng(seedInput: string | number): () => number {
  let h = 2166136261 >>> 0;
  const str = String(seedInput);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(rng: () => number, amount: number): number {
  return (rng() - 0.5) * 2 * amount;
}

function fmt(n: number): string {
  return Number(n.toFixed(1)).toString();
}

/**
 * Tách chuỗi văn bản thành nhiều dòng cân đối cho nút sơ đồ
 */
export function wrapSketchText(
  rawText: string,
  maxCharsPerLine = 18,
  maxLines = 3
): string[] {
  const explicitLines = rawText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result: string[] = [];

  for (const seg of explicitLines) {
    if (seg.length <= maxCharsPerLine) {
      result.push(seg);
      continue;
    }
    const words = seg.split(/\s+/);
    let current = '';
    for (const w of words) {
      if (!current) {
        current = w;
      } else if ((current + ' ' + w).length <= maxCharsPerLine) {
        current += ' ' + w;
      } else {
        result.push(current);
        current = w;
      }
    }
    if (current) {
      result.push(current);
    }
  }

  if (result.length > maxLines) {
    const kept = result.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] =
      last.length > maxCharsPerLine - 1
        ? `${last.slice(0, maxCharsPerLine - 1).trim()}…`
        : `${last}…`;
    return kept;
  }

  return result.length > 0 ? result : ['Node'];
}

export interface SketchBoxOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  roughness?: number;
  seed?: string | number;
  dashed?: boolean;
  extraClass?: string;
}

/**
 * Tạo đường dẫn SVG hình chữ nhật bo góc với độ lệch tay (Rough Rounded Rect Path)
 */
function buildRoughRoundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  roughness: number,
  rng: () => number
): string {
  const radius = Math.min(r, w / 2 - 2, h / 2 - 2);
  const j = (amp = roughness) => jitter(rng, amp);

  const tl1 = { x: x + j(1.1), y: y + radius + j(1.1) };
  const tl2 = { x: x + radius + j(1.1), y: y + j(1.1) };

  const tr1 = { x: x + w - radius + j(1.1), y: y + j(1.1) };
  const tr2 = { x: x + w + j(1.1), y: y + radius + j(1.1) };

  const br1 = { x: x + w + j(1.1), y: y + h - radius + j(1.1) };
  const br2 = { x: x + w - radius + j(1.1), y: y + h + j(1.1) };

  const bl1 = { x: x + radius + j(1.1), y: y + h + j(1.1) };
  const bl2 = { x: x + j(1.1), y: y + h - radius + j(1.1) };

  // Các điểm điều khiển trên 4 cạnh có độ cong nhẹ (bowing) giống Excalidraw
  const topMidX = x + w * 0.5 + j(2.5);
  const topMidY = y + j(1.6);

  const rightMidX = x + w + j(1.6);
  const rightMidY = y + h * 0.5 + j(2.5);

  const bottomMidX = x + w * 0.5 + j(2.5);
  const bottomMidY = y + h + j(1.6);

  const leftMidX = x + j(1.6);
  const leftMidY = y + h * 0.5 + j(2.5);

  return [
    `M ${fmt(tl2.x)} ${fmt(tl2.y)}`,
    `Q ${fmt(topMidX)} ${fmt(topMidY)} ${fmt(tr1.x)} ${fmt(tr1.y)}`,
    `Q ${fmt(x + w + j(0.9))} ${fmt(y + j(0.9))} ${fmt(tr2.x)} ${fmt(tr2.y)}`,
    `Q ${fmt(rightMidX)} ${fmt(rightMidY)} ${fmt(br1.x)} ${fmt(br1.y)}`,
    `Q ${fmt(x + w + j(0.9))} ${fmt(y + h + j(0.9))} ${fmt(br2.x)} ${fmt(br2.y)}`,
    `Q ${fmt(bottomMidX)} ${fmt(bottomMidY)} ${fmt(bl1.x)} ${fmt(bl1.y)}`,
    `Q ${fmt(x + j(0.9))} ${fmt(y + h + j(0.9))} ${fmt(bl2.x)} ${fmt(bl2.y)}`,
    `Q ${fmt(leftMidX)} ${fmt(leftMidY)} ${fmt(tl1.x)} ${fmt(tl1.y)}`,
    `Q ${fmt(x + j(0.9))} ${fmt(y + j(0.9))} ${fmt(tl2.x)} ${fmt(tl2.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Vẽ hộp bo góc phong cách Excalidraw (nền màu pastel hơi lệch + 2 lớp viền bút chì/marker đè nhau)
 */
export function sketchRoundedBox(
  x: number,
  y: number,
  w: number,
  h: number,
  options: SketchBoxOptions = {}
): string {
  const {
    fill = '#a5d8ff',
    stroke = '#1e1e1e',
    strokeWidth = 1.85,
    rx = 14,
    roughness = 1.4,
    seed = `${x}_${y}_${w}_${h}`,
    dashed = false,
    extraClass = '',
  } = options;

  const rng = createSeededRng(seed);

  // Lớp 1: Nền màu pastel lệch nhẹ 1px tạo hiệu ứng tô màu tay
  const fillPath = buildRoughRoundedRectPath(
    x + 0.8,
    y + 1.0,
    w - 1.2,
    h - 1.2,
    rx,
    roughness * 0.9,
    rng
  );

  // Lớp 2 & 3: Hai nét vẽ viền chồng lên nhau (Double-stroke Rough.js signature)
  const strokePath1 = buildRoughRoundedRectPath(x, y, w, h, rx, roughness, rng);
  const strokePath2 = buildRoughRoundedRectPath(
    x + jitter(rng, 0.7),
    y + jitter(rng, 0.7),
    w,
    h,
    rx,
    roughness * 1.15,
    rng
  );

  const dashAttr = dashed ? ' stroke-dasharray="7 5"' : '';
  const classAttr = extraClass ? ` class="${extraClass}"` : '';

  return [
    `<g${classAttr}>`,
    fill !== 'none'
      ? `<path d="${fillPath}" fill="${fill}" stroke="none" class="sketch-box-fill" />`
      : '',
    `<path d="${strokePath1}" fill="none" stroke="${stroke}" stroke-width="${fmt(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${dashAttr} class="sketch-box-stroke" />`,
    dashed
      ? ''
      : `<path d="${strokePath2}" fill="none" stroke="${stroke}" stroke-width="${fmt(strokeWidth * 0.78)}" stroke-opacity="0.82" stroke-linecap="round" stroke-linejoin="round" class="sketch-box-stroke-secondary" />`,
    `</g>`,
  ]
    .filter(Boolean)
    .join('');
}

/**
 * Vẽ hộp node Excalidraw hoàn chỉnh gồm cả nền pastel, viền đôi và chữ viết tay căn giữa
 */
export function sketchLabeledNode(params: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  subLabel?: string;
  badge?: string;
  color?: SketchColorKey;
  fill?: string;
  stroke?: string;
  fontSize?: number;
  rx?: number;
  seed?: string | number;
  nodeId?: string;
  extraAttrs?: string;
  extraClass?: string;
}): string {
  const {
    x,
    y,
    w,
    h,
    label,
    subLabel,
    badge,
    color = 'blue',
    fill,
    stroke,
    fontSize = 16.5,
    rx = 14,
    seed = `${label}_${x}_${y}`,
    nodeId,
    extraAttrs = '',
    extraClass = '',
  } = params;

  const palette = EXCALIDRAW_PALETTE[color] || EXCALIDRAW_PALETTE.blue;
  const boxFill = fill ?? palette.fill;
  const boxStroke = stroke ?? palette.stroke;

  const boxSvg = sketchRoundedBox(x, y, w, h, {
    fill: boxFill,
    stroke: boxStroke,
    rx,
    seed,
    extraClass: 'node-card-bg',
  });

  const hasBadge = Boolean(badge);
  const hasSub = Boolean(subLabel);
  const maxChars = Math.max(10, Math.floor((w - 22) / (fontSize * 0.52)));
  const lineHeight = fontSize * 1.24;
  const maxLabelLines = hasSub
    ? 2
    : Math.min(5, Math.max(3, Math.floor((h - 34) / lineHeight)));
  const lines = wrapSketchText(label, maxChars, maxLabelLines);
  const subMaxChars = Math.max(14, Math.floor((w - 18) / 6.2));
  const subLines = hasSub ? wrapSketchText(subLabel || '', subMaxChars, 2) : [];
  const totalTextH =
    lines.length * lineHeight + subLines.length * 14 + (hasBadge ? 14 : 0);
  let currentY = y + (h - totalTextH) / 2 + fontSize * 0.82;

  let badgeSvg = '';
  if (badge) {
    badgeSvg = `<text x="${fmt(x + w / 2)}" y="${fmt(currentY - 3)}" text-anchor="middle" class="sketch-node-badge" fill="${palette.badgeText}">${escapeHtml(badge)}</text>`;
    currentY += 15;
  }

  const labelSvg = lines
    .map((ln, idx) => {
      const ly = currentY + idx * lineHeight;
      return `<text x="${fmt(x + w / 2)}" y="${fmt(ly)}" text-anchor="middle" font-size="${fmt(fontSize)}" class="sketch-node-text">${escapeHtml(ln)}</text>`;
    })
    .join('');

  currentY += lines.length * lineHeight;

  let subSvg = '';
  if (subLabel) {
    subSvg = subLines
      .map((line, index) => `<text x="${fmt(x + w / 2)}" y="${fmt(currentY + 2 + index * 14)}" text-anchor="middle" class="sketch-node-sub">${escapeHtml(line)}</text>`)
      .join('');
  }

  const idAttr = nodeId ? ` data-node-id="${escapeHtml(nodeId)}"` : '';
  const cls = ['sketch-node-group', extraClass].filter(Boolean).join(' ');

  return `<g class="${cls}"${idAttr} ${extraAttrs}>${boxSvg}${badgeSvg}${labelSvg}${subSvg}</g>`;
}

export interface SketchArrowOptions {
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  label?: string;
  subLabel?: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
  labelColor?: string;
  labelFontSize?: number;
  arrowSize?: number;
  seed?: string | number;
  bidirectional?: boolean;
}

/**
 * Vẽ đầu mũi tên chữ V mở nét vẽ tay (Excalidraw open hand-drawn arrowhead)
 */
function buildRoughArrowhead(
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  size: number,
  stroke: string,
  strokeWidth: number,
  rng: () => number
): string {
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const spread = (27 * Math.PI) / 180;

  const leftAngle = angle + Math.PI - spread + jitter(rng, 0.04);
  const rightAngle = angle + Math.PI + spread + jitter(rng, 0.04);

  const lx = tipX + size * Math.cos(leftAngle) + jitter(rng, 0.8);
  const ly = tipY + size * Math.sin(leftAngle) + jitter(rng, 0.8);

  const rx = tipX + size * Math.cos(rightAngle) + jitter(rng, 0.8);
  const ry = tipY + size * Math.sin(rightAngle) + jitter(rng, 0.8);

  const midLx = (tipX + lx) / 2 + jitter(rng, 0.9);
  const midLy = (tipY + ly) / 2 + jitter(rng, 0.9);
  const midRx = (tipX + rx) / 2 + jitter(rng, 0.9);
  const midRy = (tipY + ry) / 2 + jitter(rng, 0.9);

  const d1 = `M ${fmt(lx)} ${fmt(ly)} Q ${fmt(midLx)} ${fmt(midLy)} ${fmt(tipX)} ${fmt(tipY)} Q ${fmt(midRx)} ${fmt(midRy)} ${fmt(rx)} ${fmt(ry)}`;
  const d2 = `M ${fmt(lx + jitter(rng, 0.7))} ${fmt(ly + jitter(rng, 0.7))} L ${fmt(tipX)} ${fmt(tipY)} L ${fmt(rx + jitter(rng, 0.7))} ${fmt(ry + jitter(rng, 0.7))}`;

  return [
    `<path d="${d1}" fill="none" stroke="${stroke}" stroke-width="${fmt(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" />`,
    `<path d="${d2}" fill="none" stroke="${stroke}" stroke-width="${fmt(strokeWidth * 0.75)}" stroke-opacity="0.8" stroke-linecap="round" stroke-linejoin="round" />`,
  ].join('');
}

/**
 * Vẽ mũi tên cong (Quadratic Bézier) nét liền hoặc nét đứt kèm nhãn chữ viết tay
 */
export function sketchCurvedArrow(
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  options: SketchArrowOptions = {}
): string {
  const {
    stroke = '#1e1e1e',
    strokeWidth = 1.85,
    dashed = false,
    label,
    subLabel,
    labelOffsetX = 0,
    labelOffsetY = 0,
    labelColor = '#1e1e1e',
    labelFontSize = 15,
    arrowSize = 12.5,
    seed = `${x1}_${y1}_${cx}_${cy}_${x2}_${y2}`,
    bidirectional = false,
  } = options;

  const rng = createSeededRng(seed);

  const path1 = `M ${fmt(x1 + jitter(rng, 0.6))} ${fmt(y1 + jitter(rng, 0.6))} Q ${fmt(cx + jitter(rng, 1.8))} ${fmt(cy + jitter(rng, 1.8))} ${fmt(x2 + jitter(rng, 0.6))} ${fmt(y2 + jitter(rng, 0.6))}`;
  const path2 = `M ${fmt(x1 + jitter(rng, 0.9))} ${fmt(y1 + jitter(rng, 0.9))} Q ${fmt(cx + jitter(rng, 2.2))} ${fmt(cy + jitter(rng, 2.2))} ${fmt(x2 + jitter(rng, 0.9))} ${fmt(y2 + jitter(rng, 0.9))}`;

  // Điểm tiếp tuyến gần đích (t = 0.88) để định hướng chính xác đầu mũi tên
  const t = 0.88;
  const nearEndX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
  const nearEndY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;

  const headEnd = buildRoughArrowhead(
    x2,
    y2,
    nearEndX,
    nearEndY,
    arrowSize,
    stroke,
    strokeWidth,
    rng
  );

  let headStart = '';
  if (bidirectional) {
    const ts = 0.12;
    const nearStartX =
      (1 - ts) * (1 - ts) * x1 + 2 * (1 - ts) * ts * cx + ts * ts * x2;
    const nearStartY =
      (1 - ts) * (1 - ts) * y1 + 2 * (1 - ts) * ts * cy + ts * ts * y2;
    headStart = buildRoughArrowhead(
      x1,
      y1,
      nearStartX,
      nearStartY,
      arrowSize,
      stroke,
      strokeWidth,
      rng
    );
  }

  let labelSvg = '';
  if (label) {
    // Đỉnh của đường cong Quadratic Bézier tại t = 0.5
    const midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2 + labelOffsetX;
    const midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2 + labelOffsetY;
    const lines = wrapSketchText(label, 28, 2);
    if (subLabel) {
      lines.push(subLabel);
    }
    const lh = labelFontSize * 1.2;
    const startLy = midY - ((lines.length - 1) * lh) / 2;

    labelSvg = lines
      .map((ln, idx) => {
        return `<text x="${fmt(midX)}" y="${fmt(startLy + idx * lh)}" text-anchor="middle" font-size="${fmt(labelFontSize)}" fill="${labelColor}" class="sketch-arrow-label">${escapeHtml(ln)}</text>`;
      })
      .join('');
  }

  return [
    `<g class="sketch-arrow-group">`,
    `<path d="${path1}" fill="none" stroke="${stroke}" stroke-width="${fmt(strokeWidth)}" stroke-linecap="round"${dashed ? ' stroke-dasharray="8 6"' : ''} class="sketch-arrow-shaft" />`,
    dashed
      ? ''
      : `<path d="${path2}" fill="none" stroke="${stroke}" stroke-width="${fmt(strokeWidth * 0.72)}" stroke-opacity="0.78" stroke-linecap="round" class="sketch-arrow-shaft-secondary" />`,
    headEnd,
    headStart,
    labelSvg,
    `</g>`,
  ]
    .filter(Boolean)
    .join('');
}

/**
 * Tính góc (độ) nơi đường tròn tâm (cx, cy) bán kính R cắt ra ngoài hộp (boxCx, boxCy, w, h)
 * Giúp các mũi tên chạy trên vòng tròn dừng cách mép hộp một khoảng thở tự nhiên như Excalidraw.
 */
export function computeCircleLoopArcArrow(params: {
  cx: number;
  cy: number;
  radius: number;
  fromDeg: number;
  toDeg: number;
  fromBoxW: number;
  fromBoxH: number;
  toBoxW: number;
  toBoxH: number;
  options?: SketchArrowOptions;
}): string {
  const {
    cx,
    cy,
    radius,
    fromDeg,
    toDeg,
    fromBoxW,
    fromBoxH,
    toBoxW,
    toBoxH,
    options = {},
  } = params;

  // Ước lượng góc chắn của hộp trên đường tròn bán kính R
  const fromHalfSpan = Math.max(fromBoxW, fromBoxH) * 0.44;
  const toHalfSpan = Math.max(toBoxW, toBoxH) * 0.44;

  const degGapFrom = Math.min(34, ((fromHalfSpan + 10) / radius) * (180 / Math.PI));
  const degGapTo = Math.min(34, ((toHalfSpan + 12) / radius) * (180 / Math.PI));

  // Chuẩn hóa khoảng góc theo chiều chuyển động ngắn nhất
  let delta = toDeg - fromDeg;
  while (delta <= -180) delta += 360;
  while (delta > 180) delta -= 360;

  const dir = delta >= 0 ? 1 : -1;
  const startDeg = fromDeg + dir * degGapFrom;
  const endDeg = fromDeg + delta - dir * degGapTo;
  const midDeg = (startDeg + endDeg) / 2;

  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const midRad = (midDeg * Math.PI) / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  // Điểm điều khiển Quadratic Bézier để đường cong bám đúng cung tròn bán kính R
  const halfAngleRad = (Math.abs(endDeg - startDeg) * Math.PI) / 360;
  const ctrlRadius = radius / Math.max(0.72, Math.cos(halfAngleRad));
  const ctrlX = cx + ctrlRadius * Math.cos(midRad);
  const ctrlY = cy + ctrlRadius * Math.sin(midRad);

  return sketchCurvedArrow(x1, y1, ctrlX, ctrlY, x2, y2, options);
}

/**
 * Vẽ các biểu tượng trung tâm nét vẽ tay (Laptop, Cloud, CPU, Database) giống hình mẫu Excalidraw
 */
export function sketchCenterIcon(
  kind: 'laptop' | 'cloud' | 'cpu' | 'layers',
  cx: number,
  cy: number,
  scale = 1,
  stroke = '#334155'
): string {
  const rng = createSeededRng(`icon_${kind}_${cx}_${cy}`);
  const j = (amp = 0.6) => jitter(rng, amp);

  if (kind === 'laptop') {
    // Biểu tượng Laptop vẽ tay giống hệt tâm vòng lặp trái trong ảnh mẫu
    return `
      <g transform="translate(${fmt(cx)}, ${fmt(cy)}) scale(${fmt(scale)})" class="sketch-center-icon">
        <!-- Khung màn hình ngoài -->
        <path d="M ${fmt(-32 + j())} ${fmt(-24 + j())} L ${fmt(32 + j())} ${fmt(-24 + j())} L ${fmt(32 + j())} ${fmt(14 + j())} L ${fmt(-32 + j())} ${fmt(14 + j())} Z" fill="#ffffff" fill-opacity="0.7" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M ${fmt(-32 + j())} ${fmt(-24 + j())} L ${fmt(32 + j())} ${fmt(-24 + j())} L ${fmt(32 + j())} ${fmt(14 + j())} L ${fmt(-32 + j())} ${fmt(14 + j())} Z" fill="none" stroke="${stroke}" stroke-width="1.1" stroke-opacity="0.7" stroke-linejoin="round" />
        <!-- Màn hình trong -->
        <path d="M -27 -19 L 27 -19 L 27 9 L -27 9 Z" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round" />
        <!-- Bàn phím hình thang -->
        <path d="M -32 14 L 32 14 L 42 25 L -42 25 Z" fill="#ffffff" fill-opacity="0.8" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M -42 25 L 42 25 L 42 28 L -42 28 Z" fill="none" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round" />
        <!-- Các hàng phím phác thảo -->
        <line x1="-29" y1="18" x2="29" y2="18" stroke="${stroke}" stroke-width="1" stroke-opacity="0.65" />
        <line x1="-33" y1="21" x2="33" y2="21" stroke="${stroke}" stroke-width="1" stroke-opacity="0.65" />
      </g>
    `;
  }

  if (kind === 'cloud') {
    // Biểu tượng Đám mây vẽ tay giống hệt tâm vòng lặp phải trong ảnh mẫu
    const cloudPath1 =
      'M -28 16 C -42 16, -46 -2, -32 -8 C -30 -22, -10 -26, 0 -16 C 10 -28, 32 -22, 32 -6 C 45 -4, 44 16, 28 16 Z';
    const cloudPath2 =
      'M -27 17 C -41 16, -45 -1, -31 -7 C -29 -21, -9 -25, 1 -15 C 11 -27, 31 -21, 33 -5 C 44 -3, 43 17, 27 17 Z';
    return `
      <g transform="translate(${fmt(cx)}, ${fmt(cy)}) scale(${fmt(scale)})" class="sketch-center-icon">
        <path d="${cloudPath1}" fill="#ffffff" fill-opacity="0.7" stroke="${stroke}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${cloudPath2}" fill="none" stroke="${stroke}" stroke-width="1.15" stroke-opacity="0.72" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    `;
  }

  if (kind === 'cpu') {
    return `
      <g transform="translate(${fmt(cx)}, ${fmt(cy)}) scale(${fmt(scale)})" class="sketch-center-icon">
        <rect x="-22" y="-22" width="44" height="44" rx="5" fill="#ffffff" fill-opacity="0.75" stroke="${stroke}" stroke-width="1.7" />
        <rect x="-12" y="-12" width="24" height="24" rx="2" fill="none" stroke="${stroke}" stroke-width="1.3" />
        <line x1="-10" y1="-30" x2="-10" y2="-22" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="0" y1="-30" x2="0" y2="-22" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="10" y1="-30" x2="10" y2="-22" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="-10" y1="22" x2="-10" y2="30" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="0" y1="22" x2="0" y2="30" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="10" y1="22" x2="10" y2="30" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="-30" y1="-10" x2="-22" y2="-10" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="-30" y1="0" x2="-22" y2="0" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="-30" y1="10" x2="-22" y2="10" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="22" y1="-10" x2="30" y2="-10" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="22" y1="0" x2="30" y2="0" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="22" y1="10" x2="30" y2="10" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" />
      </g>
    `;
  }

  return `
    <g transform="translate(${fmt(cx)}, ${fmt(cy)}) scale(${fmt(scale)})" class="sketch-center-icon">
      <polygon points="0,-20 26,-8 0,4 -26,-8" fill="#ffffff" fill-opacity="0.8" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" />
      <polyline points="-26,0 0,12 26,0" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      <polyline points="-26,8 0,20 26,8" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </g>
  `;
}
