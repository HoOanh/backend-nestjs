import { Download, LoaderCircle, RotateCcw } from 'lucide-react';
import type { ZeroTtsInstallState } from '../../services/zeroTtsBrowser';
import { Button } from '../ui/button';

interface ZeroTtsInstallPageProps {
  state: ZeroTtsInstallState;
  onRetry: () => void;
}

function toMegabytes(bytes: number): string {
  return (bytes / 1_000_000).toFixed(0);
}

export function ZeroTtsInstallPage({ state, onRetry }: Readonly<ZeroTtsInstallPageProps>) {
  const totalBytes = state.totalBytes || 903_000_000;
  const loadedBytes = Math.min(state.loadedBytes, totalBytes);
  const percent = Math.min(100, Math.floor((loadedBytes / totalBytes) * 100));
  const isLoading = state.status === 'loading';
  const isDownloading = state.phase === 'downloading';
  const isChecking = state.phase === 'checking';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#f5f0e6] px-4 py-8">
      <section
        className="w-full max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-xl sm:p-10"
        aria-labelledby="resource-install-title"
        aria-live="polite"
      >
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
          {isLoading ? <Download size={26} /> : <RotateCcw size={26} />}
        </div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-sky-700">
          Chuẩn bị giọng đọc
        </p>
        <h1 id="resource-install-title" className="mt-3 text-center text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
          {isLoading
            ? isDownloading
              ? 'Đang thực hiện tải tài nguyên lần đầu'
              : isChecking
                ? 'Đang kiểm tra tài nguyên trên thiết bị'
                : 'Đang chuẩn bị giọng đọc'
            : 'Chưa tải xong tài nguyên'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-stone-600">
          {isLoading
            ? isDownloading
              ? 'Đang tải tài nguyên cần thiết để chuẩn bị giọng đọc. Buổi học sẽ bắt đầu sau khi hoàn tất.'
              : isChecking
                ? 'Đang kiểm tra tài nguyên đã lưu để tiếp tục buổi học.'
                : 'Tài nguyên đã có trên thiết bị. Đang khởi tạo giọng đọc để tiếp tục buổi học.'
            : 'Không tải được tài nguyên. Kiểm tra kết nối mạng rồi thử lại.'}
        </p>

        {isLoading && isDownloading ? (
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-stone-700">
              <span>Tiến trình tải</span>
              <span>{percent}%</span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-stone-100"
              role="progressbar"
              aria-label="Tiến trình tải tài nguyên"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-medium text-stone-500">
              <span>{toMegabytes(loadedBytes)} / {toMegabytes(totalBytes)} MB</span>
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle size={14} className="animate-spin" />
                {percent >= 100 ? 'Đang hoàn tất' : 'Đang tải'}
              </span>
            </div>
            <p className="mt-6 text-center text-xs leading-5 text-stone-500">
              Đây là bước chuẩn bị một lần trên thiết bị. Sau khi tải xong, buổi học sẽ tự tiếp tục.
            </p>
          </div>
        ) : isLoading ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-sky-700">
            <LoaderCircle size={18} className="animate-spin" />
            {isChecking ? 'Đang kiểm tra trên thiết bị' : 'Đang khởi tạo trên thiết bị'}
          </div>
        ) : (
          <Button
            variant="ghost"
            size="auto"
            type="button"
            onClick={onRetry}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 py-3 font-bold text-white transition hover:bg-sky-800"
          >
            <RotateCcw size={17} />
            Thử tải lại
          </Button>
        )}
      </section>
    </div>
  );
}
