import {
  DataOperationsPane,
  type StorageUsage
} from './DataOperationsPane.tsx';
import { AdminDialog } from './AdminDialog.tsx';
import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../services/apiClient.ts';
import { chatDbService } from '../../services/db/chatDbService.ts';
import type { ChatLog } from '../../types/chat.ts';
import './SqliteConsolePane.css';
import { SqliteConsolePane } from './SqliteConsolePane.tsx';

interface DatabaseSnapshot {
  usage?: StorageUsage;
  engine: string;
  temporary: boolean;
  tables: Array<{ name: string; count: number; bytes: number }>;
  rows: Array<Record<string, unknown>>;
  offset: number;
  filteredCount: number;
  health?: {
    persistentPathConfigured: boolean;
    sharedDatabase: boolean;
    duplicateEmails: number;
    updatedAt: string | null;
  };
}

export const ServerDatabasePane: React.FC<{ initialTab?: 'data' | 'logs' }> = ({
  initialTab = 'data'
}) => {
  const [table, setTable] = useState('users');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<DatabaseSnapshot | null>(null);
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [tab, setTab] = useState<'data' | 'logs' | 'legacy'>(initialTab);
  const [level, setLevel] = useState('ALL');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const requestSequence = useRef(0);

  const refresh = async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setData(null);
    setError('');
    try {
      const [snapshot, audit] = await Promise.all([
        apiFetch<DatabaseSnapshot>(
          `/admin/database?table=${encodeURIComponent(table)}&offset=${offset}&q=${encodeURIComponent(search)}`
        ),
        chatDbService.getLogs({
          limit: 500,
          level: level === 'ALL' ? undefined : level
        })
      ]);
      if (sequence !== requestSequence.current) return;
      setData(snapshot);
      setLogs(audit);
    } catch (err: unknown) {
      if (sequence !== requestSequence.current) return;
      setData(null);
      setLogs([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [table, offset, level, search]);
  const columns = Array.from(
    new Set(data?.rows.flatMap((row) => Object.keys(row)) || [])
  );
  const count = data?.filteredCount || 0;

  return (
    <div className="admin-sqlite-pane">
      {selectedRow && (
        <AdminDialog
          title={`Bản ghi ${table}`}
          onClose={() => setSelectedRow(null)}
        >
          <pre>{JSON.stringify(selectedRow, null, 2)}</pre>
        </AdminDialog>
      )}
      <div className="sqlite-pane-header">
        <div>
          <h3>Dữ liệu server & trace AI</h3>
          <p>
            Dữ liệu dùng chung trên server ·{' '}
            {data?.engine || 'Đang kiểm tra kết nối'}. Các gói học là cấu hình
            khởi tạo, chưa phải giao dịch thanh toán.
          </p>
          {data?.temporary && (
            <p role="alert">
              Server đang lưu tại /tmp: dữ liệu có thể mất khi instance khởi
              động lại và không chia sẻ giữa các instance. Cần DB bền vững cho
              production.
            </p>
          )}
        </div>
        <button onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>
      {data?.health && (
        <div className="admin-card">
          <h3>Sức khỏe kho dữ liệu</h3>
          <p>
            Lần ghi gần nhất:{' '}
            {data.health.updatedAt
              ? new Date(data.health.updatedAt).toLocaleString('vi-VN')
              : 'Chưa có'}
            .{' '}
            {data.health.persistentPathConfigured
              ? 'Đã cấu hình đường dẫn lưu trữ.'
              : 'Đang dùng file local mặc định.'}
          </p>
          <p>
            JSON chỉ phù hợp một tiến trình; chưa có DB dùng chung nhiều
            instance.
          </p>
          {data.health.duplicateEmails > 0 && (
            <p role="alert">
              Có {data.health.duplicateEmails} bản ghi trùng email cần quyết
              định migration. Dữ liệu được giữ nguyên.
            </p>
          )}
        </div>
      )}
      <DataOperationsPane
        usage={data?.usage}
        tables={data?.tables}
        onChanged={refresh}
      />
      <div className="sqlite-tabs" role="tablist" aria-label="Nguồn dữ liệu">
        <button
          role="tab"
          className="sqlite-tab-btn"
          aria-selected={tab === 'data'}
          onClick={() => setTab('data')}
        >
          Bảng dữ liệu
        </button>
        <button
          role="tab"
          className="sqlite-tab-btn"
          aria-selected={tab === 'logs'}
          onClick={() => setTab('logs')}
        >
          AI Chat Logs ({logs.length})
        </button>
        <button
          role="tab"
          className="sqlite-tab-btn"
          aria-selected={tab === 'legacy'}
          onClick={() => setTab('legacy')}
        >
          Dữ liệu trình duyệt cũ
        </button>
      </div>
      {error && (
        <div className="sqlite-error-box" role="alert">
          {error}
        </div>
      )}
      {tab === 'legacy' ? (
        <SqliteConsolePane />
      ) : tab === 'data' ? (
        <>
          <div className="sqlite-presets">
            {data?.tables.map((t) => (
              <button
                key={t.name}
                className="preset-btn"
                onClick={() => {
                  setTable(t.name);
                  setHiddenColumns([]);
                  setOffset(0);
                }}
                aria-pressed={table === t.name}
              >
                {t.name} ({t.count})
              </button>
            ))}
          </div>
          <input
            aria-label="Tìm bản ghi dữ liệu"
            placeholder="Tìm trong bảng hiện tại…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
          <p>
            {table}: {count} bản ghi · Trang {Math.floor(offset / 100) + 1}
          </p>
          <details>
            <summary>
              Cột hiển thị ({columns.length - hiddenColumns.length}/
              {columns.length})
            </summary>
            <div className="admin-toolbar">
              {columns.map((column) => (
                <label key={column}>
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.includes(column)}
                    onChange={(e) =>
                      setHiddenColumns((previous) =>
                        e.target.checked
                          ? previous.filter((c) => c !== column)
                          : [...previous, column]
                      )
                    }
                  />
                  {column}
                </label>
              ))}
            </div>
          </details>
          <div className="sqlite-table-scroll">
            <table className="sqlite-data-table">
              <thead>
                <tr>
                  <th>Chi tiết</th>
                  {columns
                    .filter((c) => !hiddenColumns.includes(c))
                    .map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <button
                        aria-label={`Xem bản ghi ${String(row.id || row.user_id || i + 1)}`}
                        onClick={() => setSelectedRow(row)}
                      >
                        Xem
                      </button>
                    </td>
                    {columns
                      .filter((c) => !hiddenColumns.includes(c))
                      .map((c) => (
                        <td key={c}>
                          {typeof row[c] === 'object' && row[c] !== null ? (
                            <details>
                              <summary>
                                {String(JSON.stringify(row[c])).slice(0, 60)}
                              </summary>
                              <pre>{JSON.stringify(row[c], null, 2)}</pre>
                            </details>
                          ) : (
                            <span>{String(row[c] ?? '—')}</span>
                          )}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && !data.rows.length && <p>Chưa có dữ liệu trong bảng này.</p>}
          <div className="admin-pagination">
            {' '}
            <button
              disabled={loading || !offset}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              Trang trước
            </button>
            <button
              disabled={loading || offset + 100 >= count}
              onClick={() => setOffset(offset + 100)}
            >
              Trang sau
            </button>
          </div>
        </>
      ) : (
        <>
          <select
            aria-label="Lọc cấp độ log"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <p>
            Hiển thị tối đa 500 log mới nhất. Nhật ký học tập nằm trong bảng
            learning_history.
          </p>
          {!loading && !error && !logs.length && (
            <p>
              Chưa có trace log trên server. Log mới được ghi khi sử dụng AI
              chat; dữ liệu cũ trong trình duyệt chưa đồng bộ.
            </p>
          )}
          {logs.map((log) => (
            <div
              className={`log-item log-level-${log.level.toLowerCase()}`}
              key={log.id}
            >
              <div className="log-item-header">
                <strong>
                  {log.level} · {log.event}
                </strong>
                <span>{new Date(log.timestamp).toLocaleString('vi-VN')}</span>
                <code>{log.sessionId}</code>
              </div>
              <p>{log.message}</p>
              {log.metadata && (
                <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};
