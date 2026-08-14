import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

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
  features: string; // JSON array string
  is_popular: number;
  is_active: number;
}

export interface DbProgress {
  user_id: string;
  current_lesson_id: string;
  completed_lessons: string; // JSON object string
  sprint_exam_scores: string; // JSON object string
  final_exam: string; // JSON object string
  streak_days: number;
  last_active_date: string;
  cleared_lessons: string; // JSON object string
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

/* ==========================================
   PASSWORD SECURITY & HASHING (PBKDF2)
   ========================================== */
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

function initDatabase(): DatabaseSync {
  try {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const DATA_DIR = isVercel ? '/tmp' : path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(DATA_DIR)) {
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
    }
    const DB_PATH = path.join(DATA_DIR, 'esmiles.sqlite');
    const database = new DatabaseSync(DB_PATH);
    database.exec('PRAGMA journal_mode = MEMORY;');
    database.exec('PRAGMA synchronous = NORMAL;');
    // Test write
    database.exec('CREATE TABLE IF NOT EXISTS _test_write (id INTEGER); DROP TABLE _test_write;');
    return database;
  } catch {
    const memDb = new DatabaseSync(':memory:');
    memDb.exec('PRAGMA foreign_keys = ON;');
    return memDb;
  }
}

const db = initDatabase();

// Initialize schema
db.exec(`

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    avatar TEXT,
    avatar_color TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    google_id TEXT,
    plan_id TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    billing_period TEXT NOT NULL,
    description TEXT,
    features TEXT NOT NULL,
    is_popular INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_progress (
    user_id TEXT PRIMARY KEY,
    current_lesson_id TEXT DEFAULT 'lesson-1',
    completed_lessons TEXT DEFAULT '{}',
    sprint_exam_scores TEXT DEFAULT '{}',
    final_exam TEXT,
    streak_days INTEGER DEFAULT 1,
    last_active_date TEXT,
    cleared_lessons TEXT DEFAULT '{}',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS learning_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lesson_id TEXT,
    lesson_title TEXT,
    action TEXT NOT NULL,
    score INTEGER,
    details TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    certificate_code TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    completed_at TEXT NOT NULL
  );
`);

// Safe column migrations for existing SQLite databases
try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN password_salt TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN google_id TEXT'); } catch (e) {}




// Seed Default Plans if empty
const planCountRow = db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
if (!planCountRow || planCountRow.count === 0) {
  const insertPlan = db.prepare(`
    INSERT INTO plans (id, name, price, billing_period, description, features, is_popular, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPlan.run(
    'free',
    'Gói Trải Nghiệm (Free Starter)',
    0,
    'Vĩnh viễn',
    'Dành cho người mới bắt đầu tìm hiểu kiến trúc backend NestJS.',
    JSON.stringify([
      'Học Sprint 01: Core Architecture & Dependency Injection',
      'Thực hành Code Sandbox cơ bản (20 tests)',
      'Hỏi đáp Tutor AI giới hạn 10 câu/ngày',
      'Lưu trữ kết quả học tập cá nhân'
    ]),
    0,
    1
  );

  insertPlan.run(
    'pro',
    'Gói Chuyên Sâu (Pro Master NestJS)',
    990000,
    'Trọn đời',
    'Trọn bộ 6 Sprints kiến trúc thực chiến eSmiles, Prisma 7 & Khảo thí cấp bằng.',
    JSON.stringify([
      'Mở khóa toàn bộ 6 Sprints (22+ bài học chuyên sâu)',
      'Không giới hạn bài tập Code Sandbox & Hidden Tests',
      'AI Tutor Gemini 3.7 Flash hỗ trợ giải thích 24/7',
      'Tham gia 4 kỳ thi Sprint + Thi Tốt Nghiệp Toàn Khóa',
      'Cấp Chứng Chỉ Tốt Nghiệp Danh Dự eSmiles Academy có mã tra cứu'
    ]),
    1,
    1
  );

  insertPlan.run(
    'enterprise',
    'Gói Doanh Nghiệp (Enterprise Team)',
    2490000,
    'Theo nhóm 5 thành viên',
    'Đào tạo đội ngũ Frontend chuyển đổi Fullstack NestJS theo chuẩn doanh nghiệp.',
    JSON.stringify([
      'Bao gồm toàn bộ quyền lợi của gói Pro Master cho 5 thành viên',
      'Bảng điều khiển Admin theo dõi tiến độ từng kỹ sư',
      'Review code 1-1 và hướng dẫn kiến trúc đa chi nhánh',
      'Xuất báo cáo đánh giá năng lực kỹ sư theo Sprint'
    ]),
    0,
    1
  );
}

// Bootstrap single admin account from environment variables
// No seed users - all accounts are real (Google OAuth or Email registration)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(ADMIN_EMAIL) as { id: string } | undefined;
  if (!existingAdmin) {
    const adminHash = hashPassword(ADMIN_PASSWORD);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, password_salt, role, avatar, avatar_color, auth_provider, google_id, plan_id, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr_admin_' + Date.now(),
      'System Administrator',
      ADMIN_EMAIL.toLowerCase().trim(),
      adminHash.hash,
      adminHash.salt,
      'admin',
      null,
      '#f59e0b',
      'email',
      null,
      'enterprise',
      now,
      now
    );
  }
}

/* ==========================================
   CRUD & SESSION OPERATIONS
   ========================================== */
export const dbService = {
  // SESSIONS
  createSession(userId: string): DbSession {
    const token = generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    const session: DbSession = {
      id: 'sess_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      user_id: userId,
      token,
      created_at: now.toISOString(),
      expires_at: expiresAt
    };

    const stmt = db.prepare(`
      INSERT INTO sessions (id, user_id, token, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(session.id, session.user_id, session.token, session.created_at, session.expires_at);
    return session;
  },

  getSessionByToken(token: string): { session: DbSession; user: DbUser } | null {
    const row = db.prepare(`
      SELECT s.id as session_id, s.user_id, s.token, s.created_at as session_created_at, s.expires_at,
             u.id, u.name, u.email, u.role, u.avatar, u.avatar_color, u.auth_provider, u.plan_id, u.created_at, u.last_login_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token) as any;

    if (!row) return null;

    return {
      session: {
        id: row.session_id,
        user_id: row.user_id,
        token: row.token,
        created_at: row.session_created_at,
        expires_at: row.expires_at
      },
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        avatar: row.avatar,
        avatar_color: row.avatar_color,
        auth_provider: row.auth_provider,
        plan_id: row.plan_id,
        created_at: row.created_at,
        last_login_at: row.last_login_at
      }
    };
  },

  deleteSession(token: string): boolean {
    const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
    return true;
  },

  // USERS
  getAllUsers(): DbUser[] {
    return db.prepare('SELECT id, name, email, role, avatar, avatar_color, auth_provider, plan_id, created_at, last_login_at FROM users ORDER BY created_at DESC').all() as unknown as DbUser[];
  },

  getUserByEmail(email: string): DbUser | null {
    const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as unknown as DbUser | undefined;
    return row || null;
  },

  getUserById(id: string): DbUser | null {
    const row = db.prepare('SELECT id, name, email, role, avatar, avatar_color, auth_provider, plan_id, created_at, last_login_at FROM users WHERE id = ?').get(id) as unknown as DbUser | undefined;
    return row || null;
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
    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, password_salt, role, avatar, avatar_color, auth_provider, google_id, plan_id, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.name,
      user.email,
      password_hash || null,
      password_salt || null,
      user.role,
      user.avatar || null,
      user.avatar_color || '#0ea5e9',
      user.auth_provider,
      user.google_id || null,
      user.plan_id,
      now,
      now
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      avatar_color: user.avatar_color,
      auth_provider: user.auth_provider,
      google_id: user.google_id,
      plan_id: user.plan_id,
      created_at: now,
      last_login_at: now
    };
  },

  updateUser(id: string, updates: Partial<DbUser>): DbUser | null {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as DbUser | undefined;
    if (!existing) return null;

    const merged = { ...existing, ...updates };
    const stmt = db.prepare(`
      UPDATE users SET
        name = ?,
        email = ?,
        role = ?,
        avatar = ?,
        avatar_color = ?,
        plan_id = ?,
        last_login_at = ?
      WHERE id = ?
    `);
    stmt.run(
      merged.name,
      merged.email,
      merged.role,
      merged.avatar || null,
      merged.avatar_color || '#0ea5e9',
      merged.plan_id,
      merged.last_login_at,
      id
    );
    return merged;
  },

  deleteUser(id: string): boolean {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_progress WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM learning_history WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM certificates WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return true;
  },

  // PLANS
  getAllPlans(): DbPlan[] {
    return db.prepare('SELECT * FROM plans ORDER BY price ASC').all() as unknown as DbPlan[];
  },

  updatePlan(id: string, updates: Partial<DbPlan>): DbPlan | null {
    const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as unknown as DbPlan | undefined;
    if (!row) return null;
    const merged = { ...row, ...updates };
    const stmt = db.prepare(`
      UPDATE plans SET
        name = ?,
        price = ?,
        billing_period = ?,
        description = ?,
        features = ?,
        is_popular = ?,
        is_active = ?
      WHERE id = ?
    `);
    stmt.run(
      merged.name,
      merged.price,
      merged.billing_period,
      merged.description,
      merged.features,
      merged.is_popular,
      merged.is_active,
      id
    );
    return merged;
  },

  // PROGRESS
  getUserProgress(userId: string): DbProgress | null {
    const row = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').get(userId) as unknown as DbProgress | undefined;
    return row || null;
  },

  saveUserProgress(progress: DbProgress): DbProgress {
    const existing = this.getUserProgress(progress.user_id);
    if (existing) {
      const stmt = db.prepare(`
        UPDATE user_progress SET
          current_lesson_id = ?,
          completed_lessons = ?,
          sprint_exam_scores = ?,
          final_exam = ?,
          streak_days = ?,
          last_active_date = ?,
          cleared_lessons = ?,
          updated_at = ?
        WHERE user_id = ?
      `);
      stmt.run(
        progress.current_lesson_id,
        progress.completed_lessons,
        progress.sprint_exam_scores,
        progress.final_exam || null,
        progress.streak_days,
        progress.last_active_date,
        progress.cleared_lessons,
        progress.updated_at,
        progress.user_id
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO user_progress (user_id, current_lesson_id, completed_lessons, sprint_exam_scores, final_exam, streak_days, last_active_date, cleared_lessons, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        progress.user_id,
        progress.current_lesson_id,
        progress.completed_lessons,
        progress.sprint_exam_scores,
        progress.final_exam || null,
        progress.streak_days,
        progress.last_active_date,
        progress.cleared_lessons,
        progress.updated_at
      );
    }
    return progress;
  },

  // HISTORY
  getLearningHistory(userId?: string): DbHistory[] {
    if (userId) {
      return db.prepare('SELECT * FROM learning_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100').all(userId) as unknown as DbHistory[];
    }
    return db.prepare('SELECT * FROM learning_history ORDER BY timestamp DESC LIMIT 200').all() as unknown as DbHistory[];
  },

  addLearningHistory(history: DbHistory): DbHistory {
    const stmt = db.prepare(`
      INSERT INTO learning_history (id, user_id, lesson_id, lesson_title, action, score, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      history.id,
      history.user_id,
      history.lesson_id || null,
      history.lesson_title || null,
      history.action,
      history.score ?? null,
      history.details || null,
      history.timestamp
    );
    return history;
  },

  // CERTIFICATES
  issueCertificate(cert: DbCertificate): DbCertificate {
    const stmt = db.prepare(`
      INSERT INTO certificates (id, certificate_code, user_id, student_name, score, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(cert.id, cert.certificate_code, cert.user_id, cert.student_name, cert.score, cert.completed_at);
    return cert;
  },

  getCertificateByCode(code: string): DbCertificate | null {
    const row = db.prepare('SELECT * FROM certificates WHERE certificate_code = ?').get(code) as unknown as DbCertificate | undefined;
    return row || null;
  },

  // STATS
  getAdminStats() {
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
    const historyCount = (db.prepare('SELECT COUNT(*) as count FROM learning_history').get() as { count: number }).count;
    const certCount = (db.prepare('SELECT COUNT(*) as count FROM certificates').get() as { count: number }).count;

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
