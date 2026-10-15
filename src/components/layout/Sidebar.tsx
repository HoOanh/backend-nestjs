import React from 'react';
import clsx from 'clsx';
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  Compass,
  FolderGit2,
  GraduationCap,
  History,
  LayoutGrid,
  Lock
} from 'lucide-react';
import './Sidebar.css';
import type { Sprint, Lesson, CourseDefinition } from '../../data/curriculum.ts';
import type { SprintExam } from '../../data/sprintExams.ts';
import type { ViewType } from '../../types/layout.ts';
import type { CourseEnrollmentInfo } from '../../types/user.ts';
import {
  checkSprintExamUnlockStatus,
  checkFinalExamUnlockStatus
} from '../../utils/progressGuard.ts';
import { getCourseTotalLessons, getCourseCompletedCount } from '../../data/courses.ts';

interface SidebarProps {
  curriculum: Sprint[];
  sprintExams: SprintExam[];
  activeView: ViewType;
  hubTab?: 'overview' | 'roadmaps' | 'catalog';
  activeCourse?: CourseDefinition;
  courses?: CourseDefinition[];
  enrolledCourses?: Record<string, CourseEnrollmentInfo>;
  currentLesson: Lesson | null;
  currentSprintExam?: SprintExam;
  completedLessons: Record<string, { completedAt: string }>;
  sprintExamScores: Record<number, { score: number; passed: boolean; completedAt: string }>;
  finalExam: {
    score: number;
    passed: boolean;
    studentName: string;
    certificateId: string;
    completedAt: string;
  } | null;
  progressPercent: number;
  userRole?: string;
  bypassLock?: boolean;
  isCollapsed?: boolean;
  onSelectLesson: (lessonId: string) => void;
  onSelectSprintExam: (sprintId: number) => void;
  onSelectFinalExam: () => void;
  onNavigateToHub?: (tab?: 'overview' | 'roadmaps' | 'catalog') => void;
  onSelectCourse?: (courseId: string) => void;
  onOpenHistory?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  curriculum,
  sprintExams,
  activeView,
  hubTab = 'overview',
  activeCourse,
  courses = [],
  enrolledCourses = {},
  currentLesson,
  currentSprintExam,
  completedLessons,
  sprintExamScores,
  finalExam,
  progressPercent,
  userRole,
  bypassLock = false,
  isCollapsed = false,
  onSelectLesson,
  onSelectSprintExam,
  onSelectFinalExam,
  onNavigateToHub,
  onSelectCourse,
  onOpenHistory
}) => {
  const isHubMode = activeView === 'courses-hub';

  const finalExamStatus = checkFinalExamUnlockStatus(
    sprintExamScores,
    userRole,
    bypassLock,
    sprintExams
  );

  const enrolledCourseList = courses.filter((c) =>
    c.id === 'backend-nestjs' ? true : Boolean(enrolledCourses[c.id])
  );
  const availableCourseList = courses.filter(
    (c) => c.id !== 'backend-nestjs' && !enrolledCourses[c.id]
  );

  return (
    <aside
      className={clsx(
        'app-sidebar flex flex-col bg-surface border-r border-subtle select-none shrink-0 transition-all duration-200',
        isCollapsed && 'collapsed'
      )}
    >
      {/* BRAND HEADER */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-subtle shrink-0">
        <button
          type="button"
          onClick={() => onNavigateToHub?.('overview')}
          className="flex items-center gap-3 text-left group cursor-pointer bg-transparent border-0 p-0 w-full min-w-0"
          title="Về Trung Tâm Học Viện Arc Irobot"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-subtle flex items-center justify-center shrink-0 overflow-hidden group-hover:border-accent transition-colors">
            <img src="/logo.png" alt="Arc Irobot" className="w-5 h-5 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-primary truncate leading-tight">
              Arc Irobot Academy
            </div>
            <div className="text-[11px] font-medium text-muted truncate">
              {isHubMode ? 'Engineering Learning Portal' : activeCourse?.shortTitle}
            </div>
          </div>
        </button>
      </div>

      {/* =================================================================
          MODE 1: ACADEMY HUB SIDEBAR (When browsing /courses or /roadmaps)
          Does NOT show any single course's lesson tree!
          ================================================================= */}
      {isHubMode ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
          {/* Primary Portal Navigation */}
          <div>
            <div className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              Điều Hướng Học Viện
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onNavigateToHub?.('overview')}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border',
                  hubTab === 'overview'
                    ? 'bg-accent/12 text-accent border-accent/35'
                    : 'bg-transparent text-secondary border-transparent hover:bg-surface-elevated hover:text-primary'
                )}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutGrid size={15} />
                  <span>Tổng Quan &amp; Khóa Đang Học</span>
                </span>
                <ChevronRight size={13} className="opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateToHub?.('roadmaps')}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border',
                  hubTab === 'roadmaps'
                    ? 'bg-accent/12 text-accent border-accent/35'
                    : 'bg-transparent text-secondary border-transparent hover:bg-surface-elevated hover:text-primary'
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Compass size={15} />
                  <span>Lộ Trình Kỹ Sư (Roadmaps)</span>
                </span>
                <ChevronRight size={13} className="opacity-60" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateToHub?.('catalog')}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border',
                  hubTab === 'catalog'
                    ? 'bg-accent/12 text-accent border-accent/35'
                    : 'bg-transparent text-secondary border-transparent hover:bg-surface-elevated hover:text-primary'
                )}
              >
                <span className="flex items-center gap-2.5">
                  <FolderGit2 size={15} />
                  <span>Kho Khóa Học ({courses.length})</span>
                </span>
                <ChevronRight size={13} className="opacity-60" />
              </button>

              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold bg-transparent text-secondary border border-transparent hover:bg-surface-elevated hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <History size={15} />
                    <span>Hồ Sơ &amp; Bảng Điểm</span>
                  </span>
                  <ChevronRight size={13} className="opacity-60" />
                </button>
              )}
            </div>
          </div>

          {/* Enrolled Courses Quick Access */}
          <div>
            <div className="px-2.5 pb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
              <span>Khóa Đang Theo Học</span>
              <span>{enrolledCourseList.length}</span>
            </div>
            <div className="space-y-1.5">
              {enrolledCourseList.map((courseItem) => {
                const total = getCourseTotalLessons(courseItem);
                const done = getCourseCompletedCount(courseItem, completedLessons);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <button
                    key={courseItem.id}
                    type="button"
                    onClick={() => onSelectCourse?.(courseItem.id)}
                    className="w-full text-left p-2.5 rounded-lg bg-surface-subtle hover:bg-surface-elevated border border-subtle hover:border-strong transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[12.5px] font-semibold text-primary group-hover:text-accent truncate">
                        {courseItem.shortTitle}
                      </span>
                      <span className="text-[10.5px] font-semibold text-muted shrink-0">
                        {done}/{total} bài
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Available Courses to Explore */}
          {availableCourseList.length > 0 && (
            <div>
              <div className="px-2.5 pb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
                <span>Khóa Học Khác Trên Hệ Thống</span>
                <span>{availableCourseList.length}</span>
              </div>
              <div className="space-y-1">
                {availableCourseList.map((courseItem) => (
                  <button
                    key={courseItem.id}
                    type="button"
                    onClick={() => onSelectCourse?.(courseItem.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-[12.5px] font-medium text-secondary hover:text-primary hover:bg-surface-elevated bg-transparent border border-transparent transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <BookOpen size={13} className="text-muted shrink-0" />
                      <span className="truncate">{courseItem.shortTitle}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-muted font-semibold shrink-0">
                      {getCourseTotalLessons(courseItem)} bài
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =================================================================
           MODE 2: COURSE CURRICULUM SIDEBAR (When studying inside a Course)
           Shows ONLY the active course's chapters, lessons & progress!
           ================================================================= */
        <>
          {/* Course Progress */}
          <div className="p-3 border-b border-subtle bg-surface-subtle space-y-2.5 shrink-0">
            <div>
              <div className="flex items-center justify-between text-[11.5px] mb-1">
                <span className="text-secondary font-medium">Tiến độ khóa hiện tại</span>
                <strong className="text-accent font-bold">{progressPercent}%</strong>
              </div>
              <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {bypassLock && (
                <div className="mt-2 px-2 py-1 rounded text-[11px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-500 text-center">
                  Chế độ Xem trước (Admin Preview)
                </div>
              )}
            </div>
          </div>

          {/* Course Chapters & Lessons List */}
          <nav className="sidebar-nav flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
            {curriculum.map((sprint) => {
              const hasSprintExam = sprintExams.some((e) => e.sprintId === sprint.sprintId);
              const isSprintActive =
                activeView === 'sprint-exam' &&
                currentSprintExam?.sprintId === sprint.sprintId;
              const sprintScore = sprintExamScores[sprint.sprintId];

              const sprintExamStatus = checkSprintExamUnlockStatus(
                sprint.sprintId,
                completedLessons,
                userRole,
                bypassLock,
                curriculum
              );

              return (
                <div key={sprint.sprintId} className="space-y-1">
                  <div className="px-2.5 py-1.5 rounded-md bg-surface-elevated/70 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-secondary">
                    <span className="truncate">{sprint.sprintTitle.split(':')[0]}</span>
                    <span className="text-muted shrink-0 ml-2">
                      {sprint.lessons.filter((l) => completedLessons[l.id]).length}/
                      {sprint.lessons.length} bài
                    </span>
                  </div>

                  <div className="space-y-0.5 pt-0.5">
                    {sprint.lessons.map((lesson) => {
                      const isCompleted = Boolean(completedLessons[lesson.id]);
                      const isActive =
                        activeView === 'lesson' && currentLesson?.id === lesson.id;

                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => onSelectLesson(lesson.id)}
                          title={lesson.title}
                          className={clsx(
                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[12.5px] transition-colors cursor-pointer border',
                            isActive
                              ? 'bg-accent/12 text-accent font-semibold border-accent/35'
                              : 'bg-transparent text-secondary hover:bg-surface-elevated hover:text-primary border-transparent font-medium'
                          )}
                        >
                          <span className="w-4 h-4 flex items-center justify-center shrink-0">
                            {isCompleted ? (
                              <Check size={14} className="text-emerald-500" strokeWidth={2.5} />
                            ) : isActive ? (
                              <Circle size={10} className="fill-accent text-accent" />
                            ) : (
                              <Circle size={10} className="text-muted" />
                            )}
                          </span>
                          <span className="truncate flex-1">{lesson.title}</span>
                        </button>
                      );
                    })}
                  </div>

                  {hasSprintExam && (
                    <button
                      type="button"
                      onClick={() => onSelectSprintExam(sprint.sprintId)}
                      title={
                        !sprintExamStatus.unlocked
                          ? `Kỳ thi khóa. Cần hoàn thành đủ ${sprintExamStatus.totalLessons} bài học trong Chương này.`
                          : 'Kỳ thi đánh giá tiến độ Chương'
                      }
                      className={clsx(
                        'w-full mt-1 flex items-center justify-between px-3 py-2 rounded-md text-[12px] font-semibold border transition-colors cursor-pointer',
                        isSprintActive
                          ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                          : !sprintExamStatus.unlocked
                            ? 'bg-surface-subtle border-subtle text-muted opacity-70'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:border-amber-500'
                      )}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Award size={13} className="shrink-0" />
                        <span className="truncate">
                          {!sprintExamStatus.unlocked
                            ? `Thi Chương (${sprintExamStatus.completedLessonsCount}/${sprintExamStatus.totalLessons} bài)`
                            : sprintScore
                              ? sprintScore.passed
                                ? `Đã Đạt ${sprintScore.score}%`
                                : `Thi Lại ${sprintScore.score}%`
                              : 'Thi Đánh Giá Chương'}
                        </span>
                      </span>
                      <span className="text-[10.5px] opacity-80 shrink-0 ml-2">
                        {sprintScore?.passed ? 'Đã xong' : 'Khảo thí'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}

            {sprintExams.length > 0 && (
              <button
                type="button"
                onClick={onSelectFinalExam}
                title={
                  !finalExamStatus.unlocked
                    ? `Cần hoàn thành ${finalExamStatus.passedSprintsCount}/${finalExamStatus.totalSprints} kỳ thi để mở khóa tốt nghiệp.`
                    : 'Kỳ thi tốt nghiệp toàn khóa Arc Irobot Academy'
                }
                className={clsx(
                  'w-full mt-3 p-3 rounded-lg border text-left flex items-center gap-3 transition-all cursor-pointer',
                  activeView === 'final-exam'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                    : !finalExamStatus.unlocked && !finalExam?.passed
                      ? 'bg-surface-subtle border-subtle text-muted opacity-75'
                      : 'bg-emerald-500/10 border-emerald-500/35 text-emerald-500 hover:border-emerald-500'
                )}
              >
                <span className="w-8 h-8 rounded-md bg-surface flex items-center justify-center shrink-0 border border-subtle">
                  {!finalExamStatus.unlocked && !finalExam?.passed ? (
                    <Lock size={15} />
                  ) : (
                    <GraduationCap size={16} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold truncate">
                    Thi Tốt Nghiệp Toàn Khóa
                  </div>
                  <div className="text-[11px] opacity-80 truncate">
                    {finalExam?.passed
                      ? 'Đã Tốt Nghiệp (Xem Bằng)'
                      : !finalExamStatus.unlocked
                        ? `Cần đạt ${finalExamStatus.passedSprintsCount}/${finalExamStatus.totalSprints} Chương`
                        : 'Khảo Thí & Cấp Bằng'}
                  </div>
                </div>
              </button>
            )}
          </nav>
        </>
      )}
    </aside>
  );
};
