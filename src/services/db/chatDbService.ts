import { sqliteEngine } from './sqliteEngine.ts';
import { apiFetch } from '../apiClient.ts';
import type { ChatSession, ChatMessage, ChatLog, SqlQueryResult } from '../../types/chat.ts';

export function stripLegacyFallbackNote(text: string): string {
  if (!text || !text.includes('điều phối')) return text;
  return text
    .replace(/^>\s*💡\s*\*?Hệ thống đã tự động điều phối[^\n]*\n*/gm, '')
    .replace(/💡\s*\*?Hệ thống đã tự động điều phối[^\n]*\n*/g, '')
    .trim();
}

class ChatDbService {
  public async init(): Promise<void> {}

  public async getSessions(lessonId?: string, userId?: string): Promise<ChatSession[]> {
    const params = new URLSearchParams();
    if (lessonId) params.set('lessonId', lessonId);
    if (userId) params.set('userId', userId);
    return (await apiFetch<{ sessions: ChatSession[] }>(`/chat/sessions?${params}`)).sessions;
  }

  public async getOrCreateActiveSession(lessonId: string, lessonTitle?: string, userId?: string): Promise<ChatSession> {
    return (await this.getSessions(lessonId, userId))[0] || this.createSession(lessonId, lessonTitle, userId);
  }

  public async createSession(lessonId: string, title?: string, _userId?: string): Promise<ChatSession> {
    const result = await apiFetch<{ session: ChatSession }>('/chat/sessions', {
      method: 'POST', body: JSON.stringify({ lessonId, title })
    });
    await this.log('INFO', 'SESSION_CREATED', `Khởi tạo session: ${result.session.id}`, undefined, result.session.id, lessonId);
    return result.session;
  }

  public async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await apiFetch('/chat/sessions', { method: 'PATCH', body: JSON.stringify({ sessionId, title }) });
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.log('INFO', 'SESSION_DELETED', `Xóa session: ${sessionId}`, undefined, sessionId);
    await apiFetch('/chat/sessions', { method: 'DELETE', body: JSON.stringify({ sessionId }) });
  }

  public async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const result = await apiFetch<{ messages: ChatMessage[] }>(`/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
    return result.messages.map((m) => ({ ...m, content: stripLegacyFallbackNote(m.content) }));
  }

  public async addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<ChatMessage> {
    return (await apiFetch<{ message: ChatMessage }>('/chat/messages', { method: 'POST', body: JSON.stringify(msg) })).message;
  }

  public async updateMessageContent(messageId: string, content: string): Promise<void> {
    await apiFetch('/chat/messages', { method: 'PATCH', body: JSON.stringify({ messageId, content: stripLegacyFallbackNote(content) }) });
  }

  public async log(level: ChatLog['level'], event: string, message: string, metadata?: Record<string, unknown>, sessionId?: string, lessonId?: string): Promise<void> {
    try {
      await apiFetch('/chat/logs', { method: 'POST', body: JSON.stringify({ level, event, message, metadata, sessionId, lessonId }) });
    } catch (error) {
      console.error('Không ghi được audit log lên server:', error);
    }
  }

  public async getLogs(filter?: { sessionId?: string; lessonId?: string; level?: string; limit?: number }): Promise<ChatLog[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filter || {})) if (value !== undefined) params.set(key, String(value));
    return (await apiFetch<{ logs: ChatLog[] }>(`/chat/logs?${params}`)).logs;
  }

  public async getRecentChatSummary(userId?: string) {
    const sessions = await this.getSessions(undefined, userId);
    return Promise.all(sessions.slice(0, 20).map(async (s) => {
      const messages = await this.getMessages(s.id);
      return { sessionId: s.id, lessonId: s.lessonId, userId: s.userId, title: s.title,
        messageCount: s.messageCount, lastMessageAt: s.lastMessageAt, lastMessage: messages.at(-1)?.content };
    }));
  }

  // Legacy browser data stays available for inspection; server storage is JSON, not SQL.
  public async executeRawSql<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<SqlQueryResult<T>> {
    await sqliteEngine.ready();
    return sqliteEngine.execute<T>(sql, params);
  }
}

export const chatDbService = new ChatDbService();
