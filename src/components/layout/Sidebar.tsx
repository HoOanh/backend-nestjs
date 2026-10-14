import React from 'react';
import './Sidebar.css';
import type { Sprint, Lesson } from '../../data/curriculum.ts';
import type { SprintExam } from '../../data/sprintExams.ts';
import {
  checkSprintExamUnlockStatus,
  checkFinalExamUnlockStatus
} from '../../utils/progressGuard.ts';

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
  isCollapsed?: boolean;
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
  isCollapsed = false,
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
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="logo-badge-img-wrap">
            <img src="/logo.png" alt="Arc Irobot" className="brand-logo-img" />
          </div>
          <div className="brand-info">
            <h1>Arc Irobot Academy</h1>
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
            Chế độ Xem trước (Admin Preview)
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {curriculum.map((sprint) => {
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
            <div key={sprint.sprintId} className="sprint-group">
              <div className="sprint-title-badge">
                <span>{sprint.sprintTitle.split(':')[0]}</span>
                <span>
                  {sprint.lessons.filter((l) => completedLessons[l.id]).length}/
                  {sprint.lessons.length} bài
                </span>
              </div>

              {sprint.lessons.map((lesson) => {
                const isCompleted = !!completedLessons[lesson.id];
                const isActive =
                  activeView === 'lesson' && currentLesson?.id === lesson.id;

                return (
                  <div
                    key={lesson.id}
                    className={`lesson-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectLesson(lesson.id)}
                    title={lesson.title}
                  >
                    <span className="status-icon">
                      {isCompleted ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : isActive ? (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="#38bdf8"
                          stroke="#38bdf8"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="7" />
                        </svg>
                      ) : (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#64748b"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="7" />
                        </svg>
                      )}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
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
                    ? `Kỳ thi khóa. Cần hoàn thành đủ ${sprintExamStatus.totalLessons} bài học trong Sprint này.`
                    : 'Kỳ thi đánh giá tiến độ Sprint'
                }
              >
                <span>
                  {!sprintExamStatus.unlocked
                    ? `Thi Sprint (${sprintExamStatus.completedLessonsCount}/${sprintExamStatus.totalLessons} bài)`
                    : sprintScore
                      ? sprintScore.passed
                        ? `Đã Đạt ${sprintScore.score}%`
                        : `Thi Lại ${sprintScore.score}%`
                      : 'Thi Sprint'}
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
              ? `Cần hoàn thành ${finalExamStatus.passedSprintsCount}/${finalExamStatus.totalSprints} kỳ thi để mở khóa tốt nghiệp.`
              : 'Kỳ thi tốt nghiệp toàn khóa Arc Irobot Academy'
          }
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {!finalExamStatus.unlocked && !finalExam?.passed ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            )}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>
              Thi Tốt Nghiệp Toàn Khóa
            </div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>
              {finalExam?.passed
                ? 'Đã Tốt Nghiệp (Xem Bằng)'
                : !finalExamStatus.unlocked
                  ? `Cần đạt ${finalExamStatus.totalSprints}/${finalExamStatus.totalSprints} Sprint (${finalExamStatus.passedSprintsCount}/${finalExamStatus.totalSprints})`
                  : 'Khảo Thí & Cấp Bằng'}
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
};
