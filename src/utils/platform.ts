interface NavigatorUAData {
  platform?: string;
}

/**
 * Kiểm tra xem người dùng có đang truy cập bằng macOS hoặc hệ sinh thái Apple (iOS, iPadOS) hay không
 */
export function isMacPlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: NavigatorUAData };
  const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /Mac|iPhone|iPod|iPad/i.test(platform);
}

/**
 * Ký hiệu phím bổ trợ theo nền tảng người dùng: '⌘' (Command) trên Mac, 'Ctrl' trên Windows/Linux
 */
export function getModKey(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

/**
 * Tên phím bổ trợ dạng chữ: 'Cmd' trên Mac, 'Ctrl' trên Windows/Linux
 */
export function getModKeyName(): string {
  return isMacPlatform() ? 'Cmd' : 'Ctrl';
}

/**
 * Định dạng phím tắt chuẩn hóa theo hệ điều hành (ví dụ: '⌘+Enter' hoặc 'Ctrl+Enter')
 */
export function formatShortcut(key: string, hasSpace = false): string {
  const mod = getModKey();
  return hasSpace ? `${mod} + ${key}` : `${mod}+${key}`;
}
