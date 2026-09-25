import { escapeHtml } from '../common/CodeViewer.tsx';
import { MINDMAP_KNOWLEDGE_BASE } from './knowledgeBase.ts';

declare global {
  interface Window {
    initMindMapControllers?: (root?: HTMLElement | Document | null) => () => void;
    __switchArchTab?: (btn: HTMLElement, target: 'stack' | 'radial') => void;
    __fitMindmapBoard?: (board: HTMLElement) => void;
  }
}

/**
 * Hàm toàn cục thu phóng sơ đồ vừa vặn với kích thước màn hình
 */
export function fitMindmapBoard(board: HTMLElement) {
  const viewport = board.querySelector<HTMLElement>('.mindmap-viewport');
  const stage = board.querySelector<HTMLElement>('.mindmap-stage');
  const zoomLevelBtn = board.querySelector<HTMLElement>('.btn-zoom-level');
  if (!viewport || !stage) return;

  const rect = viewport.getBoundingClientRect();
  const vpWidth = rect.width || viewport.clientWidth || 1000;
  const vpHeight = rect.height || viewport.clientHeight || 700;
  const svgWidth = 2400;
  const svgHeight = 1080;
  const scaleX = vpWidth / svgWidth;
  const scaleY = vpHeight / svgHeight;
  // Fit 100% trong khung nhìn với lề an toàn 90%
  const scale = Math.max(0.22, Math.min(1.0, Math.min(scaleX, scaleY) * 0.90));
  const panX = 0;
  const panY = 0;

  stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  if (zoomLevelBtn) {
    zoomLevelBtn.textContent = `${Math.round(scale * 100)}%`;
  }

  // Lưu state vào dataset để controller tiếp tục tương tác từ vị trí này
  board.dataset.mindmapScale = String(scale);
  board.dataset.mindmapPanX = '0';
  board.dataset.mindmapPanY = '0';
}

/**
 * Helper toàn cục chuyển đổi Tab: Kiến trúc phân tầng (Stack) vs Sơ đồ tư duy (Radial Mindmap)
 */
export function switchArchTab(btn: HTMLElement, target: 'stack' | 'radial') {
  const board = btn.closest<HTMLElement>('.system-architecture-board');
  if (!board) return;

  const stack = board.querySelector<HTMLElement>('.arch-stack-container');
  const radial = board.querySelector<HTMLElement>('.arch-radial-container');
  board.querySelectorAll('.arch-tab-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');

  // Đảm bảo controller luôn được khởi tạo nếu chưa
  if (board.dataset.mindmapInit !== 'true') {
    initMindMapControllers(board);
  }

  if (target === 'radial') {
    if (stack) stack.style.display = 'none';
    if (radial) {
      radial.style.display = 'flex';
      // Gọi fit ngay khi tab mở ra
      requestAnimationFrame(() => {
        fitMindmapBoard(board);
        setTimeout(() => fitMindmapBoard(board), 60);
      });
    }
  } else {
    if (stack) stack.style.display = 'flex';
    if (radial) radial.style.display = 'none';
  }
}

// Gắn sẵn lên window để các nút inline HTML bấm được ngay lập tức
if (typeof window !== 'undefined') {
  window.__switchArchTab = switchArchTab;
  window.__fitMindmapBoard = fitMindmapBoard;
}

/**
 * Khởi tạo bộ điều khiển tương tác (Pan, Zoom, Fit, Fullscreen, Filter, Collapsible Trees & Deep Knowledge Inspector) cho Sơ đồ Mindmap
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
    const hintBadge = board.querySelector<HTMLElement>('.mindmap-interaction-hint');
    const chips = board.querySelectorAll<HTMLButtonElement>('.mindmap-chip');

    // Các thành phần Deep Knowledge Inspector Drawer
    const inspectorDrawer = board.querySelector<HTMLElement>('.mindmap-inspector-drawer');
    const inspectorTag = board.querySelector<HTMLElement>('.inspector-tier-tag');
    const inspectorTitle = board.querySelector<HTMLElement>('.inspector-title');
    const inspectorConcept = board.querySelector<HTMLElement>('.inspector-concept-text');
    const inspectorSpecs = board.querySelector<HTMLElement>('.inspector-specs-grid');
    const inspectorCode = board.querySelector<HTMLElement>('.inspector-code-content');
    const inspectorGotchas = board.querySelector<HTMLElement>('.inspector-gotchas-box');

    if (!viewport || !stage) return;

    let scale = parseFloat(board.dataset.mindmapScale || '0.45');
    let panX = parseFloat(board.dataset.mindmapPanX || '0');
    let panY = parseFloat(board.dataset.mindmapPanY || '0');
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const hideHint = () => {
      if (hintBadge && hintBadge.style.display !== 'none') {
        hintBadge.style.opacity = '0';
        setTimeout(() => {
          if (hintBadge) hintBadge.style.display = 'none';
        }, 350);
      }
    };

    const updateTransform = () => {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      if (zoomLevelBtn) {
        zoomLevelBtn.textContent = `${Math.round(scale * 100)}%`;
      }
      board.dataset.mindmapScale = String(scale);
      board.dataset.mindmapPanX = String(panX);
      board.dataset.mindmapPanY = String(panY);
    };

    const fitToScreen = () => {
      fitMindmapBoard(board);
      scale = parseFloat(board.dataset.mindmapScale || '0.45');
      panX = 0;
      panY = 0;
    };

    // ===== 1. DEEP KNOWLEDGE INSPECTOR LOGIC =====
    const openInspector = (nodeId: string, nodeEl?: SVGElement | HTMLElement | null) => {
      const data = MINDMAP_KNOWLEDGE_BASE[nodeId];
      if (!data || !inspectorDrawer) return;

      if (inspectorTag) {
        inspectorTag.textContent = data.tierNumber;
        inspectorTag.style.borderColor = data.tierColor;
        inspectorTag.style.color = data.tierColor;
      }

      if (inspectorTitle) {
        inspectorTitle.textContent = `${data.icon} ${data.nodeTitle}`;
      }

      if (inspectorConcept) {
        inspectorConcept.textContent = data.concept;
      }

      if (inspectorSpecs) {
        inspectorSpecs.innerHTML = data.specs
          .map(
            (s) => `
              <div class="spec-cell">
                <span class="spec-k">${escapeHtml(s.label)}:</span>
                <span class="spec-v">${escapeHtml(s.value)}</span>
              </div>
            `
          )
          .join('');
      }

      if (inspectorCode) {
        inspectorCode.textContent = data.codeSnippet;
      }

      if (inspectorGotchas) {
        inspectorGotchas.textContent = data.gotchas;
      }

      stage.querySelectorAll('.is-selected-node').forEach((el) => {
        el.classList.remove('is-selected-node');
      });

      if (nodeEl) {
        nodeEl.classList.add('is-selected-node');
      }

      inspectorDrawer.classList.add('is-open');
    };

    const closeInspector = () => {
      if (inspectorDrawer) {
        inspectorDrawer.classList.remove('is-open');
      }
      stage.querySelectorAll('.is-selected-node').forEach((el) => {
        el.classList.remove('is-selected-node');
      });
    };

    // ===== 2. COLLAPSIBLE BRANCHES LOGIC =====
    const onExpandAll = () => {
      hideHint();
      const branches = stage.querySelectorAll<SVGElement>('.mindmap-tier-branch');
      branches.forEach((b) => {
        b.classList.remove('is-collapsed');
        const textEl = b.querySelector<SVGTextElement>('.toggle-text');
        if (textEl) textEl.textContent = '−';
      });
    };

    const onCollapseAll = () => {
      hideHint();
      const branches = stage.querySelectorAll<SVGElement>('.mindmap-tier-branch');
      branches.forEach((b) => {
        b.classList.add('is-collapsed');
        const textEl = b.querySelector<SVGTextElement>('.toggle-text');
        if (textEl) textEl.textContent = '+';
      });
    };

    const onChipClick = (chip: HTMLButtonElement) => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.filter || 'all';

      const branches = stage.querySelectorAll<SVGElement>('.mindmap-tier-branch');
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

    const toggleFullscreen = () => {
      const isFs = board.classList.toggle('is-fullscreen');
      const fullscreenBtn = board.querySelector<HTMLElement>('.btn-fullscreen');
      if (fullscreenBtn) {
        fullscreenBtn.textContent = isFs ? '✕ Thu nhỏ' : '⛶ Toàn màn hình';
      }
      setTimeout(fitToScreen, 100);
    };

    // ===== 3. ROBUST EVENT DELEGATION ON BOARD (KHÔNG BAO GIỜ BỊ MẤT SỰ KIỆN) =====
    const onBoardClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | SVGElement | null;
      if (!target) return;

      // Tab switcher
      const tabBtn = target.closest<HTMLButtonElement>('.arch-tab-btn');
      if (tabBtn) {
        const t = tabBtn.dataset.tabTarget as 'stack' | 'radial';
        if (t) switchArchTab(tabBtn, t);
        return;
      }

      // Zoom In
      if (target.closest('.btn-zoom-in')) {
        hideHint();
        scale = Math.min(2.5, scale + 0.12);
        updateTransform();
        return;
      }

      // Zoom Out
      if (target.closest('.btn-zoom-out')) {
        hideHint();
        scale = Math.max(0.22, scale - 0.12);
        updateTransform();
        return;
      }

      // Zoom Reset
      if (target.closest('.btn-zoom-reset') || target.closest('.btn-zoom-level')) {
        hideHint();
        scale = 1.0;
        panX = 0;
        panY = 0;
        updateTransform();
        return;
      }

      // Zoom Fit
      if (target.closest('.btn-zoom-fit')) {
        hideHint();
        fitToScreen();
        return;
      }

      // Fullscreen
      if (target.closest('.btn-fullscreen')) {
        toggleFullscreen();
        return;
      }

      // Expand all
      if (target.closest('.btn-expand-all')) {
        onExpandAll();
        return;
      }

      // Collapse all
      if (target.closest('.btn-collapse-all')) {
        onCollapseAll();
        return;
      }

      // Category chip
      const chip = target.closest<HTMLButtonElement>('.mindmap-chip');
      if (chip) {
        onChipClick(chip);
        return;
      }

      // Close inspector
      if (target.closest('.inspector-close-btn')) {
        closeInspector();
        return;
      }

      // Interactive node
      const node = target.closest<SVGElement>('.mindmap-interactive-node');
      if (node) {
        hideHint();
        const nodeId = node.dataset.nodeId;
        if (nodeId) openInspector(nodeId, node);
        return;
      }

      // Toggle badge [−]/[+]
      const badge = target.closest<SVGElement>('.tier-toggle-badge');
      if (badge) {
        hideHint();
        const tierBranch = badge.closest<SVGElement>('.mindmap-tier-branch');
        if (tierBranch) {
          const isNowCollapsed = tierBranch.classList.toggle('is-collapsed');
          const textEl = badge.querySelector<SVGTextElement>('.toggle-text');
          if (textEl) {
            textEl.textContent = isNowCollapsed ? '+' : '−';
          }
        }
        return;
      }
    };

    board.addEventListener('click', onBoardClick);
    cleanups.push(() => board.removeEventListener('click', onBoardClick));

    // ===== 4. PAN & ZOOM GESTURES =====
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | SVGElement | null;
      if (
        target &&
        target.closest(
          '.mindmap-ctrl-btn, .mindmap-chip, .mindmap-inspector-drawer, .tier-toggle-badge, .mindmap-interactive-node'
        )
      ) {
        return;
      }
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

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.mindmap-inspector-drawer')) return;
      e.preventDefault();
      hideHint();
      const zoomFactor = e.deltaY < 0 ? 0.08 : -0.08;
      scale = Math.min(2.5, Math.max(0.22, scale + zoomFactor));
      updateTransform();
    };

    // Touch Support
    let touchStartDist = 0;
    let initialTouchScale = 1;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.mindmap-ctrl-btn, .mindmap-chip, .mindmap-inspector-drawer')) return;
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
        scale = Math.min(2.5, Math.max(0.22, initialTouchScale * ratio));
        updateTransform();
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
      touchStartDist = 0;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectorDrawer && inspectorDrawer.classList.contains('is-open')) {
          closeInspector();
          return;
        }
        if (board.classList.contains('is-fullscreen')) {
          board.classList.remove('is-fullscreen');
          const fullscreenBtn = board.querySelector<HTMLElement>('.btn-fullscreen');
          if (fullscreenBtn) fullscreenBtn.textContent = '⛶ Toàn màn hình';
          setTimeout(fitToScreen, 100);
        }
      }
    };

    // ResizeObserver tự động căn chỉnh
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (radialContainer && radialContainer.style.display !== 'none' && !isDragging) {
          fitToScreen();
        }
      });
      resizeObserver.observe(viewport);
    }

    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKeyDown);

    // Tự động fit ban đầu nếu radialContainer đang hiển thị
    if (radialContainer && radialContainer.style.display !== 'none') {
      fitToScreen();
    }

    cleanups.push(() => {
      viewport.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      if (resizeObserver) resizeObserver.disconnect();
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
