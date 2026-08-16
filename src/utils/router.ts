import { useState, useEffect, useCallback } from 'react';

export type AppRoute =
  | { type: 'lesson'; lessonId: string; tab: 'theory' | 'quiz' | 'code' }
  | { type: 'sprint-exam'; sprintId: number }
  | { type: 'final-exam' }
  | { type: 'admin'; subPath?: string }
  | { type: 'admin-login' }
  | { type: 'auth'; mode: 'login' | 'register' };

const ROUTE_CHANGE_EVENT = 'esmiles_route_change';

/**
 * Parse pathname and search string into strongly-typed AppRoute
 */
export function parseLocation(pathname: string, search: string): AppRoute {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(search);

  // 1. Admin Routes
  if (cleanPath === '/admin/login') {
    return { type: 'admin-login' };
  }
  if (cleanPath.startsWith('/admin')) {
    const sub = cleanPath.replace('/admin', '').replace(/^\//, '');
    return { type: 'admin', subPath: sub || undefined };
  }

  // 2. Auth Routes
  if (cleanPath === '/login') {
    return { type: 'auth', mode: 'login' };
  }
  if (cleanPath === '/register') {
    return { type: 'auth', mode: 'register' };
  }

  // 3. Final Exam Route
  if (cleanPath === '/final-exam' || cleanPath === '/graduation') {
    return { type: 'final-exam' };
  }

  // 4. Sprint Exam Routes: /sprint-exam/:sprintId or /sprints/:sprintId/exam
  const sprintExamMatch = cleanPath.match(/^\/(?:sprint-exam|sprints)\/(\d+)(?:\/exam)?$/);
  if (sprintExamMatch) {
    const sId = parseInt(sprintExamMatch[1], 10);
    return { type: 'sprint-exam', sprintId: isNaN(sId) ? 0 : sId };
  }

  // 5. Lesson Routes: /lessons/:lessonId or /lesson/:lessonId
  const lessonMatch = cleanPath.match(/^\/(?:lessons|lesson)\/([a-zA-Z0-9_-]+)$/);
  if (lessonMatch) {
    const lessonId = lessonMatch[1];
    const rawTab = searchParams.get('tab');
    const tab: 'theory' | 'quiz' | 'code' =
      rawTab === 'quiz' || rawTab === 'code' || rawTab === 'theory' ? rawTab : 'theory';
    return { type: 'lesson', lessonId, tab };
  }

  // 6. Default Root: First lesson
  const rawTab = searchParams.get('tab');
  const tab: 'theory' | 'quiz' | 'code' =
    rawTab === 'quiz' || rawTab === 'code' || rawTab === 'theory' ? rawTab : 'theory';
  return { type: 'lesson', lessonId: 'lesson-1', tab };
}

/**
 * Generate standard URL string from AppRoute
 */
export function getRouteUrl(route: AppRoute): string {
  switch (route.type) {
    case 'admin-login':
      return '/admin/login';
    case 'admin':
      return route.subPath ? `/admin/${route.subPath}` : '/admin';
    case 'auth':
      return route.mode === 'register' ? '/register' : '/login';
    case 'final-exam':
      return '/final-exam';
    case 'sprint-exam':
      return `/sprint-exam/${route.sprintId}`;
    case 'lesson':
      return `/lessons/${route.lessonId}${route.tab && route.tab !== 'theory' ? `?tab=${route.tab}` : ''}`;
  }
}

/**
 * Navigate to a URL path or AppRoute object
 */
export function navigateTo(target: string | AppRoute, replace = false): void {
  const url = typeof target === 'string' ? target : getRouteUrl(target);
  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
}

/**
 * Custom React Hook to subscribe to Route changes seamlessly
 */
export function useAppRouter() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    parseLocation(window.location.pathname, window.location.search)
  );

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(parseLocation(window.location.pathname, window.location.search));
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener(ROUTE_CHANGE_EVENT, handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleLocationChange);
    };
  }, []);

  const navigate = useCallback((target: string | AppRoute, replace = false) => {
    navigateTo(target, replace);
  }, []);

  return {
    route: currentRoute,
    pathname: window.location.pathname,
    search: window.location.search,
    navigate
  };
}
