import React, { useState, useEffect } from 'react';
import './QuizTab.css';
import type { Lesson } from '../../data/curriculum.ts';
import { shuffleQuestionOptions, type RandomizedQuestion } from '../../utils/examRandomizer.ts';
import { FormattedText } from '../common/FormattedText.tsx';

interface QuizTabProps {
  lesson: Lesson;
  onPrevTab: () => void;
  onNextTab: () => void;
  onQuizSubmitted?: (lessonId: string, lessonTitle: string, score: number, passed: boolean) => void;
}

interface SavedQuizResult {
  selectedAnswers: Record<string, number>;
  questions: RandomizedQuestion[];
  isSubmitted: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;
}

export const QuizTab: React.FC<QuizTabProps> = ({
  lesson,
  onPrevTab,
  onNextTab,
  onQuizSubmitted,
}) => {
  const STORAGE_KEY = `arc_quiz_result_${lesson.id}`;

  const [activeQuestions, setActiveQuestions] = useState<RandomizedQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [quizViewMode, setQuizViewMode] = useState<'single' | 'all'>('single');

  // Initialize or restore session (both submitted results AND in-progress draft answers) when lesson.id changes
  useEffect(() => {
    setCurrentQuestionIdx(0);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedQuizResult;
        if (parsed.questions && parsed.questions.length === lesson.quiz.length) {
          setActiveQuestions(parsed.questions);
          setSelectedAnswers(parsed.selectedAnswers || {});
          setIsSubmitted(Boolean(parsed.isSubmitted));
          setShowConfirmModal(false);
          return;
        }
      }
    } catch {}

    const shuffled = lesson.quiz.map((q, idx) => shuffleQuestionOptions(q, idx));
    setActiveQuestions(shuffled);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setShowConfirmModal(false);

    try {
      const initialDraft: SavedQuizResult = {
        selectedAnswers: {},
        questions: shuffled,
        isSubmitted: false,
        score: 0,
        correctCount: 0,
        totalQuestions: shuffled.length,
        submittedAt: '',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDraft));
    } catch {}
  }, [lesson.id, STORAGE_KEY, lesson.quiz]);

  const totalQuestions = activeQuestions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  let correctCount = 0;
  activeQuestions.forEach((q) => {
    if (selectedAnswers[q.id] === q.correctIndex) {
      correctCount++;
    }
  });
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const isPassed = scorePercent >= 70;

  const handleSelect = (questionId: string, optionIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => {
      const next = {
        ...prev,
        [questionId]: optionIdx,
      };
      try {
        const draftPayload: SavedQuizResult = {
          selectedAnswers: next,
          questions: activeQuestions,
          isSubmitted: false,
          score: 0,
          correctCount: 0,
          totalQuestions,
          submittedAt: '',
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draftPayload));
      } catch {}
      return next;
    });
  };

  const handlePreSubmit = () => {
    if (isSubmitted) return;
    if (answeredCount < totalQuestions) {
      setShowConfirmModal(true);
    } else {
      executeSubmit();
    }
  };

  const executeSubmit = () => {
    setShowConfirmModal(false);
    setIsSubmitted(true);

    try {
      const payload: SavedQuizResult = {
        selectedAnswers,
        questions: activeQuestions,
        isSubmitted: true,
        score: scorePercent,
        correctCount,
        totalQuestions,
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save quiz result:', e);
    }

    if (onQuizSubmitted) {
      onQuizSubmitted(lesson.id, lesson.title, scorePercent, isPassed);
    }
  };

  const handleRetake = () => {
    const shuffled = lesson.quiz.map((q, idx) => shuffleQuestionOptions(q, idx));
    setActiveQuestions(shuffled);
    setSelectedAnswers({});
    setIsSubmitted(false);
    setShowConfirmModal(false);
    setCurrentQuestionIdx(0);
    try {
      const nextDraft: SavedQuizResult = {
        selectedAnswers: {},
        questions: shuffled,
        isSubmitted: false,
        score: 0,
        correctCount: 0,
        totalQuestions: shuffled.length,
        submittedAt: '',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraft));
    } catch {}
  };

  const safeCurrentIdx = currentQuestionIdx < totalQuestions ? currentQuestionIdx : 0;

  return (
    <div className="quiz-tab-wrapper">
      {/* 1. STICKY HEADER HUD: Progress Bar, Question Pills & Mode Controls */}
      {!isSubmitted ? (
        <div className="quiz-header-card quiz-sticky-hud">
          <div className="quiz-hud-top-row">
            <div className="quiz-header-title-row">
              <h3>Khảo Thí Trắc Nghiệm Ôn Luyện</h3>
              <span className="quiz-badge-count">
                Đã chọn {answeredCount}/{totalQuestions} câu ({progressPercent}%)
              </span>
            </div>

            <div className="quiz-hud-actions">
              <button
                type="button"
                className="quiz-mode-toggle-btn"
                onClick={() =>
                  setQuizViewMode((prev) => (prev === 'single' ? 'all' : 'single'))
                }
              >
                {quizViewMode === 'single'
                  ? 'Hiển thị: Từng câu (1/1)'
                  : 'Hiển thị: Tất cả câu'}
              </button>

              <button
                className="btn btn-success btn-sm quiz-hud-submit-btn"
                onClick={handlePreSubmit}
                type="button"
              >
                Nộp Bài ({answeredCount}/{totalQuestions})
              </button>
            </div>
          </div>

          <div className="quiz-hud-nav-row">
            <div className="quiz-question-pills-grid">
              {activeQuestions.map((q, idx) => {
                const isAnswered = selectedAnswers[q.id] !== undefined;
                const isCurrent = idx === safeCurrentIdx;
                const chosenLetter = isAnswered
                  ? String.fromCharCode(65 + selectedAnswers[q.id])
                  : '';
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`quiz-q-pill ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}`}
                    onClick={() => {
                      setCurrentQuestionIdx(idx);
                      if (quizViewMode === 'all') {
                        const el = document.getElementById(`lesson-quiz-q-${idx + 1}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    title={
                      isAnswered
                        ? `Câu ${idx + 1}: Đã chọn đáp án ${chosenLetter}`
                        : `Câu ${idx + 1}: Chưa trả lời`
                    }
                  >
                    <span>{idx + 1}</span>
                    {isAnswered && <small>{chosenLetter}</small>}
                  </button>
                );
              })}
            </div>

            <div className="quiz-progress-track">
              <div
                className="quiz-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* 2. Submitted Score Summary Result Banner (Sticky) */
        <div className={`quiz-result-banner quiz-sticky-hud ${isPassed ? 'is-passed' : 'is-failed'}`}>
          <div className="result-main-col">
            <div className="result-badge-row">
              <span className="result-badge-icon">{isPassed ? 'PASS' : 'REVIEW'}</span>
              <span className="result-badge-text">
                {isPassed ? 'ĐẠT TIÊU CHUẨN KỸ THUẬT (PASS)' : 'CHƯA ĐẠT TIÊU CHUẨN (NEED REVIEW)'}
              </span>
              <span className="result-timestamp">
                Kết quả: {correctCount}/{totalQuestions} câu đúng ({scorePercent}% — Yêu cầu ≥ 70%)
              </span>
            </div>

            <div className="quiz-question-pills-grid">
              {activeQuestions.map((q, idx) => {
                const selectedIdx = selectedAnswers[q.id];
                const hasAnswered = selectedIdx !== undefined;
                const isCorrect = selectedIdx === q.correctIndex;
                const isCurrent = idx === safeCurrentIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`quiz-q-pill ${
                      !hasAnswered ? 'review-unanswered' : isCorrect ? 'review-correct' : 'review-wrong'
                    } ${isCurrent ? 'current' : ''}`}
                    onClick={() => {
                      setCurrentQuestionIdx(idx);
                      if (quizViewMode === 'all') {
                        const el = document.getElementById(`lesson-quiz-review-q-${idx + 1}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    title={`Câu ${idx + 1}: ${!hasAnswered ? 'Chưa trả lời' : isCorrect ? 'Đúng' : 'Sai'}`}
                  >
                    <span>{idx + 1}</span>
                    <small>{!hasAnswered ? '!' : isCorrect ? '✓' : '✗'}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="result-actions-col">
            <button
              type="button"
              className="quiz-mode-toggle-btn"
              onClick={() =>
                setQuizViewMode((prev) => (prev === 'single' ? 'all' : 'single'))
              }
            >
              {quizViewMode === 'single'
                ? 'Xem: Từng câu (1/1)'
                : 'Xem: Tất cả câu'}
            </button>
            <button className="btn btn-secondary btn-sm retake-btn" onClick={handleRetake} type="button">
              Làm Lại Bài
            </button>
            <button className="btn btn-primary btn-sm" onClick={onNextTab} type="button">
              Sang Code Sandbox →
            </button>
          </div>
        </div>
      )}

      {/* 3. Questions Content (Single-Question Stepper Mode or Full List Mode) */}
      <div className="quiz-container">
        {(quizViewMode === 'single' && activeQuestions.length > 0
          ? [{ q: activeQuestions[safeCurrentIdx], idx: safeCurrentIdx }]
          : activeQuestions.map((q, idx) => ({ q, idx }))
        ).map(({ q, idx }) => {
          const selectedIdx = selectedAnswers[q.id];
          const hasAnswered = selectedIdx !== undefined;
          const isCorrect = selectedIdx === q.correctIndex;
          const isLastQuestion = idx === totalQuestions - 1;

          // Review Mode Card
          if (isSubmitted) {
            return (
              <div
                key={q.id}
                id={`lesson-quiz-review-q-${idx + 1}`}
                className={`review-question-card ${
                  !hasAnswered ? 'is-unanswered' : isCorrect ? 'is-correct' : 'is-wrong'
                }`}
              >
                <div className="review-question-header">
                  <div className="review-status-badge">
                    {!hasAnswered
                      ? 'CHƯA TRẢ LỜI (0đ)'
                      : isCorrect
                      ? '✓ ĐÚNG (+1đ)'
                      : '✗ SAI (0đ)'}
                  </div>
                  <div className="review-question-title">
                    <span className="question-idx-tag">Câu {idx + 1}/{totalQuestions}:</span>
                    <FormattedText content={q.question} />
                  </div>
                </div>

                <div className="review-options-grid">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selectedIdx === optIdx;
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
                          {isTheCorrectOne && (
                            <span className="answer-tag correct">✓ Đáp án chính xác</span>
                          )}
                          {isSelected && !isTheCorrectOne && (
                            <span className="answer-tag wrong">✗ Lựa chọn của đại ca</span>
                          )}
                          {isSelected && isTheCorrectOne && (
                            <span className="answer-tag correct-user">✓ Đại ca chọn chính xác</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Deep Technical Explanation Box */}
                <div className="review-explanation-box">
                  <div className="exp-badge">Phân Tích & Giải Thích Kỹ Thuật Chuyên Sâu:</div>
                  <FormattedText content={q.explanation} className="exp-text" />
                </div>

                {quizViewMode === 'single' && (
                  <div className="quiz-step-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={idx === 0}
                      onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                    >
                      ← Câu trước
                    </button>
                    <span className="quiz-step-counter">
                      Đang xem sửa bài Câu {idx + 1} / {totalQuestions}
                    </span>
                    {!isLastQuestion ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          setCurrentQuestionIdx((prev) => Math.min(totalQuestions - 1, prev + 1))
                        }
                      >
                        Câu tiếp theo (Câu {idx + 2}) →
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={onNextTab}>
                        Sang Bài Tập Code Sandbox →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Active Answering Mode Card
          return (
            <div key={q.id} id={`lesson-quiz-q-${idx + 1}`} className="question-card">
              <div className="quiz-single-card-meta">
                <span className="quiz-single-step-label">
                  CÂU HỎI {idx + 1} / {totalQuestions}
                </span>
                <span className={`quiz-single-state ${hasAnswered ? 'answered' : 'pending'}`}>
                  {hasAnswered
                    ? `✓ Đã chọn đáp án ${String.fromCharCode(65 + selectedIdx)}`
                    : 'Chưa chọn đáp án'}
                </span>
              </div>

              <div className="question-header">
                <span className="question-num">Câu {idx + 1}</span>
                <div className="question-text">
                  <FormattedText content={q.question} />
                </div>
              </div>

              <div className="options-list">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedIdx === optIdx;
                  return (
                    <div
                      key={optIdx}
                      className={`option-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(q.id, optIdx)}
                    >
                      <span className="opt-index-badge">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <div className="opt-text">
                        <FormattedText content={opt} />
                      </div>
                      {isSelected && (
                        <span className="selected-indicator">✓ Đã chọn</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {quizViewMode === 'single' && (
                <div className="quiz-step-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (idx === 0) {
                        onPrevTab();
                      } else {
                        setCurrentQuestionIdx((prev) => Math.max(0, prev - 1));
                      }
                    }}
                  >
                    {idx === 0 ? '← Quay lại Lý thuyết' : '← Câu trước'}
                  </button>

                  <span className="quiz-step-counter">
                    Đã trả lời <strong>{answeredCount}/{totalQuestions}</strong> câu ({progressPercent}%)
                  </span>

                  {!isLastQuestion ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        setCurrentQuestionIdx((prev) => Math.min(totalQuestions - 1, prev + 1))
                      }
                    >
                      Câu tiếp theo (Câu {idx + 2}) →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-success quiz-submit-btn"
                      onClick={handlePreSubmit}
                    >
                      Nộp Bài Trắc Nghiệm ({answeredCount}/{totalQuestions} câu) ✓
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. Footer Navigation & Submit Button (shown in 'all' view mode) */}
      {quizViewMode === 'all' && (
        <div className="quiz-footer-row">
          <button className="btn btn-secondary" onClick={onPrevTab} type="button">
            ← Quay lại Lý thuyết
          </button>

          {!isSubmitted ? (
            <button
              className="btn btn-success quiz-submit-btn"
              onClick={handlePreSubmit}
              type="button"
            >
              Nộp Bài Trắc Nghiệm ({answeredCount}/{totalQuestions} câu)
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={handleRetake} type="button">
                Làm Lại Bài
              </button>
              <button className="btn btn-primary" onClick={onNextTab} type="button">
                Chuyển sang Bài Tập Code Sandbox →
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. Unfinished Confirmation Modal */}
      {showConfirmModal && (
        <div className="quiz-confirm-backdrop">
          <div className="quiz-confirm-modal">
            <div className="modal-header">
              <span className="modal-icon">!</span>
              <h3>Xác Nhận Nộp Bài Trắc Nghiệm</h3>
            </div>
            <p className="modal-body">
              ĐẠI CA mới trả lời <strong>{answeredCount}/{totalQuestions}</strong> câu hỏi. Vẫn còn <strong>{totalQuestions - answeredCount}</strong> câu chưa chọn đáp án.
            </p>
            <p className="modal-sub">
              Các câu chưa trả lời sẽ được tính là 0 điểm. ĐẠI CA có chắc chắn muốn nộp bài để chấm điểm ngay bây giờ không?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                type="button"
              >
                Tiếp tục làm bài
              </button>
              <button
                className="btn btn-success"
                onClick={executeSubmit}
                type="button"
              >
                Nộp bài luôn & Sửa bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
