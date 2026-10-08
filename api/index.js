// server/data-operations.ts
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
var logTables = ["chat_logs", "audit_logs"];
var defaultRetention = {
  enabled: false,
  chatDays: 30,
  auditDays: 365,
  lastRunAt: null
};
function validatePolicy(value) {
  return typeof value.enabled === "boolean" && Number.isInteger(value.chatDays) && Number(value.chatDays) >= 1 && Number(value.chatDays) <= 3650 && Number.isInteger(value.auditDays) && Number(value.auditDays) >= 365 && Number(value.auditDays) <= 3650;
}
function cleanupPreview(store2, table, before) {
  const rows = store2[table].filter(
    (row) => Number.isFinite(Date.parse(row.timestamp)) && Date.parse(row.timestamp) < Date.parse(before)
  );
  return {
    table,
    before,
    count: rows.length,
    bytes: Buffer.byteLength(JSON.stringify(rows)),
    fingerprint: crypto.createHash("sha256").update(JSON.stringify([table, before, rows])).digest("hex")
  };
}
function archiveDirectory(storePath) {
  return `${storePath}.archives`;
}
function listArchives(storePath) {
  const dir = archiveDirectory(storePath);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /^[0-9a-f-]{36}\.json$/.test(name)).map((name) => {
    const file = path.join(dir, name);
    const archive = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      id: name.slice(0, -5),
      table: archive.table,
      createdAt: archive.createdAt,
      count: archive.rows.length,
      fingerprint: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
      bytes: fs.statSync(file).size,
      reason: archive.reason
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function archiveLogs(store2, storePath, table, before, reason) {
  const preview = cleanupPreview(store2, table, before);
  if (!preview.count) return { ...preview, archiveId: null };
  const rows = store2[table].filter(
    (row) => Date.parse(row.timestamp) < Date.parse(before)
  );
  const archiveId = crypto.randomUUID();
  const dir = archiveDirectory(storePath);
  fs.mkdirSync(dir, { recursive: true, mode: 448 });
  fs.writeFileSync(
    path.join(dir, `${archiveId}.json`),
    JSON.stringify({
      table,
      before,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      reason,
      rows
    }),
    { mode: 384, flag: "wx" }
  );
  const ids = new Set(rows.map((row) => row.id));
  store2[table] = store2[table].filter((row) => !ids.has(row.id));
  return { ...preview, archiveId };
}
function readArchive(storePath, id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("M\xE3 b\u1EA3n l\u01B0u kh\xF4ng h\u1EE3p l\u1EC7");
  const file = path.join(archiveDirectory(storePath), `${id}.json`);
  if (!fs.existsSync(file)) throw new Error("Kh\xF4ng t\xECm th\u1EA5y b\u1EA3n l\u01B0u");
  const archive = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!logTables.includes(archive.table) || !Array.isArray(archive.rows))
    throw new Error("B\u1EA3n l\u01B0u kh\xF4ng h\u1EE3p l\u1EC7");
  return archive;
}
function purgeArchive(storePath, id, fingerprint) {
  const archive = listArchives(storePath).find((item) => item.id === id);
  if (!archive || archive.fingerprint !== fingerprint)
    throw new Error("B\u1EA3n l\u01B0u \u0111\xE3 thay \u0111\u1ED5i ho\u1EB7c kh\xF4ng c\xF2n t\u1ED3n t\u1EA1i");
  fs.unlinkSync(path.join(archiveDirectory(storePath), `${id}.json`));
  return archive;
}

// server/tutor-config.ts
var DEFAULT_MODEL = "gemini-3.8-flash";
var PROMPT_VERSION = "academy-tutor-v1";
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
import fs2 from "fs";
import { AsyncLocalStorage } from "node:async_hooks";
import path2 from "path";
import crypto2 from "crypto";
function hashPassword(password, salt) {
  const generatedSalt = salt || crypto2.randomBytes(16).toString("hex");
  const hash = crypto2.pbkdf2Sync(password, generatedSalt, 1e4, 64, "sha512").toString("hex");
  return { hash, salt: generatedSalt };
}
function verifyPassword(password, hash, salt) {
  const check = crypto2.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return check === hash;
}
function generateSessionToken() {
  return crypto2.randomBytes(32).toString("hex");
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
  const directory = path2.resolve(process.cwd(), "data");
  fs2.mkdirSync(directory, { recursive: true });
  const location = path2.join(directory, "auth-secret.local");
  if (!fs2.existsSync(location)) {
    try {
      fs2.writeFileSync(location, crypto2.randomBytes(48).toString("hex"), {
        mode: 384,
        flag: "wx"
      });
    } catch (error) {
      if (!fs2.existsSync(location)) throw error;
    }
  }
  return fs2.readFileSync(location, "utf-8").trim();
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
    authVersion: user.auth_version || 0
  };
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto2.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
function verifyJwt(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto2.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !crypto2.timingSafeEqual(received, expected))
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
function signTutorProof(userId, sessionId) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const payload = {
    userId,
    sessionId,
    scope: "tutor",
    exp: Math.floor(Date.now() / 1e3) + 120
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto2.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
function verifyTutorProof(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto2.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !crypto2.timingSafeEqual(received, expected) || JSON.parse(Buffer.from(header, "base64url").toString()).alg !== "HS256") {
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
    const location = path2.resolve(process.env.ARC_STORE_PATH);
    fs2.mkdirSync(path2.dirname(location), { recursive: true });
    return location;
  }
  const isVercel = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
  if (isVercel) {
    return "/tmp/arc_irobot_store.json";
  }
  const dataDir = path2.resolve(process.cwd(), "data");
  if (!fs2.existsSync(dataDir)) {
    try {
      fs2.mkdirSync(dataDir, { recursive: true });
    } catch {
    }
  }
  return path2.join(dataDir, "arc_irobot_store.json");
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
    if (fs2.existsSync(filePath)) {
      const raw = fs2.readFileSync(filePath, "utf-8");
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
    id: crypto2.randomUUID(),
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
  const persisted = fs2.existsSync(filePath) ? JSON.parse(fs2.readFileSync(filePath, "utf8")) : {};
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
  fs2.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), "utf-8");
  fs2.renameSync(temporaryPath, filePath);
}
function operationsEvidence(operation, before, after) {
  const context = auditContext.getStore();
  store.audit_logs.push({
    id: crypto2.randomUUID(),
    requestId: context?.requestId || crypto2.randomUUID(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    actor: context?.actor || null,
    source: context ? "user" : "system",
    schemaVersion: 2,
    operation,
    method: context?.method || "SYSTEM",
    path: context?.path || "/system/retention",
    action: "UPDATE",
    entity: "data_operations",
    before,
    after,
    changedFields: [operation],
    outcome: "PERSISTED",
    status: null,
    durationMs: 0
  });
}
function runRetention() {
  const policy = store.retention || defaultRetention;
  if (!policy.enabled || policy.lastRunAt && Date.now() - Date.parse(policy.lastRunAt) < 864e5)
    return;
  for (const table of logTables) {
    const days = table === "chat_logs" ? policy.chatDays : policy.auditDays;
    const before = new Date(Date.now() - days * 864e5).toISOString();
    const result = archiveLogs(
      store,
      getStoreFilePath(),
      table,
      before,
      "T\u1EF1 \u0111\u1ED9ng theo c\u1EA5u h\xECnh retention"
    );
    if (result.count) operationsEvidence("retention.archive", null, result);
  }
  store.retention = { ...policy, lastRunAt: (/* @__PURE__ */ new Date()).toISOString() };
  saveStore();
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
    const envPath = path2.resolve(process.cwd(), ".env");
    if (fs2.existsSync(envPath)) {
      const content = fs2.readFileSync(envPath, "utf-8");
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
    id: crypto2.randomUUID(),
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
      id: "sess_" + Date.now() + "_" + crypto2.randomBytes(4).toString("hex"),
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
    if (store.revoked_tokens && store.revoked_tokens.includes(token)) {
      return null;
    }
    const payload = verifyJwt(token);
    if (payload) {
      const user = store.users.find((u) => u.id === payload.userId);
      return !user || user.status === "suspended" || (payload.authVersion || 0) !== (user.auth_version || 0) ? null : user;
    }
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
function setSessionCookie(res, token) {
  if (typeof res.setHeader === "function") {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly; Secure`
    );
  }
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
function setTutorProofCookie(res, sessionId, userId) {
  const cookieName = getTutorProofCookieName(sessionId);
  if (!cookieName || typeof res.setHeader !== "function") return false;
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${signTutorProof(userId, sessionId)}; Path=/api/tutor; Max-Age=120; SameSite=Strict; HttpOnly; Secure`
  );
  res.setHeader("Cache-Control", "no-store");
  return true;
}
function clearSessionCookie(res) {
  if (typeof res.setHeader === "function") {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure`
    );
  }
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
      id: crypto2.randomUUID(),
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
async function handleApiRequest(req, res) {
  const method = (req.method || "GET").toUpperCase();
  const requestId = crypto2.randomUUID();
  res.setHeader?.("X-Request-ID", requestId);
  let status = 200;
  let errorMessage;
  try {
    loadStore();
    runRetention();
    const token = getBearerToken(req) || getTokenFromCookie(req);
    const user = token ? dbService.getSessionByToken(token)?.user : void 0;
    const context = {
      requestId,
      actor: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
      method,
      path: (req.url || "").split("?")[0],
      userAgent: typeof req.headers?.["user-agent"] === "string" ? req.headers["user-agent"] : void 0,
      startedAt: Date.now(),
      baseline: auditSnapshot()
    };
    const wrapped = {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        const data = payload && typeof payload === "object" ? payload : {};
        if (typeof data.error === "string") errorMessage = data.error;
        if (!context.actor && status < 400 && context.path.startsWith("/api/auth/") && data.user) {
          const authenticated = data.user;
          context.actor = {
            id: authenticated.id,
            name: authenticated.name,
            email: authenticated.email,
            role: authenticated.role
          };
        }
        if (method !== "GET" || status >= 400) {
          loadStore();
          if (context.actor) {
            for (const entry of store.audit_logs)
              if (entry.requestId === context.requestId && !entry.actor) {
                entry.actor = context.actor;
                entry.source = "user";
              }
          }
          store.audit_logs.push({
            ...auditBase(context),
            action: "REQUEST",
            entity: "request",
            before: null,
            after: null,
            changedFields: [],
            outcome: status >= 400 ? "FAILURE" : "SUCCESS",
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
  } catch (error) {
    res.status(500).json({
      error: `Kh\xF4ng x\u1EED l\xFD \u0111\u01B0\u1EE3c request ${requestId}: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}
async function handleApiRequestInner(req, res) {
  loadStore();
  const url = req.url || "";
  const rawPathname = url.split("?")[0];
  const pathname = rawPathname.startsWith("/api") ? rawPathname : "/api" + rawPathname;
  const method = (req.method || "GET").toUpperCase();
  const queryString = url.includes("?") ? url.split("?")[1] : "";
  const queryParams = new URLSearchParams(queryString);
  const reqBody = req.body && typeof req.body === "object" ? req.body : {};
  try {
    if (pathname.startsWith("/api/certificates/verify/") && method === "GET") {
      const cert = dbService.getCertificateByCode(
        decodeURIComponent(pathname.split("/").pop() || "")
      );
      if (!cert) {
        res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ch\u1EE9ng ch\u1EC9" });
        return;
      }
      res.status(200).json({
        code: cert.certificate_code,
        studentName: cert.student_name,
        type: cert.type || "exam",
        status: cert.status || "issued",
        issuedAt: cert.completed_at
      });
      return;
    }
    if (pathname.startsWith("/api/chat/") || pathname.startsWith("/api/admin/")) {
      const token = getBearerToken(req) || getTokenFromCookie(req);
      const session = token ? dbService.getSessionByToken(token) : null;
      if (!session) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const actor = session.user;
      const isAdmin = actor.role === "admin";
      loadStore();
      if (pathname.startsWith("/api/admin/")) {
        if (!isAdmin) {
          res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n qu\u1EA3n tr\u1ECB" });
          return;
        }
        if (pathname === "/api/admin/data-operations") {
          const action = reqBody.action;
          const reason = typeof reqBody.reason === "string" ? reqBody.reason.trim() : "";
          const policy = store.retention || defaultRetention;
          if (method === "GET") {
            res.status(200).json({
              policy,
              archives: listArchives(getStoreFilePath()),
              scheduler: "Ki\u1EC3m tra m\u1ED7i 24 gi\u1EDD khi c\xF3 request; kh\xF4ng ch\u1EA1y khi server ng\u1EEBng ho\u1EA1t \u0111\u1ED9ng."
            });
            return;
          }
          if (method !== "POST") {
            res.status(405).json({ error: "Ph\u01B0\u01A1ng th\u1EE9c kh\xF4ng h\u1EE3p l\u1EC7" });
            return;
          }
          if (action === "preview" || action === "cleanup") {
            const table2 = reqBody.table;
            const before = String(reqBody.before || "");
            const minDays = table2 === "audit_logs" ? 365 : 1;
            if (!logTables.includes(table2) || !Number.isFinite(Date.parse(before)) || Date.parse(before) > Date.now() - minDays * 864e5) {
              res.status(400).json({
                error: "Ch\u1EC9 d\u1ECDn trace c\u0169 h\u01A1n 1 ng\xE0y ho\u1EB7c audit c\u0169 h\u01A1n 365 ng\xE0y"
              });
              return;
            }
            const preview = cleanupPreview(store, table2, before);
            if (action === "preview") {
              res.status(200).json(preview);
              return;
            }
            if (reason.length < 5) {
              res.status(400).json({ error: "C\u1EA7n l\xFD do \xEDt nh\u1EA5t 5 k\xFD t\u1EF1" });
              return;
            }
            if (reqBody.fingerprint !== preview.fingerprint) {
              res.status(409).json({ error: "D\u1EEF li\u1EC7u \u0111\xE3 \u0111\u1ED5i, h\xE3y xem tr\u01B0\u1EDBc l\u1EA1i" });
              return;
            }
            const result = archiveLogs(
              store,
              getStoreFilePath(),
              table2,
              before,
              reason
            );
            operationsEvidence("manual.archive", null, { ...result, reason });
            saveStore();
            res.status(200).json(result);
            return;
          }
          if (reason.length < 5) {
            res.status(400).json({ error: "C\u1EA7n l\xFD do \xEDt nh\u1EA5t 5 k\xFD t\u1EF1" });
            return;
          }
          if (action === "policy") {
            if (!validatePolicy(reqBody)) {
              res.status(400).json({
                error: "Trace 1\u20133650 ng\xE0y; audit 365\u20133650 ng\xE0y; enabled ph\u1EA3i l\xE0 boolean"
              });
              return;
            }
            store.retention = {
              enabled: reqBody.enabled,
              chatDays: Number(reqBody.chatDays),
              auditDays: Number(reqBody.auditDays),
              lastRunAt: null
            };
            operationsEvidence("retention.policy", policy, {
              ...store.retention,
              reason
            });
            saveStore();
            res.status(200).json({ policy: store.retention });
            return;
          }
          if (action === "purge") {
            const archiveId = String(reqBody.archiveId || "");
            const archive = listArchives(getStoreFilePath()).find(
              (item) => item.id === archiveId
            );
            if (!archive || reqBody.confirmId !== archiveId || reqBody.fingerprint !== archive.fingerprint) {
              res.status(409).json({
                error: "Nh\u1EADp \u0111\xFAng m\xE3 b\u1EA3n l\u01B0u v\xE0 t\u1EA3i l\u1EA1i n\u1EBFu d\u1EEF li\u1EC7u \u0111\xE3 \u0111\u1ED5i"
              });
              return;
            }
            operationsEvidence("archive.purge.requested", archive, { reason });
            saveStore();
            purgeArchive(getStoreFilePath(), archiveId, archive.fingerprint);
            res.status(200).json({ count: archive.count, freedBytes: archive.bytes });
            return;
          }
          if (action === "restore") {
            let archive;
            try {
              archive = readArchive(
                getStoreFilePath(),
                String(reqBody.archiveId || "")
              );
            } catch (error) {
              res.status(400).json({
                error: error instanceof Error ? error.message : "Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c b\u1EA3n l\u01B0u"
              });
              return;
            }
            const existing = new Set(store[archive.table].map((row) => row.id));
            const missing = archive.rows.filter((row) => !existing.has(row.id));
            if (archive.table === "audit_logs")
              store.audit_logs.push(...missing);
            else
              store.chat_logs.push(
                ...missing
              );
            store[archive.table].sort(
              (a, b) => a.timestamp.localeCompare(b.timestamp)
            );
            store.retention = { ...policy, enabled: false };
            operationsEvidence("archive.restore", null, {
              archiveId: reqBody.archiveId,
              count: missing.length,
              reason,
              automationDisabled: true
            });
            saveStore();
            res.status(200).json({ count: missing.length });
            return;
          }
          res.status(400).json({ error: "Thao t\xE1c kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        if (pathname === "/api/admin/exports" && method === "POST") {
          const kind = reqBody.kind;
          const origin = reqBody.origin || "real";
          const query = String(reqBody.q || "").toLowerCase();
          const from = String(reqBody.from || "");
          const to = String(reqBody.to || "");
          if (!["users", "logs", "audit"].includes(String(kind)) || !["real", "test", "all"].includes(String(origin)) || from && to && from > to) {
            res.status(400).json({ error: "B\u1ED9 l\u1ECDc xu\u1EA5t kh\xF4ng h\u1EE3p l\u1EC7" });
            return;
          }
          const selectedUsers = store.users.filter(
            (u) => origin === "all" || (origin === "test" ? isTestUser(u) : !isTestUser(u))
          );
          const ids = new Set(selectedUsers.map((u) => u.id));
          let rows2 = [];
          if (kind === "users")
            rows2 = selectedUsers.filter(
              (u) => (!reqBody.role || u.role === reqBody.role) && `${u.name} ${u.email}`.toLowerCase().includes(query)
            ).map(formatUserResponse);
          if (kind === "logs")
            rows2 = store.learning_history.filter(
              (h) => ids.has(h.user_id) && (!reqBody.action || h.action === reqBody.action) && (!from || h.timestamp.slice(0, 10) >= from) && (!to || h.timestamp.slice(0, 10) <= to) && `${store.users.find((u) => u.id === h.user_id)?.name} ${store.users.find((u) => u.id === h.user_id)?.email} ${h.lesson_title} ${h.details}`.toLowerCase().includes(query)
            );
          if (kind === "audit")
            rows2 = store.audit_logs.filter(
              (e) => (!reqBody.requestId || e.requestId === reqBody.requestId) && (!reqBody.entityId || e.entityId === reqBody.entityId) && (!reqBody.entity || e.entity === reqBody.entity) && (!reqBody.outcome || e.outcome === reqBody.outcome) && (!reqBody.actorSearch || `${e.actor?.name} ${e.actor?.email}`.toLowerCase().includes(String(reqBody.actorSearch).toLowerCase())) && (!from || e.timestamp >= from) && (!to || e.timestamp <= to)
            );
          if (kind === "audit") {
            const matchedIds = new Set(
              rows2.map((e) => e.requestId)
            );
            const grouped = /* @__PURE__ */ new Map();
            for (const e of store.audit_logs)
              if (matchedIds.has(e.requestId))
                grouped.set(e.requestId, [
                  ...grouped.get(e.requestId) || [],
                  e
                ]);
            rows2 = Array.from(grouped.values()).filter(
              (events) => reqBody.technical === "true" || events.some(
                (e) => e.outcome === "FAILURE" || e.changedFields.some(
                  (field) => !["updated_at", "last_login_at"].includes(field)
                ) || e.path.includes("/auth/") || e.method !== "GET" && e.path.startsWith("/api/admin/")
              )
            ).flat();
          }
          if (rows2.length > 1e4) {
            res.status(400).json({
              error: "T\u1ED1i \u0111a 10.000 b\u1EA3n ghi m\u1ED7i l\u1EA7n xu\u1EA5t. H\xE3y thu h\u1EB9p b\u1ED9 l\u1ECDc"
            });
            return;
          }
          res.status(200).json({
            rows: redactAudit(rows2),
            count: rows2.length,
            generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            requestId: auditContext.getStore()?.requestId
          });
          return;
        }
        if (pathname === "/api/admin/stats" && method === "GET") {
          res.status(200).json({ success: true, stats: dbService.getAdminStats() });
          return;
        }
        if (pathname === "/api/admin/certificates" && method === "GET") {
          res.status(200).json({ certificates: store.certificates });
          return;
        }
        if (pathname === "/api/admin/certificates" && method === "POST") {
          const user = store.users.find((u) => u.id === reqBody.userId);
          if (!user || user.role !== "student" || user.status === "suspended") {
            res.status(400).json({ error: "Ch\u1EC9 c\u1EA5p ch\u1EE9ng ch\u1EC9 cho h\u1ECDc vi\xEAn \u0111ang ho\u1EA1t \u0111\u1ED9ng" });
            return;
          }
          if (!["manual", "honorary"].includes(String(reqBody.type)) || typeof reqBody.reason !== "string" || reqBody.reason.trim().length < 5 || typeof reqBody.idempotencyKey !== "string" || !reqBody.idempotencyKey) {
            res.status(400).json({
              error: "C\u1EA7n lo\u1EA1i ch\u1EE9ng ch\u1EC9, l\xFD do \xEDt nh\u1EA5t 5 k\xFD t\u1EF1 v\xE0 m\xE3 ch\u1ED1ng tr\xF9ng"
            });
            return;
          }
          const duplicate = store.certificates.find(
            (c) => c.idempotency_key === reqBody.idempotencyKey
          );
          if (duplicate) {
            if (duplicate.user_id !== user.id || duplicate.type !== reqBody.type || duplicate.reason !== reqBody.reason.trim()) {
              res.status(409).json({ error: "M\xE3 ch\u1ED1ng tr\xF9ng \u0111\xE3 d\xF9ng cho n\u1ED9i dung kh\xE1c" });
              return;
            }
            res.status(200).json({ certificate: duplicate });
            return;
          }
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const certificate = {
            id: crypto2.randomUUID(),
            certificate_code: "ARC-" + crypto2.randomUUID().slice(0, 8).toUpperCase(),
            user_id: user.id,
            student_name: user.name,
            score: null,
            completed_at: now,
            type: reqBody.type,
            status: "issued",
            issued_by: actor.id,
            reason: reqBody.reason.trim(),
            idempotency_key: reqBody.idempotencyKey
          };
          store.certificates.push(certificate);
          store.learning_history.push({
            id: crypto2.randomUUID(),
            user_id: user.id,
            action: "certificate_issued",
            lesson_title: "Ch\u1EE9ng ch\u1EC9 c\u1EA5p th\u1EE7 c\xF4ng",
            details: `${certificate.certificate_code} \xB7 ${certificate.type} \xB7 ${certificate.reason}`,
            timestamp: now
          });
          saveStore();
          res.status(201).json({ certificate });
          return;
        }
        if (/^\/api\/admin\/certificates\/[^/]+\/revoke$/.test(pathname) && method === "POST") {
          const certificate = store.certificates.find(
            (c) => c.id === pathname.split("/")[4]
          );
          if (!certificate) {
            res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ch\u1EE9ng ch\u1EC9" });
            return;
          }
          if (typeof reqBody.reason !== "string" || reqBody.reason.trim().length < 5) {
            res.status(400).json({ error: "C\u1EA7n l\xFD do thu h\u1ED3i \xEDt nh\u1EA5t 5 k\xFD t\u1EF1" });
            return;
          }
          if (certificate.status !== "revoked") {
            certificate.status = "revoked";
            certificate.revoked_at = (/* @__PURE__ */ new Date()).toISOString();
            certificate.revoked_by = actor.id;
            certificate.revoke_reason = reqBody.reason.trim();
            saveStore();
          }
          res.status(200).json({ certificate });
          return;
        }
        if (/^\/api\/admin\/users\/[^/]+\/(suspend|restore|entitlements)$/.test(
          pathname
        ) && method === "POST") {
          const user = store.users.find((u) => u.id === pathname.split("/")[4]);
          const command = pathname.split("/")[5];
          if (!user) {
            res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n" });
            return;
          }
          if (typeof reqBody.reason !== "string" || reqBody.reason.trim().length < 5) {
            res.status(400).json({ error: "C\u1EA7n l\xFD do \xEDt nh\u1EA5t 5 k\xFD t\u1EF1" });
            return;
          }
          if (user.id === actor.id || user.role !== "student") {
            res.status(409).json({ error: "T\xE1c v\u1EE5 n\xE0y ch\u1EC9 d\xE0nh cho h\u1ECDc vi\xEAn" });
            return;
          }
          if (reqBody.expectedVersion !== void 0 && reqBody.expectedVersion !== (user.version || 1)) {
            res.status(409).json({ error: "T\xE0i kho\u1EA3n \u0111\xE3 thay \u0111\u1ED5i. H\xE3y t\u1EA3i l\u1EA1i" });
            return;
          }
          if (command === "entitlements") {
            if (typeof reqBody.idempotencyKey !== "string" || !reqBody.idempotencyKey) {
              res.status(400).json({ error: "Thi\u1EBFu m\xE3 ch\u1ED1ng tr\xF9ng" });
              return;
            }
            const duplicate = store.entitlements.find(
              (e) => e.idempotency_key === reqBody.idempotencyKey
            );
            if (duplicate && (duplicate.user_id !== user.id || duplicate.reason !== reqBody.reason.trim())) {
              res.status(409).json({ error: "M\xE3 ch\u1ED1ng tr\xF9ng \u0111\xE3 d\xF9ng cho h\u1ECDc vi\xEAn kh\xE1c" });
              return;
            }
            if (!duplicate) {
              store.entitlements.push({
                id: crypto2.randomUUID(),
                user_id: user.id,
                scope: "course",
                issued_by: actor.id,
                reason: reqBody.reason.trim(),
                created_at: (/* @__PURE__ */ new Date()).toISOString(),
                idempotency_key: reqBody.idempotencyKey
              });
              saveStore();
            }
          } else {
            if (command === "suspend") {
              user.auth_version = (user.auth_version || 0) + 1;
              store.sessions = store.sessions.filter(
                (session2) => session2.user_id !== user.id
              );
            }
            user.status = command === "suspend" ? "suspended" : "active";
            user.version = (user.version || 1) + 1;
            saveStore();
          }
          res.status(200).json({ success: true });
          return;
        }
        if (pathname.startsWith("/api/admin/") && ![
          "/api/admin/audit",
          "/api/admin/ai",
          "/api/admin/database"
        ].includes(pathname)) {
          res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ch\u1EE9c n\u0103ng qu\u1EA3n tr\u1ECB" });
          return;
        }
        if (pathname === "/api/admin/audit") {
          if (method !== "GET") {
            res.status(405).json({ error: "Audit trail ch\u1EC9 cho ph\xE9p \u0111\u1ECDc" });
            return;
          }
          const actorId = queryParams.get("actorId");
          const requestId = queryParams.get("requestId");
          const entity = queryParams.get("entity");
          const entityId = queryParams.get("entityId");
          const outcome = queryParams.get("outcome");
          const from = queryParams.get("from");
          const to = queryParams.get("to");
          const offset2 = Math.max(0, Number(queryParams.get("offset")) || 0);
          if (from && !Number.isFinite(Date.parse(from)) || to && !Number.isFinite(Date.parse(to)) || from && to && from > to) {
            res.status(400).json({ error: "Kho\u1EA3ng th\u1EDDi gian kh\xF4ng h\u1EE3p l\u1EC7" });
            return;
          }
          const actorSearch = (queryParams.get("actorSearch") || "").toLowerCase();
          const filtered = store.audit_logs.filter(
            (log) => (!actorId || log.actor?.id === actorId) && (!actorSearch || `${log.actor?.name} ${log.actor?.email}`.toLowerCase().includes(actorSearch)) && (!requestId || log.requestId === requestId) && (!entity || log.entity === entity) && (!entityId || log.entityId === entityId) && (!outcome || log.outcome === outcome) && (!from || log.timestamp >= from) && (!to || log.timestamp <= to)
          ).reverse();
          if (queryParams.get("group") === "true") {
            const matchedIds = new Set(filtered.map((log) => log.requestId));
            const groups = /* @__PURE__ */ new Map();
            for (const log of store.audit_logs)
              if (matchedIds.has(log.requestId))
                groups.set(log.requestId, [
                  ...groups.get(log.requestId) || [],
                  log
                ]);
            const grouped = Array.from(groups.values()).reverse().filter(
              (events) => queryParams.get("technical") === "true" || events.some(
                (e) => e.outcome === "FAILURE" || e.changedFields.some(
                  (field) => !["updated_at", "last_login_at"].includes(field)
                ) || e.path.includes("/auth/") || e.method !== "GET" && e.path.startsWith("/api/admin/")
              )
            );
            res.status(200).json({
              groups: grouped.slice(offset2, offset2 + 25),
              total: grouped.length,
              temporary: !process.env.ARC_STORE_PATH && Boolean(
                process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
              )
            });
            return;
          }
          res.status(200).json({
            logs: filtered.slice(offset2, offset2 + 100),
            total: filtered.length,
            offset: offset2,
            temporary: Boolean(
              process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
            )
          });
          return;
        }
        if (pathname === "/api/admin/ai" && method === "GET") {
          res.status(200).json({
            configured: Boolean(process.env.GEMINI_API_KEY),
            defaultModel: DEFAULT_MODEL,
            prompt: SYSTEM_PROMPT,
            promptVersion: PROMPT_VERSION
          });
          return;
        }
        const tables = {
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
        const duplicateEmails = store.users.length - new Set(store.users.map((u) => u.email.toLowerCase())).size;
        const table = queryParams.get("table");
        if (table && !Object.hasOwn(tables, table)) {
          res.status(400).json({ error: "B\u1EA3ng kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        if (method !== "GET") {
          res.status(405).json({ error: "D\u1EEF li\u1EC7u ch\u1EC9 cho ph\xE9p \u0111\u1ECDc" });
          return;
        }
        const term = (queryParams.get("q") || "").toLowerCase();
        const rows = table ? tables[table].filter(
          (row) => !term || JSON.stringify(row).toLowerCase().includes(term)
        ) : [];
        const offset = Math.max(0, Number(queryParams.get("offset")) || 0);
        res.status(200).json({
          usage: {
            fileBytes: fs2.existsSync(getStoreFilePath()) ? fs2.statSync(getStoreFilePath()).size : 0,
            logicalBytes: Buffer.byteLength(JSON.stringify(store)),
            archiveBytes: listArchives(getStoreFilePath()).reduce(
              (total, archive) => total + archive.bytes,
              0
            ),
            totalRecords: Object.values(store).reduce(
              (total, value) => total + (Array.isArray(value) ? value.length : 0),
              0
            )
          },
          health: {
            persistentPathConfigured: Boolean(process.env.ARC_STORE_PATH),
            sharedDatabase: false,
            duplicateEmails,
            updatedAt: fs2.existsSync(getStoreFilePath()) ? fs2.statSync(getStoreFilePath()).mtime.toISOString() : null
          },
          engine: "JSON file",
          temporary: !process.env.ARC_STORE_PATH && Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
          tables: Object.entries(tables).map(([name, rows2]) => ({
            name,
            count: rows2.length,
            bytes: Buffer.byteLength(
              JSON.stringify(store[name] || [])
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
        reqBody.sessionId || queryParams.get("sessionId") || ""
      );
      const owned = ownedSessions.find((s) => s.id === sessionId);
      const deny = () => {
        res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn chat" });
      };
      if (pathname === "/api/chat/sessions/tutor-proof" && method === "POST") {
        if (!owned) {
          deny();
          return;
        }
        if (!setTutorProofCookie(res, owned.id, actor.id)) {
          res.status(400).json({ error: "Session ID kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        res.status(200).json({ success: true });
        return;
      }
      if (pathname === "/api/chat/sessions" && method === "GET") {
        const lessonId = queryParams.get("lessonId");
        const userId = queryParams.get("userId") || actor.id;
        res.status(200).json({
          sessions: ownedSessions.filter(
            (s) => (!lessonId || s.lessonId === lessonId) && s.userId === userId
          ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        });
        return;
      }
      if (pathname === "/api/chat/sessions" && method === "POST") {
        if (typeof reqBody.lessonId !== "string" || !reqBody.lessonId) {
          res.status(400).json({ error: "Thi\u1EBFu lessonId" });
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const created = {
          id: crypto2.randomUUID(),
          userId: actor.id,
          lessonId: reqBody.lessonId,
          title: typeof reqBody.title === "string" ? reqBody.title : "H\u1ED9i tho\u1EA1i m\u1EDBi",
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
      if (pathname === "/api/chat/sessions" && (method === "PATCH" || method === "DELETE")) {
        if (!owned) {
          deny();
          return;
        }
        if (method === "PATCH") {
          owned.title = String(reqBody.title || owned.title);
          owned.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
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
      if (pathname === "/api/chat/messages" && method === "GET") {
        if (!owned) {
          deny();
          return;
        }
        res.status(200).json({
          messages: store.chat_messages.filter((m) => m.sessionId === sessionId)
        });
        return;
      }
      if (pathname === "/api/chat/messages" && method === "POST") {
        if (!owned) {
          deny();
          return;
        }
        if (!["user", "assistant", "system"].includes(String(reqBody.role)) || typeof reqBody.content !== "string") {
          res.status(400).json({ error: "Tin nh\u1EAFn kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const msg = {
          id: crypto2.randomUUID(),
          sessionId,
          lessonId: owned.lessonId,
          userId: owned.userId,
          role: reqBody.role,
          content: reqBody.content,
          image: reqBody.image,
          model: typeof reqBody.model === "string" ? reqBody.model : void 0,
          createdAt: now
        };
        store.chat_messages.push(msg);
        owned.messageCount++;
        owned.updatedAt = now;
        owned.lastMessageAt = now;
        if (msg.role === "user" && owned.messageCount <= 2 && msg.content.trim())
          owned.title = msg.content.slice(0, 32);
        saveStore();
        res.status(201).json({ message: msg });
        return;
      }
      if (pathname === "/api/chat/messages" && method === "PATCH") {
        const msg = store.chat_messages.find(
          (m) => m.id === reqBody.messageId && ownedSessions.some((s) => s.id === m.sessionId)
        );
        if (!msg) {
          deny();
          return;
        }
        msg.content = String(reqBody.content || "");
        saveStore();
        res.status(200).json({ success: true });
        return;
      }
      if (pathname === "/api/chat/logs" && method === "POST") {
        if (sessionId && !owned) {
          deny();
          return;
        }
        if (!["INFO", "WARN", "ERROR", "DEBUG"].includes(String(reqBody.level)) || typeof reqBody.event !== "string" || typeof reqBody.message !== "string") {
          res.status(400).json({ error: "Log kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        store.chat_logs.push({
          id: crypto2.randomUUID(),
          userId: actor.id,
          sessionId: sessionId || void 0,
          lessonId: owned?.lessonId,
          level: reqBody.level,
          event: reqBody.event,
          message: reqBody.message,
          metadata: reqBody.metadata,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        saveStore();
        res.status(201).json({ success: true });
        return;
      }
      if (pathname === "/api/chat/logs" && method === "GET") {
        const limit = Math.min(
          500,
          Math.max(1, Number(queryParams.get("limit")) || 100)
        );
        res.status(200).json({
          logs: store.chat_logs.filter(
            (l) => (isAdmin || l.userId === actor.id) && (!sessionId || l.sessionId === sessionId) && (!queryParams.get("lessonId") || l.lessonId === queryParams.get("lessonId")) && (!queryParams.get("level") || l.level === queryParams.get("level"))
          ).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit)
        });
        return;
      }
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    if (["POST", "PATCH", "DELETE", "PUT"].includes(method) && !pathname.startsWith("/api/auth/")) {
      const context = auditContext.getStore();
      const actor = context?.actor;
      if (!actor) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const bodyUserId = typeof reqBody.userId === "string" ? reqBody.userId : void 0;
      const adminOnly = pathname.startsWith("/api/users") || pathname.startsWith("/api/plans");
      if (adminOnly && actor.role !== "admin" || bodyUserId && bodyUserId !== actor.id && actor.role !== "admin") {
        res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n th\u1EF1c hi\u1EC7n thao t\xE1c" });
        return;
      }
    }
    if (method === "GET" && (pathname.startsWith("/api/progress") || pathname === "/api/history")) {
      const token = getBearerToken(req) || getTokenFromCookie(req);
      const reader = token ? dbService.getAuthUser(token) : null;
      if (!reader) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const target = queryParams.get("userId") || (pathname.startsWith("/api/progress") ? pathname.split("/")[3] : void 0);
      if (reader.role !== "admin" && target !== reader.id) {
        res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n \u0111\u1ECDc d\u1EEF li\u1EC7u n\xE0y" });
        return;
      }
    }
    if (["POST", "PATCH"].includes(method) && (pathname === "/api/auth/register" || pathname.startsWith("/api/users"))) {
      const targetId = pathname.split("/")[3];
      const existing = targetId ? dbService.getUserById(targetId) : null;
      if (reqBody.email !== void 0 || method === "POST") {
        const email = typeof reqBody.email === "string" ? reqBody.email.trim().toLowerCase() : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          res.status(400).json({ error: "Email kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        if (email !== existing?.email.toLowerCase() && store.users.some(
          (u) => u.email.toLowerCase() === email && u.id !== targetId
        )) {
          res.status(409).json({ error: "Email \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng" });
          return;
        }
        reqBody.email = email;
      }
      if (method === "POST" && (!reqBody.name || typeof reqBody.name !== "string" || !reqBody.name.trim()) || reqBody.name !== void 0 && (typeof reqBody.name !== "string" || !reqBody.name.trim())) {
        res.status(400).json({ error: "H\u1ECD t\xEAn kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng" });
        return;
      }
      if (pathname === "/api/users" && (typeof reqBody.password !== "string" || reqBody.password.length < 8)) {
        res.status(400).json({
          error: "C\u1EA7n m\u1EADt kh\u1EA9u ri\xEAng \xEDt nh\u1EA5t 8 k\xFD t\u1EF1; kh\xF4ng d\xF9ng m\u1EADt kh\u1EA9u m\u1EB7c \u0111\u1ECBnh"
        });
        return;
      }
      if (pathname.startsWith("/api/users")) {
        if (reqBody.dataOrigin !== void 0 && !["real", "test"].includes(String(reqBody.dataOrigin))) {
          res.status(400).json({ error: "Ngu\u1ED3n d\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        if (reqBody.role !== void 0 && !["student", "admin", "instructor"].includes(String(reqBody.role))) {
          res.status(400).json({ error: "Vai tr\xF2 kh\xF4ng h\u1EE3p l\u1EC7" });
          return;
        }
        const plan = reqBody.planId ?? reqBody.plan_id;
        if (plan !== void 0 && !store.plans.some(
          (p) => p.id === plan && (p.is_active || existing?.plan_id === plan)
        )) {
          res.status(400).json({ error: "G\xF3i h\u1ECDc kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 ng\u1EEBng c\u1EA5p m\u1EDBi" });
          return;
        }
        if (reqBody.auth_provider !== void 0) {
          res.status(400).json({
            error: "Kh\xF4ng \u0111\u1ED5i ph\u01B0\u01A1ng th\u1EE9c x\xE1c th\u1EF1c b\u1EB1ng ch\u1EC9nh s\u1EEDa h\u1ED3 s\u01A1"
          });
          return;
        }
      }
    }
    if (method === "POST" && [
      "/api/history",
      "/api/progress",
      "/api/exams/submit-final",
      "/api/exams/submit-sprint"
    ].includes(pathname)) {
      if (typeof reqBody.userId !== "string" || !dbService.getUserById(reqBody.userId)) {
        res.status(400).json({ error: "H\u1ECDc vi\xEAn kh\xF4ng t\u1ED3n t\u1EA1i" });
        return;
      }
      if (reqBody.score !== void 0 && (typeof reqBody.score !== "number" || !Number.isFinite(reqBody.score) || reqBody.score < 0 || reqBody.score > 100)) {
        res.status(400).json({ error: "\u0110i\u1EC3m ph\u1EA3i trong kho\u1EA3ng 0\u2013100" });
        return;
      }
      if (pathname === "/api/history" && !["theory_read", "quiz_passed", "code_passed"].includes(
        String(reqBody.action)
      )) {
        res.status(400).json({
          error: "S\u1EF1 ki\u1EC7n thi v\xE0 ch\u1EE9ng ch\u1EC9 ch\u1EC9 \u0111\u01B0\u1EE3c ghi b\u1EDFi nghi\u1EC7p v\u1EE5 server"
        });
        return;
      }
    }
    if (pathname === "/api/auth/google" && method === "POST") {
      const { accessToken, credential } = reqBody;
      let profile = null;
      try {
        const url2 = typeof accessToken === "string" ? "https://www.googleapis.com/oauth2/v3/userinfo" : typeof credential === "string" ? `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}` : null;
        if (url2) {
          const result = await fetch(url2, {
            headers: typeof accessToken === "string" ? { Authorization: `Bearer ${accessToken}` } : {},
            signal: AbortSignal.timeout(1e4)
          });
          if (result.ok)
            profile = await result.json();
        }
      } catch {
      }
      const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      if (!profile || !profile.sub || typeof profile.email !== "string" || ![true, "true"].includes(profile.email_verified) || typeof credential === "string" && (!clientId || profile.aud !== clientId || !["accounts.google.com", "https://accounts.google.com"].includes(
        String(profile.iss)
      ) || Number(profile.exp) <= Date.now() / 1e3)) {
        res.status(401).json({ error: "Kh\xF4ng x\xE1c minh \u0111\u01B0\u1EE3c t\xE0i kho\u1EA3n Google" });
        return;
      }
      const resolvedEmail = profile.email.trim().toLowerCase();
      const resolvedName = typeof profile.name === "string" ? profile.name : void 0;
      const resolvedAvatar = typeof profile.picture === "string" ? profile.picture : void 0;
      const resolvedGoogleId = String(profile.sub);
      let user = dbService.getUserByEmail(resolvedEmail);
      if (!user) {
        user = dbService.createUser({
          id: "usr_g_" + crypto2.randomUUID(),
          name: resolvedName || "H\u1ECDc Vi\xEAn Google",
          email: resolvedEmail.toLowerCase().trim(),
          role: "student",
          avatar: resolvedAvatar || "https://lh3.googleusercontent.com/a/ACg8ocIq8=s96-c",
          avatar_color: "#0ea5e9",
          auth_provider: "google",
          google_id: resolvedGoogleId,
          plan_id: "free",
          data_origin: "real"
        });
      } else {
        if (user.status === "suspended" || user.auth_provider !== "google" || user.google_id !== resolvedGoogleId) {
          res.status(409).json({
            error: "T\xE0i kho\u1EA3n hi\u1EC7n c\xF3 c\u1EA7n \u0111\u0103ng nh\u1EADp b\u1EB1ng ph\u01B0\u01A1ng th\u1EE9c \u0111\xE3 \u0111\u0103ng k\xFD"
          });
          return;
        }
        user = dbService.updateUser(user.id, {
          last_login_at: (/* @__PURE__ */ new Date()).toISOString(),
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
    if (pathname === "/api/auth/login" && method === "POST") {
      const email = typeof reqBody.email === "string" ? reqBody.email.trim() : "";
      const password = typeof reqBody.password === "string" ? reqBody.password : "";
      if (!email || !password) {
        res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 email v\xE0 m\u1EADt kh\u1EA9u!" });
        return;
      }
      const user = dbService.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c!" });
        return;
      }
      if (user.status === "suspended" || user.auth_provider !== "email" || !user.password_hash || !user.password_salt) {
        res.status(401).json({ error: "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c!" });
        return;
      }
      if (user.password_hash && user.password_salt) {
        const isValid = verifyPassword(
          password,
          user.password_hash,
          user.password_salt
        );
        if (!isValid) {
          res.status(401).json({ error: "Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c!" });
          return;
        }
      }
      const updatedUser = dbService.updateUser(user.id, {
        last_login_at: (/* @__PURE__ */ new Date()).toISOString()
      }) || user;
      const session = dbService.createSession(updatedUser.id);
      setSessionCookie(res, session.token);
      res.status(200).json({
        success: true,
        user: formatUserResponse(updatedUser)
      });
      return;
    }
    if (pathname === "/api/auth/register" && method === "POST") {
      const name = typeof reqBody.name === "string" ? reqBody.name.trim() : "";
      const email = typeof reqBody.email === "string" ? reqBody.email.trim().toLowerCase() : "";
      const password = typeof reqBody.password === "string" ? reqBody.password : "";
      const role = "student";
      const planId = "free";
      if (!name || !email || password.length < 8) {
        res.status(400).json({
          error: "Vui l\xF2ng nh\u1EADp h\u1ECD t\xEAn, email v\xE0 m\u1EADt kh\u1EA9u \xEDt nh\u1EA5t 8 k\xFD t\u1EF1!"
        });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 6 k\xFD t\u1EF1!" });
        return;
      }
      const existing = dbService.getUserByEmail(email);
      if (existing) {
        res.status(409).json({
          error: "Email n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD trong h\u1EC7 th\u1ED1ng! Vui l\xF2ng \u0111\u0103ng nh\u1EADp."
        });
        return;
      }
      const colors = [
        "#0ea5e9",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#ec4899",
        "#06b6d4"
      ];
      const newUser = dbService.createUser({
        id: "usr_" + crypto2.randomUUID(),
        name,
        email,
        password,
        role,
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: "email",
        plan_id: planId,
        data_origin: "real"
      });
      dbService.addLearningHistory({
        id: "hist_" + Date.now(),
        user_id: newUser.id,
        action: "registered",
        details: `\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n m\u1EDBi g\xF3i ${newUser.plan_id.toUpperCase()}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const session = dbService.createSession(newUser.id);
      setSessionCookie(res, session.token);
      res.status(201).json({
        success: true,
        user: formatUserResponse(newUser)
      });
      return;
    }
    if (pathname === "/api/auth/me" && method === "GET") {
      const token = getTokenFromCookie(req);
      if (!token) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp (thi\u1EBFu token)" });
        return;
      }
      const sessionData = dbService.getSessionByToken(token);
      if (!sessionData) {
        res.status(401).json({ error: "Phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 h\u1EBFt h\u1EA1n ho\u1EB7c kh\xF4ng t\u1ED3n t\u1EA1i!" });
        return;
      }
      res.status(200).json({
        success: true,
        user: formatUserResponse(sessionData.user)
      });
      return;
    }
    if (pathname === "/api/auth/logout" && method === "POST") {
      const token = getTokenFromCookie(req);
      if (token) {
        dbService.deleteSession(token);
      }
      clearSessionCookie(res);
      res.status(200).json({ success: true, message: "\u0110\u0103ng xu\u1EA5t th\xE0nh c\xF4ng" });
      return;
    }
    if (pathname === "/api/users" && method === "GET") {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== "admin") {
        res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n qu\u1EA3n tr\u1ECB" });
        return;
      }
      const origin = queryParams.get("origin");
      const term = (queryParams.get("q") || "").toLowerCase();
      const role = queryParams.get("role");
      const users = dbService.getAllUsers().filter(
        (u) => (!origin || origin === "all" || (origin === "test" ? isTestUser(u) : !isTestUser(u))) && (!role || u.role === role) && `${u.name} ${u.email}`.toLowerCase().includes(term)
      );
      const sort = queryParams.get("sort");
      if (sort === "name")
        users.sort(
          (a, b) => a.name.localeCompare(b.name, "vi") || a.id.localeCompare(b.id)
        );
      if (sort === "active")
        users.sort(
          (a, b) => b.last_login_at.localeCompare(a.last_login_at) || a.id.localeCompare(b.id)
        );
      const offset = Math.max(0, Number(queryParams.get("offset")) || 0);
      const limit = queryParams.has("limit") ? Math.min(100, Math.max(1, Number(queryParams.get("limit")) || 25)) : users.length;
      res.status(200).json({
        success: true,
        total: users.length,
        users: users.slice(offset, offset + limit).map(formatUserResponse)
      });
      return;
    }
    if (pathname === "/api/users" && method === "POST") {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== "admin") {
        res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n qu\u1EA3n tr\u1ECB" });
        return;
      }
      const colors = [
        "#0ea5e9",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#ec4899",
        "#06b6d4"
      ];
      const user = dbService.createUser({
        id: "usr_" + crypto2.randomUUID(),
        name: reqBody.name || "H\u1ECDc Vi\xEAn",
        data_origin: reqBody.dataOrigin === "test" ? "test" : "real",
        email: reqBody.email || "",
        password: reqBody.password,
        role: reqBody.role || "student",
        plan_id: reqBody.planId || "free",
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: "email"
      });
      res.status(201).json({ success: true, user: formatUserResponse(user) });
      return;
    }
    if (pathname.startsWith("/api/users/") && method === "PATCH") {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== "admin") {
        res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n qu\u1EA3n tr\u1ECB" });
        return;
      }
      const id = pathname.replace("/api/users/", "");
      if (!dbService.getUserById(id)) {
        res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n" });
        return;
      }
      if (id === adminSession.user.id && reqBody.role !== void 0 && reqBody.role !== "admin") {
        res.status(409).json({ error: "Kh\xF4ng th\u1EC3 t\u1EF1 h\u1EA1 quy\u1EC1n qu\u1EA3n tr\u1ECB" });
        return;
      }
      const current = dbService.getUserById(id);
      if (reqBody.expectedVersion !== void 0 && reqBody.expectedVersion !== (current.version || 1)) {
        res.status(409).json({ error: "D\u1EEF li\u1EC7u \u0111\xE3 thay \u0111\u1ED5i. H\xE3y t\u1EA3i l\u1EA1i tr\u01B0\u1EDBc khi l\u01B0u" });
        return;
      }
      const { planId, avatarColor } = reqBody;
      if ((reqBody.role !== void 0 && reqBody.role !== current.role || (reqBody.planId ?? reqBody.plan_id) !== void 0 && (reqBody.planId ?? reqBody.plan_id) !== current.plan_id || reqBody.dataOrigin !== void 0 && reqBody.dataOrigin !== (isTestUser(current) ? "test" : "real")) && (typeof reqBody.reason !== "string" || reqBody.reason.trim().length < 5)) {
        res.status(400).json({ error: "\u0110\u1ED5i quy\u1EC1n ho\u1EB7c g\xF3i h\u1ECDc c\u1EA7n l\xFD do \xEDt nh\u1EA5t 5 k\xFD t\u1EF1" });
        return;
      }
      const fields = Object.fromEntries(
        Object.entries(reqBody).filter(
          ([key]) => [
            "name",
            "email",
            "role",
            "avatar",
            "plan_id",
            "avatar_color"
          ].includes(key)
        )
      );
      const updated = dbService.updateUser(id, {
        ...fields,
        version: (current.version || 1) + 1,
        ...reqBody.dataOrigin !== void 0 ? { data_origin: reqBody.dataOrigin } : {},
        ...planId ? { plan_id: planId } : {},
        ...avatarColor ? { avatar_color: avatarColor } : {}
      });
      res.status(200).json({
        success: true,
        user: updated ? formatUserResponse(updated) : null
      });
      return;
    }
    if (pathname.startsWith("/api/users/") && method === "DELETE") {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== "admin") {
        res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n qu\u1EA3n tr\u1ECB" });
        return;
      }
      const id = pathname.replace("/api/users/", "");
      if (!dbService.getUserById(id)) {
        res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n" });
        return;
      }
      if (id === adminSession.user.id || dbService.getUserById(id)?.role === "admin" && store.users.filter((u) => u.role === "admin").length <= 1) {
        res.status(409).json({
          error: "Kh\xF4ng th\u1EC3 x\xF3a ch\xEDnh m\xECnh ho\u1EB7c qu\u1EA3n tr\u1ECB vi\xEAn cu\u1ED1i c\xF9ng"
        });
        return;
      }
      dbService.deleteUser(id);
      res.status(200).json({ success: true });
      return;
    }
    if (pathname === "/api/plans" && method === "GET") {
      const rawPlans = dbService.getAllPlans();
      const plans = rawPlans.map((p) => ({
        ...p,
        billingPeriod: p.billing_period,
        features: JSON.parse(p.features || "[]"),
        isPopular: Boolean(p.is_popular),
        isActive: Boolean(p.is_active)
      }));
      res.status(200).json({ success: true, plans });
      return;
    }
    if (pathname.startsWith("/api/plans/") && method === "PATCH") {
      const id = pathname.replace("/api/plans/", "");
      if (!dbService.getAllPlans().some((plan) => plan.id === id)) {
        res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y g\xF3i h\u1ECDc" });
        return;
      }
      if (["name", "description", "billing_period"].some(
        (key) => reqBody[key] !== void 0 && (typeof reqBody[key] !== "string" || key === "name" && !String(reqBody[key]).trim())
      ) || ["isActive", "isPopular"].some(
        (key) => reqBody[key] !== void 0 && typeof reqBody[key] !== "boolean"
      )) {
        res.status(400).json({ error: "C\u1EA5u h\xECnh g\xF3i h\u1ECDc kh\xF4ng h\u1EE3p l\u1EC7" });
        return;
      }
      const { features, isPopular, isActive, ...rest } = reqBody;
      if (reqBody.price !== void 0 && (typeof reqBody.price !== "number" || !Number.isFinite(reqBody.price) || reqBody.price < 0)) {
        res.status(400).json({ error: "Gi\xE1 ph\u1EA3i l\xE0 s\u1ED1 kh\xF4ng \xE2m" });
        return;
      }
      if (features !== void 0 && (!Array.isArray(features) || features.some((f) => typeof f !== "string"))) {
        res.status(400).json({ error: "Danh s\xE1ch quy\u1EC1n kh\xF4ng h\u1EE3p l\u1EC7" });
        return;
      }
      const payload = Object.fromEntries(
        Object.entries(rest).filter(
          ([key]) => ["name", "price", "description", "billing_period"].includes(key)
        )
      );
      if (features) payload.features = JSON.stringify(features);
      if (isPopular !== void 0) payload.is_popular = isPopular ? 1 : 0;
      if (isActive !== void 0) payload.is_active = isActive ? 1 : 0;
      const updated = dbService.updatePlan(id, payload);
      res.status(200).json({ success: true, plan: updated });
      return;
    }
    if (pathname.startsWith("/api/progress") && method === "GET") {
      const userId = queryParams.get("userId") || pathname.split("/")[3];
      if (!userId) {
        res.status(400).json({ error: "Thi\u1EBFu userId" });
        return;
      }
      const p = dbService.getUserProgress(userId);
      if (!p) {
        res.status(200).json({
          success: true,
          progress: {
            currentLessonId: "lesson-1",
            completedLessons: {},
            sprintExamScores: {},
            finalExam: null,
            streakDays: 1,
            lastActiveDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            clearedLessons: {}
          }
        });
        return;
      }
      res.status(200).json({
        success: true,
        progress: {
          currentLessonId: p.current_lesson_id,
          completedLessons: JSON.parse(p.completed_lessons || "{}"),
          sprintExamScores: JSON.parse(p.sprint_exam_scores || "{}"),
          finalExam: p.final_exam ? JSON.parse(p.final_exam) : null,
          streakDays: p.streak_days,
          lastActiveDate: p.last_active_date,
          clearedLessons: JSON.parse(p.cleared_lessons || "{}")
        }
      });
      return;
    }
    if (pathname.startsWith("/api/progress") && method === "POST") {
      const userId = typeof reqBody.userId === "string" ? reqBody.userId : "";
      const progress = reqBody.progress && typeof reqBody.progress === "object" ? reqBody.progress : {};
      if (!userId) {
        res.status(400).json({ error: "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7" });
        return;
      }
      const verified = dbService.getUserProgress(userId);
      const dbPayload = {
        user_id: userId,
        current_lesson_id: progress.currentLessonId || "lesson-1",
        completed_lessons: JSON.stringify(progress.completedLessons || {}),
        sprint_exam_scores: verified?.sprint_exam_scores || "{}",
        final_exam: verified?.final_exam || "",
        streak_days: typeof progress.streakDays === "number" ? progress.streakDays : 1,
        last_active_date: progress.lastActiveDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        cleared_lessons: JSON.stringify(progress.clearedLessons || {}),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      dbService.saveUserProgress(dbPayload);
      res.status(200).json({ success: true });
      return;
    }
    if (pathname === "/api/exams/submit-sprint" && method === "POST") {
      const userId = typeof reqBody.userId === "string" ? reqBody.userId : "";
      const sprintId = typeof reqBody.sprintId === "number" ? reqBody.sprintId : void 0;
      const score = typeof reqBody.score === "number" ? reqBody.score : 0;
      const passed = false;
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        res.status(400).json({ error: "\u0110i\u1EC3m ph\u1EA3i trong kho\u1EA3ng 0\u2013100" });
        return;
      }
      if (!userId || sprintId === void 0 || !Number.isInteger(sprintId) || sprintId < 1 || sprintId > 10) {
        res.status(400).json({ error: "Thi\u1EBFu d\u1EEF li\u1EC7u b\xE0i thi sprint" });
        return;
      }
      const currentProg = dbService.getUserProgress(userId);
      let sprintScores = {};
      if (currentProg?.sprint_exam_scores) {
        try {
          sprintScores = JSON.parse(currentProg.sprint_exam_scores);
        } catch {
        }
      }
      sprintScores[sprintId] = {
        score,
        passed,
        verification: "unverified",
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      dbService.saveUserProgress({
        user_id: userId,
        current_lesson_id: currentProg?.current_lesson_id || "lesson-1",
        completed_lessons: currentProg?.completed_lessons || "{}",
        sprint_exam_scores: JSON.stringify(sprintScores),
        final_exam: currentProg?.final_exam || "",
        streak_days: currentProg?.streak_days || 1,
        last_active_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        cleared_lessons: currentProg?.cleared_lessons || "{}",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      dbService.addLearningHistory({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: `sprint-${sprintId}`,
        lesson_title: `K\u1EF3 thi Sprint 0${sprintId}`,
        action: score === 0 ? "sprint_failed" : "sprint_unverified",
        score,
        details: `K\u1EBFt qu\u1EA3 tr\xECnh duy\u1EC7t (${score}%) \xB7 ch\u1EDD x\xE1c minh tr\xEAn server`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.status(200).json({ success: true });
      return;
    }
    if (pathname === "/api/exams/submit-final" && method === "POST") {
      const userId = typeof reqBody.userId === "string" ? reqBody.userId : "";
      const studentName = typeof reqBody.studentName === "string" ? reqBody.studentName : "H\u1ECDc Vi\xEAn";
      const score = typeof reqBody.score === "number" ? reqBody.score : 0;
      const passed = false;
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        res.status(400).json({ error: "\u0110i\u1EC3m ph\u1EA3i trong kho\u1EA3ng 0\u2013100" });
        return;
      }
      if (!userId) {
        res.status(400).json({ error: "Thi\u1EBFu d\u1EEF li\u1EC7u thi t\u1ED1t nghi\u1EC7p" });
        return;
      }
      const certificateCode = "ESM-" + Math.floor(1e5 + Math.random() * 9e5);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (passed) {
        dbService.issueCertificate({
          id: "cert_" + Date.now(),
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
        certificateId: passed ? certificateCode : "",
        verification: "unverified",
        completedAt: now
      };
      dbService.saveUserProgress({
        user_id: userId,
        current_lesson_id: currentProg?.current_lesson_id || "lesson-1",
        completed_lessons: currentProg?.completed_lessons || "{}",
        sprint_exam_scores: currentProg?.sprint_exam_scores || "{}",
        final_exam: JSON.stringify(finalResult),
        streak_days: currentProg?.streak_days || 1,
        last_active_date: now.split("T")[0],
        cleared_lessons: currentProg?.cleared_lessons || "{}",
        updated_at: now
      });
      dbService.addLearningHistory({
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: "final-exam",
        lesson_title: "Thi T\u1ED1t Nghi\u1EC7p To\xE0n Kh\xF3a Master NestJS",
        action: score === 0 ? "final_failed" : "final_unverified",
        score,
        details: `K\u1EBFt qu\u1EA3 do tr\xECnh duy\u1EC7t g\u1EEDi (${score}%), ch\u1EDD x\xE1c minh; ch\u01B0a c\u1EA5p ch\u1EE9ng ch\u1EC9`,
        timestamp: now
      });
      res.status(200).json({
        success: true,
        certificateCode: passed ? certificateCode : "",
        finalResult
      });
      return;
    }
    if (pathname === "/api/history" && method === "GET") {
      const userId = queryParams.get("userId") || void 0;
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
    if (pathname === "/api/history" && method === "POST") {
      const userId = typeof reqBody.userId === "string" ? reqBody.userId : "";
      const lessonId = typeof reqBody.lessonId === "string" ? reqBody.lessonId : void 0;
      const lessonTitle = typeof reqBody.lessonTitle === "string" ? reqBody.lessonTitle : void 0;
      const action = typeof reqBody.action === "string" ? reqBody.action : "activity";
      const score = typeof reqBody.score === "number" ? reqBody.score : void 0;
      const details = typeof reqBody.details === "string" ? reqBody.details : void 0;
      const newRecord = {
        id: "hist_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: lessonId,
        lesson_title: lessonTitle,
        action,
        score,
        details,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      dbService.addLearningHistory(newRecord);
      res.status(201).json({ success: true, record: newRecord });
      return;
    }
    if (pathname === "/api/admin/stats" && method === "GET") {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) {
        res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp" });
        return;
      }
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== "admin") {
        res.status(403).json({ error: "Kh\xF4ng c\xF3 quy\u1EC1n qu\u1EA3n tr\u1ECB" });
        return;
      }
      const stats = dbService.getAdminStats();
      res.status(200).json({ success: true, stats });
      return;
    }
    res.status(404).json({ error: "API route not found" });
  } catch (error) {
    const context = auditContext.getStore();
    if (context && error instanceof Error) context.errorStack = error.stack;
    const msg = error instanceof Error ? error.message : "L\u1ED7i x\u1EED l\xFD m\xE1y ch\u1EE7";
    res.status(500).json({ error: msg });
  }
}
async function handler(req, res) {
  let statusCode = 200;
  const resAdapter = {
    status(code) {
      statusCode = code;
      if (typeof res.status === "function") {
        res.status(code);
      } else {
        res.statusCode = code;
      }
      return this;
    },
    json(data) {
      if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      if (typeof res.status === "function" && typeof res.json === "function") {
        res.status(statusCode).json(data);
        return this;
      }
      res.statusCode = statusCode;
      res.end(JSON.stringify(data));
      return this;
    },
    setHeader(name, value) {
      if (typeof res.setHeader === "function") {
        res.setHeader(name, value);
      }
    }
  };
  const rawUrl = req.url || "";
  const normalizedUrl = rawUrl.startsWith("/api") ? rawUrl : "/api" + rawUrl;
  let parsedBody = req.body;
  if (typeof parsedBody === "string" && parsedBody.trim().startsWith("{")) {
    try {
      parsedBody = JSON.parse(parsedBody);
    } catch {
    }
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
export {
  authorizeTutorRequest,
  bootstrapAdmin,
  dbService,
  handler as default,
  generateSessionToken,
  handleApiRequest,
  hashPassword,
  recordTutorTrace,
  signJwt,
  verifyJwt,
  verifyPassword
};
