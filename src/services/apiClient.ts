import { UserProfile, CoursePlan, LearningHistoryRecord } from '../types/user.ts';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: Lỗi máy chủ`);
  }
  return data;
}

function mapUserResponse(u: any): UserProfile {
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
  // 1. AUTH: Google Login
  async loginGoogle(payload: { accessToken?: string; credential?: string; email?: string; name?: string; avatar?: string; googleId?: string }): Promise<{ user: UserProfile; token: string }> {
    const data = await apiFetch<{ success: boolean; token: string; user: any }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return {
      token: data.token,
      user: mapUserResponse(data.user)
    };
  },

  // 2. AUTH: Email Login
  async login(payload: { email: string; password?: string; authProvider?: string; name?: string }): Promise<{ user: UserProfile; token: string }> {
    if (payload.authProvider === 'google') {
      return this.loginGoogle({ email: payload.email, name: payload.name });
    }

    const data = await apiFetch<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: payload.email, password: payload.password })
    });
    return {
      token: data.token,
      user: mapUserResponse(data.user)
    };
  },

  // 3. AUTH: Register
  async register(payload: { name: string; email: string; password?: string; role?: 'student' | 'admin'; planId?: string }): Promise<{ user: UserProfile; token: string }> {
    const data = await apiFetch<{ success: boolean; token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return {
      token: data.token,
      user: mapUserResponse(data.user)
    };
  },

  // 4. AUTH: Get Current User Session (Me)
  async getMe(): Promise<UserProfile | null> {
    try {
      const data = await apiFetch<{ success: boolean; user: any }>('/auth/me');
      if (!data?.user) return null;
      return mapUserResponse(data.user);
    } catch {
      return null;
    }
  },

  // 5. AUTH: Logout
  async logout(): Promise<void> {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
  },

  // 6. USERS
  async getUsers(): Promise<UserProfile[]> {
    const data = await apiFetch<{ success: boolean; users: any[] }>('/users');
    return (data.users || []).map(mapUserResponse);
  },

  async createUser(payload: Partial<UserProfile>): Promise<UserProfile> {
    const data = await apiFetch<{ success: boolean; user: any }>('/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return data.user;
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
  async getProgress(userId: string): Promise<any> {
    const data = await apiFetch<{ success: boolean; progress: any }>(`/progress?userId=${encodeURIComponent(userId)}`);
    return data.progress;
  },

  async saveProgress(userId: string, progress: any): Promise<void> {
    await apiFetch('/progress', {
      method: 'POST',
      body: JSON.stringify({ userId, progress })
    });
  },

  // 9. EXAMS
  async submitSprintExam(userId: string, sprintId: number, score: number, passed: boolean): Promise<void> {
    await apiFetch('/exams/submit-sprint', {
      method: 'POST',
      body: JSON.stringify({ userId, sprintId, score, passed })
    });
  },

  async submitFinalExam(userId: string, studentName: string, score: number, passed: boolean): Promise<{ certificateCode: string; finalResult: any }> {
    const data = await apiFetch<{ success: boolean; certificateCode: string; finalResult: any }>('/exams/submit-final', {
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
  async getAdminStats(): Promise<any> {
    const data = await apiFetch<{ success: boolean; stats: any }>('/admin/stats');
    return data.stats;
  }
};
