export interface UserProfile {
  isTestAccount?: boolean;
  status?: "active" | "suspended";
  version?: number;
  dataOrigin?: "real" | "test";
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin' | 'instructor';
  avatar?: string;
  avatarColor?: string;
  authProvider: 'google' | 'email';
  planId: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  lastLoginAt: string;
}

export interface LearningHistoryRecord {
  id: string;
  userId: string;
  lessonId?: string;
  lessonTitle?: string;
  action:
    | 'theory_read'
    | 'quiz_passed'
    | 'quiz_failed'
    | 'code_passed'
    | 'lesson_completed'
    | 'sprint_passed'
    | 'sprint_unverified'
    | 'sprint_failed'
    | 'final_certified'
    | 'final_unverified'
    | 'final_failed'
    | 'registered'
    | 'certificate_issued'
    | string;
  score?: number;
  details?: string;
  timestamp: string;
}

export interface CoursePlan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: number;
  billingPeriod: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isActive: boolean;
}

export interface FinalExamResult {
  score: number;
  passed: boolean;
  studentName: string;
  certificateId: string;
  completedAt: string;
}

export interface CourseEnrollmentInfo {
  courseId: string;
  enrolledAt: string;
  lastAccessedAt: string;
  currentLessonId?: string;
}

export interface ClassroomCheckpointProgress {
  lessonId: string;
  courseId: string;
  completedCheckpointIds: string[];
  currentCheckpointIndex: number;
  sessionCompleted: boolean;
  updatedAt: string;
}

export interface UserProgressState {
  currentLessonId: string;
  completedLessons: Record<string, { completedAt: string }>;
  sprintExamScores: Record<number, { score: number; passed: boolean; completedAt: string }>;
  finalExam: FinalExamResult | null;
  streakDays: number;
  lastActiveDate: string;
  clearedLessons: Record<string, boolean>;
  quizScores?: Record<string, { score: number; passed: boolean; completedAt: string }>;
  activeCourseId?: string;
  activeCareerPathId?: string;
  enrolledCourses?: Record<string, CourseEnrollmentInfo>;
  courseSprintExamScores?: Record<string, Record<number, { score: number; passed: boolean; completedAt: string }>>;
  courseFinalExams?: Record<string, FinalExamResult | null>;
  classroomProgress?: Record<string, ClassroomCheckpointProgress>;
}

export interface AdminStats {
  totalUsers: number;
  totalRevenue: number | null;
  certifiedStudents: number;
  totalActivityLogs: number;
}
