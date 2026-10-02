import { AdminExportPreview } from './AdminExportPreview.tsx';
import {
  downloadAdminExport,
  type AdminExportSnapshot
} from '../../services/adminExport.ts';
import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../services/apiClient.ts';
import type { AuditRecord } from '../../types/audit.ts';
import './SqliteConsolePane.css';
interface AuditPage {
  groups: AuditRecord[][];
  total: number;
  temporary: boolean;
}
const fieldValues = (value: unknown, fields: string[]) =>
  value && typeof value === 'object'
    ? Object.fromEntries(
        fields.map((key) => [
          key,
          (value as Record<string, unknown>)[key] ?? null
        ])
      )
    : value;
export const AuditTrailPane: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState({
    actorSearch: params.get('actorSearch') || '',
    requestId: params.get('requestId') || '',
    entity: params.get('entity') || '',
    entityId: params.get('entityId') || '',
    outcome: params.get('outcome') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    technical: params.get('technical') || 'false'
  });
  const [offset, setOffset] = useState(
    Math.max(0, Math.floor((Number(params.get('offset')) || 0) / 25) * 25)
  );
  const [page, setPage] = useState<AuditPage | null>(null);
  const [error, setError] = useState('');
  const [exportPreview, setExportPreview] =
    useState<AdminExportSnapshot | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const current = ++sequence.current;
    const controller = new AbortController();
    if (
      (filters.from && !Number.isFinite(Date.parse(filters.from))) ||
      (filters.to && !Number.isFinite(Date.parse(filters.to)))
    ) {
      setError('Thời gian không hợp lệ. Hãy xóa hoặc chỉnh lại bộ lọc.');
      setPage(null);
      setLoading(false);
      return;
    }
    const query = new URLSearchParams({
      offset: String(offset),
      group: 'true'
    });
    for (const [key, value] of Object.entries(filters))
      if (value)
        query.set(
          key,
          key === 'from' || key === 'to' ? new Date(value).toISOString() : value
        );
    const url = new URLSearchParams(filters);
    url.set('offset', String(offset));
    window.history.replaceState(null, '', `${window.location.pathname}?${url}`);
    if (filters.from && filters.to && filters.from > filters.to) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
      setPage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setPage(null);
    const timer = setTimeout(() => {
      void apiFetch<AuditPage>(`/admin/audit?${query}`, {
        signal: controller.signal
      })
        .then((result) => {
          if (current === sequence.current) setPage(result);
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted && current === sequence.current)
            setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (current === sequence.current) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, offset, revision]);
  const filter = (key: keyof typeof filters, value: string) => {
    setOffset(0);
    setFilters((previous) => ({ ...previous, [key]: value }));
  };
  const exportEvidence = async () => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const snapshot = await downloadAdminExport({
        ...filters,
        kind: 'audit',
        from: filters.from ? new Date(filters.from).toISOString() : '',
        to: filters.to ? new Date(filters.to).toISOString() : ''
      });
      setExportPreview(snapshot);
      setRevision((previous) => previous + 1);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="admin-sqlite-pane">
      {exportPreview && (
        <AdminExportPreview
          snapshot={exportPreview}
          onClose={() => setExportPreview(null)}
        />
      )}
      <div className="sqlite-pane-header">
        <div>
          <h2>Lịch sử thao tác & bằng chứng</h2>
          <p>
            Mỗi dòng là một request. Mở chi tiết để xem người thực hiện, thay
            đổi trước/sau và lỗi liên quan.
          </p>
        </div>
        <div className="admin-row-actions">
          <button disabled={loading} onClick={() => setRevision(revision + 1)}>
            Làm mới
          </button>
          <button
            disabled={loading || exporting}
            onClick={() => void exportEvidence()}
          >
            {exporting
              ? 'Đang xuất bằng chứng…'
              : 'Xuất bằng chứng theo bộ lọc'}
          </button>
        </div>
      </div>
      {page?.temporary && (
        <div className="admin-alert error" role="alert">
          Kho /tmp chưa bền vững. Cần chuyển DB production để giữ bằng chứng qua
          restart/đa instance.
        </div>
      )}
      <div className="sqlite-presets">
        <input
          aria-label="Người thao tác"
          placeholder="Tên / email người thao tác"
          value={filters.actorSearch}
          onChange={(e) => filter('actorSearch', e.target.value)}
        />
        <input
          aria-label="Mã request"
          placeholder="Mã request"
          value={filters.requestId}
          onChange={(e) => filter('requestId', e.target.value)}
        />
        <input
          aria-label="ID đối tượng"
          placeholder="ID đối tượng"
          value={filters.entityId}
          onChange={(e) => filter('entityId', e.target.value)}
        />
        <select
          aria-label="Đối tượng"
          value={filters.entity}
          onChange={(e) => filter('entity', e.target.value)}
        >
          <option value="">Mọi đối tượng</option>
          {[
            'users',
            'plans',
            'user_progress',
            'learning_history',
            'certificates',
            'entitlements',
            'chat_sessions',
            'chat_messages',
            'request'
          ].map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select
          aria-label="Kết quả"
          value={filters.outcome}
          onChange={(e) => filter('outcome', e.target.value)}
        >
          <option value="">Mọi kết quả</option>
          <option value="SUCCESS">Thành công</option>
          <option value="FAILURE">Lỗi / bị từ chối</option>
          <option value="PERSISTED">Có thay đổi dữ liệu</option>
        </select>
        <label>
          Từ
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(e) => filter('from', e.target.value)}
          />
        </label>
        <label>
          Đến
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(e) => filter('to', e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.technical === 'true'}
            onChange={(e) => filter('technical', String(e.target.checked))}
          />
          Hiện request kỹ thuật / autosave
        </label>
        <button
          onClick={() =>
            setFilters({
              actorSearch: '',
              requestId: '',
              entity: '',
              entityId: '',
              outcome: '',
              from: '',
              to: '',
              technical: 'false'
            })
          }
        >
          Xóa bộ lọc
        </button>
      </div>
      {error && (
        <div className="admin-alert error" role="alert">
          {error}
        </div>
      )}
      {loading && <p role="status">Đang tải bằng chứng…</p>}
      {!loading && page && !page.groups.length && (
        <div className="admin-empty">Chưa có thao tác khớp bộ lọc.</div>
      )}
      {page?.groups.map((events) => {
        const result =
          events.find((e) => e.action === 'REQUEST') ||
          events[events.length - 1];
        const changes = events.filter((e) => e.action !== 'REQUEST');
        return (
          <details
            key={result.requestId}
            className={`log-item audit-request ${result.outcome === 'FAILURE' ? 'log-level-error' : ''}`}
          >
            <summary>
              <div className="audit-summary">
                <strong>
                  {result.actor?.name ||
                    (result.source === 'system'
                      ? 'Hệ thống'
                      : 'Chưa xác thực')}{' '}
                  · {result.method} {result.path}
                </strong>
                <span
                  className={`admin-badge ${result.outcome === 'FAILURE' ? 'warning' : 'success'}`}
                >
                  {result.outcome === 'FAILURE'
                    ? 'Thất bại'
                    : result.status === null
                      ? 'Đã lưu · chưa có kết quả request'
                      : `HTTP ${result.status}`}
                </span>
              </div>
              <small>
                {new Date(result.timestamp).toLocaleString('vi-VN')} ·{' '}
                {result.actor?.email || 'Không có danh tính người dùng'} ·{' '}
                {changes.length} thay đổi · {result.durationMs} ms
              </small>
            </summary>
            <p>
              Request: <code>{result.requestId}</code>
            </p>
            {result.error && (
              <p className="admin-alert error">{result.error}</p>
            )}
            {changes.map((change) => (
              <div className="audit-change" key={change.id}>
                {result.path === '/api/auth/login' &&
                  result.actor &&
                  change.entity === 'users' &&
                  change.entityId !== result.actor.id && (
                    <p className="admin-alert warning">
                      Bằng chứng cũ có đối tượng thay đổi khác tài khoản đăng
                      nhập. Cần điều tra theo request này; dữ liệu lịch sử được
                      giữ nguyên.
                    </p>
                  )}
                <strong>
                  {change.action} · {change.entity}
                </strong>
                <small>
                  {change.entityId} · {change.changedFields.join(', ')}
                </small>
                <div className="audit-diff">
                  <div>
                    <h3>Trước</h3>
                    <pre>
                      {JSON.stringify(
                        fieldValues(change.before, change.changedFields),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                  <div>
                    <h3>Sau</h3>
                    <pre>
                      {JSON.stringify(
                        fieldValues(change.after, change.changedFields),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
                <details>
                  <summary>Snapshot đầy đủ</summary>
                  <pre>
                    {JSON.stringify(
                      { before: change.before, after: change.after },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </div>
            ))}
            <details>
              <summary>Thông tin kỹ thuật đã che bí mật</summary>
              <pre>
                {JSON.stringify(
                  {
                    body: result.requestBody,
                    errorStack: result.errorStack,
                    events: events.map((e) => ({
                      id: e.id,
                      time: e.timestamp,
                      outcome: e.outcome,
                      entity: e.entity
                    }))
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </details>
        );
      })}
      <div className="admin-pagination">
        <span>
          {page?.total || 0} thao tác · Trang {Math.floor(offset / 25) + 1}
        </span>
        <button
          disabled={loading || !offset}
          onClick={() => setOffset(Math.max(0, offset - 25))}
        >
          Trước
        </button>
        <button
          disabled={loading || offset + 25 >= (page?.total || 0)}
          onClick={() => setOffset(offset + 25)}
        >
          Sau
        </button>
      </div>
    </div>
  );
};
