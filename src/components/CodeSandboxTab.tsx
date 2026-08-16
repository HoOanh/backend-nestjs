import React from 'react';
import type { Lesson } from '../data/curriculum.ts';
import { CodeSandboxEditor } from './CodeSandboxEditor.tsx';

interface CodeSandboxTabProps {
  lesson: Lesson;
  onLessonCompleted: (lessonId: string) => void;
}

export const CodeSandboxTab: React.FC<CodeSandboxTabProps> = ({ lesson, onLessonCompleted }) => {
  const challenge = lesson.codeChallenge;
  const storageDraftKey = `draft_${lesson.id}`;

  return (
    <CodeSandboxEditor
      challenge={challenge}
      fileName="solution.ts"
      filePath={`src > exercises > ${lesson.id} > solution.ts`}
      storageKey={storageDraftKey}
      headerBadge="Thực Hành & Chấm Điểm Sandbox"
      runVisibleButtonText="▶️ Chạy Thử (Visible Cases)"
      submitButtonText="🚀 Nộp Bài (Kèm Hidden Cases)"
      onPassed={() => onLessonCompleted(lesson.id)}
    />
  );
};
