import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  password_salt?: string;
  role: 'student' | 'admin' | 'instructor';
  avatar?: string;
  avatar_color?: string;
  auth_provider: 'google' | 'email';
  google_id?: string;
  plan_id: 'free' | 'pro' | 'enterprise';
  created_at: string;
  last_login_at: string;
}

export interface DbSession {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  expires_at: string;
}

export interface DbPlan {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  description: string;
  features: string;
  is_popular: number;
  is_active: number;
}

export interface DbProgress {
  user_id: string;
  current_lesson_id: string;
  completed_lessons: string;
  sprint_exam_scores: string;
  final_exam: string;
  streak_days: number;
  last_active_date: string;
  cleared_lessons: string;
  updated_at: string;
}

export interface DbHistory {
  id: string;
  user_id: string;
  lesson_id?: string;
  lesson_title?: string;
  action: string;
  score?: number;
  details?: string;
  timestamp: string;
}

export interface DbCertificate {
  id: string;
  certificate_code: string;
  user_id: string;
  student_name: string;
  score: number;
  completed_at: string;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return check === hash;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

interface StoreState {
  users: DbUser[];
  sessions: DbSession[];
  plans: DbPlan[];
  user_progress: DbProgress[];
  learning_history: DbHistory[];
  certificates: DbCertificate[];
}

function getStoreFilePath(): string {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isVercel) {
    return '/tmp/esmiles_store.json';
  }
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
  }
  return path.join(dataDir, 'esmiles_store.json');
}

let store: StoreState = {
  users: [],
  sessions: [],
  plans: [],
  user_progress: [],
  learning_history: [],
  certificates: []
};

function loadStore(): void {
  try {
    const filePath = getStoreFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.trim()) {
        store = JSON.parse(raw);
      }
    }
  } catch {}
}

function saveStore(): void {
  try {
    const filePath = getStoreFilePath();
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
  } catch {}
}

loadStore();

// Seed Default Plans if empty
if (!store.plans || store.plans.length === 0) {
  store.plans = [
    {
      id: 'free',
      name: 'Gói Trải Nghiệm (Free Starter)',
      price: 0,
      billing_period: 'Vĩnh viễn',
      description: 'Dành cho người mới bắt đầu tìm hiểu kiến trúc backend NestJS.',
      features: JSON.stringify([
        'Học Sprint 01: Core Architecture & Dependency Injection',
        'Thực hành Code Sandbox cơ bản (20 tests)',
        'Hỏi đáp Tutor AI giới hạn 10 câu/ngày',
        'Lưu trữ kết quả học tập cá nhân'
      ]),
      is_popular: 0,
      is_active: 1
    },
    {
      id: 'pro',
      name: 'Gói Chuyên Sâu (Pro Master NestJS)',
      price: 990000,
      billing_period: 'Trọn đời',
      description: 'Trọn bộ 6 Sprints kiến trúc thực chiến eSmiles, Prisma 7 & Khảo thí cấp bằng.',
      features: JSON.stringify([
        'Mở khóa toàn bộ 6 Sprints (22+ bài học chuyên sâu)',
        'Không giới hạn bài tập Code Sandbox & Hidden Tests',
        'AI Tutor Gemini 3.7 Flash hỗ trợ giải thích 24/7',
        'Tham gia 4 kỳ thi Sprint + Thi Tốt Nghiệp Toàn Khóa',
        'Cấp Chứng Chỉ Tốt Nghiệp Danh Dự eSmiles Academy có mã tra cứu'
      ]),
      is_popular: 1,
      is_active: 1
    },
    {
      id: 'enterprise',
      name: 'Gói Doanh Nghiệp (Enterprise Team)',
      price: 2490000,
      billing_period: 'Theo nhóm 5 thành viên',
      description: 'Đào tạo đội ngũ Frontend chuyển đổi Fullstack NestJS theo chuẩn doanh nghiệp.',
      features: JSON.stringify([
        'Bao gồm toàn bộ quyền lợi của gói Pro Master cho 5 thành viên',
        'Bảng điều khiển Admin theo dõi tiến độ từng kỹ sư',
        'Review code 1-1 và hướng dẫn kiến trúc đa chi nhánh',
        'Xuất báo cáo đánh giá năng lực kỹ sư theo Sprint'
      ]),
      is_popular: 0,
      is_active: 1
    }
  ];
  saveStore();
}

// Bootstrap single admin account from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@esmiles.vn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026!';

if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const existingAdmin = store.users.find((u) => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (!existingAdmin) {
    const adminHash = hashPassword(ADMIN_PASSWORD);
    const now = new Date().toISOString();
    store.users.push({
      id: 'usr_admin_' + Date.now(),
      name: 'System Administrator',
      email: ADMIN_EMAIL.toLowerCase().trim(),
      password_hash: adminHash.hash,
      password_salt: adminHash.salt,
      role: 'admin',
      avatar_color: '#f59e0b',
      auth_provider: 'email',
      plan_id: 'enterprise',
      created_at: now,
      last_login_at: now
    });
    saveStore();
  }
}

export const dbService = {
  // SESSIONS
  createSession(userId: string): DbSession {
    const token = generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const session: DbSession = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      user_id: userId,
      token,
      created_at: now.toISOString(),
      expires_at: expiresAt
    };
    store.sessions.push(session);
    saveStore();
    return session;
  },

  getSessionByToken(token: string): { session: DbSession; user: DbUser } | null {
    const session = store.sessions.find((s) => s.token === token && new Date(s.expires_at) > new Date());
    if (!session) return null;
    const user = store.users.find((u) => u.id === session.user_id);
    if (!user) return null;
    return { session, user };
  },

  deleteSession(token: string): boolean {
    store.sessions = store.sessions.filter((s) => s.token !== token);
    saveStore();
    return true;
  },

  // USERS
  getAllUsers(): DbUser[] {
    return [...store.users].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getUserByEmail(email: string): DbUser | null {
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  getUserById(id: string): DbUser | null {
    return store.users.find((u) => u.id === id) || null;
  },

  createUser(user: {
    id: string;
    name: string;
    email: string;
    password?: string;
    role: 'student' | 'admin' | 'instructor';
    avatar?: string;
    avatar_color?: string;
    auth_provider: 'google' | 'email';
    google_id?: string;
    plan_id: 'free' | 'pro' | 'enterprise';
  }): DbUser {
    let password_hash: string | undefined;
    let password_salt: string | undefined;

    if (user.password) {
      const hashed = hashPassword(user.password);
      password_hash = hashed.hash;
      password_salt = hashed.salt;
    }

    const now = new Date().toISOString();
    const newUser: DbUser = {
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      password_hash,
      password_salt,
      role: user.role,
      avatar: user.avatar,
      avatar_color: user.avatar_color || '#0ea5e9',
      auth_provider: user.auth_provider,
      google_id: user.google_id,
      plan_id: user.plan_id,
      created_at: now,
      last_login_at: now
    };

    store.users.push(newUser);
    saveStore();
    return newUser;
  },

  updateUser(id: string, updates: Partial<DbUser>): DbUser | null {
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    store.users[idx] = { ...store.users[idx], ...updates };
    saveStore();
    return store.users[idx];
  },

  deleteUser(id: string): boolean {
    store.users = store.users.filter((u) => u.id !== id);
    store.sessions = store.sessions.filter((s) => s.user_id !== id);
    store.user_progress = store.user_progress.filter((p) => p.user_id !== id);
    store.learning_history = store.learning_history.filter((h) => h.user_id !== id);
    store.certificates = store.certificates.filter((c) => c.user_id !== id);
    saveStore();
    return true;
  },

  // PLANS
  getAllPlans(): DbPlan[] {
    return [...store.plans].sort((a, b) => a.price - b.price);
  },

  updatePlan(id: string, updates: Partial<DbPlan>): DbPlan | null {
    const idx = store.plans.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    store.plans[idx] = { ...store.plans[idx], ...updates };
    saveStore();
    return store.plans[idx];
  },

  // PROGRESS
  getUserProgress(userId: string): DbProgress | null {
    return store.user_progress.find((p) => p.user_id === userId) || null;
  },

  saveUserProgress(progress: DbProgress): DbProgress {
    const idx = store.user_progress.findIndex((p) => p.user_id === progress.user_id);
    if (idx !== -1) {
      store.user_progress[idx] = progress;
    } else {
      store.user_progress.push(progress);
    }
    saveStore();
    return progress;
  },

  // HISTORY
  getLearningHistory(userId?: string): DbHistory[] {
    if (userId) {
      return store.learning_history
        .filter((h) => h.user_id === userId)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 100);
    }
    return [...store.learning_history]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 200);
  },

  addLearningHistory(history: DbHistory): DbHistory {
    store.learning_history.push(history);
    saveStore();
    return history;
  },

  // CERTIFICATES
  issueCertificate(cert: DbCertificate): DbCertificate {
    store.certificates.push(cert);
    saveStore();
    return cert;
  },

  getCertificateByCode(code: string): DbCertificate | null {
    return store.certificates.find((c) => c.certificate_code === code) || null;
  },

  // STATS
  getAdminStats() {
    const userCount = store.users.length;
    const historyCount = store.learning_history.length;
    const certCount = store.certificates.length;

    const plans = this.getAllPlans();
    const users = this.getAllUsers();
    const totalRevenue = users.reduce((sum, u) => {
      const p = plans.find((pl) => pl.id === u.plan_id);
      return sum + (p?.price || 0);
    }, 0);

    return {
      totalUsers: userCount,
      totalRevenue,
      certifiedStudents: certCount,
      totalActivityLogs: historyCount
    };
  }
};
