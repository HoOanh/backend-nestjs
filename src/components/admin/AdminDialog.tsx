import React, { useEffect, useRef } from 'react';

export function AdminDialog({
  title,
  children,
  onClose,
  busy = false
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const pending = useRef(busy);
  pending.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = panel.current;
    element
      ?.querySelector<HTMLElement>('input, select, button, textarea')
      ?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending.current) {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab' || !element) return;
      const elements = Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'
        )
      );
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="admin-dialog-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={panel}
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-dialog-heading">
          <h2 id="admin-dialog-title">{title}</h2>
          <button aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
