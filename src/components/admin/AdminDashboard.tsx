import React, { useState, useEffect } from 'react';
import { UserProfile, CoursePlan, LearningHistoryRecord } from '../../types/user.ts';
import { apiClient } from '../../services/apiClient.ts';
import { CURRICULUM } from '../../data/curriculum.ts';

interface AdminDashboardProps {
  currentUser: UserProfile;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  theme,
  onToggleTheme,
  onLogout
}) => {
  const [activeMenu, setActiveMenu] = useState<'overview' | 'users' | 'plans' | 'curriculum' | 'ai' | 'logs'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<CoursePlan[]>([]);
  const [logs, setLogs] = useState<LearningHistoryRecord[]>([]);
  const [stats, setStats] = useState<{ totalUsers: number; totalRevenue: number; certifiedStudents: number; totalActivityLogs: number }>({
    totalUsers: 0,
    totalRevenue: 0,
    certifiedStudents: 0,
    totalActivityLogs: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // User Edit / Add Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState<{
    name: string;
    email: string;
    role: 'student' | 'admin' | 'instructor';
    planId: 'free' | 'pro' | 'enterprise';
  }>({
    name: '',
    email: '',
    role: 'student',
    planId: 'pro'
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const totalLessons = CURRICULUM.reduce((acc, s) => acc + s.lessons.length, 0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uList, pList, lList, sData] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getPlans(),
        apiClient.getHistory(),
        apiClient.getAdminStats()
      ]);
      setUsers(uList);
      setPlans(pList);
      setLogs(lList);
      if (sData) {
        setStats(sData);
      }
    } catch (e: any) {
      showToast(e.message || 'Lỗi tải dữ liệu SQLite');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // User Actions calling SQLite REST API
  const handleUnlockAllForUser = async (user: UserProfile) => {
    const allCleared: Record<string, boolean> = {};
    const allCompleted: Record<string, { completedAt: string }> = {};

    CURRICULUM.forEach((sp) => {
      sp.lessons.forEach((l) => {
        allCleared[l.id] = true;
        allCompleted[l.id] = { completedAt: new Date().toISOString() };
      });
    });

    try {
      const currentProg = await apiClient.getProgress(user.id);
      const baseProg = currentProg || {
        currentLessonId: 'lesson-1',
        completedLessons: {},
        sprintExamScores: {},
        finalExam: null,
        streakDays: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        clearedLessons: {}
      };
      await apiClient.saveProgress(user.id, {
        ...baseProg,
        completedLessons: allCompleted,
        clearedLessons: allCleared
      });
      await apiClient.addHistory({
        userId: user.id,
        lessonTitle: 'Toàn bộ 6 Sprints',
        action: 'theory_read',
        details: 'Admin mở khóa 100% bài học'
      });
      showToast(`Đã mở khóa toàn bộ ${totalLessons} bài học cho ${user.name}!`);
      void loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi mở khóa bài học');
    }
  };

  const handleGrantCertForUser = async (user: UserProfile) => {
    const certId = 'ESM-CERT-' + Math.floor(100000 + Math.random() * 900000);
    try {
      const currentProg = await apiClient.getProgress(user.id);
      const baseProg = currentProg || {
        currentLessonId: 'lesson-1',
        completedLessons: {},
        sprintExamScores: {},
        finalExam: null,
        streakDays: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        clearedLessons: {}
      };
      await apiClient.saveProgress(user.id, {
        ...baseProg,
        finalExam: {
          score: 100,
          passed: true,
          studentName: user.name,
          certificateId: certId,
          completedAt: new Date().toISOString()
        }
      });
      await apiClient.addHistory({
        userId: user.id,
        lessonTitle: 'Chứng Chỉ Danh Dự',
        action: 'final_certified',
        score: 100,
        details: `Admin cấp chứng chỉ ${certId}`
      });
      showToast(`Đã cấp Chứng Chỉ Tốt Nghiệp danh dự cho ${user.name}!`);
      void loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi cấp chứng chỉ');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      alert('Không thể tự xóa tài khoản admin đang đăng nhập!');
      return;
    }
    if (!confirm('Đại ca có chắc muốn xóa tài khoản này khỏi cơ sở dữ liệu SQLite?')) return;
    try {
      await apiClient.deleteUser(userId);
      showToast('Đã xóa tài khoản thành công khỏi SQLite!');
      void loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi xóa tài khoản');
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await apiClient.updateUser(editingUser.id, editingUser);
      setEditingUser(null);
      showToast(`Đã lưu thay đổi cho ${editingUser.name}!`);
      void loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu thông tin');
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email.trim()) {
      alert('Vui lòng nhập họ tên và email!');
      return;
    }
    try {
      await apiClient.createUser(newUserForm);
      setIsAddUserOpen(false);
      setNewUserForm({ name: '', email: '', role: 'student', planId: 'pro' });
      showToast(`Đã thêm thành viên mới vào SQLite!`);
      void loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi tạo thành viên');
    }
  };

  const handleTogglePlan = async (plan: CoursePlan) => {
    try {
      await apiClient.updatePlan(plan.id, { isActive: !plan.isActive });
      showToast('Đã cập nhật trạng thái gói học trong SQLite!');
      void loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi cập nhật gói');
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-cms-wrapper">
      {/* Admin Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-brand-box">
            <span className="brand-icon">👑</span>
            <div>
              <h1 className="brand-title">eSmiles Admin</h1>
              <span className="brand-sub">Quản Trị Hệ Thống Academy (SQLite)</span>
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          <div className="admin-nav-section">PHÂN HỆ QUẢN TRỊ</div>
          <button
            className={`admin-nav-item ${activeMenu === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveMenu('overview')}
          >
            <span className="nav-icon">📊</span>
            <span>Tổng Quan & Báo Cáo</span>
          </button>
          <button
            className={`admin-nav-item ${activeMenu === 'users' ? 'active' : ''}`}
            onClick={() => setActiveMenu('users')}
          >
            <span className="nav-icon">👥</span>
            <span>Quản Lý Tài Khoản ({users.length})</span>
          </button>
          <button
            className={`admin-nav-item ${activeMenu === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveMenu('plans')}
          >
            <span className="nav-icon">💳</span>
            <span>Gói Khóa Học & Học Phí</span>
          </button>
          <button
            className={`admin-nav-item ${activeMenu === 'curriculum' ? 'active' : ''}`}
            onClick={() => setActiveMenu('curriculum')}
          >
            <span className="nav-icon">📚</span>
            <span>Giáo Trình & Sprints</span>
          </button>
          <button
            className={`admin-nav-item ${activeMenu === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveMenu('ai')}
          >
            <span className="nav-icon">🤖</span>
            <span>Cấu Hình AI Tutor</span>
          </button>
          <button
            className={`admin-nav-item ${activeMenu === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveMenu('logs')}
          >
            <span className="nav-icon">📜</span>
            <span>Nhật Ký Học & Logs</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="db-badge-info">
            <span>💾 SQLite Engine Active</span>
          </div>
          <button className="btn-admin-logout" onClick={onLogout}>
            <span>🚪 Đăng Xuất Admin</span>
          </button>
        </div>
      </aside>

      {/* Admin Main View */}
      <main className="admin-main-content">
        {/* Admin Topbar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <h2 className="admin-page-title">
              {activeMenu === 'overview' && '📊 Dashboard Tổng Quan eSmiles Academy'}
              {activeMenu === 'users' && '👥 Quản Lý Tài Khoản Học Viên & Phân Quyền'}
              {activeMenu === 'plans' && '💳 Quản Lý Gói Khóa Học & Doanh Thu'}
              {activeMenu === 'curriculum' && '📚 Quản Lý 6 Sprints & 22+ Bài Học Chuyên Sâu'}
              {activeMenu === 'ai' && '🤖 Cấu Hình Google Gemini AI Tutor (14 Models)'}
              {activeMenu === 'logs' && '📜 Nhật Ký Hoạt Động & Kết Quả Học Tập'}
            </h2>
          </div>
          <div className="admin-topbar-right">
            <button
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              title="Đổi giao diện Sáng/Tối"
            >
              <span>{theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}</span>
            </button>

            <div className="admin-profile-pill">
              <span className="admin-avatar">👑</span>
              <div className="admin-profile-info">
                <span className="admin-name">{currentUser.name}</span>
                <span className="admin-role">Super Admin</span>
              </div>
            </div>
          </div>
        </header>

        {toastMessage && (
          <div className="admin-toast-banner">
            ✨ {toastMessage}
          </div>
        )}

        <div className="admin-scrollable-body">
          {/* 1. OVERVIEW DASHBOARD */}
          {activeMenu === 'overview' && (
            <div className="admin-tab-pane">
              <div className="admin-metrics-grid">
                <div className="metric-card gold">
                  <div className="metric-icon">💰</div>
                  <div className="metric-data">
                    <span className="metric-label">Tổng Doanh Thu Khóa Học</span>
                    <h3 className="metric-value">{stats.totalRevenue.toLocaleString('vi-VN')} đ</h3>
                    <span className="metric-trend up">Đồng bộ SQLite DB</span>
                  </div>
                </div>

                <div className="metric-card blue">
                  <div className="metric-icon">👥</div>
                  <div className="metric-data">
                    <span className="metric-label">Tổng Học Viên</span>
                    <h3 className="metric-value">{stats.totalUsers} thành viên</h3>
                    <span className="metric-trend up">Đang học tập</span>
                  </div>
                </div>

                <div className="metric-card green">
                  <div className="metric-icon">🎓</div>
                  <div className="metric-data">
                    <span className="metric-label">Chứng Chỉ Đã Cấp</span>
                    <h3 className="metric-value">{stats.certifiedStudents} chứng chỉ</h3>
                    <span className="metric-trend">Tốt nghiệp Master NestJS</span>
                  </div>
                </div>

                <div className="metric-card purple">
                  <div className="metric-icon">🤖</div>
                  <div className="metric-data">
                    <span className="metric-label">Google AI Tutor</span>
                    <h3 className="metric-value">14 Models</h3>
                    <span className="metric-trend up">● Gemini 3.7 Flash Active</span>
                  </div>
                </div>
              </div>

              {/* Recent Students & Summary */}
              <div className="admin-grid-2col">
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h3>⚡ Học Viên Mới Nhất</h3>
                    <button className="btn-link" onClick={() => setActiveMenu('users')}>Xem tất cả →</button>
                  </div>
                  <div className="recent-users-list">
                    {users.slice(0, 5).map((u) => (
                      <div key={u.id} className="recent-user-row">
                        <div className="recent-user-info">
                          <span
                            className="user-avatar-sm"
                            style={{ background: u.avatarColor || '#0ea5e9' }}
                          >
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <strong className="user-row-name">{u.name || 'Học Viên'}</strong>
                            <span className="user-row-email">{u.email}</span>
                          </div>
                        </div>
                        <div className="recent-user-meta">
                          <span className={`plan-pill ${u.planId || 'free'}`}>{(u.planId || 'free').toUpperCase()}</span>
                          <span className="progress-badge">{u.role === 'admin' ? '👑 Admin' : '🎓 Học Viên'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-card">
                  <div className="admin-card-header">
                    <h3>🚀 Thao Tác Nhanh Quản Trị</h3>
                  </div>
                  <div className="quick-action-boxes">
                    <div className="quick-box">
                      <div>
                        <strong>Thêm Tài Khoản Học Viên / Giảng Viên</strong>
                        <p>Tạo tài khoản mới trực tiếp vào cơ sở dữ liệu SQLite.</p>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setIsAddUserOpen(true)}
                      >
                        + Thêm Mới
                      </button>
                    </div>

                    <div className="quick-box">
                      <div>
                        <strong>Đồng Bộ & Kiểm Tra Kết Nối DB</strong>
                        <p>Nạp lại toàn bộ dữ liệu người dùng và lịch sử học tập.</p>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={loadData}
                      >
                        🔄 Refresh DB
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. USER MANAGEMENT */}
          {activeMenu === 'users' && (
            <div className="admin-tab-pane">
              <div className="admin-table-toolbar">
                <div className="search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Tìm theo tên học viên, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" onClick={() => setIsAddUserOpen(true)}>
                  ➕ Thêm Thành Viên Mới
                </button>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Học Viên / Kỹ Sư</th>
                      <th>Hình Thức</th>
                      <th>Gói Đăng Ký</th>
                      <th>Vai Trò</th>
                      <th>Đăng Nhập Lần Cuối</th>
                      <th>Hành Động Quản Trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isCurrent = u.id === currentUser.id;
                      return (
                        <tr key={u.id} className={isCurrent ? 'highlight-row' : ''}>
                          <td>
                            <div className="user-profile-cell">
                              <span
                                className="user-avatar-badge"
                                style={{ background: u.avatarColor || '#0ea5e9' }}
                              >
                                {(u.name || 'U').charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <div className="user-cell-name">
                                  {u.name || 'Học Viên'} {isCurrent && <span className="current-badge">(Admin)</span>}
                                </div>
                                <div className="user-cell-email">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="provider-tag">
                              {u.authProvider === 'google' ? '🌐 Google' : '✉️ Email'}
                            </span>
                          </td>
                          <td>
                            <span className={`plan-pill ${u.planId}`}>
                              {u.planId === 'enterprise' ? '🏢 Doanh Nghiệp' : u.planId === 'pro' ? '⭐ Pro Master' : 'Trải Nghiệm'}
                            </span>
                          </td>
                          <td>
                            <span className={`role-badge ${u.role}`}>
                              {u.role === 'admin' ? '👑 Admin' : u.role === 'instructor' ? '👨‍🏫 Giảng Viên' : '🎓 Học Viên'}
                            </span>
                          </td>
                          <td>
                            <span className="date-tag">{new Date(u.lastLoginAt).toLocaleDateString('vi-VN')}</span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="action-btn unlock"
                                title="Mở khóa 100% bài học cho học viên này"
                                onClick={() => handleUnlockAllForUser(u)}
                              >
                                🔓 Mở bài
                              </button>
                              <button
                                className="action-btn cert"
                                title="Cấp bằng tốt nghiệp ngay"
                                onClick={() => handleGrantCertForUser(u)}
                              >
                                🎓 Cấp bằng
                              </button>
                              <button
                                className="action-btn edit"
                                title="Sửa thông tin / Đổi gói"
                                onClick={() => setEditingUser(u)}
                              >
                                ✏️
                              </button>
                              {!isCurrent && (
                                <button
                                  className="action-btn delete"
                                  title="Xóa khỏi SQLite"
                                  onClick={() => handleDeleteUser(u.id)}
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. COURSE PLANS */}
          {activeMenu === 'plans' && (
            <div className="admin-tab-pane">
              <div className="plans-header-row">
                <div>
                  <h3 className="section-heading">Danh Sách Gói Khóa Học & Doanh Thu</h3>
                  <p className="section-sub">Quản lý học phí, phân cấp quyền hạn học tập và quyền truy cập AI Tutor cho từng gói.</p>
                </div>
              </div>

              <div className="admin-plans-grid">
                {plans.map((plan) => (
                  <div key={plan.id} className={`admin-plan-card ${plan.isPopular ? 'popular' : ''}`}>
                    {plan.isPopular && <div className="popular-badge">⭐ GÓI BÁN CHẠY NHẤT</div>}
                    <div className="plan-card-header">
                      <h3>{plan.name}</h3>
                      <div className="plan-price-display">
                        <span className="price-num">
                          {plan.price === 0 ? 'Miễn Phí' : `${plan.price.toLocaleString('vi-VN')} đ`}
                        </span>
                        <span className="price-period">/ {plan.billingPeriod}</span>
                      </div>
                      <p className="plan-card-desc">{plan.description}</p>
                    </div>

                    <div className="plan-features-list">
                      <strong>Quyền lợi bao gồm:</strong>
                      <ul>
                        {plan.features.map((feat, idx) => (
                          <li key={idx}>✓ {feat}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="plan-card-footer">
                      <div className="plan-status-toggle">
                        <span>Trạng thái: </span>
                        <strong style={{ color: plan.isActive ? '#10b981' : '#ef4444' }}>
                          {plan.isActive ? 'Đang Mở Bán' : 'Tạm Khóa'}
                        </strong>
                      </div>
                      <button
                        className={`btn btn-sm ${plan.isActive ? 'btn-secondary' : 'btn-success'}`}
                        onClick={() => handleTogglePlan(plan)}
                      >
                        {plan.isActive ? 'Tạm Khóa Gói' : 'Kích Hoạt Gói'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. CURRICULUM */}
          {activeMenu === 'curriculum' && (
            <div className="admin-tab-pane">
              <div className="curriculum-overview-header">
                <h3>Cấu Trúc Giáo Trình eSmiles Backend Academy</h3>
                <p>Khóa học gồm 6 Sprints theo chuẩn kiến trúc eSmiles CMS, Prisma 7 và NestJS 11.</p>
              </div>

              <div className="sprints-admin-list">
                {CURRICULUM.map((sprint, spIdx) => (
                  <div key={sprint.sprintId} className="sprint-admin-card">
                    <div className="sprint-admin-header">
                      <div className="sprint-title-area">
                        <span className="sprint-number-tag">SPRINT 0{spIdx + 1}</span>
                        <h4>{sprint.sprintTitle}</h4>
                      </div>
                      <span className="sprint-count-tag">{sprint.lessons.length} Bài học chuyên sâu</span>
                    </div>

                    <div className="sprint-lessons-subtable">
                      {sprint.lessons.map((l, lIdx) => (
                        <div key={l.id} className="sprint-lesson-row">
                          <div className="lesson-row-left">
                            <span className="lesson-idx">#{lIdx + 1}</span>
                            <span className="lesson-tag-pill">{l.tag}</span>
                            <span className="lesson-title-text">{l.title}</span>
                          </div>
                          <div className="lesson-row-right">
                            <span className="quiz-count">❓ {l.quiz.length} Câu trắc nghiệm</span>
                            <span className="test-count">💻 {l.codeChallenge.testCases.length} Tests</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. AI SETTINGS */}
          {activeMenu === 'ai' && (
            <div className="admin-tab-pane">
              <div className="ai-admin-card">
                <div className="ai-admin-header">
                  <div className="ai-title-row">
                    <span className="ai-icon">🤖</span>
                    <div>
                      <h3>Google Gemini AI Tutor Engine</h3>
                      <p>Hệ thống gia sư kỹ thuật giải thích code real-world cho học viên eSmiles</p>
                    </div>
                  </div>
                  <span className="ai-connected-badge">● API Sẵn Sàng (14 Models)</span>
                </div>

                <div className="ai-settings-grid">
                  <div className="ai-setting-item">
                    <label>Model Mặc Định Hệ Thống</label>
                    <select defaultValue="gemini-3.7-flash">
                      <option value="gemini-3.7-flash">Gemini 3.7 Flash (Mới nhất · Suy luận & Code đỉnh cao)</option>
                      <option value="gemini-3.6-flash">Gemini 3.6 Flash (Tốc độ cao)</option>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Cân bằng chất lượng)</option>
                      <option value="gemini-3.1-pro">Gemini 3.1 Pro (Phân tích sâu Architecture)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Chuyên sâu NestJS)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Nhanh & Ổn định)</option>
                    </select>
                  </div>

                  <div className="ai-setting-item">
                    <label>Phong Cách Giảng Dạy Của Tutor</label>
                    <select defaultValue="direct">
                      <option value="direct">Trực diện · Kỹ thuật chuẩn xác · Xưng Em gọi Đại Ca</option>
                      <option value="socratic">Gợi mở tư duy (Socratic method)</option>
                    </select>
                  </div>
                </div>

                <div className="ai-prompt-preview">
                  <label>System Prompt Đang Áp Dụng Cho Tutor:</label>
                  <pre>
{`Em là một tutor kỹ thuật của eSmiles Backend Academy.
Nhiệm vụ: giúp học viên hiểu thật chắc bài học hiện tại trước khi làm trắc nghiệm.
Quy tắc bắt buộc:
1. Chỉ dùng thông tin trong LESSON_CONTEXT và suy luận trực tiếp từ đó.
2. Trả lời bằng tiếng Việt, xưng "em", gọi người học là "ĐẠI CA". Giọng rõ, thẳng, kỹ thuật.
3. Khi giải thích code: Vấn đề -> Cơ chế -> Code mẫu -> Kết luận ngắn gọn.`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* 6. AUDIT LOGS */}
          {activeMenu === 'logs' && (
            <div className="admin-tab-pane">
              <div className="logs-header">
                <h3>Nhật Ký Hoạt Động & Học Tập (Từ SQLite DB)</h3>
                <p>Ghi nhận toàn bộ tương tác học viên: đọc lý thuyết, làm trắc nghiệm, nộp code sandbox và nhận chứng chỉ.</p>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Thời Gian</th>
                      <th>Mã Học Viên</th>
                      <th>Bài Học / Mục</th>
                      <th>Hành Động</th>
                      <th>Kết Quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                          Chưa có nhật ký học tập nào trong cơ sở dữ liệu SQLite.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.timestamp).toLocaleString('vi-VN')}</td>
                          <td><code>{log.userId}</code></td>
                          <td><strong>{log.lessonTitle}</strong></td>
                          <td>
                            <span className="action-tag">{log.action}</span>
                          </td>
                          <td>{log.details || (log.score ? `${log.score} điểm` : 'Hoàn thành')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content admin-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Chỉnh Sửa Thông Tin Thành Viên</h3>
              <button className="modal-close-btn" onClick={() => setEditingUser(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEditUser} className="auth-form">
              <div className="form-group">
                <label>Họ và Tên</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Gói Đăng Ký</label>
                  <select
                    value={editingUser.planId}
                    onChange={(e) => setEditingUser({ ...editingUser, planId: e.target.value as any })}
                  >
                    <option value="free">Trải nghiệm Miễn Phí</option>
                    <option value="pro">⭐ Pro Master</option>
                    <option value="enterprise">🏢 Doanh Nghiệp</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Vai Trò Hệ Thống</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  >
                    <option value="student">🎓 Học Viên</option>
                    <option value="instructor">👨‍🏫 Giảng Viên</option>
                    <option value="admin">👑 Quản Trị Viên</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Lưu Vào SQLite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="modal-overlay" onClick={() => setIsAddUserOpen(false)}>
          <div className="modal-content admin-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Thêm Thành Viên Mới (SQLite)</h3>
              <button className="modal-close-btn" onClick={() => setIsAddUserOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateNewUser} className="auth-form">
              <div className="form-group">
                <label>Họ và Tên</label>
                <input
                  type="text"
                  placeholder="Nhập họ tên"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Nhập email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Gói Khóa Học</label>
                  <select
                    value={newUserForm.planId}
                    onChange={(e) => setNewUserForm({ ...newUserForm, planId: e.target.value as any })}
                  >
                    <option value="pro">⭐ Pro Master</option>
                    <option value="free">Trải nghiệm Miễn Phí</option>
                    <option value="enterprise">🏢 Doanh Nghiệp</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Vai Trò</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                  >
                    <option value="student">🎓 Học Viên</option>
                    <option value="instructor">👨‍🏫 Giảng Viên</option>
                    <option value="admin">👑 Quản Trị Viên</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddUserOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Tạo Thành Viên</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
