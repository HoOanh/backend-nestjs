import { UserProfile, CoursePlan, LearningHistoryRecord, UserProgressState, FinalExamResult, AdminStats } from '../types/user.ts';
import { STORAGE_KEYS } from '../constants/storage.ts';

const API_BASE = '/api';
const TOKEN_KEY = STORAGE_KEYS.TOKEN;
const USER_KEY = STORAGE_KEYS.USER;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  const responseText = await res.text();
  let data: { error?: string } = {};
  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText) as { error?: string };
    } catch {
      throw new Error(`Máy chủ trả về dữ liệu không hợp lệ (${res.status}).`);
    }
  }

  if (!res.ok) {
    const requestId = res.headers.get('X-Request-ID');
    throw new Error(`${data.error || `HTTP ${res.status}: Lỗi máy chủ`}${requestId ? ` [request: ${requestId}]` : ''}`);
  }
  return data as T;
}

interface RawUserPayload {
  isTestAccount?: boolean;
  status?: "active" | "suspended";
  version?: number;
  dataOrigin?: "real" | "test";
  id?: string;
  name?: string;
  email?: string;
  role?: 'student' | 'admin' | 'instructor';
  avatar?: string;
  avatarColor?: string;
  avatar_color?: string;
  authProvider?: 'google' | 'email';
  auth_provider?: 'google' | 'email';
  planId?: 'free' | 'pro' | 'enterprise';
  plan_id?: 'free' | 'pro' | 'enterprise';
  createdAt?: string;
  created_at?: string;
  lastLoginAt?: string;
  last_login_at?: string;
}

function mapUserResponse(u?: RawUserPayload | null): UserProfile {
  if (!u) {
    return {
      id: '',
      name: 'Học Viên',
      email: '',
      role: 'student',
      avatarColor: '#0ea5e9',
      authProvider: 'email',
      planId: 'free',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
  }
  return {
    isTestAccount: u.isTestAccount,
    status: u.status, version: u.version, dataOrigin: u.dataOrigin,
    id: u.id || '',
    name: u.name || 'Học Viên',
    email: u.email || '',
    role: u.role || 'student',
    avatar: u.avatar || undefined,
    avatarColor: u.avatarColor || u.avatar_color || '#0ea5e9',
    authProvider: u.authProvider || u.auth_provider || 'email',
    planId: u.planId || u.plan_id || 'free',
    createdAt: u.createdAt || u.created_at || new Date().toISOString(),
    lastLoginAt: u.lastLoginAt || u.last_login_at || new Date().toISOString()
  };
}

export const apiClient = {
  // Clear credentials left by older localStorage-based releases.
  clearLegacyAuth(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  },

  // 1. AUTH: Google Login
  async loginGoogle(payload: { accessToken?: string; credential?: string; email?: string; name?: string; avatar?: string; googleId?: string }): Promise<{ user: UserProfile }> {
    const data = await apiFetch<{ success: boolean; user: RawUserPayload }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const user = mapUserResponse(data.user);
    return { user };
  },

  // 2. AUTH: Email Login
  async login(payload: { email: string; password?: string; authProvider?: string; name?: string }): Promise<{ user: UserProfile }> {
    if (payload.authProvider === 'google') {
      return this.loginGoogle({ email: payload.email, name: payload.name });
    }

    const data = await apiFetch<{ success: boolean; user: RawUserPayload }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: payload.email, password: payload.password })
    });
    const user = mapUserResponse(data.user);
    return { user };
  },

  // 3. AUTH: Register
  async register(payload: { name: string; email: string; password?: string; role?: 'student' | 'admin'; planId?: string }): Promise<{ user: UserProfile }> {
    const data = await apiFetch<{ success: boolean; user: RawUserPayload }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const user = mapUserResponse(data.user);
    return { user };
  },

  // 4. AUTH: Get Current User Session (Me)
  async getMe(): Promise<UserProfile | null> {
    try {
      this.clearLegacyAuth();
      const data = await apiFetch<{ success: boolean; user: RawUserPayload }>('/auth/me');
      if (!data?.user) {
        return null;
      }
      const user = mapUserResponse(data.user);
      return user;
    } catch (err: unknown) {
      // If server explicitly returns unauthorized, clear invalid local credentials
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('401') || errMsg.includes('hết hạn') || errMsg.includes('Chưa đăng nhập')) {
        this.clearLegacyAuth();
      }
      return null;
    }
  },

  // 5. AUTH: Logout
  async logout(): Promise<void> {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Clear stale client-side credentials even if the server is unavailable.
    } finally {
      this.clearLegacyAuth();
    }
  },

  // 6. USERS
  async getUsers(): Promise<UserProfile[]> {
    const data = await apiFetch<{ success: boolean; users: RawUserPayload[] }>('/users');
    return (data.users || []).map(mapUserResponse);
  },

  async createUser(payload: Partial<UserProfile>): Promise<UserProfile> {
    const data = await apiFetch<{ success: boolean; user: RawUserPayload }>('/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return mapUserResponse(data.user);
  },

  async updateUser(id: string, payload: Partial<UserProfile>): Promise<void> {
    await apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteUser(id: string): Promise<void> {
    await apiFetch(`/users/${id}`, { method: 'DELETE' });
  },

  // 7. PLANS
  async getPlans(): Promise<CoursePlan[]> {
    const data = await apiFetch<{ success: boolean; plans: CoursePlan[] }>('/plans');
    return data.plans || [];
  },

  async updatePlan(id: string, payload: Partial<CoursePlan>): Promise<void> {
    await apiFetch(`/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  // 8. PROGRESS
  readLocalProgress(userId: string): UserProgressState | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = localStorage.getItem(`${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`);
      if (raw) return JSON.parse(raw) as UserProgressState;
    } catch {}
    return null;
  },

  writeLocalProgress(userId: string, progress: UserProgressState): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem(`${STORAGE_KEYS.PROGRESS_PREFIX}${userId}`, JSON.stringify(progress));
    } catch {}
  },

  mergeProgress(
    local: UserProgressState | null,
    remote: UserProgressState | null
  ): UserProgressState {
    const today = new Date().toISOString().split('T')[0];
    const base: UserProgressState = {
      currentLessonId: 'c1-l1',
      completedLessons: {},
      sprintExamScores: {},
      finalExam: null,
      streakDays: 1,
      lastActiveDate: today,
      clearedLessons: {},
      quizScores: {}
    };
    if (!local && !remote) return base;
    if (!local) return { ...base, ...remote };
    if (!remote) return { ...base, ...local };

    const completedLessons = {
      ...(remote.completedLessons || {}),
      ...(local.completedLessons || {})
    };
    const clearedLessons = {
      ...(remote.clearedLessons || {}),
      ...(local.clearedLessons || {})
    };
    const quizScores = {
      ...(remote.quizScores || {}),
      ...(local.quizScores || {})
    };
    const sprintExamScores = {
      ...(local.sprintExamScores || {}),
      ...(remote.sprintExamScores || {})
    };
    const currentLessonId =
      local.currentLessonId && local.currentLessonId !== 'lesson-1'
        ? local.currentLessonId
        : remote.currentLessonId && remote.currentLessonId !== 'lesson-1'
          ? remote.currentLessonId
          : 'c1-l1';

    const enrolledCourses = {
      ...(remote.enrolledCourses || {}),
      ...(local.enrolledCourses || {})
    };
    const classroomProgress = {
      ...(remote.classroomProgress || {}),
      ...(local.classroomProgress || {})
    };

    return {
      currentLessonId,
      completedLessons,
      sprintExamScores,
      finalExam: remote.finalExam || local.finalExam || null,
      streakDays: Math.max(local.streakDays || 1, remote.streakDays || 1),
      lastActiveDate:
        (local.lastActiveDate || '') >= (remote.lastActiveDate || '')
          ? local.lastActiveDate || today
          : remote.lastActiveDate || today,
      clearedLessons,
      quizScores,
      activeCourseId: local.activeCourseId || remote.activeCourseId || 'backend-nestjs',
      activeCareerPathId:
        local.activeCareerPathId || remote.activeCareerPathId || 'path-backend-architect',
      enrolledCourses,
      classroomProgress
    };
  },

  async getProgress(userId: string): Promise<UserProgressState | null> {
    const local = this.readLocalProgress(userId);
    const guest = userId !== 'guest' ? this.readLocalProgress('guest') : null;
    const combinedLocal = this.mergeProgress(guest, local);
    try {
      const data = await apiFetch<{ success: boolean; progress: UserProgressState }>(
        `/progress?userId=${encodeURIComponent(userId)}`
      );
      const remote = data.progress || null;
      const merged = this.mergeProgress(combinedLocal, remote);
      this.writeLocalProgress(userId, merged);

      const remoteCompletedCount = Object.keys(remote?.completedLessons || {}).length;
      const mergedCompletedCount = Object.keys(merged.completedLessons || {}).length;
      const remoteClearedCount = Object.keys(remote?.clearedLessons || {}).length;
      const mergedClearedCount = Object.keys(merged.clearedLessons || {}).length;
      if (
        mergedCompletedCount > remoteCompletedCount ||
        mergedClearedCount > remoteClearedCount
      ) {
        void this.saveProgress(userId, merged);
      }
      return merged;
    } catch {
      return combinedLocal;
    }
  },

  async saveProgress(
    userId: string,
    progress: UserProgressState,
    options: { requireServer?: boolean } = {}
  ): Promise<void> {
    const existingLocal = this.readLocalProgress(userId);
    const merged = this.mergeProgress(progress, existingLocal);
    merged.currentLessonId = progress.currentLessonId || merged.currentLessonId;
    this.writeLocalProgress(userId, merged);
    try {
      await apiFetch('/progress', {
        method: 'POST',
        body: JSON.stringify({ userId, progress: merged })
      });
    } catch (error) {
      if (options.requireServer) throw error;
    }
  },

  // 9. EXAMS
  async submitSprintExam(userId: string, sprintId: number, score: number, passed: boolean): Promise<void> {
    await apiFetch('/exams/submit-sprint', {
      method: 'POST',
      body: JSON.stringify({ userId, sprintId, score, passed })
    });
  },

  async submitFinalExam(userId: string, studentName: string, score: number, passed: boolean): Promise<{ certificateCode: string; finalResult: FinalExamResult }> {
    const data = await apiFetch<{ success: boolean; certificateCode: string; finalResult: FinalExamResult }>('/exams/submit-final', {
      method: 'POST',
      body: JSON.stringify({ userId, studentName, score, passed })
    });
    return data;
  },

  // 10. HISTORY
  readLocalHistory(userId: string): LearningHistoryRecord[] {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      const raw = localStorage.getItem(`${STORAGE_KEYS.HISTORY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as LearningHistoryRecord[];
      }
    } catch {}
    return [];
  },

  writeLocalHistory(userId: string, records: LearningHistoryRecord[]): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem(
        `${STORAGE_KEYS.HISTORY_PREFIX}${userId}`,
        JSON.stringify(records.slice(0, 1000))
      );
    } catch {}
  },

  async getHistory(userId?: string): Promise<LearningHistoryRecord[]> {
    const localRecords = userId ? this.readLocalHistory(userId) : [];
    const guestRecords =
      userId && userId !== 'guest'
        ? this.readLocalHistory('guest').map((r) => ({ ...r, userId }))
        : [];
    const combinedLocal = [...localRecords, ...guestRecords];
    try {
      const path = userId ? `/history?userId=${encodeURIComponent(userId)}` : `/history`;
      const data = await apiFetch<{ success: boolean; history: LearningHistoryRecord[] }>(path);
      const remoteRecords = data.history || [];

      const byId = new Map<string, LearningHistoryRecord>();
      const bySignature = new Set<string>();
      for (const r of remoteRecords) {
        byId.set(r.id, r);
        bySignature.add(`${r.action}:${r.lessonId || ''}:${(r.timestamp || '').slice(0, 16)}`);
      }

      const missingOnServer: LearningHistoryRecord[] = [];
      for (const localRec of combinedLocal) {
        const sig = `${localRec.action}:${localRec.lessonId || ''}:${(localRec.timestamp || '').slice(0, 16)}`;
        if (!byId.has(localRec.id) && !bySignature.has(sig)) {
          byId.set(localRec.id, localRec);
          bySignature.add(sig);
          if (
            userId &&
            [
              'theory_read',
              'quiz_passed',
              'quiz_failed',
              'code_passed',
              'lesson_completed'
            ].includes(localRec.action)
          ) {
            missingOnServer.push(localRec);
          }
        }
      }

      const merged = Array.from(byId.values()).sort((a, b) =>
        (b.timestamp || '').localeCompare(a.timestamp || '')
      );
      if (userId) {
        this.writeLocalHistory(userId, merged);
      }

      for (const rec of missingOnServer.slice(0, 30)) {
        void apiFetch('/history', {
          method: 'POST',
          body: JSON.stringify({
            id: rec.id,
            userId: rec.userId,
            lessonId: rec.lessonId,
            lessonTitle: rec.lessonTitle,
            action: rec.action,
            score: rec.score,
            details: rec.details,
            timestamp: rec.timestamp
          })
        }).catch(() => {});
      }

      return merged;
    } catch {
      return combinedLocal.sort((a, b) =>
        (b.timestamp || '').localeCompare(a.timestamp || '')
      );
    }
  },

  async addHistory(payload: {
    userId: string;
    lessonId?: string;
    lessonTitle?: string;
    action: string;
    score?: number;
    details?: string;
  }): Promise<void> {
    const id = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();
    const record: LearningHistoryRecord = {
      id,
      userId: payload.userId,
      lessonId: payload.lessonId,
      lessonTitle: payload.lessonTitle,
      action: payload.action,
      score: payload.score,
      details: payload.details,
      timestamp
    };

    const existing = this.readLocalHistory(payload.userId);
    this.writeLocalHistory(payload.userId, [record, ...existing]);

    if (payload.userId === 'guest') return;

    try {
      await apiFetch('/history', {
        method: 'POST',
        body: JSON.stringify({ ...payload, id, timestamp })
      });
    } catch {
      // Kept in localStorage and will auto-sync on next getHistory
    }
  },

  // 11. STATS
  async getAdminStats(): Promise<AdminStats | null> {
    const data = await apiFetch<{ success: boolean; stats: AdminStats }>('/admin/stats');
    return data.stats;
  }
};
