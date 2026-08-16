import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CURRICULUM } from './data/curriculum.ts';
import { SPRINT_EXAMS } from './data/sprintExams.ts';
import { FINAL_EXAM } from './data/finalExam.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { Topbar } from './components/Topbar.tsx';
import { TheoryTab } from './components/TheoryTab.tsx';
import { QuizTab } from './components/QuizTab.tsx';
import { CodeSandboxTab } from './components/CodeSandboxTab.tsx';
import { SprintExamView } from './components/SprintExamView.tsx';
import { FinalExamView } from './components/FinalExamView.tsx';
import { LockedContentNotice } from './components/LockedContentNotice.tsx';
import { StudentAuthScreen } from './components/auth/StudentAuthScreen.tsx';
import { AdminAuthScreen } from './components/auth/AdminAuthScreen.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { LearningHistoryModal } from './components/student/LearningHistoryModal.tsx';
import { UserProfile, UserProgressState } from './types/user.ts';
import { apiClient } from './services/apiClient.ts';
import { useAppRouter } from './utils/router.ts';
import {
  checkLessonUnlockStatus,
  checkSprintExamUnlockStatus,
  checkFinalExamUnlockStatus,
  getFirstIncompleteLessonId
} from './utils/progressGuard.ts';

const THEME_STORAGE_KEY = 'esmiles_backend_academy_theme';
const ADMIN_BYPASS_STORAGE_KEY = 'esmiles_admin_bypass_lock';

type AppState = UserProgressState;

export const App: React.FC = () => {
  const contentViewportRef = useRef<HTMLElement | null>(null);
  const { route, navigate } = useAppRouter();

  const [studentUser, setStudentUser] = useState<UserProfile | null>(() => {
    const stored = apiClient.getStoredUser();
    return stored && stored.role !== 'admin' ? stored : null;
  });
  const [adminUser, setAdminUser] = useState<UserProfile | null>(() => {
    const stored = apiClient.getStoredUser();
    return stored && stored.role === 'admin' ? stored : null;
  });
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
    const stored = apiClient.getStoredUser();
    const token = apiClient.getToken();
    return !stored && Boolean(token);
  });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Admin Bypass Lock Mode (allow previewing all lessons & exams for verification)
  const [adminBypassLock, setAdminBypassLock] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADMIN_BYPASS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleAdminBypass = () => {
    setAdminBypassLock((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ADMIN_BYPASS_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {}
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Learning Progress State
  const [state, setState] = useState<AppState>(() => {
    const storedUser = apiClient.getStoredUser();
    if (storedUser?.id) {
      try {
        const local = localStorage.getItem(`esmiles_progress_${storedUser.id}`);
        if (local) return JSON.parse(local);
      } catch {}
    }
    return {
      currentLessonId: 'lesson-1',
      completedLessons: {},
      sprintExamScores: {},
      finalExam: null,
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      clearedLessons: {}
    };
  });

  // Verify Real Session Token with SQLite Backend on Boot
  useEffect(() => {
    async function verifyAuth() {
      const stored = apiClient.getStoredUser();
      const token = apiClient.getToken();
      if (!token && !stored) {
        setIsAuthChecking(false);
        return;
      }

      try {
        const user = await apiClient.getMe();
        if (user) {
          if (user.role === 'admin') {
            setAdminUser(user);
            setStudentUser(null);
          } else {
            setStudentUser(user);
            setAdminUser(null);
          }
        } else {
          if (!apiClient.getToken()) {
            setStudentUser(null);
            setAdminUser(null);
          }
        }
      } catch (e) {
        console.error('Session verify notice:', e);
      } finally {
        setIsAuthChecking(false);
      }
    }
    void verifyAuth();
  }, []);

  // Load user progress from SQLite Backend when studentUser logs in
  useEffect(() => {
    if (studentUser?.id && studentUser.role !== 'admin') {
      void apiClient.getProgress(studentUser.id).then((savedProgress) => {
        if (savedProgress) {
          setState(savedProgress);
        }
      });
    }
  }, [studentUser?.id, studentUser?.role]);

  // Save Progress to SQLite DB
  useEffect(() => {
    if (studentUser?.id && studentUser.role !== 'admin') {
      void apiClient.saveProgress(studentUser.id, state);
    }
  }, [state, studentUser?.id, studentUser?.role]);

  // Active User profile (student or admin)
  const activeUser = studentUser || adminUser;
  const isEffectiveAdmin = adminUser?.role === 'admin' || studentUser?.role === 'admin';
  const effectiveBypass = isEffectiveAdmin && adminBypassLock;

  // Resolve current active lesson from route
  const currentLessonId = route.type === 'lesson' ? route.lessonId : state.currentLessonId || 'lesson-1';
  const currentLesson = useMemo(() => {
    for (const sprint of CURRICULUM) {
      const l = sprint.lessons.find((item) => item.id === currentLessonId);
      if (l) return l;
    }
    return CURRICULUM[0]?.lessons[0] || null;
  }, [currentLessonId]);

  // Resolve active sprint exam from route
  const activeSprintExamId = route.type === 'sprint-exam' ? route.sprintId : 0;
  const currentSprintExam = useMemo(() => {
    return SPRINT_EXAMS.find((e) => e.sprintId === activeSprintExamId);
  }, [activeSprintExamId]);

  // Reset viewport scroll to top when changing route or tab
  useEffect(() => {
    if (contentViewportRef.current) {
      contentViewportRef.current.scrollTop = 0;
    }
  }, [route]);

  if (isAuthChecking) {
    return (
      <div className="auth-portal-page">
        <div style={{ textAlign: 'center', color: '#0ea5e9' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔄</div>
          <h3>Đang kết nối cơ sở dữ liệu SQLite & Xác thực phiên...</h3>
        </div>
      </div>
    );
  }

  // ==========================================
  // 👑 ROUTE: ADMIN CMS (/admin)
  // ==========================================
  if (route.type === 'admin' || route.type === 'admin-login') {
    if (!adminUser || adminUser.role !== 'admin') {
      return (
        <AdminAuthScreen
          onLoginSuccess={(user) => {
            setAdminUser(user);
            navigate('/admin');
          }}
        />
      );
    }

    return (
      <AdminDashboard
        currentUser={adminUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={async () => {
          await apiClient.logout();
          setAdminUser(null);
          navigate('/admin/login');
        }}
      />
    );
  }

  // ==========================================
  // 🎓 ROUTE: AUTH (Student Login / Register)
  // ==========================================
  if (!studentUser && !adminUser) {
    return (
      <StudentAuthScreen
        onLoginSuccess={(user) => {
          if (user.role === 'admin') {
            setAdminUser(user);
            navigate('/admin');
          } else {
            setStudentUser(user);
            const firstAvailable = getFirstIncompleteLessonId(state.completedLessons);
            navigate(`/lessons/${firstAvailable}?tab=theory`);
          }
        }}
      />
    );
  }

  // ==========================================
  // 📚 STUDENT LMS MAIN VIEW (Multi-Route)
  // ==========================================
  const totalLessons = CURRICULUM.reduce((acc, sp) => acc + sp.lessons.length, 0);
  const completedCount = Object.keys(state.completedLessons).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

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

  const handleLessonCompleted = (lessonId: string) => {
    setState((prev) => ({
      ...prev,
      completedLessons: {
        ...prev.completedLessons,
        [lessonId]: { completedAt: new Date().toISOString() }
      }
    }));

    if (currentLesson && activeUser) {
      void apiClient.addHistory({
        userId: activeUser.id,
        lessonId,
        lessonTitle: currentLesson.title,
        action: 'code_passed',
        details: 'Đã hoàn thành xuất sắc bài tập Code Sandbox'
      });
    }
  };

  const handleLessonCleared = (lessonId: string) => {
    setState((prev) => ({
      ...prev,
      clearedLessons: {
        ...prev.clearedLessons,
        [lessonId]: true
      }
    }));

    if (currentLesson && activeUser) {
      void apiClient.addHistory({
        userId: activeUser.id,
        lessonId,
        lessonTitle: currentLesson.title,
        action: 'theory_read',
        details: 'Đã đọc hiểu lý thuyết & code mẫu'
      });
    }
  };

  const handleSprintExamSubmitted = async (sprintId: number, score: number, passed: boolean) => {
    setState((prev) => ({
      ...prev,
      sprintExamScores: {
        ...prev.sprintExamScores,
        [sprintId]: { score, passed, completedAt: new Date().toISOString() }
      }
    }));

    if (activeUser) {
      await apiClient.submitSprintExam(activeUser.id, sprintId, score, passed);
    }
  };

  const handleFinalExamSubmitted = async (score: number, passed: boolean, studentName: string) => {
    const studentDisplayName = studentName || activeUser?.name || 'Kỹ Sư eSmiles';
    if (activeUser) {
      const res = await apiClient.submitFinalExam(activeUser.id, studentDisplayName, score, passed);
      setState((prev) => ({
        ...prev,
        finalExam: res.finalResult
      }));
    }
  };

  const handleRetakeFinalExam = () => {
    setState((prev) => ({
      ...prev,
      finalExam: null
    }));
  };

  const handleStudentLogout = async () => {
    await apiClient.logout();
    setStudentUser(null);
    setAdminUser(null);
    navigate('/login');
  };

  const handleNavigateToAvailable = () => {
    const nextLessonId = getFirstIncompleteLessonId(state.completedLessons);
    navigate(`/lessons/${nextLessonId}?tab=theory`);
  };

  // Determine Topbar Tag & Title based on Route
  let topTag = 'LÝ THUYẾT & THỰC HÀNH';
  let topTitle = currentLesson?.title || '';
  const currentViewType = route.type === 'sprint-exam' ? 'sprint-exam' : route.type === 'final-exam' ? 'final-exam' : 'lesson';

  if (route.type === 'sprint-exam') {
    topTag = 'KỲ THI SPRINT';
    topTitle = currentSprintExam?.title || `Đánh Giá Tiến Độ Sprint ${activeSprintExamId}`;
  } else if (route.type === 'final-exam') {
    topTag = 'TỐT NGHIỆP TOÀN KHÓA';
    topTitle = 'Khảo Thí Cấp Bằng Master Backend NestJS';
  }

  // Active Lesson Tab
  const activeTab: 'theory' | 'quiz' | 'code' = route.type === 'lesson' ? route.tab : 'theory';
  const handleTabChange = (tab: 'theory' | 'quiz' | 'code') => {
    if (currentLesson) {
      navigate(`/lessons/${currentLesson.id}?tab=${tab}`);
    }
  };

  // ==========================================
  // PROGRESS GATING & LOCK VERIFICATION
  // ==========================================
  const lessonUnlockStatus = currentLesson
    ? checkLessonUnlockStatus(
        currentLesson.id,
        state.completedLessons,
        activeUser?.role,
        effectiveBypass
      )
    : { unlocked: true, requiredPreviousLesson: null };

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
    <div className="app-container">
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
          onToggleTheme={handleToggleTheme}
          currentUser={activeUser || { id: '', name: 'Học Viên', email: '', role: 'student', authProvider: 'email', planId: 'free', createdAt: '', lastLoginAt: '' }}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onLogout={handleStudentLogout}
          isAdminBypass={effectiveBypass}
          onToggleAdminBypass={isEffectiveAdmin ? handleToggleAdminBypass : undefined}
          onNavigateToAdmin={isEffectiveAdmin ? () => navigate('/admin') : undefined}
        />

        <section className="content-viewport" ref={contentViewportRef}>
          {/* 1. LESSON ROUTE */}
          {route.type === 'lesson' && currentLesson && (
            <>
              {!lessonUnlockStatus.unlocked ? (
                <LockedContentNotice
                  type="lesson"
                  title={currentLesson.title}
                  requiredPreviousLesson={lessonUnlockStatus.requiredPreviousLesson}
                  onNavigateToAvailable={handleNavigateToAvailable}
                  isAdmin={isEffectiveAdmin}
                  onBypassLock={handleToggleAdminBypass}
                />
              ) : (
                <div>
                  <div className="lesson-tabs">
                    <button
                      className={`tab-btn ${activeTab === 'theory' ? 'active' : ''}`}
                      onClick={() => handleTabChange('theory')}
                    >
                      📖 Lý Thuyết & Code Mẫu
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''} ${
                        !state.clearedLessons?.[currentLesson.id] && !effectiveBypass ? 'locked' : ''
                      }`}
                      onClick={() => {
                        if (state.clearedLessons?.[currentLesson.id] || effectiveBypass) {
                          handleTabChange('quiz');
                        }
                      }}
                      disabled={!state.clearedLessons?.[currentLesson.id] && !effectiveBypass}
                      title={
                        !state.clearedLessons?.[currentLesson.id] && !effectiveBypass
                          ? 'Cần đọc lý thuyết và bấm "Đã hiểu bài" để mở trắc nghiệm'
                          : 'Làm trắc nghiệm ôn tập'
                      }
                    >
                      {state.clearedLessons?.[currentLesson.id] || effectiveBypass ? '❓' : '🔒'}{' '}
                      Trắc Nghiệm Ôn Luyện{' '}
                      <span className="tab-badge">{currentLesson.quiz.length}</span>
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                      onClick={() => handleTabChange('code')}
                    >
                      💻 Bài Tập Code Sandbox{' '}
                      <span className="tab-badge">
                        {currentLesson.codeChallenge.testCases.length} Tests
                      </span>
                    </button>
                  </div>

                  {activeTab === 'theory' && (
                    <TheoryTab
                      lesson={currentLesson}
                      isLessonCleared={Boolean(state.clearedLessons?.[currentLesson.id])}
                      onMarkCleared={() => handleLessonCleared(currentLesson.id)}
                      onNextTab={() => handleTabChange('quiz')}
                    />
                  )}

                  {activeTab === 'quiz' && (
                    <QuizTab
                      lesson={currentLesson}
                      onPrevTab={() => handleTabChange('theory')}
                      onNextTab={() => handleTabChange('code')}
                    />
                  )}

                  {activeTab === 'code' && (
                    <CodeSandboxTab
                      lesson={currentLesson}
                      onLessonCompleted={handleLessonCompleted}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* 2. SPRINT EXAM ROUTE */}
          {route.type === 'sprint-exam' && currentSprintExam && (
            <>
              {!sprintExamUnlockStatus.unlocked ? (
                <LockedContentNotice
                  type="sprint-exam"
                  title={currentSprintExam.title}
                  missingLessons={sprintExamUnlockStatus.missingLessons}
                  onNavigateToAvailable={handleNavigateToAvailable}
                  isAdmin={isEffectiveAdmin}
                  onBypassLock={handleToggleAdminBypass}
                />
              ) : (
                <SprintExamView
                  exam={currentSprintExam}
                  existingScore={state.sprintExamScores[currentSprintExam.sprintId]}
                  onExamSubmitted={handleSprintExamSubmitted}
                />
              )}
            </>
          )}

          {/* 3. FINAL EXAM ROUTE */}
          {route.type === 'final-exam' && (
            <>
              {!finalExamUnlockStatus.unlocked && !state.finalExam?.passed ? (
                <LockedContentNotice
                  type="final-exam"
                  title="Kỳ Thi Tốt Nghiệp Toàn Khóa eSmiles Academy"
                  missingSprints={finalExamUnlockStatus.missingSprints}
                  onNavigateToAvailable={handleNavigateToAvailable}
                  isAdmin={isEffectiveAdmin}
                  onBypassLock={handleToggleAdminBypass}
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
      </main>

      {/* Student Learning History Modal */}
      <LearningHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        currentUser={activeUser || { id: '', name: 'Học Viên', email: '', role: 'student', authProvider: 'email', planId: 'free', createdAt: '', lastLoginAt: '' }}
        completedCount={completedCount}
        totalLessons={totalLessons}
        progressPercent={progressPercent}
        sprintExamScores={state.sprintExamScores}
        finalExam={state.finalExam}
      />
    </div>
  );
};

export default App;
