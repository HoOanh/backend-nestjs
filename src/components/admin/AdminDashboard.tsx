import { AdminExportPreview } from './AdminExportPreview.tsx';
import {
  downloadAdminExport,
  type AdminExportSnapshot
} from '../../services/adminExport.ts';
import React, { useEffect, useRef, useState } from 'react';
import './AdminDashboard.css';
import type {
  UserProfile,
  CoursePlan,
  LearningHistoryRecord,
  AdminStats,
  UserProgressState
} from '../../types/user.ts';
import { apiClient, apiFetch } from '../../services/apiClient.ts';
import { CURRICULUM } from '../../data/curriculum.ts';
import { AuditTrailPane } from './AuditTrailPane.tsx';
import { ServerDatabasePane } from './ServerDatabasePane.tsx';
import { AdminDialog } from './AdminDialog.tsx';

interface Props {
  currentUser: UserProfile;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onLogout: () => void;
  section?: string;
  onNavigateSection?: (section: string) => void;
}
interface Certificate {
  id: string;
  user_id: string;
  certificate_code: string;
  student_name: string;
  type?: string;
  status?: string;
  reason?: string;
  completed_at: string;
}
interface AiStatus {
  prompt?: string;
  promptVersion?: string;
  configured: boolean;
  defaultModel: string;
}
const menus = [
  ['overview', 'Tổng quan', '◫'],
  ['users', 'Tài khoản', '◎'],
  ['certificates', 'Chứng chỉ', '◇'],
  ['plans', 'Gói học & quyền', '▤'],
  ['curriculum', 'Xem giáo trình', '▥'],
  ['logs', 'Nhật ký học', '◷'],
  ['trace', 'Lịch sử thao tác', '⌕'],
  ['ai', 'Trạng thái AI', '✧'],
  ['database', 'Dữ liệu & vận hành', '▦']
];
const actions: Record<string, string> = {
  registered: 'Đăng ký tài khoản',
  theory_read: 'Đọc lý thuyết',
  quiz_passed: 'Đạt trắc nghiệm',
  code_passed: 'Hoàn thành thực hành',
  sprint_passed: 'Đạt kỳ thi Sprint',
  final_certified: 'Cấp bằng từ kỳ thi',
  certificate_issued: 'Cấp chứng chỉ thủ công',
  sprint_unverified: 'Thi Sprint · chờ xác minh',
  final_unverified: 'Thi tốt nghiệp · chờ xác minh',
  sprint_failed: 'Thi Sprint chưa đạt',
  final_failed: 'Thi tốt nghiệp chưa đạt'
};
const emptyForm = {
  name: '',
  email: '',
  password: '',
  dataOrigin: 'real' as 'real' | 'test',
  role: 'student' as UserProfile['role'],
  planId: 'free' as UserProfile['planId']
};
const date = (value: string) => new Date(value).toLocaleString('vi-VN');

export const AdminDashboard: React.FC<Props> = ({
  currentUser,
  theme,
  onToggleTheme,
  onLogout,
  section = 'overview',
  onNavigateSection
}) => {
  const menu = menus.find(([key]) => key === section);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<CoursePlan[]>([]);
  const [logs, setLogs] = useState<LearningHistoryRecord[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportPreview, setExportPreview] =
    useState<AdminExportSnapshot | null>(null);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null
  );
  const initialQuery = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(initialQuery.get('q') || '');
  const [origin, setOrigin] = useState(initialQuery.get('origin') || 'real');
  const [role, setRole] = useState(initialQuery.get('role') || '');
  const [page, setPage] = useState(
    Math.max(0, Number(initialQuery.get('page')) || 0)
  );
  const [pageSize, setPageSize] = useState(
    [25, 50, 100].includes(Number(initialQuery.get('size')))
      ? Number(initialQuery.get('size'))
      : 25
  );
  const [sort, setSort] = useState(initialQuery.get('sort') || 'active');
  const [userPage, setUserPage] = useState<{
    users: UserProfile[];
    total: number;
  }>({ users: [], total: 0 });
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState('');
  const [logAction, setLogAction] = useState(initialQuery.get('action') || '');
  const [from, setFrom] = useState(initialQuery.get('from') || '');
  const [to, setTo] = useState(initialQuery.get('to') || '');
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [command, setCommand] = useState<{
    kind: 'suspend' | 'restore' | 'entitlements' | 'certificate' | 'revoke';
    user?: UserProfile;
    certificate?: Certificate;
    key: string;
  } | null>(null);
  const [detail, setDetail] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgressState | null>(null);
  const [detailError, setDetailError] = useState('');
  const [editingPlan, setEditingPlan] = useState<CoursePlan | null>(null);
  const notice = (text: string, failure = false) => {
    setToast({ text, error: failure });
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [u, p, h, s, a, c] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getPlans(),
        apiClient.getHistory(),
        apiClient.getAdminStats(),
        apiFetch<AiStatus>('/admin/ai'),
        apiFetch<{ certificates: Certificate[] }>('/admin/certificates')
      ]);
      setUsers(u);
      setPlans(p);
      setLogs(h);
      setStats(s);
      setAi(a);
      setCertificates(c.certificates);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const previousSection = useRef(section);
  const hydrateFilters = () => {
    const query = new URLSearchParams(window.location.search);
    setSearch(query.get('q') || '');
    setOrigin(query.get('origin') || 'real');
    setRole(query.get('role') || '');
    setSort(query.get('sort') || 'active');
    setPage(Math.max(0, Number(query.get('page')) || 0));
    setLogAction(query.get('action') || '');
    setFrom(query.get('from') || '');
    setTo(query.get('to') || '');
    setPageSize(
      [25, 50, 100].includes(Number(query.get('size')))
        ? Number(query.get('size'))
        : 25
    );
  };
  useEffect(() => {
    const restore = () => hydrateFilters();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    if (previousSection.current !== section) {
      previousSection.current = section;
      hydrateFilters();
      return;
    }
    if (!['users', 'logs', 'certificates', 'curriculum'].includes(section))
      return;
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries({
      q: search,
      sort,
      origin,
      role,
      page: String(page),
      size: String(pageSize),
      action: logAction,
      from,
      to
    })) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params}`
    );
  }, [
    search,
    origin,
    role,
    sort,
    page,
    pageSize,
    logAction,
    from,
    to,
    section
  ]);
  useEffect(() => {
    if (!detail) return;
    const controller = new AbortController();
    setProgress(null);
    setDetailError('');
    void apiFetch<{ progress: UserProgressState }>(
      `/progress?userId=${encodeURIComponent(detail.id)}`,
      { signal: controller.signal }
    )
      .then((r) => setProgress(r.progress))
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setDetailError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, [detail]);
  const navigate = (next: string) => {
    setMobileOpen(false);
    setSearch('');
    setPage(0);
    onNavigateSection?.(next);
  };
  useEffect(() => {
    if (section !== 'users') return;
    const controller = new AbortController();
    setTableLoading(true);
    setTableError('');
    setUserPage({ users: [], total: 0 });
    const params = new URLSearchParams({
      origin,
      q: search,
      role,
      sort,
      offset: String(page * pageSize),
      limit: String(pageSize)
    });
    const timer = setTimeout(() => {
      void apiFetch<{ users: UserProfile[]; total: number }>(
        `/users?${params}`,
        { signal: controller.signal }
      )
        .then((result) => setUserPage(result))
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setTableError(
              error instanceof Error ? error.message : String(error)
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setTableLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [section, origin, search, role, sort, page, pageSize, users]);
  const visibleUsers = userPage.users;
  const userMap = new Map(users.map((u) => [u.id, u]));
  const inOrigin = (id: string) =>
    origin === 'all' ||
    (origin === 'test'
      ? userMap.get(id)?.isTestAccount
      : !userMap.get(id)?.isTestAccount);
  const filteredLogs = logs.filter(
    (l) =>
      inOrigin(l.userId) &&
      (!logAction || l.action === logAction) &&
      (!from || l.timestamp.slice(0, 10) >= from) &&
      (!to || l.timestamp.slice(0, 10) <= to) &&
      `${userMap.get(l.userId)?.name} ${userMap.get(l.userId)?.email} ${l.lessonTitle} ${l.details}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const filteredCerts = certificates.filter(
    (c) =>
      inOrigin(c.user_id) &&
      `${c.student_name} ${c.certificate_code}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const pagination = (count: number) => (
    <div className="admin-pagination">
      <span>
        {count} bản ghi · Trang {page + 1}/
        {Math.max(1, Math.ceil(count / pageSize))}
      </span>
      <label>
        Số dòng{' '}
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
        >
          {[25, 50, 100].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <button disabled={!page} onClick={() => setPage(page - 1)}>
        Trước
      </button>
      <button
        disabled={(page + 1) * pageSize >= count}
        onClick={() => setPage(page + 1)}
      >
        Sau
      </button>
    </div>
  );
  const exportRows = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const snapshot = await downloadAdminExport({
        kind: section,
        origin,
        role,
        q: search,
        action: logAction,
        from,
        to
      });
      setExportPreview(snapshot);
      notice(
        `Đã chuẩn bị ${snapshot.count} bản ghi. Thao tác xuất đã ghi audit.`
      );
    } catch (error: unknown) {
      notice(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(false);
    }
  };
  const toolbar = (
    <div className="admin-toolbar">
      {['users', 'logs'].includes(section) && (
        <button disabled={busy} onClick={() => void exportRows()}>
          {busy ? 'Đang xuất…' : 'Xuất JSON theo bộ lọc'}
        </button>
      )}
      <input
        aria-label="Tìm kiếm"
        placeholder="Tìm tên, email, nội dung…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      <select
        aria-label="Nguồn dữ liệu"
        value={origin}
        onChange={(e) => {
          setOrigin(e.target.value);
          setPage(0);
        }}
      >
        <option value="real">Dữ liệu thực</option>
        <option value="test">Dữ liệu test</option>
        <option value="all">Tất cả nguồn</option>
      </select>
      {section === 'users' && (
        <select
          aria-label="Sắp xếp"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          <option value="active">Hoạt động gần nhất</option>
          <option value="name">Tên A–Z</option>
        </select>
      )}
      {section === 'users' && (
        <select
          aria-label="Vai trò"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Mọi vai trò</option>
          <option value="student">Học viên</option>
          <option value="admin">Quản trị viên</option>
          <option value="instructor">Giảng viên</option>
        </select>
      )}
    </div>
  );
  const startCommand = (
    kind: NonNullable<typeof command>['kind'],
    user?: UserProfile,
    certificate?: Certificate
  ) => {
    setReason('');
    setFormError('');
    setCommand({ kind, user, certificate, key: crypto.randomUUID() });
  };
  const runMutation = async (
    work: () => Promise<unknown>,
    done: () => void
  ) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setFormError('');
    try {
      await work();
      done();
      notice('Đã lưu trên server. Lịch sử thao tác đã ghi nhận bằng chứng.');
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };
  const closeForm = () => {
    if (busy) return;
    const dirty =
      Boolean(reason.trim()) ||
      (editing
        ? form.name !== editing.name ||
          form.email !== editing.email ||
          form.role !== editing.role ||
          form.planId !== editing.planId ||
          form.dataOrigin !== (editing.isTestAccount ? 'test' : 'real')
        : createOpen
          ? JSON.stringify(form) !== JSON.stringify(emptyForm)
          : editingPlan
            ? JSON.stringify(editingPlan) !==
              JSON.stringify(plans.find((p) => p.id === editingPlan.id))
            : false);
    if (dirty && !window.confirm('Đóng và bỏ nội dung chưa lưu?')) return;
    setCreateOpen(false);
    setEditing(null);
    setCommand(null);
    setEditingPlan(null);
    setForm(emptyForm);
    setReason('');
    setFormError('');
  };
  const submitUser = (e: React.FormEvent) => {
    e.preventDefault();
    void runMutation(
      () =>
        editing
          ? apiFetch(`/users/${editing.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                name: form.name,
                email: form.email,
                role: form.role,
                planId: form.planId,
                dataOrigin: form.dataOrigin,
                expectedVersion: editing.version || 1,
                reason
              })
            })
          : apiFetch('/users', {
              method: 'POST',
              body: JSON.stringify({ ...form, reason })
            }),
      () => {
        setEditing(null);
        setCreateOpen(false);
        setForm(emptyForm);
      }
    );
  };
  const submitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command) return;
    const c = command;
    const path =
      c.kind === 'certificate'
        ? '/admin/certificates'
        : c.kind === 'revoke'
          ? `/admin/certificates/${c.certificate?.id}/revoke`
          : `/admin/users/${c.user?.id}/${c.kind}`;
    void runMutation(
      () =>
        apiFetch(path, {
          method: 'POST',
          body: JSON.stringify({
            reason,
            userId: c.user?.id,
            type: 'honorary',
            expectedVersion: c.user?.version || 1,
            idempotencyKey: c.key
          })
        }),
      () => {
        setCommand(null);
        setReason('');
      }
    );
  };
  const commandTitles = {
    suspend: 'Tạm khóa học viên',
    restore: 'Khôi phục học viên',
    entitlements: 'Cấp quyền học toàn khóa',
    certificate: 'Cấp chứng chỉ danh dự',
    revoke: 'Thu hồi chứng chỉ'
  };

  return (
    <div className="admin-cms-wrapper">
      {mobileOpen && (
        <button
          className="admin-nav-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}
        aria-label="Điều hướng quản trị"
      >
        <div className="admin-brand">
          <img src="/logo.png" alt="Arc Irobot" />
          <div>
            <strong>Arc Irobot</strong>
            <span>Academy / Quản trị</span>
          </div>
        </div>
        <nav>
          {menus.map(([key, title, icon]) => (
            <button
              key={key}
              className={`admin-nav-item ${section === key ? 'active' : ''}`}
              aria-current={section === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <span aria-hidden="true">{icon}</span>
              {title}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span>Kho dữ liệu server</span>
          <button onClick={onLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="admin-main-content">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-mobile-toggle"
              aria-label="Mở điều hướng"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              ☰
            </button>
            <div>
              <span className="admin-eyebrow">QUẢN TRỊ ACADEMY</span>
              <h1>{menu?.[1] || 'Không tìm thấy trang'}</h1>
            </div>
          </div>
          <div className="admin-topbar-right">
            <button aria-label="Đổi giao diện" onClick={onToggleTheme}>
              {theme === 'dark' ? '☀ Sáng' : '☾ Tối'}
            </button>
            <div className="admin-account">
              <strong>{currentUser.name}</strong>
              <span>Quản trị viên</span>
            </div>
          </div>
        </header>
        <div className="admin-scrollable-body">
          {toast && (
            <div
              className={`admin-alert ${toast.error ? 'error' : 'success'}`}
              role="status"
            >
              {toast.text}
              <button
                aria-label="Đóng thông báo"
                onClick={() => setToast(null)}
              >
                ✕
              </button>
            </div>
          )}
          {error && (
            <div className="admin-alert error" role="alert">
              {error}
              <button onClick={() => void load()}>Thử lại</button>
            </div>
          )}
          {loading && <p role="status">Đang tải dữ liệu server…</p>}
          {!menu && (
            <div className="admin-empty">
              <h2>Trang quản trị không tồn tại</h2>
              <button onClick={() => navigate('overview')}>Về tổng quan</button>
            </div>
          )}
          {section === 'overview' && (
            <>
              <div className="admin-page-heading">
                <div>
                  <h2>Tình hình đào tạo</h2>
                  <p>
                    Thống kê học viên thực; dữ liệu test được loại khỏi các chỉ
                    số.
                  </p>
                </div>
                <button disabled={loading} onClick={() => void load()}>
                  Làm mới
                </button>
              </div>
              <div className="admin-metrics-grid">
                {[
                  ['Học viên thực', stats?.totalUsers, 'Số tài khoản học viên'],
                  [
                    'Học viên có chứng chỉ',
                    stats?.certifiedStudents,
                    'Có chứng chỉ chưa thu hồi'
                  ],
                  [
                    'Hoạt động học',
                    stats?.totalActivityLogs,
                    'Nhật ký của học viên thực'
                  ],
                  ['Thanh toán', 'Chưa tích hợp', 'Chưa có nguồn giao dịch']
                ].map(([label, value, caption]) => (
                  <div className="admin-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value ?? '—'}</strong>
                    <small>{caption}</small>
                  </div>
                ))}
              </div>
              <div className="admin-grid-2col">
                <section className="admin-card">
                  <h2>Tài khoản mới</h2>
                  {users
                    .filter((u) => !u.isTestAccount && u.role === 'student')
                    .slice(0, 5)
                    .map((u) => (
                      <button
                        className="admin-person-row"
                        key={u.id}
                        onClick={() => setDetail(u)}
                      >
                        <span>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </span>
                        <span className="admin-badge">{u.planId}</span>
                      </button>
                    ))}
                  {!users.some(
                    (u) => !u.isTestAccount && u.role === 'student'
                  ) && <p>Chưa có học viên thực.</p>}
                </section>
                <section className="admin-card">
                  <h2>Việc cần chú ý</h2>
                  <p>
                    {users.filter((u) => u.isTestAccount).length} tài khoản test
                    đang được giữ nguyên để tra cứu.
                  </p>
                  <p>
                    {certificates.filter((c) => c.status === 'revoked').length}{' '}
                    chứng chỉ đã thu hồi.
                  </p>
                  <p>
                    {
                      logs.filter((l) =>
                        String(l.action).includes('unverified')
                      ).length
                    }{' '}
                    kết quả thi chờ xác minh.
                  </p>
                  <button onClick={() => navigate('trace')}>
                    Xem bằng chứng thao tác →
                  </button>
                </section>
              </div>
            </>
          )}
          {section === 'users' && (
            <>
              <div className="admin-page-heading">
                <div>
                  <h2>Tài khoản & quyền học</h2>
                  <p>
                    Chỉnh hồ sơ, cấp quyền và tạm khóa; không ghi nhận học hoàn
                    thành thay học viên.
                  </p>
                </div>
                <button
                  className="admin-primary"
                  onClick={() => {
                    setForm(emptyForm);
                    setReason('');
                    setFormError('');
                    setCreateOpen(true);
                  }}
                >
                  Thêm tài khoản
                </button>
              </div>
              {toolbar}
              <div className="admin-table-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Họ tên / email</th>
                      <th>Vai trò</th>
                      <th>Gói học</th>
                      <th>Trạng thái</th>
                      <th>Hoạt động gần nhất</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <button
                            className="admin-text-button"
                            onClick={() => setDetail(u)}
                          >
                            {u.name}
                          </button>
                          <small>{u.email}</small>
                          {u.isTestAccount && (
                            <span className="admin-badge warning">TEST</span>
                          )}
                        </td>
                        <td>
                          {u.role === 'admin'
                            ? 'Quản trị viên'
                            : u.role === 'student'
                              ? 'Học viên'
                              : 'Giảng viên'}
                        </td>
                        <td>
                          <span className="admin-badge">{u.planId}</span>
                        </td>
                        <td>
                          <span
                            className={`admin-badge ${u.status === 'suspended' ? 'warning' : 'success'}`}
                          >
                            {u.status === 'suspended'
                              ? 'Tạm khóa'
                              : 'Hoạt động'}
                          </span>
                        </td>
                        <td>{date(u.lastLoginAt)}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              onClick={() => {
                                setEditing(u);
                                setForm({
                                  ...emptyForm,
                                  name: u.name,
                                  email: u.email,
                                  role: u.role,
                                  planId: u.planId,
                                  dataOrigin: u.isTestAccount ? 'test' : 'real'
                                });
                                setReason('');
                                setFormError('');
                              }}
                            >
                              Sửa
                            </button>
                            {u.role === 'student' && (
                              <>
                                <button
                                  onClick={() =>
                                    startCommand('entitlements', u)
                                  }
                                >
                                  Quyền học
                                </button>
                                <button
                                  onClick={() => startCommand('certificate', u)}
                                >
                                  Cấp bằng
                                </button>
                                <button
                                  onClick={() =>
                                    startCommand(
                                      u.status === 'suspended'
                                        ? 'restore'
                                        : 'suspend',
                                      u
                                    )
                                  }
                                >
                                  {u.status === 'suspended'
                                    ? 'Khôi phục'
                                    : 'Tạm khóa'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visibleUsers.length &&
                !loading &&
                !tableLoading &&
                !tableError && (
                  <p className="admin-empty">Không có tài khoản khớp bộ lọc.</p>
                )}
              {tableLoading && <p role="status">Đang tải tài khoản…</p>}
              {tableError && (
                <p className="admin-alert error" role="alert">
                  {tableError}
                </p>
              )}
              {pagination(userPage.total)}
            </>
          )}
          {section === 'certificates' && (
            <>
              <div className="admin-page-heading">
                <div>
                  <h2>Chứng chỉ & hiệu lực</h2>
                  <p>
                    Chứng chỉ danh dự tách biệt kết quả thi. Thu hồi giữ nguyên
                    lịch sử cấp và bằng chứng.
                  </p>
                </div>
              </div>
              {toolbar}
              <div className="admin-table-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Học viên</th>
                      <th>Mã chứng chỉ</th>
                      <th>Loại</th>
                      <th>Hiệu lực</th>
                      <th>Ngày cấp</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCerts
                      .slice(page * pageSize, (page + 1) * pageSize)
                      .map((c) => (
                        <tr key={c.id}>
                          <td>
                            {c.student_name}
                            <small>{c.reason}</small>
                          </td>
                          <td>
                            <code>{c.certificate_code}</code>
                          </td>
                          <td>
                            {c.type === 'honorary'
                              ? 'Danh dự'
                              : c.type === 'manual'
                                ? 'Thủ công'
                                : 'Kỳ thi / dữ liệu cũ'}
                          </td>
                          <td>
                            {c.status === 'revoked'
                              ? 'Đã thu hồi'
                              : 'Còn hiệu lực'}
                          </td>
                          <td>{date(c.completed_at)}</td>
                          <td>
                            <a
                              href={`/api/certificates/verify/${c.certificate_code}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Xác minh
                            </a>
                            {c.status !== 'revoked' && (
                              <button
                                onClick={() =>
                                  startCommand('revoke', undefined, c)
                                }
                              >
                                Thu hồi
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!filteredCerts.length && (
                <p className="admin-empty">Chưa có chứng chỉ khớp bộ lọc.</p>
              )}
              {pagination(filteredCerts.length)}
            </>
          )}
          {section === 'plans' && (
            <>
              <div className="admin-page-heading">
                <div>
                  <h2>Gói học & quyền truy cập</h2>
                  <p>
                    Cấu hình quyền và học phí; chưa phải doanh thu thanh toán.
                    Ngừng cấp mới giữ quyền hiện có.
                  </p>
                </div>
              </div>
              <div className="admin-plans-grid">
                {plans.map((p) => (
                  <section className="admin-card" key={p.id}>
                    <span
                      className={`admin-badge ${p.isActive ? 'success' : 'warning'}`}
                    >
                      {p.isActive ? 'Đang cấp mới' : 'Ngừng cấp mới'}
                    </span>
                    <h2>{p.name}</h2>
                    <strong className="admin-plan-price">
                      {p.price.toLocaleString('vi-VN')} đ{' '}
                      <small>/ {p.billingPeriod}</small>
                    </strong>
                    <p>{p.description}</p>
                    <ul>
                      {p.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p>
                      {
                        users.filter(
                          (u) => u.planId === p.id && !u.isTestAccount
                        ).length
                      }{' '}
                      tài khoản thực đang sử dụng.
                    </p>
                    <button
                      onClick={() => {
                        setEditingPlan({ ...p });
                        setReason('');
                        setFormError('');
                      }}
                    >
                      Sửa cấu hình
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}
          {section === 'curriculum' && (
            <>
              <div className="admin-page-heading">
                <div>
                  <h2>Giáo trình hiện hành</h2>
                  <p>
                    {CURRICULUM.length} Sprint ·{' '}
                    {CURRICULUM.reduce((n, s) => n + s.lessons.length, 0)} bài.
                    Chế độ xem; nội dung hiện được quản lý trong mã nguồn.
                  </p>
                </div>
              </div>
              <div className="admin-toolbar">
                <input
                  aria-label="Tìm bài học"
                  placeholder="Tìm bài hoặc Sprint…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {CURRICULUM.filter((s) =>
                `${s.sprintTitle} ${s.lessons.map((l) => l.title).join(' ')}`
                  .toLowerCase()
                  .includes(search.toLowerCase())
              ).map((s) => (
                <section className="admin-card" key={s.sprintId}>
                  <span className="admin-eyebrow">
                    SPRINT {String(s.sprintId).padStart(2, '0')}
                  </span>
                  <h2>{s.sprintTitle}</h2>
                  {s.lessons.map((l) => (
                    <div className="admin-person-row" key={l.id}>
                      <span>
                        <strong>{l.title}</strong>
                        <small>
                          {l.id} · {l.quiz.length} câu hỏi ·{' '}
                          {l.codeChallenge.testCases.length} test
                        </small>
                      </span>
                      <a
                        href={`/lesson/${l.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem bài ↗
                      </a>
                    </div>
                  ))}
                </section>
              ))}
            </>
          )}
          {section === 'logs' && (
            <>
              <div className="admin-page-heading">
                <div>
                  <h2>Hoạt động & kết quả học tập</h2>
                  <p>
                    Tra theo học viên, sự kiện và thời gian; kết quả trình duyệt
                    chưa xác minh được đánh dấu riêng.
                  </p>
                </div>
              </div>
              {toolbar}
              <div className="admin-toolbar">
                <select
                  aria-label="Loại hoạt động"
                  value={logAction}
                  onChange={(e) => {
                    setLogAction(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Mọi hoạt động</option>
                  {Object.entries(actions).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <label>
                  Từ ngày
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <label>
                  Đến ngày
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
              </div>
              {from && to && from > to && (
                <p role="alert">Ngày kết thúc phải sau ngày bắt đầu.</p>
              )}
              <div className="admin-table-wrapper">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Học viên</th>
                      <th>Bài / mục</th>
                      <th>Hoạt động</th>
                      <th>Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs
                      .slice(page * pageSize, (page + 1) * pageSize)
                      .map((l) => (
                        <tr key={l.id}>
                          <td>{date(l.timestamp)}</td>
                          <td>
                            {userMap.get(l.userId)?.name ||
                              'Tài khoản không còn tồn tại'}
                            <small>
                              {userMap.get(l.userId)?.email || l.userId}
                            </small>
                          </td>
                          <td>{l.lessonTitle}</td>
                          <td>{actions[l.action] || l.action}</td>
                          <td>{l.details}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!filteredLogs.length && !loading && (
                <p className="admin-empty">Không có hoạt động khớp bộ lọc.</p>
              )}
              {pagination(filteredLogs.length)}
            </>
          )}
          {section === 'ai' && (
            <section className="admin-card">
              <h2>Trạng thái AI Tutor</h2>
              <p className="admin-badge">
                {ai?.configured
                  ? 'Đã cấu hình API key'
                  : 'Chưa cấu hình API key'}
              </p>
              <dl>
                <dt>Model mặc định</dt>
                <dd>
                  <code>{ai?.defaultModel || '—'}</code>
                </dd>
                <dt>Phiên bản prompt</dt>
                <dd>{ai?.promptVersion || '—'}</dd>
                <dt>Kết nối provider</dt>
                <dd>Chưa kiểm tra trực tiếp</dd>
              </dl>
              <p>
                Cấu hình được đọc từ backend. Chi tiết request, lỗi provider và
                thời gian xử lý có trong AI Chat Logs.
              </p>
              <details>
                <summary>Prompt hiện hành trên server</summary>
                <pre>{ai?.prompt || 'Chưa tải được prompt'}</pre>
              </details>
              <button onClick={() => navigate('database')}>
                Xem trace AI →
              </button>
            </section>
          )}
          {section === 'trace' && <AuditTrailPane />}
          {section === 'database' && <ServerDatabasePane />}
        </div>
      </main>
      {exportPreview && (
        <AdminExportPreview
          snapshot={exportPreview}
          onClose={() => setExportPreview(null)}
        />
      )}
      {(editing || createOpen) && (
        <AdminDialog
          title={
            editing ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản với mật khẩu riêng'
          }
          busy={busy}
          onClose={closeForm}
        >
          <form onSubmit={submitUser}>
            <label>
              Họ tên
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            {!editing && (
              <label>
                Mật khẩu khởi tạo riêng
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
                <small>
                  Ít nhất 8 ký tự. Luồng gửi lời mời chưa được tích hợp.
                </small>
              </label>
            )}
            <label>
              Nguồn dữ liệu
              <select
                value={form.dataOrigin}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dataOrigin: e.target.value as 'real' | 'test'
                  })
                }
              >
                <option value="real">Dữ liệu thực</option>
                <option value="test">Dữ liệu test</option>
              </select>
            </label>
            <label>
              Vai trò
              <select
                disabled={editing?.id === currentUser.id}
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as UserProfile['role']
                  })
                }
              >
                <option value="student">Học viên</option>
                <option value="instructor">Giảng viên</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </label>
            <label>
              Gói học
              <select
                value={form.planId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    planId: e.target.value as UserProfile['planId']
                  })
                }
              >
                {plans
                  .filter((p) => p.isActive || p.id === editing?.planId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {!p.isActive ? ' (ngừng cấp mới)' : ''}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Lý do thay đổi
              <textarea
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {formError && (
              <p className="admin-alert error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-dialog-footer">
              <button type="button" disabled={busy} onClick={closeForm}>
                Hủy
              </button>
              <button className="admin-primary" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu trên server'}
              </button>
            </div>
          </form>
        </AdminDialog>
      )}
      {command && (
        <AdminDialog
          title={commandTitles[command.kind]}
          busy={busy}
          onClose={closeForm}
        >
          <form onSubmit={submitCommand}>
            <p>
              <strong>
                {command.user?.name || command.certificate?.student_name}
              </strong>
              <br />
              {command.user?.email || command.certificate?.certificate_code}
            </p>
            <p>
              {command.kind === 'certificate'
                ? 'Cấp chứng chỉ danh dự; không thay điểm thi hoặc tiến độ học.'
                : command.kind === 'entitlements'
                  ? 'Ghi quyền học toàn khóa, giữ nguyên số bài đã hoàn thành. Giáo trình hiện đang mở cho mọi học viên.'
                  : command.kind === 'suspend'
                    ? 'Chặn đăng nhập và API của tài khoản; giữ lịch sử học và bằng chứng.'
                    : command.kind === 'revoke'
                      ? 'Mã xác minh chuyển thành đã thu hồi; giữ nguyên lịch sử cấp.'
                      : 'Cho phép học viên đăng nhập và sử dụng API trở lại.'}
            </p>
            <label>
              Lý do
              <textarea
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {formError && (
              <p className="admin-alert error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-dialog-footer">
              <button type="button" disabled={busy} onClick={closeForm}>
                Hủy
              </button>
              <button className="admin-primary" disabled={busy}>
                {busy ? 'Đang xử lý…' : 'Xác nhận & ghi bằng chứng'}
              </button>
            </div>
          </form>
        </AdminDialog>
      )}
      {editingPlan && (
        <AdminDialog
          title={`Cấu hình ${editingPlan.name}`}
          busy={busy}
          onClose={closeForm}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const p = editingPlan;
              void runMutation(
                () =>
                  apiFetch(`/plans/${p.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      name: p.name,
                      price: p.price,
                      description: p.description,
                      features: p.features,
                      isActive: p.isActive,
                      isPopular: p.isPopular,
                      reason
                    })
                  }),
                () => setEditingPlan(null)
              );
            }}
          >
            <label>
              Tên gói
              <input
                required
                value={editingPlan.name}
                onChange={(e) =>
                  setEditingPlan({ ...editingPlan, name: e.target.value })
                }
              />
            </label>
            <label>
              Giá (VND)
              <input
                type="number"
                min={0}
                required
                value={editingPlan.price}
                onChange={(e) =>
                  setEditingPlan({
                    ...editingPlan,
                    price: Number(e.target.value)
                  })
                }
              />
            </label>
            <label>
              Mô tả
              <textarea
                value={editingPlan.description}
                onChange={(e) =>
                  setEditingPlan({
                    ...editingPlan,
                    description: e.target.value
                  })
                }
              />
            </label>
            <label>
              Quyền học (mỗi dòng một mục)
              <textarea
                value={editingPlan.features.join('\n')}
                onChange={(e) =>
                  setEditingPlan({
                    ...editingPlan,
                    features: e.target.value.split('\n')
                  })
                }
              />
            </label>
            <label>
              Cấp mới
              <select
                value={String(editingPlan.isActive)}
                onChange={(e) =>
                  setEditingPlan({
                    ...editingPlan,
                    isActive: e.target.value === 'true'
                  })
                }
              >
                <option value="true">Cho phép</option>
                <option value="false">Tạm ngừng</option>
              </select>
            </label>
            <p>
              {users.filter((u) => u.planId === editingPlan.id).length} tài
              khoản hiện có giữ nguyên gói đã cấp.
            </p>
            <label>
              Lý do chỉnh cấu hình
              <textarea
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {formError && (
              <p className="admin-alert error" role="alert">
                {formError}
              </p>
            )}
            <button disabled={busy} className="admin-primary">
              {busy ? 'Đang lưu…' : 'Lưu cấu hình'}
            </button>
          </form>
        </AdminDialog>
      )}
      {detail && (
        <AdminDialog title={detail.name} onClose={() => setDetail(null)}>
          <p>
            {detail.email} · {detail.role} · {detail.planId}
          </p>
          <p>
            <code>{detail.id}</code>
          </p>
          {detailError && <p role="alert">{detailError}</p>}
          <h3>Tiến độ đã lưu</h3>
          {progress ? (
            <p>
              {Object.keys(progress.completedLessons).length} bài hoàn thành ·{' '}
              {Object.keys(progress.sprintExamScores).length} kỳ thi Sprint ·{' '}
              {progress.finalExam?.passed
                ? 'Thi cuối khóa đạt'
                : 'Chưa có kết quả thi đạt được xác minh'}
            </p>
          ) : (
            <p>Đang tải…</p>
          )}
          <h3>Chứng chỉ</h3>
          {certificates
            .filter((c) => c.user_id === detail.id)
            .map((c) => (
              <p key={c.id}>
                {c.certificate_code} · {c.type || 'exam'} ·{' '}
                {c.status || 'issued'}
              </p>
            ))}
          <h3>Hoạt động gần nhất</h3>
          {logs
            .filter((l) => l.userId === detail.id)
            .slice(0, 5)
            .map((l) => (
              <p key={l.id}>
                {date(l.timestamp)} · {actions[l.action] || l.action}
              </p>
            ))}
          <button
            onClick={() => {
              onNavigateSection?.(
                `trace?entityId=${encodeURIComponent(detail.id)}`
              );
              setDetail(null);
            }}
          >
            Tra bằng chứng của tài khoản →
          </button>
        </AdminDialog>
      )}
    </div>
  );
};
