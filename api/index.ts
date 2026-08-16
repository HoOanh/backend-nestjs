import fs from 'fs';
import path from 'path';
import crypto from 'crypto';



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

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'esmiles_backend_academy_jwt_secret_key_2026_super_secure_987123';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'student' | 'admin' | 'instructor';
  name: string;
  planId: string;
  exp: number;
}

export function signJwt(user: DbUser, expiresInDays = 30): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    planId: user.plan_id,
    exp
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as TokenPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
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
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {}
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

function seedInitialData(): void {
  if (store.plans.length > 0) return;

  store.plans = [
    {
      id: 'free',
      name: 'Gói Trải Nghiệm (Free Plan)',
      price: 0,
      billing_period: 'Miễn phí vĩnh viễn',
      description: 'Dành cho học viên bắt đầu tìm hiểu tư duy Backend & NestJS nền tảng.',
      features: JSON.stringify([
        'Truy cập Sprint 0 (Mental Model & Event Loop)',
        'Thực hành Code Sandbox tương tác',
        'Khảo thí trắc nghiệm cơ bản',
        'Cộng đồng hỗ trợ eSmiles Open'
      ]),
      is_popular: 0,
      is_active: 1
    },
    {
      id: 'pro',
      name: 'Gói Chuyên Nghiệp (Pro Master)',
      price: 690000,
      billing_period: 'Thanh toán 1 lần / Trọn đời',
      description: 'Lộ trình chuyển đổi toàn diện thành Backend / Fullstack Engineer chuyên nghiệp.',
      features: JSON.stringify([
        'Toàn bộ 6 Sprints chuyên sâu từ Sprint 0 đến Sprint 5',
        'Master Prisma 7, High-Concurrency & Multi-Tenancy Scoping',
        'AI Gia Sư 1-1 (Gemini 2.5 Flash) hướng dẫn giải bài tập',
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

seedInitialData();

function bootstrapAdmin(): void {
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
}

bootstrapAdmin();

const dbService = {
  createSession(userId: string): DbSession {
    loadStore();
    const user = store.users.find((u) => u.id === userId);
    const token = user ? signJwt(user) : generateSessionToken();
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

  getAuthUser(token: string): DbUser | null {
    if (!token) return null;
    loadStore();

    // 1. Check Stateless Cryptographic JWT Token (Resilient against cold starts & multiple lambdas)
    const payload = verifyJwt(token);
    if (payload) {
      let user = store.users.find(
        (u) => u.id === payload.userId || u.email.toLowerCase() === payload.email.toLowerCase()
      );
      if (!user) {
        // Automatically restore and persist user in current container
        user = {
          id: payload.userId,
          name: payload.name || 'Học Viên',
          email: payload.email.toLowerCase(),
          role: payload.role || 'student',
          plan_id: (payload.planId as 'free' | 'pro' | 'enterprise') || 'pro',
          auth_provider: 'email',
          avatar_color: '#0ea5e9',
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        };
        store.users.push(user);
        saveStore();
      }
      return user;
    }

    // 2. Fallback to session store for legacy tokens
    const session = store.sessions.find((s) => s.token === token && new Date(s.expires_at) > new Date());
    if (session) {
      return store.users.find((u) => u.id === session.user_id) || null;
    }

    return null;
  },

  getSessionByToken(token: string): { session: DbSession; user: DbUser } | null {
    const user = this.getAuthUser(token);
    if (!user) return null;
    return {
      session: {
        id: 'sess_jwt',
        user_id: user.id,
        token,
        created_at: user.created_at,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      user
    };
  },

  deleteSession(token: string): boolean {
    loadStore();
    store.sessions = store.sessions.filter((s) => s.token !== token);
    saveStore();
    return true;
  },

  getAllUsers(): DbUser[] {
    loadStore();
    return [...store.users].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getUserByEmail(email: string): DbUser | null {
    loadStore();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  getUserById(id: string): DbUser | null {
    loadStore();
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
    loadStore();
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
    loadStore();
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    store.users[idx] = { ...store.users[idx], ...updates };
    saveStore();
    return store.users[idx];
  },

  deleteUser(id: string): boolean {
    loadStore();
    store.users = store.users.filter((u) => u.id !== id);
    store.sessions = store.sessions.filter((s) => s.user_id !== id);
    store.user_progress = store.user_progress.filter((p) => p.user_id !== id);
    store.learning_history = store.learning_history.filter((h) => h.user_id !== id);
    store.certificates = store.certificates.filter((c) => c.user_id !== id);
    saveStore();
    return true;
  },

  getAllPlans(): DbPlan[] {
    loadStore();
    return [...store.plans].sort((a, b) => a.price - b.price);
  },

  updatePlan(id: string, updates: Partial<DbPlan>): DbPlan | null {
    loadStore();
    const idx = store.plans.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    store.plans[idx] = { ...store.plans[idx], ...updates };
    saveStore();
    return store.plans[idx];
  },

  getUserProgress(userId: string): DbProgress | null {
    loadStore();
    return store.user_progress.find((p) => p.user_id === userId) || null;
  },

  saveUserProgress(progress: DbProgress): DbProgress {
    loadStore();
    const idx = store.user_progress.findIndex((p) => p.user_id === progress.user_id);
    if (idx !== -1) {
      store.user_progress[idx] = progress;
    } else {
      store.user_progress.push(progress);
    }
    saveStore();
    return progress;
  },

  getLearningHistory(userId?: string): DbHistory[] {
    loadStore();
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
    loadStore();
    store.learning_history.push(history);
    saveStore();
    return history;
  },

  issueCertificate(cert: DbCertificate): DbCertificate {
    loadStore();
    store.certificates.push(cert);
    saveStore();
    return cert;
  },

  getCertificateByCode(code: string): DbCertificate | null {
    loadStore();
    return store.certificates.find((c) => c.certificate_code === code) || null;
  },

  getAdminStats() {
    loadStore();
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

const COOKIE_NAME = 'esmiles_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

interface ApiRequest {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(data: unknown): ApiResponse;
  setHeader?(name: string, value: string): void;
}

function getBearerToken(req: ApiRequest): string | null {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

function getTokenFromCookie(req: ApiRequest): string | null {
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

function setSessionCookie(res: ApiResponse, token: string): void {
  if (typeof res.setHeader === 'function') {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly; Secure`
    );
  }
}

function clearSessionCookie(res: ApiResponse): void {
  if (typeof res.setHeader === 'function') {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure`
    );
  }
}

function formatUserResponse(u: DbUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar,
    avatarColor: u.avatar_color,
    authProvider: u.auth_provider,
    planId: u.plan_id,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at
  };
}

export async function handleApiRequest(req: ApiRequest, res: ApiResponse): Promise<void> {
  const url = req.url || '';
  const rawPathname = url.split('?')[0];
  const pathname = rawPathname.startsWith('/api') ? rawPathname : '/api' + rawPathname;
  const method = (req.method || 'GET').toUpperCase();

  const queryString = url.includes('?') ? url.split('?')[1] : '';
  const queryParams = new URLSearchParams(queryString);

  const reqBody = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

  try {
    // 1. AUTH: Google OAuth
    if (pathname === '/api/auth/google' && method === 'POST') {
      const { accessToken, credential, email, name, avatar, googleId } = reqBody;

      let resolvedEmail = typeof email === 'string' ? email : undefined;
      let resolvedName = typeof name === 'string' ? name : undefined;
      let resolvedAvatar = typeof avatar === 'string' ? avatar : undefined;
      let resolvedGoogleId = typeof googleId === 'string' ? googleId : undefined;

      if (accessToken && typeof accessToken === 'string') {
        try {
          const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (googleRes.ok) {
            const profile = (await googleRes.json()) as Record<string, string>;
            if (profile.email) {
              resolvedEmail = profile.email;
              resolvedName = profile.name || profile.given_name || resolvedName;
              resolvedAvatar = profile.picture || resolvedAvatar;
              resolvedGoogleId = profile.sub || resolvedGoogleId;
            }
          }
        } catch {}
      }

      if (!resolvedEmail && credential && typeof credential === 'string') {
        try {
          const parts = credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as Record<string, string>;
            if (payload.email) {
              resolvedEmail = payload.email;
              resolvedName = payload.name || resolvedName;
              resolvedAvatar = payload.picture || resolvedAvatar;
              resolvedGoogleId = payload.sub || resolvedGoogleId;
            }
          }
        } catch {}
      }

      if (!resolvedEmail) {
        res.status(400).json({ error: 'Không nhận được thông tin tài khoản hợp lệ từ Google!' });
        return;
      }

      let user = dbService.getUserByEmail(resolvedEmail);
      if (!user) {
        user = dbService.createUser({
          id: 'usr_g_' + Date.now(),
          name: resolvedName || 'Học Viên Google',
          email: resolvedEmail.toLowerCase().trim(),
          role: 'student',
          avatar: resolvedAvatar || 'https://lh3.googleusercontent.com/a/ACg8ocIq8=s96-c',
          avatar_color: '#0ea5e9',
          auth_provider: 'google',
          google_id: resolvedGoogleId,
          plan_id: 'pro'
        });
      } else {
        user =
          dbService.updateUser(user.id, {
            last_login_at: new Date().toISOString(),
            avatar: resolvedAvatar || user.avatar,
            name: resolvedName || user.name
          }) || user;
      }

      const session = dbService.createSession(user.id);
      setSessionCookie(res, session.token);
      res.status(200).json({
        success: true,
        token: session.token,
        user: formatUserResponse(user)
      });
      return;
    }

    // 2. AUTH: Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const email = typeof reqBody.email === 'string' ? reqBody.email.trim() : '';
      const password = typeof reqBody.password === 'string' ? reqBody.password : '';

      if (!email || !password) {
        res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu!' });
        return;
      }

      const user = dbService.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
        return;
      }

      if (user.auth_provider === 'email' && user.password_hash && user.password_salt) {
        const isValid = verifyPassword(password, user.password_hash, user.password_salt);
        if (!isValid) {
          res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
          return;
        }
      }

      const updatedUser = dbService.updateUser(user.id, { last_login_at: new Date().toISOString() }) || user;
      const session = dbService.createSession(updatedUser.id);
      setSessionCookie(res, session.token);
      res.status(200).json({
        success: true,
        token: session.token,
        user: formatUserResponse(updatedUser)
      });
      return;
    }

    // 3. AUTH: Register
    if (pathname === '/api/auth/register' && method === 'POST') {
      const name = typeof reqBody.name === 'string' ? reqBody.name.trim() : '';
      const email = typeof reqBody.email === 'string' ? reqBody.email.trim().toLowerCase() : '';
      const password = typeof reqBody.password === 'string' ? reqBody.password : '';
      const role = reqBody.role === 'admin' ? 'admin' : 'student';
      const planId = typeof reqBody.planId === 'string' ? (reqBody.planId as 'free' | 'pro' | 'enterprise') : 'free';

      if (!name || !email || !password) {
        res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu!' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự!' });
        return;
      }

      const existing = dbService.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'Email này đã được đăng ký trong hệ thống! Vui lòng đăng nhập.' });
        return;
      }

      const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
      const newUser = dbService.createUser({
        id: 'usr_' + Date.now(),
        name,
        email,
        password,
        role,
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: 'email',
        plan_id: planId
      });

      dbService.addLearningHistory({
        id: 'hist_' + Date.now(),
        user_id: newUser.id,
        action: 'registered',
        details: `Đăng ký tài khoản mới gói ${newUser.plan_id.toUpperCase()}`,
        timestamp: new Date().toISOString()
      });

      const session = dbService.createSession(newUser.id);
      setSessionCookie(res, session.token);
      res.status(201).json({
        success: true,
        token: session.token,
        user: formatUserResponse(newUser)
      });
      return;
    }

    // 4. AUTH: Me
    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = getBearerToken(req) || getTokenFromCookie(req) || queryParams.get('token');
      if (!token) {
        res.status(401).json({ error: 'Chưa đăng nhập (thiếu token)' });
        return;
      }

      const sessionData = dbService.getSessionByToken(token);
      if (!sessionData) {
        res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không tồn tại!' });
        return;
      }

      res.status(200).json({
        success: true,
        user: formatUserResponse(sessionData.user)
      });
      return;
    }

    // 5. AUTH: Logout
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = getBearerToken(req) || getTokenFromCookie(req) || (reqBody.token as string | undefined);
      if (token) {
        dbService.deleteSession(token);
      }
      clearSessionCookie(res);
      res.status(200).json({ success: true, message: 'Đăng xuất thành công' });
      return;
    }

    // 6. USERS
    if (pathname === '/api/users' && method === 'GET') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        res.status(403).json({ error: 'Không có quyền quản trị' });
        return;
      }
      const users = dbService.getAllUsers();
      res.status(200).json({ success: true, users });
      return;
    }

    if (pathname === '/api/users' && method === 'POST') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        res.status(403).json({ error: 'Không có quyền quản trị' });
        return;
      }
      const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
      const user = dbService.createUser({
        id: 'usr_' + Date.now(),
        name: (reqBody.name as string) || 'Học Viên',
        email: (reqBody.email as string) || '',
        password: (reqBody.password as string) || '123456',
        role: (reqBody.role as 'student' | 'admin' | 'instructor') || 'student',
        plan_id: (reqBody.planId as 'free' | 'pro' | 'enterprise') || 'pro',
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: 'email'
      });
      res.status(201).json({ success: true, user });
      return;
    }

    if (pathname.startsWith('/api/users/') && method === 'PATCH') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        res.status(403).json({ error: 'Không có quyền quản trị' });
        return;
      }
      const id = pathname.replace('/api/users/', '');
      const updated = dbService.updateUser(id, reqBody as Partial<DbUser>);
      res.status(200).json({ success: true, user: updated });
      return;
    }

    if (pathname.startsWith('/api/users/') && method === 'DELETE') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        res.status(403).json({ error: 'Không có quyền quản trị' });
        return;
      }
      const id = pathname.replace('/api/users/', '');
      dbService.deleteUser(id);
      res.status(200).json({ success: true });
      return;
    }

    // 7. PLANS
    if (pathname === '/api/plans' && method === 'GET') {
      const rawPlans = dbService.getAllPlans();
      const plans = rawPlans.map((p) => ({
        ...p,
        features: JSON.parse(p.features || '[]'),
        isPopular: Boolean(p.is_popular),
        isActive: Boolean(p.is_active)
      }));
      res.status(200).json({ success: true, plans });
      return;
    }

    if (pathname.startsWith('/api/plans/') && method === 'PATCH') {
      const id = pathname.replace('/api/plans/', '');
      const { features, isPopular, isActive, ...rest } = reqBody;
      const payload: Partial<DbPlan> = { ...(rest as Partial<DbPlan>) };
      if (features) payload.features = JSON.stringify(features);
      if (isPopular !== undefined) payload.is_popular = isPopular ? 1 : 0;
      if (isActive !== undefined) payload.is_active = isActive ? 1 : 0;

      const updated = dbService.updatePlan(id, payload);
      res.status(200).json({ success: true, plan: updated });
      return;
    }

    // 8. PROGRESS
    if (pathname.startsWith('/api/progress') && method === 'GET') {
      const userId = queryParams.get('userId') || pathname.split('/')[3];
      if (!userId) {
        res.status(400).json({ error: 'Thiếu userId' });
        return;
      }

      const p = dbService.getUserProgress(userId);
      if (!p) {
        res.status(200).json({
          success: true,
          progress: {
            currentLessonId: 'lesson-1',
            completedLessons: {},
            sprintExamScores: {},
            finalExam: null,
            streakDays: 1,
            lastActiveDate: new Date().toISOString().split('T')[0],
            clearedLessons: {}
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        progress: {
          currentLessonId: p.current_lesson_id,
          completedLessons: JSON.parse(p.completed_lessons || '{}'),
          sprintExamScores: JSON.parse(p.sprint_exam_scores || '{}'),
          finalExam: p.final_exam ? JSON.parse(p.final_exam) : null,
          streakDays: p.streak_days,
          lastActiveDate: p.last_active_date,
          clearedLessons: JSON.parse(p.cleared_lessons || '{}')
        }
      });
      return;
    }

    if (pathname.startsWith('/api/progress') && method === 'POST') {
      const userId = typeof reqBody.userId === 'string' ? reqBody.userId : '';
      const progress = (reqBody.progress && typeof reqBody.progress === 'object' ? reqBody.progress : {}) as Record<string, unknown>;
      if (!userId) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        return;
      }

      const dbPayload: DbProgress = {
        user_id: userId,
        current_lesson_id: (progress.currentLessonId as string) || 'lesson-1',
        completed_lessons: JSON.stringify(progress.completedLessons || {}),
        sprint_exam_scores: JSON.stringify(progress.sprintExamScores || {}),
        final_exam: progress.finalExam ? JSON.stringify(progress.finalExam) : '',
        streak_days: typeof progress.streakDays === 'number' ? progress.streakDays : 1,
        last_active_date: (progress.lastActiveDate as string) || new Date().toISOString().split('T')[0],
        cleared_lessons: JSON.stringify(progress.clearedLessons || {}),
        updated_at: new Date().toISOString()
      };

      dbService.saveUserProgress(dbPayload);
      res.status(200).json({ success: true });
      return;
    }

    // 9. EXAMS
    if (pathname === '/api/exams/submit-sprint' && method === 'POST') {
      const userId = typeof reqBody.userId === 'string' ? reqBody.userId : '';
      const sprintId = typeof reqBody.sprintId === 'number' ? reqBody.sprintId : undefined;
      const score = typeof reqBody.score === 'number' ? reqBody.score : 0;
      const passed = Boolean(reqBody.passed);

      if (!userId || sprintId === undefined) {
        res.status(400).json({ error: 'Thiếu dữ liệu bài thi sprint' });
        return;
      }

      const currentProg = dbService.getUserProgress(userId);
      let sprintScores: Record<number, unknown> = {};
      if (currentProg?.sprint_exam_scores) {
        try {
          sprintScores = JSON.parse(currentProg.sprint_exam_scores);
        } catch {}
      }
      sprintScores[sprintId] = { score, passed, completedAt: new Date().toISOString() };

      dbService.saveUserProgress({
        user_id: userId,
        current_lesson_id: currentProg?.current_lesson_id || 'lesson-1',
        completed_lessons: currentProg?.completed_lessons || '{}',
        sprint_exam_scores: JSON.stringify(sprintScores),
        final_exam: currentProg?.final_exam || '',
        streak_days: currentProg?.streak_days || 1,
        last_active_date: new Date().toISOString().split('T')[0],
        cleared_lessons: currentProg?.cleared_lessons || '{}',
        updated_at: new Date().toISOString()
      });

      dbService.addLearningHistory({
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: `sprint-${sprintId}`,
        lesson_title: `Kỳ thi Sprint 0${sprintId}`,
        action: 'sprint_passed',
        score,
        details: passed ? `Đạt chuẩn (${score}%)` : `Chưa đạt (${score}%)`,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({ success: true });
      return;
    }

    if (pathname === '/api/exams/submit-final' && method === 'POST') {
      const userId = typeof reqBody.userId === 'string' ? reqBody.userId : '';
      const studentName = typeof reqBody.studentName === 'string' ? reqBody.studentName : 'Học Viên';
      const score = typeof reqBody.score === 'number' ? reqBody.score : 0;
      const passed = Boolean(reqBody.passed);

      if (!userId) {
        res.status(400).json({ error: 'Thiếu dữ liệu thi tốt nghiệp' });
        return;
      }

      const certificateCode = 'ESM-' + Math.floor(100000 + Math.random() * 900000);
      const now = new Date().toISOString();

      if (passed) {
        dbService.issueCertificate({
          id: 'cert_' + Date.now(),
          certificate_code: certificateCode,
          user_id: userId,
          student_name: studentName,
          score,
          completed_at: now
        });
      }

      const currentProg = dbService.getUserProgress(userId);
      const finalResult = {
        score,
        passed,
        studentName,
        certificateId: certificateCode,
        completedAt: now
      };

      dbService.saveUserProgress({
        user_id: userId,
        current_lesson_id: currentProg?.current_lesson_id || 'lesson-1',
        completed_lessons: currentProg?.completed_lessons || '{}',
        sprint_exam_scores: currentProg?.sprint_exam_scores || '{}',
        final_exam: JSON.stringify(finalResult),
        streak_days: currentProg?.streak_days || 1,
        last_active_date: now.split('T')[0],
        cleared_lessons: currentProg?.cleared_lessons || '{}',
        updated_at: now
      });

      dbService.addLearningHistory({
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: 'final-exam',
        lesson_title: 'Thi Tốt Nghiệp Toàn Khóa Master NestJS',
        action: 'final_certified',
        score,
        details: `Cấp chứng chỉ ${certificateCode} (${score}%)`,
        timestamp: now
      });

      res.status(200).json({
        success: true,
        certificateCode,
        finalResult
      });
      return;
    }

    // 10. HISTORY
    if (pathname === '/api/history' && method === 'GET') {
      const userId = queryParams.get('userId') || undefined;
      const history = dbService.getLearningHistory(userId);
      res.status(200).json({ success: true, history });
      return;
    }

    if (pathname === '/api/history' && method === 'POST') {
      const userId = typeof reqBody.userId === 'string' ? reqBody.userId : '';
      const lessonId = typeof reqBody.lessonId === 'string' ? reqBody.lessonId : undefined;
      const lessonTitle = typeof reqBody.lessonTitle === 'string' ? reqBody.lessonTitle : undefined;
      const action = typeof reqBody.action === 'string' ? reqBody.action : 'activity';
      const score = typeof reqBody.score === 'number' ? reqBody.score : undefined;
      const details = typeof reqBody.details === 'string' ? reqBody.details : undefined;

      const newRecord: DbHistory = {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: lessonId,
        lesson_title: lessonTitle,
        action,
        score,
        details,
        timestamp: new Date().toISOString()
      };
      dbService.addLearningHistory(newRecord);
      res.status(201).json({ success: true, record: newRecord });
      return;
    }

    // 11. STATS
    if (pathname === '/api/admin/stats' && method === 'GET') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        res.status(403).json({ error: 'Không có quyền quản trị' });
        return;
      }
      const stats = dbService.getAdminStats();
      res.status(200).json({ success: true, stats });
      return;
    }

    res.status(404).json({ error: 'API route not found' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lỗi xử lý máy chủ';
    res.status(500).json({ error: msg });
  }
}

interface VercelRequest {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  statusCode?: number;
  status(code: number): VercelResponse;
  json(data: unknown): VercelResponse;
  setHeader?(name: string, value: string): void;
  end(data?: string): void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let statusCode = 200;
  const resAdapter: ApiResponse = {
    status(code: number) {
      statusCode = code;
      if (typeof res.status === 'function') {
        res.status(code);
      } else {
        res.statusCode = code;
      }
      return this;
    },
    json(data: unknown) {
      if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      if (typeof res.status === 'function' && typeof res.json === 'function') {
        res.status(statusCode).json(data);
        return this;
      }
      res.statusCode = statusCode;
      res.end(JSON.stringify(data));
      return this;
    },
    setHeader(name: string, value: string) {
      if (typeof res.setHeader === 'function') {
        res.setHeader(name, value);
      }
    }
  };

  const rawUrl = req.url || '';
  const normalizedUrl = rawUrl.startsWith('/api') ? rawUrl : '/api' + rawUrl;

  let parsedBody = req.body;
  if (typeof parsedBody === 'string' && parsedBody.trim().startsWith('{')) {
    try {
      parsedBody = JSON.parse(parsedBody);
    } catch {}
  }

  await handleApiRequest(
    {
      method: req.method,
      url: normalizedUrl,
      body: parsedBody,
      headers: req.headers
    },
    resAdapter
  );
}
