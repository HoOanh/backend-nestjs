import { sqliteEngine } from '../src/services/db/sqliteEngine.ts';
import { chatDbService } from '../src/services/db/chatDbService.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
    process.exit(1);
  }
}

async function runSqliteChatTests() {
  console.log('===============================================================');
  console.log('🧪 TESTING SQLITE ENGINE & CHAT PERSISTENCE LAYER');
  console.log('===============================================================');

  // Suite 1: Low-level SQLite Engine operations
  console.log('\n📦 SUITE 1: SQLite Engine Core Operations');

  await sqliteEngine.ready();

  // 1.1 CREATE TABLE
  const createRes = await sqliteEngine.execute(`
    CREATE TABLE IF NOT EXISTS test_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT
    )
  `);
  assert('1.1 CREATE TABLE execution', !createRes.error);

  // 1.2 INSERT INTO with params
  const insert1 = await sqliteEngine.execute(
    'INSERT INTO test_users (id, name, score, active, created_at) VALUES (?, ?, ?, ?, ?)',
    ['u1', 'Alice', 95, 1, '2026-10-01T10:00:00Z']
  );
  assert('1.2 INSERT INTO row 1', insert1.rowCount === 1);

  const insert2 = await sqliteEngine.execute(
    'INSERT INTO test_users (id, name, score, active, created_at) VALUES (?, ?, ?, ?, ?)',
    ['u2', 'Bob', 80, 1, '2026-10-01T11:00:00Z']
  );
  assert('1.3 INSERT INTO row 2', insert2.rowCount === 1);

  const insert3 = await sqliteEngine.execute(
    'INSERT INTO test_users (id, name, score, active, created_at) VALUES (?, ?, ?, ?, ?)',
    ['u3', 'Charlie', 60, 0, '2026-10-01T12:00:00Z']
  );
  assert('1.4 INSERT INTO row 3', insert3.rowCount === 1);

  // 1.5 SELECT ALL
  const selectAll = await sqliteEngine.execute<{ id: string; name: string }>('SELECT * FROM test_users');
  assert('1.5 SELECT * returns 3 rows', selectAll.rowCount === 3 && selectAll.rows.length === 3);

  // 1.6 SELECT with WHERE operator & params
  const selectScore = await sqliteEngine.execute<{ name: string; score: number }>(
    'SELECT name, score FROM test_users WHERE score > ?',
    [70]
  );
  assert('1.6 SELECT WHERE score > 70 returns 2 rows', selectScore.rowCount === 2);

  // 1.7 SELECT ORDER BY DESC & LIMIT
  const selectOrder = await sqliteEngine.execute<{ name: string; score: number }>(
    'SELECT name, score FROM test_users ORDER BY score DESC LIMIT 1'
  );
  assert('1.7 SELECT ORDER BY score DESC LIMIT 1 returns Alice', selectOrder.rows[0]?.name === 'Alice');

  // 1.8 UPDATE with WHERE
  const updateRes = await sqliteEngine.execute(
    'UPDATE test_users SET score = ? WHERE id = ?',
    [100, 'u1']
  );
  assert('1.8 UPDATE changes 1 row', updateRes.rowCount === 1);

  const checkUpdate = await sqliteEngine.execute<{ score: number }>(
    'SELECT score FROM test_users WHERE id = ?',
    ['u1']
  );
  assert('1.9 Verify updated score is 100', Number(checkUpdate.rows[0]?.score) === 100);

  // 1.10 DELETE with WHERE
  const delRes = await sqliteEngine.execute('DELETE FROM test_users WHERE id = ?', ['u3']);
  assert('1.10 DELETE removed 1 row', delRes.rowCount === 1);

  const checkDel = await sqliteEngine.execute('SELECT * FROM test_users');
  assert('1.11 Total rows after delete is 2', checkDel.rowCount === 2);

  // 1.12 PRAGMA table_info
  const pragmaRes = await sqliteEngine.execute('PRAGMA table_info(test_users)');
  assert('1.12 PRAGMA table_info returns schema metadata', pragmaRes.rowCount >= 4);

  const { handleApiRequest, dbService, signJwt } = await import('../api/index.ts');
  const tokens = new Map<string, string>();
  for (const id of ['user-test', 'user_alice', 'user_bob']) {
    tokens.set(id, signJwt(dbService.createUser({ id, name: id, email: `${id}@test.local`, role: 'student', auth_provider: 'email', plan_id: 'free' })));
  }
  let activeToken = tokens.get('user-test');
  globalThis.fetch = async (input, init) => {
    let status = 200;
    let payload: unknown;
    const response = { status(code: number) { status = code; return this; }, json(value: unknown) { payload = value; return this; }, setHeader() {} };
    await handleApiRequest({ url: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: { authorization: `Bearer ${activeToken}` } }, response);
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  };

  // Suite 2: High-Level Chat Database Service
  console.log('\n📦 SUITE 2: Chat Database Service & Structured Logging');

  await chatDbService.init();

  // 2.1 Create session
  const session1 = await chatDbService.createSession('lesson-1', 'Kiến trúc Module & IoC trong NestJS', 'user-test');
  assert('2.1 Create Chat Session', Boolean(session1.id && session1.lessonId === 'lesson-1'));

  // 2.2 Add user message
  const userMsg = await chatDbService.addMessage({
    sessionId: session1.id,
    lessonId: 'lesson-1',
    role: 'user',
    content: 'Dependency Injection hoạt động thế nào trong NestJS vậy ĐẠI CA?',
    model: 'gemini-2.5-flash'
  });
  assert('2.2 Add user message to server', Boolean(userMsg.id && userMsg.content.includes('Dependency Injection')));

  // 2.3 Add assistant message
  const assistantMsg = await chatDbService.addMessage({
    sessionId: session1.id,
    lessonId: 'lesson-1',
    role: 'assistant',
    content: 'Dạ, DI trong NestJS hoạt động dựa trên cơ chế Inversion of Control (IoC) Container...',
    model: 'gemini-2.5-flash'
  });
  assert('2.3 Add Assistant Message to SQLite', Boolean(assistantMsg.id));

  // 2.4 Update streaming message content
  await chatDbService.updateMessageContent(
    assistantMsg.id,
    'Dạ, DI trong NestJS hoạt động dựa trên cơ chế Inversion of Control (IoC) Container. Khi khởi chạy, NestJS quét các @Injectable() metadata...'
  );
  const updatedMsgs = await chatDbService.getMessages(session1.id);
  assert(
    '2.4 Verify message content updated in SQLite',
    updatedMsgs.find((m) => m.id === assistantMsg.id)?.content.includes('@Injectable()') === true
  );

  // 2.5 Structured Logging
  await chatDbService.log(
    'INFO',
    'TEST_EVENT',
    'Kiểm tra ghi log cấu trúc vào bảng chat_logs',
    { tokenCount: 420, latencyMs: 310 },
    session1.id,
    'lesson-1'
  );
  const logs = await chatDbService.getLogs({ sessionId: session1.id, limit: 10 });
  assert('2.5 Structured log persisted on server', logs.length > 0 && logs.some((l) => l.event === 'TEST_EVENT'));

  // 2.6 Multiple Sessions per Lesson & Summary
  const session2 = await chatDbService.createSession('lesson-1', 'Hỏi về Circular Dependency', 'user-test');
  await chatDbService.addMessage({
    sessionId: session2.id,
    lessonId: 'lesson-1',
    role: 'user',
    content: 'Cách xử lý forwardRef trong NestJS'
  });

  const lessonSessions = await chatDbService.getSessions('lesson-1');
  assert('2.6 Multiple sessions listed for lesson-1', lessonSessions.length >= 2);

  const summaries = await chatDbService.getRecentChatSummary();
  assert('2.7 Recent Chat Summaries contains latest messages', summaries.length >= 2);

  // Suite 3: Multi-User Account Isolation
  console.log('\n📦 SUITE 3: Multi-User Account Isolation & Data Privacy');

  activeToken = tokens.get('user_alice');
  const aliceSession = await chatDbService.createSession('lesson-2', 'Alice hỏi về Microservices', 'user_alice');
  await chatDbService.addMessage({
    sessionId: aliceSession.id,
    lessonId: 'lesson-2',
    userId: 'user_alice',
    role: 'user',
    content: 'Alice hỏi về NATS transport'
  });

  activeToken = tokens.get('user_bob');
  const bobSession = await chatDbService.createSession('lesson-2', 'Bob hỏi về Kafka Event Streaming', 'user_bob');
  await chatDbService.addMessage({
    sessionId: bobSession.id,
    lessonId: 'lesson-2',
    userId: 'user_bob',
    role: 'user',
    content: 'Bob hỏi về Kafka partition & consumer group'
  });

  activeToken = tokens.get('user_alice');
  const aliceList = await chatDbService.getSessions('lesson-2', 'user_alice');
  assert('3.1 Alice only sees her own sessions', aliceList.length === 1 && aliceList[0].userId === 'user_alice');

  activeToken = tokens.get('user_bob');
  const bobList = await chatDbService.getSessions('lesson-2', 'user_bob');
  assert('3.2 Bob only sees his own sessions', bobList.length === 1 && bobList[0].userId === 'user_bob');

  activeToken = tokens.get('user_alice');
  const aliceSummary = await chatDbService.getRecentChatSummary('user_alice');
  assert(
    '3.3 Alice learning history summary only contains Alice records',
    aliceSummary.every((s) => s.userId === 'user_alice')
  );

  console.log('\n🎉 ALL SQLITE ENGINE & MULTI-USER CHAT TESTS PASSED CLEANLY!\n');
}

const originalDirectory = process.cwd();
const originalFetch = globalThis.fetch;
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-chat-test-'));
process.chdir(tempDirectory);
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;
try {
  await runSqliteChatTests();
} finally {
  globalThis.fetch = originalFetch;
  process.chdir(originalDirectory);
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
