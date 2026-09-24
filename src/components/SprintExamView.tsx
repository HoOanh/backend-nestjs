import React, { useState, useEffect } from 'react';
import type { SprintExam } from '../data/sprintExams.ts';
import { CodeEvaluator, type TestOutcome } from '../services/codeEvaluator.ts';
import { generateRandomExamQuestions, type RandomizedQuestion } from '../utils/examRandomizer.ts';
import { CodeSandboxEditor } from './CodeSandboxEditor.tsx';
import { FormattedText } from './FormattedText.tsx';

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

export const SprintExamView: React.FC<SprintExamViewProps> = ({ exam, existingScore, onExamSubmitted }) => {
  const STORAGE_REVIEW_KEY = `esmiles_sprint_exam_review_${exam.sprintId}`;
  const STORAGE_ATTEMPTS_KEY = `esmiles_sprint_exam_attempts_${exam.sprintId}`;

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

  const [activeQuestions, setActiveQuestions] = useState<RandomizedQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [code, setCode] = useState<string>(exam.codeChallenge.starterCode);
  const [timeLeft, setTimeLeft] = useState<number>(exam.timeLimitMinutes * 60);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [reviewData, setReviewData] = useState<ExamReviewData | null>(null);
  const [attempts, setAttempts] = useState<SprintExamAttempt[]>([]);
  const [activeTab, setActiveTab] = useState<'exam' | 'review' | 'history'>('exam');

  // Initialize or restore session when sprintId changes
  useEffect(() => {
    const savedAttempts = loadSavedAttempts();
    const savedReview = loadSavedReview();
    setAttempts(savedAttempts);

    if (savedReview) {
      setReviewData(savedReview);
      setIsSubmitted(true);
      setActiveTab('review');
      setActiveQuestions(savedReview.questions);
      setSelectedAnswers(savedReview.selectedAnswers);
      setCode(savedReview.code);
    } else if (existingScore) {
      // If user has existing score from backend but no local review, start fresh but mark score
      setIsSubmitted(false);
      startNewExamSession();
    } else {
      setIsSubmitted(false);
      startNewExamSession();
    }
  }, [exam.sprintId]);

  // Start new randomized exam session
  const startNewExamSession = () => {
    const picked = generateRandomExamQuestions(exam.questions, exam.questionCountToPick || 10);
    setActiveQuestions(picked);
    setSelectedAnswers({});
    setCode(exam.codeChallenge.starterCode);
    setTimeLeft(exam.timeLimitMinutes * 60);
    setIsSubmitted(false);
    setActiveTab('exam');
  };

  // Timer countdown (only active during 'exam' mode and not submitted)
  useEffect(() => {
    if (isSubmitted || activeTab !== 'exam') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exam.sprintId, isSubmitted, activeTab, activeQuestions, code, selectedAnswers]);

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

    // Save to LocalStorage
    try {
      localStorage.setItem(STORAGE_REVIEW_KEY, JSON.stringify(submittedData));
      localStorage.setItem(STORAGE_ATTEMPTS_KEY, JSON.stringify(updatedAttempts));
    } catch (e) {
      console.error('Failed to save exam attempt to localStorage:', e);
    }

    setAttempts(updatedAttempts);
    setReviewData(submittedData);
    setIsSubmitted(true);
    setActiveTab('review');

    onExamSubmitted(exam.sprintId, finalScore, passed);
  };

  // Best score calculation
  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.finalScore)) : (existingScore?.score || 0);
  const hasPassedEver = attempts.some((a) => a.passed) || Boolean(existingScore?.passed);

  return (
    <div className="exam-view-wrapper">
      {/* Exam Banner Header */}
      <div className="exam-banner">
        <div className="exam-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h2>🎯 {exam.title}</h2>
          </div>
          <FormattedText content={exam.description} />
          <div className="exam-badges-row">
            <span className="exam-pill">
              📚 Ngân hàng: <strong>{exam.questions.length} câu</strong> (Bốc ngẫu nhiên <strong>{exam.questionCountToPick || 10} câu</strong>)
            </span>
            <span className="exam-pill">
              🎯 Điểm đạt: <strong>≥ {exam.passingScore}%</strong>
            </span>
            <span className="exam-pill">
              ⏱️ Thời gian: <strong>{exam.timeLimitMinutes} phút</strong>
            </span>
            {attempts.length > 0 && (
              <span className="exam-pill" style={{ borderColor: hasPassedEver ? '#10b981' : '#f59e0b' }}>
                🏆 Cao nhất: <strong style={{ color: hasPassedEver ? '#10b981' : '#f59e0b' }}>{bestScore}% ({hasPassedEver ? 'ĐÃ ĐẠT' : 'CHƯA ĐẠT'})</strong>
              </span>
            )}
          </div>
        </div>

        {activeTab === 'exam' && !isSubmitted ? (
          <div className="exam-timer">
            <div className="timer-digits">{formatTimer(timeLeft)}</div>
            <div className="timer-label">Thời gian còn lại</div>
          </div>
        ) : (
          <div className={`exam-timer ${hasPassedEver ? 'completed' : ''}`}>
            <div className="timer-digits">{reviewData ? `${reviewData.finalScore}%` : (existingScore ? `${existingScore.score}%` : '--')}</div>
            <div className="timer-label">
              {reviewData ? (reviewData.passed ? '🏆 ĐÃ ĐẠT' : '❌ CHƯA ĐẠT') : (existingScore?.passed ? '🏆 ĐÃ ĐẠT' : 'CHƯA THI')}
            </div>
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      {(isSubmitted || attempts.length > 0 || reviewData) && (
        <div className="exam-mode-tabs">
          <button
            className={`mode-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            📊 Bảng Điểm & Sửa Bài (Review)
          </button>
          <button
            className={`mode-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📜 Lịch Sử Thi ({attempts.length} lần)
          </button>
          <button
            className={`mode-tab-btn ${activeTab === 'exam' ? 'active' : ''}`}
            onClick={() => {
              if (isSubmitted) {
                if (window.confirm('Đại ca có muốn bắt đầu một lượt thi mới? Bộ đếm thời gian sẽ reset và 10 câu hỏi ngẫu nhiên mới sẽ được bốc thăm.')) {
                  startNewExamSession();
                }
              } else {
                setActiveTab('exam');
              }
            }}
          >
            {isSubmitted ? '🔄 Làm Bài Lại (Đề Mới)' : '✍️ Đang Làm Bài Thi'}
          </button>
        </div>
      )}

      {/* TAB 1: REVIEW MODE VIEW */}
      {activeTab === 'review' && reviewData && (
        <div className="exam-review-container">
          {/* Scorecard Hero */}
          <div className={`scorecard-hero ${reviewData.passed ? 'passed' : 'failed'}`}>
            <div className="scorecard-main">
              <div className="score-circle">
                <span className="score-num">{reviewData.finalScore}%</span>
                <span className="score-sub">TỔNG ĐIỂM</span>
              </div>
              <div className="scorecard-text">
                <h3>{reviewData.passed ? '🎉 CHÚC MỪNG ĐẠI CA ĐÃ ĐẠT CHỈ TIÊU!' : '⚠️ CHƯA ĐẠT CHỈ TIÊU YÊU CẦU!'}</h3>
                <p>
                  {reviewData.passed
                    ? `Đại ca đã hoàn thành xuất sắc Sprint ${exam.sprintId} với ${reviewData.finalScore}% (vượt mức tiêu chuẩn ${exam.passingScore}%). Hoàn thành vào lúc ${new Date(reviewData.submittedAt).toLocaleTimeString('vi-VN')} ngày ${new Date(reviewData.submittedAt).toLocaleDateString('vi-VN')}.`
                    : `Điểm của đại ca là ${reviewData.finalScore}% (tiêu chuẩn yêu cầu ≥ ${exam.passingScore}%). Hãy xem lại chi tiết bài làm bên dưới và bấm nút "Làm Bài Lại" để thử sức với đề mới nhé!`}
                </p>
                <div className="score-breakdown-row">
                  <div className="score-item">
                    <span>Trắc Nghiệm (50%):</span>
                    <strong>{reviewData.quizScore}% ({reviewData.correctCount}/{reviewData.totalQuestions} câu đúng)</strong>
                  </div>
                  <div className="score-item">
                    <span>Thực Hành Code (50%):</span>
                    <strong>{reviewData.codeScore}% ({reviewData.codeOutcome.passedCount}/{reviewData.codeOutcome.total} tests đạt)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: QUIZ REVIEW */}
          <div className="review-section">
            <div className="review-section-header">
              <h3>📝 Phần 1: Khảo Thí Trắc Nghiệm ({reviewData.correctCount}/{reviewData.totalQuestions} câu đúng — {reviewData.quizScore}%)</h3>
            </div>

            <div className="review-questions-list">
              {reviewData.questions.map((q, idx) => {
                const userChoice = reviewData.selectedAnswers[q.id];
                const isCorrect = userChoice === q.correctIndex;

                return (
                  <div key={q.id} className={`review-question-card ${isCorrect ? 'is-correct' : 'is-wrong'}`}>
                    <div className="review-question-header">
                      <div className="review-status-badge">
                        {isCorrect ? '✅ ĐÚNG (+10đ)' : '❌ SAI (0đ)'}
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
                        if (isSelected && !isTheCorrectOne) optClass += ' user-wrong-choice';

                        return (
                          <div key={optIdx} className={optClass}>
                            <div className="opt-letter">
                              {String.fromCharCode(65 + optIdx)}.
                            </div>
                            <div className="opt-content">
                              <FormattedText content={opt} />
                              {isTheCorrectOne && <span className="answer-tag correct">✓ Đáp án chuẩn</span>}
                              {isSelected && !isTheCorrectOne && <span className="answer-tag wrong">✗ Lựa chọn của đại ca</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Deep Technical Explanation */}
                    <div className="review-explanation-box">
                      <div className="exp-badge">💡 Phân Tích & Giải Thích Kỹ Thuật Chuyên Sâu:</div>
                      <FormattedText content={q.explanation} className="exp-text" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: CODE LAB REVIEW */}
          <div className="review-section">
            <div className="review-section-header">
              <h3>💻 Phần 2: Đánh Giá Lab Code ({reviewData.codeScore}%)</h3>
            </div>

            <div className="review-code-card">
              <div className="code-challenge-title">
                <h4>{exam.codeChallenge.title}</h4>
                <FormattedText content={exam.codeChallenge.description} />
              </div>

              {/* Test Cases Outcome Table */}
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
                      <tr key={rIdx} className={r.passed ? 'row-pass' : 'row-fail'}>
                        <td>{rIdx + 1}</td>
                        <td>{r.description || `Test case ${rIdx + 1}`}</td>
                        <td>
                          <span className={`status-pill ${r.passed ? 'pass' : 'fail'}`}>
                            {r.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </td>
                        <td>
                          <code>{JSON.stringify(r.expected)}</code>
                        </td>
                        <td>
                          <code>{r.error ? `Error: ${r.error}` : JSON.stringify(r.received)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Code Submitted Viewer */}
              <div className="submitted-code-viewer">
                <div className="code-viewer-label">Mã nguồn đại ca đã nộp:</div>
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
              <span className="stat-value">{attempts[0]?.finalScore ?? '--'}%</span>
            </div>
            <div className="attempt-stat-card">
              <span className="stat-label">Trạng Thái Chuẩn</span>
              <span className="stat-value" style={{ color: hasPassedEver ? '#10b981' : '#f87171' }}>
                {hasPassedEver ? '🏆 ĐÃ ĐẠT' : '❌ CHƯA ĐẠT'}
              </span>
            </div>
          </div>

          <div className="attempts-table-container">
            {attempts.length === 0 ? (
              <div className="empty-attempts-notice">
                <p>Đại ca chưa có lịch sử làm bài nào cho Sprint này. Hãy bấm "Làm Bài Lại" để bắt đầu thử sức!</p>
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
                        <span className="attempt-badge-num">#{att.attemptNumber}</span>
                      </td>
                      <td>
                        <div>
                          <div>{new Date(att.submittedAt).toLocaleTimeString('vi-VN')}</div>
                          <small style={{ color: 'var(--text-muted)' }}>
                            {new Date(att.submittedAt).toLocaleDateString('vi-VN')}
                          </small>
                        </div>
                      </td>
                      <td>
                        <strong>{att.quizScore}%</strong> ({att.correctCount}/{att.totalQuestions} câu)
                      </td>
                      <td>
                        <strong>{att.codeScore}%</strong>
                      </td>
                      <td>
                        <strong style={{ fontSize: '15px' }}>{att.finalScore}%</strong>
                      </td>
                      <td>
                        <span className={`attempt-score-pill ${att.passed ? 'passed' : 'failed'}`}>
                          {att.passed ? '✓ ĐẠT CHUẨN' : '✗ CHƯA ĐẠT'}
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
                          👁️ Xem Lại
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
          {/* SECTION 1: QUIZ */}
          <div className="quiz-container" style={{ marginBottom: '32px' }}>
            <h3 className="section-title">
              📝 Phần 1: Khảo Thí Lý Thuyết & Kiến Trúc Lõi ({activeQuestions.length} câu)
            </h3>
            {activeQuestions.map((q, idx) => (
              <div key={q.id} className="question-card">
                <div className="question-header">
                  <span className="question-num">Câu {idx + 1}</span>
                  <div className="question-text">
                    <FormattedText content={q.question} />
                  </div>
                </div>
                <div className="options-list">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className={`option-item ${selectedAnswers[q.id] === optIdx ? 'selected' : ''}`}
                      onClick={() => handleSelectOption(q.id, optIdx)}
                    >
                      <span className="opt-index-badge">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <div className="opt-text">
                        <FormattedText content={opt} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* SECTION 2: FULL CODEX SANDBOX LAB */}
          <div style={{ marginBottom: '36px' }}>
            <h3 className="section-title">
              💻 Phần 2: Lab Thực Hành — {exam.codeChallenge.title}
            </h3>
            <CodeSandboxEditor
              challenge={exam.codeChallenge}
              value={code}
              onChange={setCode}
              fileName="solution.ts"
              filePath={`sprints > sprint-${exam.sprintId} > solution.ts`}
              headerBadge={`Thực Hành Sprint ${exam.sprintId}`}
              runVisibleButtonText="▶️ Chạy Thử (Visible Cases)"
              submitButtonText="🔍 Kiểm Tra & Chấm Điểm Thử"
            />
          </div>

          {/* Submit Button */}
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ padding: '16px 48px', fontSize: '17px', borderRadius: '12px' }}
              onClick={handleSubmit}
            >
              🚀 Nộp Bài Thi & Xem Điểm Chi Tiết
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
