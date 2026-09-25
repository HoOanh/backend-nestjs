import React, { useState, useEffect } from 'react';
import type { FinalExam } from '../data/finalExam.ts';
import { GraduationCertificate } from './GraduationCertificate.tsx';
import { CodeEvaluator, type TestOutcome } from '../services/codeEvaluator.ts';
import { generateRandomExamQuestions, type RandomizedQuestion } from '../utils/examRandomizer.ts';
import { CodeSandboxEditor } from './CodeSandboxEditor.tsx';
import { FormattedText } from './FormattedText.tsx';

interface FinalExamViewProps {
  exam: FinalExam;
  finalResult: {
    score: number;
    passed: boolean;
    studentName: string;
    certificateId: string;
    completedAt: string;
  } | null;
  onFinalExamSubmitted: (score: number, passed: boolean, studentName: string) => void;
  onRetakeFinalExam: () => void;
}

export interface FinalExamReviewData {
  quizScore: number;
  avgCodeScore: number;
  finalScore: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  selectedAnswers: Record<string, number>;
  questions: RandomizedQuestion[];
  codes: string[];
  codeOutcomes: TestOutcome[];
  studentName: string;
  submittedAt: string;
}

export interface FinalExamAttempt {
  id: string;
  attemptNumber: number;
  submittedAt: string;
  studentName: string;
  quizScore: number;
  avgCodeScore: number;
  finalScore: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  reviewData: FinalExamReviewData;
}

export const FinalExamView: React.FC<FinalExamViewProps> = ({
  exam,
  finalResult,
  onFinalExamSubmitted,
  onRetakeFinalExam
}) => {
  const STORAGE_FINAL_REVIEW_KEY = 'esmiles_final_exam_review';
  const STORAGE_FINAL_ATTEMPTS_KEY = 'esmiles_final_exam_attempts';

  const loadSavedReview = (): FinalExamReviewData | null => {
    try {
      const saved = localStorage.getItem(STORAGE_FINAL_REVIEW_KEY);
      if (saved) return JSON.parse(saved) as FinalExamReviewData;
    } catch {}
    return null;
  };

  const loadSavedAttempts = (): FinalExamAttempt[] => {
    try {
      const saved = localStorage.getItem(STORAGE_FINAL_ATTEMPTS_KEY);
      if (saved) return JSON.parse(saved) as FinalExamAttempt[];
    } catch {}
    return [];
  };

  const [studentName, setStudentName] = useState<string>(finalResult?.studentName || 'Đại Ca Kỹ Sư');
  const [activeQuestions, setActiveQuestions] = useState<RandomizedQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [codes, setCodes] = useState<string[]>(exam.codeChallenges.map((c) => c.starterCode));
  const [timeLeft, setTimeLeft] = useState<number>(exam.timeLimitMinutes * 60);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [reviewData, setReviewData] = useState<FinalExamReviewData | null>(null);
  const [attempts, setAttempts] = useState<FinalExamAttempt[]>([]);
  const [activeTab, setActiveTab] = useState<'certificate' | 'review' | 'history' | 'exam'>('exam');

  // Initialize or restore session
  useEffect(() => {
    const savedAttempts = loadSavedAttempts();
    const savedReview = loadSavedReview();
    setAttempts(savedAttempts);

    if (savedReview) {
      setReviewData(savedReview);
      setIsSubmitted(true);
      setActiveQuestions(savedReview.questions);
      setSelectedAnswers(savedReview.selectedAnswers);
      setCodes(savedReview.codes);
      setStudentName(savedReview.studentName);
      if (savedReview.passed || finalResult?.passed) {
        setActiveTab('certificate');
      } else {
        setActiveTab('review');
      }
    } else if (finalResult?.passed) {
      setIsSubmitted(true);
      setActiveTab('certificate');
    } else {
      setIsSubmitted(false);
      startNewFinalExamSession();
    }
  }, []);

  const startNewFinalExamSession = () => {
    const picked = generateRandomExamQuestions(exam.questions, exam.questionCountToPick || 15);
    setActiveQuestions(picked);
    setSelectedAnswers({});
    setCodes(exam.codeChallenges.map((c) => c.starterCode));
    setTimeLeft(exam.timeLimitMinutes * 60);
    setIsSubmitted(false);
    setActiveTab('exam');
  };

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
  }, [isSubmitted, activeTab, activeQuestions, codes, selectedAnswers, studentName]);

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

  const handleCodeChange = (idx: number, newCode: string) => {
    const nextCodes = [...codes];
    nextCodes[idx] = newCode;
    setCodes(nextCodes);
  };

  const handleSubmit = async () => {
    if (isSubmitted) return;

    // 1. Quiz Score
    let correctCount = 0;
    activeQuestions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });
    const quizScore = Math.round((correctCount / (activeQuestions.length || 1)) * 100);

    // 2. Code Score across all 3 Capstones (including hidden tests)
    let totalCodeScore = 0;
    const outcomes: TestOutcome[] = [];
    for (let i = 0; i < exam.codeChallenges.length; i++) {
      const outcome = await CodeEvaluator.runTests(
        codes[i],
        exam.codeChallenges[i].testCases,
        true
      );
      outcomes.push(outcome);
      const score = outcome.passed ? 100 : Math.round((outcome.passedCount / (outcome.total || 1)) * 100);
      totalCodeScore += score;
    }
    const avgCodeScore = Math.round(totalCodeScore / (exam.codeChallenges.length || 1));

    // 3. Final Combined Score (50% trắc nghiệm + 50% thực hành code)
    const finalScore = Math.round(quizScore * 0.5 + avgCodeScore * 0.5);
    const passed = finalScore >= exam.passingScore;

    const submittedReview: FinalExamReviewData = {
      quizScore,
      avgCodeScore,
      finalScore,
      passed,
      correctCount,
      totalQuestions: activeQuestions.length,
      selectedAnswers,
      questions: activeQuestions,
      codes,
      codeOutcomes: outcomes,
      studentName: studentName.trim() || 'Kỹ Sư Arc Irobot',
      submittedAt: new Date().toISOString()
    };

    const newAttempt: FinalExamAttempt = {
      id: `final-attempt-${Date.now()}`,
      attemptNumber: attempts.length + 1,
      submittedAt: submittedReview.submittedAt,
      studentName: submittedReview.studentName,
      quizScore,
      avgCodeScore,
      finalScore,
      passed,
      correctCount,
      totalQuestions: activeQuestions.length,
      reviewData: submittedReview
    };

    const updatedAttempts = [newAttempt, ...attempts];

    // Save to LocalStorage
    try {
      localStorage.setItem(STORAGE_FINAL_REVIEW_KEY, JSON.stringify(submittedReview));
      localStorage.setItem(STORAGE_FINAL_ATTEMPTS_KEY, JSON.stringify(updatedAttempts));
    } catch (e) {
      console.error('Failed to save final exam attempt to localStorage:', e);
    }

    setAttempts(updatedAttempts);
    setReviewData(submittedReview);
    setIsSubmitted(true);

    if (passed) {
      setActiveTab('certificate');
    } else {
      setActiveTab('review');
    }

    onFinalExamSubmitted(finalScore, passed, studentName.trim() || 'Kỹ Sư Arc Irobot');
  };

  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.finalScore)) : (finalResult?.score || 0);
  const hasPassedEver = attempts.some((a) => a.passed) || Boolean(finalResult?.passed);

  // Certificate Result object
  const certResult = finalResult && finalResult.passed
    ? finalResult
    : reviewData && reviewData.passed
    ? {
        score: reviewData.finalScore,
        passed: true,
        studentName: reviewData.studentName,
        certificateId: `ARC-CERT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        completedAt: reviewData.submittedAt
      }
    : null;

  return (
    <div className="exam-view-wrapper">
      {/* Exam Banner */}
      <div className="exam-banner">
        <div className="exam-info">
          <h2>🏆 {exam.title}</h2>
          <FormattedText content={exam.description} />
          <div className="exam-badges-row">
            <span className="exam-pill">
              📚 Ngân hàng: <strong>{exam.questions.length} câu</strong> (Bốc <strong>{exam.questionCountToPick || 15} câu</strong>)
            </span>
            <span className="exam-pill">
              💻 Thực hành: <strong>3 Capstone Labs</strong>
            </span>
            <span className="exam-pill">
              🎯 Điểm đạt: <strong>≥ {exam.passingScore}%</strong>
            </span>
            <span className="exam-pill">
              ⏱️ Thời gian: <strong>{exam.timeLimitMinutes} phút</strong>
            </span>
            {attempts.length > 0 && (
              <span className="exam-pill" style={{ borderColor: hasPassedEver ? '#10b981' : '#f59e0b' }}>
                🏆 Cao nhất: <strong style={{ color: hasPassedEver ? '#10b981' : '#f59e0b' }}>{bestScore}% ({hasPassedEver ? 'TỐT NGHIỆP' : 'CHƯA ĐẠT'})</strong>
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
            <div className="timer-digits">
              {reviewData ? `${reviewData.finalScore}%` : (finalResult ? `${finalResult.score}%` : '--')}
            </div>
            <div className="timer-label">
              {hasPassedEver ? '🏆 TỐT NGHIỆP' : (isSubmitted ? '❌ CHƯA ĐẠT' : 'CHƯA THI')}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Toolbar */}
      {(isSubmitted || attempts.length > 0 || reviewData || finalResult) && (
        <div className="exam-mode-tabs">
          {hasPassedEver && (
            <button
              className={`mode-tab-btn ${activeTab === 'certificate' ? 'active' : ''}`}
              onClick={() => setActiveTab('certificate')}
            >
              🎓 Chứng Chỉ Tốt Nghiệp
            </button>
          )}
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
                if (window.confirm('Đại ca có muốn bắt đầu một lượt thi tốt nghiệp mới? Bộ đếm thời gian sẽ reset và 15 câu hỏi ngẫu nhiên mới cùng 3 bài Capstone sẽ được nạp lại.')) {
                  onRetakeFinalExam();
                  startNewFinalExamSession();
                }
              } else {
                setActiveTab('exam');
              }
            }}
          >
            {isSubmitted ? '🔄 Thi Lại Đề Mới (Nâng Điểm)' : '✍️ Đang Làm Bài Thi'}
          </button>
        </div>
      )}

      {/* TAB: CERTIFICATE VIEW */}
      {activeTab === 'certificate' && certResult && (
        <div style={{ marginBottom: '40px' }}>
          <GraduationCertificate
            result={certResult}
            onRetake={() => {
              if (window.confirm('Đại ca có chắc muốn thi lại bài tốt nghiệp để nâng cao điểm số không?')) {
                onRetakeFinalExam();
                startNewFinalExamSession();
              }
            }}
          />
        </div>
      )}

      {/* TAB: ATTEMPTS HISTORY VIEW */}
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
              <span className="stat-label">Trạng Thái Tốt Nghiệp</span>
              <span className="stat-value" style={{ color: hasPassedEver ? '#10b981' : '#f87171' }}>
                {hasPassedEver ? '🎓 ĐÃ TỐT NGHIỆP' : '❌ CHƯA ĐẠT'}
              </span>
            </div>
          </div>

          <div className="attempts-table-container">
            {attempts.length === 0 ? (
              <div className="empty-attempts-notice">
                <p>Đại ca chưa có lịch sử thi nào cho kỳ thi tốt nghiệp. Hãy hoàn thành bài thi để ghi nhận thành tích!</p>
              </div>
            ) : (
              <table className="attempts-table">
                <thead>
                  <tr>
                    <th>Lần Thi</th>
                    <th>Thời Gian Nộp</th>
                    <th>Học Viên</th>
                    <th>Trắc Nghiệm</th>
                    <th>3 Capstones</th>
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
                        <strong>{att.studentName}</strong>
                      </td>
                      <td>
                        <strong>{att.quizScore}%</strong> ({att.correctCount}/{att.totalQuestions} câu)
                      </td>
                      <td>
                        <strong>{att.avgCodeScore}%</strong>
                      </td>
                      <td>
                        <strong style={{ fontSize: '15px' }}>{att.finalScore}%</strong>
                      </td>
                      <td>
                        <span className={`attempt-score-pill ${att.passed ? 'passed' : 'failed'}`}>
                          {att.passed ? '🎓 TỐT NGHIỆP' : '✗ CHƯA ĐẠT'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-view-attempt"
                          onClick={() => {
                            setReviewData(att.reviewData);
                            setActiveQuestions(att.reviewData.questions);
                            setSelectedAnswers(att.reviewData.selectedAnswers);
                            setCodes(att.reviewData.codes);
                            setStudentName(att.studentName);
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

      {/* TAB: REVIEW MODE VIEW */}
      {activeTab === 'review' && reviewData && (
        <div className="exam-review-container">
          <div className={`scorecard-hero ${reviewData.passed ? 'passed' : 'failed'}`}>
            <div className="scorecard-main">
              <div className="score-circle">
                <span className="score-num">{reviewData.finalScore}%</span>
                <span className="score-sub">TỔNG ĐIỂM</span>
              </div>
              <div className="scorecard-text">
                <h3>
                  {reviewData.passed
                    ? `🎓 CHÚC MỪNG KỸ SƯ ${reviewData.studentName.toUpperCase()} ĐÃ TỐT NGHIỆP DANH DỰ!`
                    : '⚠️ RẤT TIẾC, ĐẠI CA CHƯA ĐẠT ĐIỂM TỐT NGHIỆP!'}
                </h3>
                <p>
                  {reviewData.passed
                    ? `Đại ca đã hoàn thành toàn bộ khóa học với số điểm ${reviewData.finalScore}% (vượt chuẩn ${exam.passingScore}%). Hoàn thành vào lúc ${new Date(reviewData.submittedAt).toLocaleTimeString('vi-VN')} ngày ${new Date(reviewData.submittedAt).toLocaleDateString('vi-VN')}. Chứng chỉ tốt nghiệp danh dự Arc Irobot đã sẵn sàng trong Tab "Chứng Chỉ"!`
                    : `Điểm số đạt được: ${reviewData.finalScore}% (yêu cầu ≥ ${exam.passingScore}%). Hãy xem lại chi tiết lỗi bên dưới và bấm nút "Thi Lại Đề Mới" để nâng cao điểm số nhé!`}
                </p>
                <div className="score-breakdown-row">
                  <div className="score-item">
                    <span>Trắc Nghiệm (50%):</span>
                    <strong>{reviewData.quizScore}% ({reviewData.correctCount}/{reviewData.totalQuestions} câu đúng)</strong>
                  </div>
                  <div className="score-item">
                    <span>3 Capstone Labs (50%):</span>
                    <strong>{reviewData.avgCodeScore}% điểm trung bình</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Quiz Review */}
          <div className="review-section">
            <div className="review-section-header">
              <h3>📝 Phần 1: Khảo Thí Lý Thuyết & Kiến Trúc ({reviewData.correctCount}/{reviewData.totalQuestions} câu đúng — {reviewData.quizScore}%)</h3>
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

                    <div className="review-explanation-box">
                      <div className="exp-badge">💡 Phân Tích Kỹ Thuật & Best Practices:</div>
                      <FormattedText content={q.explanation} className="exp-text" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: 3 Capstones Review */}
          <div className="review-section">
            <div className="review-section-header">
              <h3>💻 Phần 2: Đánh Giá 3 Bài Capstone Lab ({reviewData.avgCodeScore}%)</h3>
            </div>

            {exam.codeChallenges.map((challenge, cIdx) => {
              const outcome = reviewData.codeOutcomes[cIdx];
              return (
                <div key={cIdx} className="review-code-card" style={{ marginBottom: '24px' }}>
                  <div className="code-challenge-title">
                    <h4>Bài {cIdx + 1}: {challenge.title}</h4>
                    <FormattedText content={challenge.description} />
                  </div>

                  {outcome && (
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
                          {outcome.results.map((r, rIdx) => (
                            <tr key={rIdx} className={r.passed ? 'row-pass' : 'row-fail'}>
                              <td>{rIdx + 1}</td>
                              <td>{r.description || `Test case ${rIdx + 1}`}</td>
                              <td>
                                <span className={`status-pill ${r.passed ? 'pass' : 'fail'}`}>
                                  {r.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </td>
                              <td><code>{JSON.stringify(r.expected)}</code></td>
                              <td><code>{r.error ? `Error: ${r.error}` : JSON.stringify(r.received)}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="submitted-code-viewer">
                    <div className="code-viewer-label">Mã nguồn đại ca đã nộp cho bài {cIdx + 1}:</div>
                    <pre className="code-snippet-pre">
                      <code>{reviewData.codes[cIdx]}</code>
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: EXAM TAKING MODE */}
      {activeTab === 'exam' && (
        <div className="exam-taking-container">
          {/* Student Name Input */}
          <div className="student-name-card">
            <label className="student-name-label">
              👤 Họ và Tên Học Viên (Tên sẽ được in trang trọng trên Chứng Chỉ Tốt Nghiệp):
            </label>
            <input
              type="text"
              className="student-name-input"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Nhập họ và tên của đại ca..."
            />
          </div>

          {/* SECTION 1: QUIZ */}
          <div className="quiz-container" style={{ marginBottom: '32px' }}>
            <h3 className="section-title">
              📝 Phần 1: Khảo Thí Lý Thuyết & Kiến Trúc Toàn Diện ({activeQuestions.length} câu)
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

          {/* SECTION 2: 3 CAPSTONE CODE LABS */}
          <div style={{ marginBottom: '36px' }}>
            <h3 className="section-title">
              💻 Phần 2: Thực Hành 3 Bài Capstone Lab
            </h3>
            {exam.codeChallenges.map((challenge, idx) => (
              <div key={idx} style={{ marginBottom: '32px' }}>
                <CodeSandboxEditor
                  challenge={challenge}
                  value={codes[idx]}
                  onChange={(newCode) => handleCodeChange(idx, newCode)}
                  fileName={`capstone_${idx + 1}.ts`}
                  filePath={`capstones > capstone-${idx + 1} > solution.ts`}
                  headerBadge={`Capstone Lab ${idx + 1} / 3: ${challenge.title}`}
                  runVisibleButtonText={`▶️ Chạy Thử Bài ${idx + 1} (Visible Cases)`}
                  submitButtonText={`🔍 Kiểm Tra Toàn Bộ Tests Bài ${idx + 1}`}
                />
              </div>
            ))}
          </div>

          {/* Submit Action */}
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ padding: '18px 56px', fontSize: '18px', borderRadius: '14px', boxShadow: '0 8px 24px rgba(14,165,233,0.35)' }}
              onClick={handleSubmit}
            >
              🎓 Nộp Bài Thi Tốt Nghiệp & Xem Kết Quả
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
