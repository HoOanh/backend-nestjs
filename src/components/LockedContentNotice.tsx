import React from 'react';
import type { Lesson } from '../data/curriculum.ts';
import type { SprintExam } from '../data/sprintExams.ts';

interface LockedContentNoticeProps {
  type: 'lesson' | 'sprint-exam' | 'final-exam';
  title: string;
  requiredPreviousLesson?: Lesson | null;
  missingLessons?: Lesson[];
  missingSprints?: SprintExam[];
  onNavigateToAvailable: () => void;
  isAdmin?: boolean;
  onBypassLock?: () => void;
}

export const LockedContentNotice: React.FC<LockedContentNoticeProps> = ({
  type,
  title,
  requiredPreviousLesson,
  missingLessons,
  missingSprints,
  onNavigateToAvailable,
  isAdmin,
  onBypassLock
}) => {
  return (
    <div className="locked-content-container">
      <div className="locked-card">
        <div className="locked-icon-badge">🔒</div>

        <div className="locked-badge-label">
          {type === 'lesson'
            ? 'BÀI HỌC CHƯA MỞ KHÓA'
            : type === 'sprint-exam'
            ? 'KỲ THI SPRINT CHƯA MỞ KHÓA'
            : 'KỲ THI TỐT NGHIỆP ĐANG BỊ KHÓA'}
        </div>

        <h2 className="locked-title">{title}</h2>

        <p className="locked-desc">
          {type === 'lesson' && requiredPreviousLesson && (
            <>
              Để mở khóa bài học này, bạn cần hoàn thành bài học trước đó:{' '}
              <strong style={{ color: 'var(--accent-primary)' }}>
                {requiredPreviousLesson.title}
              </strong>
              .
            </>
          )}

          {type === 'sprint-exam' && missingLessons && (
            <>
              Kỳ thi Sprint này yêu cầu bạn phải hoàn thành tất cả các bài học trong Sprint. Hiện còn{' '}
              <strong style={{ color: '#ef4444' }}>{missingLessons.length} bài chưa học xong</strong>:
            </>
          )}

          {type === 'final-exam' && missingSprints && (
            <>
              Kỳ thi Tốt nghiệp Toàn khóa yêu cầu bạn phải thi đạt <strong>100% (6/6) kỳ thi Sprint</strong>.
              Hiện bạn còn{' '}
              <strong style={{ color: '#ef4444' }}>{missingSprints.length} kỳ thi Sprint chưa đạt</strong>:
            </>
          )}
        </p>

        {/* Missing Sprint Lessons List */}
        {type === 'sprint-exam' && missingLessons && missingLessons.length > 0 && (
          <div className="locked-requirements-list">
            {missingLessons.map((l) => (
              <div key={l.id} className="locked-req-item">
                <span>⚪</span>
                <span>{l.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Missing Sprints List */}
        {type === 'final-exam' && missingSprints && missingSprints.length > 0 && (
          <div className="locked-requirements-list">
            {missingSprints.map((s) => (
              <div key={s.sprintId} className="locked-req-item">
                <span>🎯</span>
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        )}

        <div className="locked-actions">
          <button className="btn btn-primary" onClick={onNavigateToAvailable}>
            👉 Chuyển Đến Bài Học Tiếp Theo Cần Làm
          </button>

          {isAdmin && (
            <button className="btn btn-secondary" onClick={onBypassLock}>
              ⚡ Mở Khóa Chế Độ Preview (Quyền Admin)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
