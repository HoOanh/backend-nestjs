import React, { useState, useEffect, useRef } from 'react';
import './SprintExamView.css';
import type { SprintExam } from '../../data/sprintExams.ts';
import { CodeEvaluator, type TestOutcome } from '../../services/codeEvaluator.ts';
import { generateRandomExamQuestions, type RandomizedQuestion } from '../../utils/examRandomizer.ts';
import { CodeSandboxEditor } from '../lesson/CodeSandboxEditor.tsx';
import { FormattedText } from '../common/FormattedText.tsx';
import { SprintAIReviewCard } from './SprintAIReviewCard.tsx';

interface SprintExamViewProps {
  exam: SprintExam;
  existingScore?: { score: number; passed: boolean; completedAt: string };
  onExamSubmitted: (sprintId: number, score: number, passed: boolean) => void;
}

export interface ExamReviewData {
  quizScore: number;
  codeScore: number;
  finalScore: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  selectedAnswers: Record<string, number>;
  questions: RandomizedQuestion[];
  code: string;
  codeOutcome: TestOutcome;
  submittedAt: string;
}

export interface SprintExamAttempt {
  id: string;
  attemptNumber: number;
  submittedAt: string;
  quizScore: number;
  codeScore: number;
  finalScore: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  reviewData: ExamReviewData;
}

interface SprintExamDraft {
  questions: RandomizedQuestion[];
  selectedAnswers: Record<string, number>;
  code: string;
  timeLeft: number;
}

export const SprintExamView: React.FC<SprintExamViewProps> = ({ exam, existingScore, onExamSubmitted }) => {
  const STORAGE_REVIEW_KEY = `arc_sprint_exam_review_${exam.sprintId}`;
  const STORAGE_ATTEMPTS_KEY = `arc_sprint_exam_attempts_${exam.sprintId}`;
  const STORAGE_DRAFT_KEY = `arc_sprint_exam_draft_${exam.sprintId}`;

  // Read saved data from LocalStorage
  const loadSavedReview = (): ExamReviewData | null => {
    try {
      const saved = localStorage.getItem(STORAGE_REVIEW_KEY);
      if (saved) return JSON.parse(saved) as ExamReviewData;
    } catch {}
    return null;
  };

  const loadSavedAttempts = (): SprintExamAttempt[] => {
    try {
      const saved = localStorage.getItem(STORAGE_ATTEMPTS_KEY);
      if (saved) return JSON.parse(saved) as SprintExamAttempt[];
    } catch {}
    return [];
  };

  const loadSavedDraft = (): SprintExamDraft | null => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SprintExamDraft;
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0 && parsed.timeLeft > 0) {
          return parsed;
        }
      }
    } catch {}
    return null;
  };

  const [activeQuestions, setActiveQuestions] = useState<RandomizedQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [code, setCode] = useState<string>(exam.codeChallenge.starterCode);
  const [timeLeft, setTimeLeft] = useState<number>(exam.timeLimitMinutes * 60);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [reviewData, setReviewData] = useState<ExamReviewData | null>(null);
  const [attempts, setAttempts] = useState<SprintExamAttempt[]>([]);
  const [activeTab, setActiveTab] = useState<'exam' | 'review' | 'history'>('exam');
  const [confirmModal, setConfirmModal] = useState<'retake' | 'incomplete-submit' | null>(null);
  const [examSection, setExamSection] = useState<'quiz' | 'code'>('quiz');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [quizViewMode, setQuizViewMode] = useState<'single' | 'all'>('single');

  // Initialize or restore session when sprintId changes
  useEffect(() => {
    const savedAttempts = loadSavedAttempts();
    const savedReview = loadSavedReview();
    const savedDraft = loadSavedDraft();
    setAttempts(savedAttempts);
    setConfirmModal(null);
    setExamSection('quiz');
    setCurrentQuestionIdx(0);

    if (savedDraft) {
      setReviewData(savedReview);
      setIsSubmitted(false);
      setActiveTab('exam');
      setActiveQuestions(savedDraft.questions);
      setSelectedAnswers(savedDraft.selectedAnswers || {});
      setCode(savedDraft.code || exam.codeChallenge.starterCode);
      setTimeLeft(savedDraft.timeLeft);
    } else if (savedReview) {
      setReviewData(savedReview);
      setIsSubmitted(true);
      setActiveTab('review');
      setActiveQuestions(savedReview.questions);
      setSelectedAnswers(savedReview.selectedAnswers);
      setCode(savedReview.code);
    } else {
      setIsSubmitted(false);
      startNewExamSession();
    }
  }, [exam.sprintId]);

  // Persist active exam draft so switching views or reloading doesn't lose progress
  useEffect(() => {
    if (isSubmitted || activeTab !== 'exam' || activeQuestions.length === 0) return;
    try {
      const draft: SprintExamDraft = {
        questions: activeQuestions,
        selectedAnswers,
        code,
        timeLeft
      };
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [STORAGE_DRAFT_KEY, isSubmitted, activeTab, activeQuestions, selectedAnswers, code, timeLeft]);

  // Start new randomized exam session
  const startNewExamSession = () => {
    try {
      localStorage.removeItem(STORAGE_DRAFT_KEY);
      localStorage.removeItem(`draft_sprint_exam_code_${exam.sprintId}`);
    } catch {}
    const picked = generateRandomExamQuestions(exam.questions, exam.questionCountToPick || 10);
    setActiveQuestions(picked);
    setSelectedAnswers({});
    setCode(exam.codeChallenge.starterCode);
    setTimeLeft(exam.timeLimitMinutes * 60);
    setIsSubmitted(false);
    setConfirmModal(null);
    setExamSection('quiz');
    setCurrentQuestionIdx(0);
    setActiveTab('exam');
  };

  // Timer countdown (only active during 'exam' mode and not submitted)
  // Does NOT depend on `code` or `selectedAnswers` so typing in the IDE never resets the 1-second interval.
  useEffect(() => {
    if (isSubmitted || activeTab !== 'exam') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [exam.sprintId, isSubmitted, activeTab]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (questionId: string, optIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optIdx
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitted) return;
    setConfirmModal(null);

    // 1. Calculate Quiz Score
    let correctCount = 0;
    activeQuestions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });
    const quizScore = Math.round((correctCount / (activeQuestions.length || 1)) * 100);

    // 2. Calculate Code Score (Evaluate all test cases including hidden)
    const codeOutcome = await CodeEvaluator.runTests(code, exam.codeChallenge.testCases, true);
    const codeScore = codeOutcome.passed
      ? 100
      : Math.round((codeOutcome.passedCount / (codeOutcome.total || 1)) * 100);

    // 3. Final Combined Score (50% trắc nghiệm + 50% thực hành code)
    const finalScore = Math.round(quizScore * 0.5 + codeScore * 0.5);
    const passed = finalScore >= exam.passingScore;

    const submittedData: ExamReviewData = {
      quizScore,
      codeScore,
      finalScore,
      passed,
      correctCount,
      totalQuestions: activeQuestions.length,
      selectedAnswers,
      questions: activeQuestions,
      code,
      codeOutcome,
      submittedAt: new Date().toISOString()
    };

    const newAttempt: SprintExamAttempt = {
      id: `attempt-${Date.now()}`,
      attemptNumber: attempts.length + 1,
      submittedAt: submittedData.submittedAt,
      quizScore,
      codeScore,
      finalScore,
      passed,
      correctCount,
      totalQuestions: activeQuestions.length,
      reviewData: submittedData
    };

    const updatedAttempts = [newAttempt, ...attempts];

    // Save to LocalStorage and clear active draft
    try {
      localStorage.setItem(STORAGE_REVIEW_KEY, JSON.stringify(submittedData));
      localStorage.setItem(STORAGE_ATTEMPTS_KEY, JSON.stringify(updatedAttempts));
      localStorage.removeItem(STORAGE_DRAFT_KEY);
    } catch (e) {
      console.error('Failed to save exam attempt to localStorage:', e);
    }

    setAttempts(updatedAttempts);
    setReviewData(submittedData);
    setIsSubmitted(true);
    setActiveTab('review');

    onExamSubmitted(exam.sprintId, finalScore, passed);
  };

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  // Trigger auto-submit cleanly when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && !isSubmitted && activeTab === 'exam' && activeQuestions.length > 0) {
      void handleSubmitRef.current();
    }
  }, [timeLeft, isSubmitted, activeTab, activeQuestions.length]);

  const answeredCount = Object.keys(selectedAnswers).length;

  // Best score calculation
  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.finalScore)) : (existingScore?.score || 0);
  const hasPassedEver = attempts.some((a) => a.passed) || Boolean(existingScore?.passed);

  return (
    <div className="exam-view-wrapper">
      {/* Exam Banner Header */}
      <div className="exam-banner">
        <div className="exam-info">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '6px'
            }}
          >
            <h2>{exam.title}</h2>
          </div>
          <FormattedText content={exam.description} />
          <p role="note">
            Kết quả luyện tập được chấm trong trình duyệt, chờ xác minh trên
            server. Điểm này chưa tự cấp chứng chỉ tốt nghiệp.
          </p>
          <div className="exam-badges-row">
            <span className="exam-pill">
              Ngân hàng: <strong>{exam.questions.length} câu</strong> (Bốc ngẫu
              nhiên <strong>{exam.questionCountToPick || 10} câu</strong>)
            </span>
            <span className="exam-pill">
              Điểm đạt: <strong>≥ {exam.passingScore}%</strong>
            </span>
            <span className="exam-pill">
              Thời gian: <strong>{exam.timeLimitMinutes} phút</strong>
            </span>
            {attempts.length > 0 && (
              <span
                className="exam-pill"
                style={{ borderColor: hasPassedEver ? '#10b981' : '#f59e0b' }}
              >
                Cao nhất:{' '}
                <strong
                  style={{ color: hasPassedEver ? '#10b981' : '#f59e0b' }}
                >
                  {bestScore}% ({hasPassedEver ? 'ĐÃ ĐẠT' : 'CHƯA ĐẠT'})
                </strong>
              </span>
            )}
          </div>
        </div>

        {activeTab === 'exam' && !isSubmitted ? (
          <div className={`exam-timer ${timeLeft <= 300 ? 'urgent' : ''}`}>
            <div className="timer-digits">{formatTimer(timeLeft)}</div>
            <div className="timer-label">
              {timeLeft <= 300 ? 'Sắp hết giờ!' : 'Thời gian còn lại'}
            </div>
          </div>
        ) : (
          <div className={`exam-timer ${hasPassedEver ? 'completed' : ''}`}>
            <div className="timer-digits">
              {reviewData
                ? `${reviewData.finalScore}%`
                : existingScore
                  ? `${existingScore.score}%`
                  : '--'}
            </div>
            <div className="timer-label">
              {reviewData
                ? reviewData.passed
                  ? 'ĐÃ ĐẠT'
                  : 'CHƯA ĐẠT'
                : existingScore?.passed
                  ? 'ĐÃ ĐẠT'
                  : 'CHƯA THI'}
            </div>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div
          className="exam-confirm-modal-backdrop"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="exam-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {confirmModal === 'retake' ? (
              <>
                <h4>Bắt đầu lượt thi Sprint mới?</h4>
                <p>
                  Bộ đếm thời gian sẽ đặt lại về{' '}
                  <strong>{exam.timeLimitMinutes} phút</strong> và hệ thống sẽ
                  bốc thăm ngẫu nhiên{' '}
                  <strong>{exam.questionCountToPick || 10} câu hỏi mới</strong>{' '}
                  từ ngân hàng đề. Kết quả các lần thi trước vẫn được lưu trong
                  tab Lịch Sử Thi.
                </p>
                <div className="exam-confirm-modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setConfirmModal(null)}
                  >
                    Hủy
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={startNewExamSession}
                  >
                    Bắt Đầu Đề Mới
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4>Đại ca chưa trả lời hết câu hỏi lý thuyết!</h4>
                <p>
                  Hiện tại đại ca mới chọn đáp án cho{' '}
                  <strong>
                    {answeredCount}/{activeQuestions.length} câu hỏi
                  </strong>{' '}
                  (còn{' '}
                  <strong style={{ color: '#f87171' }}>
                    {activeQuestions.length - answeredCount} câu bỏ trống
                  </strong>
                  ). Các câu bỏ trống sẽ tính 0 điểm. Đại ca có chắc chắn muốn
                  nộp bài ngay không?
                </p>
                <div className="exam-confirm-modal-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setConfirmModal(null)}
                  >
                    Quay Lại Làm Tiếp
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void handleSubmit()}
                  >
                    Vẫn Nộp Bài Ngay
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      {(isSubmitted || attempts.length > 0 || reviewData) && (
        <div className="exam-mode-tabs">
          <button
            className={`mode-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            Bảng Điểm & Sửa Bài (Review)
          </button>
          <button
            className={`mode-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Lịch Sử Thi ({attempts.length} lần)
          </button>
          <button
            className={`mode-tab-btn ${activeTab === 'exam' ? 'active' : ''}`}
            onClick={() => {
              if (isSubmitted) {
                setConfirmModal('retake');
              } else {
                setActiveTab('exam');
              }
            }}
          >
            {isSubmitted ? 'Làm Bài Lại (Đề Mới)' : 'Đang Làm Bài Thi'}
          </button>
        </div>
      )}

      {/* TAB 1: REVIEW MODE VIEW */}
      {activeTab === 'review' && reviewData && (
        <div className="exam-review-container">
          {/* Scorecard Hero */}
          <div
            className={`scorecard-hero ${reviewData.passed ? 'passed' : 'failed'}`}
          >
            <div className="scorecard-main">
              <div className="score-circle">
                <span className="score-num">{reviewData.finalScore}%</span>
                <span className="score-sub">TỔNG ĐIỂM</span>
              </div>
              <div className="scorecard-text">
                <h3>
                  {reviewData.passed
                    ? 'ĐẠT CHỈ TIÊU KỲ THI SPRINT'
                    : 'CHƯA ĐẠT CHỈ TIÊU YÊU CẦU'}
                </h3>
                <p>
                  {reviewData.passed
                    ? `Đại ca đã hoàn thành Sprint ${exam.sprintId} với ${reviewData.finalScore}% (tiêu chuẩn ≥ ${exam.passingScore}%). Hoàn thành vào lúc ${new Date(reviewData.submittedAt).toLocaleTimeString('vi-VN')} ngày ${new Date(reviewData.submittedAt).toLocaleDateString('vi-VN')}.`
                    : `Điểm của đại ca là ${reviewData.finalScore}% (tiêu chuẩn yêu cầu ≥ ${exam.passingScore}%). Hãy xem lại chi tiết bài làm bên dưới và bấm nút "Làm Bài Lại" để thử sức với đề mới.`}
                </p>
                <div className="score-breakdown-row">
                  <div className="score-item">
                    <span>Trắc Nghiệm (50%):</span>
                    <strong>
                      {reviewData.quizScore}% ({reviewData.correctCount}/
                      {reviewData.totalQuestions} câu đúng)
                    </strong>
                  </div>
                  <div className="score-item">
                    <span>Thực Hành Code (50%):</span>
                    <strong>
                      {reviewData.codeScore}% (
                      {reviewData.codeOutcome.passedCount}/
                      {reviewData.codeOutcome.total} tests đạt)
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI TUTOR ENGINEERING REVIEW CARD */}
          <SprintAIReviewCard
            sprintId={exam.sprintId}
            examTitle={exam.title}
            reviewData={reviewData}
            passingScore={exam.passingScore}
          />

          {/* SECTION 1: QUIZ REVIEW */}
          <div className="review-section">
            <div className="review-section-header">
              <h3>
                Phần 1: Khảo Thí Trắc Nghiệm ({reviewData.correctCount}/
                {reviewData.totalQuestions} câu đúng — {reviewData.quizScore}%)
              </h3>
            </div>

            <div className="review-questions-list">
              {reviewData.questions.map((q, idx) => {
                const userChoice = reviewData.selectedAnswers[q.id];
                const isUnanswered = userChoice === undefined;
                const isCorrect = !isUnanswered && userChoice === q.correctIndex;

                return (
                  <div
                    key={q.id}
                    className={`review-question-card ${isCorrect ? 'is-correct' : isUnanswered ? 'is-unanswered' : 'is-wrong'}`}
                  >
                    <div className="review-question-header">
                      <div className="review-status-badge">
                        {isCorrect
                          ? 'ĐÚNG (+10đ)'
                          : isUnanswered
                            ? 'CHƯA TRẢ LỜI (0đ)'
                            : 'SAI (0đ)'}
                      </div>
                      <div className="review-question-title">
                        <strong>Câu {idx + 1}:</strong>
                        <FormattedText content={q.question} />
                      </div>
                    </div>

                    <div className="review-options-grid">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = userChoice === optIdx;
                        const isTheCorrectOne = q.correctIndex === optIdx;

                        let optClass = 'review-opt';
                        if (isTheCorrectOne) optClass += ' correct-answer';
                        if (isSelected && !isTheCorrectOne)
                          optClass += ' user-wrong-choice';

                        return (
                          <div key={optIdx} className={optClass}>
                            <div className="opt-letter">
                              {String.fromCharCode(65 + optIdx)}.
                            </div>
                            <div className="opt-content">
                              <FormattedText content={opt} />
                              {isTheCorrectOne && isSelected && (
                                <span className="answer-tag correct-user">
                                  ✓ Đại ca chọn chính xác
                                </span>
                              )}
                              {isTheCorrectOne && !isSelected && (
                                <span className="answer-tag correct">
                                  Đáp án chuẩn
                                </span>
                              )}
                              {isSelected && !isTheCorrectOne && (
                                <span className="answer-tag wrong">
                                  Lựa chọn của đại ca
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Deep Technical Explanation */}
                    <div className="review-explanation-box">
                      <div className="exp-badge">
                        Phân Tích & Giải Thích Kỹ Thuật:
                      </div>
                      <FormattedText
                        content={q.explanation}
                        className="exp-text"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: CODE LAB REVIEW */}
          <div className="review-section">
            <div className="review-section-header">
              <h3>Phần 2: Đánh Giá Lab Code ({reviewData.codeScore}%)</h3>
            </div>

            <div className="review-code-card">
              <div className="code-challenge-title">
                <h4>{exam.codeChallenge.title}</h4>
                <FormattedText content={exam.codeChallenge.description} />
              </div>

              {reviewData.codeOutcome.syntaxError && (
                <div className="review-syntax-error-banner">
                  <strong>
                    Lỗi Biên Dịch / Thực Thi (Syntax / Runtime Error):
                  </strong>
                  <code>{reviewData.codeOutcome.syntaxError}</code>
                </div>
              )}

              {/* Test Cases Outcome Table */}
              {reviewData.codeOutcome.results.length > 0 && (
                <div className="test-outcome-table">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Mô Tả Kiểm Thử</th>
                        <th>Trạng Thái</th>
                        <th>Kỳ Vọng (Expected)</th>
                        <th>Thực Tế (Received)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewData.codeOutcome.results.map((r, rIdx) => (
                        <tr
                          key={rIdx}
                          className={r.passed ? 'row-pass' : 'row-fail'}
                        >
                          <td>{rIdx + 1}</td>
                          <td>{r.description || `Test case ${rIdx + 1}`}</td>
                          <td>
                            <span
                              className={`status-pill ${r.passed ? 'pass' : 'fail'}`}
                            >
                              {r.passed ? 'PASSED' : 'FAILED'}
                            </span>
                          </td>
                          <td>
                            <code>{String(r.expected)}</code>
                          </td>
                          <td>
                            <code>
                              {r.error
                                ? `Error: ${r.error}`
                                : String(r.received)}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Code Submitted Viewer */}
              <div className="submitted-code-viewer">
                <div className="code-viewer-label">
                  Mã nguồn đại ca đã nộp:
                </div>
                <pre className="code-snippet-pre">
                  <code>{reviewData.code}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATTEMPTS HISTORY VIEW */}
      {activeTab === 'history' && (
        <div className="exam-attempts-wrapper">
          <div className="attempts-stats-cards">
            <div className="attempt-stat-card highlight">
              <span className="stat-label">Tổng Lượt Thi</span>
              <span className="stat-value">{attempts.length} lần</span>
            </div>
            <div className="attempt-stat-card success-card">
              <span className="stat-label">Điểm Cao Nhất</span>
              <span className="stat-value">{bestScore}%</span>
            </div>
            <div className="attempt-stat-card">
              <span className="stat-label">Lần Thi Gần Nhất</span>
              <span className="stat-value">
                {attempts[0]?.finalScore ?? '--'}%
              </span>
            </div>
            <div className="attempt-stat-card">
              <span className="stat-label">Trạng Thái Chuẩn</span>
              <span
                className="stat-value"
                style={{ color: hasPassedEver ? '#10b981' : '#f87171' }}
              >
                {hasPassedEver ? 'ĐÃ ĐẠT' : 'CHƯA ĐẠT'}
              </span>
            </div>
          </div>

          <div className="attempts-table-container">
            {attempts.length === 0 ? (
              <div className="empty-attempts-notice">
                <p>
                  Đại ca chưa có lịch sử làm bài nào cho Sprint này. Hãy bấm
                  "Làm Bài Lại" để bắt đầu thử sức.
                </p>
              </div>
            ) : (
              <table className="attempts-table">
                <thead>
                  <tr>
                    <th>Lần Thi</th>
                    <th>Thời Gian Nộp</th>
                    <th>Trắc Nghiệm</th>
                    <th>Thực Hành Code</th>
                    <th>Tổng Điểm</th>
                    <th>Kết Quả</th>
                    <th>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((att) => (
                    <tr key={att.id}>
                      <td>
                        <span className="attempt-badge-num">
                          #{att.attemptNumber}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div>
                            {new Date(att.submittedAt).toLocaleTimeString(
                              'vi-VN'
                            )}
                          </div>
                          <small style={{ color: 'var(--text-muted)' }}>
                            {new Date(att.submittedAt).toLocaleDateString(
                              'vi-VN'
                            )}
                          </small>
                        </div>
                      </td>
                      <td>
                        <strong>{att.quizScore}%</strong> ({att.correctCount}/
                        {att.totalQuestions} câu)
                      </td>
                      <td>
                        <strong>{att.codeScore}%</strong>
                      </td>
                      <td>
                        <strong style={{ fontSize: '15px' }}>
                          {att.finalScore}%
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`attempt-score-pill ${att.passed ? 'passed' : 'failed'}`}
                        >
                          {att.passed ? 'ĐẠT CHUẨN' : 'CHƯA ĐẠT'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-view-attempt"
                          onClick={() => {
                            setReviewData(att.reviewData);
                            setActiveQuestions(att.reviewData.questions);
                            setSelectedAnswers(att.reviewData.selectedAnswers);
                            setCode(att.reviewData.code);
                            setActiveTab('review');
                          }}
                        >
                          Xem Lại
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: EXAM TAKING VIEW */}
      {activeTab === 'exam' && (
        <div className="exam-taking-container">
          {/* STICKY EXAM HUD: Timer + Section Switcher + Question Progress Pills */}
          <div className="exam-sticky-hud">
            <div className="exam-hud-top-row">
              <div className="exam-hud-section-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={examSection === 'quiz'}
                  className={`exam-hud-section-btn ${examSection === 'quiz' ? 'active' : ''}`}
                  onClick={() => setExamSection('quiz')}
                >
                  <span className="hud-step-badge">Phần 1</span>
                  <span>Trắc Nghiệm Lý Thuyết</span>
                  <span className="hud-count-pill">
                    {answeredCount}/{activeQuestions.length} câu
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={examSection === 'code'}
                  className={`exam-hud-section-btn ${examSection === 'code' ? 'active' : ''}`}
                  onClick={() => setExamSection('code')}
                >
                  <span className="hud-step-badge">Phần 2</span>
                  <span>Bài Tập Code Thực Hành</span>
                  <span className="hud-count-pill">50% điểm</span>
                </button>
              </div>

              <div className="exam-hud-right-controls">
                {examSection === 'quiz' && (
                  <button
                    type="button"
                    className="exam-view-mode-toggle"
                    onClick={() =>
                      setQuizViewMode((prev) =>
                        prev === 'single' ? 'all' : 'single'
                      )
                    }
                    title="Chuyển đổi giữa chế độ làm từng câu (Next/Prev) hoặc xem danh sách"
                  >
                    {quizViewMode === 'single'
                      ? 'Hiển thị: Từng câu (1/1)'
                      : 'Hiển thị: Tất cả câu'}
                  </button>
                )}

                <div
                  className={`exam-hud-timer-pill ${timeLeft <= 300 ? 'urgent' : ''}`}
                  title="Thời gian làm bài còn lại"
                >
                  <span className="hud-timer-label">Còn lại:</span>
                  <strong className="hud-timer-digits">
                    {formatTimer(timeLeft)}
                  </strong>
                </div>

                <button
                  type="button"
                  className="btn btn-primary exam-hud-submit-btn"
                  onClick={() => {
                    if (answeredCount < activeQuestions.length) {
                      setConfirmModal('incomplete-submit');
                    } else {
                      void handleSubmit();
                    }
                  }}
                >
                  Nộp Bài Thi ({answeredCount}/{activeQuestions.length})
                </button>
              </div>
            </div>

            <div className="exam-hud-bottom-row">
              <div className="exam-question-nav-grid">
                {activeQuestions.map((q, idx) => {
                  const isAnswered = selectedAnswers[q.id] !== undefined;
                  const isCurrent =
                    examSection === 'quiz' && idx === currentQuestionIdx;
                  const chosenLetter = isAnswered
                    ? String.fromCharCode(65 + selectedAnswers[q.id])
                    : '';
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`exam-q-nav-pill ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}`}
                      onClick={() => {
                        setExamSection('quiz');
                        setCurrentQuestionIdx(idx);
                        if (quizViewMode === 'all') {
                          setTimeout(() => {
                            const el = document.getElementById(
                              `sprint-exam-q-${idx + 1}`
                            );
                            el?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center'
                            });
                          }, 20);
                        }
                      }}
                      title={
                        isAnswered
                          ? `Câu ${idx + 1}: Đã chọn đáp án ${chosenLetter}`
                          : `Câu ${idx + 1}: Chưa trả lời`
                      }
                    >
                      <span>{idx + 1}</span>
                      {isAnswered && (
                        <small className="pill-chosen-letter">
                          {chosenLetter}
                        </small>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={`exam-q-nav-pill code-lab-pill ${examSection === 'code' ? 'current' : ''}`}
                  onClick={() => setExamSection('code')}
                  title="Chuyển sang Phần 2: Bài Tập Code Thực Hành"
                >
                  &lt;/&gt; Code Lab
                </button>
              </div>

              <div className="exam-hud-progress-track">
                <div
                  className="exam-hud-progress-fill"
                  style={{
                    width: `${
                      activeQuestions.length > 0
                        ? Math.round(
                            (answeredCount / activeQuestions.length) * 100
                          )
                        : 0
                    }%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 1: QUIZ (SINGLE-QUESTION STEPPER OR FULL LIST) */}
          {examSection === 'quiz' && activeQuestions.length > 0 && (
            <div className="quiz-container" style={{ marginBottom: '32px' }}>
              {quizViewMode === 'single' ? (
                (() => {
                  const safeIdx =
                    currentQuestionIdx < activeQuestions.length
                      ? currentQuestionIdx
                      : 0;
                  const currentQ = activeQuestions[safeIdx];
                  const selectedOpt = selectedAnswers[currentQ.id];
                  const isLastQuestion =
                    safeIdx === activeQuestions.length - 1;

                  return (
                    <div
                      key={currentQ.id}
                      className="question-card single-step-question-card"
                    >
                      <div className="single-q-meta-bar">
                        <span className="single-q-step-indicator">
                          CÂU HỎI {safeIdx + 1} / {activeQuestions.length}
                        </span>
                        <span
                          className={`single-q-status-tag ${selectedOpt !== undefined ? 'is-answered' : 'is-pending'}`}
                        >
                          {selectedOpt !== undefined
                            ? `✓ Đã chọn đáp án ${String.fromCharCode(65 + selectedOpt)}`
                            : 'Chưa chọn đáp án'}
                        </span>
                      </div>

                      <div className="question-header">
                        <span className="question-num">Câu {safeIdx + 1}</span>
                        <div className="question-text">
                          <FormattedText content={currentQ.question} />
                        </div>
                      </div>

                      <div className="options-list">
                        {currentQ.options.map((opt, optIdx) => {
                          const isSelected = selectedOpt === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={`option-item ${isSelected ? 'selected' : ''}`}
                              onClick={() =>
                                handleSelectOption(currentQ.id, optIdx)
                              }
                            >
                              <span className="opt-index-badge">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <div className="opt-text">
                                <FormattedText content={opt} />
                              </div>
                              {isSelected && (
                                <span className="opt-selected-check">
                                  ✓ Đã chọn
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Step-by-Step Navigation Footer */}
                      <div className="question-step-nav-footer">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={safeIdx === 0}
                          onClick={() =>
                            setCurrentQuestionIdx((prev) =>
                              Math.max(0, prev - 1)
                            )
                          }
                        >
                          ← Câu trước
                        </button>

                        <div className="question-step-hint">
                          Đã hoàn thành{' '}
                          <strong>
                            {answeredCount}/{activeQuestions.length}
                          </strong>{' '}
                          câu trắc nghiệm
                        </div>

                        {!isLastQuestion ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() =>
                              setCurrentQuestionIdx((prev) =>
                                Math.min(activeQuestions.length - 1, prev + 1)
                              )
                            }
                          >
                            Câu tiếp theo (Câu {safeIdx + 2}) →
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => setExamSection('code')}
                          >
                            Sang Phần 2: Bài Tập Code Thực Hành →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <>
                  {activeQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      id={`sprint-exam-q-${idx + 1}`}
                      className="question-card"
                      onClick={() => setCurrentQuestionIdx(idx)}
                    >
                      <div className="question-header">
                        <span className="question-num">Câu {idx + 1}</span>
                        <div className="question-text">
                          <FormattedText content={q.question} />
                        </div>
                      </div>
                      <div className="options-list">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = selectedAnswers[q.id] === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={`option-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleSelectOption(q.id, optIdx)}
                            >
                              <span className="opt-index-badge">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <div className="opt-text">
                                <FormattedText content={opt} />
                              </div>
                              {isSelected && (
                                <span className="opt-selected-check">
                                  ✓ Đã chọn
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="exam-section-bottom-actions">
                    <button
                      type="button"
                      className="btn btn-success btn-lg"
                      onClick={() => setExamSection('code')}
                    >
                      Chuyển sang Phần 2: Bài Tập Code Thực Hành →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SECTION 2: SPLIT-PANE CODEX SANDBOX LAB */}
          {examSection === 'code' && (
            <div id="sprint-exam-code-lab" className="exam-code-lab-section">
              <CodeSandboxEditor
                challenge={exam.codeChallenge}
                value={code}
                onChange={setCode}
                storageKey={`draft_sprint_exam_code_${exam.sprintId}`}
                fileName="solution.ts"
                filePath={`sprints > sprint-${exam.sprintId} > solution.ts`}
                headerBadge={`Thực Hành Sprint ${exam.sprintId} (50% Tổng Điểm)`}
                runVisibleButtonText="Chạy Thử (Visible Cases)"
                submitButtonText="Kiểm Tra & Chấm Điểm Thử"
              />

              <div className="exam-code-bottom-bar">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setExamSection('quiz')}
                >
                  ← Quay lại Phần 1: Trắc Nghiệm ({answeredCount}/
                  {activeQuestions.length} câu)
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => {
                    if (answeredCount < activeQuestions.length) {
                      setConfirmModal('incomplete-submit');
                    } else {
                      void handleSubmit();
                    }
                  }}
                >
                  Nộp Bài Thi & Xem Điểm Chi Tiết ({answeredCount}/
                  {activeQuestions.length} câu đã chọn)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

