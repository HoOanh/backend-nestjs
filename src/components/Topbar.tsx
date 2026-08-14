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
}

export const Topbar: React.FC<TopbarProps> = ({
  tag,
  title,
  streakDays,
  theme,
  onToggleTheme,
  currentUser,
  onOpenHistory,
  onLogout
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="main-top-bar">
      <div className="top-bar-left">
        <span className="tag-badge">{tag}</span>
        <h2 className="top-bar-title" title={title}>{title}</h2>
      </div>
      <div className="top-bar-right">
        {/* Streak Badge */}
        <div className="user-streak-badge">
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
                    <div className="dropdown-user-plan">{(currentUser?.planId || 'free').toUpperCase()} PLAN</div>
                  </div>
                </div>

                <div className="user-dropdown-divider" />

                <button className="user-dropdown-item" onClick={() => { setIsUserMenuOpen(false); onOpenHistory(); }}>
                  <span>📊</span><span>Hồ Sơ & Kết Quả Học</span>
                </button>

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
