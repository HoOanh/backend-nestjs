import React, { useState, useEffect } from 'react';
import type { FinalExam } from '../data/finalExam.ts';
import { GraduationCertificate } from './GraduationCertificate.tsx';
import { CodeEvaluator } from '../services/codeEvaluator.ts';

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

export const FinalExamView: React.FC<FinalExamViewProps> = ({
  exam,
  finalResult,
  onFinalExamSubmitted,
  onRetakeFinalExam
}) => {
  if (finalResult && finalResult.passed) {
    return <GraduationCertificate result={finalResult} onRetake={onRetakeFinalExam} />;
  }

  const [studentName, setStudentName] = useState<string>('Đại Ca Kỹ Sư');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [code, setCode] = useState<string>(exam.codeChallenge.starterCode);
  const [timeLeft, setTimeLeft] = useState<number>(exam.timeLimitMinutes * 60);

  useEffect(() => {
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
  }, []);

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

    onFinalExamSubmitted(finalScore, passed, studentName);

    if (passed) {
      alert(`🎉 CHÚC MỪNG ĐẠI CA ĐÃ TỐT NGHIỆP XUẤT SẮC!\n\nTổng kết: ${finalScore}% (Đạt yêu cầu)`);
    } else {
      alert(`❌ CHƯA ĐẠT!\n\nĐiểm của đại ca: ${finalScore}% (Yêu cầu tối thiểu ${exam.passingScore}%).\nVui lòng ôn tập lại bài học và thi lại.`);
    }
  };

  return (
    <div>
      <div className="exam-banner">
        <div className="exam-info">
          <h2>🎓 {exam.title}</h2>
          <p>{exam.description}</p>
        </div>
        <div className="exam-timer">
          <div className="timer-digits">{formatTimer(timeLeft)}</div>
          <div className="timer-label">Thời gian làm bài</div>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '24px'
        }}
      >
        <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
          Họ và Tên Học Viên (In trên Chứng Chỉ):
        </label>
        <input
          type="text"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 14px',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-strong)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '15px'
          }}
        />
      </div>

      <div className="quiz-container" style={{ marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', marginBottom: '16px' }}>
          Phần 1: Khảo Thí Lý Thuyết & Kiến Trúc Toàn Diện ({exam.questions.length} câu)
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
          <h3 className="sandbox-title">Phần 2: {exam.codeChallenge.title}</h3>
          <p className="sandbox-desc">{exam.codeChallenge.description}</p>
        </div>
        <div className="editor-container">
          <textarea
            className="code-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '16px 40px', fontSize: '17px' }}
          onClick={handleSubmit}
        >
          🎓 Nộp Bài Thi Tốt Nghiệp & Nhận Bằng
        </button>
      </div>
    </div>
  );
};
