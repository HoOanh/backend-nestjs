import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import './TutorChat.css';
import type { Lesson } from '../../data/curriculum.ts';
import { escapeHtml, highlightSyntax } from '../common/CodeViewer.tsx';
import { useTutorChatContext, MODEL_OPTIONS } from '../../context/TutorChatContext.tsx';

interface TutorChatProps {
  lesson: Lesson;
  mode?: 'docked' | 'floating' | 'inline';
  onSwitchMode?: (newMode: 'docked' | 'floating') => void;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function healStreamingMarkdown(text: string): string {
  let healed = text;
  const codeBlockCount = (healed.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    healed += '\n```\n';
  }
  const boldCount = (healed.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    healed += '**';
  }
  return healed;
}

export function renderChatCodeBlockHtml(code: string, rawLang: string = 'typescript'): string {
  const isDiagram = rawLang === 'diagram' || rawLang === 'ascii' || code.includes('──') || code.includes('┌');
  const normalizedLang = (rawLang || '').toLowerCase().trim();
  const displayLang = isDiagram
    ? 'diagram'
    : (normalizedLang || 'code');

  const cleanCode = code.replace(/^\n+|\n+$/g, '');
  const highlighted = isDiagram ? escapeHtml(cleanCode) : highlightSyntax(cleanCode, normalizedLang || 'typescript');

  return `
<div class="chat-code-block" data-code="${escapeHtml(cleanCode)}">
  <div class="chat-code-header">
    <span class="chat-code-lang">${escapeHtml(displayLang)}</span>
    <button class="chat-copy-code-btn" type="button" title="Sao chép toàn bộ mã nguồn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Sao chép</span>
    </button>
  </div>
  <div class="chat-code-body">
    <pre class="chat-code-pre"><code>${highlighted}</code></pre>
  </div>
</div>
`.trim();
}

export function formatChatMarkdown(text: string): string {
  if (!text) return '';

  let cleaned = text;
  if (cleaned.includes('điều phối')) {
    cleaned = cleaned
      .replace(/^>\s*💡\s*\*?Hệ thống đã tự động điều phối[^\n]*\n*/gm, '')
      .replace(/💡\s*\*?Hệ thống đã tự động điều phối[^\n]*\n*/g, '')
      .trim();
  }

  const codeBlocks: string[] = [];
  let processed = healStreamingMarkdown(cleaned);

  // 1. Extract fenced code blocks first and format as modern sleek Chat Code Blocks
  processed = processed.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const rawLang = lang || (code.includes('──') || code.includes('┌') ? 'diagram' : 'typescript');
    const placeholder = `__CHAT_CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(renderChatCodeBlockHtml(code, rawLang));
    return `\n${placeholder}\n`;
  });

  // 2. Horizontal rules
  processed = processed.replace(/^ {0,3}(?:---|___|\*\*\*)\s*$/gm, '<hr class="tutor-hr" />');

  // 3. Headings
  processed = processed
    .replace(/^#### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^## (.*$)/gm, '<h4>$1</h4>')
    .replace(/^# (.*$)/gm, '<h3>$1</h3>');

  // 4. Blockquotes
  processed = processed.replace(/^>\s*(.+)$/gm, '<blockquote class="tutor-quote">$1</blockquote>');

  // 5. Bold & Italic
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 6. Inline code
  processed = processed.replace(/`([^`\n]+)`/g, (_, code) => {
    return `<code class="tutor-inline-code">${escapeHtml(code)}</code>`;
  });

  // 7. Lists (nested lists, unordered lists, ordered lists)
  processed = processed.replace(/^( {2,}|\t+)[-*•]\s+(.*$)/gm, '<li class="md-sub-li" style="margin-left: 20px; list-style-type: circle;">$2</li>');
  processed = processed.replace(/^[-*•]\s+(.*$)/gm, '<li class="md-ul-li" style="list-style-type: disc; margin-left: 18px;">$1</li>');
  processed = processed.replace(/^(\d+)\.\s+(.*$)/gm, '<li class="md-ol-li" style="list-style-type: decimal; margin-left: 20px;">$2</li>');
  processed = processed.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>');

  // 8. Paragraphs
  const blocks = processed.split(/\n{2,}/);
  processed = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h3>') ||
        trimmed.startsWith('<h4>') ||
        trimmed.startsWith('<h5>') ||
        trimmed.startsWith('<ul>') ||
        trimmed.startsWith('<ol>') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('__CHAT_CODE_BLOCK_')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('');

  // 9. Restore code blocks
  codeBlocks.forEach((blockHtml, index) => {
    processed = processed.replace(`__CHAT_CODE_BLOCK_${index}__`, blockHtml);
  });

  return processed;
}

function formatSessionTime(timestamp: number | string): string {
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Hôm nay ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Hôm qua ${timeStr}`;

  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${timeStr}`;
}

export const TutorChat: React.FC<TutorChatProps> = ({
  lesson,
  mode = 'inline',
  onSwitchMode,
  onClose,
  isExpanded: externalIsExpanded,
  onToggleExpand
}) => {
  const {
    currentSession,
    sessions,
    messages,
    input,
    setInput,
    selectedImage,
    setSelectedImage,
    selectedModel,
    setSelectedModel,
    isLoading,
    error,
    setError,
    isHistoryOpen,
    toggleHistory,
    contextWindowCount,
    sendMessage,
    createNewSession,
    switchSession,
    deleteSession,
    setCurrentLesson
  } = useTutorChatContext();

  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalExpanded;

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Close model menu when clicking outside
  useEffect(() => {
    if (!isModelMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelMenuOpen]);

  // Auto-resize textarea to fit text smoothly
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 160);
    textarea.style.height = `${newHeight}px`;
  }, [input]);

  const toggleSpeechRecognition = () => {
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechConstructor) {
      setError('Trình duyệt hiện tại chưa hỗ trợ Web Speech API. Hãy dùng Chrome hoặc Edge để dùng tính năng giọng nói.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechConstructor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'vi-VN';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      setIsListening(true);
      recognitionRef.current = recognition;
    } catch {
      setIsListening(false);
    }
  };

  // Sync lesson to context
  useEffect(() => {
    setCurrentLesson(lesson);
  }, [lesson, setCurrentLesson]);

  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  useEffect(() => {
    if (messages.length > 1 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onToggleExpand && externalIsExpanded) {
          onToggleExpand();
        } else {
          setInternalExpanded(false);
        }
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded, onToggleExpand, externalIsExpanded]);

  const handleChatContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const copyBtn = target.closest<HTMLElement>('.chat-copy-code-btn, .vs-copy-btn');
    if (copyBtn) {
      const codeBlock = copyBtn.closest<HTMLElement>('.chat-code-block, .vs-code-editor');
      if (codeBlock) {
        let textToCopy = codeBlock.getAttribute('data-code');
        if (!textToCopy) {
          const lineTexts = codeBlock.querySelectorAll('.line-text');
          if (lineTexts.length > 0) {
            textToCopy = Array.from(lineTexts)
              .map((el) => (el.textContent === '\u00a0' ? '' : el.textContent || ''))
              .join('\n');
          } else {
            const codeEl = codeBlock.querySelector('code, pre');
            textToCopy = codeEl?.textContent || '';
          }
        }
        void navigator.clipboard.writeText(textToCopy);
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color: #10b981; font-weight: 600;">Đã chép</span>
        `;
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = originalHtml;
          copyBtn.classList.remove('copied');
        }, 2000);
      }
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chỉ chọn tệp hình ảnh (PNG, JPG, WEBP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước ảnh tối đa 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setSelectedImage({ file, base64, mimeType: file.type });
      setError('');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setSelectedImage({ file, base64, mimeType: file.type });
            setError('');
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    void sendMessage();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
      }
      void sendMessage();
    }
  };

  const currentModelOption = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];
  const currentModelShortLabel = currentModelOption?.shortLabel || currentModelOption?.label.replace('Gemini ', '') || '3.8 Flash';
  const hasContent = Boolean(input.trim() || selectedImage);

  return (
    <>
      {isExpanded && mode === 'inline' && (
        <div
          className="tutor-modal-backdrop"
          onClick={toggleExpand}
          aria-hidden="true"
        />
      )}
      <section className={`tutor-card tutor-mode-${mode} ${isExpanded ? 'is-expanded' : ''}`} aria-label="Arc AI Co-Pilot">
        {/* Sleek Compact Header */}
        <div className="tutor-header">
          <div className="tutor-header-brand">
            <div className="tutor-logo-box">
              <img src="/logo.png" alt="Arc Irobot" className="tutor-logo-img" />
            </div>
            <div className="tutor-brand-info">
              <div className="tutor-title-row">
                <h4 className="tutor-main-heading">Arc AI Co-Pilot</h4>
                <span className="tutor-live-dot" title="Sẵn sàng" />
              </div>
              <span className="tutor-sub-heading" title={currentSession?.title || lesson.title}>
                {currentSession?.title || lesson.title}
              </span>
            </div>
          </div>

          <div className="tutor-header-actions">
            {/* New Session Button - Sleek Icon */}
            <button
              type="button"
              className="tutor-btn-icon"
              onClick={() => void createNewSession()}
              title="Bắt đầu đoạn chat mới"
              aria-label="Đoạn chat mới"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* History Drawer Toggle Button - Sleek Icon */}
            <button
              type="button"
              className={`tutor-btn-icon ${isHistoryOpen ? 'active' : ''}`}
              onClick={toggleHistory}
              title={`Lịch sử trò chuyện (${sessions.length} phiên)`}
              aria-label="Lịch sử trò chuyện"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>

            {onSwitchMode && mode === 'docked' && (
              <button
                type="button"
                className="tutor-btn-icon"
                onClick={() => onSwitchMode('floating')}
                title="Chuyển sang cửa sổ nổi"
                aria-label="Cửa sổ nổi"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </button>
            )}

            {onSwitchMode && mode === 'floating' && (
              <button
                type="button"
                className="tutor-btn-icon"
                onClick={() => onSwitchMode('docked')}
                title="Ghim cố định bên phải (Dock)"
                aria-label="Ghim dock"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </button>
            )}

            {mode !== 'inline' && (
              <button
                type="button"
                className="tutor-btn-icon"
                onClick={toggleExpand}
                title={isExpanded ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}
                aria-label={isExpanded ? 'Thu nhỏ' : 'Toàn màn hình'}
              >
                {isExpanded ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                  </svg>
                )}
              </button>
            )}

            {onClose && (
              <button
                type="button"
                className="tutor-btn-icon btn-close"
                onClick={onClose}
                title="Đóng chat"
                aria-label="Đóng chat"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modern Slide-in Drawer for Conversation History */}
        {isHistoryOpen && (
          <>
            <div
              className="tutor-history-backdrop"
              onClick={toggleHistory}
              aria-hidden="true"
            />
            <aside className="tutor-history-drawer" aria-label="Lịch sử hội thoại">
              <div className="history-drawer-header">
                <div className="drawer-title-box">
                  <div className="drawer-title-row">
                    <svg className="drawer-title-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <h5>Lịch sử trò chuyện</h5>
                  </div>
                  <span className="drawer-lesson-badge" title={lesson.title}>{lesson.title}</span>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={toggleHistory}
                  title="Đóng lịch sử"
                  aria-label="Đóng"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="history-drawer-actions">
                <button
                  type="button"
                  className="btn-new-chat-drawer"
                  onClick={() => void createNewSession()}
                  title="Tạo phiên hội thoại mới cho bài học này"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Bắt đầu đoạn chat mới</span>
                </button>
              </div>

              <div className="history-drawer-list">
                {sessions.length === 0 ? (
                  <div className="history-drawer-empty">
                    <div className="drawer-empty-icon">💬</div>
                    <h6>Chưa có phiên chat nào</h6>
                    <p>Mọi đoạn trao đổi với Arc AI Co-Pilot sẽ được lưu trữ tự động tại đây.</p>
                  </div>
                ) : (
                  sessions.map((ses) => {
                    const isActive = currentSession?.id === ses.id;
                    return (
                      <div
                        key={ses.id}
                        className={`history-session-card ${isActive ? 'is-active' : ''}`}
                        onClick={() => void switchSession(ses.id)}
                        role="button"
                        tabIndex={0}
                        title={`Mở cuộc trò chuyện: ${ses.title}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void switchSession(ses.id);
                          }
                        }}
                      >
                        <div className="session-card-icon">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        </div>
                        <div className="session-card-main">
                          <div className="session-card-title-row">
                            <span className="session-card-title">{ses.title}</span>
                            {isActive && <span className="session-active-pill">Đang mở</span>}
                          </div>
                          <div className="session-card-meta-row">
                            <span className="session-card-time">{formatSessionTime(ses.updatedAt)}</span>
                            <span className="session-card-count">{ses.messageCount} tin</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="session-card-del-btn"
                          title="Xóa phiên này"
                          aria-label="Xóa phiên này"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('ĐẠI CA có chắc muốn xóa phiên chat này không?')) {
                              void deleteSession(ses.id);
                            }
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </>
        )}

        <div className="tutor-messages" ref={messagesContainerRef} onClick={handleChatContainerClick}>
          {messages.map((message, index) => (
            <div key={message.id || `${message.role}-${index}`} className={`tutor-message ${message.role}`}>
              <div className="tutor-avatar">
                {message.role === 'assistant' ? (
                  <img src="/logo.png" alt="Arc" className="tutor-avatar-img" />
                ) : (
                  'ĐC'
                )}
              </div>
              <div className="tutor-bubble-wrap">
                {message.image?.data && (
                  <div className="tutor-message-image-box">
                    <img
                      src={message.image.data}
                      alt={message.image.fileName || 'Ảnh đính kèm'}
                      className="tutor-message-image"
                    />
                  </div>
                )}
                {message.content && (
                  <div
                    className="tutor-bubble"
                    dangerouslySetInnerHTML={{ __html: formatChatMarkdown(message.content) }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Quick prompt chips khi mới mở hội thoại */}
          {messages.length === 1 && !isLoading && (
            <div className="tutor-quick-prompts">
              <span className="quick-prompt-label">Gợi ý câu hỏi nhanh:</span>
              <div className="quick-prompt-chips">
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => void sendMessage('ĐẠI CA tóm tắt giúp em 3 luận điểm cốt lõi nhất của bài này và ứng dụng thực tế trong NestJS.')}
                >
                  📝 Tóm tắt 3 luận điểm cốt lõi
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => void sendMessage('Đoạn sơ đồ kiến trúc trong bài giải thích cơ chế gì? Vì sao lại thiết kế như vậy?')}
                >
                  🏗️ Giải thích sơ đồ kiến trúc
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => void sendMessage('Đoạn code mẫu trong bài có điểm gì đặc biệt cần lưu ý về hiệu năng và chống rò rỉ bộ nhớ?')}
                >
                  ⚙️ Phân tích code mẫu & hiệu năng
                </button>
              </div>
            </div>
          )}

          {isLoading && !messages[messages.length - 1]?.content && (
            <div className="tutor-typing">Arc AI đang suy luận và phân tích dữ liệu<span> ···</span></div>
          )}
        </div>

        {error && <div className="tutor-error">⚠️ {error}</div>}

        {/* Hidden File Input for Image Upload */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageSelect}
        />

        <form className="gemini-composer" onSubmit={handleSubmit}>
          {/* Image Preview Bar */}
          {selectedImage && (
            <div className="gemini-preview-wrapper">
              <div className="gemini-preview-chip">
                <img src={selectedImage.base64} alt="Preview" className="gemini-preview-thumb" />
                <div className="gemini-preview-meta">
                  <span className="gemini-preview-name">{selectedImage.file.name}</span>
                  <span className="gemini-preview-size">({(selectedImage.file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  type="button"
                  className="gemini-preview-remove"
                  onClick={() => setSelectedImage(null)}
                  title="Gỡ ảnh"
                  aria-label="Gỡ ảnh"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Unified Gemini Pill Bar */}
          <div className="gemini-pill-bar">
            {/* Left: '+' Attach Button */}
            <button
              className={`gemini-attach-btn ${selectedImage ? 'has-image' : ''}`}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Đính kèm hình ảnh (PNG, JPG, WEBP, GIF)"
              title="Đính kèm hình ảnh"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Middle: Textarea */}
            <textarea
              ref={textareaRef}
              className="gemini-pill-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              onPaste={handlePaste}
              placeholder={selectedImage ? "Nhập câu hỏi về hình ảnh này..." : "Hỏi Arc AI Co-Pilot..."}
              rows={1}
              disabled={isLoading}
            />

            {/* Right: Model Selector Pill + Mic / Send */}
            <div className="gemini-pill-actions">
              {/* Compact Model Selector Chip */}
              <div className="gemini-model-container" ref={modelMenuRef}>
                <button
                  className={`gemini-model-chip ${isModelMenuOpen ? 'active' : ''}`}
                  type="button"
                  onClick={() => setIsModelMenuOpen((open) => !open)}
                  disabled={isLoading}
                  aria-expanded={isModelMenuOpen}
                  aria-label="Chọn model Gemini"
                >
                  <span className="gemini-model-chip-text">{currentModelShortLabel}</span>
                  <svg className="gemini-chip-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Gemini Floating Model Menu Popover */}
                {isModelMenuOpen && (
                  <div className="gemini-model-popover" role="menu">
                    <div className="gemini-popover-list">
                      {MODEL_OPTIONS.map((model) => {
                        const isSelected = selectedModel === model.id;
                        const isAntigravity = model.id === 'antigravity';
                        return (
                          <React.Fragment key={model.id}>
                            {isAntigravity && <div className="gemini-popover-divider" />}
                            <button
                              type="button"
                              role="menuitem"
                              className={`gemini-popover-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setIsModelMenuOpen(false);
                              }}
                            >
                              <span className="gemini-popover-check">
                                {isSelected ? '✓' : ''}
                              </span>
                              <div className="gemini-popover-item-content">
                                <div className="gemini-popover-title-row">
                                  <span className="gemini-popover-label">{model.shortLabel || model.label}</span>
                                  {model.isNew && <span className="gemini-popover-badge-new">Mới</span>}
                                </div>
                                {model.desc && (
                                  <span className="gemini-popover-desc">{model.desc}</span>
                                )}
                              </div>
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mic Button (when idle) or Send Button (when text / image entered or loading) */}
              {hasContent || isLoading ? (
                <button
                  className="gemini-submit-btn"
                  type="submit"
                  disabled={isLoading || !hasContent}
                  aria-label="Gửi câu hỏi"
                  title="Gửi câu hỏi"
                >
                  {isLoading ? (
                    <span className="gemini-spinner" />
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              ) : (
                <button
                  className={`gemini-mic-btn ${isListening ? 'listening' : ''}`}
                  type="button"
                  onClick={toggleSpeechRecognition}
                  title={isListening ? "Đang nghe... Bấm để dừng" : "Nhập bằng giọng nói"}
                  aria-label="Nhập bằng giọng nói"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </>
  );
};
