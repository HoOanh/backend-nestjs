import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const source = path.resolve(
  process.env.ARC_STORE_PATH || 'data/arc_irobot_store.json'
);
const raw = fs.readFileSync(source, 'utf8');
const store = JSON.parse(raw) as Record<string, Array<Record<string, unknown>>>;
const users = store.users || [];
const userIds = new Set(users.map((u) => u.id));
const emails = new Map<string, unknown[]>();
for (const user of users) {
  const email = String(user.email).trim().toLowerCase();
  emails.set(email, [...(emails.get(email) || []), user.id]);
}
const report = {
  counts: Object.fromEntries(
    Object.entries(store)
      .filter(([, rows]) => Array.isArray(rows))
      .map(([name, rows]) => [name, rows.length])
  ),
  duplicateEmails: Array.from(emails.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([email, ids]) => ({ email, ids })),
  orphaned: [
    'user_progress',
    'learning_history',
    'certificates',
    'entitlements'
  ].flatMap((table) =>
    (store[table] || [])
      .filter((row) => !userIds.has(row.user_id))
      .map((row) => ({ table, id: row.id || row.user_id }))
  ),
  sha256: crypto.createHash('sha256').update(raw).digest('hex'),
  migrationReady: false
};
if (process.argv.includes('--backup')) {
  const destination = path.join(
    path.dirname(source),
    'backups',
    `store-${Date.now()}.json`
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, raw, { mode: 0o600, flag: 'wx' });
  if (
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(destination))
      .digest('hex') !== report.sha256
  )
    throw new Error('Backup checksum mismatch');
  console.log(`Verified backup: ${destination}`);
}
console.log(JSON.stringify(report, null, 2));
// Dry-run by default: duplicate identities require a reviewed migration decision.
