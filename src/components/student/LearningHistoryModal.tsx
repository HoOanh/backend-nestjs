import React, { useState, useEffect } from 'react';
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
              <span className="hist-val">{Object.keys(sprintExamScores).length}/4</span>
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

        {/* Sprint Exam Results */}
        <div className="history-section">
          <h4>🎯 Kết Quả Các Kỳ Thi Sprint</h4>
          <div className="sprint-results-grid">
            {[1, 2, 3, 4].map((spId) => {
              const res = sprintExamScores[spId];
              return (
                <div key={spId} className={`sprint-res-card ${res ? (res.passed ? 'passed' : 'failed') : 'not-taken'}`}>
                  <div className="sprint-res-header">
                    <strong>Sprint 0{spId}</strong>
                    <span>{res ? `${res.score}%` : 'Chưa thi'}</span>
                  </div>
                  <span className="sprint-res-status">
                    {res ? (res.passed ? '✅ Đã Đạt Chuẩn' : '❌ Chưa Đạt') : '⚪ Chưa hoàn thành'}
                  </span>
                  {res && <small className="sprint-res-date">{new Date(res.completedAt).toLocaleDateString('vi-VN')}</small>}
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
