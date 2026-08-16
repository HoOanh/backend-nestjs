import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CodeEvaluator, type TestOutcome, type TestCase } from '../services/codeEvaluator.ts';
import { highlightSyntax } from './CodeViewer.tsx';
import { FormattedText } from './FormattedText.tsx';

export interface CodeSandboxChallenge {
  title: string;
  description: string;
  starterCode: string;
  testCases: TestCase[];
}

export interface CodeSandboxEditorProps {
  challenge: CodeSandboxChallenge;
  value?: string;
  onChange?: (code: string) => void;
  onTestOutcome?: (outcome: TestOutcome) => void;
  fileName?: string;
  filePath?: string;
  storageKey?: string;
  headerBadge?: string;
  runVisibleButtonText?: string;
  submitButtonText?: string;
  onPassed?: () => void;
  className?: string;
}

interface SuggestionItem {
  label: string;
  kind: 'keyword' | 'decorator' | 'type' | 'method' | 'snippet' | 'variable';
  detail?: string;
  insertText?: string;
}

const BASE_SUGGESTIONS: SuggestionItem[] = [
  // NestJS Decorators
  { label: '@Injectable()', kind: 'decorator', detail: 'NestJS Provider / Service' },
  { label: '@Controller()', kind: 'decorator', detail: 'NestJS Controller Decorator' },
  { label: '@Get()', kind: 'decorator', detail: 'HTTP GET Route' },
  { label: '@Post()', kind: 'decorator', detail: 'HTTP POST Route' },
  { label: '@Put()', kind: 'decorator', detail: 'HTTP PUT Route' },
  { label: '@Patch()', kind: 'decorator', detail: 'HTTP PATCH Route' },
  { label: '@Delete()', kind: 'decorator', detail: 'HTTP DELETE Route' },
  { label: '@Body()', kind: 'decorator', detail: 'Request Body Parameter' },
  { label: '@Param()', kind: 'decorator', detail: 'Route URL Parameter' },
  { label: '@Query()', kind: 'decorator', detail: 'Query String Parameter' },
  { label: '@UseGuards()', kind: 'decorator', detail: 'NestJS Guard Pipe' },
  { label: '@UsePipes()', kind: 'decorator', detail: 'NestJS Validation Pipe' },
  { label: '@IsString()', kind: 'decorator', detail: 'class-validator: String' },
  { label: '@IsNotEmpty()', kind: 'decorator', detail: 'class-validator: Not Empty' },
  { label: '@IsNumber()', kind: 'decorator', detail: 'class-validator: Number' },
  { label: '@IsEmail()', kind: 'decorator', detail: 'class-validator: Email' },
  { label: '@Min()', kind: 'decorator', detail: 'class-validator: Minimum Value' },
  { label: '@Max()', kind: 'decorator', detail: 'class-validator: Maximum Value' },
  { label: '@ApiProperty()', kind: 'decorator', detail: 'Swagger Property' },
  { label: '@ApiTags()', kind: 'decorator', detail: 'Swagger Tag' },

  // TypeScript Keywords & Snippets
  { label: 'export class', kind: 'keyword', insertText: 'export class ' },
  { label: 'export interface', kind: 'keyword', insertText: 'export interface ' },
  { label: 'export type', kind: 'keyword', insertText: 'export type ' },
  { label: 'constructor', kind: 'keyword', insertText: 'constructor(\n    \n  ) {}' },
  { label: 'async function', kind: 'keyword', insertText: 'async function ' },
  { label: 'async', kind: 'keyword' },
  { label: 'await', kind: 'keyword' },
  { label: 'return', kind: 'keyword' },
  { label: 'const', kind: 'keyword' },
  { label: 'let', kind: 'keyword' },
  { label: 'function', kind: 'keyword' },
  { label: 'private readonly', kind: 'keyword', insertText: 'private readonly ' },
  { label: 'private', kind: 'keyword' },
  { label: 'public', kind: 'keyword' },
  { label: 'protected', kind: 'keyword' },
  { label: 'readonly', kind: 'keyword' },
  { label: 'implements', kind: 'keyword' },
  { label: 'extends', kind: 'keyword' },
  { label: 'throw new Error()', kind: 'snippet', insertText: "throw new Error('')" },
  { label: 'try { ... } catch', kind: 'snippet', insertText: 'try {\n    \n  } catch (error) {\n    \n  }' },

  // Types
  { label: 'string', kind: 'type' },
  { label: 'number', kind: 'type' },
  { label: 'boolean', kind: 'type' },
  { label: 'Promise<any>', kind: 'type' },
  { label: 'Record<string, unknown>', kind: 'type' },
  { label: 'Array<string>', kind: 'type' },
  { label: 'ValidationPipe', kind: 'type' },
  { label: 'PipeTransform', kind: 'type' },
  { label: 'ExecutionContext', kind: 'type' },
  { label: 'CallHandler', kind: 'type' },

  // Built-in Methods
  { label: 'console.log()', kind: 'method', insertText: 'console.log()' },
  { label: 'JSON.stringify()', kind: 'method', insertText: 'JSON.stringify()' },
  { label: 'JSON.parse()', kind: 'method', insertText: 'JSON.parse()' },
  { label: 'Object.keys()', kind: 'method', insertText: 'Object.keys()' },
  { label: 'Object.values()', kind: 'method', insertText: 'Object.values()' },
  { label: 'Object.entries()', kind: 'method', insertText: 'Object.entries()' },
  { label: 'map()', kind: 'method', insertText: 'map((item) => )' },
  { label: 'filter()', kind: 'method', insertText: 'filter((item) => )' },
  { label: 'find()', kind: 'method', insertText: 'find((item) => )' },
  { label: 'reduce()', kind: 'method', insertText: 'reduce((acc, curr) => , initial)' },
  { label: 'forEach()', kind: 'method', insertText: 'forEach((item) => )' },
  { label: 'includes()', kind: 'method', insertText: 'includes()' },
  { label: 'slice()', kind: 'method', insertText: 'slice()' },
  { label: 'split()', kind: 'method', insertText: "split('')" },
  { label: 'join()', kind: 'method', insertText: "join('')" },
  { label: 'trim()', kind: 'method', insertText: 'trim()' },
  { label: 'push()', kind: 'method', insertText: 'push()' },
  { label: 'length', kind: 'method' }
];

export const CodeSandboxEditor: React.FC<CodeSandboxEditorProps> = ({
  challenge,
  value,
  onChange,
  onTestOutcome,
  fileName = 'solution.ts',
  filePath,
  storageKey,
  headerBadge = 'Thực Hành & Chấm Điểm Sandbox',
  runVisibleButtonText = '▶️ Chạy Thử (Visible Cases)',
  submitButtonText = '🚀 Nộp Bài (Kèm Hidden Cases)',
  onPassed,
  className
}) => {
  const [internalCode, setInternalCode] = useState<string>(() => {
    if (value !== undefined) return value;
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return challenge.starterCode;
  });

  const code = value !== undefined ? value : internalCode;

  const [isRunning, setIsRunning] = useState(false);
  const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null);
  const [activeTab, setActiveTab] = useState<'tests' | 'console'>('tests');

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [suggestionCoords, setSuggestionCoords] = useState<{ top: number; left: number } | null>(null);
  const [cursorWordRange, setCursorWordRange] = useState<{ word: string; start: number; end: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (value === undefined && storageKey) {
      const saved = localStorage.getItem(storageKey);
      setInternalCode(saved || challenge.starterCode);
    }
    setTestOutcome(null);
    setSuggestions([]);
  }, [challenge.title, storageKey]);

  // Extract dynamic variable/function names from user code for IntelliSense
  const dynamicWords = useMemo(() => {
    const matches = code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
    const unique = Array.from(new Set(matches));
    return unique
      .filter((w) => w.length > 2)
      .map((w) => ({ label: w, kind: 'variable' as const, detail: 'Identifier' }));
  }, [code]);

  const updateSuggestions = (text: string, pos: number) => {
    const leftText = text.slice(0, pos);
    const match = leftText.match(/[@a-zA-Z0-9_$]+$/);

    if (!match) {
      setSuggestions([]);
      setCursorWordRange(null);
      return;
    }

    const currentWord = match[0];
    const range = { word: currentWord, start: pos - currentWord.length, end: pos };
    setCursorWordRange(range);

    const query = currentWord.toLowerCase();
    const all = [...BASE_SUGGESTIONS, ...dynamicWords];
    const filtered = all.filter((item) => item.label.toLowerCase().includes(query) && item.label.toLowerCase() !== query);

    if (filtered.length > 0 && textareaRef.current) {
      setSuggestions(filtered.slice(0, 8));
      setActiveSuggestionIndex(0);

      const lines = leftText.split('\n');
      const currentLineIdx = lines.length - 1;
      const currentLineChars = lines[currentLineIdx].length;

      const lineHeight = 21;
      const charWidth = 8.5;
      const top = Math.min((currentLineIdx + 1) * lineHeight + 8, 300);
      const left = Math.min(currentLineChars * charWidth + 50, 450);

      setSuggestionCoords({ top, left });
    } else {
      setSuggestions([]);
    }
  };

  const applySuggestion = (item: SuggestionItem) => {
    if (!cursorWordRange || !textareaRef.current) return;
    const textToInsert = item.insertText || item.label;
    const newCode = code.slice(0, cursorWordRange.start) + textToInsert + code.slice(cursorWordRange.end);

    setInternalCode(newCode);
    if (onChange) onChange(newCode);
    if (storageKey) localStorage.setItem(storageKey, newCode);

    setSuggestions([]);

    const newPos = cursorWordRange.start + textToInsert.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setInternalCode(newCode);
    if (onChange) onChange(newCode);
    if (storageKey) localStorage.setItem(storageKey, newCode);
    updateSuggestions(newCode, e.target.selectionStart || 0);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = target.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        applySuggestion(suggestions[activeSuggestionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setInternalCode(newCode);
      if (onChange) onChange(newCode);
      if (storageKey) localStorage.setItem(storageKey, newCode);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
      return;
    }

    if (e.key === 'Enter') {
      const start = e.currentTarget.selectionStart;
      const lines = code.substring(0, start).split('\n');
      const currentLine = lines[lines.length - 1];
      const matchIndent = currentLine.match(/^\s*/);
      const indent = matchIndent ? matchIndent[0] : '';
      const extraIndent = currentLine.trim().endsWith('{') ? '  ' : '';

      e.preventDefault();
      const insert = '\n' + indent + extraIndent;
      const newCode = code.substring(0, start) + insert + code.substring(start);
      setInternalCode(newCode);
      if (onChange) onChange(newCode);
      if (storageKey) localStorage.setItem(storageKey, newCode);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + insert.length;
        }
      }, 0);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleRunTests(false);
    }
  };

  const handleReset = () => {
    setInternalCode(challenge.starterCode);
    if (onChange) onChange(challenge.starterCode);
    if (storageKey) localStorage.setItem(storageKey, challenge.starterCode);
    setTestOutcome(null);
    setSuggestions([]);
  };

  const handleRunTests = async (includeHidden: boolean) => {
    setIsRunning(true);
    setSuggestions([]);
    try {
      const outcome = await CodeEvaluator.runTests(
        code,
        challenge.testCases,
        includeHidden
      );
      setTestOutcome(outcome);
      if (onTestOutcome) onTestOutcome(outcome);

      if (outcome.passed && includeHidden && onPassed) {
        onPassed();
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errOutcome: TestOutcome = {
        passed: false,
        total: challenge.testCases.length,
        passedCount: 0,
        syntaxError: errorMsg,
        results: []
      };
      setTestOutcome(errOutcome);
      if (onTestOutcome) onTestOutcome(errOutcome);
    } finally {
      setIsRunning(false);
    }
  };

  const linesCount = Math.max(code.split('\n').length, 14);
  const lineNumbers = Array.from({ length: linesCount }, (_, i) => i + 1);
  const highlightedCodeHtml = highlightSyntax(code, 'typescript') + '\n';

  // Aggregate all console logs from test outcomes
  const allConsoleLogs = useMemo(() => {
    if (!testOutcome) return [];
    return testOutcome.consoleLogs || [];
  }, [testOutcome]);

  const breadcrumb = filePath || `src > solutions > ${fileName}`;

  return (
    <div className={`sandbox-card ${className || ''}`}>
      <div className="sandbox-header">
        <div className="sandbox-header-badge">{headerBadge}</div>
        <h3 className="sandbox-title">{challenge.title}</h3>
        <FormattedText content={challenge.description} className="sandbox-desc" />
      </div>

      {/* VS Code Interactive Editor */}
      <div className="vs-code-editor sandbox-ide">
        <div className="vs-editor-titlebar">
          <div className="vs-window-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <div className="vs-editor-tabs">
            <div className="vs-tab active">
              <span className="vs-tab-badge">TS</span>
              <span className="vs-tab-title">{fileName}</span>
            </div>
          </div>
          <div className="vs-editor-actions">
            <span className="vs-breadcrumb-text">{breadcrumb}</span>
            <span className="vs-save-badge">● Tự động lưu</span>
          </div>
        </div>

        <div className="sandbox-editor-wrapper">
          <div className="sandbox-gutter" ref={gutterRef}>
            {lineNumbers.map((num) => (
              <div key={num} className="gutter-line-num">
                {num}
              </div>
            ))}
          </div>

          <div className="sandbox-code-area">
            {/* Real-time Syntax Highlighting Layer */}
            <pre
              ref={highlightRef}
              className="sandbox-highlight-layer"
              dangerouslySetInnerHTML={{ __html: highlightedCodeHtml }}
            />

            {/* Interactive Transparent Textarea Input */}
            <textarea
              ref={textareaRef}
              className="sandbox-code-input"
              value={code}
              onChange={handleCodeChange}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck="false"
              placeholder="// Viết code TypeScript tại đây..."
            />

            {/* IntelliSense Autocomplete Popup */}
            {suggestions.length > 0 && suggestionCoords && (
              <div
                className="vs-intellisense-menu"
                style={{ top: `${suggestionCoords.top}px`, left: `${suggestionCoords.left}px` }}
              >
                <div className="vs-intellisense-header">GỢI Ý TYPESCRIPT & NESTJS</div>
                <div className="vs-intellisense-list">
                  {suggestions.map((item, idx) => (
                    <div
                      key={`${item.label}-${idx}`}
                      className={`vs-intellisense-item ${idx === activeSuggestionIndex ? 'active' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(item);
                      }}
                      onMouseEnter={() => setActiveSuggestionIndex(idx)}
                    >
                      <span className={`vs-kind-icon kind-${item.kind}`}>
                        {item.kind === 'decorator' ? '@' :
                         item.kind === 'keyword' ? 'kw' :
                         item.kind === 'type' ? 'T' :
                         item.kind === 'snippet' ? '⎘' :
                         item.kind === 'method' ? 'ƒ' : 'v'}
                      </span>
                      <span className="vs-item-label">{item.label}</span>
                      {item.detail && <span className="vs-item-detail">{item.detail}</span>}
                    </div>
                  ))}
                </div>
                <div className="vs-intellisense-footer">Tab hoặc Enter để chọn • Esc để đóng</div>
              </div>
            )}
          </div>
        </div>

        <div className="sandbox-editor-footer">
          <div className="sandbox-footer-left">
            <span>TypeScript Sandbox (IntelliSense ON)</span>
            <span>•</span>
            <span>Tab: 2 spaces</span>
            <span>•</span>
            <span className="shortcut-hint">Ctrl + Enter: Chạy thử</span>
          </div>
          <div className="sandbox-footer-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleReset} title="Khôi phục code ban đầu">
              ↺ Khôi phục
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={isRunning}
              onClick={() => handleRunTests(false)}
            >
              {isRunning ? '⏳ Đang chạy...' : runVisibleButtonText}
            </button>
            <button
              className="btn btn-success btn-sm"
              disabled={isRunning}
              onClick={() => handleRunTests(true)}
            >
              {isRunning ? '⏳ Đang kiểm tra...' : submitButtonText}
            </button>
          </div>
        </div>
      </div>

      {/* Terminal / Test Output Panel */}
      {testOutcome && (
        <div className="test-results-panel">
          <div className="terminal-header">
            <div className="terminal-tabs">
              <button
                type="button"
                className={`terminal-tab ${activeTab === 'tests' ? 'active' : ''}`}
                onClick={() => setActiveTab('tests')}
              >
                TEST CASES ({testOutcome.passedCount}/{testOutcome.total})
              </button>
              <button
                type="button"
                className={`terminal-tab ${activeTab === 'console' ? 'active' : ''}`}
                onClick={() => setActiveTab('console')}
              >
                CONSOLE LOGS ({allConsoleLogs.length})
              </button>
            </div>
            <div className="terminal-status-info">
              {testOutcome.passed ? (
                <span className="terminal-badge pass">PASS ({testOutcome.passedCount}/{testOutcome.total})</span>
              ) : (
                <span className="terminal-badge fail">FAIL ({testOutcome.passedCount}/{testOutcome.total})</span>
              )}
            </div>
          </div>

          {activeTab === 'console' ? (
            <div className="terminal-body console-view">
              {allConsoleLogs.length > 0 ? (
                <div className="console-logs-list">
                  {allConsoleLogs.map((log, lIdx) => (
                    <div key={lIdx} className="console-log-row">
                      <span className="console-log-prefix">&gt;</span>
                      <code className="console-log-text">{log}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="console-empty-hint">Không có log nào được ghi lại từ `console.log()` trong code.</div>
              )}
            </div>
          ) : testOutcome.syntaxError ? (
            <div className="terminal-body">
              <div className="test-summary-badge fail">❌ Lỗi Cú Pháp / Thực Thi Runtime</div>
              <div className="test-case-error">
                {testOutcome.syntaxError}
              </div>
            </div>
          ) : (
            <div className="terminal-body">
              <div className="test-cases-list">
                {testOutcome.results.map((res, idx) => (
                  <div key={idx} className={`test-case-row ${res.passed ? 'pass-row' : 'fail-row'}`}>
                    <div className="test-case-header">
                      <span className="test-case-name">
                        <span className="case-index-pill">Case {idx + 1}</span>
                        {res.hidden ? ' 🔒 [Hidden Test] ' : ' (Visible): '}
                        {res.name}
                      </span>
                      <span className={`test-case-status ${res.passed ? 'pass' : 'fail'}`}>
                        {res.passed ? 'PASS ✅' : 'FAIL ❌'}
                      </span>
                    </div>
                    {res.error && (
                      <div className="test-case-error">
                        Chi tiết: {res.error}
                      </div>
                    )}
                    {!res.hidden && !res.passed && (
                      <div className="test-case-diff">
                        <div><strong>Input:</strong> <code>{res.input}</code></div>
                        <div><strong>Expected:</strong> <code>{res.expected}</code></div>
                        <div><strong>Actual:</strong> <code>{res.actual || 'undefined / no return'}</code></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {testOutcome.passed && (
                <div className="test-pass-banner">
                  🎉 Xuất sắc! Tất cả {testOutcome.total} test cases (kèm hidden test) đã vượt qua thành công!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
