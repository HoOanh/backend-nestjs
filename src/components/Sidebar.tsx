import React from 'react';
import type { Sprint, Lesson } from '../data/curriculum.ts';
import type { SprintExam } from '../data/sprintExams.ts';
import {
  checkLessonUnlockStatus,
  checkSprintExamUnlockStatus,
  checkFinalExamUnlockStatus
} from '../utils/progressGuard.ts';

interface SidebarProps {
  curriculum: Sprint[];
  sprintExams: SprintExam[];
  activeView: 'lesson' | 'sprint-exam' | 'final-exam';
  currentLesson: Lesson | null;
  currentSprintExam?: SprintExam;
  completedLessons: Record<string, { completedAt: string }>;
  sprintExamScores: Record<number, { score: number; passed: boolean; completedAt: string }>;
  finalExam: { score: number; passed: boolean; studentName: string; certificateId: string; completedAt: string } | null;
  progressPercent: number;
  userRole?: string;
  bypassLock?: boolean;
  onSelectLesson: (lessonId: string) => void;
  onSelectSprintExam: (sprintId: number) => void;
  onSelectFinalExam: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  curriculum,
  sprintExams,
  activeView,
  currentLesson,
  currentSprintExam,
  completedLessons,
  sprintExamScores,
  finalExam,
  progressPercent,
  userRole,
  bypassLock = false,
  onSelectLesson,
  onSelectSprintExam,
  onSelectFinalExam
}) => {
  const finalExamStatus = checkFinalExamUnlockStatus(
    sprintExamScores,
    userRole,
    bypassLock,
    sprintExams
  );

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="logo-badge">🦷</div>
          <div className="brand-info">
            <h1>eSmiles Academy</h1>
            <span>React • NestJS 11 • Prisma 7</span>
          </div>
        </div>
      </div>

      <div className="sidebar-stats">
        <div className="progress-label-row">
          <span>Tiến độ toàn khóa</span>
          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{progressPercent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        {bypassLock && (
          <div className="admin-preview-pill">
            ⚡ Chế độ Xem trước (Admin Preview)
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {curriculum.map((sprint) => {
          const isSprintActive =
            activeView === 'sprint-exam' && currentSprintExam?.sprintId === sprint.sprintId;
          const sprintScore = sprintExamScores[sprint.sprintId];

          const sprintExamStatus = checkSprintExamUnlockStatus(
            sprint.sprintId,
            completedLessons,
            userRole,
            bypassLock,
            curriculum
          );

          return (
            <div key={sprint.sprintId} className="sprint-group">
              <div className="sprint-title-badge">
                <span>{sprint.sprintTitle.split(':')[0]}</span>
                <span>
                  {sprint.lessons.filter((l) => completedLessons[l.id]).length}/{sprint.lessons.length} bài
                </span>
              </div>

              {sprint.lessons.map((lesson) => {
                const isCompleted = !!completedLessons[lesson.id];
                const isActive =
                  activeView === 'lesson' && currentLesson?.id === lesson.id;
                const lessonStatus = checkLessonUnlockStatus(
                  lesson.id,
                  completedLessons,
                  userRole,
                  bypassLock,
                  curriculum
                );
                const isLocked = !lessonStatus.unlocked;

                return (
                  <div
                    key={lesson.id}
                    className={`lesson-nav-item ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                    onClick={() => onSelectLesson(lesson.id)}
                    title={
                      isLocked
                        ? `🔒 Bài học đang khóa. Cần hoàn thành: ${lessonStatus.requiredPreviousLesson?.title}`
                        : lesson.title
                    }
                  >
                    <span className="status-icon">
                      {isLocked ? '🔒' : isCompleted ? '✅' : isActive ? '🔵' : '⚪'}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: isLocked ? 0.6 : 1
                      }}
                    >
                      {lesson.title}
                    </span>
                  </div>
                );
              })}

              <div
                className={`sprint-exam-item ${isSprintActive ? 'active' : ''} ${
                  !sprintExamStatus.unlocked ? 'locked' : ''
                }`}
                onClick={() => onSelectSprintExam(sprint.sprintId)}
                title={
                  !sprintExamStatus.unlocked
                    ? `🔒 Kỳ thi khóa. Cần hoàn thành đủ ${sprintExamStatus.totalLessons} bài học trong Sprint này.`
                    : '🎯 Kỳ thi đánh giá tiến độ Sprint'
                }
              >
                <span>
                  {!sprintExamStatus.unlocked
                    ? `🔒 Thi Sprint (${sprintExamStatus.completedLessonsCount}/${sprintExamStatus.totalLessons} bài)`
                    : sprintScore
                    ? sprintScore.passed
                      ? `🏆 Đã Đạt ${sprintScore.score}%`
                      : `❌ Thi Lại ${sprintScore.score}%`
                    : '🎯 Thi Sprint'}
                </span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>
                  {sprintScore?.passed ? '(Đã xong)' : '(Đánh giá)'}
                </span>
              </div>
            </div>
          );
        })}

        <div
          className={`final-graduation-nav ${activeView === 'final-exam' ? 'active' : ''} ${
            !finalExamStatus.unlocked && !finalExam?.passed ? 'locked' : ''
          }`}
          onClick={onSelectFinalExam}
          title={
            !finalExamStatus.unlocked
              ? `🔒 Cần hoàn thành ${finalExamStatus.passedSprintsCount}/6 kỳ thi Sprint để mở khóa tốt nghiệp.`
              : '🎓 Kỳ thi tốt nghiệp toàn khóa eSmiles Academy'
          }
        >
          <span style={{ fontSize: '22px' }}>
            {!finalExamStatus.unlocked && !finalExam?.passed ? '🔒' : '🎓'}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>Thi Tốt Nghiệp Toàn Khóa</div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>
              {finalExam?.passed
                ? 'Đã Tốt Nghiệp (Xem Bằng)'
                : !finalExamStatus.unlocked
                ? `Cần đạt 6/6 Sprint (${finalExamStatus.passedSprintsCount}/6)`
                : 'Khảo Thí & Cấp Bằng'}
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
};
