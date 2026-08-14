import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types/user.ts';
import { apiClient } from '../../services/apiClient.ts';

// force majeure: Google GIS SDK types not available
declare global {
  interface Window {
    google?: any;
  }
}

interface StudentAuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

// Google OAuth 2.0 Client ID (supports standard env variable)
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

export const StudentAuthScreen: React.FC<StudentAuthScreenProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Initialize Google Identity Services (GIS) button or One-Tap if script loaded
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: any) => {
            if (response.credential) {
              setIsGoogleLoading(true);
              try {
                const res = await apiClient.loginGoogle({ credential: response.credential });
                if (res.user.role === 'admin') {
                  window.location.replace('/admin');
                } else {
                  onLoginSuccess(res.user);
                }
              } catch (err: any) {
                setError(err.message || 'Lỗi xác thực Google ID Token');
              } finally {
                setIsGoogleLoading(false);
              }
            }
          }
        });
      }
    } catch (e) {
      console.warn('GIS Init notice:', e);
    }
  }, [onLoginSuccess]);

  // Real Google OAuth Popup Trigger
  const handleGoogleOAuthLogin = async () => {
    if (!GOOGLE_CLIENT_ID) return;
    
    setError('');
    setInfo('');
    setIsGoogleLoading(true);

    try {
      // 1. Try Google Identity Services OAuth2 Token Client (Opens Real Google Popup)
      if (window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              setError('Đã hủy đăng nhập Google hoặc phát sinh lỗi OAuth.');
              setIsGoogleLoading(false);
              return;
            }

            if (tokenResponse?.access_token) {
              try {
                const res = await apiClient.loginGoogle({ accessToken: tokenResponse.access_token });
                if (res.user.role === 'admin') {
                  setInfo('Tài khoản Quản Trị Viên! Đang chuyển sang Cổng Admin...');
                  setTimeout(() => window.location.replace('/admin'), 500);
                } else {
                  onLoginSuccess(res.user);
                }
              } catch (apiErr: any) {
                setError(apiErr.message || 'Lỗi đồng bộ tài khoản Google với SQLite');
              } finally {
                setIsGoogleLoading(false);
              }
            }
          }
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }

      // 2. Fallback: Direct OAuth2 Popup Flow to accounts.google.com
      const redirectUri = window.location.origin;
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        GOOGLE_CLIENT_ID
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token&scope=openid%20email%20profile&prompt=select_account`;

      const popup = window.open(oauthUrl, 'GoogleAuthPopup', 'width=500,height=600,menubar=no,toolbar=no');
      if (!popup) {
        throw new Error('Trình duyệt đã chặn popup Google. Vui lòng cấp quyền mở popup để đăng nhập Google!');
      }

      // Polling popup closure & access_token from hash
      const pollTimer = window.setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            window.clearInterval(pollTimer);
            setIsGoogleLoading(false);
            return;
          }

          if (popup.location.href.includes('access_token=')) {
            const hash = popup.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            popup.close();
            window.clearInterval(pollTimer);

            if (accessToken) {
              const res = await apiClient.loginGoogle({ accessToken });
              if (res.user.role === 'admin') {
                window.location.replace('/admin');
              } else {
                onLoginSuccess(res.user);
              }
            }
          }
        } catch {
          // Cross-origin reading until redirected back
        }
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Không thể mở cửa sổ xác thực Google');
      setIsGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiClient.login({ email, password });

      if (res.user.role === 'admin') {
        setInfo('Phát hiện tài khoản Quản Trị Viên! Đang tự động chuyển sang Cổng Quản Trị (/admin)...');
        setTimeout(() => {
          window.location.replace('/admin');
        }, 600);
        return;
      }

      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email & mật khẩu!');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ họ tên, email và mật khẩu!');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự!');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: 'student',
        planId
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Đăng ký tài khoản thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-portal-page">
      <div className="auth-portal-card">
        <div className="auth-portal-header">
          <div className="portal-logo-badge">🦷</div>
          <h2>eSmiles Backend Academy</h2>
          <p>Cổng Học Tập Master NestJS 11 & Prisma 7 Cho Kỹ Sư Frontend</p>
        </div>

        {/* Real Google OAuth Button (Triggers Authentic Google Popup) */}
        {GOOGLE_CLIENT_ID && (
          <>
            <button
              type="button"
              className="btn-google-auth-portal"
              onClick={handleGoogleOAuthLogin}
              disabled={isGoogleLoading}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleLoading ? 'Đang mở cửa sổ Google OAuth...' : 'Đăng nhập bằng tài khoản Google'}</span>
            </button>

            <div className="auth-portal-divider">
              <span>hoặc dùng Email & Mật Khẩu</span>
            </div>
          </>
        )}

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); setInfo(''); }}
          >
            🔑 Đăng Nhập Học Viên
          </button>
          <button
            className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); setError(''); setInfo(''); }}
          >
            ✨ Đăng Ký Tài Khoản
          </button>
        </div>

        {error && <div className="auth-alert error">⚠️ {error}</div>}
        {info && <div className="auth-alert success">🔄 {info}</div>}

        {tab === 'login' ? (
          <form className="auth-form" onSubmit={handleEmailLogin}>
            <div className="form-group">
              <label>Email đăng ký học viên</label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              {loading ? 'Đang xác thực bảo mật PBKDF2...' : 'Đăng Nhập Vào Khóa Học ➡️'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleEmailRegister}>
            <div className="form-group">
              <label>Họ và Tên Học Viên</label>
              <input
                type="text"
                placeholder="Ví dụ: Hoàng Đức Oanh"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Cá Nhân / Doanh Nghiệp</label>
              <input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu (Tối thiểu 6 ký tự)</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Gói Khóa Học Muốn Học</label>
              <select value={planId} onChange={(e) => setPlanId(e.target.value as any)}>
                <option value="pro">⭐ Gói Pro Master (Trọn gói 6 Sprints + AI 24/7)</option>
                <option value="free">Trải nghiệm Miễn Phí (Sprint 1)</option>
                <option value="enterprise">🏢 Doanh Nghiệp (Nhóm Kỹ Sư)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-success auth-submit-btn" disabled={loading}>
              {loading ? 'Đang tạo tài khoản vào SQLite...' : 'Đăng Ký & Bắt Đầu Học ✨'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
