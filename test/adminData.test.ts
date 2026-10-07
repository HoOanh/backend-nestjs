import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalDirectory = process.cwd();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-admin-test-'));
process.chdir(directory);
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Test-password-2026';
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;

try {
  const { handleApiRequest, dbService, signJwt } = await import('../server/index.ts');
  const call = async (url: string, method = 'GET', body?: unknown, token?: string) => {
    let status = 200;
    let data: Record<string, unknown> = {};
    const response = { status(code: number) { status = code; return this; }, json(value: unknown) { data = value as Record<string, unknown>; return this; }, setHeader() {} };
    await handleApiRequest({ url, method, body, headers: token ? { authorization: `Bearer ${token}` } : {} }, response);
    return { status, data };
  };
  const login = await call('/api/auth/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  const adminToken = String(login.data.token);
  const alice = dbService.createUser({ id: 'alice', name: 'Alice', email: 'alice@test.local', role: 'student', auth_provider: 'email', plan_id: 'pro' });
  const bob = dbService.createUser({ id: 'bob', name: 'Bob', email: 'bob@test.local', role: 'student', auth_provider: 'email', plan_id: 'free' });
  const aliceToken = signJwt(alice);
  const bobToken = signJwt(bob);
  assert.equal((await call('/api/admin/database')).status, 401);
  assert.equal((await call('/api/admin/database', 'GET', undefined, aliceToken)).status, 403);
  const users = (await call('/api/users', 'GET', undefined, adminToken)).data.users as Array<Record<string, unknown>>;
  assert.equal(users.find((u) => u.id === 'alice')?.planId, 'pro');
  assert.ok(users.every((u) => !('password_hash' in u) && !('password_salt' in u)));
  dbService.addLearningHistory({ id: 'history', user_id: 'alice', lesson_id: 'lesson-1', lesson_title: 'Bài thật', action: 'quiz_passed', score: 0, timestamp: new Date().toISOString() });
  const history = (await call('/api/history', 'GET', undefined, adminToken)).data.history as Array<Record<string, unknown>>;
  assert.equal(history[0].userId, 'alice');
  assert.equal(history[0].lessonTitle, 'Bài thật');
  assert.equal(history[0].score, 0);
  const stats = (await call('/api/admin/stats', 'GET', undefined, adminToken)).data.stats as Record<string, unknown>;
  assert.equal(stats.totalUsers, 2);
  assert.equal(stats.totalRevenue, null);
  const plans = (await call('/api/plans')).data.plans as Array<Record<string, unknown>>;
  assert.equal(typeof plans[0].billingPeriod, 'string');
  const created = await call('/api/chat/sessions', 'POST', { lessonId: 'lesson-1', title: 'Session thật', userId: 'bob' }, aliceToken);
  const session = created.data.session as Record<string, unknown>;
  assert.equal(session.userId, 'alice');
  const id = String(session.id);
  assert.equal((await call(`/api/chat/messages?sessionId=${id}`, 'GET', undefined, bobToken)).status, 404);
  assert.equal((await call('/api/chat/messages', 'POST', { sessionId: id, role: 'user', content: 'Dữ liệu thật' }, bobToken)).status, 404);
  const message = await call('/api/chat/messages', 'POST', { sessionId: id, role: 'user', content: 'Dữ liệu thật' }, aliceToken);
  assert.equal(message.status, 201);
  const messageId = String((message.data.message as Record<string, unknown>).id);
  assert.equal((await call('/api/chat/messages', 'PATCH', { messageId, content: 'Sai' }, bobToken)).status, 404);
  assert.equal((await call('/api/chat/messages', 'PATCH', { messageId, content: 'Đã cập nhật' }, aliceToken)).status, 200);
  await call('/api/chat/logs', 'POST', { sessionId: id, level: 'INFO', event: 'PROMPT_SENT', message: 'Prompt thật' }, aliceToken);
  assert.equal(((await call('/api/chat/logs', 'GET', undefined, bobToken)).data.logs as unknown[]).length, 0);
  assert.equal(((await call('/api/chat/logs', 'GET', undefined, adminToken)).data.logs as unknown[]).length, 1);
  const database = await call('/api/admin/database?table=chat_messages', 'GET', undefined, adminToken);
  assert.equal(database.data.engine, 'JSON file');
  assert.equal((database.data.rows as Array<Record<string, unknown>>)[0].content, 'Đã cập nhật');
  assert.equal((await call('/api/admin/database?table=__proto__', 'GET', undefined, adminToken)).status, 400);
  const initialAudit = await call('/api/admin/audit', 'GET', undefined, adminToken);
  assert.equal(initialAudit.status, 200);
  assert.equal((await call('/api/admin/audit', 'GET', undefined, aliceToken)).status, 403);
  assert.equal((await call('/api/admin/audit', 'POST', { actor: 'spoofed' }, adminToken)).status, 405);
  const auditCount = (initialAudit.data.logs as unknown[]).length;
  await call('/api/plans/pro', 'PATCH', { price: 123456, actorId: 'bob' }, adminToken);
  const planEvidence = (await call('/api/admin/audit?entity=plans&entityId=pro', 'GET', undefined, adminToken)).data.logs as Array<Record<string, unknown>>;
  assert.equal(planEvidence.length, 1);
  assert.equal((planEvidence[0].actor as Record<string, unknown>).role, 'admin');
  assert.equal((planEvidence[0].before as Record<string, unknown>).price, 690000);
  assert.equal((planEvidence[0].after as Record<string, unknown>).price, 123456);
  assert.ok((planEvidence[0].changedFields as string[]).includes('price'));
  const related = (await call(`/api/admin/audit?requestId=${planEvidence[0].requestId}`, 'GET', undefined, adminToken)).data.logs as Array<Record<string, unknown>>;
  assert.ok(related.some((log) => log.action === 'REQUEST' && log.status === 200));
  await call('/api/plans/pro', 'PATCH', { price: 999 }, aliceToken);
  const denied = (await call('/api/admin/audit?outcome=FAILURE&actorId=alice', 'GET', undefined, adminToken)).data.logs as Array<Record<string, unknown>>;
  assert.ok(denied.some((log) => log.path === '/api/plans/pro' && log.status === 403));
  assert.equal(dbService.getAllPlans().find((p) => p.id === 'pro')?.price, 123456);
  const originalWrite = fs.writeFileSync;
  let writes = 0;
  fs.writeFileSync = ((...args: Parameters<typeof fs.writeFileSync>) => {
    if (++writes === 1) throw new Error('Simulated disk failure');
    return originalWrite(...args);
  }) as typeof fs.writeFileSync;
  try {
    assert.equal((await call('/api/users/alice', 'PATCH', { name: 'Should not persist' }, adminToken)).status, 500);
  } finally { fs.writeFileSync = originalWrite; }
  assert.equal(dbService.getUserById('alice')?.name, 'Alice');
  const errors = (await call('/api/admin/audit?outcome=FAILURE', 'GET', undefined, adminToken)).data.logs as Array<Record<string, unknown>>;
  assert.ok(errors.some((log) => log.status === 500 && log.error === 'Simulated disk failure'));
  const allAudit = (await call('/api/admin/audit', 'GET', undefined, adminToken)).data.logs as Array<Record<string, unknown>>;
  assert.ok(allAudit.length > auditCount);
  assert.ok(!JSON.stringify(allAudit).includes('Test-password-2026'));
  assert.ok(!allAudit.some((log) => (log.after as Record<string, unknown> | null)?.name === 'Should not persist'));
  const { default: tutorHandler } = await import('../server/tutor.ts');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return attempts === 1
      ? new Response(JSON.stringify({ error: { message: 'Test model unavailable' } }), { status: 404 })
      : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Phản hồi test' }] } }] }), { status: 200 });
  };
  try {
    const response = { status() { return this; }, json() { return this; } };
    await tutorHandler({ method: 'POST', headers: { authorization: `Bearer ${aliceToken}` }, body: { sessionId: id, lesson: { title: 'Bài test' }, messages: [{ role: 'user', content: 'Test' }], model: 'test-unavailable', stream: false } }, response);
    const traces = (await call('/api/chat/logs', 'GET', undefined, adminToken)).data.logs as Array<Record<string, unknown>>;
    assert.ok(traces.some((l) => l.event === 'AI_PROVIDER_REJECTED'));
    assert.ok(traces.some((l) => l.event === 'AI_RESPONSE_COMPLETE' && (l.metadata as Record<string, unknown>).actualModel === 'gemini-3.8-flash'));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
  const disk = JSON.parse(fs.readFileSync(path.join(directory, 'data/arc_irobot_store.json'), 'utf8')) as Record<string, unknown[]>;
  assert.equal(disk.chat_messages.length, 1);
  assert.equal(disk.chat_logs.length, 4);
  await call('/api/chat/sessions', 'DELETE', { sessionId: id }, aliceToken);
  assert.equal(((await call('/api/admin/database?table=chat_messages', 'GET', undefined, adminToken)).data.rows as unknown[]).length, 0);
  const deletions = (await call('/api/admin/audit?entity=chat_messages&outcome=PERSISTED', 'GET', undefined, adminToken)).data.logs as Array<Record<string, unknown>>;
  assert.ok(deletions.some((log) => log.action === 'DELETE' && (log.before as Record<string, unknown>).content === 'Đã cập nhật' && log.after === null));
  console.log('PASS: admin mapping, truthful stats, server chat persistence, logs, DB explorer, ownership, secret redaction, provider fallback traces, cascade');
} finally {
  process.chdir(originalDirectory);
  fs.rmSync(directory, { recursive: true, force: true });
}
