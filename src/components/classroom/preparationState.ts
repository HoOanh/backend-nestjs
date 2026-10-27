import type { ZeroTtsInstallState } from '../../services/zeroTtsBrowser';

/** A loaded model alone does not mean the first audible frame is playable. */
export function classroomPreparationState(
  install: ZeroTtsInstallState,
  firstAudioReady: boolean,
  playbackError: string | null
): ZeroTtsInstallState | null {
  if (playbackError) return { ...install, status: 'error', errorMessage: playbackError };
  if (install.status === 'error' || install.status === 'loading') return install;
  if (!firstAudioReady) return { ...install, status: 'loading', phase: 'buffering' };
  return null;
}
