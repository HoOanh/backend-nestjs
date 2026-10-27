import { textSegments } from '../vendor/zerotts/chunking';
import { normalizeViText } from '../vendor/zerotts/textNorm';
import { TtsWorker } from '../vendor/zerotts/workerClient';

const MODEL_REPO = 'zeroweight-ai/ZeroTTS';
const VOICE = 'quangminh';
export interface ZeroTtsInstallState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  phase?: 'checking' | 'downloading' | 'preparing' | 'buffering';
  loadedBytes: number;
  totalBytes: number;
  errorMessage?: string;
}

export type SpeechController = { cancelled: boolean; signal?: AbortSignal };
type FrameHandler = (samples: Float32Array<ArrayBuffer>, sampleRate: number, sentenceIndex: number) => void;

let worker: TtsWorker | null = null;
let loadedSampleRate = 0;
let loadPromise: Promise<void> | null = null;
let generationTail: Promise<void> = Promise.resolve();
let activeCancellation: (() => void) | null = null;
let installState: ZeroTtsInstallState = {
  status: 'idle',
  loadedBytes: 0,
  totalBytes: 0,
};
const installStateListeners = new Set<(state: ZeroTtsInstallState) => void>();

function publishInstallState(nextState: ZeroTtsInstallState): void {
  installState = nextState;
  installStateListeners.forEach((listener) => listener(installState));
}

export function getZeroTtsInstallState(): ZeroTtsInstallState {
  return installState;
}

export function subscribeZeroTtsInstallState(
  listener: (state: ZeroTtsInstallState) => void,
): () => void {
  installStateListeners.add(listener);
  listener(installState);
  return () => installStateListeners.delete(listener);
}

function getWorker(): TtsWorker {
  if (worker?.isCrashed) {
    worker = null;
    loadPromise = null;
    loadedSampleRate = 0;
  }
  worker ??= new TtsWorker();
  return worker;
}

async function ensureModelLoaded(): Promise<void> {
  const modelWorker = getWorker();
  if (!loadPromise) {
    publishInstallState({
      status: 'loading',
      phase: 'checking',
      loadedBytes: 0,
      totalBytes: 0,
    });
    loadPromise = modelWorker
      .downloadInfo(MODEL_REPO, 'onnx')
      .then(async (downloadInfo) => {
        publishInstallState({
          status: 'loading',
          phase: downloadInfo.cached ? 'preparing' : 'downloading',
          loadedBytes: 0,
          totalBytes: downloadInfo.bytes,
        });
        return modelWorker.load(MODEL_REPO, (progress) => {
          publishInstallState({
            status: 'loading',
            phase: downloadInfo.cached || (progress.overallTotal > 0 && progress.overallLoaded >= progress.overallTotal) ? 'preparing' : 'downloading',
            loadedBytes: progress.overallLoaded,
            totalBytes: progress.overallTotal,
          });
        }, 'onnx');
      })
      .then((loaded) => {
        loadedSampleRate = loaded.sampleRate;
        publishInstallState({
          status: 'ready',
          phase: undefined,
          loadedBytes: installState.totalBytes,
          totalBytes: installState.totalBytes,
        });
      })
      .catch((error: unknown) => {
        loadPromise = null;
        publishInstallState({
          ...installState,
          status: 'error',
          phase: undefined,
          errorMessage: error instanceof Error ? error.message : 'Không tải được tài nguyên ZeroTTS.',
        });
        throw error;
      });
  }
  await loadPromise;
}

async function withGenerationLock(operation: () => Promise<void>): Promise<void> {
  const previous = generationTail;
  let release = () => {};
  generationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    await operation();
  } finally {
    release();
  }
}

export async function streamZeroTtsInBrowser(
  sentences: string[],
  controller: SpeechController,
  onFrame: FrameHandler,
  trackAsActive = true,
): Promise<void> {
  await ensureModelLoaded();
  if (controller.cancelled || controller.signal?.aborted) return;

  await withGenerationLock(async () => {
    const modelWorker = getWorker();
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
      if (controller.cancelled || controller.signal?.aborted) return;
      const segments = textSegments(normalizeViText(sentences[sentenceIndex]));
      if (!segments.length) continue;

      const run = modelWorker.generate({
        segments,
        voiceName: VOICE,
        options: {},
      });
      controller.signal?.addEventListener('abort', run.cancel, { once: true });
      if (trackAsActive) activeCancellation = run.cancel;
      try {
        for await (const chunk of run.chunks) {
          if (controller.cancelled) {
            run.cancel();
            break;
          }
          onFrame(new Float32Array(chunk), loadedSampleRate, sentenceIndex);
        }
      } finally {
        controller.signal?.removeEventListener('abort', run.cancel);
        if (activeCancellation === run.cancel) activeCancellation = null;
      }
    }
  });
}

export function stopBrowserZeroTts(): void {
  activeCancellation?.();
  activeCancellation = null;
}
