import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-admin-review-'));
process.chdir(temporary);
process.env.ADMIN_EMAIL = 'review-admin@example.invalid';
process.env.ADMIN_PASSWORD = 'Review-secret-2026';
delete process.env.VERCEL;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;

interface Result { id: string; actual: unknown; expected: string; verdict: 'PASS' | 'FAIL'; }
const results: Result[] = [];
const record = (id: string, actual: unknown, expected: string, passes: boolean) => results.push({ id, actual, expected, verdict: passes ? 'PASS' : 'FAIL' });

try {
  const { handleApiRequest, dbService, signJwt, verifyPassword } = await import('../server/index.ts');
  const call = async (url: string, method = 'GET', body?: unknown, token?: string) => {
    let status = 200;
    let data: Record<string, unknown> = {};
    const headers: Record<string, string> = {};
    const response = { status(code: number) { status = code; return this; }, json(value: unknown) { data = value as Record<string, unknown>; return this; }, setHeader(key: string, value: string) { headers[key.toLowerCase()] = value; } };
    await handleApiRequest({ url, method, body, headers: token ? { authorization: `Bearer ${token}` } : {} }, response);
    return { status, data, headers };
  };
  const login = await call('/api/auth/login', 'POST', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  const adminToken = String(login.data.token);
  const adminId = String((login.data.user as Record<string, unknown>).id);
  record('LOGIN', login.status, 'Admin login succeeds', login.status === 200);
  const user = dbService.createUser({ id: 'review-student', name: 'Review Student', email: 'review-student@example.invalid', role: 'student', auth_provider: 'email', password: 'Review-user-2026', plan_id: 'free' });
  const studentToken = signJwt(user);
  record('ADMIN-GUARD', (await call('/api/users', 'GET', undefined, studentToken)).status, 'Student receives 403', (await call('/api/users', 'GET', undefined, studentToken)).status === 403);

  const escalation = await call('/api/auth/register', 'POST', { email: 'self-admin@example.invalid', name: 'Self Admin', password: 'Fixture-password', role: 'admin' });
  const escalatedRole = (escalation.data.user as Record<string, unknown> | undefined)?.role;
  record('REGISTER-ADMIN', { status: escalation.status, role: escalatedRole }, 'Public registration cannot create an admin', escalatedRole !== 'admin');

  const spoofed = await call('/api/auth/google', 'POST', { email: process.env.ADMIN_EMAIL, name: 'Review Admin' });
  record('GOOGLE-SPOOF', { status: spoofed.status, role: (spoofed.data.user as Record<string, unknown> | undefined)?.role }, 'Email alone cannot authenticate any account', spoofed.status >= 400);

  dbService.createUser({ id: 'review-google', name: 'Review Google', email: 'review-google@example.invalid', role: 'student', auth_provider: 'google', plan_id: 'free' });
  const wrongGoogle = await call('/api/auth/login', 'POST', { email: 'review-google@example.invalid', password: 'wrong-password' });
  record('EMAIL-GOOGLE-PASSWORD', wrongGoogle.status, 'Google account cannot login with arbitrary email/password', wrongGoogle.status >= 400);

  const duplicate = await call('/api/users', 'POST', { email: user.email, name: 'Duplicate' }, adminToken);
  record('USER-UNIQUE', duplicate.status, 'Duplicate email receives 409', duplicate.status === 409);
  const empty = await call('/api/users', 'POST', {}, adminToken);
  record('USER-VALIDATE', empty.status, 'Missing name/email receives 400 or 422', [400, 422].includes(empty.status));
  const created = await call('/api/users', 'POST', { name: 'Invited User', email: 'invited@example.invalid' }, adminToken);
  const createdId = String((created.data.user as Record<string, unknown> | undefined)?.id || '');
  const createdUser = dbService.getUserById(createdId);
  const defaultPassword = Boolean(createdUser?.password_hash && createdUser.password_salt && verifyPassword('123456', createdUser.password_hash, createdUser.password_salt));
  record('USER-CREDENTIAL', { status: created.status, defaultPassword }, 'Invite flow must not use a shared implicit password', !defaultPassword);
  const invalid = await call(`/api/users/${user.id}`, 'PATCH', { role: 'invalid-role', planId: 'invalid-plan' }, adminToken);
  record('USER-ENUMS', invalid.status, 'Invalid role/plan receives 400 or 422', [400,422].includes(invalid.status));
  const update = await call(`/api/users/${user.id}`, 'PATCH', { role: 'student', planId: 'free', name: 'Edited' }, adminToken);
  const exposed = update.data.user as Record<string, unknown>;
  record('USER-RESPONSE-SECRETS', { status: update.status, passwordHashExposed: Boolean(exposed.password_hash), saltExposed: Boolean(exposed.password_salt) }, 'Response excludes password hashes and salts', !exposed.password_hash && !exposed.password_salt);

  await call('/api/plans/pro', 'PATCH', { isActive: false }, adminToken);
  const inactive = await call('/api/auth/register', 'POST', { name: 'Inactive Signup', email: 'inactive@example.invalid', password: 'Fixture-password', planId: 'pro' });
  record('INACTIVE-PLAN', { status: inactive.status, assignedPlan: (inactive.data.user as Record<string, unknown> | undefined)?.planId }, 'Inactive/paid plan cannot be assigned by public registration', inactive.status >= 400 || (inactive.data.user as Record<string, unknown> | undefined)?.planId !== 'pro');
  const negativePrice = await call('/api/plans/pro', 'PATCH', { price: -1 }, adminToken);
  record('PLAN-PRICE', negativePrice.status, 'Negative price rejected with 400/422', [400,422].includes(negativePrice.status));

  await call('/api/progress', 'POST', { userId: user.id, progress: { completedLessons: {}, clearedLessons: {}, finalExam: null } }, studentToken);
  record('PROGRESS-READ-GUARD', (await call(`/api/progress?userId=${user.id}`)).status, 'Anonymous progress read receives 401', (await call(`/api/progress?userId=${user.id}`)).status === 401);
  record('HISTORY-READ-GUARD', (await call('/api/history')).status, 'Anonymous history read receives 401', (await call('/api/history')).status === 401);
  const exam = await call('/api/exams/submit-final', 'POST', { userId: user.id, studentName: 'Review Student', score: 999, passed: true }, studentToken);
  record('EXAM-SERVER-GRADE', exam.status, 'Server computes results; arbitrary score/pass is rejected', [400,422].includes(exam.status));
  const failedExam = await call('/api/exams/submit-final', 'POST', { userId: user.id, studentName: 'Review Student', score: 0, passed: false }, studentToken);
  const history = dbService.getLearningHistory(user.id);
  record('FAILED-EXAM-EVENT', { status: failedExam.status, lastAction: history[0]?.action }, 'Failed attempt is not classified as final_certified', history[0]?.action !== 'final_certified');

  const granted = await call('/api/admin/certificates', 'POST', { userId: user.id, type: 'honorary', reason: 'Manual review approved', idempotencyKey: 'review-certificate' }, adminToken);
  const code = (granted.data.certificate as Record<string, unknown> | undefined)?.certificate_code;
  record('ADMIN-CERT-LOOKUP', { status: granted.status, lookupFound: Boolean(code && dbService.getCertificateByCode(String(code))) }, 'Grant certificate writes a verifiable certificate record', Boolean(code && dbService.getCertificateByCode(String(code))));
  const audit = await call('/api/admin/audit?entity=users&entityId=review-student', 'GET', undefined, adminToken);
  record('AUDIT-EVIDENCE', { count: (audit.data.logs as unknown[]).length }, 'Server changes have audit evidence', (audit.data.logs as unknown[]).length > 0);
  record('AUDIT-REDACTION', { secretVisible: JSON.stringify(audit.data).includes('Review-user-2026') }, 'Audit redacts secrets', !JSON.stringify(audit.data).includes('Review-user-2026'));

  const selfDeleted = await call(`/api/users/${adminId}`, 'DELETE', undefined, adminToken);
  record('SELF-DELETE', selfDeleted.status, 'Backend rejects self-deletion', [400,403,409].includes(selfDeleted.status));
  const afterRequest = await call('/api/plans');
  const resurrected = Boolean(dbService.getUserByEmail(String(process.env.ADMIN_EMAIL)));
  record('BOOTSTRAP-RESURRECTION', { deletedStatus: selfDeleted.status, reappeared: resurrected, nextStatus: afterRequest.status }, 'Deleted accounts are not silently recreated per request', selfDeleted.status >= 400 || !resurrected);

  fs.writeFileSync(path.join(root, 'docs/admin-review/api-probe-after.json'), JSON.stringify({ date: '2026-10-01', environment: 'isolated temporary store; synthetic accounts', results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => r.verdict === 'FAIL')) process.exitCode = 1;
} finally {
  process.chdir(root);
  fs.rmSync(temporary, { recursive: true, force: true });
}
