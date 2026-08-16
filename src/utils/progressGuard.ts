import { CURRICULUM, type Lesson, type Sprint } from '../data/curriculum.ts';
import { SPRINT_EXAMS, type SprintExam } from '../data/sprintExams.ts';

/**
 * Returns a flat list of all lessons across all sprints in sequential order
 */
export function getAllLessonsInOrder(curriculum: Sprint[] = CURRICULUM): Lesson[] {
  const list: Lesson[] = [];
  for (const sprint of curriculum) {
    for (const lesson of sprint.lessons) {
      list.push(lesson);
    }
  }
  return list;
}

/**
 * Find the previous lesson in sequential order
 */
export function getPreviousLesson(lessonId: string, curriculum: Sprint[] = CURRICULUM): Lesson | null {
  const all = getAllLessonsInOrder(curriculum);
  const idx = all.findIndex((l) => l.id === lessonId);
  if (idx > 0) {
    return all[idx - 1];
  }
  return null;
}

/**
 * Find the next lesson in sequential order
 */
export function getNextLesson(lessonId: string, curriculum: Sprint[] = CURRICULUM): Lesson | null {
  const all = getAllLessonsInOrder(curriculum);
  const idx = all.findIndex((l) => l.id === lessonId);
  if (idx >= 0 && idx < all.length - 1) {
    return all[idx + 1];
  }
  return null;
}

/**
 * Find the first lesson that has not been completed yet
 */
export function getFirstIncompleteLessonId(
  completedLessons: Record<string, { completedAt: string }> = {},
  curriculum: Sprint[] = CURRICULUM
): string {
  const all = getAllLessonsInOrder(curriculum);
  for (const l of all) {
    if (!completedLessons[l.id]) {
      return l.id;
    }
  }
  return all[all.length - 1]?.id || 'lesson-1';
}

/**
 * Check if a lesson is unlocked for the current student
 */
export function checkLessonUnlockStatus(
  lessonId: string,
  completedLessons: Record<string, { completedAt: string }> = {},
  userRole?: string,
  bypassLock = false,
  curriculum: Sprint[] = CURRICULUM
): { unlocked: boolean; requiredPreviousLesson: Lesson | null } {
  // Admins and instructors can view all in preview mode
  if (userRole === 'admin' || userRole === 'instructor' || bypassLock) {
    return { unlocked: true, requiredPreviousLesson: null };
  }

  const all = getAllLessonsInOrder(curriculum);
  const targetIdx = all.findIndex((l) => l.id === lessonId);

  // Lesson 1 is always unlocked
  if (targetIdx <= 0) {
    return { unlocked: true, requiredPreviousLesson: null };
  }

  const prevLesson = all[targetIdx - 1];
  const isPrevCompleted = Boolean(completedLessons[prevLesson.id]);

  return {
    unlocked: isPrevCompleted,
    requiredPreviousLesson: isPrevCompleted ? null : prevLesson
  };
}

/**
 * Check if a Sprint Exam is unlocked
 * Condition: All lessons inside this Sprint must be completed
 */
export function checkSprintExamUnlockStatus(
  sprintId: number,
  completedLessons: Record<string, { completedAt: string }> = {},
  userRole?: string,
  bypassLock = false,
  curriculum: Sprint[] = CURRICULUM
): {
  unlocked: boolean;
  totalLessons: number;
  completedLessonsCount: number;
  missingLessons: Lesson[];
} {
  if (userRole === 'admin' || userRole === 'instructor' || bypassLock) {
    return {
      unlocked: true,
      totalLessons: 0,
      completedLessonsCount: 0,
      missingLessons: []
    };
  }

  const sprint = curriculum.find((s) => s.sprintId === sprintId);
  if (!sprint || sprint.lessons.length === 0) {
    return {
      unlocked: true,
      totalLessons: 0,
      completedLessonsCount: 0,
      missingLessons: []
    };
  }

  const missingLessons = sprint.lessons.filter((l) => !completedLessons[l.id]);
  const completedCount = sprint.lessons.length - missingLessons.length;

  return {
    unlocked: missingLessons.length === 0,
    totalLessons: sprint.lessons.length,
    completedLessonsCount: completedCount,
    missingLessons
  };
}

/**
 * Check if the Final Graduation Exam is unlocked
 * Condition: All Sprint Exams (Sprint 0 to 5) must be passed (score >= passingScore)
 */
export function checkFinalExamUnlockStatus(
  sprintExamScores: Record<number, { score: number; passed: boolean; completedAt: string }> = {},
  userRole?: string,
  bypassLock = false,
  sprintExams: SprintExam[] = SPRINT_EXAMS
): {
  unlocked: boolean;
  totalSprints: number;
  passedSprintsCount: number;
  missingSprints: SprintExam[];
} {
  if (userRole === 'admin' || userRole === 'instructor' || bypassLock) {
    return {
      unlocked: true,
      totalSprints: sprintExams.length,
      passedSprintsCount: sprintExams.length,
      missingSprints: []
    };
  }

  const missingSprints: SprintExam[] = [];
  let passedCount = 0;

  for (const exam of sprintExams) {
    const scoreObj = sprintExamScores[exam.sprintId];
    if (scoreObj && scoreObj.passed) {
      passedCount++;
    } else {
      missingSprints.push(exam);
    }
  }

  return {
    unlocked: missingSprints.length === 0,
    totalSprints: sprintExams.length,
    passedSprintsCount: passedCount,
    missingSprints
  };
}
