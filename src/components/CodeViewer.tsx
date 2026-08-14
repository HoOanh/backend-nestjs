import React, { useState } from 'react';

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

  const langIcon =
    lang === 'typescript' || lang === 'ts' ? 'TS' :
    lang === 'json' ? '{ }' :
    lang === 'bash' || lang === 'sh' ? '>_' :
    lang === 'sql' ? 'SQL' : '📄';

  const htmlLines = renderCodeLines(code, lang);

  return `
    <div class="vs-code-editor">
      <div class="vs-editor-titlebar">
        <div class="vs-window-dots">
          <span class="dot dot-red"></span>
          <span class="dot dot-yellow"></span>
          <span class="dot dot-green"></span>
        </div>
        <div class="vs-editor-tabs">
          <div class="vs-tab active">
            <span class="vs-tab-badge">${langIcon}</span>
            <span class="vs-tab-title">${escapeHtml(displayFilename)}</span>
          </div>
        </div>
        <div class="vs-editor-actions">
          <span class="vs-lang-badge">${escapeHtml(lang.toUpperCase())}</span>
          <button class="vs-copy-btn" type="button" title="Sao chép mã nguồn">📋 Sao chép</button>
        </div>
      </div>
      <div class="vs-editor-body">
        ${htmlLines}
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

  const displayFilename = filename || (
    language === 'typescript' || language === 'ts' ? 'reference.service.ts' :
    language === 'json' ? 'data.json' :
    language === 'bash' || language === 'sh' ? 'terminal.sh' :
    language === 'sql' ? 'query.sql' :
    language === 'prisma' ? 'schema.prisma' :
    'code.txt'
  );

  const langIcon =
    language === 'typescript' || language === 'ts' ? 'TS' :
    language === 'json' ? '{ }' :
    language === 'bash' || language === 'sh' ? '>_' :
    language === 'sql' ? 'SQL' : '📄';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const htmlLines = renderCodeLines(code, language);

  return (
    <div className="vs-code-editor">
      <div className="vs-editor-titlebar">
        <div className="vs-window-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <div className="vs-editor-tabs">
          <div className="vs-tab active">
            <span className="vs-tab-badge">{langIcon}</span>
            <span className="vs-tab-title">{displayFilename}</span>
          </div>
        </div>
        <div className="vs-editor-actions">
          <span className="vs-lang-badge">{language.toUpperCase()}</span>
          <button className="vs-copy-btn" onClick={handleCopy} title="Sao chép mã nguồn">
            {copied ? '✓ Đã chép' : '📋 Sao chép'}
          </button>
        </div>
      </div>
      <div
        className="vs-editor-body"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
        dangerouslySetInnerHTML={{ __html: htmlLines }}
      />
    </div>
  );
};
