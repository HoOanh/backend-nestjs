// server/zerotts.ts
import { spawn } from "node:child_process";
import path2 from "node:path";

// server/index.ts
import fs from "fs";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "path";
import crypto from "crypto";
function hashPassword(password, salt) {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1e4, 64, "sha512").toString("hex");
  return { hash, salt: generatedSalt };
}
function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}
loadLocalEnv();
function resolveJwtSecret() {
  const configured = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (configured) {
    if (configured.length < 32)
      throw new Error("JWT_SECRET ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 32 k\xFD t\u1EF1");
    return configured;
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production")
    throw new Error(
      "Production y\xEAu c\u1EA7u JWT_SECRET ri\xEAng, kh\xF4ng c\xF3 kh\xF3a m\u1EB7c \u0111\u1ECBnh"
    );
  const directory = path.resolve(process.cwd(), "data");
  fs.mkdirSync(directory, { recursive: true });
  const location = path.join(directory, "auth-secret.local");
  if (!fs.existsSync(location)) {
    try {
      fs.writeFileSync(location, crypto.randomBytes(48).toString("hex"), {
        mode: 384,
        flag: "wx"
      });
    } catch (error) {
      if (!fs.existsSync(location)) throw error;
    }
  }
  return fs.readFileSync(location, "utf-8").trim();
}
var JWT_SECRET = resolveJwtSecret();
function signJwt(user, expiresInDays = 30) {
  const exp = Math.floor(Date.now() / 1e3) + expiresInDays * 24 * 60 * 60;
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    planId: user.plan_id,
    exp,
    authVersion: user.auth_version || 0,
    authProvider: user.auth_provider,
    avatar: user.avatar,
    avatarColor: user.avatar_color,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
    dataOrigin: user.data_origin
  };
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
function verifyJwt(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected))
      return null;
    if (JSON.parse(Buffer.from(header, "base64url").toString()).alg !== "HS256")
      return null;
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8")
    );
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
function getStoreFilePath() {
  if (process.env.ARC_STORE_PATH) {
    const location = path.resolve(process.env.ARC_STORE_PATH);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    return location;
  }
  const isVercel = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
  if (isVercel) {
    return "/tmp/arc_irobot_store.json";
  }
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
    }
  }
  return path.join(dataDir, "arc_irobot_store.json");
}
var store = {
  entitlements: [],
  audit_logs: [],
  chat_sessions: [],
  chat_messages: [],
  chat_logs: [],
  users: [],
  deleted_users: [],
  sessions: [],
  revoked_tokens: [],
  plans: [],
  user_progress: [],
  learning_history: [],
  certificates: []
};
function loadStore() {
  try {
    const filePath = getStoreFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        store = {
          entitlements: [],
          audit_logs: [],
          chat_sessions: [],
          chat_messages: [],
          chat_logs: [],
          users: [],
          deleted_users: [],
          sessions: [],
          revoked_tokens: [],
          plans: [],
          user_progress: [],
          learning_history: [],
          certificates: [],
          ...parsed
        };
      }
    }
  } catch (error) {
    throw new Error(
      `Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u server: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
var auditedTables = [
  "users",
  "plans",
  "user_progress",
  "learning_history",
  "certificates",
  "chat_sessions",
  "chat_messages",
  "entitlements"
];
var auditContext = new AsyncLocalStorage();
function redactAudit(value) {
  if (Array.isArray(value)) return value.map(redactAudit);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /password|salt|token|secret|credential|api.?key|^image$|^image_data$/i.test(
          key
        ) ? "[REDACTED]" : redactAudit(item)
      ])
    );
  }
  return value;
}
function auditSnapshot() {
  return Object.fromEntries(
    auditedTables.map((table) => [
      table,
      JSON.parse(JSON.stringify(store[table]))
    ])
  );
}
function auditBase(context) {
  return {
    id: crypto.randomUUID(),
    requestId: context.requestId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    actor: context.actor,
    method: context.method,
    path: context.path,
    userAgent: context.userAgent,
    durationMs: Date.now() - context.startedAt,
    schemaVersion: 2,
    source: context.actor ? "user" : "anonymous",
    operation: `${context.method} ${context.path}`
  };
}
function appendChangeEvidence(context) {
  const current = auditSnapshot();
  const filePath = getStoreFilePath();
  const persisted = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : {};
  context.baseline = Object.fromEntries(
    auditedTables.map((table) => [
      table,
      persisted[table] || []
    ])
  );
  for (const table of auditedTables) {
    const key = table === "user_progress" ? "user_id" : "id";
    const previousRows = new Map(
      context.baseline[table].map((row) => [String(row[key]), row])
    );
    const currentRows = new Map(
      current[table].map((row) => [String(row[key]), row])
    );
    for (const id of /* @__PURE__ */ new Set([...previousRows.keys(), ...currentRows.keys()])) {
      const before = previousRows.get(id);
      const after = currentRows.get(id);
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      const changedFields = [
        .../* @__PURE__ */ new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
      ].filter(
        (field) => JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])
      );
      store.audit_logs.push({
        ...auditBase(context),
        action: !before ? "CREATE" : !after ? "DELETE" : "UPDATE",
        entity: table,
        entityId: id,
        before: redactAudit(before ?? null),
        after: redactAudit(after ?? null),
        changedFields,
        outcome: "PERSISTED",
        status: null
      });
    }
  }
  context.baseline = current;
}
function saveStore() {
  const context = auditContext.getStore();
  if (context) appendChangeEvidence(context);
  const filePath = getStoreFilePath();
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(temporaryPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {
    }
    throw err;
  }
}
loadStore();
function seedInitialData() {
  if (store.plans.length > 0) return;
  store.plans = [
    {
      id: "free",
      name: "G\xF3i Tr\u1EA3i Nghi\u1EC7m (Free Plan)",
      price: 0,
      billing_period: "Mi\u1EC5n ph\xED v\u0129nh vi\u1EC5n",
      description: "D\xE0nh cho h\u1ECDc vi\xEAn b\u1EAFt \u0111\u1EA7u t\xECm hi\u1EC3u t\u01B0 duy Backend & NestJS n\u1EC1n t\u1EA3ng.",
      features: JSON.stringify([
        "Truy c\u1EADp Sprint 0 (Mental Model & Event Loop)",
        "Th\u1EF1c h\xE0nh Code Sandbox t\u01B0\u01A1ng t\xE1c",
        "Kh\u1EA3o th\xED tr\u1EAFc nghi\u1EC7m c\u01A1 b\u1EA3n",
        "C\u1ED9ng \u0111\u1ED3ng k\u1EF9 s\u01B0 Arc Irobot Open"
      ]),
      is_popular: 0,
      is_active: 1
    },
    {
      id: "pro",
      name: "G\xF3i Chuy\xEAn Nghi\u1EC7p (Pro Master)",
      price: 69e4,
      billing_period: "Thanh to\xE1n 1 l\u1EA7n / Tr\u1ECDn \u0111\u1EDDi",
      description: "L\u1ED9 tr\xECnh chuy\u1EC3n \u0111\u1ED5i to\xE0n di\u1EC7n th\xE0nh Backend / Fullstack Engineer chuy\xEAn nghi\u1EC7p.",
      features: JSON.stringify([
        "To\xE0n b\u1ED9 6 Sprints chuy\xEAn s\xE2u t\u1EEB Sprint 0 \u0111\u1EBFn Sprint 5",
        "Master Prisma 7, High-Concurrency & Multi-Tenancy Scoping",
        "AI Gia S\u01B0 1-1 (Gemini 2.5 Flash) h\u01B0\u1EDBng d\u1EABn gi\u1EA3i b\xE0i t\u1EADp",
        "Tham gia 4 k\u1EF3 thi Sprint + Thi T\u1ED1t Nghi\u1EC7p To\xE0n Kh\xF3a",
        "C\u1EA5p Ch\u1EE9ng Ch\u1EC9 T\u1ED1t Nghi\u1EC7p Danh D\u1EF1 Arc Irobot Academy c\xF3 m\xE3 tra c\u1EE9u"
      ]),
      is_popular: 1,
      is_active: 1
    },
    {
      id: "enterprise",
      name: "G\xF3i Doanh Nghi\u1EC7p (Enterprise Team)",
      price: 249e4,
      billing_period: "Theo nh\xF3m 5 th\xE0nh vi\xEAn",
      description: "\u0110\xE0o t\u1EA1o \u0111\u1ED9i ng\u0169 Frontend chuy\u1EC3n \u0111\u1ED5i Fullstack NestJS theo chu\u1EA9n doanh nghi\u1EC7p.",
      features: JSON.stringify([
        "Bao g\u1ED3m to\xE0n b\u1ED9 quy\u1EC1n l\u1EE3i c\u1EE7a g\xF3i Pro Master cho 5 th\xE0nh vi\xEAn",
        "B\u1EA3ng \u0111i\u1EC1u khi\u1EC3n Admin theo d\xF5i ti\u1EBFn \u0111\u1ED9 t\u1EEBng k\u1EF9 s\u01B0",
        "Review code 1-1 v\xE0 h\u01B0\u1EDBng d\u1EABn ki\u1EBFn tr\xFAc \u0111a chi nh\xE1nh",
        "Xu\u1EA5t b\xE1o c\xE1o \u0111\xE1nh gi\xE1 n\u0103ng l\u1EF1c k\u1EF9 s\u01B0 theo Sprint"
      ]),
      is_popular: 0,
      is_active: 1
    }
  ];
  saveStore();
}
seedInitialData();
function loadLocalEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
            val = val.slice(1, -1);
          }
          if (val && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
  }
}
loadLocalEnv();
function bootstrapAdmin() {
  loadLocalEnv();
  loadStore();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || store.users.length) return;
  const credentials = hashPassword(password);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  store.users.push({
    id: crypto.randomUUID(),
    name: "System Administrator",
    email,
    password_hash: credentials.hash,
    password_salt: credentials.salt,
    role: "admin",
    auth_provider: "email",
    plan_id: "enterprise",
    avatar_color: "#f59e0b",
    created_at: now,
    last_login_at: now,
    version: 1,
    status: "active"
  });
  saveStore();
}
bootstrapAdmin();
var dbService = {
  createSession(userId) {
    loadStore();
    const user = store.users.find((u) => u.id === userId);
    const token = user ? signJwt(user) : generateSessionToken();
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1e3
    ).toISOString();
    const session = {
      id: "sess_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex"),
      user_id: userId,
      token,
      created_at: now.toISOString(),
      expires_at: expiresAt
    };
    store.sessions.push(session);
    saveStore();
    return session;
  },
  getAuthUser(token) {
    if (!token) return null;
    loadStore();
    if (store.revoked_tokens?.includes(token)) return null;
    const payload = verifyJwt(token);
    if (payload) {
      if (store.deleted_users?.includes(payload.userId)) return null;
      const user = store.users.find((u) => u.id === payload.userId);
      if (user?.status === "suspended") return null;
      if (user && (payload.authVersion || 0) !== (user.auth_version || 0)) return null;
      return {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        name: payload.name,
        plan_id: payload.planId,
        auth_provider: payload.authProvider || user?.auth_provider || "email",
        avatar: payload.avatar ?? user?.avatar,
        avatar_color: payload.avatarColor ?? user?.avatar_color,
        created_at: payload.createdAt || user?.created_at || "",
        last_login_at: payload.lastLoginAt || user?.last_login_at || "",
        data_origin: payload.dataOrigin ?? user?.data_origin,
        status: user?.status || "active",
        version: user?.version || 1,
        auth_version: payload.authVersion || 0
      };
    }
    const session = store.sessions.find(
      (s) => s.token === token && new Date(s.expires_at) > /* @__PURE__ */ new Date()
    );
    if (session) {
      if (store.deleted_users?.includes(session.user_id)) return null;
      return store.users.find(
        (u) => u.id === session.user_id && u.status !== "suspended"
      ) || null;
    }
    return null;
  },
  getSessionByToken(token) {
    const user = this.getAuthUser(token);
    if (!user) return null;
    return {
      session: {
        id: "sess_jwt",
        user_id: user.id,
        token,
        created_at: user.created_at,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1e3
        ).toISOString()
      },
      user
    };
  },
  deleteSession(token) {
    loadStore();
    store.sessions = store.sessions.filter((s) => s.token !== token);
    if (!store.revoked_tokens) store.revoked_tokens = [];
    if (!store.revoked_tokens.includes(token)) {
      store.revoked_tokens.push(token);
    }
    saveStore();
    return true;
  },
  getAllUsers() {
    loadStore();
    return [...store.users].sort(
      (a, b) => b.created_at.localeCompare(a.created_at)
    );
  },
  getUserByEmail(email) {
    loadStore();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  getUserById(id) {
    loadStore();
    return store.users.find((u) => u.id === id) || null;
  },
  createUser(user) {
    loadStore();
    let password_hash;
    let password_salt;
    if (user.password) {
      const hashed = hashPassword(user.password);
      password_hash = hashed.hash;
      password_salt = hashed.salt;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newUser = {
      id: user.id,
      data_origin: user.data_origin,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      password_hash,
      password_salt,
      role: user.role,
      avatar: user.avatar,
      avatar_color: user.avatar_color || "#0ea5e9",
      auth_provider: user.auth_provider,
      google_id: user.google_id,
      plan_id: user.plan_id,
      created_at: now,
      last_login_at: now
    };
    if (store.deleted_users) {
      store.deleted_users = store.deleted_users.filter((uid) => uid !== user.id);
    }
    store.users.push(newUser);
    saveStore();
    return newUser;
  },
  updateUser(id, updates) {
    loadStore();
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    store.users[idx] = {
      ...store.users[idx],
      data_origin: isTestUser(store.users[idx]) ? "test" : "real",
      ...updates
    };
    saveStore();
    return store.users[idx];
  },
  deleteUser(id) {
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
    if (!store.deleted_users) store.deleted_users = [];
    if (!store.deleted_users.includes(id)) {
      store.deleted_users.push(id);
    }
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
  getAllPlans() {
    loadStore();
    return [...store.plans].sort((a, b) => a.price - b.price);
  },
  updatePlan(id, updates) {
    loadStore();
    const idx = store.plans.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    store.plans[idx] = { ...store.plans[idx], ...updates };
    saveStore();
    return store.plans[idx];
  },
  getUserProgress(userId) {
    loadStore();
    return store.user_progress.find((p) => p.user_id === userId) || null;
  },
  saveUserProgress(progress) {
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
  getLearningHistory(userId) {
    loadStore();
    if (userId) {
      return store.learning_history.filter((h) => h.user_id === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 1e3);
    }
    return [...store.learning_history].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 1e3);
  },
  addLearningHistory(history) {
    loadStore();
    const existingIdx = store.learning_history.findIndex((h) => h.id === history.id);
    if (existingIdx !== -1) {
      store.learning_history[existingIdx] = history;
    } else {
      store.learning_history.push(history);
    }
    saveStore();
    return history;
  },
  issueCertificate(cert) {
    loadStore();
    store.certificates.push(cert);
    saveStore();
    return cert;
  },
  getCertificateByCode(code) {
    loadStore();
    return store.certificates.find((c) => c.certificate_code === code) || null;
  },
  getAdminStats() {
    loadStore();
    const realIds = new Set(
      store.users.filter(
        (u) => u.role === "student" && !formatUserResponse(u).isTestAccount
      ).map((u) => u.id)
    );
    const userCount = realIds.size;
    const historyCount = store.learning_history.filter(
      (h) => realIds.has(h.user_id)
    ).length;
    const certCount = new Set(
      store.certificates.filter((c) => c.status !== "revoked" && realIds.has(c.user_id)).map((c) => c.user_id)
    ).size;
    return {
      totalUsers: userCount,
      totalRevenue: null,
      certifiedStudents: certCount,
      totalActivityLogs: historyCount
    };
  }
};
var COOKIE_NAME = "arc_session";
var COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
function getBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}
function getTokenFromCookie(req) {
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader !== "string") return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`)
  );
  return match ? match[1] : null;
}
function isAuthenticatedApiRequest(headers) {
  const request = { headers };
  const token = getBearerToken(request) || getTokenFromCookie(request);
  return Boolean(token && dbService.getAuthUser(token));
}
function isTestUser(u) {
  if (u.data_origin) return u.data_origin === "test";
  return /^testgoogle_\d+@gmail\.com$/.test(u.email) && u.name === "Test Google Student" || /^testreg_\d+@arc-irobot\.tech$/.test(u.email) && u.name === "K\u1EF9 S\u01B0 E2E Test";
}
function formatUserResponse(u) {
  return {
    id: u.id,
    status: u.status || "active",
    version: u.version || 1,
    dataOrigin: isTestUser(u) ? "test" : "real",
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

// server/zerotts.ts
var LOCAL_ZEROTTS_URL = "http://127.0.0.1:4179";
var LOCAL_STARTUP_TIMEOUT_MS = 5 * 60 * 1e3;
var SYNTHESIS_TIMEOUT_MS = 5 * 60 * 1e3;
var MAX_TEXT_CHARACTERS = 6e3;
var localProcess = null;
var localStartup = null;
async function isLocalServiceReady() {
  try {
    const response = await fetch(`${LOCAL_ZEROTTS_URL}/health`, {
      signal: AbortSignal.timeout(1500)
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function waitForLocalService(child) {
  const deadline = Date.now() + LOCAL_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`ZeroTTS server stopped during startup (exit ${child.exitCode}).`);
    }
    if (await isLocalServiceReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("ZeroTTS kh\u1EDFi \u0111\u1ED9ng qu\xE1 l\xE2u. Ki\u1EC3m tra log backend \u0111\u1EC3 bi\u1EBFt th\xEAm chi ti\u1EBFt.");
}
async function startLocalService() {
  if (await isLocalServiceReady()) return;
  if (localStartup) return localStartup;
  const root = process.cwd();
  const child = spawn(
    process.env.UV_EXECUTABLE || "uv",
    [
      "run",
      "--no-project",
      "--python",
      "3.13",
      "--with-requirements",
      path2.join(root, "requirements-zerotts.txt"),
      "python",
      path2.join(root, "scripts/zerotts-server.py")
    ],
    {
      cwd: root,
      env: { ...process.env, ZEROTTS_HOST: "127.0.0.1", ZEROTTS_PORT: "4179" },
      stdio: "inherit"
    }
  );
  localProcess = child;
  child.on("error", (error) => {
    console.error("Could not start the local ZeroTTS service:", error);
  });
  child.on("exit", () => {
    if (localProcess === child) localProcess = null;
    localStartup = null;
  });
  localStartup = waitForLocalService(child).finally(() => {
    if (localProcess !== child) localStartup = null;
  });
  return localStartup;
}
async function streamWithZeroTts(sentences) {
  const cleanedSentences = sentences.map((sentence) => sentence.trim()).filter(Boolean);
  const characterCount = cleanedSentences.reduce((total, sentence) => total + sentence.length, 0);
  if (cleanedSentences.length === 0) {
    return new Response(JSON.stringify({ error: "Thi\u1EBFu n\u1ED9i dung c\u1EA7n \u0111\u1ECDc." }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  if (characterCount > MAX_TEXT_CHARACTERS || cleanedSentences.length > 100) {
    return new Response(JSON.stringify({ error: "\u0110o\u1EA1n \u0111\u1ECDc v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 6.000 k\xFD t\u1EF1." }), {
      status: 413,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  const configuredService = process.env.ZEROTTS_URL?.replace(/\/+$/, "");
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!configuredService && isServerless) {
    return new Response(JSON.stringify({
      error: "ZeroTTS ch\u01B0a \u0111\u01B0\u1EE3c n\u1ED1i v\u1EDBi backend suy lu\u1EADn. C\u1EA5u h\xECnh ZEROTTS_URL."
    }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  const endpoint = configuredService ? `${configuredService}/synthesize/stream` : `${LOCAL_ZEROTTS_URL}/synthesize/stream`;
  try {
    if (!configuredService) await startLocalService();
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...process.env.ZEROTTS_API_KEY ? { "X-ZeroTTS-Key": process.env.ZEROTTS_API_KEY } : {}
      },
      body: JSON.stringify({ sentences: cleanedSentences }),
      signal: AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS)
    });
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream"
    });
    const sampleRate = upstream.headers.get("x-audio-sample-rate");
    if (sampleRate) headers.set("X-Audio-Sample-Rate", sampleRate);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ZeroTTS streaming request failed:", message);
    return new Response(JSON.stringify({ error: `Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c ZeroTTS. ${message}` }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}
function canUseZeroTts(headers) {
  return isAuthenticatedApiRequest(headers);
}

// server/zerotts-stream-api.ts
async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).setHeader("Allow", "POST").setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify({ error: "Ch\u1EC9 h\u1ED7 tr\u1EE3 POST." }));
    return;
  }
  if (!canUseZeroTts(request.headers || {})) {
    response.status(401).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify({ error: "\u0110\u0103ng nh\u1EADp \u0111\u1EC3 s\u1EED d\u1EE5ng gi\u1ECDng \u0111\u1ECDc c\u1EE7a l\u1EDBp h\u1ECDc." }));
    return;
  }
  let payload = request.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      response.status(400).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify({ error: "Request TTS kh\xF4ng ph\u1EA3i JSON h\u1EE3p l\u1EC7." }));
      return;
    }
  }
  const sentences = payload && typeof payload === "object" && "sentences" in payload && Array.isArray(payload.sentences) && payload.sentences.every((sentence) => typeof sentence === "string") ? payload.sentences : payload && typeof payload === "object" && "text" in payload && typeof payload.text === "string" ? [payload.text] : [];
  const result = await streamWithZeroTts(sentences);
  response.status(result.status);
  for (const [name, value] of result.headers) response.setHeader(name, value);
  if (!result.body) {
    response.end();
    return;
  }
  const reader = result.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response.write(value);
    }
    response.end();
  } catch (error) {
    console.error("ZeroTTS stream response failed:", error);
    response.end();
  } finally {
    reader.releaseLock();
  }
}
export {
  handler as default
};
