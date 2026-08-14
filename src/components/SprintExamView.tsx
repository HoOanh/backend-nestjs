import React, { useState, useEffect } from 'react';
import type { SprintExam } from '../data/sprintExams.ts';
import { CodeEvaluator } from '../services/codeEvaluator.ts';

interface SprintExamViewProps {
  exam: SprintExam;
  existingScore?: { score: number; passed: boolean; completedAt: string };
  onExamSubmitted: (sprintId: number, score: number, passed: boolean) => void;
}

export const SprintExamView: React.FC<SprintExamViewProps> = ({ exam, existingScore, onExamSubmitted }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [code, setCode] = useState<string>(exam.codeChallenge.starterCode);
  const [timeLeft, setTimeLeft] = useState<number>(exam.timeLimitMinutes * 60);

  useEffect(() => {
    setTimeLeft(exam.timeLimitMinutes * 60);
    setSelectedAnswers({});
    setCode(exam.codeChallenge.starterCode);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          alert('Hết giờ làm bài!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exam.sprintId]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = (questionId: string, optIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optIdx
    }));
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    exam.questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });
    const quizScore = Math.round((correctCount / exam.questions.length) * 100);

    const codeOutcome = await CodeEvaluator.runTests(
      code,
      exam.codeChallenge.testCases,
      true
    );
    const codeScore = codeOutcome.passed
      ? 100
      : Math.round((codeOutcome.passedCount / codeOutcome.total) * 100);

    const finalScore = Math.round(quizScore * 0.5 + codeScore * 0.5);
    const passed = finalScore >= exam.passingScore;

    onExamSubmitted(exam.sprintId, finalScore, passed);

    if (passed) {
      alert(`🎉 CHÚC MỪNG ĐẠI CA ĐÃ ĐỖ BÀI THI SPRINT ${exam.sprintId}!\n\nĐiểm Trắc nghiệm: ${quizScore}%\nĐiểm Code: ${codeScore}%\nTổng kết: ${finalScore}% (Đạt yêu cầu)`);
    } else {
      alert(`❌ CHƯA ĐẠT!\n\nĐiểm của đại ca: ${finalScore}% (Yêu cầu tối thiểu ${exam.passingScore}%).\nVui lòng ôn tập lại bài học và thử lại.`);
    }
  };

  return (
    <div>
      <div className="exam-banner">
        <div className="exam-info">
          <h2>🎯 {exam.title}</h2>
          <p>{exam.description}</p>
          <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Yêu cầu vượt qua: <strong>≥ {exam.passingScore}%</strong> • Thời gian: <strong>{exam.timeLimitMinutes} phút</strong>
          </div>
        </div>
        <div className="exam-timer">
          <div className="timer-digits">{formatTimer(timeLeft)}</div>
          <div className="timer-label">Thời gian còn lại</div>
        </div>
      </div>

      {existingScore && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            background: existingScore.passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${existingScore.passed ? '#10b981' : '#ef4444'}`,
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: existingScore.passed ? '#34d399' : '#f87171' }}>
              {existingScore.passed ? '🏆 ĐÃ ĐẠT CHỈ TIÊU' : '❌ CHƯA ĐẠT'} (Điểm: {existingScore.score}%)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Hoàn thành lúc: {new Date(existingScore.completedAt).toLocaleString('vi-VN')}
            </div>
          </div>
        </div>
      )}

      <div className="quiz-container" style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', marginBottom: '16px' }}>
          Phần 1: Trắc Nghiệm Kiến Thức Lõi ({exam.questions.length} câu)
        </h3>
        {exam.questions.map((q, idx) => (
          <div key={q.id} className="question-card">
            <div className="question-header">
              <span className="question-num">Câu {idx + 1}</span>
              <div>{q.question}</div>
            </div>
            <div className="options-list">
              {q.options.map((opt, optIdx) => (
                <div
                  key={optIdx}
                  className={`option-item ${selectedAnswers[q.id] === optIdx ? 'selected' : ''}`}
                  onClick={() => handleSelectOption(q.id, optIdx)}
                >
                  <span style={{ fontWeight: 700 }}>
                    {String.fromCharCode(65 + optIdx)}.
                  </span>
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sandbox-card" style={{ marginBottom: '32px' }}>
        <div className="sandbox-header">
          <h3 className="sandbox-title">Phần 2: Lab Thực Hành — {exam.codeChallenge.title}</h3>
          <p className="sandbox-desc">{exam.codeChallenge.description}</p>
        </div>
        <div className="editor-container" style={{ position: 'relative' }}>
          <textarea
            className="code-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
            style={{
              width: '100%',
              minHeight: '280px',
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
              fontSize: '13.5px',
              lineHeight: '1.6',
              padding: '16px',
              background: 'var(--code-bg)',
              color: 'var(--code-content-color)',
              border: '1px solid var(--code-border)',
              borderRadius: 'var(--radius-sm)',
              resize: 'vertical',
              tabSize: 2,
              outline: 'none'
            }}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '14px 36px', fontSize: '16px' }}
          onClick={handleSubmit}
        >
          🚀 Nộp Bài Thi Sprint
        </button>
      </div>
    </div>
  );
};
