import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const original = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-data-ops-'));
process.chdir(fixture);
process.env.ADMIN_EMAIL = 'operations@example.invalid';
process.env.ADMIN_PASSWORD = 'Fixture-operations-password';
delete process.env.ARC_STORE_PATH;
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;
try {
  const { handleApiRequest, dbService, signJwt } =
    await import('../server/index.ts');
  const token = signJwt(dbService.getUserByEmail(process.env.ADMIN_EMAIL)!);
  const call = async (
    method: string,
    body?: unknown,
    authenticated = true,
    endpoint = '/api/admin/data-operations'
  ) => {
    let status = 200;
    let data: Record<string, unknown> = {};
    await handleApiRequest(
      {
        url: endpoint,
        method,
        body,
        headers: authenticated ? { authorization: `Bearer ${token}` } : {}
      },
      {
        status(value) {
          status = value;
          return this;
        },
        json(value) {
          data = value as Record<string, unknown>;
          return this;
        },
        setHeader() {}
      }
    );
    return { status, data };
  };
  const file = path.join(fixture, 'data/arc_irobot_store.json');
  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  stored.chat_logs = [
    {
      id: 'old',
      timestamp: '2020-01-01T00:00:00.000Z',
      level: 'INFO',
      event: 'old',
      message: 'old',
      userId: 'x'
    },
    {
      id: 'new',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      event: 'new',
      message: 'new',
      userId: 'x'
    },
    {
      id: 'invalid',
      timestamp: 'invalid',
      level: 'INFO',
      event: 'bad-date',
      message: 'bad-date',
      userId: 'x'
    }
  ];
  fs.writeFileSync(file, JSON.stringify(stored));
  assert.equal((await call('GET', undefined, false)).status, 401);
  const student = dbService.createUser({
    id: 'student',
    name: 'Student',
    email: 'student@example.invalid',
    role: 'student',
    auth_provider: 'email',
    password: 'Fixture-password',
    plan_id: 'free'
  });
  let denied = 0;
  await handleApiRequest(
    {
      url: '/api/admin/data-operations',
      method: 'POST',
      body: { action: 'policy' },
      headers: { authorization: `Bearer ${signJwt(student)}` }
    },
    {
      status(code) {
        denied = code;
        return this;
      },
      json() {
        return this;
      },
      setHeader() {}
    }
  );
  assert.equal(denied, 403);
  const usage = await call('GET', undefined, true, '/api/admin/database');
  assert.equal(
    (usage.data.usage as { fileBytes: number }).fileBytes,
    fs.statSync(file).size
  );
  assert.ok(
    (usage.data.tables as Array<{ bytes: number }>).every((t) => t.bytes >= 2)
  );
  assert.equal(
    (
      await call('POST', {
        action: 'policy',
        enabled: true,
        chatDays: 30,
        auditDays: 1,
        reason: 'invalid audit policy'
      })
    ).status,
    400
  );
  assert.equal(
    (
      await call('POST', {
        action: 'preview',
        table: 'users',
        before: '2021-01-01'
      })
    ).status,
    400
  );
  assert.equal(
    (
      await call('POST', {
        action: 'preview',
        table: 'audit_logs',
        before: new Date().toISOString()
      })
    ).status,
    400
  );
  const body = { table: 'chat_logs', before: '2021-01-01T00:00:00.000Z' };
  const preview = await call('POST', { action: 'preview', ...body });
  assert.equal(preview.data.count, 1);
  assert.equal(
    (
      await call('POST', {
        action: 'cleanup',
        ...body,
        fingerprint: 'stale',
        reason: 'test stale preview'
      })
    ).status,
    409
  );
  const cleanup = await call('POST', {
    action: 'cleanup',
    ...body,
    fingerprint: preview.data.fingerprint,
    reason: 'archive fixture old logs'
  });
  assert.equal(cleanup.status, 200);
  assert.equal(cleanup.data.count, 1);
  let current = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(
    current.chat_logs.map((r: { id: string }) => r.id),
    ['new', 'invalid']
  );
  assert.ok(
    current.audit_logs.some(
      (r: { operation: string }) => r.operation === 'manual.archive'
    )
  );
  const archives = (await call('GET')).data.archives as Array<{
    id: string;
    count: number;
    bytes: number;
  }>;
  assert.equal(archives.length, 1);
  assert.equal(archives[0].count, 1);
  assert.ok(archives[0].bytes > 0);
  const restore = {
    action: 'restore',
    archiveId: archives[0].id,
    reason: 'restore fixture evidence'
  };
  assert.equal((await call('POST', restore)).data.count, 1);
  assert.equal((await call('POST', restore)).data.count, 0);
  assert.equal(
    (await call('POST', { ...restore, archiveId: '../../secret' })).status,
    400
  );
  assert.equal(
    (
      await call('POST', {
        action: 'policy',
        enabled: true,
        chatDays: 30,
        auditDays: 365,
        reason: 'enable fixture retention'
      })
    ).status,
    200
  );
  await call('GET');
  current = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(
    current.chat_logs.some((r: { id: string }) => r.id === 'old'),
    false
  );
  assert.ok(current.retention.lastRunAt);
  assert.ok(
    current.audit_logs.some(
      (r: { operation: string; source: string }) =>
        r.operation === 'retention.archive' && r.source === 'system'
    )
  );
  const count = ((await call('GET')).data.archives as unknown[]).length;
  await call('GET');
  assert.equal(((await call('GET')).data.archives as unknown[]).length, count);
  assert.equal(current.users.length, 2);
  const archiveForPurge = (
    (await call('GET')).data.archives as Array<{
      id: string;
      fingerprint: string;
    }>
  )[0];
  assert.equal(
    (
      await call('POST', {
        action: 'purge',
        archiveId: archiveForPurge.id,
        fingerprint: archiveForPurge.fingerprint,
        confirmId: 'wrong',
        reason: 'test rejection'
      })
    ).status,
    409
  );
  const purged = await call('POST', {
    action: 'purge',
    archiveId: archiveForPurge.id,
    fingerprint: archiveForPurge.fingerprint,
    confirmId: archiveForPurge.id,
    reason: 'remove disposable fixture archive'
  });
  assert.equal(purged.status, 200);
  assert.ok(Number(purged.data.freedBytes) > 0);
  assert.equal(
    (
      await call('POST', {
        action: 'restore',
        archiveId: archiveForPurge.id,
        reason: 'restore removed fixture'
      })
    ).status,
    400
  );
  console.log(
    'PASS: usage bytes, admin guard, retention limits, preview conflict, recoverable cleanup, restore idempotency, automatic retention, business data preservation'
  );
} finally {
  process.chdir(original);
  fs.rmSync(fixture, { recursive: true, force: true });
}
