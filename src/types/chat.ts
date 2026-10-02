export interface ChatSession {
  id: string;
  lessonId: string;
  userId?: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  lessonId: string;
  userId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: {
    data: string;
    mimeType: string;
    fileName?: string;
  };
  model?: string;
  createdAt: string;
}

export interface ChatLog {
  id: string;
  sessionId?: string;
  lessonId?: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface SqlQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  columns: string[];
  executionTimeMs: number;
  error?: string;
}

export interface ContextWindowInfo {
  sessionMessageCount: number;
  includedInContextCount: number;
  estimatedTokens: number;
  lastModel: string;
}
