import React, { useState } from 'react';
import './CodeViewer.css';

interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  maxHeight?: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightSyntax(code: string, lang: string = 'typescript'): string {
  if (!code) return '';
  const lowerLang = (lang || '').toLowerCase();
  if (lowerLang === 'diagram' || lowerLang === 'text' || lowerLang === 'ascii') {
    return escapeHtml(code);
  }

  // Token regex for TypeScript, JavaScript, SQL, Prisma, JSON, Bash
  const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|(`(?:\\`|[^`])*`|"(?:\\"|[^"])*"|'(?:\\'|[^'])*')|(@[a-zA-Z_$][a-zA-Z0-9_$]*)|(\b(?:export|import|from|class|interface|type|enum|extends|implements|function|return|const|let|var|if|else|switch|case|default|for|while|do|try|catch|finally|throw|new|async|await|typeof|instanceof|void|private|public|protected|readonly|static|get|set|as|is|in|of|null|undefined|true|false|SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|GROUP|BY|ORDER|HAVING|LIMIT|model|datasource|generator)\b)|(\b(?:string|number|boolean|symbol|bigint|object|any|unknown|never|Record|Promise|Array|Map|Set|Date|RegExp|Injectable|Controller|Module|Service|Repository|DTO|PipeTransform|ExecutionContext|CallHandler|ValidationPipe|Body|Param|Query|Get|Post|Put|Patch|Delete|UseGuards|UsePipes)\b)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|([{}()[\].,;:?!=+\-*/%&|^~<>])/g;

  let lastIndex = 0;
  let html = '';
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      html += escapeHtml(code.slice(lastIndex, match.index));
    }

    const [full, comment, string, decorator, keyword, typeName, number, funcName, punct] = match;

    if (comment) {
      html += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
    } else if (string) {
      html += `<span class="tok-string">${escapeHtml(string)}</span>`;
    } else if (decorator) {
      html += `<span class="tok-decorator">${escapeHtml(decorator)}</span>`;
    } else if (keyword) {
      html += `<span class="tok-keyword">${escapeHtml(keyword)}</span>`;
    } else if (typeName) {
      html += `<span class="tok-type">${escapeHtml(typeName)}</span>`;
    } else if (number) {
      html += `<span class="tok-number">${escapeHtml(number)}</span>`;
    } else if (funcName) {
      html += `<span class="tok-function">${escapeHtml(funcName)}</span>`;
    } else if (punct) {
      html += `<span class="tok-punct">${escapeHtml(punct)}</span>`;
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < code.length) {
    html += escapeHtml(code.slice(lastIndex));
  }

  return html;
}

export function renderCodeLines(code: string, lang: string = 'typescript'): string {
  const cleanCode = code.replace(/^\n+|\n+$/g, '');
  const lines = cleanCode.split('\n');
  return lines
    .map((line, idx) => {
      const highlighted = highlightSyntax(line, lang);
      return `<div class="editor-line"><span class="line-num">${idx + 1}</span><span class="line-text">${highlighted || '&nbsp;'}</span></div>`;
    })
    .join('');
}

export function renderEditorHtml(code: string, lang: string = 'typescript', filename?: string): string {
  const displayFilename = filename || (
    lang === 'typescript' || lang === 'ts' ? 'example.ts' :
    lang === 'json' ? 'data.json' :
    lang === 'bash' || lang === 'sh' ? 'terminal.sh' :
    lang === 'sql' ? 'query.sql' :
    lang === 'prisma' ? 'schema.prisma' :
    'diagram.txt'
  );

  const htmlLines = renderCodeLines(code, lang);

  return `
    <div class="code-viewer-card vs-code-editor">
      <div class="code-viewer-header vs-editor-titlebar">
        <div class="code-file-badge">
          <svg class="code-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span class="code-filename">${escapeHtml(displayFilename)}</span>
        </div>
        <div class="code-header-actions vs-editor-actions">
          <span class="code-lang-pill vs-lang-badge">${escapeHtml(lang.toUpperCase())}</span>
          <button class="code-copy-btn vs-copy-btn" type="button" title="Sao chép toàn bộ mã nguồn" aria-label="Sao chép mã nguồn">
            <svg class="copy-svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="copy-text">Sao chép</span>
          </button>
        </div>
      </div>
      <div class="code-viewer-body vs-editor-body">
        ${htmlLines}
      </div>
    </div>
  `;
}

export function renderDiagramHtml(
  diagramText: string,
  title: string = 'BẢN VẼ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE BLUEPRINT)'
): string {
  const cleanDiagram = escapeHtml(diagramText.replace(/^\n+|\n+$/g, ''));
  return `
    <div class="technical-blueprint-box">
      <div class="blueprint-header">
        <div class="blueprint-badge">
          <span class="blueprint-icon">ARCH</span>
          <span class="blueprint-title">${escapeHtml(title)}</span>
        </div>
        <div class="blueprint-actions">
          <span class="blueprint-format-tag">BOX-DRAWING ARCHITECTURE</span>
        </div>
      </div>
      <div class="blueprint-body">
        <pre class="blueprint-diagram-text">${cleanDiagram}</pre>
      </div>
    </div>
  `;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language = 'typescript',
  filename,
  maxHeight
}) => {
  const [copied, setCopied] = useState(false);

  const displayFilename =
    filename ||
    (language === 'typescript' || language === 'ts'
      ? 'reference.service.ts'
      : language === 'json'
        ? 'data.json'
        : language === 'bash' || language === 'sh'
          ? 'terminal.sh'
          : language === 'sql'
            ? 'query.sql'
            : language === 'prisma'
              ? 'schema.prisma'
              : 'code.txt');

  const langIcon =
    language === 'typescript' || language === 'ts'
      ? 'TS'
      : language === 'json'
        ? '{ }'
        : language === 'bash' || language === 'sh'
          ? '>_'
          : language === 'sql'
            ? 'SQL'
            : 'SRC';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const htmlLines = renderCodeLines(code, language);

  return (
    <div className="code-viewer-card vs-code-editor">
      <div className="code-viewer-header vs-editor-titlebar">
        <div className="code-file-badge">
          <svg className="code-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span className="code-filename">{displayFilename}</span>
        </div>
        <div className="code-header-actions vs-editor-actions">
          <span className="code-lang-pill vs-lang-badge">{language.toUpperCase()}</span>
          <button
            className={`code-copy-btn vs-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            type="button"
            title="Sao chép mã nguồn"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span className="copy-text" style={{ color: '#10b981' }}>Đã chép</span>
              </>
            ) : (
              <>
                <svg className="copy-svg-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span className="copy-text">Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div
        className="code-viewer-body vs-editor-body"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
        dangerouslySetInnerHTML={{ __html: htmlLines }}
      />
    </div>
  );
};
