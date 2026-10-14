import React from 'react';
import './TheoryTab.css';
import type { Lesson } from '../../data/curriculum.ts';
import { CodeViewer, renderEditorHtml, escapeHtml } from '../common/CodeViewer.tsx';
import { renderSmartMindMapHtml, initMindMapControllers } from '../mindmap/index.ts';

interface TheoryTabProps {
  lesson: Lesson;
  onNextTab: () => void;
  onOpenTutor?: () => void;
  onLessonCleared?: () => void;
}

function stripLeadingEmojis(input: string): string {
  return input
    .replace(/^[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}✦❖•]+/gu, '')
    .trim();
}

function stripInlineEmojis(input: string): string {
  return input
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ');
}

function parseMarkdownTables(text: string): { processedText: string; tables: string[] } {
  const tables: string[] = [];
  const tableRegex = /(?:^|\n)([ \t]*\|[^\n]+\|[ \t]*\r?\n[ \t]*\|(?:\s*:?-+:?\s*\|)+\r?\n(?:[ \t]*\|[^\n]+\|[ \t]*\r?\n?)+)/g;

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
      return stripInlineEmojis(cell)
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

    const tableIndex = tables.length + 1;
    const tableHtml = `
      <div class="technical-table-container" role="region" aria-label="Bảng thông số kỹ thuật ${tableIndex}">
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

function renderFormulaBlockHtml(formulaText: string): string {
  const cleanText = escapeHtml(formulaText.replace(/^\n+|\n+$/g, ''));
  return `
    <div class="theory-formula-box">
      <div class="formula-box-header">
        <span class="formula-box-badge">CÔNG THỨC &amp; ĐỊNH LƯỢNG KỸ THUẬT</span>
      </div>
      <pre class="formula-box-body">${cleanText}</pre>
    </div>
  `;
}

function inferSnippetFilename(code: string, lang: string): string {
  // 1. Explicit comment with file path or marker
  // e.g. // File: src/orders/order-memory-trace.ts, // Trích từ: billing.service.ts
  const explicitMatch = code.match(
    /\/\/\s*(?:(?:File|Source|Trích từ|Tệp|Đoạn mã)\s*:\s*|\s*)([a-zA-Z0-9_.\-/]+\.(?:tsx?|jsx?|json|prisma|sql|sh|env|ya?ml))\b/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const parts = explicitMatch[1].trim().split('/');
    return parts[parts.length - 1];
  }

  // 2. Class detection (e.g. export class BillingServiceBroken -> billing.service.ts)
  const classMatch = code.match(/(?:export\s+)?class\s+([A-Za-z0-9_]+)/);
  if (classMatch && classMatch[1]) {
    const kebab = classMatch[1]
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(
        /-(service|controller|indicator|module|guard|pipe|interceptor|middleware|filter)(?:-(broken|safe))?$/,
        '.$1'
      );
    return `${kebab}.ts`;
  }

  // 3. Function detection (e.g. function processOrder -> process-order.ts)
  const fnMatch = code.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
  if (fnMatch && fnMatch[1]) {
    const kebab = fnMatch[1]
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
    return `${kebab}.ts`;
  }

  // 4. Interface / Type detection (e.g. interface OrderPayload -> order-payload.ts)
  const ifaceMatch = code.match(/(?:export\s+)?(?:interface|type)\s+([A-Za-z0-9_]+)/);
  if (ifaceMatch && ifaceMatch[1]) {
    const kebab = ifaceMatch[1]
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
    return `${kebab}.ts`;
  }

  // 5. Fallback based on language
  return lang === 'json'
    ? 'payload.json'
    : lang === 'bash' || lang === 'sh'
      ? 'terminal.sh'
      : lang === 'sql'
        ? 'query.sql'
        : lang === 'prisma'
          ? 'schema.prisma'
          : 'example.ts';
}

function formatMarkdown(text: string): string {
  if (!text) return '';

  const codeBlocks: string[] = [];

  // 1. Extract fenced code blocks first and consume redundant diagram headings directly above diagram blocks
  let processed = text.replace(
    /(?:^|\n)(?:(###\s+[^\n]+)\r?\n\s*)?```(\w*)\r?\n([\s\S]*?)```/g,
    (_match, precedingH3: string | undefined, lang: string, code: string, offset: number, fullText: string) => {
      const normalizedLang = (lang || '').trim().toLowerCase();
      const isDiagram =
        normalizedLang === 'diagram' ||
        normalizedLang === 'ascii' ||
        code.includes('──') ||
        code.includes('┌') ||
        code.includes('│') ||
        code.includes('▼') ||
        code.includes('◄');

      const isFormulaBlock =
        !normalizedLang ||
        normalizedLang === 'formula' ||
        normalizedLang === 'math' ||
        normalizedLang === 'text';

      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      if (isDiagram) {
        let detectedTitle = '';
        if (precedingH3) {
          detectedTitle = stripLeadingEmojis(precedingH3.replace(/^#+\s*/, ''));
        } else {
          const precedingText = fullText.slice(Math.max(0, offset - 400), offset);
          const prevLines = precedingText.trim().split('\n').filter((l) => l.trim().length > 0);
          for (let i = prevLines.length - 1; i >= 0; i--) {
            const line = prevLines[i].trim();
            if (line.startsWith('#')) {
              detectedTitle = stripLeadingEmojis(line.replace(/^#+\s*/, ''));
              break;
            }
          }
        }
        codeBlocks.push(renderSmartMindMapHtml(code, detectedTitle));
        // Notice: precedingH3 is consumed into the diagram header so it is not duplicated above the card
        return `\n\n${placeholder}\n\n`;
      } else if (isFormulaBlock) {
        codeBlocks.push(renderFormulaBlockHtml(code));
        const restoredH3 = precedingH3 ? `\n${precedingH3}\n\n` : '\n\n';
        return `${restoredH3}${placeholder}\n\n`;
      } else {
        const inferredFile = inferSnippetFilename(code, normalizedLang);
        codeBlocks.push(renderEditorHtml(code, normalizedLang, inferredFile));
        const restoredH3 = precedingH3 ? `\n${precedingH3}\n\n` : '\n\n';
        return `${restoredH3}${placeholder}\n\n`;
      }
    }
  );

  // 2. Extract and format Markdown Tables
  const { processedText: textWithTables, tables } = parseMarkdownTables(processed);
  processed = textWithTables;

  // 3. Extract inline code spans before bold/italic so * or _ inside `code` are preserved
  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`\n]+)`/g, (_, code: string) => {
    const token = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  // 4. Horizontal rules
  processed = processed.replace(/^[ \t]*---+[ \t]*$/gm, '\n\n<hr class="theory-divider" />\n\n');

  // 5. Headings (strip AI emojis from headings for clean technical report hierarchy)
  processed = processed
    .replace(/^#### (.*$)/gim, (_, h) => `<h4>${stripLeadingEmojis(stripInlineEmojis(h))}</h4>`)
    .replace(/^### (.*$)/gim, (_, h) => `<h3>${stripLeadingEmojis(stripInlineEmojis(h))}</h3>`)
    .replace(/^## (.*$)/gim, (_, h) => `<h2>${stripLeadingEmojis(stripInlineEmojis(h))}</h2>`)
    .replace(/^# (.*$)/gim, (_, h) => `<h1>${stripLeadingEmojis(stripInlineEmojis(h))}</h1>`);

  // 6. Bold & Italic
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 7. Blockquotes (support single and multi-line > callouts with structured spacing)
  processed = processed.replace(
    /(?:^|\n)((?:>[ \t]?[^\n]+\r?\n?)+)/g,
    (_match, rawQuote: string) => {
      const lines = rawQuote
        .trim()
        .split(/\r?\n/)
        .map((line) => stripInlineEmojis(line.replace(/^>[ \t]?/, '').trim()))
        .filter(Boolean);
      const htmlLines = lines
        .map((line, idx) =>
          idx === 0
            ? `<div class="callout-line callout-lead">${line}</div>`
            : `<div class="callout-line">${line}</div>`
        )
        .join('');
      return `\n\n<blockquote class="theory-callout">${htmlLines}</blockquote>\n\n`;
    }
  );

  // 8. Lists: join indented plain-text continuation lines onto their parent list item first
  processed = processed.replace(
    /^([ \t]*(?:[-*]|\d+\.)\s+[^\n]+)\r?\n[ \t]{2,}(?![-*]\s|\d+\.\s)([^\n]+)/gm,
    '$1 $2'
  );
  processed = processed.replace(
    /^( {2,}|\t+)[-*]\s+(.*$)/gim,
    (_, _indent, item) => `<li class="nested-li">${stripLeadingEmojis(item)}</li>`
  );
  processed = processed.replace(
    /^[-*]\s+(.*$)/gim,
    (_, item) => `<li>${stripLeadingEmojis(item)}</li>`
  );
  processed = processed.replace(
    /^(\d+)\.\s+(.*$)/gim,
    (_, num: string, item: string) =>
      `<li class="ordered-li" value="${num}"><span class="ordered-li-num">${num}.</span><div class="ordered-li-body">${stripLeadingEmojis(item)}</div></li>`
  );
  processed = processed.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, '<ul class="theory-list">$1</ul>');

  // 9. Paragraphs
  const blocks = processed.split(/\n{2,}/);
  processed = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h4>') ||
        trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<h2>') ||
        trimmed.startsWith('<h1>') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('__CODE_BLOCK_') ||
        trimmed.startsWith('__TABLE_BLOCK_')
      ) {
        return trimmed;
      }
      return `<p>${stripInlineEmojis(trimmed).replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n\n');

  // 10. Restore inline code, tables & code blocks (use function replacer to avoid $ pattern issues)
  inlineCodes.forEach((codeHtml, index) => {
    processed = processed.replace(`__INLINE_CODE_${index}__`, () => codeHtml);
  });

  tables.forEach((tableHtml, index) => {
    processed = processed.replace(`__TABLE_BLOCK_${index}__`, () => tableHtml);
  });

  codeBlocks.forEach((blockHtml, index) => {
    processed = processed.replace(`__CODE_BLOCK_${index}__`, () => blockHtml);
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

function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0` : null;
}

export const TheoryTab: React.FC<TheoryTabProps> = ({
  lesson,
  onNextTab,
  onOpenTutor,
  onLessonCleared,
}) => {
  const referenceFilename = extractFilenameFromCode(lesson.realCodeSnippet || '');
  const contentRef = React.useRef<HTMLDivElement>(null);
  const embedUrl = getYouTubeEmbedUrl(lesson.videoUrl);

  // Memoize dangerouslySetInnerHTML object so parent re-renders (e.g. toggling Tutor Chat)
  // NEVER reset the live DOM or wipe out mindmap interactive state/listeners
  const renderedTheoryHtml = React.useMemo(
    () => ({ __html: formatMarkdown(lesson.theory) }),
    [lesson.theory]
  );

  React.useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const cleanupMindMap = initMindMapControllers(container);

    const handleCopyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const copyBtn = target?.closest('.vs-copy-btn') as HTMLButtonElement | null;
      if (!copyBtn) return;
      const editor = copyBtn.closest('.vs-code-editor');
      if (!editor) return;
      const lineEls = editor.querySelectorAll('.line-text');
      const rawText = Array.from(lineEls)
        .map((el) => (el.textContent || '').replace(/\u00a0/g, ''))
        .join('\n');
      navigator.clipboard?.writeText(rawText);
      const prevText = copyBtn.textContent;
      copyBtn.textContent = 'Đã chép ✓';
      setTimeout(() => {
        copyBtn.textContent = prevText || 'Sao chép';
      }, 2000);
    };

    container.addEventListener('click', handleCopyClick);
    return () => {
      cleanupMindMap();
      container.removeEventListener('click', handleCopyClick);
    };
  }, [lesson.id, renderedTheoryHtml]);

  const handleProceedToQuiz = () => {
    if (onLessonCleared) {
      onLessonCleared();
    }
    onNextTab();
  };

  return (
    <div>
      {embedUrl && (
        <div className="theory-video-player-card">
          <div className="theory-video-header">
            <div className="video-badge-group">
              <span className="video-badge">VIDEO BÀI GIẢNG CHUYÊN SÂU</span>
              <span className="video-author">Tác giả: Trần Quốc Huy (Wecommit) • 1h38m</span>
            </div>
            <a
              href={lesson.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="video-external-link"
            >
              Mở trên YouTube ↗
            </a>
          </div>
          <div className="theory-video-responsive">
            <iframe
              src={embedUrl}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div className="theory-card">
        <header className="theory-lesson-header">
          <div className="theory-lesson-meta">
            <span className="theory-lesson-tag">{lesson.tag}</span>
            <span className="theory-lesson-duration">Thời lượng nghiên cứu: {lesson.duration}</span>
          </div>
          <h1 className="theory-lesson-main-title">{lesson.title}</h1>
        </header>
        <div
          ref={contentRef}
          className="theory-content"
          dangerouslySetInnerHTML={renderedTheoryHtml}
        />
      </div>

      <div className="real-source-callout">
        <div className="callout-title">Trích Dẫn Mã Nguồn Thực Tế Trong Dự Án Arc Irobot:</div>
        <div style={{ marginTop: '12px' }}>
          <CodeViewer
            code={lesson.realCodeSnippet}
            language="typescript"
            filename={referenceFilename}
          />
        </div>
      </div>

      {/* AI Tutor Assistant Callout Banner */}
      <div className="theory-tutor-banner">
        <div className="tutor-banner-left">
          <div className="tutor-banner-avatar">
            <img src="/logo.png" alt="Arc Irobot" style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
          </div>
          <div className="tutor-banner-info">
            <h4>Đồng Hành Cùng Arc AI Co-Pilot</h4>
            <p>ĐẠI CA đang vướng mắc phần kiến trúc hay logic code nào? Hãy mở khung chat nổi hoặc ghim dock bên cạnh để vừa học vừa tương tác hoặc gửi ảnh phân tích ngay lập tức.</p>
          </div>
        </div>
        <div className="tutor-banner-actions">
          {onOpenTutor && (
            <button className="btn btn-tutor-callout" onClick={onOpenTutor} type="button">
              Mở AI Tutor Co-Pilot
            </button>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', marginTop: '24px' }}>
        <button className="btn btn-primary" onClick={handleProceedToQuiz} type="button">
          Tiếp tục sang Trắc Nghiệm →
        </button>
      </div>
    </div>
  );
};
