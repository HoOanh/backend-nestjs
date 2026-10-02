import React, { useMemo, useState } from 'react';
import { AdminDialog } from './AdminDialog.tsx';
import {
  saveAdminExportFile,
  type AdminExportSnapshot
} from '../../services/adminExport.ts';
export function AdminExportPreview({
  snapshot,
  onClose
}: {
  snapshot: AdminExportSnapshot;
  onClose: () => void;
}) {
  const json = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);
  const [message, setMessage] = useState('');
  return (
    <AdminDialog title="Snapshot dữ liệu xuất" onClose={onClose}>
      <p>
        {snapshot.count} bản ghi ·{' '}
        {new Date(snapshot.generatedAt).toLocaleString('vi-VN')}
      </p>
      <p>
        Request: <code>{snapshot.requestId}</code>
      </p>
      <div className="admin-row-actions">
        <button onClick={() => saveAdminExportFile(snapshot)}>
          Tải file JSON
        </button>
        <button
          onClick={() => {
            void navigator.clipboard
              .writeText(json)
              .then(() => setMessage('Đã sao chép đầy đủ JSON'))
              .catch(() =>
                setMessage(
                  'Trình duyệt không cho phép sao chép. Có thể chọn nội dung JSON bên dưới.'
                )
              );
          }}
        >
          Sao chép đầy đủ JSON
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <pre tabIndex={0} aria-label="JSON xuất theo bộ lọc">
        {json.slice(0, 100000)}
      </pre>
      {json.length > 100000 && (
        <p>
          Bản xem trước hiển thị 100 KB đầu. File và nội dung sao chép giữ đầy
          đủ dữ liệu.
        </p>
      )}
    </AdminDialog>
  );
}
