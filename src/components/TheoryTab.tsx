import React from 'react';
import type { Lesson } from '../data/curriculum.ts';

interface TheoryTabProps {
  lesson: Lesson;
  onNextTab: () => void;
}

function formatMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```typescript([\s\S]*?)```/g, '<div class="code-block-wrapper"><div class="code-block-header">TypeScript</div><pre class="code-block-content">$1</pre></div>')
    .replace(/```bash([\s\S]*?)```/g, '<div class="code-block-wrapper"><div class="code-block-header">Terminal / Bash</div><pre class="code-block-content">$1</pre></div>')
    .replace(/```json([\s\S]*?)```/g, '<div class="code-block-wrapper"><div class="code-block-header">JSON</div><pre class="code-block-content">$1</pre></div>')
    .replace(/^\s*-\s(.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '<p></p>');
}

export const TheoryTab: React.FC<TheoryTabProps> = ({ lesson, onNextTab }) => {
  return (
    <div>
      <div className="theory-card">
        <div
          className="theory-content"
          dangerouslySetInnerHTML={{ __html: formatMarkdown(lesson.theory) }}
        />
      </div>

      <div className="real-source-callout">
        <div className="callout-title">📂 Trích Dẫn Mã Nguồn Thực Tế Trong Dự Án eSmiles:</div>
        <div className="code-block-wrapper" style={{ marginTop: '10px' }}>
          <div className="code-block-header">
            <span>NestJS Real-world Reference</span>
            <span>TypeScript</span>
          </div>
          <pre className="code-block-content">{lesson.realCodeSnippet}</pre>
        </div>
      </div>

      <div style={{ textAlign: 'right', marginTop: '20px' }}>
        <button className="btn btn-primary" onClick={onNextTab}>
          Tiếp tục sang Trắc Nghiệm ➡️
        </button>
      </div>
    </div>
  );
};
