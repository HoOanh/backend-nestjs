import React, { useState } from 'react';
import type { Lesson } from '../data/curriculum.ts';
import { FormattedText } from './FormattedText.tsx';

interface QuizTabProps {
  lesson: Lesson;
  onPrevTab: () => void;
  onNextTab: () => void;
}

export const QuizTab: React.FC<QuizTabProps> = ({ lesson, onPrevTab, onNextTab }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});

  const handleSelect = (questionId: string, optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx
    }));
  };

  return (
    <div>
      <div className="quiz-container">
        {lesson.quiz.map((q, idx) => {
          const selectedIdx = selectedAnswers[q.id];
          const hasAnswered = selectedIdx !== undefined;
          const isCorrect = selectedIdx === q.correctIndex;

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
                  let optClass = 'option-item';
                  if (hasAnswered) {
                    if (optIdx === q.correctIndex) {
                      optClass += ' correct';
                    } else if (optIdx === selectedIdx) {
                      optClass += ' incorrect';
                    }
                  }

                  return (
                    <div
                      key={optIdx}
                      className={optClass}
                      onClick={() => handleSelect(q.id, optIdx)}
                    >
                      <span className="opt-index-badge">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <div className="opt-text">
                        <FormattedText content={opt} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasAnswered && (
                <div className={`quiz-explanation ${isCorrect ? 'correct' : 'incorrect'}`}>
                  <strong>{isCorrect ? 'Chính xác! 🎉 ' : 'Chưa đúng! 💡 '}</strong>
                  <FormattedText content={q.explanation} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', marginBottom: '32px' }}>
        <button className="btn btn-secondary" onClick={onPrevTab}>
          ⬅️ Quay lại Lý thuyết
        </button>
        <button className="btn btn-primary" onClick={onNextTab}>
          Chuyển sang Bài Tập Code Sandbox ➡️
        </button>
      </div>
    </div>
  );
};
