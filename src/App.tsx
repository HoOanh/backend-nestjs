import { adminReturnTo } from './utils/router.ts';
import React, { useRef, useMemo, useEffect, useState } from 'react';
import {
  COURSES,
  getCourseById,
  findCourseByLessonId,
  getCourseTotalLessons,
  getCourseCompletedCount
} from './data/courses.ts';
import { SPRINT_EXAMS } from './data/sprintExams.ts';
import { FINAL_EXAM } from './data/finalExam.ts';
import {
  Sidebar,
  Topbar,
  TheoryTab,
  QuizTab,
  CodeSandboxTab,
  TutorChat,
  SprintExamView,
  FinalExamView,
  LockedContentNotice,
  StudentAuthScreen,
  AdminAuthScreen,
  LearningHistoryModal,
  LearningHubView,
  AiInstructorClassroom
} from './components/index.ts';
const AdminDashboard = React.lazy(() =>
  import('./components/admin/AdminDashboard.tsx').then((module) => ({
    default: module.AdminDashboard
  }))
);
import { TutorChatProvider } from './context/TutorChatContext.tsx';
import {
  useTheme,
  useSidebarLayout,
  useTutorLayout,
  useAuthSession,
  useLearningProgress
} from './hooks/index.ts';
import {
  useAppRouter,
  getModKey,
  checkSprintExamUnlockStatus,
  checkFinalExamUnlockStatus,
  getFirstIncompleteLessonId
} from './utils/index.ts';
import type { LessonActiveTab, ViewType } from './types/index.ts';

export const App: React.FC = () => {
  const contentViewportRef = useRef<HTMLElement | null>(null);
  const { route, navigate } = useAppRouter();
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Custom Hooks
  const { theme, toggleTheme } = useTheme();
  const {
    isSidebarCollapsed,
    toggleSidebar,
    adminBypassLock,
    toggleAdminBypass
  } = useSidebarLayout();
  const {
    studentUser,
    setStudentUser,
    adminUser,
    setAdminUser,
    isAuthChecking,
    activeUser,
    isEffectiveAdmin,
    logoutStudent,
    logoutAdmin
  } = useAuthSession();

  const {
    state,
    setState,
    totalLessons,
    completedCount,
    progressPercent,
    handleLessonCompleted,
    handleLessonCleared,
    handleQuizSubmitted,
    handleSprintExamSubmitted,
    handleFinalExamSubmitted,
    handleRetakeFinalExam,
    handleEnrollCourse,
    handleSelectCareerPath,
    handleSaveClassroomCheckpoint
  } = useLearningProgress(activeUser);

  const {
    isTutorOpen,
    setIsTutorOpen,
    tutorMode,
    switchTutorMode,
    isTutorExpanded,
    setIsTutorExpanded,
    dockedTutorWidth,
    handleResizeDockStart,
    toggleTutor
  } = useTutorLayout();

  const effectiveBypass = isEffectiveAdmin && adminBypassLock;

  // Strict Course & Lesson Resolution across Multi-Course Catalog
  const resolvedCourseAndLesson = useMemo(() => {
    // 1. If route explicitly specifies courseId, strictly lock to that course first
    if (
      (route.type === 'lesson' ||
        route.type === 'ai-classroom' ||
        route.type === 'sprint-exam' ||
        route.type === 'final-exam') &&
      route.courseId
    ) {
      const explicitCourse = getCourseById(route.courseId);
      if (route.type === 'lesson' || route.type === 'ai-classroom') {
        for (const sp of explicitCourse.curriculum) {
          const found = sp.lessons.find((l) => l.id === route.lessonId);
          if (found) return { course: explicitCourse, sprint: sp, lesson: found };
        }
      }
      const firstSp = explicitCourse.curriculum[0];
      return {
        course: explicitCourse,
        sprint: firstSp,
        lesson: firstSp?.lessons[0] || null
      };
    }

    // 2. Legacy /lessons/:lessonId without courseId in URL: find course owning lessonId
    if (route.type === 'lesson' || route.type === 'ai-classroom') {
      const match = findCourseByLessonId(route.lessonId, state.activeCourseId);
      if (match) return match;
    }

    // 3. Fallback to activeCourseId in state
    const fallbackCourse = getCourseById(state.activeCourseId);
    const enrolledLessonId =
      state.enrolledCourses?.[fallbackCourse.id]?.currentLessonId ||
      state.currentLessonId;

    for (const sp of fallbackCourse.curriculum) {
      const found = sp.lessons.find((l) => l.id === enrolledLessonId);
      if (found) return { course: fallbackCourse, sprint: sp, lesson: found };
    }

    const firstSprint = fallbackCourse.curriculum[0];
    return {
      course: fallbackCourse,
      sprint: firstSprint,
      lesson: firstSprint?.lessons[0] || null
    };
  }, [route, state.activeCourseId, state.currentLessonId, state.enrolledCourses]);

  const activeCourse = resolvedCourseAndLesson.course;
  const currentLesson = resolvedCourseAndLesson.lesson;
  const courseTotalLessons = getCourseTotalLessons(activeCourse);
  const courseCompletedCount = getCourseCompletedCount(
    activeCourse,
    state.completedLessons
  );
  const courseProgressPercent =
    courseTotalLessons > 0
      ? Math.round((courseCompletedCount / courseTotalLessons) * 100)
      : progressPercent;

  // Active Sprint Exam Resolution
  const activeSprintExamId = route.type === 'sprint-exam' ? route.sprintId : 0;
  const currentSprintExam = useMemo(() => {
    return SPRINT_EXAMS.find((e) => e.sprintId === activeSprintExamId);
  }, [activeSprintExamId]);

  // Reset scroll to top on route change
  useEffect(() => {
    if (contentViewportRef.current) {
      contentViewportRef.current.scrollTop = 0;
    }
  }, [route]);

  // 1. Loading Session Gate
  if (isAuthChecking) {
    return (
      <div className="auth-portal-page">
        <div className="text-center text-accent">
          <div className="mb-3 flex justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <h3>Đang xác thực phiên đăng nhập...</h3>
        </div>
      </div>
    );
  }

  // 2. Admin CMS Route (/admin, /admin-login)
  if (route.type === 'admin' || route.type === 'admin-login') {
    if (!adminUser || adminUser.role !== 'admin') {
      return (
        <AdminAuthScreen
          onLoginSuccess={(user) => {
            setAdminUser(user);
            navigate(
              route.type === 'admin'
                ? window.location.pathname + window.location.search
                : adminReturnTo(window.location.search)
            );
          }}
        />
      );
    }

    return (
      <React.Suspense fallback={<p role="status">Đang tải quản trị…</p>}>
        <AdminDashboard
          section={route.type === 'admin' ? route.subPath : undefined}
          onNavigateSection={(section) => navigate(`/admin/${section}`)}
          currentUser={adminUser}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={async () => {
            await logoutAdmin();
            navigate('/admin/login');
          }}
        />
      </React.Suspense>
    );
  }

  // 3. Student Auth Gate (Login / Register)
  if (!studentUser && !adminUser) {
    return (
      <StudentAuthScreen
        onLoginSuccess={(user) => {
          if (user.role === 'admin') {
            setAdminUser(user);
            navigate('/admin');
          } else {
            setStudentUser(user);
            navigate('/courses');
          }
        }}
      />
    );
  }

  // Navigation handlers
  const handleSelectLesson = (lessonId: string, targetCourseId = activeCourse.id) => {
    setState((prev) => ({
      ...prev,
      activeCourseId: targetCourseId,
      currentLessonId: lessonId,
      enrolledCourses: {
        ...(prev.enrolledCourses || {}),
        [targetCourseId]: {
          courseId: targetCourseId,
          enrolledAt:
            prev.enrolledCourses?.[targetCourseId]?.enrolledAt ||
            new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          currentLessonId: lessonId
        }
      }
    }));
    navigate(`/courses/${targetCourseId}/lessons/${lessonId}?tab=theory`);
  };

  const handleSelectCourse = (courseId: string) => {
    const courseObj = getCourseById(courseId);
    const savedLessonId = state.enrolledCourses?.[courseId]?.currentLessonId;
    const hasSavedInCourse = courseObj.curriculum.some((sp) =>
      sp.lessons.some((l) => l.id === savedLessonId)
    );
    const nextLessonId = hasSavedInCourse && savedLessonId
      ? savedLessonId
      : getFirstIncompleteLessonId(state.completedLessons, courseObj.curriculum);

    handleEnrollCourse(courseId, courseObj.title);
    handleSelectLesson(nextLessonId, courseId);
  };

  const handleOpenAiClassroom = (
    courseId = activeCourse.id,
    lessonId = currentLesson?.id || 'c1-l1'
  ) => {
    const courseObj = getCourseById(courseId);
    const validLesson = courseObj.curriculum.some((sp) =>
      sp.lessons.some((l) => l.id === lessonId)
    )
      ? lessonId
      : courseObj.curriculum[0]?.lessons[0]?.id || 'c1-l1';
    handleEnrollCourse(courseId, courseObj.title);
    navigate(`/ai-classroom/${courseId}/${validLesson}`);
  };

  const handleSelectSprintExam = (sprintId: number) => {
    navigate(`/courses/${activeCourse.id}/sprint-exam/${sprintId}`);
  };

  const handleSelectFinalExam = () => {
    navigate(`/courses/${activeCourse.id}/final-exam`);
  };

  const handleNavigateToAvailable = () => {
    const nextLessonId = getFirstIncompleteLessonId(
      state.completedLessons,
      activeCourse.curriculum
    );
    navigate(`/courses/${activeCourse.id}/lessons/${nextLessonId}?tab=theory`);
  };

  // 4. DEDICATED FULL-SCREEN 1-ON-1 AI INSTRUCTOR CLASSROOM (/ai-classroom/:courseId/:lessonId)
  if (route.type === 'ai-classroom' && currentLesson) {
    return (
      <TutorChatProvider userId={activeUser?.id || 'guest'}>
        <AiInstructorClassroom
          course={activeCourse}
          lesson={currentLesson}
          userId={activeUser?.id || 'guest'}
          savedClassroomProgress={state.classroomProgress?.[currentLesson.id]}
          isLessonCompleted={Boolean(state.completedLessons[currentLesson.id])}
          onSaveCheckpoint={handleSaveClassroomCheckpoint}
          onLessonCompleted={(id) =>
            handleLessonCompleted(id, currentLesson.title)
          }
          onExitToLesson={() =>
            navigate(`/courses/${activeCourse.id}/lessons/${currentLesson.id}?tab=theory`)
          }
          onExitToHub={() => navigate('/courses')}
        />
      </TutorChatProvider>
    );
  }

  // Topbar presentation
  let topTag = activeCourse.shortTitle.toUpperCase();
  let topTitle = currentLesson?.title || activeCourse.title;
  const currentViewType: ViewType =
    route.type === 'courses-hub'
      ? 'courses-hub'
      : route.type === 'sprint-exam'
        ? 'sprint-exam'
        : route.type === 'final-exam'
          ? 'final-exam'
          : 'lesson';

  if (route.type === 'courses-hub') {
    topTag = 'HỌC VIỆN KỸ SƯ';
    topTitle = 'Trung Tâm Khóa Học & Lộ Trình Phát Triển Kỹ Sư';
  } else if (route.type === 'sprint-exam') {
    topTag = 'KỲ THI CHƯƠNG';
    topTitle =
      currentSprintExam?.title ||
      `Đánh Giá Tiến Độ Chương ${activeSprintExamId}`;
  } else if (route.type === 'final-exam') {
    topTag = 'TỐT NGHIỆP TOÀN KHÓA';
    topTitle = `Khảo Thí Cấp Bằng ${activeCourse.shortTitle}`;
  }

  const activeTab: LessonActiveTab =
    route.type === 'lesson' ? route.tab : 'theory';
  const handleTabChange = (tab: LessonActiveTab) => {
    if (currentLesson) {
      navigate(`/courses/${activeCourse.id}/lessons/${currentLesson.id}?tab=${tab}`);
    }
  };

  // Content Unlock Statuses
  const sprintExamUnlockStatus = checkSprintExamUnlockStatus(
    activeSprintExamId,
    state.completedLessons,
    activeUser?.role,
    effectiveBypass,
    activeCourse.curriculum
  );

  const finalExamUnlockStatus = checkFinalExamUnlockStatus(
    state.sprintExamScores,
    activeUser?.role,
    effectiveBypass,
    SPRINT_EXAMS
  );

  return (
    <TutorChatProvider userId={activeUser?.id || 'guest'}>
      <div
        className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      >
        <Sidebar
          curriculum={activeCourse.curriculum}
          sprintExams={activeCourse.id === 'backend-nestjs' ? SPRINT_EXAMS : []}
          activeView={currentViewType}
          hubTab={route.type === 'courses-hub' ? route.viewTab || 'overview' : undefined}
          activeCourse={activeCourse}
          courses={COURSES}
          enrolledCourses={state.enrolledCourses || {}}
          currentLesson={currentLesson}
          currentSprintExam={currentSprintExam}
          completedLessons={state.completedLessons}
          sprintExamScores={state.sprintExamScores}
          finalExam={state.finalExam}
          progressPercent={courseProgressPercent}
          userRole={activeUser?.role}
          bypassLock={effectiveBypass}
          isCollapsed={isSidebarCollapsed}
          onSelectLesson={(lessonId) => handleSelectLesson(lessonId, activeCourse.id)}
          onSelectSprintExam={handleSelectSprintExam}
          onSelectFinalExam={handleSelectFinalExam}
          onNavigateToHub={(tab) =>
            navigate(tab && tab !== 'overview' ? `/courses?view=${tab}` : '/courses')
          }
          onSelectCourse={handleSelectCourse}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
        />

        <main className="app-main">
          <Topbar
            tag={topTag}
            title={topTitle}
            streakDays={state.streakDays}
            theme={theme}
            onToggleTheme={toggleTheme}
            currentUser={
              activeUser || {
                id: '',
                name: 'Học Viên',
                email: '',
                role: 'student',
                authProvider: 'email',
                planId: 'free',
                createdAt: '',
                lastLoginAt: ''
              }
            }
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onLogout={async () => {
              await logoutStudent();
              navigate('/login');
            }}
            isAdminBypass={effectiveBypass}
            onToggleAdminBypass={
              isEffectiveAdmin ? toggleAdminBypass : undefined
            }
            onNavigateToAdmin={
              isEffectiveAdmin ? () => navigate('/admin') : undefined
            }
            onNavigateToHub={
              route.type !== 'courses-hub' ? () => navigate('/courses') : undefined
            }
            onOpenAiClassroom={
              route.type === 'lesson' && currentLesson
                ? () => handleOpenAiClassroom(activeCourse.id, currentLesson.id)
                : undefined
            }
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            isTutorOpen={isTutorOpen}
            onToggleTutor={route.type === 'lesson' ? toggleTutor : undefined}
          />

          <div
            className={`workspace-layout ${
              isTutorOpen && tutorMode === 'docked' && route.type === 'lesson'
                ? 'has-docked-tutor'
                : ''
            }`}
          >
            <section className="content-viewport" ref={contentViewportRef}>
              {/* 0. MULTI-COURSE & CAREER PATH LEARNING HUB */}
              {route.type === 'courses-hub' && (
                <LearningHubView
                  initialTab={route.viewTab}
                  activeCourseId={activeCourse.id}
                  activeCareerPathId={
                    state.activeCareerPathId || 'path-backend-architect'
                  }
                  enrolledCourses={state.enrolledCourses || {}}
                  completedLessons={state.completedLessons}
                  streakDays={state.streakDays}
                  onEnrollAndOpenCourse={(courseId, lessonId) => {
                    const targetCourse = getCourseById(courseId);
                    const targetLessonId =
                      lessonId ||
                      getFirstIncompleteLessonId(
                        state.completedLessons,
                        targetCourse.curriculum
                      );
                    handleEnrollCourse(courseId, targetCourse.title);
                    handleSelectLesson(targetLessonId, courseId);
                  }}
                  onEnrollCourseOnly={(courseId, courseTitle) => {
                    handleEnrollCourse(courseId, courseTitle);
                  }}
                  onOpenAiClassroom={(courseId, lessonId) => {
                    handleOpenAiClassroom(courseId, lessonId);
                  }}
                  onSelectCareerPath={(pathId, courseIds) => {
                    handleSelectCareerPath(pathId, courseIds);
                  }}
                  onSwitchHubTab={(tab) => {
                    navigate(
                      tab === 'overview' ? '/courses' : `/courses?view=${tab}`,
                      true
                    );
                  }}
                />
              )}

              {/* 1. LESSON VIEW */}
              {route.type === 'lesson' && currentLesson && (
                <div>
                  <div className="lesson-tabs">
                    <button
                      className={`tab-btn ${activeTab === 'theory' ? 'active' : ''}`}
                      onClick={() => handleTabChange('theory')}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                      </svg>{' '}
                      Lý Thuyết &amp; Code Mẫu
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''}`}
                      onClick={() => handleTabChange('quiz')}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>{' '}
                      Trắc Nghiệm Ôn Luyện{' '}
                      <span className="tab-badge">
                        {currentLesson.quiz.length}
                      </span>
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                      onClick={() => handleTabChange('code')}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>{' '}
                      Bài Tập Code Sandbox{' '}
                      <span className="tab-badge">
                        {currentLesson.codeChallenges && currentLesson.codeChallenges.length > 1
                          ? `${currentLesson.codeChallenges.length} Bài`
                          : `${currentLesson.codeChallenge.testCases.length} Tests`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="tab-btn-classroom"
                      onClick={() =>
                        handleOpenAiClassroom(activeCourse.id, currentLesson.id)
                      }
                    >
                      <span>Phòng Học 1-1 Với AI Giảng Viên</span>
                    </button>
                  </div>

                  {activeTab === 'theory' && (
                    <TheoryTab
                      lesson={currentLesson}
                      onNextTab={() => handleTabChange('quiz')}
                      onOpenTutor={() => setIsTutorOpen(true)}
                      onOpenAiClassroom={() =>
                        handleOpenAiClassroom(activeCourse.id, currentLesson.id)
                      }
                      onLessonCleared={() =>
                        handleLessonCleared(
                          currentLesson.id,
                          currentLesson.title
                        )
                      }
                    />
                  )}

                  {activeTab === 'quiz' && (
                    <QuizTab
                      lesson={currentLesson}
                      onPrevTab={() => handleTabChange('theory')}
                      onNextTab={() => handleTabChange('code')}
                      onQuizSubmitted={handleQuizSubmitted}
                    />
                  )}

                  {activeTab === 'code' && (
                    <CodeSandboxTab
                      lesson={currentLesson}
                      onLessonCompleted={(id) =>
                        handleLessonCompleted(id, currentLesson.title)
                      }
                    />
                  )}
                </div>
              )}

              {/* 2. SPRINT EXAM VIEW */}
              {route.type === 'sprint-exam' && currentSprintExam && (
                <>
                  {!sprintExamUnlockStatus.unlocked ? (
                    <LockedContentNotice
                      type="sprint-exam"
                      title={currentSprintExam.title}
                      missingLessons={sprintExamUnlockStatus.missingLessons}
                      onNavigateToAvailable={handleNavigateToAvailable}
                      onSelectLesson={handleSelectLesson}
                      isAdmin={isEffectiveAdmin}
                      onBypassLock={toggleAdminBypass}
                    />
                  ) : (
                    <SprintExamView
                      exam={currentSprintExam}
                      existingScore={
                        state.sprintExamScores[currentSprintExam.sprintId]
                      }
                      onExamSubmitted={handleSprintExamSubmitted}
                    />
                  )}
                </>
              )}

              {/* 3. FINAL EXAM VIEW */}
              {route.type === 'final-exam' && (
                <>
                  {!finalExamUnlockStatus.unlocked &&
                  !state.finalExam?.passed ? (
                    <LockedContentNotice
                      type="final-exam"
                      title="Kỳ Thi Tốt Nghiệp Toàn Khóa Arc Irobot Academy"
                      missingSprints={finalExamUnlockStatus.missingSprints}
                      totalSprints={finalExamUnlockStatus.totalSprints}
                      onNavigateToAvailable={handleNavigateToAvailable}
                      onSelectSprintExam={handleSelectSprintExam}
                      isAdmin={isEffectiveAdmin}
                      onBypassLock={toggleAdminBypass}
                    />
                  ) : (
                    <FinalExamView
                      exam={FINAL_EXAM}
                      finalResult={state.finalExam}
                      onFinalExamSubmitted={handleFinalExamSubmitted}
                      onRetakeFinalExam={handleRetakeFinalExam}
                    />
                  )}
                </>
              )}
            </section>

            {/* DOCKED TUTOR CO-PILOT */}
            {isTutorOpen &&
              !isTutorExpanded &&
              tutorMode === 'docked' &&
              currentLesson &&
              route.type === 'lesson' && (
                <aside
                  className="docked-tutor-sidebar"
                  style={{ width: `${dockedTutorWidth}px` }}
                >
                  <div
                    className="docked-resizer-handle"
                    onMouseDown={handleResizeDockStart}
                    title="Kéo để thay đổi kích thước khung chat"
                  >
                    <div className="resizer-visual-bar" />
                  </div>
                  <TutorChat
                    lesson={currentLesson}
                    mode="docked"
                    isExpanded={false}
                    onToggleExpand={() => setIsTutorExpanded(true)}
                    onSwitchMode={() => switchTutorMode('floating')}
                    onClose={() => {
                      setIsTutorExpanded(false);
                      setIsTutorOpen(false);
                    }}
                  />
                </aside>
              )}
          </div>

          {/* FLOATING TUTOR WINDOW */}
          {isTutorOpen &&
            !isTutorExpanded &&
            tutorMode === 'floating' &&
            currentLesson &&
            route.type === 'lesson' && (
              <div className="floating-tutor-window">
                <TutorChat
                  lesson={currentLesson}
                  mode="floating"
                  isExpanded={false}
                  onToggleExpand={() => setIsTutorExpanded(true)}
                  onSwitchMode={() => switchTutorMode('docked')}
                  onClose={() => {
                    setIsTutorExpanded(false);
                    setIsTutorOpen(false);
                  }}
                />
              </div>
            )}

          {/* FULLSCREEN EXPANDED TUTOR MODAL */}
          {isTutorOpen &&
            isTutorExpanded &&
            currentLesson &&
            route.type === 'lesson' && (
              <div className="tutor-modal-overlay">
                <div
                  className="tutor-modal-backdrop"
                  onClick={() => setIsTutorExpanded(false)}
                  aria-label="Đóng toàn màn hình"
                />
                <div className="floating-tutor-window is-expanded">
                  <TutorChat
                    lesson={currentLesson}
                    mode="floating"
                    isExpanded={true}
                    onToggleExpand={() => setIsTutorExpanded(false)}
                    onSwitchMode={(mode) => {
                      setIsTutorExpanded(false);
                      switchTutorMode(mode);
                    }}
                    onClose={() => {
                      setIsTutorExpanded(false);
                      setIsTutorOpen(false);
                    }}
                  />
                </div>
              </div>
            )}

          {/* FLOATING ACTION BUTTON (FAB) Trigger */}
          {!isTutorOpen &&
            !isHistoryModalOpen &&
            currentLesson &&
            route.type === 'lesson' && (
              <button
                className="floating-tutor-trigger-btn"
                onClick={() => setIsTutorOpen(true)}
                aria-label={`Mở Tutor AI Co-Pilot (${getModKey()}+J)`}
              >
                <span className="fab-pulse-ring" />
                <img
                  src="/logo.png"
                  alt="Arc Irobot AI"
                  className="fab-logo-img"
                />
                <span className="fab-status-dot" />
                <span className="fab-tooltip">
                  Hỏi Tutor AI ({getModKey()}+J)
                </span>
              </button>
            )}
        </main>

        {/* Student Learning History Modal */}
        <LearningHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          currentUser={
            activeUser || {
              id: '',
              name: 'Học Viên',
              email: '',
              role: 'student',
              authProvider: 'email',
              planId: 'free',
              createdAt: '',
              lastLoginAt: ''
            }
          }
          completedCount={completedCount}
          totalLessons={totalLessons}
          progressPercent={progressPercent}
          completedLessons={state.completedLessons}
          clearedLessons={state.clearedLessons}
          quizScores={state.quizScores}
          sprintExamScores={state.sprintExamScores}
          finalExam={state.finalExam}
        />
      </div>
    </TutorChatProvider>
  );
};

export default App;
