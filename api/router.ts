import { dbService, verifyPassword, type DbUser, type DbPlan, type DbProgress, type DbHistory } from './db.ts';

interface ApiRequest {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(data: any): ApiResponse;
  setHeader?(name: string, value: string): void;
}

function getBearerToken(req: ApiRequest): string | null {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

const COOKIE_NAME = 'esmiles_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getTokenFromCookie(req: ApiRequest): string | null {
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

function setSessionCookie(res: ApiResponse, token: string): void {
  if ('setHeader' in res && typeof (res as Record<string, unknown>).setHeader === 'function') {
    (res as Record<string, unknown> & { setHeader: (name: string, value: string) => void }).setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`
    );
  }
}

function clearSessionCookie(res: ApiResponse): void {
  if ('setHeader' in res && typeof (res as Record<string, unknown>).setHeader === 'function') {
    (res as Record<string, unknown> & { setHeader: (name: string, value: string) => void }).setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
    );
  }
}

function formatUserResponse(u: DbUser) {

  return {
    id: u.id,
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

export async function handleApiRequest(req: ApiRequest, res: ApiResponse): Promise<void> {

  const url = req.url || '';
  const rawPathname = url.split('?')[0];
  const pathname = rawPathname.startsWith('/api') ? rawPathname : '/api' + rawPathname;
  const method = (req.method || 'GET').toUpperCase();

  const queryString = url.includes('?') ? url.split('?')[1] : '';
  const queryParams = new URLSearchParams(queryString);

  try {
    // ==========================================
    // 1. AUTH: Google OAuth Token Exchange / Login
    // ==========================================
    if (pathname === '/api/auth/google' && method === 'POST') {
      const { accessToken, credential, email, name, avatar, googleId } = req.body || {};

      let resolvedEmail = email;
      let resolvedName = name;
      let resolvedAvatar = avatar;
      let resolvedGoogleId = googleId;

      // 1. If real Google Access Token provided from OAuth popup, fetch profile from Google API
      if (accessToken && typeof accessToken === 'string') {
        try {
          const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (googleRes.ok) {
            const profile = await googleRes.json();
            if (profile.email) {
              resolvedEmail = profile.email;
              resolvedName = profile.name || profile.given_name || resolvedName;
              resolvedAvatar = profile.picture || resolvedAvatar;
              resolvedGoogleId = profile.sub || resolvedGoogleId;
            }
          }
        } catch (e) {
          console.warn('Google UserInfo Fetch Notice:', e);
        }
      }

      // 2. If Google JWT Credential was sent from Google Identity Services
      if (!resolvedEmail && credential && typeof credential === 'string') {
        try {
          const parts = credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
            if (payload.email) {
              resolvedEmail = payload.email;
              resolvedName = payload.name || resolvedName;
              resolvedAvatar = payload.picture || resolvedAvatar;
              resolvedGoogleId = payload.sub || resolvedGoogleId;
            }
          }
        } catch (e) {
          console.warn('JWT Decode notice:', e);
        }
      }

      if (!resolvedEmail) {
        return res.status(400).json({ error: 'Không nhận được thông tin tài khoản hợp lệ từ Google!' });
      }


      let user = dbService.getUserByEmail(resolvedEmail);
      if (!user) {
        // Auto-provision new student account
        user = dbService.createUser({
          id: 'usr_g_' + Date.now(),
          name: resolvedName || 'Học Viên Google',
          email: resolvedEmail.toLowerCase().trim(),
          role: 'student',
          avatar: resolvedAvatar || 'https://lh3.googleusercontent.com/a/ACg8ocIq8=s96-c',
          avatar_color: '#0ea5e9',
          auth_provider: 'google',
          google_id: resolvedGoogleId,
          plan_id: 'pro'
        });
      } else {
        user = dbService.updateUser(user.id, {
          last_login_at: new Date().toISOString(),
          avatar: resolvedAvatar || user.avatar,
          name: resolvedName || user.name
        }) || user;
      }

      // Create persistent database session
      const session = dbService.createSession(user.id);
      setSessionCookie(res, session.token);
      return res.status(200).json({
        success: true,
        token: session.token,
        user: formatUserResponse(user)
      });
    }

    // ==========================================
    // 2. AUTH: Email & Password Login
    // ==========================================
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu!' });
      }

      const user = dbService.getUserByEmail(email.trim());
      if (!user) {
        return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
      }

      // If user registered with email, verify password hash
      if (user.auth_provider === 'email' && user.password_hash && user.password_salt) {
        const isValid = verifyPassword(password, user.password_hash, user.password_salt);
        if (!isValid) {
          return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác!' });
        }
      }

      // Update last login
      const updatedUser = dbService.updateUser(user.id, { last_login_at: new Date().toISOString() }) || user;

      // Create persistent database session
      const session = dbService.createSession(updatedUser.id);
      setSessionCookie(res, session.token);
      return res.status(200).json({
        success: true,
        token: session.token,
        user: formatUserResponse(updatedUser)
      });
    }

    // ==========================================
    // 3. AUTH: Register New Account
    // ==========================================
    if (pathname === '/api/auth/register' && method === 'POST') {
      const { name, email, password, role, planId } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu!' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự!' });
      }

      const existing = dbService.getUserByEmail(email.trim());
      if (existing) {
        return res.status(409).json({ error: 'Email này đã được đăng ký trong hệ thống! Vui lòng đăng nhập.' });
      }

      const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
      const newUser = dbService.createUser({
        id: 'usr_' + Date.now(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: role || 'student',
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: 'email',
        plan_id: planId || 'free'
      });

      // Log registration event
      dbService.addLearningHistory({
        id: 'hist_' + Date.now(),
        user_id: newUser.id,
        action: 'registered',
        details: `Đăng ký tài khoản mới gói ${newUser.plan_id.toUpperCase()}`,
        timestamp: new Date().toISOString()
      });

      // Create persistent database session
      const session = dbService.createSession(newUser.id);
      setSessionCookie(res, session.token);
      return res.status(201).json({
        success: true,
        token: session.token,
        user: formatUserResponse(newUser)
      });
    }

    // ==========================================
    // 4. AUTH: Me (Session verification)
    // ==========================================
    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = getBearerToken(req) || getTokenFromCookie(req) || queryParams.get('token');
      if (!token) {
        return res.status(401).json({ error: 'Chưa đăng nhập (thiếu token)' });
      }

      const sessionData = dbService.getSessionByToken(token);
      if (!sessionData) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không tồn tại!' });
      }

      return res.status(200).json({
        success: true,
        user: formatUserResponse(sessionData.user)
      });
    }


    // ==========================================
    // 5. AUTH: Logout
    // ==========================================
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const token = getBearerToken(req) || getTokenFromCookie(req) || req.body?.token;
      if (token) {
        dbService.deleteSession(token);
      }
      clearSessionCookie(res);
      return res.status(200).json({ success: true, message: 'Đăng xuất thành công' });
    }

    // ==========================================
    // 6. USERS MANAGEMENT (Admin APIs)
    // ==========================================
    if (pathname === '/api/users' && method === 'GET') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) return res.status(401).json({ error: 'Chưa đăng nhập' });
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền quản trị' });
      }
      const users = dbService.getAllUsers();
      return res.status(200).json({ success: true, users });
    }

    if (pathname === '/api/users' && method === 'POST') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) return res.status(401).json({ error: 'Chưa đăng nhập' });
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền quản trị' });
      }
      const { name, email, password, role, planId } = req.body || {};
      const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
      const user = dbService.createUser({
        id: 'usr_' + Date.now(),
        name,
        email,
        password: password || '123456',
        role: role || 'student',
        plan_id: planId || 'pro',
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        auth_provider: 'email'
      });
      return res.status(201).json({ success: true, user });
    }

    if (pathname.startsWith('/api/users/') && method === 'PATCH') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) return res.status(401).json({ error: 'Chưa đăng nhập' });
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền quản trị' });
      }
      const id = pathname.replace('/api/users/', '');
      const updated = dbService.updateUser(id, req.body || {});
      return res.status(200).json({ success: true, user: updated });
    }

    if (pathname.startsWith('/api/users/') && method === 'DELETE') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) return res.status(401).json({ error: 'Chưa đăng nhập' });
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền quản trị' });
      }
      const id = pathname.replace('/api/users/', '');
      dbService.deleteUser(id);
      return res.status(200).json({ success: true });
    }

    // ==========================================
    // 7. PLANS MANAGEMENT
    // ==========================================
    if (pathname === '/api/plans' && method === 'GET') {
      const rawPlans = dbService.getAllPlans();
      const plans = rawPlans.map((p) => ({
        ...p,
        features: JSON.parse(p.features || '[]'),
        isPopular: Boolean(p.is_popular),
        isActive: Boolean(p.is_active)
      }));
      return res.status(200).json({ success: true, plans });
    }

    if (pathname.startsWith('/api/plans/') && method === 'PATCH') {
      const id = pathname.replace('/api/plans/', '');
      const { features, isPopular, isActive, ...rest } = req.body || {};
      const payload: Partial<DbPlan> = { ...rest };
      if (features) payload.features = JSON.stringify(features);
      if (isPopular !== undefined) payload.is_popular = isPopular ? 1 : 0;
      if (isActive !== undefined) payload.is_active = isActive ? 1 : 0;

      const updated = dbService.updatePlan(id, payload);
      return res.status(200).json({ success: true, plan: updated });
    }

    // ==========================================
    // 8. PROGRESS MANAGEMENT
    // ==========================================
    if (pathname.startsWith('/api/progress') && method === 'GET') {
      const userId = queryParams.get('userId') || pathname.split('/')[3];
      if (!userId) return res.status(400).json({ error: 'Thiếu userId' });

      const p = dbService.getUserProgress(userId);
      if (!p) {
        return res.status(200).json({
          success: true,
          progress: {
            currentLessonId: 'lesson-1',
            completedLessons: {},
            sprintExamScores: {},
            finalExam: null,
            streakDays: 1,
            lastActiveDate: new Date().toISOString().split('T')[0],
            clearedLessons: {}
          }
        });
      }

      return res.status(200).json({
        success: true,
        progress: {
          currentLessonId: p.current_lesson_id,
          completedLessons: JSON.parse(p.completed_lessons || '{}'),
          sprintExamScores: JSON.parse(p.sprint_exam_scores || '{}'),
          finalExam: p.final_exam ? JSON.parse(p.final_exam) : null,
          streakDays: p.streak_days,
          lastActiveDate: p.last_active_date,
          clearedLessons: JSON.parse(p.cleared_lessons || '{}')
        }
      });
    }

    if (pathname.startsWith('/api/progress') && method === 'POST') {
      const { userId, progress } = req.body || {};
      if (!userId || !progress) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });

      const dbPayload: DbProgress = {
        user_id: userId,
        current_lesson_id: progress.currentLessonId || 'lesson-1',
        completed_lessons: JSON.stringify(progress.completedLessons || {}),
        sprint_exam_scores: JSON.stringify(progress.sprintExamScores || {}),
        final_exam: progress.finalExam ? JSON.stringify(progress.finalExam) : '',
        streak_days: progress.streakDays || 1,
        last_active_date: progress.lastActiveDate || new Date().toISOString().split('T')[0],
        cleared_lessons: JSON.stringify(progress.clearedLessons || {}),
        updated_at: new Date().toISOString()
      };

      dbService.saveUserProgress(dbPayload);
      return res.status(200).json({ success: true });
    }

    // ==========================================
    // 9. EXAMS & CERTIFICATES
    // ==========================================
    if (pathname === '/api/exams/submit-sprint' && method === 'POST') {
      const { userId, sprintId, score, passed } = req.body || {};
      if (!userId || sprintId === undefined) return res.status(400).json({ error: 'Thiếu dữ liệu bài thi sprint' });

      // Update progress
      const currentProg = dbService.getUserProgress(userId);
      let sprintScores: Record<number, any> = {};
      if (currentProg?.sprint_exam_scores) {
        try { sprintScores = JSON.parse(currentProg.sprint_exam_scores); } catch (e) {}
      }
      sprintScores[sprintId] = { score, passed, completedAt: new Date().toISOString() };

      dbService.saveUserProgress({
        user_id: userId,
        current_lesson_id: currentProg?.current_lesson_id || 'lesson-1',
        completed_lessons: currentProg?.completed_lessons || '{}',
        sprint_exam_scores: JSON.stringify(sprintScores),
        final_exam: currentProg?.final_exam || '',
        streak_days: currentProg?.streak_days || 1,
        last_active_date: new Date().toISOString().split('T')[0],
        cleared_lessons: currentProg?.cleared_lessons || '{}',
        updated_at: new Date().toISOString()
      });

      // Add audit history record
      dbService.addLearningHistory({
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: `sprint-${sprintId}`,
        lesson_title: `Kỳ thi Sprint 0${sprintId}`,
        action: 'sprint_passed',
        score,
        details: passed ? `Đạt chuẩn (${score}%)` : `Chưa đạt (${score}%)`,
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({ success: true });
    }

    if (pathname === '/api/exams/submit-final' && method === 'POST') {
      const { userId, studentName, score, passed } = req.body || {};
      if (!userId || score === undefined) return res.status(400).json({ error: 'Thiếu dữ liệu thi tốt nghiệp' });

      const certificateCode = 'ESM-' + Math.floor(100000 + Math.random() * 900000);
      const now = new Date().toISOString();

      if (passed) {
        dbService.issueCertificate({
          id: 'cert_' + Date.now(),
          certificate_code: certificateCode,
          user_id: userId,
          student_name: studentName,
          score,
          completed_at: now
        });
      }

      // Update progress
      const currentProg = dbService.getUserProgress(userId);
      const finalResult = {
        score,
        passed,
        studentName,
        certificateId: certificateCode,
        completedAt: now
      };

      dbService.saveUserProgress({
        user_id: userId,
        current_lesson_id: currentProg?.current_lesson_id || 'lesson-1',
        completed_lessons: currentProg?.completed_lessons || '{}',
        sprint_exam_scores: currentProg?.sprint_exam_scores || '{}',
        final_exam: JSON.stringify(finalResult),
        streak_days: currentProg?.streak_days || 1,
        last_active_date: now.split('T')[0],
        cleared_lessons: currentProg?.cleared_lessons || '{}',
        updated_at: now
      });

      // Add audit history record
      dbService.addLearningHistory({
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: 'final-exam',
        lesson_title: 'Thi Tốt Nghiệp Toàn Khóa Master NestJS',
        action: 'final_certified',
        score,
        details: `Cấp chứng chỉ ${certificateCode} (${score}%)`,
        timestamp: now
      });

      return res.status(200).json({
        success: true,
        certificateCode,
        finalResult
      });
    }

    // ==========================================
    // 10. HISTORY MANAGEMENT
    // ==========================================
    if (pathname === '/api/history' && method === 'GET') {
      const userId = queryParams.get('userId') || undefined;
      const history = dbService.getLearningHistory(userId);
      return res.status(200).json({ success: true, history });
    }

    if (pathname === '/api/history' && method === 'POST') {
      const { userId, lessonId, lessonTitle, action, score, details } = req.body || {};
      const newRecord: DbHistory = {
        id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        lesson_id: lessonId,
        lesson_title: lessonTitle,
        action: action || 'activity',
        score,
        details,
        timestamp: new Date().toISOString()
      };
      dbService.addLearningHistory(newRecord);
      return res.status(201).json({ success: true, record: newRecord });
    }

    // ==========================================
    // 11. ADMIN STATS
    // ==========================================
    if (pathname === '/api/admin/stats' && method === 'GET') {
      const adminToken = getBearerToken(req) || getTokenFromCookie(req);
      if (!adminToken) return res.status(401).json({ error: 'Chưa đăng nhập' });
      const adminSession = dbService.getSessionByToken(adminToken);
      if (!adminSession || adminSession.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền quản trị' });
      }
      const stats = dbService.getAdminStats();
      return res.status(200).json({ success: true, stats });
    }

    // Not matched
    return res.status(404).json({ error: 'API route not found' });
  } catch (error: any) {
    console.error('API_ERROR:', error);
    return res.status(500).json({ error: error.message || 'Lỗi xử lý máy chủ' });
  }
}
