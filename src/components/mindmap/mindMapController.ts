import { escapeHtml } from '../common/CodeViewer.tsx';
import { MINDMAP_KNOWLEDGE_BASE } from './knowledgeBase.ts';

declare global {
  interface Window {
    initMindMapControllers?: (root?: HTMLElement | Document | null) => () => void;
    __switchArchTab?: (btn: HTMLElement, target: 'stack' | 'radial') => void;
    __fitMindmapBoard?: (board: HTMLElement) => void;
  }
}

interface MindmapBoardState {
  activeTab: 'stack' | 'radial';
  scale: number;
  panX: number;
  panY: number;
  hasCustomTransform: boolean;
  activeFilter: string;
  collapsedTiers: Set<string>;
  collapsedSubs: Set<string>;
  selectedNodeId: string | null;
}

const boardStateStore = new Map<string, MindmapBoardState>();

function getOrCreateBoardState(board: HTMLElement): MindmapBoardState {
  const key = board.dataset.boardKey || board.id || 'default_arch_board';
  const existing = boardStateStore.get(key);
  if (existing) return existing;

  const created: MindmapBoardState = {
    activeTab: 'stack',
    scale: 0.48,
    panX: 0,
    panY: 0,
    hasCustomTransform: false,
    activeFilter: 'all',
    collapsedTiers: new Set<string>(),
    collapsedSubs: new Set<string>(),
    selectedNodeId: null,
  };
  boardStateStore.set(key, created);
  return created;
}

function getSvgDimensions(board: HTMLElement): { width: number; height: number } {
  const svg = board.querySelector<SVGSVGElement>('.mindmap-master-svg');
  if (svg) {
    const vb = svg.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { width: parts[2], height: parts[3] };
      }
    }
  }
  return { width: 2600, height: 1200 };
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
  if (vpWidth < 50 || vpHeight < 50) return;

  const { width: svgWidth, height: svgHeight } = getSvgDimensions(board);
  const scaleX = vpWidth / svgWidth;
  const scaleY = vpHeight / svgHeight;
  const scale = Math.max(0.22, Math.min(1.15, Math.min(scaleX, scaleY) * 0.94));
  const panX = 0;
  const panY = 0;

  stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  if (zoomLevelBtn) {
    zoomLevelBtn.textContent = `${Math.round(scale * 100)}%`;
  }

  board.dataset.mindmapScale = String(scale);
  board.dataset.mindmapPanX = '0';
  board.dataset.mindmapPanY = '0';

  const state = getOrCreateBoardState(board);
  state.scale = scale;
  state.panX = 0;
  state.panY = 0;
}

/**
 * Helper toàn cục chuyển đổi Tab: Kiến trúc phân tầng (Stack) vs Sơ đồ tư duy (Radial Mindmap)
 */
export function switchArchTab(btn: HTMLElement, target: 'stack' | 'radial') {
  const board = btn.closest<HTMLElement>('.system-architecture-board');
  if (!board) return;

  if (board.dataset.mindmapInit !== 'true') {
    initMindMapControllers(board);
  }

  const state = getOrCreateBoardState(board);
  state.activeTab = target;

  const stack = board.querySelector<HTMLElement>('.arch-stack-container');
  const radial = board.querySelector<HTMLElement>('.arch-radial-container');
  board.querySelectorAll<HTMLElement>('.arch-tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tabTarget === target);
  });

  if (target === 'radial') {
    if (stack) stack.style.display = 'none';
    if (radial) {
      radial.style.display = 'flex';
      requestAnimationFrame(() => {
        if (!state.hasCustomTransform) {
          fitMindmapBoard(board);
          setTimeout(() => {
            if (!state.hasCustomTransform) fitMindmapBoard(board);
          }, 60);
        } else {
          const stage = board.querySelector<HTMLElement>('.mindmap-stage');
          const zoomLevelBtn = board.querySelector<HTMLElement>('.btn-zoom-level');
          if (stage) {
            stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
          }
          if (zoomLevelBtn) {
            zoomLevelBtn.textContent = `${Math.round(state.scale * 100)}%`;
          }
        }
      });
    }
  } else {
    if (stack) stack.style.display = 'flex';
    if (radial) radial.style.display = 'none';
  }
}

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

  const boards: HTMLElement[] = [];
  if (
    typeof HTMLElement !== 'undefined' &&
    container instanceof HTMLElement &&
    container.classList.contains('system-architecture-board')
  ) {
    boards.push(container);
  }
  container.querySelectorAll<HTMLElement>('.system-architecture-board').forEach((b) => {
    if (!boards.includes(b)) {
      boards.push(b);
    }
  });

  const cleanups: Array<() => void> = [];

  boards.forEach((board) => {
    if (board.dataset.mindmapInit === 'true') return;
    board.dataset.mindmapInit = 'true';

    const state = getOrCreateBoardState(board);
    const stackContainer = board.querySelector<HTMLElement>('.arch-stack-container');
    const radialContainer = board.querySelector<HTMLElement>('.arch-radial-container');
    const viewport = board.querySelector<HTMLElement>('.mindmap-viewport');
    const stage = board.querySelector<HTMLElement>('.mindmap-stage');
    const zoomLevelBtn = board.querySelector<HTMLElement>('.btn-zoom-level');
    const hintBadge = board.querySelector<HTMLElement>('.mindmap-interaction-hint');
    const chips = board.querySelectorAll<HTMLButtonElement>('.mindmap-chip');

    const inspectorDrawer = board.querySelector<HTMLElement>('.mindmap-inspector-drawer');
    const inspectorTag = board.querySelector<HTMLElement>('.inspector-tier-tag');
    const inspectorTitle = board.querySelector<HTMLElement>('.inspector-title');
    const inspectorConcept = board.querySelector<HTMLElement>('.inspector-concept-text');
    const inspectorSpecs = board.querySelector<HTMLElement>('.inspector-specs-grid');
    const inspectorCode = board.querySelector<HTMLElement>('.inspector-code-content');
    const inspectorGotchas = board.querySelector<HTMLElement>('.inspector-gotchas-box');

    if (!viewport || !stage) return;

    let isDragging = false;
    let dragMoved = false;
    let startX = 0;
    let startY = 0;
    let pointerDownClientX = 0;
    let pointerDownClientY = 0;

    const hideHint = () => {
      if (hintBadge && hintBadge.style.display !== 'none') {
        hintBadge.style.opacity = '0';
        setTimeout(() => {
          if (hintBadge) hintBadge.style.display = 'none';
        }, 350);
      }
    };

    const applyTransform = (markCustom = true) => {
      if (markCustom) {
        state.hasCustomTransform = true;
      }
      stage.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
      if (zoomLevelBtn) {
        zoomLevelBtn.textContent = `${Math.round(state.scale * 100)}%`;
      }
      board.dataset.mindmapScale = String(state.scale);
      board.dataset.mindmapPanX = String(state.panX);
      board.dataset.mindmapPanY = String(state.panY);
    };

    const fitToScreen = (resetCustomFlag = false) => {
      if (resetCustomFlag) {
        state.hasCustomTransform = false;
      }
      fitMindmapBoard(board);
    };

    // ===== 1. DEEP KNOWLEDGE INSPECTOR LOGIC =====
    const openInspector = (nodeId: string, nodeEl?: SVGElement | HTMLElement | null) => {
      const data = MINDMAP_KNOWLEDGE_BASE[nodeId];
      if (!data || !inspectorDrawer) return;

      state.selectedNodeId = nodeId;

      if (inspectorTag) {
        inspectorTag.textContent = data.tierNumber;
        inspectorTag.style.borderColor = data.tierColor;
        inspectorTag.style.color = data.tierColor;
      }

      if (inspectorTitle) {
        inspectorTitle.textContent = data.nodeTitle;
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

      const targetEl =
        nodeEl || stage.querySelector<SVGElement>(`[data-node-id="${nodeId}"]`);
      if (targetEl) {
        targetEl.classList.add('is-selected-node');
      }

      inspectorDrawer.classList.add('is-open');
    };

    const closeInspector = () => {
      state.selectedNodeId = null;
      if (inspectorDrawer) {
        inspectorDrawer.classList.remove('is-open');
      }
      stage.querySelectorAll('.is-selected-node').forEach((el) => {
        el.classList.remove('is-selected-node');
      });
    };

    // ===== 2. COLLAPSIBLE BRANCHES LOGIC =====
    const syncCollapseDom = () => {
      const branches = stage.querySelectorAll<SVGElement>('.mindmap-tier-branch');
      branches.forEach((b) => {
        const tierId = b.dataset.tierId || '';
        const collapsed = state.collapsedTiers.has(tierId);
        b.classList.toggle('is-collapsed', collapsed);
        const textEl = b.querySelector<SVGTextElement>('.toggle-text');
        if (textEl) textEl.textContent = collapsed ? '+' : '−';
      });

      const subGroups = stage.querySelectorAll<SVGElement>('.sub-branch-group');
      subGroups.forEach((sg) => {
        const subId = sg.dataset.subId || '';
        const collapsed = state.collapsedSubs.has(subId);
        sg.classList.toggle('is-collapsed-sub', collapsed);
        const subTextEl = sg.querySelector<SVGTextElement>('.sub-toggle-text');
        if (subTextEl) subTextEl.textContent = collapsed ? '+' : '−';
      });
    };

    const onExpandAll = () => {
      hideHint();
      state.collapsedTiers.clear();
      state.collapsedSubs.clear();
      syncCollapseDom();
    };

    const onCollapseAll = () => {
      hideHint();
      stage.querySelectorAll<SVGElement>('.mindmap-tier-branch').forEach((b) => {
        if (b.dataset.tierId) state.collapsedTiers.add(b.dataset.tierId);
      });
      stage.querySelectorAll<SVGElement>('.sub-branch-group').forEach((sg) => {
        if (sg.dataset.subId) state.collapsedSubs.add(sg.dataset.subId);
      });
      syncCollapseDom();
    };

    const applyFilter = (filter: string) => {
      state.activeFilter = filter;
      chips.forEach((c) => {
        c.classList.toggle('active', (c.dataset.filter || 'all') === filter);
      });

      const branches = stage.querySelectorAll<SVGElement>('.mindmap-tier-branch');
      branches.forEach((b) => {
        if (filter === 'all') {
          b.classList.remove('is-dimmed', 'is-highlighted');
        } else if (b.classList.contains(`branch-${filter}`)) {
          b.classList.remove('is-dimmed');
          b.classList.add('is-highlighted');
          if (b.dataset.tierId && state.collapsedTiers.has(b.dataset.tierId)) {
            state.collapsedTiers.delete(b.dataset.tierId);
            syncCollapseDom();
          }
        } else {
          b.classList.add('is-dimmed');
          b.classList.remove('is-highlighted');
        }
      });
    };

    const toggleFullscreen = () => {
      const isFs = board.classList.toggle('is-fullscreen');
      const fullscreenBtn = board.querySelector<HTMLElement>('.btn-fullscreen');
      if (fullscreenBtn) {
        fullscreenBtn.textContent = isFs ? 'Thu nhỏ màn hình' : 'Toàn màn hình';
      }
      setTimeout(() => fitToScreen(true), 100);
    };

    // Restore persisted board state (survives Tutor Chat open/close & tab switches)
    syncCollapseDom();
    applyFilter(state.activeFilter);
    if (state.selectedNodeId) {
      openInspector(state.selectedNodeId);
    }
    if (state.activeTab === 'radial' && radialContainer) {
      if (stackContainer) stackContainer.style.display = 'none';
      radialContainer.style.display = 'flex';
      board.querySelectorAll<HTMLElement>('.arch-tab-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tabTarget === 'radial');
      });
      if (state.hasCustomTransform) {
        applyTransform(false);
      } else {
        requestAnimationFrame(() => fitToScreen(false));
      }
    }

    // ===== 3. ROBUST EVENT DELEGATION ON BOARD =====
    const onBoardClick = (e: MouseEvent) => {
      if (dragMoved) {
        dragMoved = false;
        return;
      }

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
        state.scale = Math.min(2.5, state.scale + 0.08);
        applyTransform(true);
        return;
      }

      // Zoom Out
      if (target.closest('.btn-zoom-out')) {
        hideHint();
        state.scale = Math.max(0.22, state.scale - 0.08);
        applyTransform(true);
        return;
      }

      // Zoom Reset / 100%
      if (target.closest('.btn-zoom-reset') || target.closest('.btn-zoom-level')) {
        hideHint();
        state.scale = 1.0;
        state.panX = 0;
        state.panY = 0;
        applyTransform(true);
        return;
      }

      // Zoom Fit
      if (target.closest('.btn-zoom-fit')) {
        hideHint();
        fitToScreen(true);
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
        applyFilter(chip.dataset.filter || 'all');
        return;
      }

      // Close inspector
      if (target.closest('.inspector-close-btn')) {
        closeInspector();
        return;
      }

      // Ignore clicks inside inspector drawer body
      if (target.closest('.mindmap-inspector-drawer')) {
        return;
      }

      // --- CẤP 2 TOGGLE BADGE: Đóng/mở nhánh con ---
      const subToggleBadge = target.closest<SVGElement>('.sub-toggle-badge');
      if (subToggleBadge) {
        hideHint();
        const subGroup = subToggleBadge.closest<SVGElement>('.sub-branch-group');
        if (subGroup && subGroup.dataset.subId) {
          const subId = subGroup.dataset.subId;
          if (state.collapsedSubs.has(subId)) {
            state.collapsedSubs.delete(subId);
          } else {
            state.collapsedSubs.add(subId);
          }
          syncCollapseDom();
        }
        return;
      }

      // --- CẤP 1 TOGGLE BADGE: Đóng/mở Tầng chính ---
      const tierBadge = target.closest<SVGElement>('.tier-toggle-badge');
      if (tierBadge) {
        hideHint();
        const tierBranch = tierBadge.closest<SVGElement>('.mindmap-tier-branch');
        if (tierBranch && tierBranch.dataset.tierId) {
          const tierId = tierBranch.dataset.tierId;
          if (state.collapsedTiers.has(tierId)) {
            state.collapsedTiers.delete(tierId);
          } else {
            state.collapsedTiers.add(tierId);
          }
          syncCollapseDom();
        }
        return;
      }

      // --- INTERACTIVE NODE CLICK (Hub, Tier Card, Sub-Branch Card, Leaf Card) ---
      const interactiveNode = target.closest<SVGElement>('[data-node-id]');
      if (interactiveNode) {
        hideHint();
        const nodeId = interactiveNode.getAttribute('data-node-id');
        if (nodeId) {
          // If clicking a collapsed Tier Card or Sub-Branch Card, also expand it so user sees its children
          const parentTier = interactiveNode.closest<SVGElement>('.mindmap-tier-branch');
          if (
            interactiveNode.classList.contains('tier-card-trigger') &&
            parentTier?.dataset.tierId &&
            state.collapsedTiers.has(parentTier.dataset.tierId)
          ) {
            state.collapsedTiers.delete(parentTier.dataset.tierId);
            syncCollapseDom();
          }
          const parentSub = interactiveNode.closest<SVGElement>('.sub-branch-group');
          if (
            interactiveNode.classList.contains('sub-node-card') &&
            parentSub?.dataset.subId &&
            state.collapsedSubs.has(parentSub.dataset.subId)
          ) {
            state.collapsedSubs.delete(parentSub.dataset.subId);
            syncCollapseDom();
          }

          openInspector(nodeId, interactiveNode);
        }
        return;
      }
    };

    board.addEventListener('click', onBoardClick);
    cleanups.push(() => board.removeEventListener('click', onBoardClick));

    // ===== 4. PAN & ZOOM GESTURES =====
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | SVGElement | null;
      if (
        target &&
        target.closest('.mindmap-ctrl-btn, .mindmap-chip, .mindmap-inspector-drawer')
      ) {
        return;
      }
      isDragging = true;
      dragMoved = false;
      pointerDownClientX = e.clientX;
      pointerDownClientY = e.clientY;
      startX = e.clientX - state.panX;
      startY = e.clientY - state.panY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - pointerDownClientX;
      const dy = e.clientY - pointerDownClientY;
      if (!dragMoved && Math.hypot(dx, dy) > 5) {
        dragMoved = true;
        viewport.style.cursor = 'grabbing';
        hideHint();
      }
      if (dragMoved) {
        state.panX = e.clientX - startX;
        state.panY = e.clientY - startY;
        applyTransform(true);
      }
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
      const rawDelta =
        e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
      const sensitivity = e.ctrlKey ? 0.004 : 0.0012;
      const zoomFactor = Math.max(-0.035, Math.min(0.035, -rawDelta * sensitivity));
      if (Math.abs(zoomFactor) < 0.0005) return;
      state.scale = Math.min(2.5, Math.max(0.22, state.scale + zoomFactor));
      applyTransform(true);
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
        dragMoved = false;
        pointerDownClientX = e.touches[0].clientX;
        pointerDownClientY = e.touches[0].clientY;
        startX = e.touches[0].clientX - state.panX;
        startY = e.touches[0].clientY - state.panY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialTouchScale = state.scale;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - pointerDownClientX;
        const dy = e.touches[0].clientY - pointerDownClientY;
        if (!dragMoved && Math.hypot(dx, dy) > 5) {
          dragMoved = true;
        }
        if (dragMoved) {
          e.preventDefault();
          state.panX = e.touches[0].clientX - startX;
          state.panY = e.touches[0].clientY - startY;
          applyTransform(true);
        }
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const rawRatio = dist / touchStartDist;
        const dampedRatio = 1 + (rawRatio - 1) * 0.65;
        state.scale = Math.min(2.5, Math.max(0.22, initialTouchScale * dampedRatio));
        applyTransform(true);
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
          if (fullscreenBtn) fullscreenBtn.textContent = 'Toàn màn hình';
          setTimeout(() => fitToScreen(false), 100);
        }
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (
          radialContainer &&
          radialContainer.style.display !== 'none' &&
          !isDragging &&
          !state.hasCustomTransform
        ) {
          fitToScreen(false);
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

    if (radialContainer && radialContainer.style.display !== 'none' && !state.hasCustomTransform) {
      fitToScreen(false);
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

if (typeof window !== 'undefined') {
  window.initMindMapControllers = initMindMapControllers;
}
