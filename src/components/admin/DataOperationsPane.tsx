import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiClient.ts';
import { AdminDialog } from './AdminDialog.tsx';

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
};
interface Policy {
  enabled: boolean;
  chatDays: number;
  auditDays: number;
  lastRunAt: string | null;
}
interface Archive {
  fingerprint: string;
  id: string;
  table: string;
  createdAt: string;
  count: number;
  bytes: number;
  reason: string;
}
interface Operations {
  policy: Policy;
  archives: Archive[];
  scheduler: string;
}
interface Preview {
  table: string;
  before: string;
  count: number;
  bytes: number;
  fingerprint: string;
}
export interface StorageUsage {
  fileBytes: number;
  logicalBytes: number;
  archiveBytes: number;
  totalRecords: number;
}

export const DataOperationsPane: React.FC<{
  usage?: StorageUsage;
  tables?: Array<{ name: string; count: number; bytes: number }>;
  onChanged: () => Promise<void>;
}> = ({ usage, tables, onChanged }) => {
  const [data, setData] = useState<Operations | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [table, setTable] = useState('chat_logs');
  const [before, setBefore] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [purge, setPurge] = useState<Archive | null>(null);
  const [confirmId, setConfirmId] = useState('');
  const [restore, setRestore] = useState<Archive | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = React.useRef(false);
  const load = async () => {
    const result = await apiFetch<Operations>('/admin/data-operations');
    setData(result);
    setPolicy(result.policy);
  };
  useEffect(() => {
    void load().catch((err) => setError(String(err)));
  }, []);
  const command = async (
    body: Record<string, unknown>,
    after?: (result: Record<string, unknown>) => void
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiFetch<Record<string, unknown>>(
        '/admin/data-operations',
        { method: 'POST', body: JSON.stringify(body) }
      );
      after?.(result);
      if (body.action !== 'preview') {
        await load();
        await onChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="admin-card" aria-label="Dung lượng và quản lý log">
      <h3>Dung lượng & vòng đời dữ liệu</h3>
      {usage && (
        <div className="admin-storage-metrics">
          <div>
            <strong>{formatBytes(usage.fileBytes)}</strong>
            <span>File DB đang sử dụng</span>
          </div>
          <div>
            <strong>{formatBytes(usage.archiveBytes)}</strong>
            <span>Bản lưu log có thể khôi phục</span>
          </div>
          <div>
            <strong>{formatBytes(usage.fileBytes + usage.archiveBytes)}</strong>
            <span>Tổng DB + bản lưu log</span>
          </div>
          <div>
            <strong>{usage.totalRecords.toLocaleString('vi-VN')}</strong>
            <span>Bản ghi trong kho đang dùng</span>
          </div>
        </div>
      )}
      <p>
        Dung lượng file thực tế; dung lượng từng bảng là JSON ước tính, không
        bao gồm định dạng file. Không bao gồm backup thủ công hoặc dung lượng
        còn trống của host.
      </p>
      <details>
        <summary>Dung lượng theo bảng</summary>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bảng</th>
                <th>Bản ghi</th>
                <th>JSON ước tính</th>
              </tr>
            </thead>
            <tbody>
              {tables?.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>{t.count}</td>
                  <td>{formatBytes(t.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {error && (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-alert" role="status">
          {message}
        </p>
      )}
      {policy && (
        <>
          <h3>Tự động dọn log</h3>
          <div className="admin-toolbar">
            <label>
              <input
                type="checkbox"
                checked={policy.enabled}
                disabled={busy}
                onChange={(e) =>
                  setPolicy({ ...policy, enabled: e.target.checked })
                }
              />{' '}
              Bật tự động lưu trữ log cũ
            </label>
            <label>
              Giữ trace AI (ngày)
              <input
                type="number"
                min="1"
                max="3650"
                value={policy.chatDays}
                disabled={busy}
                onChange={(e) =>
                  setPolicy({ ...policy, chatDays: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Giữ audit (ngày)
              <input
                type="number"
                min="365"
                max="3650"
                value={policy.auditDays}
                disabled={busy}
                onChange={(e) =>
                  setPolicy({ ...policy, auditDays: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <p>
            {data?.scheduler} Lần chạy gần nhất:{' '}
            {policy.lastRunAt
              ? new Date(policy.lastRunAt).toLocaleString('vi-VN')
              : 'Chưa chạy'}
            .
          </p>
          <p>
            Audit giữ tối thiểu 365 ngày. Nhật ký học, chat nội dung, tài khoản
            và chứng chỉ không nằm trong phạm vi dọn.
          </p>
          <label>
            Lý do thay đổi / dọn / khôi phục
            <input
              aria-label="Lý do quản lý dữ liệu"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              placeholder="Ít nhất 5 ký tự…"
            />
          </label>
          <div className="admin-row-actions">
            <button
              disabled={busy || reason.trim().length < 5}
              onClick={() =>
                void command({ action: 'policy', ...policy, reason }, () =>
                  setMessage('Đã lưu cấu hình giữ log.')
                )
              }
            >
              Lưu cấu hình giữ log
            </button>
          </div>
        </>
      )}
      <h3>Dọn log theo mốc thời gian</h3>
      <p>
        Chuyển log cũ sang bản lưu trên cùng ổ đĩa, giảm file DB đang dùng và có
        thể khôi phục. Tổng dung lượng ổ đĩa chưa được giải phóng; bản lưu không
        tự xóa.
      </p>
      <div className="admin-toolbar">
        <label>
          Loại log
          <select
            aria-label="Loại log cần dọn"
            value={table}
            disabled={busy}
            onChange={(e) => {
              setTable(e.target.value);
              setPreview(null);
            }}
          >
            <option value="chat_logs">Trace AI</option>
            <option value="audit_logs">Lịch sử thao tác / audit</option>
          </select>
        </label>
        <label>
          Cũ hơn
          <input
            aria-label="Mốc dọn log"
            type="datetime-local"
            value={before}
            disabled={busy}
            onChange={(e) => {
              setBefore(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <button
          disabled={busy || !before}
          onClick={() =>
            void command(
              {
                action: 'preview',
                table,
                before: new Date(before).toISOString()
              },
              (result) => setPreview(result as unknown as Preview)
            )
          }
        >
          Xem trước dọn log
        </button>
      </div>
      <h3>Bản lưu log ({data?.archives.length || 0})</h3>
      {!data?.archives.length ? (
        <p>Chưa có bản lưu. Tự động dọn mặc định tắt.</p>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Loại</th>
                <th>Bản ghi / dung lượng</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.archives.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString('vi-VN')}</td>
                  <td>{a.table}</td>
                  <td>
                    {a.count} / {formatBytes(a.bytes)}
                  </td>
                  <td>{a.reason}</td>
                  <td>
                    <button disabled={busy} onClick={() => setRestore(a)}>
                      Khôi phục
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setPurge(a);
                        setConfirmId('');
                      }}
                    >
                      Xóa bản lưu
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview && (
        <AdminDialog
          title="Xác nhận lưu trữ log cũ"
          busy={busy}
          onClose={() => setPreview(null)}
        >
          <p>
            {preview.count} bản ghi thuộc {preview.table}, cũ hơn{' '}
            {new Date(preview.before).toLocaleString('vi-VN')}. Dung lượng JSON
            ước tính: {formatBytes(preview.bytes)}.
          </p>
          <p>
            Server lưu bản khôi phục trước khi dọn khỏi DB. Dữ liệu nghiệp vụ
            được giữ; thao tác này được ghi audit.
          </p>
          <p>Lý do: {reason || 'Chưa nhập lý do'}</p>
          <button
            disabled={busy || !preview.count || reason.trim().length < 5}
            onClick={() =>
              void command(
                { action: 'cleanup', ...preview, reason },
                (result) => {
                  setPreview(null);
                  setMessage(`Đã lưu trữ ${result.count} log cũ.`);
                }
              )
            }
          >
            {busy ? 'Đang xử lý…' : 'Lưu trữ và dọn khỏi DB'}
          </button>
        </AdminDialog>
      )}
      {purge && (
        <AdminDialog
          title="Xóa vĩnh viễn bản lưu log"
          busy={busy}
          onClose={() => setPurge(null)}
        >
          <p>
            Xóa {purge.count} bản ghi đã lưu trữ, giải phóng{' '}
            {formatBytes(purge.bytes)}. Không khôi phục được qua ứng dụng sau
            khi xóa. Log đang dùng và dữ liệu nghiệp vụ không bị xóa.
          </p>
          <p>
            Nhập mã bản lưu để xác nhận: <code>{purge.id}</code>
          </p>
          <input
            aria-label="Mã bản lưu xác nhận xóa"
            value={confirmId}
            onChange={(e) => setConfirmId(e.target.value)}
            disabled={busy}
          />
          <p>Lý do: {reason || 'Chưa nhập lý do'}</p>
          <button
            disabled={
              busy || confirmId !== purge.id || reason.trim().length < 5
            }
            onClick={() =>
              void command(
                {
                  action: 'purge',
                  archiveId: purge.id,
                  fingerprint: purge.fingerprint,
                  confirmId,
                  reason
                },
                (result) => {
                  setPurge(null);
                  setMessage(
                    `Đã xóa bản lưu, giải phóng ${formatBytes(Number(result.freedBytes))}.`
                  );
                }
              )
            }
          >
            Xóa vĩnh viễn bản lưu
          </button>
        </AdminDialog>
      )}
      {restore && (
        <AdminDialog
          title="Khôi phục log từ bản lưu"
          busy={busy}
          onClose={() => setRestore(null)}
        >
          <p>
            Khôi phục {restore.count} bản ghi {restore.table}. Bản ghi trùng ID
            không được thêm lại. Tự động dọn sẽ tắt để giữ các log vừa khôi
            phục.
          </p>
          <p>Lý do: {reason || 'Chưa nhập lý do'}</p>
          <button
            disabled={busy || reason.trim().length < 5}
            onClick={() =>
              void command(
                { action: 'restore', archiveId: restore.id, reason },
                (result) => {
                  setRestore(null);
                  setMessage(
                    `Đã khôi phục ${result.count} bản ghi; tự động dọn đã tắt.`
                  );
                }
              )
            }
          >
            Khôi phục bản lưu
          </button>
        </AdminDialog>
      )}
    </section>
  );
};
