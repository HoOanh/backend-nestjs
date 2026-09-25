import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants/storage.ts';
import { LAYOUT_CONSTANTS } from '../constants/layout.ts';
import type { TutorDisplayMode } from '../types/layout.ts';

export function useTutorLayout() {
  const [isTutorOpen, setIsTutorOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.TUTOR_OPEN) === 'true';
    } catch {
      return false;
    }
  });

  const [tutorMode, setTutorMode] = useState<TutorDisplayMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TUTOR_MODE);
      if (saved === 'docked' || saved === 'floating') return saved;
    } catch {}
    return 'floating';
  });

  const [isTutorExpanded, setIsTutorExpanded] = useState<boolean>(false);

  const [dockedTutorWidth, setDockedTutorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TUTOR_DOCK_WIDTH);
      const parsed = saved ? parseInt(saved, 10) : LAYOUT_CONSTANTS.DEFAULT_DOCK_WIDTH;
      return !isNaN(parsed) &&
        parsed >= LAYOUT_CONSTANTS.MIN_DOCK_WIDTH &&
        parsed <= LAYOUT_CONSTANTS.MAX_DOCK_WIDTH
        ? parsed
        : LAYOUT_CONSTANTS.DEFAULT_DOCK_WIDTH;
    } catch {
      return LAYOUT_CONSTANTS.DEFAULT_DOCK_WIDTH;
    }
  });

  const toggleTutor = () => {
    setIsTutorOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.TUTOR_OPEN, String(next));
      } catch {}
      return next;
    });
  };

  const switchTutorMode = (newMode: TutorDisplayMode) => {
    setTutorMode(newMode);
    try {
      localStorage.setItem(STORAGE_KEYS.TUTOR_MODE, newMode);
    } catch {}
  };

  const handleResizeDockStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = dockedTutorWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX; // drag left expands width
      const nextWidth = Math.max(
        LAYOUT_CONSTANTS.MIN_DOCK_WIDTH,
        Math.min(LAYOUT_CONSTANTS.MAX_DOCK_WIDTH, startWidth + deltaX)
      );
      setDockedTutorWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDockedTutorWidth((current) => {
        try {
          localStorage.setItem(STORAGE_KEYS.TUTOR_DOCK_WIDTH, String(current));
        } catch {}
        return current;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleTutor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isTutorOpen,
    setIsTutorOpen,
    tutorMode,
    switchTutorMode,
    isTutorExpanded,
    setIsTutorExpanded,
    dockedTutorWidth,
    handleResizeDockStart,
    toggleTutor
  };
}
