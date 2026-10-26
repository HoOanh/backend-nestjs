import { apiFetch } from '../apiClient.ts';
import type { ChatSession, ChatMessage, ChatLog } from '../../types/chat.ts';

export function stripLegacyFallbackNote(text: string): string {
  if (!text || !text.includes('điều phối')) return text;
  return text
    .replace(/^>\s*💡\s*\*?Hệ thống đã tự động điều phối[^\n]*\n*/gm, '')
    .replace(/💡\s*\*?Hệ thống đã tự động điều phối[^\n]*\n*/g, '')
    .trim();
}

const LOCAL_SESSIONS_KEY = 'arc_local_chat_sessions';
const LOCAL_MESSAGES_KEY = 'arc_local_chat_messages';

let inMemorySessions: ChatSession[] | null = null;
let inMemoryMessages: ChatMessage[] | null = null;

function readLocalSessions(): ChatSession[] {
  if (inMemorySessions) return inMemorySessions;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    inMemorySessions = raw ? (JSON.parse(raw) as ChatSession[]) : [];
    return inMemorySessions;
  } catch {
    inMemorySessions = [];
    return inMemorySessions;
  }
}

function writeLocalSessions(sessions: ChatSession[]): void {
  inMemorySessions = sessions.slice(0, 300);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(inMemorySessions));
  } catch {}
}

function readLocalMessages(sessionId?: string): ChatMessage[] {
  let list = inMemoryMessages;
  if (!list) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        list = [];
      } else {
        const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
        list = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
      }
    } catch {
      list = [];
    }
    inMemoryMessages = list;
  }
  return sessionId ? list.filter((m) => m.sessionId === sessionId) : list;
}

function writeLocalMessages(messages: ChatMessage[]): void {
  inMemoryMessages = messages.slice(-1500);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(inMemoryMessages));
  } catch {}
}

function mergeSessions(primary: ChatSession[], secondary: ChatSession[]): ChatSession[] {
  const map = new Map<string, ChatSession>();
  for (const s of secondary) map.set(s.id, s);
  for (const s of primary) {
    const existing = map.get(s.id);
    if (!existing) {
      map.set(s.id, s);
    } else {
      const primaryCount = s.messageCount || 0;
      const existingCount = existing.messageCount || 0;
      const primaryTime = s.updatedAt || s.lastMessageAt || s.createdAt || '';
      const existingTime = existing.updatedAt || existing.lastMessageAt || existing.createdAt || '';
      const newer = primaryTime >= existingTime ? s : existing;
      map.set(s.id, {
        ...existing,
        ...s,
        title:
          primaryCount >= existingCount && s.title && s.title !== 'Hội thoại mới'
            ? s.title
            : existing.title || s.title,
        messageCount: Math.max(primaryCount, existingCount),
        updatedAt: newer.updatedAt || existing.updatedAt || s.updatedAt,
        lastMessageAt: newer.lastMessageAt || existing.lastMessageAt || s.lastMessageAt
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = a.updatedAt || a.lastMessageAt || a.createdAt || '';
    const timeB = b.updatedAt || b.lastMessageAt || b.createdAt || '';
    return timeB.localeCompare(timeA);
  });
}

function mergeMessages(primary: ChatMessage[], secondary: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of secondary) map.set(m.id, m);
  for (const m of primary) {
    const existing = map.get(m.id);
    if (!existing) {
      map.set(m.id, m);
    } else {
      map.set(m.id, {
        ...existing,
        ...m,
        image: m.image || existing.image,
        content:
          m.content && m.content.length >= (existing.content?.length || 0)
            ? m.content
            : existing.content || m.content
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

class ChatDbService {
  public async init(): Promise<void> {}

  public getLocalSessions(lessonId?: string, userId?: string): ChatSession[] {
    const all = readLocalSessions();
    return all.filter(
      (s) =>
        (!lessonId || s.lessonId === lessonId) &&
        (!userId || userId === 'guest' || s.userId === userId)
    );
  }

  public getLocalMessages(sessionId: string): ChatMessage[] {
    return readLocalMessages(sessionId).map((m) => ({
      ...m,
      content: stripLegacyFallbackNote(m.content)
    }));
  }

  public async getSessions(lessonId?: string, userId?: string): Promise<ChatSession[]> {
    const localAll = readLocalSessions();
    const localFiltered = localAll.filter(
      (s) =>
        (!lessonId || s.lessonId === lessonId) &&
        (!userId || userId === 'guest' || s.userId === userId)
    );

    try {
      const params = new URLSearchParams();
      if (lessonId) params.set('lessonId', lessonId);
      if (userId && userId !== 'guest') params.set('userId', userId);
      const res = await apiFetch<{ sessions: ChatSession[] }>(`/chat/sessions?${params}`);
      const serverSessions = res.sessions || [];
      const merged = mergeSessions(serverSessions, localFiltered);
      writeLocalSessions(mergeSessions(serverSessions, localAll));
      return merged;
    } catch (err) {
      console.warn('Không tải được sessions từ server, dùng local cache:', err);
      return localFiltered;
    }
  }

  public async getOrCreateActiveSession(lessonId: string, lessonTitle?: string, userId?: string): Promise<ChatSession> {
    return (await this.getSessions(lessonId, userId))[0] || this.createSession(lessonId, lessonTitle, userId);
  }

  public async createSession(
    lessonId: string,
    title?: string,
    userId?: string,
    preferredId?: string
  ): Promise<ChatSession> {
    const now = new Date().toISOString();
    const sessionId =
      preferredId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'sess_' + Date.now());
    const existingSessions = readLocalSessions();
    const existing = existingSessions.find((s) => s.id === sessionId);
    const localSession: ChatSession = {
      id: sessionId,
      userId: userId || existing?.userId || 'user',
      lessonId,
      title: title || existing?.title || 'Hội thoại mới',
      messageCount: existing?.messageCount || 0,
      lastMessageAt: existing?.lastMessageAt || now,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    const filtered = existingSessions.filter((s) => s.id !== sessionId);
    writeLocalSessions([localSession, ...filtered]);

    let serverSession = localSession;
    try {
      const result = await apiFetch<{ session: ChatSession }>('/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ lessonId, title: localSession.title, id: sessionId, sessionId })
      });
      if (result?.session) {
        serverSession = result.session;
        writeLocalSessions([serverSession, ...filtered]);
      }
    } catch (error) {
      console.warn('Không thể tạo session trên server, dùng local session:', error);
    }

    void this.log('INFO', 'SESSION_CREATED', `Khởi tạo session: ${serverSession.id}`, undefined, serverSession.id, lessonId);
    return serverSession;
  }

  public async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const sessions = readLocalSessions();
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      sessions[idx].title = title;
      sessions[idx].updatedAt = new Date().toISOString();
      writeLocalSessions(sessions);
    }
    try {
      await apiFetch('/chat/sessions', { method: 'PATCH', body: JSON.stringify({ sessionId, title }) });
    } catch {}
  }

  public async authorizeTutorSession(
    sessionId: string,
    lessonId?: string,
    title?: string
  ): Promise<void> {
    try {
      await apiFetch('/chat/sessions/tutor-proof', {
        method: 'POST',
        body: JSON.stringify({ sessionId, lessonId, title })
      });
    } catch (err) {
      console.warn('Lỗi authorizeTutorSession, đang auto-heal session lên server:', err);
      const local = readLocalSessions().find((s) => s.id === sessionId);
      await this.createSession(
        lessonId || local?.lessonId || 'c1-l1',
        title || local?.title,
        local?.userId,
        sessionId
      );
      await apiFetch('/chat/sessions/tutor-proof', {
        method: 'POST',
        body: JSON.stringify({ sessionId, lessonId, title })
      });
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const sessions = readLocalSessions().filter((s) => s.id !== sessionId);
    writeLocalSessions(sessions);
    const messages = readLocalMessages().filter((m) => m.sessionId !== sessionId);
    writeLocalMessages(messages);

    try {
      await this.log('INFO', 'SESSION_DELETED', `Xóa session: ${sessionId}`, undefined, sessionId);
      await apiFetch('/chat/sessions', { method: 'DELETE', body: JSON.stringify({ sessionId }) });
    } catch (err) {
      console.warn('Không xóa được session trên server:', err);
    }
  }

  public async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const localMsgs = readLocalMessages(sessionId);
    try {
      const result = await apiFetch<{ messages: ChatMessage[] }>(
        `/chat/messages?sessionId=${encodeURIComponent(sessionId)}`
      );
      const serverMsgs = (result.messages || []).map((m) => ({
        ...m,
        content: stripLegacyFallbackNote(m.content)
      }));
      const merged = mergeMessages(serverMsgs, localMsgs);
      const allLocal = readLocalMessages().filter((m) => m.sessionId !== sessionId);
      writeLocalMessages([...allLocal, ...merged]);
      return merged;
    } catch (err) {
      console.warn('Không tải được messages từ server, dùng local cache:', err);
      return localMsgs.map((m) => ({
        ...m,
        content: stripLegacyFallbackNote(m.content)
      }));
    }
  }

  public async addMessage(
    msg: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ): Promise<ChatMessage> {
    const now = new Date().toISOString();
    const fullMsg: ChatMessage = {
      id:
        msg.id ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'msg_' + Date.now()),
      sessionId: msg.sessionId,
      lessonId: msg.lessonId,
      userId: msg.userId,
      role: msg.role,
      content: stripLegacyFallbackNote(msg.content),
      image: msg.image,
      model: msg.model,
      createdAt: msg.createdAt || now
    };

    // 1. Lưu ngay vào local storage (deduplicate nếu đã tồn tại)
    const allLocal = readLocalMessages();
    const existingMsgIdx = allLocal.findIndex((m) => m.id === fullMsg.id);
    if (existingMsgIdx >= 0) {
      allLocal[existingMsgIdx] = {
        ...allLocal[existingMsgIdx],
        ...fullMsg,
        image: fullMsg.image || allLocal[existingMsgIdx].image
      };
      writeLocalMessages(allLocal);
    } else {
      writeLocalMessages([...allLocal, fullMsg]);
    }

    // 2. Cập nhật session messageCount và lastMessageAt trong local
    const sessions = readLocalSessions();
    const sesIndex = sessions.findIndex((s) => s.id === msg.sessionId);
    if (sesIndex >= 0) {
      if (existingMsgIdx < 0) {
        sessions[sesIndex].messageCount = (sessions[sesIndex].messageCount || 0) + 1;
      }
      sessions[sesIndex].lastMessageAt = now;
      sessions[sesIndex].updatedAt = now;
      if (
        fullMsg.role === 'user' &&
        sessions[sesIndex].messageCount <= 2 &&
        fullMsg.content.trim()
      ) {
        sessions[sesIndex].title = fullMsg.content.slice(0, 32);
      }
      writeLocalSessions(sessions);
    }

    // 3. Gửi lên server
    try {
      const res = await apiFetch<{ message: ChatMessage }>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify(fullMsg)
      });
      return res.message || fullMsg;
    } catch (err) {
      console.warn('Lỗi gửi message lên server, thực hiện auto-heal session:', err);
      try {
        await this.createSession(msg.lessonId, undefined, msg.userId, msg.sessionId);
        const res = await apiFetch<{ message: ChatMessage }>('/chat/messages', {
          method: 'POST',
          body: JSON.stringify(fullMsg)
        });
        return res.message || fullMsg;
      } catch (retryErr) {
        console.warn('Không thể gửi message lên server, giữ bản lưu local:', retryErr);
        return fullMsg;
      }
    }
  }

  public async updateMessageContent(messageId: string, content: string): Promise<void> {
    const cleaned = stripLegacyFallbackNote(content);
    const all = readLocalMessages();
    const idx = all.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      all[idx].content = cleaned;
      writeLocalMessages(all);
    }
    try {
      await apiFetch('/chat/messages', {
        method: 'PATCH',
        body: JSON.stringify({ messageId, content: cleaned })
      });
    } catch (err) {
      console.warn('Không cập nhật được message lên server:', err);
    }
  }

  public async log(
    level: ChatLog['level'],
    event: string,
    message: string,
    metadata?: Record<string, unknown>,
    sessionId?: string,
    lessonId?: string
  ): Promise<void> {
    try {
      await apiFetch('/chat/logs', {
        method: 'POST',
        body: JSON.stringify({ level, event, message, metadata, sessionId, lessonId })
      });
    } catch (error) {
      console.error('Không ghi được audit log lên server:', error);
    }
  }

  public async getLogs(filter?: {
    sessionId?: string;
    lessonId?: string;
    level?: string;
    limit?: number;
  }): Promise<ChatLog[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filter || {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    return (await apiFetch<{ logs: ChatLog[] }>(`/chat/logs?${params}`)).logs;
  }

  public async getRecentChatSummary(userId?: string) {
    const sessions = await this.getSessions(undefined, userId);
    return Promise.all(
      sessions.slice(0, 20).map(async (s) => {
        const messages = await this.getMessages(s.id);
        return {
          sessionId: s.id,
          lessonId: s.lessonId,
          userId: s.userId,
          title: s.title,
          messageCount: s.messageCount,
          lastMessageAt: s.lastMessageAt,
          lastMessage: messages.at(-1)?.content
        };
      })
    );
  }

}

export const chatDbService = new ChatDbService();
