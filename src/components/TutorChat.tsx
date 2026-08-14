import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/curriculum.ts';

const MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', hint: 'Nhanh · ổn định' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Nhanh · cân bằng' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', hint: 'Sâu · phân tích kỹ' },
] as const;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TutorChatProps {
  lesson: Lesson;
  isLessonCleared: boolean;
  onMarkCleared: () => void;
}

export const TutorChat: React.FC<TutorChatProps> = ({
  lesson,
  isLessonCleared,
  onMarkCleared
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Em là tutor của bài “${lesson.title}”. ĐẠI CA đang vướng đoạn nào thì hỏi thẳng đoạn đó — em sẽ giải thích theo đúng nội dung bài, code mẫu và mental model cần nắm.`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (questionOverride?: string) => {
    const question = (questionOverride ?? input).trim();
    if (!question || isLoading) return;

    const nextMessages = [...messages, { role: 'user' as const, content: question }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: {
            title: lesson.title,
            tag: lesson.tag,
            theory: lesson.theory,
            realCodeSnippet: lesson.realCodeSnippet
          },
          messages: nextMessages,
          model: selectedModel
        })
      });
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
      setMessages((current) => [...current, { role: 'assistant', content: payload.reply || '' }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Tutor đang bận, thử lại sau.');
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
    <section className="tutor-card" aria-label="Tutor AI theo bài học">
      <div className="tutor-header">
        <div className="tutor-heading">
          <div className="tutor-heading-row">
            <div className="tutor-agent-icon">✦</div>
            <div>
          <div className="tutor-kicker">✦ GEMINI LEARNING AGENT</div>
          <h2>Hỏi tutor về bài này</h2>
          <p>Hỏi đúng chỗ ĐẠI CA chưa clear. Tutor chỉ dùng kiến thức của bài hiện tại để giải thích.</p>
            </div>
          </div>
        </div>
        <div className="tutor-header-tools">
          <span className="tutor-status"><span className="status-dot" /> Sẵn sàng</span>
        </div>
      </div>

      <div className="tutor-messages">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`tutor-message ${message.role}`}>
            <span className="tutor-avatar">{message.role === 'assistant' ? '✦' : 'ĐC'}</span>
            <div className="tutor-bubble">{message.content}</div>
          </div>
        ))}
        {isLoading && <div className="tutor-typing">Tutor đang suy nghĩ<span> ···</span></div>}
        <div ref={messagesEndRef} />
      </div>

      {error && <div className="tutor-error">⚠️ {error}</div>}

      <form className="tutor-form" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ví dụ: Vì sao Service Singleton có thể làm rò dữ liệu giữa 2 request?"
          rows={2}
          disabled={isLoading}
        />
        <div className="tutor-composer-footer">
          <div className="tutor-composer-left">
            <button className="composer-icon-button" type="button" aria-label="Thêm tài liệu" title="Thêm tài liệu">＋</button>
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
            <span className="composer-shortcut">Enter gửi · Shift+Enter xuống dòng</span>
            <button className="composer-icon-button composer-mic" type="button" aria-label="Ghi âm" title="Ghi âm">♩</button>
            <button className="tutor-send-button" type="submit" disabled={isLoading || !input.trim()} aria-label="Gửi câu hỏi">
              {isLoading ? '…' : '➜'}
            </button>
          </div>
        </div>
      </form>

      <div className={`tutor-clear ${isLessonCleared ? 'cleared' : ''}`}>
        <div>
          <strong>{isLessonCleared ? 'Đã clear bài này ✓' : 'Chưa clear? Hỏi tiếp tutor nhé.'}</strong>
          <span>{isLessonCleared ? 'ĐẠI CA có thể chuyển sang phần trắc nghiệm.' : 'Khi đã nắm được, xác nhận để mở khóa trắc nghiệm.'}</span>
        </div>
        {!isLessonCleared && (
          <button className="btn btn-success" type="button" onClick={onMarkCleared}>
            Em đã clear bài này ✓
          </button>
        )}
      </div>
    </section>
  );
};
