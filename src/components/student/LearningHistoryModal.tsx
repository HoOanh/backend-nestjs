import React, { useState, useEffect, useMemo } from 'react';
import './LearningHistoryModal.css';
import { UserProfile, LearningHistoryRecord } from '../../types/user.ts';
import { apiClient } from '../../services/apiClient.ts';
import { chatDbService } from '../../services/db/chatDbService.ts';
import { CURRICULUM } from '../../data/curriculum.ts';

interface LearningHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  completedLessons?: Record<string, { completedAt: string }> | string[];
  clearedLessons?: Record<string, boolean> | string[];
  quizScores?: Record<string, { score: number; passed: boolean; completedAt: string } | number>;
  sprintExamScores: Record<number, { score: number; passed: boolean; completedAt: string }>;
  finalExam: { score: number; passed: boolean; certificateId: string; completedAt: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  lesson_completed: 'Hoàn thành bài học',
  code_passed: 'Vượt qua Code Sandbox',
  quiz_passed: 'Đạt Trắc nghiệm',
  quiz_failed: 'Làm Trắc nghiệm',
  theory_read: 'Đã đọc Lý thuyết',
  sprint_passed: 'Đạt kỳ thi Sprint',
  sprint_failed: 'Thi Sprint chưa đạt',
  final_passed: 'Đạt kỳ thi Tốt nghiệp',
  final_failed: 'Thi Tốt nghiệp chưa đạt',
  certificate_issued: 'Cấp chứng chỉ',
  registered: 'Khởi tạo tài khoản',
};

export const LearningHistoryModal: React.FC<LearningHistoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  completedCount,
  totalLessons,
  progressPercent,
  completedLessons = {},
  clearedLessons = {},
  quizScores = {},
  sprintExamScores,
  finalExam,
}) => {
  const [history, setHistory] = useState<LearningHistoryRecord[]>([]);
  const [aiChatSummaries, setAiChatSummaries] = useState<
    Array<{
      sessionId: string;
      lessonId: string;
      title: string;
      messageCount: number;
      lastMessageAt: string;
      lastMessage?: string;
    }>
  >([]);

  useEffect(() => {
    if (isOpen) {
      if (currentUser?.id) {
        void apiClient.getHistory(currentUser.id).then(setHistory);
      }
      void chatDbService.getRecentChatSummary(currentUser?.id).then(setAiChatSummaries);
    }
  }, [isOpen, currentUser?.id]);

  // Build lesson progress items from completedLessons, clearedLessons, and quizScores
  const trackedLessonItems = useMemo(() => {
    const completedSet = new Set(
      Array.isArray(completedLessons) ? completedLessons : Object.keys(completedLessons || {})
    );
    const clearedSet = new Set(
      Array.isArray(clearedLessons)
        ? clearedLessons
        : Object.keys(clearedLessons || {}).filter((k) => Boolean((clearedLessons as Record<string, boolean>)[k]))
    );
    const result: Array<{
      id: string;
      title: string;
      chapterTitle: string;
      isCompleted: boolean;
      isCleared: boolean;
      quizScore?: number;
    }> = [];

    for (const chapter of CURRICULUM) {
      for (const lesson of chapter.lessons) {
        const isCompleted = completedSet.has(lesson.id);
        const isCleared = clearedSet.has(lesson.id);
        const rawQuiz = quizScores[lesson.id];
        const quizScore = typeof rawQuiz === 'number' ? rawQuiz : rawQuiz?.score;
        if (isCompleted || isCleared || quizScore !== undefined) {
          result.push({
            id: lesson.id,
            title: lesson.title,
            chapterTitle: chapter.sprintTitle,
            isCompleted,
            isCleared,
            quizScore,
          });
        }
      }
    }
    return result;
  }, [completedLessons, clearedLessons, quizScores]);

  if (!isOpen) return null;

  const getSprintAttemptCount = (sprintId: number): number => {
    try {
      const saved = localStorage.getItem(`arc_sprint_exam_attempts_${sprintId}`);
      if (saved) {
        const arr = JSON.parse(saved) as unknown[];
        return Array.isArray(arr) ? arr.length : 0;
      }
    } catch {}
    return 0;
  };

  const getFinalAttemptCount = (): number => {
    try {
      const saved = localStorage.getItem('arc_final_exam_attempts');
      if (saved) {
        const arr = JSON.parse(saved) as unknown[];
        return Array.isArray(arr) ? arr.length : 0;
      }
    } catch {}
    return 0;
  };

  const finalAttemptCount = getFinalAttemptCount();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content student-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="history-header-title">
            <span className="history-badge">HỒ SƠ HỌC TẬP</span>
            <h2>Lịch Sử & Kết Quả Học Tập Của {currentUser.name}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">✕</button>
        </div>

        {/* User Summary Card */}
        <div className="history-summary-card">
          <div className="history-user-info">
            <span
              className="user-avatar-lg"
              style={{ background: currentUser?.avatarColor || '#0ea5e9' }}
            >
              {(currentUser?.name || 'U').charAt(0).toUpperCase()}
            </span>
            <div>
              <h3>{currentUser?.name || 'Học Viên'}</h3>
              <p>{currentUser?.email || ''} • Gói: <strong style={{ color: '#f59e0b' }}>{(currentUser?.planId || 'free').toUpperCase()}</strong></p>
            </div>
          </div>

          <div className="history-stats-row">
            <div className="hist-stat">
              <span className="hist-val">{progressPercent}%</span>
              <span className="hist-lbl">Tiến Độ Toàn Khóa</span>
            </div>
            <div className="hist-stat">
              <span className="hist-val">{completedCount}/{totalLessons}</span>
              <span className="hist-lbl">Bài Học Đã Hoàn Thành</span>
            </div>
            <div className="hist-stat">
              <span className="hist-val">{Object.keys(sprintExamScores).length}/10</span>
              <span className="hist-lbl">Sprint Đã Thi</span>
            </div>
            <div className="hist-stat">
              <span className="hist-val" style={{ color: finalExam?.passed ? '#10b981' : '#64748b' }}>
                {finalExam?.passed ? 'Đã Tốt Nghiệp' : 'Đang Học'}
              </span>
              <span className="hist-lbl">Chứng Chỉ</span>
            </div>
          </div>
        </div>

        {/* Completed & In-Progress Lessons List */}
        <div className="history-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>Danh Sách Bài Học Đã Học & Hoàn Thành</h4>
            <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {trackedLessonItems.length} bài đã ghi nhận
            </span>
          </div>
          <div className="history-timeline-box" style={{ maxHeight: '220px' }}>
            {trackedLessonItems.length === 0 ? (
              <div className="empty-history">
                <p>Chưa có bài học nào được ghi nhận. Khi đọc lý thuyết, làm trắc nghiệm hoặc vượt qua bài tập Code Sandbox, tiến độ sẽ được lưu tự động tại đây.</p>
              </div>
            ) : (
              <div className="timeline-items">
                {trackedLessonItems.map((item) => (
                  <div key={item.id} className="timeline-row">
                    <div className="timeline-time" style={{ minWidth: '72px', fontFamily: 'var(--font-mono)' }}>
                      {item.id.toUpperCase()}
                    </div>
                    <div
                      className="timeline-dot"
                      style={{ background: item.isCompleted ? '#10b981' : '#0ea5e9' }}
                    />
                    <div className="timeline-content" style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong>{item.title}</strong>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {item.quizScore !== undefined && (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.14)', color: '#6366f1', fontWeight: 700 }}>
                              Quiz: {item.quizScore}%
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: item.isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                              color: item.isCompleted ? '#10b981' : '#0284c7',
                              fontWeight: 700,
                            }}
                          >
                            {item.isCompleted ? 'Đã hoàn thành' : 'Đã đọc lý thuyết'}
                          </span>
                        </div>
                      </div>
                      <span className="timeline-action">{item.chapterTitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Final Exam Highlight Card */}
        <div className="history-section">
          <h4>Khảo Thí Tốt Nghiệp Toàn Khóa (Final Exam)</h4>
          <div style={{
            background: finalExam?.passed
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.2) 100%)'
              : 'var(--bg-surface-elevated)',
            border: `1px solid ${finalExam?.passed ? '#10b981' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {finalExam?.passed ? 'ĐÃ TỐT NGHIỆP DANH DỰ' : (finalExam ? 'CHƯA ĐẠT ĐIỂM TỐT NGHIỆP' : 'CHƯA THAM GIA THI')}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {finalExam
                  ? `Điểm đạt được: ${finalExam.score}% • Đã thi ${finalAttemptCount > 0 ? finalAttemptCount : 1} lần`
                  : 'Hoàn thành 10 kỳ thi Sprint để mở khóa bài thi tốt nghiệp'}
              </div>
              {finalExam?.certificateId && (
                <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  Mã văn bằng: <strong>{finalExam.certificateId}</strong>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: finalExam?.passed ? '#10b981' : 'var(--text-muted)' }}>
                {finalExam ? `${finalExam.score}%` : '--'}
              </div>
              {finalExam?.completedAt && (
                <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {new Date(finalExam.completedAt).toLocaleDateString('vi-VN')}
                </small>
              )}
            </div>
          </div>
        </div>

        {/* Sprint Exam Results (10 Sprints) */}
        <div className="history-section">
          <h4>Kết Quả 10 Kỳ Thi Sprint (Chương 1 Đến Chương 10)</h4>
          <div className="sprint-results-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((spId) => {
              const res = sprintExamScores[spId];
              const attCount = getSprintAttemptCount(spId);
              return (
                <div key={spId} className={`sprint-res-card ${res ? (res.passed ? 'passed' : 'failed') : 'not-taken'}`}>
                  <div className="sprint-res-header">
                    <strong>Sprint {spId < 10 ? `0${spId}` : spId}</strong>
                    <span>{res ? `${res.score}%` : 'Chưa thi'}</span>
                  </div>
                  <span className="sprint-res-status">
                    {res ? (res.passed ? '✓ Đạt Chuẩn' : '✗ Chưa Đạt') : 'Chưa thi'}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    {attCount > 0 && (
                      <small style={{ color: 'var(--accent-primary)', fontSize: '11px' }}>
                        {attCount} lần thi
                      </small>
                    )}
                    {res && (
                      <small className="sprint-res-date" style={{ marginLeft: 'auto' }}>
                        {new Date(res.completedAt).toLocaleDateString('vi-VN')}
                      </small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Tutor Chat Conversations */}
        <div className="history-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>Lịch Sử Hỏi Đáp AI Tutor</h4>
            <span style={{ fontSize: '12px', color: '#0ea5e9', fontWeight: 600 }}>
              {aiChatSummaries.length} phiên trao đổi
            </span>
          </div>
          <div className="history-timeline-box" style={{ maxHeight: '240px' }}>
            {aiChatSummaries.length === 0 ? (
              <div className="empty-history">
                <p>Chưa có đoạn hội thoại nào với AI Tutor. Khi học các bài học, ĐẠI CA có thể mở Arc AI Co-Pilot để đặt câu hỏi và trao đổi trực tiếp.</p>
              </div>
            ) : (
              <div className="timeline-items">
                {aiChatSummaries.map((ses) => (
                  <div key={ses.sessionId} className="timeline-row">
                    <div className="timeline-time" style={{ minWidth: '90px' }}>
                      {new Date(ses.lastMessageAt).toLocaleDateString('vi-VN')}
                    </div>
                    <div className="timeline-dot" style={{ background: '#0ea5e9' }} />
                    <div className="timeline-content" style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{ses.title}</strong>
                        <span style={{ fontSize: '11px', background: 'rgba(14, 165, 233, 0.15)', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>
                          {ses.messageCount} tin nhắn · {ses.lessonId}
                        </span>
                      </div>
                      {ses.lastMessage && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ses.lastMessage.replace(/^>\s*💡[^\n]*\n*/, '').replace(/💡[^\n]*\n*/, '').trim()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Learning Activity Timeline */}
        <div className="history-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>Nhật Ký Hoạt Động Chi Tiết</h4>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {history.length} bản ghi
            </span>
          </div>
          <div className="history-timeline-box">
            {history.length === 0 ? (
              <div className="empty-history">
                <p>Chưa có nhật ký hoạt động chi tiết nào được ghi nhận cho tài khoản này.</p>
              </div>
            ) : (
              <div className="timeline-items">
                {history.map((item) => {
                  const dt = new Date(item.timestamp);
                  const dateStr = Number.isNaN(dt.getTime())
                    ? ''
                    : `${dt.toLocaleDateString('vi-VN')} ${dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
                  return (
                    <div key={item.id} className="timeline-row">
                      <div className="timeline-time" style={{ minWidth: '125px' }}>{dateStr}</div>
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <strong>{item.lessonTitle}</strong>
                        <span className="timeline-action">
                          {item.details || ACTION_LABELS[item.action] || item.action}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
