import { UserProfile, CoursePlan, LearningHistoryRecord, UserProgressState, FinalExamResult, AdminStats } from '../types/user.ts';

const API_BASE = '/api';
const TOKEN_KEY = 'esmiles_auth_token';
const USER_KEY = 'esmiles_user_profile';

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
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
    throw new Error(data.error || `HTTP ${res.status}: Lỗi máy chủ`);
  }
  return data as T;
}

interface RawUserPayload {
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
  // Token & Local Session Management
  getToken(): string | null {
    return getStoredToken();
  },

  getStoredUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RawUserPayload;
        return mapUserResponse(parsed);
      }
    } catch {}
    return null;
  },

  setAuth(token: string, user: UserProfile): void {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
  },

  clearAuth(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
  },

  // 1. AUTH: Google Login
  async loginGoogle(payload: { accessToken?: string; credential?: string; email?: string; name?: string; avatar?: string; googleId?: string }): Promise<{ user: UserProfile; token: string }> {
    const data = await apiFetch<{ success: boolean; token: string; user: RawUserPayload }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const user = mapUserResponse(data.user);
    this.setAuth(data.token, user);
    return {
      token: data.token,
      user
    };
  },

  // 2. AUTH: Email Login
  async login(payload: { email: string; password?: string; authProvider?: string; name?: string }): Promise<{ user: UserProfile; token: string }> {
    if (payload.authProvider === 'google') {
      return this.loginGoogle({ email: payload.email, name: payload.name });
    }

    const data = await apiFetch<{ success: boolean; token: string; user: RawUserPayload }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: payload.email, password: payload.password })
    });
    const user = mapUserResponse(data.user);
    this.setAuth(data.token, user);
    return {
      token: data.token,
      user
    };
  },

  // 3. AUTH: Register
  async register(payload: { name: string; email: string; password?: string; role?: 'student' | 'admin'; planId?: string }): Promise<{ user: UserProfile; token: string }> {
    const data = await apiFetch<{ success: boolean; token: string; user: RawUserPayload }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const user = mapUserResponse(data.user);
    this.setAuth(data.token, user);
    return {
      token: data.token,
      user
    };
  },

  // 4. AUTH: Get Current User Session (Me)
  async getMe(): Promise<UserProfile | null> {
    try {
      const data = await apiFetch<{ success: boolean; user: RawUserPayload }>('/auth/me');
      if (!data?.user) {
        return null;
      }
      const user = mapUserResponse(data.user);
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {}
      return user;
    } catch (err: unknown) {
      // If server explicitly returns unauthorized, clear invalid local credentials
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('401') || errMsg.includes('hết hạn') || errMsg.includes('Chưa đăng nhập')) {
        this.clearAuth();
      }
      return null;
    }
  },

  // 5. AUTH: Logout
  async logout(): Promise<void> {
    this.clearAuth();
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
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
  async getProgress(userId: string): Promise<UserProgressState | null> {
    try {
      const data = await apiFetch<{ success: boolean; progress: UserProgressState }>(`/progress?userId=${encodeURIComponent(userId)}`);
      return data.progress || null;
    } catch {
      // Fallback to local storage if offline
      try {
        const local = localStorage.getItem(`esmiles_progress_${userId}`);
        if (local) return JSON.parse(local) as UserProgressState;
      } catch {}
      return null;
    }
  },

  async saveProgress(userId: string, progress: UserProgressState): Promise<void> {
    try {
      localStorage.setItem(`esmiles_progress_${userId}`, JSON.stringify(progress));
    } catch {}
    try {
      await apiFetch('/progress', {
        method: 'POST',
        body: JSON.stringify({ userId, progress })
      });
    } catch {}
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
  async getHistory(userId?: string): Promise<LearningHistoryRecord[]> {
    const path = userId ? `/history?userId=${encodeURIComponent(userId)}` : `/history`;
    const data = await apiFetch<{ success: boolean; history: LearningHistoryRecord[] }>(path);
    return data.history || [];
  },

  async addHistory(payload: { userId: string; lessonId?: string; lessonTitle?: string; action: string; score?: number; details?: string }): Promise<void> {
    await apiFetch('/history', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 11. STATS
  async getAdminStats(): Promise<AdminStats | null> {
    try {
      const data = await apiFetch<{ success: boolean; stats: AdminStats }>('/admin/stats');
      return data.stats || null;
    } catch {
      return null;
    }
  }
};
