import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const logTables = ['chat_logs', 'audit_logs'] as const;
export type LogTable = (typeof logTables)[number];
export interface RetentionPolicy {
  enabled: boolean;
  chatDays: number;
  auditDays: number;
  lastRunAt: string | null;
}
export const defaultRetention: RetentionPolicy = {
  enabled: false,
  chatDays: 30,
  auditDays: 365,
  lastRunAt: null
};
export type LogRow = { id: string; timestamp: string };
export interface LogStore {
  chat_logs: LogRow[];
  audit_logs: LogRow[];
  retention?: RetentionPolicy;
}
export function validatePolicy(value: Record<string, unknown>): boolean {
  return (
    typeof value.enabled === 'boolean' &&
    Number.isInteger(value.chatDays) &&
    Number(value.chatDays) >= 1 &&
    Number(value.chatDays) <= 3650 &&
    Number.isInteger(value.auditDays) &&
    Number(value.auditDays) >= 365 &&
    Number(value.auditDays) <= 3650
  );
}
export function cleanupPreview(
  store: LogStore,
  table: LogTable,
  before: string
) {
  const rows = store[table].filter(
    (row) =>
      Number.isFinite(Date.parse(row.timestamp)) &&
      Date.parse(row.timestamp) < Date.parse(before)
  );
  return {
    table,
    before,
    count: rows.length,
    bytes: Buffer.byteLength(JSON.stringify(rows)),
    fingerprint: crypto
      .createHash('sha256')
      .update(JSON.stringify([table, before, rows]))
      .digest('hex')
  };
}
export function archiveDirectory(storePath: string) {
  return `${storePath}.archives`;
}
export function listArchives(storePath: string) {
  const dir = archiveDirectory(storePath);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^[0-9a-f-]{36}\.json$/.test(name))
    .map((name) => {
      const file = path.join(dir, name);
      const archive = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        table: LogTable;
        createdAt: string;
        rows: LogRow[];
        reason: string;
      };
      return {
        id: name.slice(0, -5),
        table: archive.table,
        createdAt: archive.createdAt,
        count: archive.rows.length,
        fingerprint: crypto
          .createHash('sha256')
          .update(fs.readFileSync(file))
          .digest('hex'),
        bytes: fs.statSync(file).size,
        reason: archive.reason
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function archiveLogs(
  store: LogStore,
  storePath: string,
  table: LogTable,
  before: string,
  reason: string
) {
  const preview = cleanupPreview(store, table, before);
  if (!preview.count) return { ...preview, archiveId: null };
  const rows = store[table].filter(
    (row) => Date.parse(row.timestamp) < Date.parse(before)
  );
  const archiveId = crypto.randomUUID();
  const dir = archiveDirectory(storePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Persist the recovery copy before removing anything from the active store.
  fs.writeFileSync(
    path.join(dir, `${archiveId}.json`),
    JSON.stringify({
      table,
      before,
      createdAt: new Date().toISOString(),
      reason,
      rows
    }),
    { mode: 0o600, flag: 'wx' }
  );
  const ids = new Set(rows.map((row) => row.id));
  store[table] = store[table].filter((row) => !ids.has(row.id));
  return { ...preview, archiveId };
}
export function readArchive(storePath: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Mã bản lưu không hợp lệ');
  const file = path.join(archiveDirectory(storePath), `${id}.json`);
  if (!fs.existsSync(file)) throw new Error('Không tìm thấy bản lưu');
  const archive = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    table: LogTable;
    rows: LogRow[];
  };
  if (!logTables.includes(archive.table) || !Array.isArray(archive.rows))
    throw new Error('Bản lưu không hợp lệ');
  return archive;
}

export function purgeArchive(
  storePath: string,
  id: string,
  fingerprint: string
) {
  const archive = listArchives(storePath).find((item) => item.id === id);
  if (!archive || archive.fingerprint !== fingerprint)
    throw new Error('Bản lưu đã thay đổi hoặc không còn tồn tại');
  fs.unlinkSync(path.join(archiveDirectory(storePath), `${id}.json`));
  return archive;
}
