import { toast } from 'sonner';
import { textSegments } from '../vendor/zerotts/chunking';
import { normalizeViText } from '../vendor/zerotts/textNorm';
import { TtsWorker } from '../vendor/zerotts/workerClient';

const MODEL_REPO = 'zeroweight-ai/ZeroTTS';
const VOICE = 'quangminh';
const LOAD_TOAST_ID = 'zerotts-browser-model';

type SpeechController = { cancelled: boolean };
type FrameHandler = (samples: Float32Array<ArrayBuffer>, sampleRate: number, sentenceIndex: number) => void;

let worker: TtsWorker | null = null;
let loadedSampleRate = 0;
let loadPromise: Promise<void> | null = null;
let generationTail: Promise<void> = Promise.resolve();
let activeCancellation: (() => void) | null = null;

function getWorker(): TtsWorker {
  worker ??= new TtsWorker();
  return worker;
}

async function ensureModelLoaded(): Promise<void> {
  if (!loadPromise) {
    const modelWorker = getWorker();
    toast.loading('Đang tải ZeroTTS lần đầu (~900 MB). Giữ trang mở đến khi xong.', {
      id: LOAD_TOAST_ID,
      duration: Infinity,
    });
    loadPromise = modelWorker
      .load(MODEL_REPO, (progress) => {
        const percent = progress.overallTotal > 0
          ? Math.floor((progress.overallLoaded / progress.overallTotal) * 100)
          : 0;
        toast.loading(`Đang tải ZeroTTS ${percent}% · ${(progress.overallLoaded / 1e6).toFixed(0)} / ${(progress.overallTotal / 1e6).toFixed(0)} MB`, {
          id: LOAD_TOAST_ID,
          duration: Infinity,
        });
      }, 'onnx')
      .then((loaded) => {
        loadedSampleRate = loaded.sampleRate;
        toast.success('ZeroTTS đã sẵn sàng trên thiết bị.', {
          id: LOAD_TOAST_ID,
          duration: 4000,
        });
      })
      .catch((error: unknown) => {
        loadPromise = null;
        toast.dismiss(LOAD_TOAST_ID);
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
  if (controller.cancelled) return;

  await withGenerationLock(async () => {
    const modelWorker = getWorker();
    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
      if (controller.cancelled) return;
      const segments = textSegments(normalizeViText(sentences[sentenceIndex]));
      if (!segments.length) continue;

      const run = modelWorker.generate({
        segments,
        voiceName: VOICE,
        options: {},
      });
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
        if (activeCancellation === run.cancel) activeCancellation = null;
      }
    }
  });
}

export function stopBrowserZeroTts(): void {
  activeCancellation?.();
  activeCancellation = null;
}
