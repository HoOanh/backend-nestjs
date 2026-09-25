import { escapeHtml } from '../common/CodeViewer.tsx';
import { MINDMAP_KNOWLEDGE_BASE } from './knowledgeBase.ts';

declare global {
  interface Window {
    initMindMapControllers?: (root?: HTMLElement | Document | null) => () => void;
  }
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
    // Tránh re-init trùng lặp nếu chưa cleanup
    if (board.dataset.mindmapInit === 'true') return;
    board.dataset.mindmapInit = 'true';

    const tabBtns = board.querySelectorAll<HTMLButtonElement>('.arch-tab-btn');
    const stackContainer = board.querySelector<HTMLElement>('.arch-stack-container');
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

    // Các nút Tree Collapse/Expand
    const expandAllBtn = board.querySelector<HTMLElement>('.btn-expand-all');
    const collapseAllBtn = board.querySelector<HTMLElement>('.btn-collapse-all');

    // Các thành phần Deep Knowledge Inspector Drawer
    const inspectorDrawer = board.querySelector<HTMLElement>('.mindmap-inspector-drawer');
    const inspectorCloseBtn = board.querySelector<HTMLElement>('.inspector-close-btn');
    const inspectorTag = board.querySelector<HTMLElement>('.inspector-tier-tag');
    const inspectorTitle = board.querySelector<HTMLElement>('.inspector-title');
    const inspectorConcept = board.querySelector<HTMLElement>('.inspector-concept-text');
    const inspectorSpecs = board.querySelector<HTMLElement>('.inspector-specs-grid');
    const inspectorCode = board.querySelector<HTMLElement>('.inspector-code-content');
    const inspectorGotchas = board.querySelector<HTMLElement>('.inspector-gotchas-box');

    if (!viewport || !stage) return;

    let scale = 0.45;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

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
    };

    const fitToScreen = () => {
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const vpWidth = rect.width || viewport.clientWidth || 1000;
      const vpHeight = rect.height || viewport.clientHeight || 650;
      const svgWidth = 2400;
      const svgHeight = 1080;
      const scaleX = vpWidth / svgWidth;
      const scaleY = vpHeight / svgHeight;
      // Thu nhỏ vừa vặn 100% không bị tràn, với lề an toàn 90%
      scale = Math.max(0.22, Math.min(1.1, Math.min(scaleX, scaleY) * 0.90));
      panX = 0;
      panY = 0;
      updateTransform();
    };

    // ===== 0. TAB SWITCHER (Stack vs Radial Mindmap) =====
    const handleTabSwitch = (target: string) => {
      tabBtns.forEach((b) => {
        b.classList.toggle('active', b.dataset.tabTarget === target);
      });
      if (target === 'radial') {
        if (stackContainer) stackContainer.style.display = 'none';
        if (radialContainer) {
          radialContainer.style.display = 'flex';
          requestAnimationFrame(() => {
            fitToScreen();
            setTimeout(fitToScreen, 80);
          });
        }
      } else {
        if (stackContainer) stackContainer.style.display = 'flex';
        if (radialContainer) radialContainer.style.display = 'none';
      }
    };

    tabBtns.forEach((btn) => {
      const listener = () => {
        const target = btn.dataset.tabTarget || 'stack';
        handleTabSwitch(target);
      };
      btn.addEventListener('click', listener);
      cleanups.push(() => btn.removeEventListener('click', listener));
    });

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

    // Bắt sự kiện click vào các Node để hiển thị chi tiết
    const interactiveNodes = stage.querySelectorAll<SVGElement>('.mindmap-interactive-node');
    interactiveNodes.forEach((node) => {
      const onClick = (e: MouseEvent) => {
        e.stopPropagation();
        hideHint();
        const nodeId = node.dataset.nodeId;
        if (nodeId) {
          openInspector(nodeId, node);
        }
      };
      node.addEventListener('click', onClick);
      cleanups.push(() => node.removeEventListener('click', onClick));
    });

    if (inspectorCloseBtn) {
      inspectorCloseBtn.addEventListener('click', closeInspector);
      cleanups.push(() => inspectorCloseBtn.removeEventListener('click', closeInspector));
    }

    // ===== 2. COLLAPSIBLE BRANCHES LOGIC =====
    const toggleBadges = stage.querySelectorAll<SVGElement>('.tier-toggle-badge');
    toggleBadges.forEach((badge) => {
      const onToggle = (e: MouseEvent) => {
        e.stopPropagation();
        hideHint();
        const tierBranch = badge.closest<SVGElement>('.mindmap-tier-branch');
        if (!tierBranch) return;

        const isNowCollapsed = tierBranch.classList.toggle('is-collapsed');
        const textEl = badge.querySelector<SVGTextElement>('.toggle-text');
        if (textEl) {
          textEl.textContent = isNowCollapsed ? '+' : '−';
        }
      };
      badge.addEventListener('click', onToggle);
      cleanups.push(() => badge.removeEventListener('click', onToggle));
    });

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

    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', onExpandAll);
      cleanups.push(() => expandAllBtn.removeEventListener('click', onExpandAll));
    }

    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', onCollapseAll);
      cleanups.push(() => collapseAllBtn.removeEventListener('click', onCollapseAll));
    }

    // ===== 3. PAN & ZOOM GESTURES =====
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.mindmap-ctrl-btn, .mindmap-chip, .mindmap-inspector-drawer, .tier-toggle-badge, .mindmap-interactive-node')) {
        return;
      }
      isDragging = true;
      hasMoved = false;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      viewport.style.cursor = 'grabbing';
      hideHint();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX - panX;
      const dy = e.clientY - startY - panY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }
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

    const onZoomIn = () => {
      hideHint();
      scale = Math.min(2.5, scale + 0.12);
      updateTransform();
    };

    const onZoomOut = () => {
      hideHint();
      scale = Math.max(0.22, scale - 0.12);
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

    const toggleFullscreen = () => {
      const isFs = board.classList.toggle('is-fullscreen');
      if (fullscreenBtn) {
        fullscreenBtn.textContent = isFs ? '✕ Thu nhỏ' : '⛶ Toàn màn hình';
      }
      setTimeout(fitToScreen, 100);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectorDrawer && inspectorDrawer.classList.contains('is-open')) {
          closeInspector();
          return;
        }
        if (board.classList.contains('is-fullscreen')) {
          board.classList.remove('is-fullscreen');
          if (fullscreenBtn) fullscreenBtn.textContent = '⛶ Toàn màn hình';
          setTimeout(fitToScreen, 100);
        }
      }
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

    // ResizeObserver để tự động căn chỉnh khi kích thước thay đổi
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (radialContainer && radialContainer.style.display !== 'none' && !isDragging) {
          fitToScreen();
        }
      });
      resizeObserver.observe(viewport);
    }

    // Gắn sự kiện Viewport
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
      const chipListener = () => onChipClick(chip);
      chip.addEventListener('click', chipListener);
      cleanups.push(() => chip.removeEventListener('click', chipListener));
    });

    // Khởi tạo Fit To Screen ban đầu
    fitToScreen();
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
