import React, { useState } from 'react';
import clsx from 'clsx';
import {
  PanelLeft,
  LayoutGrid,
  Radio,
  Bot,
  Zap,
  ChevronDown,
  Shield,
  History,
  Sun,
  Moon,
  LogOut,
  Unlock
} from 'lucide-react';
import { UserProfile } from '../../types/user.ts';
import { getModKey } from '../../utils/platform.ts';

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
  onNavigateToHub?: () => void;
  onOpenAiClassroom?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  isTutorOpen?: boolean;
  onToggleTutor?: () => void;
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
  onNavigateToAdmin,
  onNavigateToHub,
  onOpenAiClassroom,
  isSidebarCollapsed = false,
  onToggleSidebar,
  isTutorOpen = false,
  onToggleTutor
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="h-14 min-h-14 px-5 bg-surface border-b border-subtle flex items-center justify-between gap-4 shrink-0 z-20">
      {/* LEFT BREADCRUMB & TITLE */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            title={
              isSidebarCollapsed
                ? `Mở thanh điều hướng (${getModKey()}+B)`
                : `Ẩn thanh điều hướng (${getModKey()}+B)`
            }
            aria-label="Đóng mở thanh điều hướng"
            className={clsx(
              'w-8 h-8 rounded-md flex items-center justify-center border transition-colors cursor-pointer shrink-0',
              isSidebarCollapsed
                ? 'bg-accent/12 text-accent border-accent/35'
                : 'bg-surface-elevated text-secondary border-subtle hover:text-primary hover:border-strong'
            )}
          >
            <PanelLeft size={15} />
          </button>
        )}

        {onNavigateToHub && (
          <button
            type="button"
            onClick={onNavigateToHub}
            className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-surface-elevated hover:bg-accent/10 text-secondary hover:text-accent border border-subtle hover:border-accent/35 text-[11.5px] font-semibold transition-colors cursor-pointer shrink-0"
            title="Quay về Kho Khóa Học & Lộ Trình"
          >
            <LayoutGrid size={12} />
            <span>Kho Khóa Học</span>
          </button>
        )}

        <span className="inline-flex items-center h-6 px-2.5 rounded-md bg-accent/12 text-accent border border-accent/25 text-[11px] font-bold uppercase tracking-wider shrink-0">
          {tag}
        </span>

        <h2
          className="text-[14px] font-bold text-primary truncate m-0"
          title={title}
        >
          {title}
        </h2>
      </div>

      {/* RIGHT CONTEXTUAL ACTIONS */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Lesson-specific AI actions: ONLY rendered when studying a lesson */}
        {onOpenAiClassroom && (
          <button
            type="button"
            onClick={onOpenAiClassroom}
            title="Vào Phòng Học Trực Tiếp 1-1 Với AI Giảng Viên cho bài học này"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent hover:bg-accent-hover text-white text-[12px] font-semibold transition-colors cursor-pointer border border-accent"
          >
            <Radio size={13} />
            <span>Học 1-1 Với AI</span>
          </button>
        )}

        {onToggleTutor && (
          <button
            type="button"
            onClick={onToggleTutor}
            title={
              isTutorOpen
                ? `Đang mở Trợ giảng AI (${getModKey()}+J)`
                : `Mở Trợ giảng AI hỏi đáp nhanh (${getModKey()}+J)`
            }
            aria-label="Hỏi AI Tutor"
            className={clsx(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold border transition-colors cursor-pointer',
              isTutorOpen
                ? 'bg-accent/15 text-accent border-accent'
                : 'bg-surface-elevated text-secondary border-subtle hover:text-primary hover:border-strong'
            )}
          >
            <Bot size={14} />
            <span>Trợ Giảng AI</span>
          </button>
        )}

        {/* Streak Pill */}
        <div
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-500 text-[12px] font-semibold"
          title={`Chuỗi học tập liên tiếp: ${streakDays} ngày`}
        >
          <Zap size={13} />
          <span>{streakDays} ngày</span>
        </div>

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
          aria-label="Chuyển đổi giao diện Sáng/Tối"
          className="w-8 h-8 rounded-md bg-surface-elevated hover:bg-surface border border-subtle hover:border-strong text-secondary hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* User Account Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-label="Menu tài khoản"
            className="h-8 pl-1.5 pr-2.5 rounded-md bg-surface-elevated hover:bg-surface border border-subtle hover:border-strong flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span
              className="w-5 h-5 rounded text-[11px] font-bold text-white flex items-center justify-center shrink-0"
              style={{ background: currentUser?.avatarColor || '#0ea5e9' }}
            >
              {(currentUser?.name || 'U').charAt(0).toUpperCase()}
            </span>
            <span className="text-[12px] font-semibold text-primary max-w-[130px] truncate hidden sm:inline">
              {currentUser?.name || 'Học Viên'}
            </span>
            <ChevronDown size={13} className="text-muted" />
          </button>

          {isUserMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsUserMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface border border-subtle shadow-xl py-2 z-40">
                <div className="px-3.5 py-2.5 border-b border-subtle flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-lg text-sm font-bold text-white flex items-center justify-center shrink-0"
                    style={{
                      background: currentUser?.avatarColor || '#0ea5e9'
                    }}
                  >
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-primary truncate">
                      {currentUser?.name || 'Học Viên'}
                    </div>
                    <div className="text-[11.5px] text-muted truncate">
                      {currentUser?.email || ''}
                    </div>
                    <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-accent/12 text-accent">
                      {isAdmin
                        ? 'Quản Trị Viên'
                        : `${(currentUser?.planId || 'free').toUpperCase()} PLAN`}
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  {isAdmin && onNavigateToAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigateToAdmin();
                      }}
                      className="w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-secondary hover:text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                    >
                      <Shield size={14} className="text-accent" />
                      <span>Trang Quản Trị (Admin CMS)</span>
                    </button>
                  )}

                  {isAdmin && onToggleAdminBypass && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onToggleAdminBypass();
                      }}
                      className="w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-secondary hover:text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                    >
                      <Unlock size={14} className="text-amber-500" />
                      <span>
                        {isAdminBypass
                          ? 'Đang Bật Mở Khóa Toàn Bộ (Admin)'
                          : 'Bật Mở Khóa Preview (Admin)'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenHistory();
                    }}
                    className="w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-secondary hover:text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                  >
                    <History size={14} />
                    <span>Hồ Sơ &amp; Bảng Điểm Học Tập</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onToggleTheme();
                    }}
                    className="w-full px-3.5 py-2 text-left text-[12.5px] font-medium text-secondary hover:text-primary hover:bg-surface-elevated flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    <span>Giao diện {theme === 'dark' ? 'Sáng' : 'Tối'}</span>
                  </button>
                </div>

                <div className="border-t border-subtle pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3.5 py-2 text-left text-[12.5px] font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors cursor-pointer bg-transparent border-0"
                  >
                    <LogOut size={14} />
                    <span>Đăng Xuất</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
