import React from 'react';
import type { Lesson } from '../data/curriculum.ts';
import { TutorChat } from './TutorChat.tsx';
import { CodeViewer, renderEditorHtml, renderDiagramHtml, escapeHtml } from './CodeViewer.tsx';

interface TheoryTabProps {
  lesson: Lesson;
  isLessonCleared: boolean;
  onMarkCleared: () => void;
  onNextTab: () => void;
}

function parseMarkdownTables(text: string): { processedText: string; tables: string[] } {
  const tables: string[] = [];
  // Regex to match a standard markdown table with pipes and alignment rows
  const tableRegex = /(?:^|\n)((?:\|[^\n]+\|\r?\n)\|[ \t]*(?::?[-]+:?[ \t]*\|)+[ \t]*\r?\n(?:\|[^\n]+\|\r?\n?)+)/g;

  const processedText = text.replace(tableRegex, (match, tableContent: string) => {
    const rawLines = tableContent.trim().split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
    if (rawLines.length < 2) return match;

    const parseRow = (line: string): string[] => {
      const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
      return trimmed.split('|').map((c) => c.trim());
    };

    const headerCells = parseRow(rawLines[0]);
    const separatorCells = parseRow(rawLines[1]);
    const bodyRows = rawLines.slice(2).map(parseRow);

    const alignments = separatorCells.map((cell) => {
      const starts = cell.startsWith(':');
      const ends = cell.endsWith(':');
      if (starts && ends) return 'center';
      if (ends) return 'right';
      return 'left';
    });

    const renderCellContent = (cell: string) => {
      return cell
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    };

    const theadHtml = `<thead><tr>${headerCells
      .map((h, i) => `<th style="text-align: ${alignments[i] || 'left'}">${renderCellContent(h)}</th>`)
      .join('')}</tr></thead>`;

    const tbodyHtml = `<tbody>${bodyRows
      .map(
        (row) =>
          `<tr>${row
            .map((c, i) => `<td style="text-align: ${alignments[i] || 'left'}">${renderCellContent(c)}</td>`)
            .join('')}</tr>`
      )
      .join('')}</tbody>`;

    const tableHtml = `
      <div class="technical-table-container">
        <table class="technical-matrix-table">
          ${theadHtml}
          ${tbodyHtml}
        </table>
      </div>
    `;

    const placeholder = `__TABLE_BLOCK_${tables.length}__`;
    tables.push(tableHtml);
    return `\n\n${placeholder}\n\n`;
  });

  return { processedText, tables };
}

function formatMarkdown(text: string): string {
  if (!text) return '';

  const codeBlocks: string[] = [];

  // 1. Extract fenced code blocks first and format diagrams vs code
  let processed = text.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const isDiagram =
      lang === 'diagram' ||
      lang === 'ascii' ||
      code.includes('──') ||
      code.includes('┌') ||
      code.includes('│') ||
      code.includes('▼') ||
      code.includes('◄');

    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    if (isDiagram) {
      codeBlocks.push(renderDiagramHtml(code));
    } else {
      const rawLang = lang || 'typescript';
      codeBlocks.push(renderEditorHtml(code, rawLang));
    }
    return `\n\n${placeholder}\n\n`;
  });

  // 2. Extract and format Markdown Tables
  const { processedText: textWithTables, tables } = parseMarkdownTables(processed);
  processed = textWithTables;

  // 3. Headings
  processed = processed
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 4. Bold & Italic
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 5. Inline code
  processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  // 6. Lists (nested lists, unordered lists, ordered lists)
  processed = processed.replace(/^( {2,}|\t+)[-*]\s+(.*$)/gim, '<li style="margin-left: 24px; list-style-type: circle;">$2</li>');
  processed = processed.replace(/^[-*]\s+(.*$)/gim, '<li>$1</li>');
  processed = processed.replace(/^\d+\.\s+(.*$)/gim, '<li style="list-style-type: decimal; margin-left: 20px;">$1</li>');
  processed = processed.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>');

  // 7. Paragraphs
  const blocks = processed.split(/\n{2,}/);
  processed = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<h2>') ||
        trimmed.startsWith('<h1>') ||
        trimmed.startsWith('<ul>') ||
        trimmed.startsWith('<ol>') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('__CODE_BLOCK_') ||
        trimmed.startsWith('__TABLE_BLOCK_')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n\n');

  // 8. Restore tables & code blocks
  tables.forEach((tableHtml, index) => {
    processed = processed.replace(`__TABLE_BLOCK_${index}__`, tableHtml);
  });

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
        <button className="btn btn-primary" onClick={onNextTab}>
          Tiếp tục sang Trắc Nghiệm ➡️
        </button>
      </div>
    </div>
  );
};
