import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Lesson } from '../data/curriculum.ts';
import type { ChatSession, ChatMessage, ChatLog, SqlQueryResult } from '../types/chat.ts';
import { chatDbService } from '../services/db/chatDbService.ts';

export interface ModelOption {
  id: string;
  label: string;
  shortLabel: string;
  desc: string;
  isNew?: boolean;
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', shortLabel: '3.8 Flash', desc: 'Trợ giúp toàn diện', isNew: true },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', shortLabel: '3.7 Flash', desc: 'Suy luận chuyên sâu & hybrid code' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', shortLabel: '3.6 Flash', desc: 'Cân bằng tốc độ và chất lượng' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', shortLabel: '3.5 Flash', desc: 'Xử lý đa tác vụ nhanh chóng' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', shortLabel: '3.5 Flash-Lite', desc: 'Câu trả lời nhanh nhất' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', shortLabel: '3.1 Flash-Lite', desc: 'Phản hồi siêu tốc, tiết kiệm token' },
  { id: 'antigravity', label: 'Antigravity', shortLabel: 'Antigravity', desc: 'Tư duy mở rộng, giải quyết vấn đề phức tạp', isNew: true },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', shortLabel: '2.5 Flash-Lite', desc: 'Gọn nhẹ cơ bản, độ trễ thấp' },
  { id: 'gemma-4-31b', label: 'Gemma 4 31B', shortLabel: 'Gemma 4', desc: 'Mã nguồn mở thế hệ mới tối ưu' },
] as const;

export interface SelectedImageAttachment {
  file: File;
  base64: string;
  mimeType: string;
}

interface TutorChatContextType {
  userId: string;
  currentLesson: Lesson | null;
  setCurrentLesson: (lesson: Lesson) => void;
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  selectedImage: SelectedImageAttachment | null;
  setSelectedImage: (img: SelectedImageAttachment | null) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isLoading: boolean;
  error: string;
  setError: (err: string) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  toggleHistory: () => void;
  isSqlConsoleOpen: boolean;
  setIsSqlConsoleOpen: (open: boolean) => void;
  toggleSqlConsole: () => void;
  contextWindowCount: number;
  sendMessage: (questionOverride?: string) => Promise<void>;
  createNewSession: (customTitle?: string) => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  executeRawSql: (sql: string, params?: unknown[]) => Promise<SqlQueryResult>;
  getLogs: (limit?: number) => Promise<ChatLog[]>;
  reloadSessions: () => Promise<void>;
}

const TutorChatContext = createContext<TutorChatContextType | undefined>(undefined);

const MAX_CONTEXT_TURNS = 14;

export const TutorChatProvider: React.FC<{ children: React.ReactNode; userId?: string }> = ({
  children,
  userId: propUserId
}) => {
  const userId = propUserId || 'guest';
  const userIdRef = useRef<string>(userId);
  userIdRef.current = userId;

  const [currentLesson, setCurrentLessonState] = useState<Lesson | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<SelectedImageAttachment | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(MODEL_OPTIONS[0].id);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSqlConsoleOpen, setIsSqlConsoleOpen] = useState<boolean>(false);

  const activeAssistantMsgIdRef = useRef<string | null>(null);
  const currentLessonRef = useRef<Lesson | null>(null);
  currentLessonRef.current = currentLesson;

  const currentSessionRef = useRef<ChatSession | null>(null);
  currentSessionRef.current = currentSession;

  const loadSessionsForLesson = useCallback(async (lessonId: string, lessonTitle: string, targetUserId?: string) => {
    try {
      await chatDbService.init();
      const effectiveUserId = targetUserId ?? userIdRef.current;

      // 1. Phản hồi giao diện tức thì từ local cache (0ms perceived latency)
      const localSessions = chatDbService.getLocalSessions(lessonId);
      const savedActiveId = typeof window !== 'undefined'
        ? localStorage.getItem(`arc_active_session_${lessonId}`)
        : null;

      const preservedId = currentSessionRef.current?.lessonId === lessonId
        ? currentSessionRef.current.id
        : savedActiveId;

      const initialActive =
        (preservedId ? localSessions.find((s) => s.id === preservedId) : null) ||
        localSessions[0] ||
        null;

      if (localSessions.length > 0 && initialActive) {
        setSessions(localSessions);
        setCurrentSession(initialActive);
        currentSessionRef.current = initialActive;
        const cachedMsgs = chatDbService.getLocalMessages(initialActive.id);
        setMessages(cachedMsgs);
      }

      // 2. Đồng bộ ngầm với server (Stale-While-Revalidate)
      const allSessions = await chatDbService.getSessions(lessonId, effectiveUserId);
      setSessions(allSessions);

      let activeSes: ChatSession;
      if (allSessions.length > 0) {
        const activeTargetId = currentSessionRef.current?.lessonId === lessonId
          ? currentSessionRef.current.id
          : (savedActiveId || allSessions[0].id);

        activeSes = allSessions.find((s) => s.id === activeTargetId) || allSessions[0];
      } else {
        // Chưa có session nào cả ở server lẫn local -> Tạo session khởi tạo
        const greetingContent = `Em là tutor của bài “${lessonTitle}”. ĐẠI CA đang vướng đoạn nào hoặc có ảnh chụp sơ đồ / code lỗi nào thì gửi lên — em sẽ phân tích và giải thích tận tường theo đúng bản chất.`;
        const newSesId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'sess_' + Date.now();
        activeSes = await chatDbService.createSession(
          lessonId,
          `Hỏi đáp bài: ${lessonTitle}`,
          effectiveUserId,
          newSesId
        );
        const greetingMsg = await chatDbService.addMessage({
          sessionId: activeSes.id,
          lessonId,
          userId: effectiveUserId,
          role: 'assistant',
          content: greetingContent
        });
        activeSes.messageCount = 1;
        setSessions([activeSes]);
        setMessages([greetingMsg]);
      }

      setCurrentSession(activeSes);
      currentSessionRef.current = activeSes;
      if (typeof window !== 'undefined') {
        localStorage.setItem(`arc_active_session_${lessonId}`, activeSes.id);
      }

      // Lấy messages từ server nếu user vẫn đang xem session này
      const loadedMsgs = await chatDbService.getMessages(activeSes.id);
      if (currentSessionRef.current?.id === activeSes.id) {
        setMessages(loadedMsgs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được lịch sử chat từ server');
    }
  }, []);

  const setCurrentLesson = useCallback((lesson: Lesson) => {
    if (currentLessonRef.current?.id === lesson.id) return;
    currentLessonRef.current = lesson;
    setCurrentLessonState(lesson);
    setError('');
    void loadSessionsForLesson(lesson.id, lesson.title, userIdRef.current);
  }, [loadSessionsForLesson]);

  // When user switches or logs in/out, reload session for current lesson while preserving active conversation
  useEffect(() => {
    if (currentLessonRef.current) {
      void loadSessionsForLesson(currentLessonRef.current.id, currentLessonRef.current.title, userId);
    }
  }, [userId, loadSessionsForLesson]);

  const switchSession = useCallback(async (sessionId: string) => {
    try {
      let found = sessions.find((s) => s.id === sessionId);
      if (!found && currentLessonRef.current) {
        const localList = chatDbService.getLocalSessions(currentLessonRef.current.id);
        found = localList.find((s) => s.id === sessionId);
      }
      if (!found && currentLessonRef.current) {
        const reloaded = await chatDbService.getSessions(currentLessonRef.current.id, userIdRef.current);
        setSessions(reloaded);
        found = reloaded.find((s) => s.id === sessionId);
      }
      if (found) {
        currentSessionRef.current = found;
        if (typeof window !== 'undefined') {
          localStorage.setItem(`arc_active_session_${found.lessonId}`, found.id);
        }
        setCurrentSession(found);

        // Hiển thị ngay lập tức từ local cache (0ms)
        const cachedMsgs = chatDbService.getLocalMessages(sessionId);
        setMessages(cachedMsgs);
        setError('');
        setIsHistoryOpen(false);

        // Cập nhật messages từ server ngầm
        chatDbService.getMessages(sessionId).then((serverMsgs) => {
          if (currentSessionRef.current?.id === sessionId) {
            setMessages(serverMsgs);
          }
        }).catch((err) => {
          console.warn('Lỗi đồng bộ server messages khi switch session:', err);
        });

        void chatDbService.log('INFO', 'SESSION_SWITCH', `Chuyển sang session: ${sessionId}`, undefined, sessionId, found.lessonId);
      }
    } catch (err) {
      console.error('Failed to switch session:', err);
    }
  }, [sessions]);

  const createNewSession = useCallback(async (customTitle?: string) => {
    if (!currentLesson) return;
    const lessonId = currentLesson.id;
    const lessonTitle = currentLesson.title;
    const effectiveUserId = userIdRef.current;
    const sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'sess_' + Date.now();
    const now = new Date().toISOString();
    const title = customTitle || `Hội thoại mới (${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`;

    const greetingContent = `Em là tutor của bài “${lessonTitle}”. ĐẠI CA đang vướng đoạn nào hoặc cần mổ xẻ phần kiến trúc / code mẫu nào thì gửi vào đây nhé.`;
    const greetingMsgId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'msg_' + Date.now();

    const newSes: ChatSession = {
      id: sessionId,
      userId: effectiveUserId,
      lessonId,
      title,
      messageCount: 1,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now
    };

    const greetingMsg: ChatMessage = {
      id: greetingMsgId,
      sessionId,
      lessonId,
      userId: effectiveUserId,
      role: 'assistant',
      content: greetingContent,
      createdAt: now
    };

    // 1. Cập nhật state UI NGAY LẬP TỨC (0ms)
    currentSessionRef.current = newSes;
    if (typeof window !== 'undefined') {
      localStorage.setItem(`arc_active_session_${lessonId}`, sessionId);
    }
    setSessions((prev) => [newSes, ...prev.filter((s) => s.id !== sessionId)]);
    setCurrentSession(newSes);
    setMessages([greetingMsg]);
    setInput('');
    setSelectedImage(null);
    setError('');
    setIsHistoryOpen(false);

    // 2. Đồng bộ ngầm với chatDbService & server
    try {
      await chatDbService.createSession(lessonId, title, effectiveUserId, sessionId);
      await chatDbService.addMessage(greetingMsg);
      void chatDbService.authorizeTutorSession(sessionId, lessonId, title);
    } catch (err) {
      console.warn('Lỗi đồng bộ tạo session lên server, local cache vẫn an toàn:', err);
    }
  }, [currentLesson]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!currentLesson) return;
    try {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);

      if (currentSessionRef.current?.id === sessionId) {
        if (remaining.length > 0) {
          await switchSession(remaining[0].id);
        } else {
          await createNewSession();
        }
      }
      await chatDbService.deleteSession(sessionId);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [currentLesson, sessions, switchSession, createNewSession]);

  const reloadSessions = useCallback(async () => {
    if (currentLesson) {
      const list = await chatDbService.getSessions(currentLesson.id, userIdRef.current);
      setSessions(list);
    }
  }, [currentLesson]);

  // Context window calculation: how many past turns are currently preserved
  const contextWindowCount = Math.min(messages.length, MAX_CONTEXT_TURNS);

  const sendMessage = async (questionOverride?: string) => {
    const rawQuestion = (questionOverride ?? input).trim();
    if ((!rawQuestion && !selectedImage) || isLoading || !currentLesson || !currentSession) return;

    const question = rawQuestion || (selectedImage ? 'ĐẠI CA phân tích giúp em hình ảnh này nhé.' : '');
    const currentImg = selectedImage;

    setInput('');
    setSelectedImage(null);
    setError('');
    setIsLoading(true);

    const now = new Date().toISOString();
    const userMsgId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'msg_' + Date.now();
    const assistantMsgId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'msg_' + (Date.now() + 1);

    const userMsg: ChatMessage = {
      id: userMsgId,
      sessionId: currentSession.id,
      lessonId: currentLesson.id,
      userId: userIdRef.current,
      role: 'user',
      content: question,
      image: currentImg
        ? {
            data: currentImg.base64,
            mimeType: currentImg.mimeType,
            fileName: currentImg.file.name
          }
        : undefined,
      model: selectedModel,
      createdAt: now
    };

    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      sessionId: currentSession.id,
      lessonId: currentLesson.id,
      userId: userIdRef.current,
      role: 'assistant',
      content: '',
      model: selectedModel,
      createdAt: new Date(Date.now() + 10).toISOString()
    };

    activeAssistantMsgIdRef.current = assistantMsgId;

    // 1. Phản hồi giao diện & session state NGAY LẬP TỨC (0ms)
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== currentSession.id) return s;
        const updatedTitle =
          (s.messageCount || 0) <= 1 && question.trim()
            ? question.slice(0, 32)
            : s.title;
        return {
          ...s,
          title: updatedTitle,
          messageCount: (s.messageCount || 0) + 2,
          lastMessageAt: now,
          updatedAt: now
        };
      })
    );

    // Lưu ngầm userMsg và assistantMsg rỗng vào storage
    void chatDbService.addMessage(userMsg);
    void chatDbService.addMessage(assistantMsg);

    try {
      await chatDbService.authorizeTutorSession(
        currentSession.id,
        currentLesson.id,
        currentSession.title
      );

      // 2. Chuẩn bị context window gửi sang Gemini
      const recentWindow = nextMessages.filter((m) => m.content.trim() || m.image);
      const slicedWindow = recentWindow.slice(-MAX_CONTEXT_TURNS);

      // Gemini requires first content in conversation to be 'user'
      const firstUserIndex = slicedWindow.findIndex((m) => m.role === 'user');
      const sanitizedHistory = firstUserIndex >= 0 ? slicedWindow.slice(firstUserIndex) : slicedWindow;

      await chatDbService.log(
        'INFO',
        'PROMPT_SENT',
        `Gửi câu hỏi tới model ${selectedModel} (Context: ${sanitizedHistory.length} tin nhắn)`,
        {
          sessionId: currentSession.id,
          lessonId: currentLesson.id,
          model: selectedModel,
          contextTurns: sanitizedHistory.length,
          hasImage: Boolean(currentImg),
          questionLength: question.length
        },
        currentSession.id,
        currentLesson.id
      );

      // 4. Send API request
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: currentSession.id,
          lesson: {
            title: currentLesson.title,
            tag: currentLesson.tag,
            theory: currentLesson.theory,
            realCodeSnippet: currentLesson.realCodeSnippet
          },
          messages: sanitizedHistory.map((m) => ({
            role: m.role,
            content: m.content,
            image: m.image
              ? {
                  data: m.image.data,
                  mimeType: m.image.mimeType
                }
              : undefined
          })),
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
            if (dataContent === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataContent) as { text?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulatedText += parsed.text;
                setMessages((current) => {
                  const updated = [...current];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: accumulatedText
                    };
                  }
                  return updated;
                });
              }
            } catch (err) {
              if (err instanceof Error && err.message !== 'Unexpected end of JSON input') {
                // Ignore transient JSON chunk splitting
              }
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
                      ...updated[updated.length - 1],
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

        // Commit full assistant content to SQLite
        if (assistantMsg.id) {
          await chatDbService.updateMessageContent(assistantMsg.id, accumulatedText);
        }

        await chatDbService.log(
          'INFO',
          'STREAM_COMPLETE',
          `Nhận phản hồi stream thành công (${accumulatedText.length} ký tự)`,
          { responseLength: accumulatedText.length, model: selectedModel },
          currentSession.id,
          currentLesson.id
        );
      } else {
        // Non-stream fallback
        const responseText = await response.text();
        let payload: { reply?: string; error?: string } = {};
        if (responseText.trim()) {
          try {
            payload = JSON.parse(responseText) as { reply?: string; error?: string };
          } catch {
            payload = { error: 'Hệ thống đang bận, vui lòng thử lại.' };
          }
        }
        if (!response.ok || !payload.reply) {
          throw new Error(payload.error || 'Arc AI Co-Pilot không phản hồi, vui lòng thử lại.');
        }

        const reply = payload.reply;
        setMessages((current) => {
          const updated = [...current];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: reply
            };
          }
          return updated;
        });

        if (assistantMsg.id) {
          await chatDbService.updateMessageContent(assistantMsg.id, reply);
        }

        await chatDbService.log(
          'INFO',
          'RESPONSE_RECEIVED',
          `Nhận phản hồi HTTP (${reply.length} ký tự)`,
          { responseLength: reply.length, model: selectedModel },
          currentSession.id,
          currentLesson.id
        );
      }

      void reloadSessions();
    } catch (requestError) {
      const errorMsg = requestError instanceof Error ? requestError.message : 'Tutor đang bận, thử lại sau.';
      setError(errorMsg);

      await chatDbService.log(
        'ERROR',
        'STREAM_ERROR',
        `Lỗi trong phiên chat: ${errorMsg}`,
        { error: errorMsg },
        currentSession.id,
        currentLesson.id
      );

      // Clean up trailing empty assistant placeholder if failed
      setMessages((current) => {
        if (current.length > 0 && current[current.length - 1].role === 'assistant' && !current[current.length - 1].content) {
          return current.slice(0, -1);
        }
        return current;
      });
    } finally {
      setIsLoading(false);
      activeAssistantMsgIdRef.current = null;
    }
  };

  const toggleHistory = () => setIsHistoryOpen((prev) => !prev);
  const toggleSqlConsole = () => setIsSqlConsoleOpen((prev) => !prev);

  const executeRawSql = async (sql: string, params?: unknown[]): Promise<SqlQueryResult> => {
    return chatDbService.executeRawSql(sql, params);
  };

  const getLogs = async (limit = 100): Promise<ChatLog[]> => {
    return chatDbService.getLogs({
      sessionId: currentSession?.id,
      lessonId: currentLesson?.id,
      limit
    });
  };

  return (
    <TutorChatContext.Provider
      value={{
        userId,
        currentLesson,
        setCurrentLesson,
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
        setIsHistoryOpen,
        toggleHistory,
        isSqlConsoleOpen,
        setIsSqlConsoleOpen,
        toggleSqlConsole,
        contextWindowCount,
        sendMessage,
        createNewSession,
        switchSession,
        deleteSession,
        executeRawSql,
        getLogs,
        reloadSessions
      }}
    >
      {children}
    </TutorChatContext.Provider>
  );
};

export const useTutorChatContext = (): TutorChatContextType => {
  const context = useContext(TutorChatContext);
  if (!context) {
    throw new Error('useTutorChatContext must be used within a TutorChatProvider');
  }
  return context;
};
