import React, { useState, useEffect, useMemo } from 'react';
import type { Lesson, CodeChallenge } from '../../data/curriculum.ts';
import { CodeSandboxEditor } from './CodeSandboxEditor.tsx';

interface CodeSandboxTabProps {
  lesson: Lesson;
  onLessonCompleted: (lessonId: string) => void;
}

const DEFAULT_LEVEL_LABELS: Record<number, { level: 'basic' | 'intermediate' | 'advanced'; label: string }> = {
  0: { level: 'basic', label: 'Mức 1 · Cơ bản (Làm quen công thức)' },
  1: { level: 'intermediate', label: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)' },
  2: { level: 'advanced', label: 'Mức 3 · Nâng cao (Chuẩn Production)' },
};

export const CodeSandboxTab: React.FC<CodeSandboxTabProps> = ({ lesson, onLessonCompleted }) => {
  const challenges: CodeChallenge[] = useMemo(() => {
    if (lesson.codeChallenges && lesson.codeChallenges.length > 0) {
      return lesson.codeChallenges;
    }
    return [lesson.codeChallenge];
  }, [lesson]);

  const activeIdxStorageKey = `arc_sandbox_active_idx_${lesson.id}`;
  const passedStorageKey = `arc_sandbox_passed_${lesson.id}`;

  const [activeIdx, setActiveIdx] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(activeIdxStorageKey);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed < challenges.length) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 0;
  });

  const [passedIndices, setPassedIndices] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(passedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((n): n is number => typeof n === 'number');
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(activeIdxStorageKey);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed < challenges.length) {
          setActiveIdx(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setActiveIdx(0);
  }, [activeIdxStorageKey, challenges.length]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(passedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPassedIndices(parsed.filter((n): n is number => typeof n === 'number'));
          return;
        }
      }
    } catch {
      // ignore
    }
    setPassedIndices([]);
  }, [passedStorageKey]);

  const handleSelectChallenge = (idx: number) => {
    setActiveIdx(idx);
    try {
      sessionStorage.setItem(activeIdxStorageKey, String(idx));
    } catch {
      // ignore
    }
  };

  const handleExercisePassed = (idx: number) => {
    setPassedIndices((prev) => {
      const next = prev.includes(idx) ? prev : [...prev, idx];
      try {
        localStorage.setItem(passedStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    onLessonCompleted(lesson.id);
  };

  const safeIdx = activeIdx < challenges.length ? activeIdx : 0;
  const currentChallenge = challenges[safeIdx];
  const fallbackMeta = DEFAULT_LEVEL_LABELS[safeIdx] || {
    level: 'advanced' as const,
    label: `Bài ${safeIdx + 1}`,
  };

  const enrichedChallenge: CodeChallenge = {
    ...currentChallenge,
    level: currentChallenge.level || fallbackMeta.level,
    levelLabel: currentChallenge.levelLabel || fallbackMeta.label,
  };

  const storageDraftKey = safeIdx === 0 ? `draft_${lesson.id}` : `draft_${lesson.id}_ex_${safeIdx}`;
  const hasNextChallenge = safeIdx < challenges.length - 1;

  return (
    <div className="sandbox-multi-challenge-wrapper">
      {challenges.length > 1 && (
        <div className="sandbox-progression-bar">
          <div className="sandbox-progression-info">
            <span className="progression-eyebrow">LỘ TRÌNH THỰC HÀNH ({challenges.length} CẤP ĐỘ)</span>
            <span className="progression-summary">
              Đã hoàn thành <strong>{passedIndices.length}/{challenges.length}</strong> bài tập
            </span>
          </div>
          <div className="sandbox-progression-tabs" role="tablist" aria-label="Danh sách bài tập thực hành">
            {challenges.map((ch, idx) => {
              const meta = DEFAULT_LEVEL_LABELS[idx] || { level: 'advanced', label: `Bài ${idx + 1}` };
              const level = ch.level || meta.level;
              const isCompleted = passedIndices.includes(idx);
              const isActive = idx === safeIdx;
              return (
                <button
                  key={`${lesson.id}-challenge-${idx}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`sandbox-progression-tab level-${level} ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleSelectChallenge(idx)}
                >
                  <div className="prog-tab-top">
                    <span className="prog-tab-index">Bài {idx + 1}</span>
                    <span className={`prog-tab-level-dot level-${level}`}>
                      {level === 'basic' ? 'Cơ bản' : level === 'intermediate' ? 'Trung bình' : 'Nâng cao'}
                    </span>
                    {isCompleted && <span className="prog-tab-check" title="Đã vượt qua tất cả test cases">✓ Đạt</span>}
                  </div>
                  <div className="prog-tab-title">{ch.title.replace(/^Bài\s*\d+\s*:\s*/i, '')}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <CodeSandboxEditor
        key={`${lesson.id}_ex_${safeIdx}`}
        challenge={enrichedChallenge}
        fileName={`solution_ex${safeIdx + 1}.ts`}
        filePath={`src > exercises > ${lesson.id} > bai_${safeIdx + 1}_${enrichedChallenge.level || 'solution'}.ts`}
        storageKey={storageDraftKey}
        headerBadge={`Thực Hành · Bài ${safeIdx + 1}/${challenges.length}`}
        runVisibleButtonText="Chạy Thử (Visible Cases)"
        submitButtonText="Nộp Bài (Kèm Hidden Cases)"
        onPassed={() => handleExercisePassed(safeIdx)}
        onNextChallenge={hasNextChallenge ? () => handleSelectChallenge(safeIdx + 1) : undefined}
        nextChallengeLabel={
          hasNextChallenge
            ? `Sang Bài ${safeIdx + 2}: ${challenges[safeIdx + 1].title.replace(/^Bài\s*\d+\s*:\s*/i, '')} →`
            : undefined
        }
      />
    </div>
  );
};

