import React, { useState } from 'react';
import { UserProfile } from '../types/user.ts';

interface TopbarProps {
  tag: string;
  title: string;
  streakDays: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentUser: UserProfile;
  onOpenHistory: () => void;
  onLogout: () => void;
  isAdminBypass?: boolean;
  onToggleAdminBypass?: () => void;
  onNavigateToAdmin?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  tag,
  title,
  streakDays,
  theme,
  onToggleTheme,
  currentUser,
  onOpenHistory,
  onLogout,
  isAdminBypass = false,
  onToggleAdminBypass,
  onNavigateToAdmin
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="main-top-bar">
      <div className="top-bar-left">
        <span className="tag-badge">{tag}</span>
        <h2 className="top-bar-title" title={title}>{title}</h2>
      </div>
      <div className="top-bar-right">
        {/* Admin Bypass Toggle Button */}
        {isAdmin && onToggleAdminBypass && (
          <button
            className={`admin-mode-toggle-btn ${isAdminBypass ? 'active' : ''}`}
            onClick={onToggleAdminBypass}
            title="Bật/tắt chế độ xem trước toàn bộ bài học của Admin"
          >
            <span>{isAdminBypass ? '⚡ Unlock All (Admin)' : '🔒 Student Mode'}</span>
          </button>
        )}

        {/* User Role Badge */}
        <div className={`user-role-badge ${currentUser?.role || 'student'}`}>
          {isAdmin ? '👑 Quản Trị Viên' : currentUser?.role === 'instructor' ? '👨‍🏫 Giảng Viên' : '🎓 Học Viên'}
        </div>

        {/* Streak Badge */}
        <div className="user-streak-badge" title={`Chuỗi học tập liên tiếp: ${streakDays} ngày`}>
          <span>🔥</span>
          <span>{streakDays} ngày</span>
        </div>

        {/* User Account Menu */}
        <div className="user-menu-wrapper">
          <button
            className="user-profile-btn"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-label="Menu tài khoản"
          >
            <span
              className="user-avatar"
              style={{ background: currentUser?.avatarColor || '#0ea5e9' }}
            >
              {(currentUser?.name || 'U').charAt(0).toUpperCase()}
            </span>
            <span className="user-display-name">{currentUser?.name || 'Học Viên'}</span>
            <span className="user-menu-chevron">▾</span>
          </button>

          {isUserMenuOpen && (
            <>
              <div className="user-menu-backdrop" onClick={() => setIsUserMenuOpen(false)} />
              <div className="user-dropdown-menu">
                <div className="user-dropdown-header">
                  <span
                    className="dropdown-avatar"
                    style={{ background: currentUser?.avatarColor || '#0ea5e9' }}
                  >
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="dropdown-user-name">{currentUser?.name || 'Học Viên'}</div>
                    <div className="dropdown-user-email">{currentUser?.email || ''}</div>
                    <div className="dropdown-user-plan">
                      {isAdmin ? 'SYSTEM ADMIN' : `${(currentUser?.planId || 'free').toUpperCase()} PLAN`}
                    </div>
                  </div>
                </div>

                <div className="user-dropdown-divider" />

                {isAdmin && onNavigateToAdmin && (
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onNavigateToAdmin();
                    }}
                  >
                    <span>⚙️</span><span>Trang Quản Trị (Admin CMS)</span>
                  </button>
                )}

                <button className="user-dropdown-item" onClick={() => { setIsUserMenuOpen(false); onOpenHistory(); }}>
                  <span>📊</span><span>Hồ Sơ & Tiến Độ Học Tập</span>
                </button>

                {isAdmin && onToggleAdminBypass && (
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onToggleAdminBypass();
                    }}
                  >
                    <span>⚡</span>
                    <span>{isAdminBypass ? 'Tắt Mở Khóa Preview' : 'Bật Mở Khóa Preview (Admin)'}</span>
                  </button>
                )}

                <button className="user-dropdown-item" onClick={() => { setIsUserMenuOpen(false); onToggleTheme(); }}>
                  <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
                  <span>Giao diện {theme === 'dark' ? 'Sáng' : 'Tối'}</span>
                </button>

                <div className="user-dropdown-divider" />

                <button className="user-dropdown-item logout" onClick={() => { setIsUserMenuOpen(false); onLogout(); }}>
                  <span>🚪</span><span>Đăng Xuất</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
