import React, { useState } from 'react';
import { UserProfile } from '../../types/user.ts';
import { apiClient } from '../../services/apiClient.ts';

interface AdminAuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const AdminAuthScreen: React.FC<AdminAuthScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiClient.login({ email, password, authProvider: 'email' });
      if (res.user.role !== 'admin') {
        setError('Tài khoản này là Học Viên, không có quyền vào Cổng Quản Trị!');
        setTimeout(() => {
          window.location.replace('/');
        }, 1500);
        return;
      }
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập quản trị thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-portal-page admin-theme">
      <div className="auth-portal-card admin-card-auth">
        <div className="auth-portal-header">
          <div className="admin-portal-badge">👑 SYSTEM CMS</div>
          <h2>Cổng Quản Trị eSmiles Academy</h2>
          <p>Khu vực bảo mật dành riêng cho Quản trị viên và Ban đào tạo.</p>
        </div>

        {error && <div className="auth-alert error">⚠️ {error}</div>}
        {info && <div className="auth-alert success">🔄 {info}</div>}

        <form className="auth-form" onSubmit={handleAdminLogin}>
          <div className="form-group">
            <label>Email Quản Trị</label>
            <input
              type="email"
              placeholder="admin@esmiles.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Mật Khẩu Admin</label>
            <input
              type="password"
              placeholder="Nhập mật khẩu quản trị"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-warning auth-submit-btn" disabled={loading}>
            {loading ? 'Đang xác thực...' : 'Đăng Nhập Bảng Điều Khiển Admin 🔐'}
          </button>
        </form>
      </div>
    </div>
  );
};
