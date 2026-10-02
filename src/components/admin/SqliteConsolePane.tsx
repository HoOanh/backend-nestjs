import React, { useState, useEffect } from 'react';
import './SqliteConsolePane.css';
import { chatDbService } from '../../services/db/chatDbService.ts';
import { sqliteEngine } from '../../services/db/sqliteEngine.ts';
import type { SqlQueryResult, ChatLog } from '../../types/chat.ts';

export const SqliteConsolePane: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'console' | 'logs' | 'schema'>('console');
  const [queryInput, setQueryInput] = useState<string>('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 15;');
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [tablesList, setTablesList] = useState<Array<{ name: string; count: number }>>([]);

  const [legacyExists, setLegacyExists] = useState<boolean | null>(null);
  useEffect(() => {
    void sqliteEngine.execute<{ name: string }>('SELECT name FROM sqlite_master').then((result) => {
      const found = result.rows.some((r) => r.name === 'chat_sessions');
      setLegacyExists(found);
      if (found) { void runQuery(queryInput); void refreshLogs(); void loadTablesSummary(); }
    });
  }, []);

  const loadTablesSummary = async () => {
    try {
      const sesCount = await chatDbService.executeRawSql('SELECT COUNT(*) as count FROM chat_sessions;');
      const msgCount = await chatDbService.executeRawSql('SELECT COUNT(*) as count FROM chat_messages;');
      const logCount = await chatDbService.executeRawSql('SELECT COUNT(*) as count FROM chat_logs;');

      setTablesList([
        { name: 'chat_sessions', count: Number(sesCount.rows[0]?.count ?? sesCount.rows.length) },
        { name: 'chat_messages', count: Number(msgCount.rows[0]?.count ?? msgCount.rows.length) },
        { name: 'chat_logs', count: Number(logCount.rows[0]?.count ?? logCount.rows.length) }
      ]);
    } catch {}
  };

  const runQuery = async (sqlToRun?: string) => {
    const sql = (sqlToRun ?? queryInput).trim();
    if (!sql) return;
    setIsExecuting(true);
    try {
      const res = await chatDbService.executeRawSql(sql);
      setQueryResult(res);
      await loadTablesSummary();
    } catch (err) {
      setQueryResult({
        rows: [],
        rowCount: 0,
        columns: [],
        executionTimeMs: 0,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const refreshLogs = async () => {
    const result = await sqliteEngine.execute<Record<string, unknown>>('SELECT * FROM chat_logs ORDER BY timestamp DESC LIMIT 150');
    setLogs(result.rows.map((row) => ({ id: String(row.id), level: row.level as ChatLog['level'], event: String(row.event), message: String(row.message), timestamp: String(row.timestamp), sessionId: row.session_id ? String(row.session_id) : undefined })));
  };

  const filteredLogs = logs.filter((l) => logFilter === 'ALL' || l.level === logFilter);

  if (legacyExists === null) return <p role="status">Đang kiểm tra dữ liệu cũ của trình duyệt…</p>;
  if (!legacyExists) return <div className="admin-empty"><h3>Không có dữ liệu chat cũ trong trình duyệt này</h3><p>Chat mới được lưu trên server. Không cần truy vấn hoặc nhập dữ liệu legacy.</p></div>;

  return (
    <div className="admin-sqlite-pane">
      <div className="sqlite-pane-header">
        <div>
          <h3 className="section-heading">🗄️ Dữ liệu trình duyệt cũ (IndexedDB)</h3>
          <p className="section-sub">
            Chỉ xem dữ liệu cũ của trình duyệt này bằng bộ mô phỏng SQL. Đây không phải DB server hay SQLite thực. Chat mới được lưu trên server.
          </p>
        </div>

        <div className="sqlite-quick-stats">
          {tablesList.map((t) => (
            <span key={t.name} className="stat-pill">
              <strong>{t.name}</strong>: {t.count} dòng
            </span>
          ))}
        </div>
      </div>

      <div className="sqlite-nav-bar">
        <div className="sqlite-tabs">
          <button
            className={`sqlite-tab-btn ${activeTab === 'console' ? 'active' : ''}`}
            onClick={() => setActiveTab('console')}
          >
            💻 SQL Console & Query
          </button>
          <button
            className={`sqlite-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('logs');
              void refreshLogs();
            }}
          >
            📋 Structured Audit Logs ({logs.length})
          </button>
          <button
            className={`sqlite-tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
            onClick={() => setActiveTab('schema')}
          >
            📊 Schema & Thông Tin Bảng
          </button>
        </div>
      </div>

      <div className="sqlite-pane-body">
        {activeTab === 'console' && (
          <div className="sqlite-console-pane">
            <div className="sqlite-presets">
              <span className="preset-label">Truy vấn nhanh:</span>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  const q = 'SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 15;';
                  setQueryInput(q);
                  void runQuery(q);
                }}
              >
                Tin nhắn mới nhất
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  const q = 'SELECT * FROM chat_sessions ORDER BY updated_at DESC;';
                  setQueryInput(q);
                  void runQuery(q);
                }}
              >
                Tất cả Sessions
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  const q = "SELECT * FROM chat_logs WHERE level = 'ERROR' ORDER BY timestamp DESC;";
                  setQueryInput(q);
                  void runQuery(q);
                }}
              >
                Logs lỗi (Errors)
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  const q = 'PRAGMA table_info(chat_messages);';
                  setQueryInput(q);
                  void runQuery(q);
                }}
              >
                Schema chat_messages
              </button>
            </div>

            <div className="sqlite-query-input-wrap">
              <textarea
                className="sqlite-query-textarea"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Nhập câu lệnh SQL (SELECT, INSERT, UPDATE, DELETE, PRAGMA)..."
                rows={3}
              />
              <button
                className="sqlite-exec-btn"
                onClick={() => void runQuery()}
                disabled={isExecuting}
              >
                {isExecuting ? 'Đang thực thi...' : '▶ Chạy Truy Vấn SQL'}
              </button>
            </div>

            <div className="sqlite-result-container">
              {queryResult?.error ? (
                <div className="sqlite-error-box">
                  <strong>⚠️ Lỗi SQL:</strong> {queryResult.error}
                </div>
              ) : queryResult ? (
                <>
                  <div className="sqlite-result-meta">
                    <span>Kết quả: <strong>{queryResult.rowCount}</strong> dòng</span>
                    <span>Thời gian thực thi: <strong>{queryResult.executionTimeMs.toFixed(2)}ms</strong></span>
                  </div>

                  {queryResult.rows.length === 0 ? (
                    <div className="sqlite-empty-state">Không có dòng dữ liệu nào khớp với truy vấn.</div>
                  ) : (
                    <div className="sqlite-table-scroll">
                      <table className="sqlite-data-table">
                        <thead>
                          <tr>
                            {queryResult.columns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.map((row, idx) => (
                            <tr key={idx}>
                              {queryResult.columns.map((col) => {
                                const cellVal = row[col];
                                const formatted =
                                  cellVal === null || cellVal === undefined
                                    ? '<NULL>'
                                    : typeof cellVal === 'object'
                                    ? JSON.stringify(cellVal)
                                    : String(cellVal);
                                return (
                                  <td key={col} title={formatted}>
                                    {formatted.length > 80 ? formatted.slice(0, 80) + '…' : formatted}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="sqlite-logs-pane">
            <div className="logs-toolbar">
              <div className="log-filter-group">
                <span className="filter-label">Bộ lọc cấp độ:</span>
                {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`log-filter-btn ${logFilter === lvl ? 'active' : ''} ${lvl.toLowerCase()}`}
                    onClick={() => setLogFilter(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <button className="sqlite-refresh-btn" onClick={() => void refreshLogs()}>
                🔄 Làm mới Logs
              </button>
            </div>

            <div className="logs-list-scroll">
              {filteredLogs.length === 0 ? (
                <div className="sqlite-empty-state">Chưa có logs nào được ghi nhận.</div>
              ) : (
                filteredLogs.map((item) => (
                  <div key={item.id} className={`log-item log-level-${item.level.toLowerCase()}`}>
                    <div className="log-item-header">
                      <span className={`log-badge log-badge-${item.level.toLowerCase()}`}>{item.level}</span>
                      <span className="log-event-tag">{item.event}</span>
                      <span className="log-time">{new Date(item.timestamp).toLocaleTimeString('vi-VN')}</span>
                      {item.sessionId && <span className="log-ses-id">[{item.sessionId.slice(-6)}]</span>}
                    </div>
                    <div className="log-item-message">{item.message}</div>
                    {item.metadata && (
                      <pre className="log-metadata-box">
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="sqlite-schema-pane">
            <h4>Kiến Trúc & Lược Đồ Cơ Sở Dữ Liệu SQLite Của Hệ Thống:</h4>
            <div className="schema-card">
              <h5>1. Bảng <code>chat_sessions</code></h5>
              <p>Lưu danh sách phiên hội thoại theo bài học (`lesson_id`) và học viên.</p>
              <ul>
                <li><code>id</code> (TEXT, PRIMARY KEY): Định danh session</li>
                <li><code>lesson_id</code> (TEXT, NOT NULL): ID bài học</li>
                <li><code>user_id</code> (TEXT): Khóa ngoại học viên</li>
                <li><code>title</code> (TEXT): Tiêu đề tự động hoặc người dùng đặt</li>
                <li><code>message_count</code> (INTEGER): Tổng số lượt chat trong phiên</li>
                <li><code>created_at</code> / <code>updated_at</code> (TEXT ISO8601): Mốc thời gian</li>
              </ul>
            </div>

            <div className="schema-card">
              <h5>2. Bảng <code>chat_messages</code></h5>
              <p>Lưu toàn bộ tin nhắn đa tầng (Multi-turn), dữ liệu ảnh upload và mô hình LLM tương ứng.</p>
              <ul>
                <li><code>id</code> (TEXT, PRIMARY KEY): ID tin nhắn</li>
                <li><code>session_id</code> (TEXT): Khóa ngoại tham chiếu session</li>
                <li><code>lesson_id</code> (TEXT): ID bài học tương ứng</li>
                <li><code>role</code> (TEXT): <code>user</code> | <code>assistant</code></li>
                <li><code>content</code> (TEXT): Nội dung markdown câu trả lời hoặc câu hỏi</li>
                <li><code>image_data</code> / <code>image_mime</code>: Dữ liệu ảnh đính kèm</li>
                <li><code>model</code> (TEXT): Mô hình Gemini/Gemma đã dùng để sinh câu trả lời</li>
                <li><code>created_at</code> (TEXT ISO8601): Thời điểm gửi</li>
              </ul>
            </div>

            <div className="schema-card">
              <h5>3. Bảng <code>chat_logs</code></h5>
              <p>Nhật ký kiểm toán (Audit Trail) chi tiết từng thao tác gửi, phản hồi stream, context window và độ trễ.</p>
              <ul>
                <li><code>id</code> (TEXT, PRIMARY KEY)</li>
                <li><code>level</code> (TEXT): <code>INFO</code> | <code>WARN</code> | <code>ERROR</code> | <code>DEBUG</code></li>
                <li><code>event</code> (TEXT): Mã sự kiện (<code>PROMPT_SENT</code>, <code>STREAM_COMPLETE</code>, <code>SQL_QUERY</code>)</li>
                <li><code>message</code> (TEXT): Nội dung diễn giải sự kiện</li>
                <li><code>metadata</code> (TEXT JSON): Dữ liệu chi tiết số token, kích thước context, thời gian phản hồi</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
