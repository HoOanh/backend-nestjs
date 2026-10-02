export interface AuditRecord {
  schemaVersion?: number;
  source?: 'user' | 'anonymous' | 'system';
  operation?: string;
  id: string;
  requestId: string;
  timestamp: string;
  actor: { id: string; name: string; email: string; role: string } | null;
  method: string;
  path: string;
  userAgent?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REQUEST';
  entity: string;
  entityId?: string;
  before: unknown;
  after: unknown;
  changedFields: string[];
  outcome: 'PERSISTED' | 'SUCCESS' | 'FAILURE';
  status: number | null;
  durationMs: number;
  error?: string;
  errorStack?: string;
  requestBody?: unknown;
}
