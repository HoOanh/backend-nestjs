import { useState, useEffect, useCallback } from 'react';

export type AppRoute =
  | { type: 'courses-hub'; viewTab?: 'overview' | 'roadmaps' | 'catalog' }
  | { type: 'ai-classroom'; courseId: string; lessonId: string }
  | { type: 'lesson'; courseId?: string; lessonId: string; tab: 'theory' | 'quiz' | 'code' }
  | { type: 'sprint-exam'; courseId?: string; sprintId: number }
  | { type: 'final-exam'; courseId?: string }
  | { type: 'admin'; subPath?: string }
  | { type: 'admin-login' }
  | { type: 'auth'; mode: 'login' | 'register' };

export function adminReturnTo(search: string): string {
  const candidate = new URLSearchParams(search).get('returnTo') || '';
  return /^\/admin(?:\/(?:overview|users|certificates|plans|curriculum|logs|trace|ai|database))?(?:\?[^\r\n]*)?$/.test(
    candidate
  ) && !candidate.includes('\\')
    ? candidate
    : '/admin';
}

const ROUTE_CHANGE_EVENT = 'arc_route_change';

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
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
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

  // 3. Dedicated 1-on-1 AI Classroom Routes:
  // /ai-classroom/:courseId/:lessonId or /ai-classroom/:lessonId
  const aiClassroomTwoPart = cleanPath.match(
    /^\/ai-classroom\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/
  );
  if (aiClassroomTwoPart) {
    return {
      type: 'ai-classroom',
      courseId: aiClassroomTwoPart[1],
      lessonId: aiClassroomTwoPart[2]
    };
  }
  const aiClassroomOnePart = cleanPath.match(/^\/ai-classroom\/([a-zA-Z0-9_-]+)$/);
  if (aiClassroomOnePart) {
    return {
      type: 'ai-classroom',
      courseId: 'backend-nestjs',
      lessonId: aiClassroomOnePart[1]
    };
  }

  // 4. Learning Hub / Course Catalog / Career Roadmaps
  if (
    cleanPath === '/' ||
    cleanPath === '/courses' ||
    cleanPath === '/hub' ||
    cleanPath === '/roadmaps' ||
    cleanPath === '/roadmap'
  ) {
    const rawView = searchParams.get('view');
    const viewTab: 'overview' | 'roadmaps' | 'catalog' =
      cleanPath === '/roadmaps' || cleanPath === '/roadmap' || rawView === 'roadmaps'
        ? 'roadmaps'
        : rawView === 'catalog'
          ? 'catalog'
          : 'overview';
    return { type: 'courses-hub', viewTab };
  }

  // 5. Course-Scoped Final Exam: /courses/:courseId/final-exam or /final-exam
  const courseFinalMatch = cleanPath.match(
    /^\/courses\/([a-zA-Z0-9_-]+)\/(?:final-exam|graduation)$/
  );
  if (courseFinalMatch) {
    return { type: 'final-exam', courseId: courseFinalMatch[1] };
  }
  if (cleanPath === '/final-exam' || cleanPath === '/graduation') {
    return { type: 'final-exam', courseId: 'backend-nestjs' };
  }

  // 6. Course-Scoped Sprint Exam: /courses/:courseId/sprint-exam/:sprintId or /sprint-exam/:sprintId
  const courseSprintMatch = cleanPath.match(
    /^\/courses\/([a-zA-Z0-9_-]+)\/(?:sprint-exam|sprints)\/(\d+)(?:\/exam)?$/
  );
  if (courseSprintMatch) {
    const sId = parseInt(courseSprintMatch[2], 10);
    return {
      type: 'sprint-exam',
      courseId: courseSprintMatch[1],
      sprintId: isNaN(sId) ? 0 : sId
    };
  }
  const sprintExamMatch = cleanPath.match(
    /^\/(?:sprint-exam|sprints)\/(\d+)(?:\/exam)?$/
  );
  if (sprintExamMatch) {
    const sId = parseInt(sprintExamMatch[1], 10);
    return { type: 'sprint-exam', courseId: 'backend-nestjs', sprintId: isNaN(sId) ? 0 : sId };
  }

  // 7. Course-Scoped Lesson Route: /courses/:courseId/lessons/:lessonId
  const courseLessonMatch = cleanPath.match(
    /^\/courses\/([a-zA-Z0-9_-]+)\/(?:lessons|lesson)\/([a-zA-Z0-9_-]+)$/
  );
  if (courseLessonMatch) {
    const courseId = courseLessonMatch[1];
    const rawId = courseLessonMatch[2];
    const lessonId = rawId === 'lesson-1' ? 'c1-l1' : rawId;
    const rawTab = searchParams.get('tab');
    const tab: 'theory' | 'quiz' | 'code' =
      rawTab === 'quiz' || rawTab === 'code' || rawTab === 'theory'
        ? rawTab
        : 'theory';
    return { type: 'lesson', courseId, lessonId, tab };
  }

  // 8. Legacy Lesson Routes: /lessons/:lessonId or /lesson/:lessonId
  const lessonMatch = cleanPath.match(
    /^\/(?:lessons|lesson)\/([a-zA-Z0-9_-]+)$/
  );
  if (lessonMatch) {
    const rawId = lessonMatch[1];
    const lessonId = rawId === 'lesson-1' ? 'c1-l1' : rawId;
    const rawTab = searchParams.get('tab');
    const tab: 'theory' | 'quiz' | 'code' =
      rawTab === 'quiz' || rawTab === 'code' || rawTab === 'theory'
        ? rawTab
        : 'theory';
    return { type: 'lesson', lessonId, tab };
  }

  // 9. Fallback to Learning Hub
  return { type: 'courses-hub', viewTab: 'overview' };
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
    case 'courses-hub':
      return route.viewTab && route.viewTab !== 'overview'
        ? `/courses?view=${route.viewTab}`
        : '/courses';
    case 'ai-classroom':
      return `/ai-classroom/${route.courseId}/${route.lessonId}`;
    case 'final-exam':
      return route.courseId && route.courseId !== 'backend-nestjs'
        ? `/courses/${route.courseId}/final-exam`
        : '/final-exam';
    case 'sprint-exam':
      return route.courseId && route.courseId !== 'backend-nestjs'
        ? `/courses/${route.courseId}/sprint-exam/${route.sprintId}`
        : `/sprint-exam/${route.sprintId}`;
    case 'lesson': {
      const tabQuery = route.tab && route.tab !== 'theory' ? `?tab=${route.tab}` : '';
      return route.courseId
        ? `/courses/${route.courseId}/lessons/${route.lessonId}${tabQuery}`
        : `/lessons/${route.lessonId}${tabQuery}`;
    }
  }
}

/**
 * Navigate to a URL path or AppRoute object
 */
export function navigateTo(target: string | AppRoute, replace = false): void {
  const url = typeof target === 'string' ? target : getRouteUrl(target);
  const targetPath = new URL(url, window.location.href).pathname;
  const isEnteringClassroom =
    targetPath.startsWith('/ai-classroom/') &&
    !window.location.pathname.startsWith('/ai-classroom/');

  // Cross-origin isolation is established by response headers, so an SPA
  // pushState from the regular app shell cannot enable threaded WASM. Load the
  // classroom document once; subsequent lesson changes stay inside this SPA.
  if (isEnteringClassroom && typeof crossOriginIsolated === 'boolean' && !crossOriginIsolated) {
    window.location.assign(url);
    return;
  }

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
      setCurrentRoute(
        parseLocation(window.location.pathname, window.location.search)
      );
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
