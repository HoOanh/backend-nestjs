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

interface ExamReviewData {
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

export const SprintExamView: React.FC<SprintExamViewProps> = ({ exam, existingScore, onExamSubmitted }) => {
  const [activeQuestions, setActiveQuestions] = useState<RandomizedQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [code, setCode] = useState<string>(exam.codeChallenge.starterCode);
  const [timeLeft, setTimeLeft] = useState<number>(exam.timeLimitMinutes * 60);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [reviewData, setReviewData] = useState<ExamReviewData | null>(null);
  const [activeTab, setActiveTab] = useState<'exam' | 'review'>('exam');

  // Initialize randomized exam session
  const startNewExamSession = () => {
    const picked = generateRandomExamQuestions(exam.questions, exam.questionCountToPick || 10);
    setActiveQuestions(picked);
    setSelectedAnswers({});
    setCode(exam.codeChallenge.starterCode);
    setTimeLeft(exam.timeLimitMinutes * 60);
    setIsSubmitted(false);
    setReviewData(null);
    setActiveTab('exam');
  };

  useEffect(() => {
    startNewExamSession();
  }, [exam.sprintId]);

  // Timer countdown
  useEffect(() => {
    if (isSubmitted) return;

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
  }, [exam.sprintId, isSubmitted, activeQuestions, code, selectedAnswers]);

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

    setReviewData(submittedData);
    setIsSubmitted(true);
    setActiveTab('review');

    onExamSubmitted(exam.sprintId, finalScore, passed);
  };

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
              📚 Ngân hàng: <strong>{exam.questions.length} câu</strong> (Bốc ngẫu nhiên <strong>{activeQuestions.length} câu</strong>)
            </span>
            <span className="exam-pill">
              🎯 Điểm đạt: <strong>≥ {exam.passingScore}%</strong>
            </span>
            <span className="exam-pill">
              ⏱️ Thời gian: <strong>{exam.timeLimitMinutes} phút</strong>
            </span>
          </div>
        </div>

        {!isSubmitted ? (
          <div className="exam-timer">
            <div className="timer-digits">{formatTimer(timeLeft)}</div>
            <div className="timer-label">Thời gian còn lại</div>
          </div>
        ) : (
          <div className="exam-timer completed">
            <div className="timer-digits">{reviewData?.finalScore}%</div>
            <div className="timer-label">{reviewData?.passed ? '🏆 ĐÃ ĐẠT' : '❌ CHƯA ĐẠT'}</div>
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs if already submitted */}
      {isSubmitted && (
        <div className="exam-mode-tabs">
          <button
            className={`mode-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            📊 Bảng Điểm & Xem Lại Bài Thi (Review Mode)
          </button>
          <button
            className="mode-tab-btn retake-btn"
            onClick={startNewExamSession}
          >
            🔄 Thi Lại Đề Mới (Random 10 Câu Khác)
          </button>
        </div>
      )}

      {/* REVIEW MODE VIEW */}
      {isSubmitted && activeTab === 'review' && reviewData && (
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
                    ? `Đại ca đã hoàn thành xuất sắc Sprint ${exam.sprintId} với ${reviewData.finalScore}% (vượt mức tiêu chuẩn ${exam.passingScore}%).`
                    : `Điểm của đại ca là ${reviewData.finalScore}% (tiêu chuẩn yêu cầu ≥ ${exam.passingScore}%). Hãy xem lại chi tiết bài làm bên dưới và thử lại đề mới nhé!`}
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

      {/* EXAM TAKING VIEW */}
      {(!isSubmitted || activeTab === 'exam') && (
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
