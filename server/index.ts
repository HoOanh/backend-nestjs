import {
  defaultRetention,
  validatePolicy,
  cleanupPreview,
  archiveLogs,
  listArchives,
  readArchive,
  purgeArchive,
  logTables,
  type RetentionPolicy,
  type LogTable
} from './data-operations.ts';
import {
  DEFAULT_MODEL,
  SYSTEM_PROMPT,
  PROMPT_VERSION
} from './tutor-config.ts';
import fs from 'fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuditRecord } from '../src/types/audit.ts';
import path from 'path';
import crypto from 'crypto';
import type { ChatSession, ChatMessage, ChatLog } from '../src/types/chat.ts';

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
  status?: 'active' | 'suspended';
  version?: number;
  auth_version?: number;
  data_origin?: 'real' | 'test';
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
  score: number | null;
  completed_at: string;
  type?: 'exam' | 'manual' | 'honorary';
  status?: 'issued' | 'revoked';
  issued_by?: string;
  reason?: string;
  revoked_at?: string;
  revoked_by?: string;
  revoke_reason?: string;
  idempotency_key?: string;
}

export function hashPassword(
  password: string,
  salt?: string
): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, generatedSalt, 10000, 64, 'sha512')
    .toString('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  const check = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return check === hash;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

loadLocalEnv();
function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (configured) {
    if (configured.length < 32)
      throw new Error('JWT_SECRET phải có ít nhất 32 ký tự');
    return configured;
  }
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === 'production'
  )
    throw new Error(
      'Production yêu cầu JWT_SECRET riêng, không có khóa mặc định'
    );
  const directory = path.resolve(process.cwd(), 'data');
  fs.mkdirSync(directory, { recursive: true });
  const location = path.join(directory, 'auth-secret.local');
  if (!fs.existsSync(location)) {
    try {
      fs.writeFileSync(location, crypto.randomBytes(48).toString('hex'), {
        mode: 0o600,
        flag: 'wx'
      });
    } catch (error) {
      if (!fs.existsSync(location)) throw error;
    }
  }
  return fs.readFileSync(location, 'utf-8').trim();
}
const JWT_SECRET = resolveJwtSecret();

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'student' | 'admin' | 'instructor';
  name: string;
  planId: string;
  exp: number;
  authVersion?: number;
}

export function signJwt(user: DbUser, expiresInDays = 30): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    planId: user.plan_id,
    exp,
    authVersion: user.auth_version || 0
  };
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    )
      return null;
    if (JSON.parse(Buffer.from(header, 'base64url').toString()).alg !== 'HS256')
      return null;
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf-8')
    ) as TokenPayload;
    if (
      !Number.isFinite(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

interface Entitlement {
  id: string;
  user_id: string;
  scope: string;
  issued_by: string;
  reason: string;
  created_at: string;
  idempotency_key: string;
}
interface StoreState {
  retention?: RetentionPolicy;
  entitlements: Entitlement[];
  audit_logs: AuditRecord[];
  chat_sessions: ChatSession[];
  chat_messages: ChatMessage[];
  chat_logs: Array<ChatLog & { userId: string }>;
  users: DbUser[];
  sessions: DbSession[];
  revoked_tokens?: string[];
  plans: DbPlan[];
  user_progress: DbProgress[];
  learning_history: DbHistory[];
  certificates: DbCertificate[];
}

function getStoreFilePath(): string {
  if (process.env.ARC_STORE_PATH) {
    const location = path.resolve(process.env.ARC_STORE_PATH);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    return location;
  }
  const isVercel = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
  if (isVercel) {
    return '/tmp/arc_irobot_store.json';
  }
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {}
  }
  return path.join(dataDir, 'arc_irobot_store.json');
}

let store: StoreState = {
  entitlements: [],
  audit_logs: [],
  chat_sessions: [],
  chat_messages: [],
  chat_logs: [],
  users: [],
  sessions: [],
  revoked_tokens: [],
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
        store = {
          entitlements: [],
          audit_logs: [],
          chat_sessions: [],
          chat_messages: [],
          chat_logs: [],
          ...JSON.parse(raw)
        };
      }
    }
  } catch (error) {
    throw new Error(
      `Không đọc được dữ liệu server: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

const auditedTables = [
  'users',
  'plans',
  'user_progress',
  'learning_history',
  'certificates',
  'chat_sessions',
  'chat_messages',
  'entitlements'
] as const;
interface AuditContext {
  requestId: string;
  actor: AuditRecord['actor'];
  method: string;
  path: string;
  userAgent?: string;
  startedAt: number;
  errorStack?: string;
  baseline: Record<string, Array<Record<string, unknown>>>;
}
const auditContext = new AsyncLocalStorage<AuditContext>();

function redactAudit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAudit);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /password|salt|token|secret|credential|api.?key|^image$|^image_data$/i.test(
          key
        )
          ? '[REDACTED]'
          : redactAudit(item)
      ])
    );
  }
  return value;
}

function auditSnapshot(): AuditContext['baseline'] {
  return Object.fromEntries(
    auditedTables.map((table) => [
      table,
      JSON.parse(JSON.stringify(store[table]))
    ])
  );
}

function auditBase(
  context: AuditContext
): Omit<
  AuditRecord,
  | 'action'
  | 'entity'
  | 'before'
  | 'after'
  | 'changedFields'
  | 'outcome'
  | 'status'
> {
  return {
    id: crypto.randomUUID(),
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
    actor: context.actor,
    method: context.method,
    path: context.path,
    userAgent: context.userAgent,
    durationMs: Date.now() - context.startedAt,
    schemaVersion: 2,
    source: context.actor ? 'user' : 'anonymous',
    operation: `${context.method} ${context.path}`
  };
}

function appendChangeEvidence(context: AuditContext): void {
  const current = auditSnapshot();
  // Compare each write to the last persisted state, never a stale request-start snapshot.
  const filePath = getStoreFilePath();
  const persisted = fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>)
    : {};
  context.baseline = Object.fromEntries(
    auditedTables.map((table) => [
      table,
      (persisted[table] || []) as Array<Record<string, unknown>>
    ])
  );
  for (const table of auditedTables) {
    const key = table === 'user_progress' ? 'user_id' : 'id';
    const previousRows = new Map(
      context.baseline[table].map((row) => [String(row[key]), row])
    );
    const currentRows = new Map(
      current[table].map((row) => [String(row[key]), row])
    );
    for (const id of new Set([...previousRows.keys(), ...currentRows.keys()])) {
      const before = previousRows.get(id);
      const after = currentRows.get(id);
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      const changedFields = [
        ...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
      ].filter(
        (field) =>
          JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])
      );
      store.audit_logs.push({
        ...auditBase(context),
        action: !before ? 'CREATE' : !after ? 'DELETE' : 'UPDATE',
        entity: table,
        entityId: id,
        before: redactAudit(before ?? null),
        after: redactAudit(after ?? null),
        changedFields,
        outcome: 'PERSISTED',
        status: null
      });
    }
  }
  context.baseline = current;
}

function saveStore(): void {
  const context = auditContext.getStore();
  if (context) appendChangeEvidence(context);
  const filePath = getStoreFilePath();
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(temporaryPath, filePath);
}

function operationsEvidence(
  operation: string,
  before: unknown,
  after: unknown
): void {
  const context = auditContext.getStore();
  store.audit_logs.push({
    id: crypto.randomUUID(),
    requestId: context?.requestId || crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor: context?.actor || null,
    source: context ? 'user' : 'system',
    schemaVersion: 2,
    operation,
    method: context?.method || 'SYSTEM',
    path: context?.path || '/system/retention',
    action: 'UPDATE',
    entity: 'data_operations',
    before,
    after,
    changedFields: [operation],
    outcome: 'PERSISTED',
    status: null,
    durationMs: 0
  });
}
function runRetention(): void {
  const policy = store.retention || defaultRetention;
  if (
    !policy.enabled ||
    (policy.lastRunAt && Date.now() - Date.parse(policy.lastRunAt) < 86400000)
  )
    return;
  for (const table of logTables) {
    const days = table === 'chat_logs' ? policy.chatDays : policy.auditDays;
    const before = new Date(Date.now() - days * 86400000).toISOString();
    const result = archiveLogs(
      store,
      getStoreFilePath(),
      table,
      before,
      'Tự động theo cấu hình retention'
    );
    if (result.count) operationsEvidence('retention.archive', null, result);
  }
  store.retention = { ...policy, lastRunAt: new Date().toISOString() };
  saveStore();
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
      description:
        'Dành cho học viên bắt đầu tìm hiểu tư duy Backend & NestJS nền tảng.',
      features: JSON.stringify([
        'Truy cập Sprint 0 (Mental Model & Event Loop)',
        'Thực hành Code Sandbox tương tác',
        'Khảo thí trắc nghiệm cơ bản',
        'Cộng đồng kỹ sư Arc Irobot Open'
      ]),
      is_popular: 0,
      is_active: 1
    },
    {
      id: 'pro',
      name: 'Gói Chuyên Nghiệp (Pro Master)',
      price: 690000,
      billing_period: 'Thanh toán 1 lần / Trọn đời',
      description:
        'Lộ trình chuyển đổi toàn diện thành Backend / Fullstack Engineer chuyên nghiệp.',
      features: JSON.stringify([
        'Toàn bộ 6 Sprints chuyên sâu từ Sprint 0 đến Sprint 5',
        'Master Prisma 7, High-Concurrency & Multi-Tenancy Scoping',
        'AI Gia Sư 1-1 (Gemini 2.5 Flash) hướng dẫn giải bài tập',
        'Tham gia 4 kỳ thi Sprint + Thi Tốt Nghiệp Toàn Khóa',
        'Cấp Chứng Chỉ Tốt Nghiệp Danh Dự Arc Irobot Academy có mã tra cứu'
      ]),
      is_popular: 1,
      is_active: 1
    },
    {
      id: 'enterprise',
      name: 'Gói Doanh Nghiệp (Enterprise Team)',
      price: 2490000,
      billing_period: 'Theo nhóm 5 thành viên',
      description:
        'Đào tạo đội ngũ Frontend chuyển đổi Fullstack NestJS theo chuẩn doanh nghiệp.',
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

function loadLocalEnv(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (val && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {}
}

loadLocalEnv();

export function bootstrapAdmin(): void {
  loadLocalEnv();
  loadStore();

  // Initialization only: never overwrite an existing account or recreate one per request.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || store.users.length) return;
  const credentials = hashPassword(password);
  const now = new Date().toISOString();
  store.users.push({
    id: crypto.randomUUID(),
    name: 'System Administrator',
    email,
    password_hash: credentials.hash,
    password_salt: credentials.salt,
    role: 'admin',
    auth_provider: 'email',
    plan_id: 'enterprise',
    avatar_color: '#f59e0b',
    created_at: now,
    last_login_at: now,
    version: 1,
    status: 'active'
  });
  saveStore();
}

bootstrapAdmin();

export const dbService = {
  createSession(userId: string): DbSession {
    loadStore();
    const user = store.users.find((u) => u.id === userId);
    const token = user ? signJwt(user) : generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
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

    if (store.revoked_tokens && store.revoked_tokens.includes(token)) {
      return null;
    }

    // 1. Check Stateless Cryptographic JWT Token (Resilient against cold starts & multiple lambdas)
    const payload = verifyJwt(token);
    if (payload) {
      const user = store.users.find((u) => u.id === payload.userId);
      return !user ||
        user.status === 'suspended' ||
        (payload.authVersion || 0) !== (user.auth_version || 0)
        ? null
        : user;
    }

    // 2. Fallback to session store for legacy tokens
    const session = store.sessions.find(
      (s) => s.token === token && new Date(s.expires_at) > new Date()
    );
    if (session) {
      return (
        store.users.find(
          (u) => u.id === session.user_id && u.status !== 'suspended'
        ) || null
      );
    }

    return null;
  },

  getSessionByToken(
    token: string
  ): { session: DbSession; user: DbUser } | null {
    const user = this.getAuthUser(token);
    if (!user) return null;
    return {
      session: {
        id: 'sess_jwt',
        user_id: user.id,
        token,
        created_at: user.created_at,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString()
      },
      user
    };
  },

  deleteSession(token: string): boolean {
    loadStore();
    store.sessions = store.sessions.filter((s) => s.token !== token);
    if (!store.revoked_tokens) store.revoked_tokens = [];
    if (!store.revoked_tokens.includes(token)) {
      store.revoked_tokens.push(token);
    }
    saveStore();
    return true;
  },

  getAllUsers(): DbUser[] {
    loadStore();
    return [...store.users].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  },

  getUserByEmail(email: string): DbUser | null {
    loadStore();
    return (
      store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ||
      null
    );
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
    data_origin?: 'real' | 'test';
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
      data_origin: user.data_origin,
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
    store.users[idx] = {
      ...store.users[idx],
      data_origin: isTestUser(store.users[idx]) ? 'test' : 'real',
      ...updates
    };
    saveStore();
    return store.users[idx];
  },

  deleteUser(id: string): boolean {
    loadStore();
    const chatSessionIds = new Set(
      store.chat_sessions.filter((s) => s.userId === id).map((s) => s.id)
    );
    store.chat_sessions = store.chat_sessions.filter((s) => s.userId !== id);
    store.chat_messages = store.chat_messages.filter(
      (m) => !chatSessionIds.has(m.sessionId)
    );
    store.chat_logs = store.chat_logs.filter((l) => l.userId !== id);
    store.users = store.users.filter((u) => u.id !== id);
    store.sessions = store.sessions.filter((s) => s.user_id !== id);
    store.user_progress = store.user_progress.filter((p) => p.user_id !== id);
    store.learning_history = store.learning_history.filter(
      (h) => h.user_id !== id
    );
    store.certificates = store.certificates.filter((c) => c.user_id !== id);
    store.entitlements = store.entitlements.filter((e) => e.user_id !== id);
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
    const idx = store.user_progress.findIndex(
      (p) => p.user_id === progress.user_id
    );
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
    const realIds = new Set(
      store.users
        .filter(
          (u) => u.role === 'student' && !formatUserResponse(u).isTestAccount
        )
        .map((u) => u.id)
    );
    const userCount = realIds.size;
    const historyCount = store.learning_history.filter((h) =>
      realIds.has(h.user_id)
    ).length;
    const certCount = new Set(
      store.certificates
        .filter((c) => c.status !== 'revoked' && realIds.has(c.user_id))
        .map((c) => c.user_id)
    ).size;

    return {
      totalUsers: userCount,
      totalRevenue: null,
      certifiedStudents: certCount,
      totalActivityLogs: historyCount
    };
  }
};

const COOKIE_NAME = 'arc_session';
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
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`)
  );
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

function isTestUser(u: DbUser): boolean {
  if (u.data_origin) return u.data_origin === 'test';
  return (
    (/^testgoogle_\d+@gmail\.com$/.test(u.email) &&
      u.name === 'Test Google Student') ||
    (/^testreg_\d+@arc-irobot\.tech$/.test(u.email) &&
      u.name === 'Kỹ Sư E2E Test')
  );
}
function formatUserResponse(u: DbUser) {
  return {
    id: u.id,
    status: u.status || 'active',
    version: u.version || 1,
    dataOrigin: isTestUser(u) ? 'test' : 'real',
    isTestAccount: isTestUser(u),
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

export function authorizeTutorRequest(
  headers: ApiRequest['headers'],
  sessionId?: string
): 401 | 403 | null {
  const request = { headers };
  const token = getBearerToken(request) || getTokenFromCookie(request);
  const actor = token ? dbService.getAuthUser(token) : null;
  if (!actor) return 401;
  if (sessionId) {
    loadStore();
    const session = store.chat_sessions.find((s) => s.id === sessionId);
    if (!session || (session.userId !== actor.id && actor.role !== 'admin'))
      return 403;
  }
  return null;
}

export function recordTutorTrace(
  headers: ApiRequest['headers'],
  sessionId: string | undefined,
  level: ChatLog['level'],
  event: string,
  metadata: Record<string, unknown>
): void {
  try {
    const req = { headers };
    const token = getBearerToken(req) || getTokenFromCookie(req);
    const actor = token ? dbService.getSessionByToken(token)?.user : undefined;
    if (!actor) return;
    loadStore();
    const owned = store.chat_sessions.find(
      (s) => s.id === sessionId && s.userId === actor.id
    );
    store.chat_logs.push({
      id: crypto.randomUUID(),
      userId: actor.id,
      sessionId: owned?.id,
      lessonId: owned?.lessonId,
      level,
      event,
      message: event,
      metadata,
      timestamp: new Date().toISOString()
    });
    saveStore();
  } catch (error) {
    console.error('Không lưu được trace AI:', error);
  }
}

export async function handleApiRequest(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  const requestId = crypto.randomUUID();
  res.setHeader?.('X-Request-ID', requestId);
  let status = 200;
  let errorMessage: string | undefined;
  try {
    loadStore();
    runRetention();
    const token = getBearerToken(req) || getTokenFromCookie(req);
    const user = token ? dbService.getSessionByToken(token)?.user : undefined;
    const context: AuditContext = {
      requestId,
      actor: user
        ? { id: user.id, name: user.name, email: user.email, role: user.role }
        : null,
      method,
      path: (req.url || '').split('?')[0],
      userAgent:
        typeof req.headers?.['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
      startedAt: Date.now(),
      baseline: auditSnapshot()
    };
    const wrapped: ApiResponse = {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        const data =
          payload && typeof payload === 'object'
            ? (payload as Record<string, unknown>)
            : {};
        if (typeof data.error === 'string') errorMessage = data.error;
        // A successful login/register establishes identity using the authenticated server response.
        if (
          !context.actor &&
          status < 400 &&
          context.path.startsWith('/api/auth/') &&
          data.user
        ) {
          const authenticated = data.user as DbUser;
          context.actor = {
            id: authenticated.id,
            name: authenticated.name,
            email: authenticated.email,
            role: authenticated.role
          };
        }
        if (method !== 'GET' || status >= 400) {
          loadStore();
          if (context.actor) {
            for (const entry of store.audit_logs)
              if (entry.requestId === context.requestId && !entry.actor) {
                entry.actor = context.actor;
                entry.source = 'user';
              }
          }
          store.audit_logs.push({
            ...auditBase(context),
            action: 'REQUEST',
            entity: 'request',
            before: null,
            after: null,
            changedFields: [],
            outcome: status >= 400 ? 'FAILURE' : 'SUCCESS',
            status,
            error: errorMessage,
            errorStack: context.errorStack,
            requestBody: redactAudit(req.body ?? null)
          });
          saveStore();
        }
        res.status(status).json(payload);
        return this;
      },
      setHeader(name, value) {
        res.setHeader?.(name, value);
      }
    };
    await auditContext.run(context, () => handleApiRequestInner(req, wrapped));
  } catch (error: unknown) {
    res.status(500).json({
      error: `Không xử lý được request ${requestId}: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function handleApiRequestInner(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  loadStore();
  const url = req.url || '';
  const rawPathname = url.split('?')[0];
  const pathname = rawPathname.startsWith('/api')
    ? rawPathname
    : '/api' + rawPathname;
  const method = (req.method || 'GET').toUpperCase();

  const queryString = url.includes('?') ? url.split('?')[1] : '';
  const queryParams = new URLSearchParams(queryString);

  const reqBody = (
    req.body && typeof req.body === 'object' ? req.body : {}
  ) as Record<string, unknown>;

  try {
    if (pathname.startsWith('/api/certificates/verify/') && method === 'GET') {
      const cert = dbService.getCertificateByCode(
        decodeURIComponent(pathname.split('/').pop() || '')
      );
      if (!cert) {
        res.status(404).json({ error: 'Không tìm thấy chứng chỉ' });
        return;
      }
      res.status(200).json({
        code: cert.certificate_code,
        studentName: cert.student_name,
        type: cert.type || 'exam',
        status: cert.status || 'issued',
        issuedAt: cert.completed_at
      });
      return;
    }
    if (
      pathname.startsWith('/api/chat/') ||
      pathname.startsWith('/api/admin/')
    ) {
      const token = getBearerToken(req) || getTokenFromCookie(req);
      const session = token ? dbService.getSessionByToken(token) : null;
      if (!session) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const actor = session.user;
      const isAdmin = actor.role === 'admin';
      loadStore();
      if (pathname.startsWith('/api/admin/')) {
        if (!isAdmin) {
          res.status(403).json({ error: 'Không có quyền quản trị' });
          return;
        }

        if (pathname === '/api/admin/data-operations') {
          const action = reqBody.action;
          const reason =
            typeof reqBody.reason === 'string' ? reqBody.reason.trim() : '';
          const policy = store.retention || defaultRetention;
          if (method === 'GET') {
            res.status(200).json({
              policy,
              archives: listArchives(getStoreFilePath()),
              scheduler:
                'Kiểm tra mỗi 24 giờ khi có request; không chạy khi server ngừng hoạt động.'
            });
            return;
          }
          if (method !== 'POST') {
            res.status(405).json({ error: 'Phương thức không hợp lệ' });
            return;
          }
          if (action === 'preview' || action === 'cleanup') {
            const table = reqBody.table as LogTable;
            const before = String(reqBody.before || '');
            const minDays = table === 'audit_logs' ? 365 : 1;
            if (
              !logTables.includes(table) ||
              !Number.isFinite(Date.parse(before)) ||
              Date.parse(before) > Date.now() - minDays * 86400000
            ) {
              res.status(400).json({
                error: 'Chỉ dọn trace cũ hơn 1 ngày hoặc audit cũ hơn 365 ngày'
              });
              return;
            }
            const preview = cleanupPreview(store, table, before);
            if (action === 'preview') {
              res.status(200).json(preview);
              return;
            }
            if (reason.length < 5) {
              res.status(400).json({ error: 'Cần lý do ít nhất 5 ký tự' });
              return;
            }
            if (reqBody.fingerprint !== preview.fingerprint) {
              res
                .status(409)
                .json({ error: 'Dữ liệu đã đổi, hãy xem trước lại' });
              return;
            }
            const result = archiveLogs(
              store,
              getStoreFilePath(),
              table,
              before,
              reason
            );
            operationsEvidence('manual.archive', null, { ...result, reason });
            saveStore();
            res.status(200).json(result);
            return;
          }
          if (reason.length < 5) {
            res.status(400).json({ error: 'Cần lý do ít nhất 5 ký tự' });
            return;
          }
          if (action === 'policy') {
            if (!validatePolicy(reqBody)) {
              res.status(400).json({
                error:
                  'Trace 1–3650 ngày; audit 365–3650 ngày; enabled phải là boolean'
              });
              return;
            }
            store.retention = {
              enabled: reqBody.enabled as boolean,
              chatDays: Number(reqBody.chatDays),
              auditDays: Number(reqBody.auditDays),
              lastRunAt: null
            };
            operationsEvidence('retention.policy', policy, {
              ...store.retention,
              reason
            });
            saveStore();
            res.status(200).json({ policy: store.retention });
            return;
          }
          if (action === 'purge') {
            const archiveId = String(reqBody.archiveId || '');
            const archive = listArchives(getStoreFilePath()).find(
              (item) => item.id === archiveId
            );
            if (
              !archive ||
              reqBody.confirmId !== archiveId ||
              reqBody.fingerprint !== archive.fingerprint
            ) {
              res
                .status(409)
                .json({
                  error: 'Nhập đúng mã bản lưu và tải lại nếu dữ liệu đã đổi'
                });
              return;
            }
            // Write intent before irreversible removal; the REQUEST event records final success/failure.
            operationsEvidence('archive.purge.requested', archive, { reason });
            saveStore();
            purgeArchive(getStoreFilePath(), archiveId, archive.fingerprint);
            res
              .status(200)
              .json({ count: archive.count, freedBytes: archive.bytes });
            return;
          }
          if (action === 'restore') {
            let archive;
            try {
              archive = readArchive(
                getStoreFilePath(),
                String(reqBody.archiveId || '')
              );
            } catch (error) {
              res.status(400).json({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Không đọc được bản lưu'
              });
              return;
            }
            const existing = new Set(store[archive.table].map((row) => row.id));
            const missing = archive.rows.filter((row) => !existing.has(row.id));
            if (archive.table === 'audit_logs')
              store.audit_logs.push(...(missing as AuditRecord[]));
            else
              store.chat_logs.push(
                ...(missing as Array<ChatLog & { userId: string }>)
              );
            store[archive.table].sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            );
            // Disable automation so restored old evidence is not archived again on the next request.
            store.retention = { ...policy, enabled: false };
            operationsEvidence('archive.restore', null, {
              archiveId: reqBody.archiveId,
              count: missing.length,
              reason,
              automationDisabled: true
            });
            saveStore();
            res.status(200).json({ count: missing.length });
            return;
          }
          res.status(400).json({ error: 'Thao tác không hợp lệ' });
          return;
        }
        if (pathname === '/api/admin/exports' && method === 'POST') {
          const kind = reqBody.kind;
          const origin = reqBody.origin || 'real';
          const query = String(reqBody.q || '').toLowerCase();
          const from = String(reqBody.from || '');
          const to = String(reqBody.to || '');
          if (
            !['users', 'logs', 'audit'].includes(String(kind)) ||
            !['real', 'test', 'all'].includes(String(origin)) ||
            (from && to && from > to)
          ) {
            res.status(400).json({ error: 'Bộ lọc xuất không hợp lệ' });
            return;
          }
          const selectedUsers = store.users.filter(
            (u) =>
              origin === 'all' ||
              (origin === 'test' ? isTestUser(u) : !isTestUser(u))
          );
          const ids = new Set(selectedUsers.map((u) => u.id));
          let rows: unknown[] = [];
          if (kind === 'users')
            rows = selectedUsers
              .filter(
                (u) =>
                  (!reqBody.role || u.role === reqBody.role) &&
                  `${u.name} ${u.email}`.toLowerCase().includes(query)
              )
              .map(formatUserResponse);
          if (kind === 'logs')
            rows = store.learning_history.filter(
              (h) =>
                ids.has(h.user_id) &&
                (!reqBody.action || h.action === reqBody.action) &&
                (!from || h.timestamp.slice(0, 10) >= from) &&
                (!to || h.timestamp.slice(0, 10) <= to) &&
                `${store.users.find((u) => u.id === h.user_id)?.name} ${store.users.find((u) => u.id === h.user_id)?.email} ${h.lesson_title} ${h.details}`
                  .toLowerCase()
                  .includes(query)
            );
          if (kind === 'audit')
            rows = store.audit_logs.filter(
              (e) =>
                (!reqBody.requestId || e.requestId === reqBody.requestId) &&
                (!reqBody.entityId || e.entityId === reqBody.entityId) &&
                (!reqBody.entity || e.entity === reqBody.entity) &&
                (!reqBody.outcome || e.outcome === reqBody.outcome) &&
                (!reqBody.actorSearch ||
                  `${e.actor?.name} ${e.actor?.email}`
                    .toLowerCase()
                    .includes(String(reqBody.actorSearch).toLowerCase())) &&
                (!from || e.timestamp >= from) &&
                (!to || e.timestamp <= to)
            );
          if (kind === 'audit') {
            const matchedIds = new Set(
              (rows as AuditRecord[]).map((e) => e.requestId)
            );
            const grouped = new Map<string, AuditRecord[]>();
            for (const e of store.audit_logs)
              if (matchedIds.has(e.requestId))
                grouped.set(e.requestId, [
                  ...(grouped.get(e.requestId) || []),
                  e
                ]);
            rows = Array.from(grouped.values())
              .filter(
                (events) =>
                  reqBody.technical === 'true' ||
                  events.some(
                    (e) =>
                      e.outcome === 'FAILURE' ||
                      e.changedFields.some(
                        (field) =>
                          !['updated_at', 'last_login_at'].includes(field)
                      ) ||
                      e.path.includes('/auth/') ||
                      (e.method !== 'GET' && e.path.startsWith('/api/admin/'))
                  )
              )
              .flat();
          }
          if (rows.length > 10000) {
            res.status(400).json({
              error: 'Tối đa 10.000 bản ghi mỗi lần xuất. Hãy thu hẹp bộ lọc'
            });
            return;
          }
          res.status(200).json({
            rows: redactAudit(rows),
            count: rows.length,
            generatedAt: new Date().toISOString(),
            requestId: auditContext.getStore()?.requestId
          });
          return;
        }
        if (pathname === '/api/admin/stats' && method === 'GET') {
          res
            .status(200)
            .json({ success: true, stats: dbService.getAdminStats() });
          return;
        }
        if (pathname === '/api/admin/certificates' && method === 'GET') {
          res.status(200).json({ certificates: store.certificates });
          return;
        }
        if (pathname === '/api/admin/certificates' && method === 'POST') {
          const user = store.users.find((u) => u.id === reqBody.userId);
          if (!user || user.role !== 'student' || user.status === 'suspended') {
            res
              .status(400)
              .json({ error: 'Chỉ cấp chứng chỉ cho học viên đang hoạt động' });
            return;
          }
          if (
            !['manual', 'honorary'].includes(String(reqBody.type)) ||
            typeof reqBody.reason !== 'string' ||
            reqBody.reason.trim().length < 5 ||
            typeof reqBody.idempotencyKey !== 'string' ||
            !reqBody.idempotencyKey
          ) {
            res.status(400).json({
              error:
                'Cần loại chứng chỉ, lý do ít nhất 5 ký tự và mã chống trùng'
            });
            return;
          }
          const duplicate = store.certificates.find(
            (c) => c.idempotency_key === reqBody.idempotencyKey
          );
          if (duplicate) {
            if (
              duplicate.user_id !== user.id ||
              duplicate.type !== reqBody.type ||
              duplicate.reason !== reqBody.reason.trim()
            ) {
              res
                .status(409)
                .json({ error: 'Mã chống trùng đã dùng cho nội dung khác' });
              return;
            }
            res.status(200).json({ certificate: duplicate });
            return;
          }
          const now = new Date().toISOString();
          const certificate: DbCertificate = {
            id: crypto.randomUUID(),
            certificate_code:
              'ARC-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
            user_id: user.id,
            student_name: user.name,
            score: null,
            completed_at: now,
            type: reqBody.type as 'manual' | 'honorary',
            status: 'issued',
            issued_by: actor.id,
            reason: reqBody.reason.trim(),
            idempotency_key: reqBody.idempotencyKey
          };
          store.certificates.push(certificate);
          store.learning_history.push({
            id: crypto.randomUUID(),
            user_id: user.id,
            action: 'certificate_issued',
            lesson_title: 'Chứng chỉ cấp thủ công',
            details: `${certificate.certificate_code} · ${certificate.type} · ${certificate.reason}`,
            timestamp: now
          });
          saveStore();
          res.status(201).json({ certificate });
          return;
        }
        if (
          /^\/api\/admin\/certificates\/[^/]+\/revoke$/.test(pathname) &&
          method === 'POST'
        ) {
          const certificate = store.certificates.find(
            (c) => c.id === pathname.split('/')[4]
          );
          if (!certificate) {
            res.status(404).json({ error: 'Không tìm thấy chứng chỉ' });
            return;
          }
          if (
            typeof reqBody.reason !== 'string' ||
            reqBody.reason.trim().length < 5
          ) {
            res
              .status(400)
              .json({ error: 'Cần lý do thu hồi ít nhất 5 ký tự' });
            return;
          }
          if (certificate.status !== 'revoked') {
            certificate.status = 'revoked';
            certificate.revoked_at = new Date().toISOString();
            certificate.revoked_by = actor.id;
            certificate.revoke_reason = reqBody.reason.trim();
            saveStore();
          }
          res.status(200).json({ certificate });
          return;
        }
        if (
          /^\/api\/admin\/users\/[^/]+\/(suspend|restore|entitlements)$/.test(
            pathname
          ) &&
          method === 'POST'
        ) {
          const user = store.users.find((u) => u.id === pathname.split('/')[4]);
          const command = pathname.split('/')[5];
          if (!user) {
            res.status(404).json({ error: 'Không tìm thấy tài khoản' });
            return;
          }
          if (
            typeof reqBody.reason !== 'string' ||
            reqBody.reason.trim().length < 5
          ) {
            res.status(400).json({ error: 'Cần lý do ít nhất 5 ký tự' });
            return;
          }
          if (user.id === actor.id || user.role !== 'student') {
            res.status(409).json({ error: 'Tác vụ này chỉ dành cho học viên' });
            return;
          }
          if (
            reqBody.expectedVersion !== undefined &&
            reqBody.expectedVersion !== (user.version || 1)
          ) {
            res
              .status(409)
              .json({ error: 'Tài khoản đã thay đổi. Hãy tải lại' });
            return;
          }
          if (command === 'entitlements') {
            if (
              typeof reqBody.idempotencyKey !== 'string' ||
              !reqBody.idempotencyKey
            ) {
              res.status(400).json({ error: 'Thiếu mã chống trùng' });
              return;
            }
            const duplicate = store.entitlements.find(
              (e) => e.idempotency_key === reqBody.idempotencyKey
            );
            if (
              duplicate &&
              (duplicate.user_id !== user.id ||
                duplicate.reason !== reqBody.reason.trim())
            ) {
              res
                .status(409)
                .json({ error: 'Mã chống trùng đã dùng cho học viên khác' });
              return;
            }
            if (!duplicate) {
              store.entitlements.push({
                id: crypto.randomUUID(),
                user_id: user.id,
                scope: 'course',
                issued_by: actor.id,
                reason: reqBody.reason.trim(),
                created_at: new Date().toISOString(),
                idempotency_key: reqBody.idempotencyKey
              });
              saveStore();
            }
          } else {
            if (command === 'suspend') {
              user.auth_version = (user.auth_version || 0) + 1;
              store.sessions = store.sessions.filter(
                (session) => session.user_id !== user.id
              );
            }
            user.status = command === 'suspend' ? 'suspended' : 'active';
            user.version = (user.version || 1) + 1;
            saveStore();
          }
          res.status(200).json({ success: true });
          return;
        }
        if (
          pathname.startsWith('/api/admin/') &&
          ![
            '/api/admin/audit',
            '/api/admin/ai',
            '/api/admin/database'
          ].includes(pathname)
        ) {
          res.status(404).json({ error: 'Không tìm thấy chức năng quản trị' });
          return;
        }
        if (pathname === '/api/admin/audit') {
          if (method !== 'GET') {
            res.status(405).json({ error: 'Audit trail chỉ cho phép đọc' });
            return;
          }
          const actorId = queryParams.get('actorId');
          const requestId = queryParams.get('requestId');
          const entity = queryParams.get('entity');
          const entityId = queryParams.get('entityId');
          const outcome = queryParams.get('outcome');
          const from = queryParams.get('from');
          const to = queryParams.get('to');
          const offset = Math.max(0, Number(queryParams.get('offset')) || 0);
          if (
            (from && !Number.isFinite(Date.parse(from))) ||
            (to && !Number.isFinite(Date.parse(to))) ||
            (from && to && from > to)
          ) {
            res.status(400).json({ error: 'Khoảng thời gian không hợp lệ' });
            return;
          }
          const actorSearch = (
            queryParams.get('actorSearch') || ''
          ).toLowerCase();
          const filtered = store.audit_logs
            .filter(
              (log) =>
                (!actorId || log.actor?.id === actorId) &&
                (!actorSearch ||
                  `${log.actor?.name} ${log.actor?.email}`
                    .toLowerCase()
                    .includes(actorSearch)) &&
                (!requestId || log.requestId === requestId) &&
                (!entity || log.entity === entity) &&
                (!entityId || log.entityId === entityId) &&
                (!outcome || log.outcome === outcome) &&
                (!from || log.timestamp >= from) &&
                (!to || log.timestamp <= to)
            )
            .reverse();
          if (queryParams.get('group') === 'true') {
            const matchedIds = new Set(filtered.map((log) => log.requestId));
            const groups = new Map<string, AuditRecord[]>();
            for (const log of store.audit_logs)
              if (matchedIds.has(log.requestId))
                groups.set(log.requestId, [
                  ...(groups.get(log.requestId) || []),
                  log
                ]);
            const grouped = Array.from(groups.values())
              .reverse()
              .filter(
                (events) =>
                  queryParams.get('technical') === 'true' ||
                  events.some(
                    (e) =>
                      e.outcome === 'FAILURE' ||
                      e.changedFields.some(
                        (field) =>
                          !['updated_at', 'last_login_at'].includes(field)
                      ) ||
                      e.path.includes('/auth/') ||
                      (e.method !== 'GET' && e.path.startsWith('/api/admin/'))
                  )
              );
            res.status(200).json({
              groups: grouped.slice(offset, offset + 25),
              total: grouped.length,
              temporary:
                !process.env.ARC_STORE_PATH &&
                Boolean(
                  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
                )
            });
            return;
          }
          res.status(200).json({
            logs: filtered.slice(offset, offset + 100),
            total: filtered.length,
            offset,
            temporary: Boolean(
              process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
            )
          });
          return;
        }
        if (pathname === '/api/admin/ai' && method === 'GET') {
          res.status(200).json({
            configured: Boolean(process.env.GEMINI_API_KEY),
            defaultModel: DEFAULT_MODEL,
            prompt: SYSTEM_PROMPT,
            promptVersion: PROMPT_VERSION
          });
          return;
        }
        const tables: Record<string, unknown[]> = {
          users: store.users.map(formatUserResponse),
          plans: store.plans,
          user_progress: store.user_progress,
          learning_history: store.learning_history,
          certificates: store.certificates,
          entitlements: store.entitlements,
          chat_sessions: store.chat_sessions,
          chat_messages: store.chat_messages,
          chat_logs: store.chat_logs,
          audit_logs: store.audit_logs
        };
        const duplicateEmails =
          store.users.length -
          new Set(store.users.map((u) => u.email.toLowerCase())).size;
        const table = queryParams.get('table');
        if (table && !Object.hasOwn(tables, table)) {
          res.status(400).json({ error: 'Bảng không hợp lệ' });
          return;
        }
        if (method !== 'GET') {
          res.status(405).json({ error: 'Dữ liệu chỉ cho phép đọc' });
          return;
        }
        const term = (queryParams.get('q') || '').toLowerCase();
        const rows = table
          ? tables[table].filter(
              (row) => !term || JSON.stringify(row).toLowerCase().includes(term)
            )
          : [];
        const offset = Math.max(0, Number(queryParams.get('offset')) || 0);
        res.status(200).json({
          usage: {
            fileBytes: fs.existsSync(getStoreFilePath())
              ? fs.statSync(getStoreFilePath()).size
              : 0,
            logicalBytes: Buffer.byteLength(JSON.stringify(store)),
            archiveBytes: listArchives(getStoreFilePath()).reduce(
              (total, archive) => total + archive.bytes,
              0
            ),
            totalRecords: Object.values(store).reduce(
              (total, value) =>
                total + (Array.isArray(value) ? value.length : 0),
              0
            )
          },
          health: {
            persistentPathConfigured: Boolean(process.env.ARC_STORE_PATH),
            sharedDatabase: false,
            duplicateEmails,
            updatedAt: fs.existsSync(getStoreFilePath())
              ? fs.statSync(getStoreFilePath()).mtime.toISOString()
              : null
          },
          engine: 'JSON file',
          temporary:
            !process.env.ARC_STORE_PATH &&
            Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
          tables: Object.entries(tables).map(([name, rows]) => ({
            name,
            count: rows.length,
            bytes: Buffer.byteLength(
              JSON.stringify(store[name as keyof StoreState] || [])
            )
          })),
          rows: rows.slice(offset, offset + 100),
          filteredCount: rows.length,
          offset
        });
        return;
      }
      const ownedSessions = store.chat_sessions.filter(
        (s) => isAdmin || s.userId === actor.id
      );
      const sessionId = String(
        reqBody.sessionId || queryParams.get('sessionId') || ''
      );
      const owned = ownedSessions.find((s) => s.id === sessionId);
      const deny = () => {
        res.status(404).json({ error: 'Không tìm thấy phiên chat' });
      };
      if (pathname === '/api/chat/sessions' && method === 'GET') {
        const lessonId = queryParams.get('lessonId');
        const userId = queryParams.get('userId') || actor.id;
        res.status(200).json({
          sessions: ownedSessions
            .filter(
              (s) =>
                (!lessonId || s.lessonId === lessonId) && s.userId === userId
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        });
        return;
      }
      if (pathname === '/api/chat/sessions' && method === 'POST') {
        if (typeof reqBody.lessonId !== 'string' || !reqBody.lessonId) {
          res.status(400).json({ error: 'Thiếu lessonId' });
          return;
        }
        const now = new Date().toISOString();
        const created: ChatSession = {
          id: crypto.randomUUID(),
          userId: actor.id,
          lessonId: reqBody.lessonId,
          title:
            typeof reqBody.title === 'string' ? reqBody.title : 'Hội thoại mới',
          messageCount: 0,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now
        };
        store.chat_sessions.push(created);
        saveStore();
        res.status(201).json({ session: created });
        return;
      }
      if (
        pathname === '/api/chat/sessions' &&
        (method === 'PATCH' || method === 'DELETE')
      ) {
        if (!owned) {
          deny();
          return;
        }
        if (method === 'PATCH') {
          owned.title = String(reqBody.title || owned.title);
          owned.updatedAt = new Date().toISOString();
        } else {
          store.chat_sessions = store.chat_sessions.filter(
            (s) => s.id !== sessionId
          );
          store.chat_messages = store.chat_messages.filter(
            (m) => m.sessionId !== sessionId
          );
        }
        saveStore();
        res.status(200).json({ success: true });
        return;
      }
      if (pathname === '/api/chat/messages' && method === 'GET') {
        if (!owned) {
          deny();
          return;
        }
        res.status(200).json({
          messages: store.chat_messages.filter((m) => m.sessionId === sessionId)
        });
        return;
      }
      if (pathname === '/api/chat/messages' && method === 'POST') {
        if (!owned) {
          deny();
          return;
        }
        if (
          !['user', 'assistant', 'system'].includes(String(reqBody.role)) ||
          typeof reqBody.content !== 'string'
        ) {
          res.status(400).json({ error: 'Tin nhắn không hợp lệ' });
          return;
        }
        const now = new Date().toISOString();
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          sessionId,
          lessonId: owned.lessonId,
          userId: owned.userId,
          role: reqBody.role as ChatMessage['role'],
          content: reqBody.content,
          image: reqBody.image as ChatMessage['image'],
          model: typeof reqBody.model === 'string' ? reqBody.model : undefined,
          createdAt: now
        };
        store.chat_messages.push(msg);
        owned.messageCount++;
        owned.updatedAt = now;
        owned.lastMessageAt = now;
        if (
          msg.role === 'user' &&
          owned.messageCount <= 2 &&
          msg.content.trim()
        )
          owned.title = msg.content.slice(0, 32);
        saveStore();
        res.status(201).json({ message: msg });
        return;
      }
      if (pathname === '/api/chat/messages' && method === 'PATCH') {
        const msg = store.chat_messages.find(
          (m) =>
            m.id === reqBody.messageId &&
            ownedSessions.some((s) => s.id === m.sessionId)
        );
        if (!msg) {
          deny();
          return;
        }
        msg.content = String(reqBody.content || '');
        saveStore();
        res.status(200).json({ success: true });
        return;
      }
      if (pathname === '/api/chat/logs' && method === 'POST') {
        if (sessionId && !owned) {
          deny();
          return;
        }
        if (
          !['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(String(reqBody.level)) ||
          typeof reqBody.event !== 'string' ||
          typeof reqBody.message !== 'string'
        ) {
          res.status(400).json({ error: 'Log không hợp lệ' });
          return;
        }
        store.chat_logs.push({
          id: crypto.randomUUID(),
          userId: actor.id,
          sessionId: sessionId || undefined,
          lessonId: owned?.lessonId,
          level: reqBody.level as ChatLog['level'],
          event: reqBody.event,
          message: reqBody.message,
          metadata: reqBody.metadata as Record<string, unknown> | undefined,
          timestamp: new Date().toISOString()
        });
        saveStore();
        res.status(201).json({ success: true });
        return;
      }
      if (pathname === '/api/chat/logs' && method === 'GET') {
        const limit = Math.min(
          500,
          Math.max(1, Number(queryParams.get('limit')) || 100)
        );
        res.status(200).json({
          logs: store.chat_logs
            .filter(
              (l) =>
                (isAdmin || l.userId === actor.id) &&
                (!sessionId || l.sessionId === sessionId) &&
                (!queryParams.get('lessonId') ||
                  l.lessonId === queryParams.get('lessonId')) &&
                (!queryParams.get('level') ||
                  l.level === queryParams.get('level'))
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, limit)
        });
        return;
      }
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }
    // Identify and authorize every business mutation before it can produce evidence.
    if (
      ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method) &&
      !pathname.startsWith('/api/auth/')
    ) {
      const context = auditContext.getStore();
      const actor = context?.actor;
      if (!actor) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const bodyUserId =
        typeof reqBody.userId === 'string' ? reqBody.userId : undefined;
      const adminOnly =
        pathname.startsWith('/api/users') || pathname.startsWith('/api/plans');
      if (
        (adminOnly && actor.role !== 'admin') ||
        (bodyUserId && bodyUserId !== actor.id && actor.role !== 'admin')
      ) {
        res.status(403).json({ error: 'Không có quyền thực hiện thao tác' });
        return;
      }
    }
    if (
      method === 'GET' &&
      (pathname.startsWith('/api/progress') || pathname === '/api/history')
    ) {
      const token = getBearerToken(req) || getTokenFromCookie(req);
      const reader = token ? dbService.getAuthUser(token) : null;
      if (!reader) {
        res.status(401).json({ error: 'Chưa đăng nhập' });
        return;
      }
      const target =
        queryParams.get('userId') ||
        (pathname.startsWith('/api/progress')
          ? pathname.split('/')[3]
          : undefined);
      if (reader.role !== 'admin' && target !== reader.id) {
        res.status(403).json({ error: 'Không có quyền đọc dữ liệu này' });
        return;
      }
    }
    if (
      ['POST', 'PATCH'].includes(method) &&
      (pathname === '/api/auth/register' || pathname.startsWith('/api/users'))
    ) {
      const targetId = pathname.split('/')[3];
      const existing = targetId ? dbService.getUserById(targetId) : null;
      if (reqBody.email !== undefined || method === 'POST') {
        const email =
          typeof reqBody.email === 'string'
            ? reqBody.email.trim().toLowerCase()
            : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.status(400).json({ error: 'Email không hợp lệ' });
          return;
        }
        if (
          email !== existing?.email.toLowerCase() &&
          store.users.some(
            (u) => u.email.toLowerCase() === email && u.id !== targetId
          )
        ) {
          res.status(409).json({ error: 'Email đã được sử dụng' });
          return;
        }
        reqBody.email = email;
      }
      if (
        (method === 'POST' &&
          (!reqBody.name ||
            typeof reqBody.name !== 'string' ||
            !reqBody.name.trim())) ||
        (reqBody.name !== undefined &&
          (typeof reqBody.name !== 'string' || !reqBody.name.trim()))
      ) {
        res.status(400).json({ error: 'Họ tên không được để trống' });
        return;
      }
      if (
        pathname === '/api/users' &&
        (typeof reqBody.password !== 'string' || reqBody.password.length < 8)
      ) {
        res.status(400).json({
          error:
            'Cần mật khẩu riêng ít nhất 8 ký tự; không dùng mật khẩu mặc định'
        });
        return;
      }
      if (pathname.startsWith('/api/users')) {
        if (
          reqBody.dataOrigin !== undefined &&
          !['real', 'test'].includes(String(reqBody.dataOrigin))
        ) {
          res.status(400).json({ error: 'Nguồn dữ liệu không hợp lệ' });
          return;
        }
        if (
          reqBody.role !== undefined &&
          !['student', 'admin', 'instructor'].includes(String(reqBody.role))
        ) {
          res.status(400).json({ error: 'Vai trò không hợp lệ' });
          return;
        }
        const plan = reqBody.planId ?? reqBody.plan_id;
        if (
          plan !== undefined &&
          !store.plans.some(
            (p) => p.id === plan && (p.is_active || existing?.plan_id === plan)
          )
        ) {
          res
            .status(400)
            .json({ error: 'Gói học không tồn tại hoặc đã ngừng cấp mới' });
          return;
        }
        if (reqBody.auth_provider !== undefined) {
          res.status(400).json({
            error: 'Không đổi phương thức xác thực bằng chỉnh sửa hồ sơ'
          });
          return;
        }
      }
    }
    if (
      method === 'POST' &&
      [
        '/api/history',
        '/api/progress',
        '/api/exams/submit-final',
        '/api/exams/submit-sprint'
      ].includes(pathname)
    ) {
      if (
        typeof reqBody.userId !== 'string' ||
        !dbService.getUserById(reqBody.userId)
      ) {
        res.status(400).json({ error: 'Học viên không tồn tại' });
        return;
      }
      if (
        reqBody.score !== undefined &&
        (typeof reqBody.score !== 'number' ||
          !Number.isFinite(reqBody.score) ||
          reqBody.score < 0 ||
          reqBody.score > 100)
      ) {
        res.status(400).json({ error: 'Điểm phải trong khoảng 0–100' });
        return;
      }
      if (
        pathname === '/api/history' &&
        !['theory_read', 'quiz_passed', 'code_passed'].includes(
          String(reqBody.action)
        )
      ) {
        res.status(400).json({
          error: 'Sự kiện thi và chứng chỉ chỉ được ghi bởi nghiệp vụ server'
        });
        return;
      }
    }
    // 1. AUTH: Google OAuth
    if (pathname === '/api/auth/google' && method === 'POST') {
      const { accessToken, credential } = reqBody;
      let profile: Record<string, unknown> | null = null;
      try {
        const url =
          typeof accessToken === 'string'
            ? 'https://www.googleapis.com/oauth2/v3/userinfo'
            : typeof credential === 'string'
              ? `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
              : null;
        if (url) {
          const result = await fetch(url, {
            headers:
              typeof accessToken === 'string'
                ? { Authorization: `Bearer ${accessToken}` }
                : {},
            signal: AbortSignal.timeout(10000)
          });
          if (result.ok)
            profile = (await result.json()) as Record<string, unknown>;
        }
      } catch {
        /* Provider failure must not fall back to client identity. */
      }
      const clientId =
        process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      if (
        !profile ||
        !profile.sub ||
        typeof profile.email !== 'string' ||
        ![true, 'true'].includes(profile.email_verified as boolean | string) ||
        (typeof credential === 'string' &&
          (!clientId ||
            profile.aud !== clientId ||
            !['accounts.google.com', 'https://accounts.google.com'].includes(
              String(profile.iss)
            ) ||
            Number(profile.exp) <= Date.now() / 1000))
      ) {
        res.status(401).json({ error: 'Không xác minh được tài khoản Google' });
        return;
      }
      const resolvedEmail = profile.email.trim().toLowerCase();
      const resolvedName =
        typeof profile.name === 'string' ? profile.name : undefined;
      const resolvedAvatar =
        typeof profile.picture === 'string' ? profile.picture : undefined;
      const resolvedGoogleId = String(profile.sub);
      let user = dbService.getUserByEmail(resolvedEmail);
      if (!user) {
        user = dbService.createUser({
          id: 'usr_g_' + crypto.randomUUID(),
          name: resolvedName || 'Học Viên Google',
          email: resolvedEmail.toLowerCase().trim(),
          role: 'student',
          avatar:
            resolvedAvatar ||
            'https://lh3.googleusercontent.com/a/ACg8ocIq8=s96-c',
          avatar_color: '#0ea5e9',
          auth_provider: 'google',
          google_id: resolvedGoogleId,
          plan_id: 'free',
          data_origin: 'real'
        });
      } else {
        if (
          user.status === 'suspended' ||
          user.auth_provider !== 'google' ||
          user.google_id !== resolvedGoogleId
        ) {
          res.status(409).json({
            error: 'Tài khoản hiện có cần đăng nhập bằng phương thức đã đăng ký'
          });
          return;
        }
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
        user: formatUserResponse(user)
      });
      return;
    }

    // 2. AUTH: Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const email =
        typeof reqBody.email === 'string' ? reqBody.email.trim() : '';
      const password =
        typeof reqBody.password === 'string' ? reqBody.password : '';

      if (!email || !password) {
        res
          .status(400)
          .json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu!' });
        return;
      }

      const user = dbService.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
        return;
      }

      if (
        user.status === 'suspended' ||
        user.auth_provider !== 'email' ||
        !user.password_hash ||
        !user.password_salt
      ) {
        res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
        return;
      }
      if (user.password_hash && user.password_salt) {
        const isValid = verifyPassword(
          password,
          user.password_hash,
          user.password_salt
        );
        if (!isValid) {
          res
            .status(401)
            .json({ error: 'Email hoặc mật khẩu không chính xác!' });
          return;
        }
      }

      const updatedUser =
        dbService.updateUser(user.id, {
          last_login_at: new Date().toISOString()
        }) || user;
      const session = dbService.createSession(updatedUser.id);
      setSessionCookie(res, session.token);
      res.status(200).json({
        success: true,
        user: formatUserResponse(updatedUser)
      });
      return;
    }

    // 3. AUTH: Register
    if (pathname === '/api/auth/register' && method === 'POST') {
      const name = typeof reqBody.name === 'string' ? reqBody.name.trim() : '';
      const email =
        typeof reqBody.email === 'string'
          ? reqBody.email.trim().toLowerCase()
          : '';
      const password =
        typeof reqBody.password === 'string' ? reqBody.password : '';
      const role = 'student';
      const planId = 'free';

      if (!name || !email || password.length < 8) {
        res.status(400).json({
          error: 'Vui lòng nhập họ tên, email và mật khẩu ít nhất 8 ký tự!'
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự!' });
        return;
      }

      const existing = dbService.getUserByEmail(email);
      if (existing) {
        res.status(409).json({
          error: 'Email này đã được đăng ký trong hệ thống! Vui lòng đăng nhập.'
        });
        return;
      }

      const colors = [
        '#0ea5e9',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#ec4899',
        '#06b6d4'
      ];
      const newUser = dbService.createUser({
        id: 'usr_' + crypto.randomUUID(),
        name,
        email,
        password,
        role,
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: 'email',
        plan_id: planId,
        data_origin: 'real'
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
        user: formatUserResponse(newUser)
      });
      return;
    }

    // 4. AUTH: Me
    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = getTokenFromCookie(req);
      if (!token) {
        res.status(401).json({ error: 'Chưa đăng nhập (thiếu token)' });
        return;
      }

      const sessionData = dbService.getSessionByToken(token);
      if (!sessionData) {
        res
          .status(401)
          .json({ error: 'Phiên đăng nhập đã hết hạn hoặc không tồn tại!' });
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
      const token = getTokenFromCookie(req);
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
      const origin = queryParams.get('origin');
      const term = (queryParams.get('q') || '').toLowerCase();
      const role = queryParams.get('role');
      const users = dbService
        .getAllUsers()
        .filter(
          (u) =>
            (!origin ||
              origin === 'all' ||
              (origin === 'test' ? isTestUser(u) : !isTestUser(u))) &&
            (!role || u.role === role) &&
            `${u.name} ${u.email}`.toLowerCase().includes(term)
        );
      const sort = queryParams.get('sort');
      if (sort === 'name')
        users.sort(
          (a, b) =>
            a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id)
        );
      if (sort === 'active')
        users.sort(
          (a, b) =>
            b.last_login_at.localeCompare(a.last_login_at) ||
            a.id.localeCompare(b.id)
        );
      const offset = Math.max(0, Number(queryParams.get('offset')) || 0);
      const limit = queryParams.has('limit')
        ? Math.min(100, Math.max(1, Number(queryParams.get('limit')) || 25))
        : users.length;
      res.status(200).json({
        success: true,
        total: users.length,
        users: users.slice(offset, offset + limit).map(formatUserResponse)
      });
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
      const colors = [
        '#0ea5e9',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#ec4899',
        '#06b6d4'
      ];
      const user = dbService.createUser({
        id: 'usr_' + crypto.randomUUID(),
        name: (reqBody.name as string) || 'Học Viên',
        data_origin: reqBody.dataOrigin === 'test' ? 'test' : 'real',
        email: (reqBody.email as string) || '',
        password: reqBody.password as string,
        role: (reqBody.role as 'student' | 'admin' | 'instructor') || 'student',
        plan_id: (reqBody.planId as 'free' | 'pro' | 'enterprise') || 'free',
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: 'email'
      });
      res.status(201).json({ success: true, user: formatUserResponse(user) });
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
      if (!dbService.getUserById(id)) {
        res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        return;
      }
      if (
        id === adminSession.user.id &&
        reqBody.role !== undefined &&
        reqBody.role !== 'admin'
      ) {
        res.status(409).json({ error: 'Không thể tự hạ quyền quản trị' });
        return;
      }
      const current = dbService.getUserById(id)!;
      if (
        reqBody.expectedVersion !== undefined &&
        reqBody.expectedVersion !== (current.version || 1)
      ) {
        res
          .status(409)
          .json({ error: 'Dữ liệu đã thay đổi. Hãy tải lại trước khi lưu' });
        return;
      }
      const { planId, avatarColor } = reqBody;
      if (
        ((reqBody.role !== undefined && reqBody.role !== current.role) ||
          ((reqBody.planId ?? reqBody.plan_id) !== undefined &&
            (reqBody.planId ?? reqBody.plan_id) !== current.plan_id) ||
          (reqBody.dataOrigin !== undefined &&
            reqBody.dataOrigin !== (isTestUser(current) ? 'test' : 'real'))) &&
        (typeof reqBody.reason !== 'string' || reqBody.reason.trim().length < 5)
      ) {
        res
          .status(400)
          .json({ error: 'Đổi quyền hoặc gói học cần lý do ít nhất 5 ký tự' });
        return;
      }
      const fields = Object.fromEntries(
        Object.entries(reqBody).filter(([key]) =>
          [
            'name',
            'email',
            'role',
            'avatar',
            'plan_id',
            'avatar_color'
          ].includes(key)
        )
      );
      const updated = dbService.updateUser(id, {
        ...fields,
        version: (current.version || 1) + 1,
        ...(reqBody.dataOrigin !== undefined
          ? { data_origin: reqBody.dataOrigin as 'real' | 'test' }
          : {}),
        ...(planId ? { plan_id: planId } : {}),
        ...(avatarColor ? { avatar_color: avatarColor } : {})
      } as Partial<DbUser>);
      res.status(200).json({
        success: true,
        user: updated ? formatUserResponse(updated) : null
      });
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
      if (!dbService.getUserById(id)) {
        res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        return;
      }
      if (
        id === adminSession.user.id ||
        (dbService.getUserById(id)?.role === 'admin' &&
          store.users.filter((u) => u.role === 'admin').length <= 1)
      ) {
        res.status(409).json({
          error: 'Không thể xóa chính mình hoặc quản trị viên cuối cùng'
        });
        return;
      }
      dbService.deleteUser(id);
      res.status(200).json({ success: true });
      return;
    }

    // 7. PLANS
    if (pathname === '/api/plans' && method === 'GET') {
      const rawPlans = dbService.getAllPlans();
      const plans = rawPlans.map((p) => ({
        ...p,
        billingPeriod: p.billing_period,
        features: JSON.parse(p.features || '[]'),
        isPopular: Boolean(p.is_popular),
        isActive: Boolean(p.is_active)
      }));
      res.status(200).json({ success: true, plans });
      return;
    }

    if (pathname.startsWith('/api/plans/') && method === 'PATCH') {
      const id = pathname.replace('/api/plans/', '');
      if (!dbService.getAllPlans().some((plan) => plan.id === id)) {
        res.status(404).json({ error: 'Không tìm thấy gói học' });
        return;
      }
      if (
        ['name', 'description', 'billing_period'].some(
          (key) =>
            reqBody[key] !== undefined &&
            (typeof reqBody[key] !== 'string' ||
              (key === 'name' && !String(reqBody[key]).trim()))
        ) ||
        ['isActive', 'isPopular'].some(
          (key) =>
            reqBody[key] !== undefined && typeof reqBody[key] !== 'boolean'
        )
      ) {
        res.status(400).json({ error: 'Cấu hình gói học không hợp lệ' });
        return;
      }
      const { features, isPopular, isActive, ...rest } = reqBody;
      if (
        reqBody.price !== undefined &&
        (typeof reqBody.price !== 'number' ||
          !Number.isFinite(reqBody.price) ||
          reqBody.price < 0)
      ) {
        res.status(400).json({ error: 'Giá phải là số không âm' });
        return;
      }
      if (
        features !== undefined &&
        (!Array.isArray(features) ||
          features.some((f) => typeof f !== 'string'))
      ) {
        res.status(400).json({ error: 'Danh sách quyền không hợp lệ' });
        return;
      }
      const payload: Partial<DbPlan> = Object.fromEntries(
        Object.entries(rest).filter(([key]) =>
          ['name', 'price', 'description', 'billing_period'].includes(key)
        )
      );
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
      const progress = (
        reqBody.progress && typeof reqBody.progress === 'object'
          ? reqBody.progress
          : {}
      ) as Record<string, unknown>;
      if (!userId) {
        res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        return;
      }

      const verified = dbService.getUserProgress(userId);
      const dbPayload: DbProgress = {
        user_id: userId,
        current_lesson_id: (progress.currentLessonId as string) || 'lesson-1',
        completed_lessons: JSON.stringify(progress.completedLessons || {}),
        sprint_exam_scores: verified?.sprint_exam_scores || '{}',
        final_exam: verified?.final_exam || '',
        streak_days:
          typeof progress.streakDays === 'number' ? progress.streakDays : 1,
        last_active_date:
          (progress.lastActiveDate as string) ||
          new Date().toISOString().split('T')[0],
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
      const sprintId =
        typeof reqBody.sprintId === 'number' ? reqBody.sprintId : undefined;
      const score = typeof reqBody.score === 'number' ? reqBody.score : 0;
      const passed = false; // Browser code evaluation cannot establish trusted completion.
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        res.status(400).json({ error: 'Điểm phải trong khoảng 0–100' });
        return;
      }

      if (
        !userId ||
        sprintId === undefined ||
        !Number.isInteger(sprintId) ||
        sprintId < 1 ||
        sprintId > 10
      ) {
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
      sprintScores[sprintId] = {
        score,
        passed,
        verification: 'unverified',
        completedAt: new Date().toISOString()
      };

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
        id:
          'hist_' +
          Date.now() +
          '_' +
          Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: `sprint-${sprintId}`,
        lesson_title: `Kỳ thi Sprint 0${sprintId}`,
        action: score === 0 ? 'sprint_failed' : 'sprint_unverified',
        score,
        details: `Kết quả trình duyệt (${score}%) · chờ xác minh trên server`,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({ success: true });
      return;
    }

    if (pathname === '/api/exams/submit-final' && method === 'POST') {
      const userId = typeof reqBody.userId === 'string' ? reqBody.userId : '';
      const studentName =
        typeof reqBody.studentName === 'string'
          ? reqBody.studentName
          : 'Học Viên';
      const score = typeof reqBody.score === 'number' ? reqBody.score : 0;
      const passed = false; // Browser code evaluation cannot establish trusted completion.
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        res.status(400).json({ error: 'Điểm phải trong khoảng 0–100' });
        return;
      }

      if (!userId) {
        res.status(400).json({ error: 'Thiếu dữ liệu thi tốt nghiệp' });
        return;
      }

      const certificateCode =
        'ESM-' + Math.floor(100000 + Math.random() * 900000);
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
        certificateId: passed ? certificateCode : '',
        verification: 'unverified',
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
        id:
          'hist_' +
          Date.now() +
          '_' +
          Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: 'final-exam',
        lesson_title: 'Thi Tốt Nghiệp Toàn Khóa Master NestJS',
        action: score === 0 ? 'final_failed' : 'final_unverified',
        score,
        details: `Kết quả do trình duyệt gửi (${score}%), chờ xác minh; chưa cấp chứng chỉ`,
        timestamp: now
      });

      res.status(200).json({
        success: true,
        certificateCode: passed ? certificateCode : '',
        finalResult
      });
      return;
    }

    // 10. HISTORY
    if (pathname === '/api/history' && method === 'GET') {
      const userId = queryParams.get('userId') || undefined;
      const history = dbService.getLearningHistory(userId);
      res.status(200).json({
        success: true,
        history: history.map((h) => ({
          id: h.id,
          userId: h.user_id,
          lessonId: h.lesson_id,
          lessonTitle: h.lesson_title,
          action: h.action,
          score: h.score,
          details: h.details,
          timestamp: h.timestamp
        }))
      });
      return;
    }

    if (pathname === '/api/history' && method === 'POST') {
      const userId = typeof reqBody.userId === 'string' ? reqBody.userId : '';
      const lessonId =
        typeof reqBody.lessonId === 'string' ? reqBody.lessonId : undefined;
      const lessonTitle =
        typeof reqBody.lessonTitle === 'string'
          ? reqBody.lessonTitle
          : undefined;
      const action =
        typeof reqBody.action === 'string' ? reqBody.action : 'activity';
      const score =
        typeof reqBody.score === 'number' ? reqBody.score : undefined;
      const details =
        typeof reqBody.details === 'string' ? reqBody.details : undefined;

      const newRecord: DbHistory = {
        id:
          'hist_' +
          Date.now() +
          '_' +
          Math.random().toString(36).substring(2, 6),
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
    const context = auditContext.getStore();
    if (context && error instanceof Error) context.errorStack = error.stack;
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
