import { apiFetch } from './apiClient.ts';

export interface AdminExportSnapshot {
  rows: unknown[];
  count: number;
  generatedAt: string;
  requestId: string;
  kind: string;
}
export function saveAdminExportFile(snapshot: AdminExportSnapshot): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `academy-${snapshot.kind}-${snapshot.generatedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadAdminExport(
  filters: Record<string, unknown>
): Promise<AdminExportSnapshot> {
  const data = await apiFetch<Omit<AdminExportSnapshot, 'kind'>>(
    '/admin/exports',
    { method: 'POST', body: JSON.stringify(filters) }
  );
  const snapshot = { ...data, kind: String(filters.kind) };
  saveAdminExportFile(snapshot);
  return snapshot;
}
