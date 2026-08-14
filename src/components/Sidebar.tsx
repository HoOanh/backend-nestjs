import React from 'react';
import type { Sprint, Lesson } from '../data/curriculum.ts';
import type { SprintExam } from '../data/sprintExams.ts';

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
  onSelectLesson: (lessonId: string) => void;
  onSelectSprintExam: (sprintId: number) => void;
  onSelectFinalExam: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  curriculum,
  activeView,
  currentLesson,
  currentSprintExam,
  completedLessons,
  sprintExamScores,
  finalExam,
  progressPercent,
  onSelectLesson,
  onSelectSprintExam,
  onSelectFinalExam
}) => {
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
          <span>{progressPercent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <nav className="sidebar-nav">
        {curriculum.map((sprint) => {
          const isSprintActive =
            activeView === 'sprint-exam' && currentSprintExam?.sprintId === sprint.sprintId;
          const sprintScore = sprintExamScores[sprint.sprintId];

          return (
            <div key={sprint.sprintId} className="sprint-group">
              <div className="sprint-title-badge">
                <span>{sprint.sprintTitle.split(':')[0]}</span>
                <span>{sprint.lessons.length} bài</span>
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
                  >
                    <span className="status-icon">{isCompleted ? '✅' : '⚪'}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lesson.title}
                    </span>
                  </div>
                );
              })}

              <div
                className={`sprint-exam-item ${isSprintActive ? 'active' : ''}`}
                onClick={() => onSelectSprintExam(sprint.sprintId)}
              >
                <span>
                  {sprintScore
                    ? sprintScore.passed
                      ? `🏆 Đã Đạt ${sprintScore.score}%`
                      : `❌ Thi Lại ${sprintScore.score}%`
                    : '🎯 Thi Sprint'}
                </span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>(Đánh giá)</span>
              </div>
            </div>
          );
        })}

        <div
          className={`final-graduation-nav ${activeView === 'final-exam' ? 'active' : ''}`}
          onClick={onSelectFinalExam}
        >
          <span style={{ fontSize: '22px' }}>🎓</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>Thi Tốt Nghiệp Toàn Khóa</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              {finalExam?.passed ? 'Đã Tốt Nghiệp (Xem Bằng)' : 'Khảo Thí & Cấp Bằng'}
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
};
