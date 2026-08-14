import React from 'react';
import type { Lesson } from '../data/curriculum.ts';
import { TutorChat } from './TutorChat.tsx';
import { CodeViewer, renderEditorHtml, escapeHtml } from './CodeViewer.tsx';

interface TheoryTabProps {
  lesson: Lesson;
  isLessonCleared: boolean;
  onMarkCleared: () => void;
  onNextTab: () => void;
}

function formatMarkdown(text: string): string {
  if (!text) return '';

  const codeBlocks: string[] = [];

  // 1. Extract fenced code blocks first and format as VS Code editor templates
  let processed = text.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const rawLang = lang || (code.includes('──') || code.includes('┌') ? 'diagram' : 'typescript');
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(renderEditorHtml(code, rawLang));
    return `\n\n${placeholder}\n\n`;
  });

  // 2. Headings
  processed = processed
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 3. Bold & Italic
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 4. Inline code
  processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // 5. Lists (nested lists, unordered lists, ordered lists)
  processed = processed.replace(/^( {2,}|\t+)[-*]\s+(.*$)/gim, '<li style="margin-left: 24px; list-style-type: circle;">$2</li>');
  processed = processed.replace(/^[-*]\s+(.*$)/gim, '<li>$1</li>');
  processed = processed.replace(/^\d+\.\s+(.*$)/gim, '<li style="list-style-type: decimal; margin-left: 20px;">$1</li>');
  processed = processed.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>');

  // 6. Paragraphs
  const blocks = processed.split(/\n{2,}/);
  processed = blocks
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<h2>') ||
        trimmed.startsWith('<h1>') ||
        trimmed.startsWith('<ul>') ||
        trimmed.startsWith('<ol>') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('__CODE_BLOCK_')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n\n');

  // 7. Restore code blocks
  codeBlocks.forEach((blockHtml, index) => {
    processed = processed.replace(`__CODE_BLOCK_${index}__`, blockHtml);
  });

  return processed;
}

function extractFilenameFromCode(code: string): string {
  const match = code.match(/\/\/\s*(?:Trích từ|File:|Source:)?\s*([^\n]+\.tsx?|[^\n]+\.ts|[^\n]+\.json|[^\n]+\.prisma)/i);
  if (match && match[1]) {
    const parts = match[1].trim().split('/');
    return parts[parts.length - 1];
  }
  return 'reference.service.ts';
}

export const TheoryTab: React.FC<TheoryTabProps> = ({
  lesson,
  isLessonCleared,
  onMarkCleared,
  onNextTab
}) => {
  const referenceFilename = extractFilenameFromCode(lesson.realCodeSnippet || '');

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
        <div style={{ marginTop: '12px' }}>
          <CodeViewer
            code={lesson.realCodeSnippet}
            language="typescript"
            filename={referenceFilename}
          />
        </div>
      </div>

      <TutorChat
        lesson={lesson}
        isLessonCleared={isLessonCleared}
        onMarkCleared={onMarkCleared}
      />

      <div style={{ textAlign: 'right', marginTop: '20px' }}>
        <button className="btn btn-primary" onClick={onNextTab} disabled={!isLessonCleared}>
          Tiếp tục sang Trắc Nghiệm ➡️
        </button>
      </div>
    </div>
  );
};

