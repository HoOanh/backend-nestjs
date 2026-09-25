import React, { useState, useEffect } from 'react';
import './LearningHistoryModal.css';
import { UserProfile, LearningHistoryRecord } from '../../types/user.ts';
import { apiClient } from '../../services/apiClient.ts';

interface LearningHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  sprintExamScores: Record<number, { score: number; passed: boolean; completedAt: string }>;
  finalExam: { score: number; passed: boolean; certificateId: string; completedAt: string } | null;
}

export const LearningHistoryModal: React.FC<LearningHistoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  completedCount,
  totalLessons,
  progressPercent,
  sprintExamScores,
  finalExam
}) => {
  const [history, setHistory] = useState<LearningHistoryRecord[]>([]);

  useEffect(() => {
    if (isOpen && currentUser?.id) {
      void apiClient.getHistory(currentUser.id).then(setHistory);
    }
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  // Helper to read local attempt counts
  const getSprintAttemptCount = (sprintId: number): number => {
    try {
      const saved = localStorage.getItem(`esmiles_sprint_exam_attempts_${sprintId}`);
      if (saved) {
        const arr = JSON.parse(saved) as unknown[];
        return Array.isArray(arr) ? arr.length : 0;
      }
    } catch {}
    return 0;
  };

  const getFinalAttemptCount = (): number => {
    try {
      const saved = localStorage.getItem('esmiles_final_exam_attempts');
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
            <span className="history-badge">📊 HỒ SƠ HỌC TẬP</span>
            <h2>Lịch Sử & Kết Quả Học Của {currentUser.name}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
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
              <span className="hist-lbl">Bài Học Đã Pass</span>
            </div>
            <div className="hist-stat">
              <span className="hist-val">{Object.keys(sprintExamScores).length}/10</span>
              <span className="hist-lbl">Sprint Đã Thi</span>
            </div>
            <div className="hist-stat">
              <span className="hist-val" style={{ color: finalExam?.passed ? '#10b981' : '#64748b' }}>
                {finalExam?.passed ? 'Tốt Nghiệp 🎓' : 'Đang Học'}
              </span>
              <span className="hist-lbl">Chứng Chỉ</span>
            </div>
          </div>
        </div>

        {/* Final Exam Highlight Card */}
        <div className="history-section">
          <h4>🏆 Khảo Thí Tốt Nghiệp Toàn Khóa (Final Exam)</h4>
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
                {finalExam?.passed ? '🎓 ĐÃ TỐT NGHIỆP DANH DỰ' : (finalExam ? '⚠️ CHƯA ĐẠT ĐIỂM TỐT NGHIỆP' : '⚪ CHƯA THAM GIA THI')}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {finalExam
                  ? `Điểm đạt được: ${finalExam.score}% • Đã thi ${finalAttemptCount > 0 ? finalAttemptCount : 1} lần`
                  : 'Hãy hoàn thành 10 kỳ thi Sprint để mở khóa bài thi tốt nghiệp'}
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
          <h4>🎯 Kết Quả 10 Kỳ Thi Sprint (Chương 1 Đến Chương 10)</h4>
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
                    {res ? (res.passed ? '✅ Đạt Chuẩn' : '❌ Chưa Đạt') : '⚪ Chưa thi'}
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

        {/* Learning Activity Timeline */}
        <div className="history-section">
          <h4>⏱️ Nhật Ký Hoạt Động Chi Tiết</h4>
          <div className="history-timeline-box">
            {history.length === 0 ? (
              <div className="empty-history">
                <p>Chưa có nhật ký học tập nào được ghi nhận cho tài khoản này. Hãy bắt đầu học và hoàn thành các bài tập!</p>
              </div>
            ) : (
              <div className="timeline-items">
                {history.map((item) => (
                  <div key={item.id} className="timeline-row">
                    <div className="timeline-time">{new Date(item.timestamp).toLocaleTimeString('vi-VN')}</div>
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <strong>{item.lessonTitle}</strong>
                      <span className="timeline-action">{item.details || item.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
