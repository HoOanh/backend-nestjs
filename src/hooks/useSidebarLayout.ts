import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants/storage.ts';

export function useSidebarLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  });

  const [adminBypassLock, setAdminBypassLock] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ADMIN_BYPASS) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
      } catch {}
      return next;
    });
  };

  const toggleAdminBypass = () => {
    setAdminBypassLock((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.ADMIN_BYPASS, String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isSidebarCollapsed,
    toggleSidebar,
    adminBypassLock,
    toggleAdminBypass
  };
}
