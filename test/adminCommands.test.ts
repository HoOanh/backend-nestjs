import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const original = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-commands-'));
process.chdir(fixture);
process.env.ADMIN_EMAIL = 'admin@fixture.invalid';
process.env.ADMIN_PASSWORD = 'Unique-fixture-password';
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;
delete process.env.ARC_STORE_PATH;
try {
  const { adminReturnTo, parseLocation } =
    await import('../src/utils/router.ts');
  assert.equal(
    adminReturnTo('?returnTo=%2Fadmin%2Ftrace%3FentityId%3Dstudent'),
    '/admin/trace?entityId=student'
  );
  assert.equal(adminReturnTo('?returnTo=https%3A%2F%2Fevil.invalid'), '/admin');
  assert.equal(adminReturnTo('?returnTo=%2F%2Fevil.invalid'), '/admin');
  assert.notEqual(parseLocation('/administrator', '').type, 'admin');
  const { handleApiRequest, dbService, signJwt } =
    await import('../api/index.ts');
  const call = async (
    url: string,
    method = 'GET',
    body?: unknown,
    token?: string
  ) => {
    let status = 200;
    let data: Record<string, unknown> = {};
    let requestId = '';
    await handleApiRequest(
      {
        url,
        method,
        body,
        headers: token ? { authorization: `Bearer ${token}` } : {}
      },
      {
        status(c) {
          status = c;
          return this;
        },
        json(value) {
          data = value as Record<string, unknown>;
          return this;
        },
        setHeader(k, v) {
          if (k === 'X-Request-ID') requestId = v;
        }
      }
    );
    return { status, data, requestId };
  };
  const admin = dbService.getUserByEmail(process.env.ADMIN_EMAIL)!;
  const token = signJwt(admin);
  const student = dbService.createUser({
    id: 'student',
    name: 'Student',
    email: 'student@fixture.invalid',
    password: 'Unique-student-pass',
    role: 'student',
    auth_provider: 'email',
    plan_id: 'free'
  });
  const studentToken = signJwt(student);
  assert.equal(
    (
      await call(
        '/admin/certificates',
        'POST',
        {
          userId: student.id,
          type: 'honorary',
          reason: 'Reviewed work',
          idempotencyKey: 'same'
        },
        studentToken
      )
    ).status,
    403
  );
  const body = {
    userId: student.id,
    type: 'honorary',
    reason: 'Reviewed work',
    idempotencyKey: 'same'
  };
  const first = await call('/admin/certificates', 'POST', body, token);
  assert.equal(first.status, 201);
  const cert = first.data.certificate as Record<string, unknown>;
  assert.equal(
    (await call('/admin/certificates', 'POST', body, token)).status,
    200
  );
  assert.equal(
    (
      await call(
        '/admin/certificates',
        'POST',
        { ...body, reason: 'Different work' },
        token
      )
    ).status,
    409
  );
  assert.equal(
    dbService.getUserProgress(student.id),
    null,
    'manual certificate must never invent progress or score'
  );
  const list = await call('/admin/certificates', 'GET', undefined, token);
  assert.equal((list.data.certificates as unknown[]).length, 1);
  assert.equal(
    (await call(`/certificates/verify/${cert.certificate_code}`)).data.status,
    'issued'
  );
  assert.equal(
    (
      await call(
        `/admin/certificates/${cert.id}/revoke`,
        'POST',
        { reason: 'Evidence invalidated' },
        token
      )
    ).status,
    200
  );
  assert.equal(
    (await call(`/certificates/verify/${cert.certificate_code}`)).data.status,
    'revoked'
  );
  const grant = {
    reason: 'Approved course access',
    expectedVersion: 1,
    idempotencyKey: 'entitlement'
  };
  assert.equal(
    (await call('/admin/users/student/entitlements', 'POST', grant, token))
      .status,
    200
  );
  assert.equal(
    (await call('/admin/users/student/entitlements', 'POST', grant, token))
      .status,
    200
  );
  assert.equal(
    dbService.getUserProgress(student.id),
    null,
    'entitlements cannot invent completed lessons'
  );
  assert.equal(
    (
      await call(
        '/admin/users/student/suspend',
        'POST',
        { reason: 'Account review', expectedVersion: 1 },
        token
      )
    ).status,
    200
  );
  assert.equal(
    (await call('/auth/me', 'GET', undefined, studentToken)).status,
    401
  );
  assert.equal(
    (
      await call(
        '/admin/users/student/restore',
        'POST',
        { reason: 'Review completed', expectedVersion: 1 },
        token
      )
    ).status,
    409
  );
  assert.equal(
    (
      await call(
        '/admin/users/student/restore',
        'POST',
        { reason: 'Review completed', expectedVersion: 2 },
        token
      )
    ).status,
    200
  );
  assert.equal(
    (await call(`/users/${admin.id}`, 'PATCH', { role: 'student' }, token))
      .status,
    409
  );
  assert.equal(
    (
      await call(
        '/progress?userId=student',
        'GET',
        undefined,
        signJwt(
          dbService.createUser({
            id: 'other',
            name: 'Other',
            email: 'other@fixture.invalid',
            role: 'student',
            auth_provider: 'google',
            plan_id: 'free'
          })
        )
      )
    ).status,
    403
  );
  const grouped = await call(
    '/admin/audit?group=true&entity=certificates',
    'GET',
    undefined,
    token
  );
  const groups = grouped.data.groups as Array<Array<Record<string, unknown>>>;
  assert.ok(groups.length);
  assert.ok(groups.every((g) => g.some((e) => e.action === 'REQUEST')));
  assert.ok(!JSON.stringify(groups).includes('Unique-fixture-password'));
  assert.equal(
    (await call('/admin/audit?from=bad', 'GET', undefined, token)).status,
    400
  );
  const exported = await call(
    '/admin/exports',
    'POST',
    { kind: 'users', origin: 'all', q: 'student@fixture.invalid' },
    token
  );
  assert.equal(exported.status, 200);
  assert.equal(exported.data.count, 1);
  assert.ok(!JSON.stringify(exported.data).includes('password_hash'));
  assert.equal(
    (await call('/admin/exports', 'POST', { kind: 'users' }, studentToken))
      .status,
    401,
    'suspended/revoked session cannot export'
  );
  const exportAudit = await call(
    `/admin/audit?requestId=${exported.requestId}`,
    'GET',
    undefined,
    token
  );
  assert.ok(
    (exportAudit.data.logs as Array<Record<string, unknown>>).some(
      (e) => e.action === 'REQUEST' && e.outcome === 'SUCCESS'
    )
  );
  assert.equal(
    (await call('/auth/me', 'GET', undefined, studentToken)).status,
    401,
    'restoring an account must not restore old sessions'
  );
  const restoredLogin = await call('/auth/login', 'POST', {
    email: student.email,
    password: 'Unique-student-pass'
  });
  assert.equal(restoredLogin.status, 200);
  const pageOne = await call(
    '/users?origin=all&limit=1&offset=0&sort=name',
    'GET',
    undefined,
    token
  );
  const pageTwo = await call(
    '/users?origin=all&limit=1&offset=1&sort=name',
    'GET',
    undefined,
    token
  );
  assert.equal((pageOne.data.users as unknown[]).length, 1);
  assert.notEqual(
    (pageOne.data.users as Array<Record<string, unknown>>)[0].id,
    (pageTwo.data.users as Array<Record<string, unknown>>)[0].id
  );
  assert.equal(
    (
      await call(
        '/users?origin=all&q=student@fixture.invalid',
        'GET',
        undefined,
        token
      )
    ).data.total,
    1
  );
  const created = await call(
    '/users',
    'POST',
    {
      name: 'Operator fixture',
      email: 'operator@fixture.invalid',
      password: 'Unique-created-password',
      role: 'student',
      planId: 'free',
      dataOrigin: 'test',
      reason: 'Create isolated fixture'
    },
    token
  );
  assert.equal(created.status, 201);
  const profile = created.data.user as Record<string, unknown>;
  assert.equal(profile.isTestAccount, true);
  assert.equal(profile.dataOrigin, 'test');
  assert.equal(profile.password_hash, undefined);
  assert.equal(
    (
      await call(
        `/users/${profile.id}`,
        'PATCH',
        { name: 'Renamed fixture', expectedVersion: 1 },
        token
      )
    ).status,
    200
  );
  assert.equal(
    (
      await call(
        `/users/${profile.id}`,
        'PATCH',
        { name: 'Stale update', expectedVersion: 1 },
        token
      )
    ).status,
    409
  );
  assert.equal(
    (await call(`/users/${profile.id}`, 'PATCH', { dataOrigin: 'real' }, token))
      .status,
    400,
    'data classification requires a reason'
  );
  assert.equal(
    dbService.getUserById(String(profile.id))?.data_origin,
    'test',
    'renaming must preserve test classification'
  );
  assert.equal(
    (await call('/plans/free', 'PATCH', { isActive: 'false' }, token)).status,
    400
  );
  assert.equal(
    (
      await call(
        '/history',
        'POST',
        { userId: student.id, action: 'final_certified' },
        String(restoredLogin.data.token)
      )
    ).status,
    400
  );
  assert.equal(
    (
      await call(
        '/progress',
        'POST',
        {
          userId: student.id,
          progress: {
            finalExam: { score: 100, passed: true, certificateId: 'FORGED' }
          }
        },
        String(restoredLogin.data.token)
      )
    ).status,
    200
  );
  assert.equal(
    (
      await call(
        '/progress?userId=student',
        'GET',
        undefined,
        String(restoredLogin.data.token)
      )
    ).data.progress &&
      (
        (
          await call(
            '/progress?userId=student',
            'GET',
            undefined,
            String(restoredLogin.data.token)
          )
        ).data.progress as Record<string, unknown>
      ).finalExam,
    null
  );
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = ((...args: Parameters<typeof fs.writeFileSync>) => {
    if (String(args[0]).endsWith('.tmp'))
      throw new Error('Fixture disk unavailable');
    return originalWrite(...args);
  }) as typeof fs.writeFileSync;
  const failed = await call(
    '/admin/certificates',
    'POST',
    { ...body, idempotencyKey: 'failed-command' },
    token
  );
  fs.writeFileSync = originalWrite;
  assert.equal(failed.status, 500);
  assert.equal(
    (await call('/admin/certificates', 'GET', undefined, token)).data
      .certificates instanceof Array,
    true
  );
  assert.equal(
    (
      (await call('/admin/certificates', 'GET', undefined, token)).data
        .certificates as unknown[]
    ).length,
    1,
    'failed save must not persist partial certificate'
  );
  dbService.deleteUser(student.id);
  assert.equal(
    (await call('/auth/me', 'GET', undefined, studentToken)).status,
    401,
    'deleted user cannot be resurrected from JWT'
  );
  console.log(
    'PASS: certificate idempotency/verification/revocation, entitlements, suspension, stale version, ownership, grouped audit, failed-write rollback, deleted JWT rejection'
  );
} finally {
  process.chdir(original);
  fs.rmSync(fixture, { recursive: true, force: true });
}
