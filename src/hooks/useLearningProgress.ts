import { useState, useEffect, useRef } from 'react';
import { CURRICULUM } from '../data/curriculum.ts';
import { apiClient } from '../services/apiClient.ts';
import type { UserProfile, UserProgressState } from '../types/user.ts';

const INITIAL_PROGRESS: UserProgressState = {
  currentLessonId: 'c1-l1',
  completedLessons: {},
  sprintExamScores: {},
  finalExam: null,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  clearedLessons: {},
  quizScores: {}
};

function hydrateQuizScoresFromLocalStorage(base: UserProgressState): UserProgressState {
  if (typeof window === 'undefined' || !window.localStorage) return base;
  const quizScores = { ...(base.quizScores || {}) };
  const clearedLessons = { ...(base.clearedLessons || {}) };
  try {
    for (const sprint of CURRICULUM) {
      for (const lesson of sprint.lessons) {
        const raw = localStorage.getItem(`arc_quiz_result_${lesson.id}`);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            score?: number;
            passed?: boolean;
            submittedAt?: string;
          };
          if (typeof parsed.score === 'number') {
            const passed = Boolean(parsed.passed ?? parsed.score >= 70);
            quizScores[lesson.id] = {
              score: parsed.score,
              passed,
              completedAt: parsed.submittedAt || new Date().toISOString()
            };
            if (passed) {
              clearedLessons[lesson.id] = true;
            }
          }
        }
      }
    }
  } catch {}
  return {
    ...base,
    quizScores,
    clearedLessons
  };
}

export function useLearningProgress(activeUser: UserProfile | null) {
  const userKey = activeUser?.id || 'guest';
  const hydratedKeyRef = useRef<string | null>(null);

  const [state, setState] = useState<UserProgressState>(() => {
    const local = apiClient.readLocalProgress(userKey);
    const guest = userKey !== 'guest' ? apiClient.readLocalProgress('guest') : null;
    const merged = apiClient.mergeProgress(guest, local);
    return hydrateQuizScoresFromLocalStorage(merged || INITIAL_PROGRESS);
  });

  // Load progress from localStorage + Backend when user changes
  useEffect(() => {
    let cancelled = false;
    hydratedKeyRef.current = null;

    const local = apiClient.readLocalProgress(userKey);
    const guest = userKey !== 'guest' ? apiClient.readLocalProgress('guest') : null;
    const initialMerged = hydrateQuizScoresFromLocalStorage(
      apiClient.mergeProgress(guest, local)
    );
    setState(initialMerged);

    if (activeUser?.id) {
      void apiClient.getProgress(activeUser.id).then((savedProgress) => {
        if (cancelled) return;
        setState((prev) => {
          const combined = hydrateQuizScoresFromLocalStorage(
            apiClient.mergeProgress(prev, savedProgress)
          );
          apiClient.writeLocalProgress(activeUser.id, combined);
          return combined;
        });
        hydratedKeyRef.current = activeUser.id;
      });
    } else {
      hydratedKeyRef.current = 'guest';
    }

    return () => {
      cancelled = true;
    };
  }, [userKey, activeUser?.id]);

  // Save progress only AFTER hydration for the current userKey has completed
  useEffect(() => {
    if (hydratedKeyRef.current !== userKey) return;
    if (activeUser?.id) {
      void apiClient.saveProgress(activeUser.id, state);
    } else {
      apiClient.writeLocalProgress('guest', state);
    }
  }, [state, userKey, activeUser?.id]);

  const totalLessons = CURRICULUM.reduce((acc, sp) => acc + sp.lessons.length, 0);
  const completedCount = Object.keys(state.completedLessons).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const handleLessonCompleted = (lessonId: string, currentLessonTitle?: string) => {
    const now = new Date().toISOString();
    setState((prev) => {
      const next: UserProgressState = {
        ...prev,
        completedLessons: {
          ...prev.completedLessons,
          [lessonId]: prev.completedLessons[lessonId] || { completedAt: now }
        },
        clearedLessons: {
          ...prev.clearedLessons,
          [lessonId]: true
        },
        lastActiveDate: now.split('T')[0]
      };
      apiClient.writeLocalProgress(userKey, next);
      return next;
    });

    void apiClient.addHistory({
      userId: userKey,
      lessonId,
      lessonTitle: currentLessonTitle || lessonId,
      action: 'code_passed',
      score: 100,
      details: 'Hoàn thành bài tập thực hành Code Sandbox (vượt qua toàn bộ test cases)'
    });
  };

  const handleLessonCleared = (lessonId: string, currentLessonTitle?: string) => {
    const alreadyCleared = Boolean(state.clearedLessons[lessonId]);
    setState((prev) => {
      const next: UserProgressState = {
        ...prev,
        clearedLessons: {
          ...prev.clearedLessons,
          [lessonId]: true
        },
        lastActiveDate: new Date().toISOString().split('T')[0]
      };
      apiClient.writeLocalProgress(userKey, next);
      return next;
    });

    if (!alreadyCleared) {
      void apiClient.addHistory({
        userId: userKey,
        lessonId,
        lessonTitle: currentLessonTitle || lessonId,
        action: 'theory_read',
        details: 'Hoàn thành đọc lý thuyết và kiến trúc hệ thống của bài học'
      });
    }
  };

  const handleQuizSubmitted = (
    lessonId: string,
    currentLessonTitle: string,
    score: number,
    passed: boolean,
    correctCount?: number,
    totalQuestions?: number
  ) => {
    const now = new Date().toISOString();
    setState((prev) => {
      const existingQuiz = prev.quizScores?.[lessonId];
      const bestScore = existingQuiz ? Math.max(existingQuiz.score, score) : score;
      const everPassed = Boolean(existingQuiz?.passed || passed);
      const next: UserProgressState = {
        ...prev,
        clearedLessons: everPassed
          ? { ...prev.clearedLessons, [lessonId]: true }
          : prev.clearedLessons,
        quizScores: {
          ...(prev.quizScores || {}),
          [lessonId]: {
            score: bestScore,
            passed: everPassed,
            completedAt: now
          }
        },
        lastActiveDate: now.split('T')[0]
      };
      apiClient.writeLocalProgress(userKey, next);
      return next;
    });

    const detailRatio =
      typeof correctCount === 'number' && typeof totalQuestions === 'number'
        ? `đúng ${correctCount}/${totalQuestions} câu (${score}%)`
        : `điểm ${score}%`;

    void apiClient.addHistory({
      userId: userKey,
      lessonId,
      lessonTitle: currentLessonTitle || lessonId,
      action: passed ? 'quiz_passed' : 'quiz_failed',
      score,
      details: `Khảo thí trắc nghiệm: ${detailRatio} · ${passed ? 'Đạt yêu cầu' : 'Chưa đạt'}`
    });
  };

  const handleSprintExamSubmitted = async (sprintId: number, score: number, passed: boolean) => {
    setState((prev) => {
      const existing = prev.sprintExamScores[sprintId];
      const next: UserProgressState = {
        ...prev,
        sprintExamScores: {
          ...prev.sprintExamScores,
          [sprintId]: {
            score: existing ? Math.max(existing.score, score) : score,
            passed: Boolean(existing?.passed || passed),
            completedAt: new Date().toISOString()
          }
        }
      };
      apiClient.writeLocalProgress(userKey, next);
      return next;
    });

    if (activeUser?.id) {
      await apiClient.submitSprintExam(activeUser.id, sprintId, score, passed);
    }
  };

  const handleFinalExamSubmitted = async (score: number, passed: boolean, studentName: string) => {
    const studentDisplayName = studentName || activeUser?.name || 'Kỹ Sư Arc Irobot';
    if (activeUser?.id) {
      const res = await apiClient.submitFinalExam(activeUser.id, studentDisplayName, score, passed);
      setState((prev) => {
        const next = {
          ...prev,
          finalExam: res.finalResult
        };
        apiClient.writeLocalProgress(userKey, next);
        return next;
      });
    }
  };

  const handleRetakeFinalExam = () => {
    setState((prev) => ({
      ...prev,
      finalExam: null
    }));
  };

  return {
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
  };
}
