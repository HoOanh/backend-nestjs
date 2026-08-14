import React, { useState, useEffect } from 'react';
import type { Lesson } from '../data/curriculum.ts';
import { CodeEvaluator, type TestOutcome } from '../services/codeEvaluator.ts';

interface CodeSandboxTabProps {
  lesson: Lesson;
  onLessonCompleted: (lessonId: string) => void;
}

export const CodeSandboxTab: React.FC<CodeSandboxTabProps> = ({ lesson, onLessonCompleted }) => {
  const challenge = lesson.codeChallenge;
  const storageDraftKey = `draft_${lesson.id}`;

  const [code, setCode] = useState<string>(() => {
    return localStorage.getItem(storageDraftKey) || challenge.starterCode;
  });
  const [isRunning, setIsRunning] = useState(false);
  const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageDraftKey);
    setCode(saved || challenge.starterCode);
    setTestOutcome(null);
  }, [lesson.id]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    localStorage.setItem(storageDraftKey, newCode);
  };

  const handleReset = () => {
    setCode(challenge.starterCode);
    localStorage.setItem(storageDraftKey, challenge.starterCode);
    setTestOutcome(null);
  };

  const handleRunTests = async (includeHidden: boolean) => {
    setIsRunning(true);
    try {
      const outcome = await CodeEvaluator.runTests(
        code,
        challenge.testCases,
        includeHidden
      );
      setTestOutcome(outcome);

      if (outcome.passed && includeHidden) {
        onLessonCompleted(lesson.id);
      }
    } catch (err: any) {
      setTestOutcome({
        passed: false,
        total: challenge.testCases.length,
        passedCount: 0,
        syntaxError: err.message,
        results: []
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="sandbox-card">
      <div className="sandbox-header">
        <h3 className="sandbox-title">{challenge.title}</h3>
        <p className="sandbox-desc">{challenge.description}</p>
      </div>

      <div className="editor-toolbar">
        <div className="toolbar-left">
          <span>JavaScript / TypeScript Sandbox</span>
          <span>•</span>
          <span style={{ color: '#38bdf8' }}>Tự động lưu nháp</span>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-secondary" onClick={handleReset}>
            ↺ Khôi phục ban đầu
          </button>
          <button
            className="btn btn-primary"
            disabled={isRunning}
            onClick={() => handleRunTests(false)}
          >
            ▶️ Chạy Thử (Visible Cases)
          </button>
          <button
            className="btn btn-success"
            disabled={isRunning}
            onClick={() => handleRunTests(true)}
          >
            🚀 Nộp Bài (Kèm Hidden Cases)
          </button>
        </div>
      </div>

      <div className="editor-container">
        <textarea
          className="code-textarea"
          value={code}
          onChange={handleCodeChange}
          spellCheck="false"
        />
      </div>

      {testOutcome && (
        <div className="test-results-panel">
          {testOutcome.syntaxError ? (
            <div>
              <div className="test-summary-badge fail">❌ Lỗi Cú Pháp / Thực Thi</div>
              <div
                className="test-case-error"
                style={{
                  fontSize: '14px',
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '6px'
                }}
              >
                {testOutcome.syntaxError}
              </div>
            </div>
          ) : (
            <div>
              <div
                className={`test-summary-badge ${testOutcome.passed ? 'pass' : 'fail'}`}
              >
                {testOutcome.passed
                  ? `✅ VƯỢT QUA TOÀN BỘ (${testOutcome.passedCount}/${testOutcome.total} Tests Pass)`
                  : `❌ CHƯA ĐẠT (${testOutcome.passedCount}/${testOutcome.total} Tests Pass)`}
              </div>

              {testOutcome.results.map((res, idx) => (
                <div key={idx} className="test-case-row">
                  <div className="test-case-header">
                    <span className="test-case-name">
                      {res.hidden ? '🔒 [Hidden Case] ' : ''}
                      {res.name}
                    </span>
                    <span
                      className={`test-case-status ${res.passed ? 'pass' : 'fail'}`}
                    >
                      {res.passed ? 'PASS ✅' : 'FAIL ❌'}
                    </span>
                  </div>
                  {res.error && (
                    <div className="test-case-error">
                      Chi tiết: {res.error}
                    </div>
                  )}
                  {!res.hidden && !res.passed && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '4px'
                      }}
                    >
                      Input: <code>{res.input}</code> | Expected: <code>{res.expected}</code> | Actual: <code>{res.actual}</code>
                    </div>
                  )}
                </div>
              ))}

              {testOutcome.passed && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    borderRadius: '8px',
                    color: '#34d399',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}
                >
                  🎉 Xuất sắc! Đại ca đã hoàn thành bài học này. Tiến độ đã được lưu lại!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
