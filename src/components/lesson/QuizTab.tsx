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

  // Initialize or restore session (both submitted results AND in-progress draft answers) when lesson.id changes
  useEffect(() => {
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

  return (
    <div className="quiz-tab-wrapper">
      {/* 1. Header Banner & Progress */}
      {!isSubmitted ? (
        <div className="quiz-header-card">
          <div className="quiz-header-info">
            <div className="quiz-header-title-row">
              <h3>Khảo Thí Trắc Nghiệm Ôn Luyện</h3>
              <span className="quiz-badge-count">{totalQuestions} câu hỏi chuyên sâu</span>
            </div>
            <p className="quiz-header-desc">
              Bộ câu hỏi đánh giá kiến thức kiến trúc hệ thống và cơ chế thực thi Senior Backend. ĐẠI CA đọc kỹ câu hỏi trước khi nộp bài.
            </p>
          </div>

          <div className="quiz-progress-section">
            <div className="quiz-progress-labels">
              <span>Tiến độ hoàn thành:</span>
              <strong>{answeredCount}/{totalQuestions} câu ({progressPercent}%)</strong>
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
        /* 2. Submitted Score Summary Result Banner */
        <div className={`quiz-result-banner ${isPassed ? 'is-passed' : 'is-failed'}`}>
          <div className="result-main-col">
            <div className="result-badge-row">
              <span className="result-badge-icon">{isPassed ? 'PASS' : 'REVIEW'}</span>
              <span className="result-badge-text">
                {isPassed ? 'ĐẠT TIÊU CHUẨN KỸ THUẬT (PASS)' : 'CHƯA ĐẠT TIÊU CHUẨN (NEED REVIEW)'}
              </span>
              <span className="result-timestamp">
                Hạn mức yêu cầu: ≥ 70%
              </span>
            </div>

            <div className="result-score-highlight">
              <span className="result-score-large">{scorePercent}%</span>
              <div className="result-score-details">
                <strong>{correctCount} / {totalQuestions} câu chính xác</strong>
                <p>
                  {isPassed
                    ? 'ĐẠI CA đã nắm vững kiến thức lý thuyết và cơ chế runtime của bài học này.'
                    : 'ĐẠI CA cần rà soát lại các câu sai để nắm chắc cơ chế vận hành trước khi triển khai thực tế.'}
                </p>
              </div>
            </div>
          </div>

          <div className="result-actions-col">
            <button className="btn btn-secondary retake-btn" onClick={handleRetake} type="button">
              Làm Lại Bài Trắc Nghiệm
            </button>
            <button className="btn btn-primary" onClick={onNextTab} type="button">
              Sang Bài Tập Code Sandbox →
            </button>
          </div>
        </div>
      )}

      {/* 3. Section Title for Review Mode */}
      {isSubmitted && (
        <div className="quiz-review-section-title">
          <h4>Chi Tiết Sửa Bài & Phân Tích Kỹ Thuật (Review Mode)</h4>
          <span className="quiz-review-note">
            Đối chiếu chi tiết phương án đã chọn với cơ chế hoạt động của Node.js / NestJS runtime
          </span>
        </div>
      )}

      {/* 4. List of Questions */}
      <div className="quiz-container">
        {activeQuestions.map((q, idx) => {
          const selectedIdx = selectedAnswers[q.id];
          const hasAnswered = selectedIdx !== undefined;
          const isCorrect = selectedIdx === q.correctIndex;

          // Review Mode Card
          if (isSubmitted) {
            return (
              <div
                key={q.id}
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
                    <span className="question-idx-tag">Câu {idx + 1}:</span>
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
              </div>
            );
          }

          // Active Answering Mode Card
          return (
            <div key={q.id} className="question-card">
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
            </div>
          );
        })}
      </div>

      {/* 5. Footer Navigation & Submit Button */}
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
