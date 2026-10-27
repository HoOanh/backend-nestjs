import type { ZeroTtsInstallState } from '../../services/zeroTtsBrowser';

/** A loaded model alone does not mean the first audible frame is playable. */
export function classroomPreparationState(
  install: ZeroTtsInstallState,
  firstAudioReady: boolean,
  playbackError: string | null,
  handState: 'loading' | 'ready' | 'error' = 'ready',
  voiceEnabled = true
): ZeroTtsInstallState | null {
  if (handState === 'error') return { ...install, status: 'error', errorMessage: 'Không tải được hình bàn tay.' };
  if (playbackError) return { ...install, status: 'error', errorMessage: playbackError };
  if (voiceEnabled && (install.status === 'error' || install.status === 'loading')) return install;
  if (handState === 'loading') return { ...install, status: 'loading', phase: 'visuals' };
  if (voiceEnabled && !firstAudioReady) return { ...install, status: 'loading', phase: 'buffering' };
  return null;
}
