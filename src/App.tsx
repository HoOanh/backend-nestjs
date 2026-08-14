import React, { useState, useEffect } from 'react';
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

const STORAGE_KEY = 'esmiles_backend_academy_state_v2';

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
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
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

  const [activeView, setActiveView] = useState<'lesson' | 'sprint-exam' | 'final-exam'>('lesson');
  const [activeSprintExamId, setActiveSprintExamId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'theory' | 'quiz' | 'code'>('theory');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
  };

  const handleLessonCleared = (lessonId: string) => {
    setState((prev) => ({
      ...prev,
      clearedLessons: { ...(prev.clearedLessons || {}), [lessonId]: true }
    }));
  };

  const handleSprintExamSubmitted = (sprintId: number, score: number, passed: boolean) => {
    setState((prev) => ({
      ...prev,
      sprintExamScores: {
        ...prev.sprintExamScores,
        [sprintId]: { score, passed, completedAt: new Date().toISOString() }
      }
    }));
  };

  const handleFinalExamSubmitted = (score: number, passed: boolean, studentName: string) => {
    const certId = 'ESM-CERT-' + Math.floor(100000 + Math.random() * 900000);
    setState((prev) => ({
      ...prev,
      finalExam: {
        score,
        passed,
        studentName,
        certificateId: certId,
        completedAt: new Date().toISOString()
      }
    }));
  };

  const handleRetakeFinalExam = () => {
    setState((prev) => ({ ...prev, finalExam: null }));
  };

  let topTag = 'Architecture';
  let topTitle = 'eSmiles Backend Academy';
  if (activeView === 'lesson' && currentLesson) {
    topTag = currentLesson.tag;
    topTitle = currentLesson.title;
  } else if (activeView === 'sprint-exam' && currentSprintExam) {
    topTag = 'Sprint Exam';
    topTitle = currentSprintExam.title;
  } else if (activeView === 'final-exam') {
    topTag = 'Graduation';
    topTitle = FINAL_EXAM.title || 'Thi Tốt Nghiệp';
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
        <Topbar tag={topTag} title={topTitle} streakDays={state.streakDays} />

        <section className="content-viewport">
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
    </div>
  );
};

export default App;
