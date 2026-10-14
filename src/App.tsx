import { adminReturnTo } from './utils/router.ts';
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { CURRICULUM } from './data/curriculum.ts';
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
  LearningHistoryModal
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
    handleRetakeFinalExam
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

  // Active Lesson Resolution
  const currentLessonId =
    route.type === 'lesson'
      ? route.lessonId
      : state.currentLessonId || 'c1-l1';
  const currentLesson = useMemo(() => {
    for (const sprint of CURRICULUM) {
      const lesson = sprint.lessons.find((item) => item.id === currentLessonId);
      if (lesson) return lesson;
    }
    return CURRICULUM[0]?.lessons[0] || null;
  }, [currentLessonId]);

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
        <div style={{ textAlign: 'center', color: '#0ea5e9' }}>
          <div style={{ marginBottom: '12px' }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
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
            const firstAvailable = getFirstIncompleteLessonId(
              state.completedLessons
            );
            navigate(`/lessons/${firstAvailable}?tab=theory`);
          }
        }}
      />
    );
  }

  // Navigation handlers
  const handleSelectLesson = (lessonId: string) => {
    setState((prev) => ({ ...prev, currentLessonId: lessonId }));
    navigate(`/lessons/${lessonId}?tab=theory`);
  };

  const handleSelectSprintExam = (sprintId: number) => {
    navigate(`/sprint-exam/${sprintId}`);
  };

  const handleSelectFinalExam = () => {
    navigate('/final-exam');
  };

  const handleNavigateToAvailable = () => {
    const nextLessonId = getFirstIncompleteLessonId(state.completedLessons);
    navigate(`/lessons/${nextLessonId}?tab=theory`);
  };

  // Topbar presentation
  let topTag = 'LÝ THUYẾT & THỰC HÀNH';
  let topTitle = currentLesson?.title || '';
  const currentViewType: ViewType =
    route.type === 'sprint-exam'
      ? 'sprint-exam'
      : route.type === 'final-exam'
        ? 'final-exam'
        : 'lesson';

  if (route.type === 'sprint-exam') {
    topTag = 'KỲ THI SPRINT';
    topTitle =
      currentSprintExam?.title ||
      `Đánh Giá Tiến Độ Sprint ${activeSprintExamId}`;
  } else if (route.type === 'final-exam') {
    topTag = 'TỐT NGHIỆP TOÀN KHÓA';
    topTitle = 'Khảo Thí Cấp Bằng Master Backend NestJS';
  }

  const activeTab: LessonActiveTab =
    route.type === 'lesson' ? route.tab : 'theory';
  const handleTabChange = (tab: LessonActiveTab) => {
    if (currentLesson) {
      navigate(`/lessons/${currentLesson.id}?tab=${tab}`);
    }
  };

  // Content Unlock Statuses
  const sprintExamUnlockStatus = checkSprintExamUnlockStatus(
    activeSprintExamId,
    state.completedLessons,
    activeUser?.role,
    effectiveBypass
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
          curriculum={CURRICULUM}
          sprintExams={SPRINT_EXAMS}
          activeView={currentViewType}
          currentLesson={currentLesson}
          currentSprintExam={currentSprintExam}
          completedLessons={state.completedLessons}
          sprintExamScores={state.sprintExamScores}
          finalExam={state.finalExam}
          progressPercent={progressPercent}
          userRole={activeUser?.role}
          bypassLock={effectiveBypass}
          isCollapsed={isSidebarCollapsed}
          onSelectLesson={handleSelectLesson}
          onSelectSprintExam={handleSelectSprintExam}
          onSelectFinalExam={handleSelectFinalExam}
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
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            isTutorOpen={isTutorOpen}
            onToggleTutor={toggleTutor}
          />

          <div
            className={`workspace-layout ${
              isTutorOpen && tutorMode === 'docked' && route.type === 'lesson'
                ? 'has-docked-tutor'
                : ''
            }`}
          >
            <section className="content-viewport" ref={contentViewportRef}>
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
                      Lý Thuyết & Code Mẫu
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
                  </div>

                  {activeTab === 'theory' && (
                    <TheoryTab
                      lesson={currentLesson}
                      onNextTab={() => handleTabChange('quiz')}
                      onOpenTutor={() => setIsTutorOpen(true)}
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
