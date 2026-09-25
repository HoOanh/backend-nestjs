import { useState, useEffect } from 'react';
import { CURRICULUM } from '../data/curriculum.ts';
import { apiClient } from '../services/apiClient.ts';
import { STORAGE_KEYS } from '../constants/storage.ts';
import type { UserProfile, UserProgressState } from '../types/user.ts';

const INITIAL_PROGRESS: UserProgressState = {
  currentLessonId: 'lesson-1',
  completedLessons: {},
  sprintExamScores: {},
  finalExam: null,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  clearedLessons: {}
};

export function useLearningProgress(activeUser: UserProfile | null) {
  const [state, setState] = useState<UserProgressState>(() => {
    const storedUser = apiClient.getStoredUser();
    if (storedUser?.id) {
      try {
        const local = localStorage.getItem(`${STORAGE_KEYS.PROGRESS_PREFIX}${storedUser.id}`);
        if (local) return JSON.parse(local) as UserProgressState;
      } catch {}
    }
    return INITIAL_PROGRESS;
  });

  // Load progress from SQLite Backend when user changes
  useEffect(() => {
    if (activeUser?.id && activeUser.role !== 'admin') {
      void apiClient.getProgress(activeUser.id).then((savedProgress) => {
        if (savedProgress) {
          setState(savedProgress);
        }
      });
    }
  }, [activeUser?.id, activeUser?.role]);

  // Save progress to SQLite Backend
  useEffect(() => {
    if (activeUser?.id && activeUser.role !== 'admin') {
      void apiClient.saveProgress(activeUser.id, state);
    }
  }, [state, activeUser?.id, activeUser?.role]);

  const totalLessons = CURRICULUM.reduce((acc, sp) => acc + sp.lessons.length, 0);
  const completedCount = Object.keys(state.completedLessons).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const handleLessonCompleted = (lessonId: string, currentLessonTitle?: string) => {
    setState((prev) => ({
      ...prev,
      completedLessons: {
        ...prev.completedLessons,
        [lessonId]: { completedAt: new Date().toISOString() }
      }
    }));

    if (activeUser) {
      void apiClient.addHistory({
        userId: activeUser.id,
        lessonId,
        lessonTitle: currentLessonTitle || lessonId,
        action: 'code_passed',
        details: 'Đã hoàn thành xuất sắc bài tập Code Sandbox'
      });
    }
  };

  const handleLessonCleared = (lessonId: string, currentLessonTitle?: string) => {
    setState((prev) => ({
      ...prev,
      clearedLessons: {
        ...prev.clearedLessons,
        [lessonId]: true
      }
    }));

    if (activeUser) {
      void apiClient.addHistory({
        userId: activeUser.id,
        lessonId,
        lessonTitle: currentLessonTitle || lessonId,
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
    const studentDisplayName = studentName || activeUser?.name || 'Kỹ Sư Arc Irobot';
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

  return {
    state,
    setState,
    totalLessons,
    completedCount,
    progressPercent,
    handleLessonCompleted,
    handleLessonCleared,
    handleSprintExamSubmitted,
    handleFinalExamSubmitted,
    handleRetakeFinalExam
  };
}
