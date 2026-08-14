import React, { useState, useEffect, useRef } from 'react';
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
import { StudentAuthScreen } from './components/auth/StudentAuthScreen.tsx';
import { AdminAuthScreen } from './components/auth/AdminAuthScreen.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { LearningHistoryModal } from './components/student/LearningHistoryModal.tsx';
import { UserProfile } from './types/user.ts';
import { apiClient } from './services/apiClient.ts';

const THEME_STORAGE_KEY = 'esmiles_backend_academy_theme';

interface AppState {
  currentLessonId: string;
  completedLessons: Record<string, { completedAt: string }>;
  sprintExamScores: Record<number, { score: number; passed: boolean; completedAt: string }>;
  finalExam: {
    score: number;
    passed: boolean;
    studentName: string;
    certificateId: string;
    completedAt: string;
  } | null;
  streakDays: number;
  lastActiveDate: string;
  clearedLessons: Record<string, boolean>;
}

export const App: React.FC = () => {
  const contentViewportRef = useRef<HTMLElement | null>(null);

  // Check URL route to strictly separate Admin CMS vs Student LMS
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  const [studentUser, setStudentUser] = useState<UserProfile | null>(null);
  const [adminUser, setAdminUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

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
  const [state, setState] = useState<AppState>({
    currentLessonId: 'lesson-1',
    completedLessons: {},
    sprintExamScores: {},
    finalExam: null,
    streakDays: 1,
    lastActiveDate: new Date().toISOString().split('T')[0],
    clearedLessons: {}
  });

  // Verify Real Session Token with SQLite Backend on Boot
  useEffect(() => {
    async function verifyAuth() {
      try {
        const user = await apiClient.getMe();
        if (user) {
          if (user.role === 'admin') {
            setAdminUser(user);
            if (!isAdminRoute) {
              window.location.replace('/admin');
              return;
            }
          } else {
            setStudentUser(user);
            if (isAdminRoute) {
              window.location.replace('/');
              return;
            }
          }
        }
      } catch (e) {
        console.error('Session verify notice:', e);
      } finally {
        setIsAuthChecking(false);
      }
    }
    void verifyAuth();
  }, [isAdminRoute]);

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

  const [activeView, setActiveView] = useState<'lesson' | 'sprint-exam' | 'final-exam'>('lesson');
  const [activeSprintExamId, setActiveSprintExamId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'theory' | 'quiz' | 'code'>('theory');

  // Save Progress to SQLite DB
  useEffect(() => {
    if (studentUser?.id && studentUser.role !== 'admin') {
      void apiClient.saveProgress(studentUser.id, state);
    }
  }, [state, studentUser?.id, studentUser?.role]);

  // Reset viewport scroll to top when changing lesson, tab, or view
  useEffect(() => {
    if (contentViewportRef.current) {
      contentViewportRef.current.scrollTop = 0;
    }
  }, [state.currentLessonId, activeTab, activeView]);

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
  if (isAdminRoute) {
    if (!adminUser || adminUser.role !== 'admin') {
      return (
        <AdminAuthScreen
          onLoginSuccess={(user) => {
            setAdminUser(user);
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
        }}
      />
    );
  }

  // ==========================================
  // 🎓 ROUTE: STUDENT LMS (/)
  // ==========================================
  if (!studentUser || studentUser.role === 'admin') {
    return (
      <StudentAuthScreen
        onLoginSuccess={(user) => {
          if (user.role === 'admin') {
            window.location.replace('/admin');
          } else {
            setStudentUser(user);
          }
        }}
      />
    );
  }

  let currentLesson = null;
  for (const sprint of CURRICULUM) {
    const l = sprint.lessons.find((item) => item.id === state.currentLessonId);
    if (l) {
      currentLesson = l;
      break;
    }
  }
  if (!currentLesson && CURRICULUM.length > 0) {
    currentLesson = CURRICULUM[0].lessons[0];
  }

  const currentSprintExam = SPRINT_EXAMS.find((e) => e.sprintId === activeSprintExamId);
  const totalLessons = CURRICULUM.reduce((acc, sp) => acc + sp.lessons.length, 0);
  const completedCount = Object.keys(state.completedLessons).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const handleSelectLesson = (lessonId: string) => {
    setActiveView('lesson');
    setActiveTab('theory');
    setState((prev) => ({ ...prev, currentLessonId: lessonId }));
  };

  const handleSelectSprintExam = (sprintId: number) => {
    setActiveView('sprint-exam');
    setActiveSprintExamId(sprintId);
  };

  const handleSelectFinalExam = () => {
    setActiveView('final-exam');
  };

  const handleLessonCompleted = (lessonId: string) => {
    setState((prev) => ({
      ...prev,
      completedLessons: {
        ...prev.completedLessons,
        [lessonId]: { completedAt: new Date().toISOString() }
      }
    }));

    if (currentLesson) {
      void apiClient.addHistory({
        userId: studentUser.id,
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

    if (currentLesson) {
      void apiClient.addHistory({
        userId: studentUser.id,
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

    await apiClient.submitSprintExam(studentUser.id, sprintId, score, passed);
  };

  const handleFinalExamSubmitted = async (score: number, passed: boolean, studentName: string) => {
    const studentDisplayName = studentName || studentUser.name || 'Kỹ Sư eSmiles';
    const res = await apiClient.submitFinalExam(studentUser.id, studentDisplayName, score, passed);

    setState((prev) => ({
      ...prev,
      finalExam: res.finalResult
    }));
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
  };

  let topTag = 'LÝ THUYẾT & THỰC HÀNH';
  let topTitle = currentLesson?.title || '';

  if (activeView === 'sprint-exam') {
    topTag = 'KỲ THI SPRINT';
    topTitle = currentSprintExam?.title || 'Đánh Giá Tiến Độ Sprint';
  } else if (activeView === 'final-exam') {
    topTag = 'TỐT NGHIỆP TOÀN KHÓA';
    topTitle = 'Khảo Thí Cấp Bằng Master Backend NestJS';
  }

  return (
    <div className="app-container">
      <Sidebar
        curriculum={CURRICULUM}
        sprintExams={SPRINT_EXAMS}
        activeView={activeView}
        currentLesson={currentLesson}
        currentSprintExam={currentSprintExam}
        completedLessons={state.completedLessons}
        sprintExamScores={state.sprintExamScores}
        finalExam={state.finalExam}
        progressPercent={progressPercent}
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
          currentUser={studentUser}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onLogout={handleStudentLogout}
        />

        <section className="content-viewport" ref={contentViewportRef}>
          {activeView === 'lesson' && currentLesson && (
            <div>
              <div className="lesson-tabs">
                <button
                  className={`tab-btn ${activeTab === 'theory' ? 'active' : ''}`}
                  onClick={() => setActiveTab('theory')}
                >
                  📖 Lý Thuyết & Code Mẫu
                </button>
                <button
                  className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''} ${!state.clearedLessons?.[currentLesson.id] ? 'locked' : ''}`}
                  onClick={() => state.clearedLessons?.[currentLesson.id] && setActiveTab('quiz')}
                  disabled={!state.clearedLessons?.[currentLesson.id]}
                >
                  {state.clearedLessons?.[currentLesson.id] ? '❓' : '🔒'} Trắc Nghiệm Ôn Luyện{' '}
                  <span className="tab-badge">{currentLesson.quiz.length}</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                  onClick={() => setActiveTab('code')}
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
                  onNextTab={() => setActiveTab('quiz')}
                />
              )}

              {activeTab === 'quiz' && (
                <QuizTab
                  lesson={currentLesson}
                  onPrevTab={() => setActiveTab('theory')}
                  onNextTab={() => setActiveTab('code')}
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

          {activeView === 'sprint-exam' && currentSprintExam && (
            <SprintExamView
              exam={currentSprintExam}
              existingScore={state.sprintExamScores[currentSprintExam.sprintId]}
              onExamSubmitted={handleSprintExamSubmitted}
            />
          )}

          {activeView === 'final-exam' && (
            <FinalExamView
              exam={FINAL_EXAM}
              finalResult={state.finalExam}
              onFinalExamSubmitted={handleFinalExamSubmitted}
              onRetakeFinalExam={handleRetakeFinalExam}
            />
          )}
        </section>
      </main>

      {/* Student Learning History Modal */}
      <LearningHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        currentUser={studentUser}
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
