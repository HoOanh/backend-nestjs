// server/tutor-config.ts
var DEFAULT_MODEL = "gemini-3.8-flash";
var SYSTEM_PROMPT = `Em l\xE0 m\u1ED9t tutor k\u1EF9 thu\u1EADt c\u1EE7a Arc Irobot Academy.
Nhi\u1EC7m v\u1EE5: gi\xFAp h\u1ECDc vi\xEAn hi\u1EC3u th\u1EADt ch\u1EAFc b\xE0i h\u1ECDc hi\u1EC7n t\u1EA1i tr\u01B0\u1EDBc khi l\xE0m tr\u1EAFc nghi\u1EC7m.
Quy t\u1EAFc b\u1EAFt bu\u1ED9c:
1. Ch\u1EC9 d\xF9ng th\xF4ng tin trong LESSON_CONTEXT v\xE0 suy lu\u1EADn tr\u1EF1c ti\u1EBFp t\u1EEB \u0111\xF3. Kh\xF4ng b\u1ECBa API, quy \u01B0\u1EDBc ho\u1EB7c ki\u1EBFn th\u1EE9c kh\xF4ng c\xF3 c\u0103n c\u1EE9.
2. Tr\u1EA3 l\u1EDDi b\u1EB1ng ti\u1EBFng Vi\u1EC7t, x\u01B0ng "em", g\u1ECDi ng\u01B0\u1EDDi h\u1ECDc l\xE0 "\u0110\u1EA0I CA". Gi\u1ECDng r\xF5, th\u1EB3ng, k\u1EF9 thu\u1EADt.
3. N\u1EBFu c\xE2u h\u1ECFi ch\u01B0a r\xF5, h\u1ECFi l\u1EA1i \u0111\xFAng m\u1ED9t c\xE2u ng\u1EAFn. N\u1EBFu h\u1ECFi ngo\xE0i b\xE0i, n\xF3i r\xF5 gi\u1EDBi h\u1EA1n r\u1ED3i li\xEAn h\u1EC7 n\xF3 v\u1EDBi kh\xE1i ni\u1EC7m g\u1EA7n nh\u1EA5t trong b\xE0i.
4. Khi gi\u1EA3i th\xEDch code ho\u1EB7c h\xECnh \u1EA3nh s\u01A1 \u0111\u1ED3 ng\u01B0\u1EDDi h\u1ECDc g\u1EEDi l\xEAn, \u0111i t\u1EEB v\u1EA5n \u0111\u1EC1 -> c\u01A1 ch\u1EBF -> v\xED d\u1EE5 -> k\u1EBFt lu\u1EADn ng\u1EAFn. D\xF9ng markdown g\u1ECDn v\xE0 chu\u1EA9n (headings ###, bold **, bullet lists -, code blocks \`\`\`ts).
5. Kh\xF4ng \u0111\u01B0a \u0111\xE1p \xE1n tr\u1EAFc nghi\u1EC7m n\u1EBFu ng\u01B0\u1EDDi h\u1ECDc ch\u01B0a h\u1ECFi; \u01B0u ti\xEAn gi\u1EA3i th\xEDch \u0111\u1EC3 ng\u01B0\u1EDDi h\u1ECDc t\u1EF1 suy lu\u1EADn.
6. N\u1EBFu ng\u01B0\u1EDDi h\u1ECDc h\u1ECFi m\u1ED9t \u0111o\u1EA1n c\u1EE5 th\u1EC3 ho\u1EB7c g\u1EEDi \u1EA3nh s\u01A1 \u0111\u1ED3/l\u1ED7i, t\u1EADp trung ph\xE2n t\xEDch \u0111\xFAng ph\u1EA7n \u0111\xF3, kh\xF4ng lan man.`;

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
function verifyTutorProof(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected) || JSON.parse(Buffer.from(header, "base64url").toString()).alg !== "HS256") {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8")
    );
    if (payload.scope !== "tutor" || typeof payload.userId !== "string" || typeof payload.sessionId !== "string" || !Number.isFinite(payload.exp) || (payload.exp || 0) <= Math.floor(Date.now() / 1e3)) {
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
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), "utf-8");
  fs.renameSync(temporaryPath, filePath);
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
    const payload = verifyJwt(token);
    if (payload) {
      const user = store.users.find((u) => u.id === payload.userId);
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
        status: "active",
        version: user?.version || 1,
        auth_version: payload.authVersion || 0
      };
    }
    if (store.revoked_tokens?.includes(token)) return null;
    const session = store.sessions.find(
      (s) => s.token === token && new Date(s.expires_at) > /* @__PURE__ */ new Date()
    );
    if (session) {
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
      return store.learning_history.filter((h) => h.user_id === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
    }
    return [...store.learning_history].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
  },
  addLearningHistory(history) {
    loadStore();
    store.learning_history.push(history);
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
var TUTOR_PROOF_COOKIE_PREFIX = "arc_tutor_proof_";
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
function getTutorProofCookieName(sessionId) {
  return /^[A-Za-z0-9_-]{1,100}$/.test(sessionId) ? `${TUTOR_PROOF_COOKIE_PREFIX}${sessionId}` : null;
}
function getTutorProofFromCookie(req, sessionId) {
  const cookieHeader = req.headers?.cookie;
  const cookieName = getTutorProofCookieName(sessionId);
  if (typeof cookieHeader !== "string" || !cookieName) return null;
  const entry = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return entry ? entry.slice(cookieName.length + 1) || null : null;
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
function authorizeTutorRequest(headers, sessionId) {
  const request = { headers };
  if (!sessionId) return 401;
  const token = getTokenFromCookie(request);
  const actor = token ? verifyJwt(token) : null;
  const proofToken = getTutorProofFromCookie(request, sessionId);
  const proof = proofToken ? verifyTutorProof(proofToken) : null;
  if (!actor || !proof || proof.sessionId !== sessionId || proof.userId !== actor.userId) {
    return 401;
  }
  return null;
}
function recordTutorTrace(headers, sessionId, level, event, metadata) {
  try {
    const req = { headers };
    const token = getBearerToken(req) || getTokenFromCookie(req);
    const actor = token ? dbService.getSessionByToken(token)?.user : void 0;
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveStore();
  } catch (error) {
    console.error("Kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c trace AI:", error);
  }
}

// server/tutor.ts
function sanitizeModel(model) {
  if (model && /^[a-zA-Z0-9.\-_]+$/.test(model)) {
    return model;
  }
  return DEFAULT_MODEL;
}
async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }
  const traceBody = request.body || {};
  const denied = authorizeTutorRequest(request.headers, traceBody.sessionId);
  if (denied)
    return response.status(denied).json({
      error: denied === 401 ? "Ch\u01B0a \u0111\u0103ng nh\u1EADp" : "Kh\xF4ng c\xF3 quy\u1EC1n s\u1EED d\u1EE5ng phi\xEAn chat n\xE0y"
    });
  const trace = (level, event, metadata) => recordTutorTrace(
    request.headers,
    traceBody.sessionId,
    level,
    event,
    metadata
  );
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    trace("ERROR", "AI_CONFIGURATION_ERROR", { reason: "Missing API key" });
    return response.status(500).json({ error: "Thi\u1EBFu GEMINI_API_KEY tr\xEAn server." });
  }
  const body = request.body || {};
  const lesson = body.lesson;
  const rawMessages = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const model = sanitizeModel(body.model);
  const isStream = body.stream !== false && typeof response.write === "function";
  if (!lesson?.title || rawMessages.length === 0) {
    return response.status(400).json({ error: "D\u1EEF li\u1EC7u b\xE0i h\u1ECDc ho\u1EB7c h\u1ED9i tho\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7." });
  }
  const contents = [];
  for (const message of rawMessages) {
    const role = message.role === "assistant" ? "model" : "user";
    const parts = [];
    if (message.content && message.content.trim()) {
      parts.push({ text: message.content });
    }
    if (message.image?.data && message.image?.mimeType) {
      const cleanBase64 = message.image.data.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: message.image.mimeType,
          data: cleanBase64
        }
      });
    }
    if (parts.length === 0) continue;
    if (contents.length === 0) {
      if (role !== "user") continue;
      contents.push({ role, parts });
    } else {
      const prev = contents[contents.length - 1];
      if (prev.role === role) {
        prev.parts.push(...parts);
      } else {
        contents.push({ role, parts });
      }
    }
  }
  if (contents.length === 0) {
    return response.status(400).json({ error: "Kh\xF4ng t\xECm th\u1EA5y c\xE2u h\u1ECFi h\u1EE3p l\u1EC7 t\u1EEB h\u1ECDc vi\xEAn." });
  }
  const prompt = `${SYSTEM_PROMPT}

LESSON_CONTEXT:
Title: ${lesson.title}
Tag: ${lesson.tag || ""}

${lesson.theory || ""}

REAL_CODE:
${lesson.realCodeSnippet || ""}`;
  const FALLBACK_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "antigravity",
    "gemini-2.5-flash-lite",
    "gemma-4-31b"
  ];
  const modelChain = [model, ...FALLBACK_MODELS.filter((m) => m !== model)].slice(0, 3);
  const requestDeadline = AbortSignal.timeout(24e3);
  let currentActiveModel = model;
  let activeGeminiResponse = null;
  let lastErrorMsg = "";
  try {
    for (let i = 0; i < modelChain.length; i++) {
      const candidate = modelChain[i];
      try {
        const endpoint = isStream ? `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}` : `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const generationConfig = candidate.startsWith("gemini-3.") ? { maxOutputTokens: 2048 } : { temperature: 0.25, maxOutputTokens: 2048 };
        const candidateController = new AbortController();
        const candidateTimeout = setTimeout(
          () => candidateController.abort(),
          7e3
        );
        let candidateResponse;
        try {
          candidateResponse = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.any([
              requestDeadline,
              candidateController.signal
            ]),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: prompt }] },
              contents,
              generationConfig
            })
          });
        } finally {
          clearTimeout(candidateTimeout);
        }
        if (candidateResponse.ok) {
          trace("INFO", "AI_PROVIDER_ACCEPTED", {
            requestedModel: model,
            actualModel: candidate,
            status: candidateResponse.status
          });
          currentActiveModel = candidate;
          activeGeminiResponse = candidateResponse;
          if (candidate !== model) {
            console.info(
              `[Tutor] Silent fallback dispatched to ${candidate} (original requested: ${model})`
            );
          }
          break;
        }
        const errorText = await candidateResponse.text();
        let parsedMsg = `HTTP ${candidateResponse.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            parsedMsg = errorJson.error.message;
          }
        } catch {
        }
        trace("WARN", "AI_PROVIDER_REJECTED", {
          model: candidate,
          status: candidateResponse.status
        });
        lastErrorMsg = `[${candidate}] HTTP ${candidateResponse.status}: ${parsedMsg}`;
        console.warn(
          `Gemini model ${candidate} failed (${candidateResponse.status}): ${parsedMsg}. Trying next 3.x fallback...`
        );
      } catch (subErr) {
        lastErrorMsg = subErr instanceof Error ? subErr.message : "Network error";
        trace("WARN", "AI_PROVIDER_NETWORK_ERROR", { model: candidate });
        console.warn(`Failed to connect to ${candidate}:`, subErr);
      }
    }
    if (!activeGeminiResponse) {
      trace("ERROR", "AI_REQUEST_FAILED", {
        requestedModel: model,
        durationMs: Date.now() - startedAt
      });
      return response.status(503).json({
        error: `M\xE1y ch\u1EE7 AI Google \u0111ang qu\xE1 t\u1EA3i t\u1EA1m th\u1EDDi (${lastErrorMsg}). \u0110\u1EA0I CA vui l\xF2ng th\u1EED l\u1EA1i sau gi\xE2y l\xE1t.`
      });
    }
    const geminiResponse = activeGeminiResponse;
    if (isStream) {
      if (typeof response.setHeader === "function") {
        response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("X-Accel-Buffering", "no");
      }
      if (typeof response.writeHead === "function") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        });
      }
      const reader = geminiResponse.body?.getReader();
      if (!reader) {
        throw new Error("Kh\xF4ng th\u1EC3 \u0111\u1ECDc stream t\u1EEB Gemini.");
      }
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
            if (text && response.write) {
              response.write(`data: ${JSON.stringify({ text })}

`);
            }
          } catch {
          }
        }
      }
      if (buffer.trim().startsWith("data:")) {
        const jsonStr = buffer.trim().replace(/^data:\s*/, "");
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
          if (text && response.write) {
            response.write(`data: ${JSON.stringify({ text })}

`);
          }
        } catch {
        }
      }
      if (response.write) {
        trace("INFO", "AI_STREAM_COMPLETE", {
          actualModel: currentActiveModel,
          durationMs: Date.now() - startedAt
        });
        response.write("data: [DONE]\n\n");
      }
      if (typeof response.end === "function") {
        response.end();
      }
      return;
    }
    const responseText = await geminiResponse.text();
    let data = {};
    try {
      if (responseText.trim()) data = JSON.parse(responseText);
    } catch {
      return response.status(502).json({
        error: `Gemini tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7 (HTTP ${geminiResponse.status}).`
      });
    }
    const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!reply) {
      return response.status(502).json({
        error: data.error?.message || `Gemini kh\xF4ng tr\u1EA3 \u0111\u01B0\u1EE3c c\xE2u tr\u1EA3 l\u1EDDi (HTTP ${geminiResponse.status}).`
      });
    }
    trace("INFO", "AI_RESPONSE_COMPLETE", {
      actualModel: currentActiveModel,
      durationMs: Date.now() - startedAt,
      responseLength: reply.length
    });
    return response.status(200).json({ reply });
  } catch (err) {
    trace("ERROR", "AI_REQUEST_ERROR", {
      actualModel: currentActiveModel,
      durationMs: Date.now() - startedAt
    });
    const errorMsg = err instanceof Error ? err.message : "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c t\u1EDBi Gemini.";
    if (isStream && typeof response.write === "function") {
      response.write(`data: ${JSON.stringify({ error: errorMsg })}

`);
      if (typeof response.end === "function") response.end();
      return;
    }
    return response.status(502).json({ error: errorMsg });
  }
}
export {
  handler as default
};
