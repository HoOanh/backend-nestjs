import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/curriculum.ts';
import { escapeHtml, renderEditorHtml } from './CodeViewer.tsx';

const MODEL_OPTIONS = [
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', hint: 'Mới nhất · Suy luận & Code đỉnh cao' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', hint: 'Tốc độ cao · Xử lý logic nhanh' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', hint: 'Cân bằng tốc độ & chất lượng' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', hint: 'Siêu nhẹ · Tiết kiệm quota' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', hint: 'Phân tích sâu · Đào tạo chuyên gia' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', hint: 'Hạn mức cao (500 RPD) · Cực nhanh' },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', hint: 'Thế hệ 3 · Cân bằng đa dụng' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Chuyên gia NestJS & Architecture' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Nhanh · Ổn định' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', hint: 'Nhanh · Tiết kiệm token' },
  { id: 'gemini-2-flash', label: 'Gemini 2 Flash', hint: 'Bản tiêu chuẩn 2.0' },
  { id: 'gemini-2-flash-lite', label: 'Gemini 2 Flash Lite', hint: 'Bản rút gọn 2.0' },
  { id: 'gemma-4-31b', label: 'Gemma 4 31B', hint: 'Open Model Google · 31B' },
  { id: 'gemma-4-26b', label: 'Gemma 4 26B', hint: 'Open Model Google · 26B' },
] as const;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: {
    data: string;
    mimeType: string;
    fileName?: string;
  };
}

interface TutorChatProps {
  lesson: Lesson;
  mode?: 'docked' | 'floating' | 'inline';
  onSwitchMode?: (newMode: 'docked' | 'floating') => void;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

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

export function formatChatMarkdown(text: string): string {
  if (!text) return '';

  const codeBlocks: string[] = [];
  let processed = healStreamingMarkdown(text);

  // 1. Extract fenced code blocks first and format as VS Code editor templates
  processed = processed.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const rawLang = lang || (code.includes('──') || code.includes('┌') ? 'diagram' : 'typescript');
    const placeholder = `__CHAT_CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(renderEditorHtml(code, rawLang));
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

export const TutorChat: React.FC<TutorChatProps> = ({
  lesson,
  mode = 'inline',
  onSwitchMode,
  onClose,
  isExpanded: externalIsExpanded,
  onToggleExpand
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Em là tutor của bài “${lesson.title}”. ĐẠI CA đang vướng đoạn nào hoặc có ảnh chụp sơ đồ / code lỗi nào thì gửi lên — em sẽ phân tích và giải thích tận tường theo đúng bản chất.`
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ file: File; base64: string; mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalExpanded;
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: `Em là tutor của bài “${lesson.title}”. ĐẠI CA đang vướng đoạn nào thì hỏi thẳng đoạn đó — em sẽ giải thích theo đúng nội dung bài, code mẫu và mental model cần nắm.`
      }
    ]);
    setInput('');
    setError('');
  }, [lesson.id, lesson.title]);

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
    const copyBtn = target.closest<HTMLElement>('.vs-copy-btn');
    if (copyBtn) {
      const editor = copyBtn.closest('.vs-code-editor');
      if (editor) {
        const lineTexts = editor.querySelectorAll('.line-text');
        const textToCopy = Array.from(lineTexts)
          .map((el) => (el.textContent === '\u00a0' ? '' : el.textContent || ''))
          .join('\n');
        void navigator.clipboard.writeText(textToCopy);
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Đã chép';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
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

  const sendMessage = async (questionOverride?: string) => {
    const rawQuestion = (questionOverride ?? input).trim();
    if ((!rawQuestion && !selectedImage) || isLoading) return;

    const question = rawQuestion || (selectedImage ? 'ĐẠI CA phân tích giúp em hình ảnh này nhé.' : '');
    const userMessage: ChatMessage = {
      role: 'user',
      content: question,
      image: selectedImage
        ? {
            data: selectedImage.base64,
            mimeType: selectedImage.mimeType,
            fileName: selectedImage.file.name
          }
        : undefined
    };

    const nextMessages: ChatMessage[] = [...messages, userMessage];
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setSelectedImage(null);
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json'
        },
        body: JSON.stringify({
          lesson: {
            title: lesson.title,
            tag: lesson.tag,
            theory: lesson.theory,
            realCodeSnippet: lesson.realCodeSnippet
          },
          messages: nextMessages,
          model: selectedModel,
          stream: true
        })
      });

      const contentType = response.headers.get('content-type') || '';

      if (response.ok && contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataContent = trimmed.replace(/^data:\s*/, '');
            if (dataContent === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataContent) as { text?: string; error?: string };
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulatedText += parsed.text;
                setMessages((current) => {
                  const updated = [...current];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: accumulatedText
                    };
                  }
                  return updated;
                });
              }
            } catch {
              // ignore partial lines
            }
          }
        }

        if (buffer.trim().startsWith('data:')) {
          const dataContent = buffer.trim().replace(/^data:\s*/, '');
          if (dataContent !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataContent) as { text?: string; error?: string };
              if (parsed.text) {
                accumulatedText += parsed.text;
                setMessages((current) => {
                  const updated = [...current];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: accumulatedText
                    };
                  }
                  return updated;
                });
              }
            } catch {}
          }
        }

        if (!accumulatedText.trim()) {
          throw new Error('Tutor không trả về nội dung.');
        }
      } else {
        const responseText = await response.text();
        let payload: { reply?: string; error?: string } = {};
        if (responseText.trim()) {
          try {
            payload = JSON.parse(responseText) as { reply?: string; error?: string };
          } catch {
            payload = { error: `API trả về dữ liệu không hợp lệ (${response.status}).` };
          }
        }
        if (!response.ok || !payload.reply) {
          throw new Error(payload.error || `Tutor không phản hồi (HTTP ${response.status}).`);
        }
        setMessages((current) => {
          const updated = [...current];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1] = { role: 'assistant', content: payload.reply || '' };
          } else {
            updated.push({ role: 'assistant', content: payload.reply || '' });
          }
          return updated;
        });
      }
    } catch (requestError) {
      const errorMsg = requestError instanceof Error ? requestError.message : 'Tutor đang bận, thử lại sau.';
      setError(errorMsg);
      setMessages((current) => {
        if (current.length > 0 && current[current.length - 1].role === 'assistant' && !current[current.length - 1].content) {
          return current.slice(0, -1);
        }
        return current;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

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
              <span className="tutor-sub-heading">Hỗ trợ bài học & phân tích kiến trúc</span>
            </div>
          </div>

          <div className="tutor-header-actions">
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

        <div className="tutor-messages" ref={messagesContainerRef} onClick={handleChatContainerClick}>
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`tutor-message ${message.role}`}>
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
            <div className="tutor-typing">Arc AI đang phân tích dữ liệu<span> ···</span></div>
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

        <form className="tutor-form" onSubmit={handleSubmit}>
          {/* Image Preview Bar */}
          {selectedImage && (
            <div className="tutor-image-preview-bar">
              <div className="preview-chip">
                <img src={selectedImage.base64} alt="Preview" className="preview-thumb" />
                <span className="preview-filename">{selectedImage.file.name}</span>
                <span className="preview-filesize">({(selectedImage.file.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  className="preview-clear-btn"
                  onClick={() => setSelectedImage(null)}
                  title="Gỡ ảnh"
                  aria-label="Gỡ ảnh"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            onPaste={handlePaste}
            placeholder={selectedImage ? "Nhập câu hỏi về hình ảnh này (hoặc bấm gửi để AI tự động phân tích)..." : "Hỏi kiến trúc, code mẫu hoặc dán / bấm ＋ để gửi ảnh sơ đồ..."}
            rows={2}
            disabled={isLoading}
          />

          <div className="tutor-composer-footer">
            <div className="tutor-composer-left">
              <button
                className={`composer-icon-button ${selectedImage ? 'has-file' : ''}`}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Đính kèm hình ảnh sơ đồ hoặc lỗi"
                title="Đính kèm hình ảnh (PNG, JPG, WEBP, GIF)"
              >
                ＋
              </button>

              <div className="model-menu-wrap">
                <button
                  className="model-trigger"
                  type="button"
                  onClick={() => setIsModelMenuOpen((open) => !open)}
                  disabled={isLoading}
                  aria-expanded={isModelMenuOpen}
                >
                  {MODEL_OPTIONS.find((model) => model.id === selectedModel)?.label || 'Chọn model'}
                  <span className="model-trigger-chevron">⌃</span>
                </button>
                {isModelMenuOpen && (
                  <div className="model-menu" role="menu">
                    <div className="model-menu-title">Model</div>
                    {MODEL_OPTIONS.map((model) => (
                      <button
                        className={`model-menu-item ${selectedModel === model.id ? 'selected' : ''}`}
                        key={model.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setSelectedModel(model.id);
                          setIsModelMenuOpen(false);
                        }}
                      >
                        <span>
                          <strong>{model.label}</strong>
                          <small>{model.hint}</small>
                        </span>
                        {selectedModel === model.id && <span className="model-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="tutor-composer-right">
              <span className="composer-shortcut">Enter gửi</span>
              <button className="composer-icon-button composer-mic" type="button" aria-label="Ghi âm" title="Ghi âm">♩</button>
              <button
                className="tutor-send-button"
                type="submit"
                disabled={isLoading || (!input.trim() && !selectedImage)}
                aria-label="Gửi câu hỏi"
              >
                {isLoading ? '…' : '➜'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </>
  );
};

