import { handleApiRequest, verifyPassword, hashPassword } from '../api/index.ts';

interface MockResponse {
  statusCode: number;
  data: Record<string, unknown> | null;
  headers: Record<string, string>;
  status(code: number): MockResponse;
  json(payload: Record<string, unknown>): MockResponse;
  setHeader(name: string, value: string): void;
}

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    data: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      this.data = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    }
  };
}

function extractCookieToken(res: MockResponse): string | null {
  const setCookie = res.headers['set-cookie'] || '';
  const match = setCookie.match(/esmiles_session=([^;]+)/);
  return match ? match[1] : null;
}

async function runE2ETests() {
  console.log('===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE E2E BUSINESS LOGIC TEST SUITE');
  console.log('    (Cookie-based Auth · ENV Admin · No Seed Users)');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${details || 'Assertion failed'}`);
    }
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@esmiles.vn';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026!';

  // -------------------------------------------------------------
  // SUITE 1: AUTHENTICATION & COOKIE SESSION
  // -------------------------------------------------------------
  console.log('📦 SUITE 1: Authentication, Cookie Session & Role Guards');

  // 1.1: Wrong password rejection
  let res = createMockResponse();
  await handleApiRequest(
    { method: 'POST', url: '/api/auth/login', body: { email: ADMIN_EMAIL, password: 'wrongpassword' } },
    res
  );
  assert('1.1 Reject invalid password with HTTP 401', res.statusCode === 401);

  // 1.2: Admin login from ENV credentials + cookie set
  res = createMockResponse();
  await handleApiRequest(
    { method: 'POST', url: '/api/auth/login', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } },
    res
  );
  const adminCookieToken = extractCookieToken(res);
  const adminResponseData = res.data as Record<string, unknown>;
  const adminUser = adminResponseData?.user as Record<string, unknown> | undefined;
  assert('1.2 Admin login from ENV credentials succeeds', res.statusCode === 200 && Boolean(adminCookieToken));
  assert('1.3 Backend sets httpOnly session cookie', Boolean(res.headers['set-cookie']?.includes('HttpOnly')));
  assert('1.4 Admin user role is "admin"', adminUser?.role === 'admin');

  // 1.5: Google OAuth auto-provision (new student)
  const testGoogleEmail = `testgoogle_${Date.now()}@gmail.com`;
  res = createMockResponse();
  await handleApiRequest(
    {
      method: 'POST', url: '/api/auth/google',
      body: { email: testGoogleEmail, name: 'Test Google Student', avatar: 'https://lh3.google.com/photo', googleId: `gid_${Date.now()}` }
    },
    res
  );
  const studentCookieToken = extractCookieToken(res);
  const studentResponseData = res.data as Record<string, unknown>;
  const studentUser = studentResponseData?.user as Record<string, unknown> | undefined;
  const studentUserId = studentUser?.id as string;
  assert('1.5 Google OAuth auto-provisions new student', res.statusCode === 200 && Boolean(studentCookieToken));
  assert('1.6 Google student role is "student"', studentUser?.role === 'student');

  // 1.7: Session verification via cookie
  res = createMockResponse();
  await handleApiRequest(
    { method: 'GET', url: '/api/auth/me', headers: { cookie: `esmiles_session=${studentCookieToken}` } },
    res
  );
  const meData = res.data as Record<string, unknown>;
  const meUser = meData?.user as Record<string, unknown> | undefined;
  assert('1.7 GET /api/auth/me verifies session from cookie', res.statusCode === 200 && meUser?.email === testGoogleEmail);

  // 1.8: Email registration (new student)
  const testRegEmail = `testreg_${Date.now()}@esmiles.vn`;
  res = createMockResponse();
  await handleApiRequest(
    {
      method: 'POST', url: '/api/auth/register',
      body: { name: 'Kỹ Sư E2E Test', email: testRegEmail, password: 'SecurePass123!', role: 'student', planId: 'pro' }
    },
    res
  );
  const regCookieToken = extractCookieToken(res);
  const regResponseData = res.data as Record<string, unknown>;
  const regUser = regResponseData?.user as Record<string, unknown> | undefined;
  const registeredUserId = regUser?.id as string;
  assert('1.8 Email registration creates user + sets cookie', res.statusCode === 201 && Boolean(regCookieToken));

  console.log('\n-------------------------------------------------------------');
  // -------------------------------------------------------------
  // SUITE 2: ADMIN-PROTECTED ENDPOINTS
  // -------------------------------------------------------------
  console.log('📦 SUITE 2: Admin-Protected Endpoints & Role Guards');

  // 2.1: Student cannot access admin endpoints
  res = createMockResponse();
  await handleApiRequest(
    { method: 'GET', url: '/api/users', headers: { cookie: `esmiles_session=${studentCookieToken}` } },
    res
  );
  assert('2.1 Student blocked from GET /api/users (403)', res.statusCode === 403);

  // 2.2: Student cannot access admin stats
  res = createMockResponse();
  await handleApiRequest(
    { method: 'GET', url: '/api/admin/stats', headers: { cookie: `esmiles_session=${studentCookieToken}` } },
    res
  );
  assert('2.2 Student blocked from GET /api/admin/stats (403)', res.statusCode === 403);

  // 2.3: Unauthenticated access blocked
  res = createMockResponse();
  await handleApiRequest(
    { method: 'GET', url: '/api/users', headers: {} },
    res
  );
  assert('2.3 Unauthenticated access returns 401', res.statusCode === 401);

  // 2.4: Admin can access users list
  res = createMockResponse();
  await handleApiRequest(
    { method: 'GET', url: '/api/users', headers: { cookie: `esmiles_session=${adminCookieToken}` } },
    res
  );
  const usersData = res.data as Record<string, unknown>;
  const usersList = usersData?.users as Array<Record<string, unknown>>;
  assert('2.4 Admin can GET /api/users', res.statusCode === 200 && usersList.length >= 2);

  // 2.5: Admin can access stats
  res = createMockResponse();
  await handleApiRequest(
    { method: 'GET', url: '/api/admin/stats', headers: { cookie: `esmiles_session=${adminCookieToken}` } },
    res
  );
  const statsData = res.data as Record<string, unknown>;
  const stats = statsData?.stats as Record<string, unknown>;
  assert('2.5 Admin can GET /api/admin/stats', res.statusCode === 200 && (stats?.totalUsers as number) >= 2);

  console.log('\n-------------------------------------------------------------');
  // -------------------------------------------------------------
  // SUITE 3: LEARNING PROGRESSION & EXAMS
  // -------------------------------------------------------------
  console.log('📦 SUITE 3: Learning Progression, Exams & Certificates');

  // 3.1: Log theory activity
  res = createMockResponse();
  await handleApiRequest(
    {
      method: 'POST', url: '/api/history',
      body: { userId: studentUserId, lessonId: 'lesson-1', lessonTitle: 'Bài 01: Core Architecture', action: 'theory_read', details: 'Hoàn thành đọc lý thuyết' }
    },
    res
  );
  assert('3.1 Theory reading logged to SQLite', res.statusCode === 201);

  // 3.2: Save progress
  res = createMockResponse();
  await handleApiRequest(
    {
      method: 'POST', url: '/api/progress',
      body: {
        userId: studentUserId,
        progress: {
          currentLessonId: 'lesson-2',
          completedLessons: { 'lesson-1': { completedAt: new Date().toISOString() } },
          sprintExamScores: {}, finalExam: null, streakDays: 2,
          lastActiveDate: new Date().toISOString().split('T')[0],
          clearedLessons: { 'lesson-1': true }
        }
      }
    },
    res
  );
  assert('3.2 Progress saved to SQLite', res.statusCode === 200);

  // 3.3: Sprint exam submission
  res = createMockResponse();
  await handleApiRequest(
    { method: 'POST', url: '/api/exams/submit-sprint', body: { userId: studentUserId, sprintId: 1, score: 95, passed: true } },
    res
  );
  assert('3.3 Sprint exam recorded', res.statusCode === 200);

  // 3.4: Final exam + certificate
  res = createMockResponse();
  await handleApiRequest(
    { method: 'POST', url: '/api/exams/submit-final', body: { userId: studentUserId, studentName: 'Test Google Student', score: 98, passed: true } },
    res
  );
  const finalData = res.data as Record<string, unknown>;
  const certCode = finalData?.certificateCode as string;
  assert('3.4 Final exam issues certificate code', res.statusCode === 200 && certCode?.startsWith('ESM-'));

  // 3.5: Certificate verification
  const certRecord = dbService.getCertificateByCode(certCode);
  assert('3.5 Certificate verified in SQLite', Boolean(certRecord) && certRecord?.student_name === 'Test Google Student');

  console.log('\n-------------------------------------------------------------');
  // -------------------------------------------------------------
  // SUITE 4: ADMIN CMS OPERATIONS
  // -------------------------------------------------------------
  console.log('📦 SUITE 4: Admin CMS Operations (with Auth Guard)');

  // 4.1: Admin updates plan
  res = createMockResponse();
  await handleApiRequest(
    { method: 'PATCH', url: '/api/plans/pro', body: { price: 990000, isActive: true } },
    res
  );
  const planData = res.data as Record<string, unknown>;
  const plan = planData?.plan as Record<string, unknown>;
  assert('4.1 Plan update persists in SQLite', res.statusCode === 200 && plan?.price === 990000);

  // 4.2: Admin fetches audit logs
  res = createMockResponse();
  await handleApiRequest(
    { method: 'GET', url: `/api/history?userId=${studentUserId}` },
    res
  );
  const histData = res.data as Record<string, unknown>;
  const history = histData?.history as Array<Record<string, unknown>>;
  assert('4.2 Admin fetches student audit logs', res.statusCode === 200 && history.length >= 3);

  // 4.3: Admin deletes user (with auth)
  res = createMockResponse();
  await handleApiRequest(
    { method: 'DELETE', url: `/api/users/${registeredUserId}`, headers: { cookie: `esmiles_session=${adminCookieToken}` } },
    res
  );
  assert('4.3 Admin delete user cascades cleanly', res.statusCode === 200);

  const deletedUser = dbService.getUserById(registeredUserId);
  assert('4.4 Deleted user no longer in SQLite', deletedUser === null);

  // 4.5: Logout clears cookie
  res = createMockResponse();
  await handleApiRequest(
    { method: 'POST', url: '/api/auth/logout', headers: { cookie: `esmiles_session=${studentCookieToken}` } },
    res
  );
  assert('4.5 Logout clears session cookie', res.statusCode === 200 && res.headers['set-cookie']?.includes('Max-Age=0'));

  // 4.6: Revoked session rejected
  const expiredCheck = dbService.getSessionByToken(studentCookieToken || '');
  assert('4.6 Revoked session token rejected', expiredCheck === null);

  console.log('\n===============================================================');
  console.log(`📊 FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED (${passedTests === totalTests ? '100% SUCCESS' : 'FAILURES DETECTED'})`);
  console.log('===============================================================\n');
}

void runE2ETests();
