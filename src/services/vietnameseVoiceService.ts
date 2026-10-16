// Pre-generated Vietnamese lecture audio with Web Audio amplitude tracking.

export interface SpeakVietnameseOptions {
  text: string;
  rate?: number;
  onStart?: () => void;
  onSentenceChange?: (sentence: string, index: number, total: number) => void;
  onAmplitude?: (amplitude: number) => void;
  onEnd?: () => void;
  onError?: (errMessage: string) => void;
}

let activeStopController: { cancelled: boolean } | null = null;
let currentAudioElement: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
const activeAudioObjectUrls = new Set<string>();
const activeStreamAudioSources = new Set<AudioBufferSourceNode>();
let activeTtsRequest: AbortController | null = null;
const INSTRUCTOR_AUDIO_MANIFEST_URL = '/assets/instructor-audio/c1-l1/manifest.json';
const INSTRUCTOR_AUDIO_ENGINE = 'zerotts-0.1.5-quangminh-v1';
let instructorAudioManifestPromise: Promise<Record<string, string>> | null = null;

/**
 * Remove visual-only markdown and ASCII diagrams while preserving technical names
 * for the AI voice to pronounce as English terms.
 */
export function normalizeTextForVietnameseSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' . Mở phần minh họa trên bảng. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬▲▼◀▶→←↑↓⚡🎯💡📌🔥✅❌✋🎙️]/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_~|]/g, ' ')
    .replace(/\bepoll_wait\b/g, 'epoll wait')
    .replace(/\bprocess\.memoryUsage\b/g, 'process memory usage')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split cleaned Vietnamese text into natural speaking clauses/sentences.
 */
export function splitIntoVietnameseSentences(text: string): string[] {
  const cleaned = normalizeTextForVietnameseSpeech(text);
  if (!cleaned) return [];
  const rawParts = cleaned.split(/(?<=[.!?;:\n])\s+/);
  const result: string[] = [];
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 165) {
      result.push(trimmed);
    } else {
      const clauses = trimmed.split(/(?<=,)\s+/);
      let acc = '';
      for (const clause of clauses) {
        if ((acc + ' ' + clause).trim().length <= 165) {
          acc = (acc + ' ' + clause).trim();
        } else {
          if (acc) result.push(acc);
          acc = clause.trim();
        }
      }
      if (acc) result.push(acc);
    }
  }
  return result.length > 0 ? result : [cleaned.slice(0, 165)];
}

/**
 * Stop any ongoing Vietnamese speech playback immediately.
 */
export function stopVietnameseSpeech(): void {
  if (activeStopController) {
    activeStopController.cancelled = true;
    activeStopController = null;
  }
  if (activeTtsRequest) {
    activeTtsRequest.abort();
    activeTtsRequest = null;
  }
  for (const source of activeStreamAudioSources) {
    try {
      source.stop();
    } catch {
      // The source may already have ended.
    }
  }
  activeStreamAudioSources.clear();
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.removeAttribute('src');
      currentAudioElement.load();
    } catch {
      // Ignore cleanup errors
    }
    currentAudioElement = null;
  }
  for (const audioUrl of activeAudioObjectUrls) {
    URL.revokeObjectURL(audioUrl);
  }
  activeAudioObjectUrls.clear();
}

/**
 * Play a lesson audio asset with Web Audio API amplitude analysis.
 */
async function playAudioSourceWithLipSync(
  audioSource: string,
  rate: number,
  controller: { cancelled: boolean },
  onAmplitude?: (amplitude: number) => void,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (controller.cancelled) {
      resolve();
      return;
    }

    const audio = new Audio(audioSource);
    audio.playbackRate = Math.min(1.5, Math.max(0.8, rate));
    currentAudioElement = audio;

    let animFrameId = 0;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array<ArrayBuffer> | null = null;
    let settled = false;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        if (!sharedAudioContext) {
          sharedAudioContext = new AudioCtx();
        }
        if (sharedAudioContext.state === 'suspended') {
          void sharedAudioContext.resume();
        }
        const source = sharedAudioContext.createMediaElementSource(audio);
        analyser = sharedAudioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        analyser.connect(sharedAudioContext.destination);
        dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }
    } catch {
      // If Web Audio attachment fails, fall back to time-based mouth movement
      analyser = null;
    }

    const pumpAmplitude = () => {
      if (controller.cancelled) {
        onAmplitude?.(0);
        return;
      }
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        // Focus on human speech fundamental & formant bins
        const bins = Math.min(28, dataArray.length);
        for (let i = 1; i < bins; i++) {
          sum += dataArray[i];
        }
        const avg = sum / (bins * 255);
        const normalized = Math.min(1, Math.max(0, avg * 2.4));
        onAmplitude?.(normalized);
      } else {
        // Simulated natural syllable rhythm
        const t = performance.now() * 0.014;
        const sim =
          Math.abs(Math.sin(t) * Math.cos(t * 0.65)) * 0.75 + 0.15;
        onAmplitude?.(sim);
      }
      animFrameId = requestAnimationFrame(pumpAmplitude);
    };

    const cleanup = () => {
      if (settled) return;
      settled = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      onAmplitude?.(0);
      if (currentAudioElement === audio) {
        currentAudioElement = null;
      }
      if (activeAudioObjectUrls.has(audioSource)) {
        URL.revokeObjectURL(audioSource);
        activeAudioObjectUrls.delete(audioSource);
      }
    };

    audio.onplay = () => {
      animFrameId = requestAnimationFrame(pumpAmplitude);
    };

    audio.onended = () => {
      onProgress?.(1);
      cleanup();
      resolve();
    };

    audio.onpause = () => {
      if (!controller.cancelled) return;
      cleanup();
      resolve();
    };

    audio.ontimeupdate = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        onProgress?.(Math.min(1, audio.currentTime / audio.duration));
      }
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error('Audio element playback failed'));
    };

    audio.play().catch((err) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

async function getPreGeneratedInstructorAudio(text: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;

  const keyMaterial = `${INSTRUCTOR_AUDIO_ENGINE}\0quangminh\0${text}`;
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(keyMaterial)
  );
  const key = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('');

  instructorAudioManifestPromise ??= fetch(INSTRUCTOR_AUDIO_MANIFEST_URL, {
    // Revalidate the small manifest so updated lesson audio is not hidden by
    // an old browser disk-cache entry.
    cache: 'no-cache'
  })
    .then(async (response) => {
      if (!response.ok) return {};
      return (await response.json()) as Record<string, string>;
    })
    .catch(() => ({}));

  const manifest = await instructorAudioManifestPromise;
  return manifest[key] || null;
}

interface StreamAudioSession {
  context: AudioContext;
  analyser: AnalyserNode;
  scheduleCursor: number;
}

async function requestZeroTtsAudio(
  text: string,
  controller: { cancelled: boolean }
): Promise<string> {
  const requestController = new AbortController();
  activeTtsRequest = requestController;
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
      signal: requestController.signal
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || `ZeroTTS request thất bại (HTTP ${response.status}).`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('audio/')) {
      throw new Error('Backend ZeroTTS không trả về dữ liệu âm thanh hợp lệ.');
    }
    const audioUrl = URL.createObjectURL(await response.blob());
    if (controller.cancelled) {
      URL.revokeObjectURL(audioUrl);
      throw new DOMException('Speech request was cancelled.', 'AbortError');
    }
    activeAudioObjectUrls.add(audioUrl);
    return audioUrl;
  } finally {
    if (activeTtsRequest === requestController) activeTtsRequest = null;
  }
}

function createStreamAudioSession(): StreamAudioSession | null {
  try {
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedAudioContext ??= new AudioCtx();
    const analyser = sharedAudioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.65;
    analyser.connect(sharedAudioContext.destination);
    return {
      context: sharedAudioContext,
      analyser,
      scheduleCursor: sharedAudioContext.currentTime + 0.04
    };
  } catch {
    return null;
  }
}

async function streamZeroTtsSentence(
  text: string,
  rate: number,
  controller: { cancelled: boolean },
  session: StreamAudioSession
): Promise<void> {
  const requestController = new AbortController();
  activeTtsRequest = requestController;
  try {
    const response = await fetch('/api/tts/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
      signal: requestController.signal
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || `ZeroTTS request thất bại (HTTP ${response.status}).`);
    }
    if (!response.body) throw new Error('ZeroTTS không trả luồng âm thanh.');
    const sampleRate = Number(response.headers.get('X-Audio-Sample-Rate'));
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new Error('ZeroTTS trả sample rate không hợp lệ.');
    }

    if (session.context.state === 'suspended') await session.context.resume();
    const reader = response.body.getReader();
    let pending = new Uint8Array(0);
    try {
      while (!controller.cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        const combined = new Uint8Array(pending.length + value.length);
        combined.set(pending);
        combined.set(value, pending.length);
        pending = combined;

        while (pending.length >= 4) {
          const frameSize = new DataView(
            pending.buffer,
            pending.byteOffset,
            pending.byteLength
          ).getUint32(0, false);
          if (frameSize <= 0 || frameSize > 4_000_000 || frameSize % 2 !== 0) {
            throw new Error('ZeroTTS trả khung âm thanh không hợp lệ.');
          }
          if (pending.length < frameSize + 4) break;

          const pcm = new DataView(
            pending.buffer,
            pending.byteOffset + 4,
            frameSize
          );
          const sampleCount = frameSize / 2;
          const audioBuffer = session.context.createBuffer(1, sampleCount, sampleRate);
          const samples = audioBuffer.getChannelData(0);
          for (let index = 0; index < sampleCount; index += 1) {
            samples[index] = pcm.getInt16(index * 2, true) / 32768;
          }
          const source = session.context.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = Math.min(1.5, Math.max(0.8, rate));
          source.connect(session.analyser);
          const startAt = Math.max(session.scheduleCursor, session.context.currentTime + 0.025);
          source.onended = () => activeStreamAudioSources.delete(source);
          activeStreamAudioSources.add(source);
          source.start(startAt);
          session.scheduleCursor = startAt + audioBuffer.duration / source.playbackRate.value;
          pending = pending.slice(frameSize + 4);
        }
      }
      if (!controller.cancelled && pending.length > 0) {
        throw new Error('ZeroTTS kết thúc giữa chừng một khung âm thanh.');
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    if (activeTtsRequest === requestController) activeTtsRequest = null;
  }
}

async function waitForStreamPlayback(
  session: StreamAudioSession,
  controller: { cancelled: boolean }
): Promise<void> {
  while (
    !controller.cancelled &&
    session.context.state === 'running' &&
    session.context.currentTime < session.scheduleCursor
  ) {
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

async function playStreamedSentences(
  sentenceStream: AsyncIterable<string>,
  options: Omit<SpeakVietnameseOptions, 'text'>,
  controller: { cancelled: boolean },
  rate: number
): Promise<void> {
  const session = createStreamAudioSession();
  let animationFrame = 0;
  let sentenceIndex = 0;
  let failed = false;
  let dataArray: Uint8Array<ArrayBuffer> | null = null;

  if (session) {
    dataArray = new Uint8Array(new ArrayBuffer(session.analyser.frequencyBinCount));
    const pumpAmplitude = () => {
      if (controller.cancelled) return;
      if (dataArray && session) {
        session.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let index = 1; index < Math.min(28, dataArray.length); index += 1) {
          sum += dataArray[index];
        }
        options.onAmplitude?.(Math.min(1, Math.max(0, (sum / (dataArray.length * 255)) * 2.4)));
      }
      animationFrame = requestAnimationFrame(pumpAmplitude);
    };
    animationFrame = requestAnimationFrame(pumpAmplitude);
  }

  try {
    for await (const rawSentence of sentenceStream) {
      for (const sentence of splitIntoVietnameseSentences(rawSentence)) {
        if (controller.cancelled) break;
        options.onSentenceChange?.(sentence, sentenceIndex, sentenceIndex + 1);
        sentenceIndex += 1;

        const cursorBeforeSentence = session?.scheduleCursor ?? 0;
        try {
          if (!session) throw new Error('Web Audio không được trình duyệt hỗ trợ.');
          await streamZeroTtsSentence(sentence, rate, controller, session);
        } catch (error) {
          if (controller.cancelled) break;
          const partialAudioWasScheduled =
            session !== null && session.scheduleCursor > cursorBeforeSentence;
          if (partialAudioWasScheduled) {
            failed = true;
            options.onError?.(
              error instanceof Error ? error.message : 'Luồng âm thanh bị ngắt giữa chừng.'
            );
            continue;
          }
          if (session) await waitForStreamPlayback(session, controller);
          if (controller.cancelled) break;
          try {
            const audioUrl = await requestZeroTtsAudio(sentence, controller);
            await playAudioSourceWithLipSync(audioUrl, rate, controller, options.onAmplitude);
          } catch (fallbackError) {
            failed = true;
            options.onError?.(
              fallbackError instanceof Error
                ? fallbackError.message
                : error instanceof Error
                  ? error.message
                  : 'Không thể phát giọng đọc tiếng Việt.'
            );
          }
        }
      }
      if (controller.cancelled) break;
    }
    if (session) await waitForStreamPlayback(session, controller);
    if (failed && !controller.cancelled) options.onAmplitude?.(0);
  } finally {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    options.onAmplitude?.(0);
  }
}

async function* iterateSentences(sentences: string[]): AsyncGenerator<string, void, undefined> {
  for (const sentence of sentences) yield sentence;
}

/**
 * Prefer pre-generated lesson audio. Uncached narration starts playback as
 * ZeroTTS emits PCM frames; resuming after a question uses this same path.
 */
export async function speakVietnamese(options: SpeakVietnameseOptions): Promise<void> {
  stopVietnameseSpeech();
  const controller = { cancelled: false };
  activeStopController = controller;
  const rate = options.rate ?? 1.05;
  const cleanedText = normalizeTextForVietnameseSpeech(options.text);
  if (!cleanedText) {
    options.onEnd?.();
    return;
  }

  options.onStart?.();
  try {
    const sentences = splitIntoVietnameseSentences(cleanedText);
    const audioSource = await getPreGeneratedInstructorAudio(cleanedText);
    if (audioSource && !controller.cancelled) {
      let currentSentenceIndex = -1;
      const characterCount = sentences.reduce((total, sentence) => total + sentence.length, 0);
      const publishProgress = (progress: number) => {
        const targetCharacter = progress * characterCount;
        let accumulated = 0;
        const sentenceIndex = sentences.findIndex((sentence, index) => {
          accumulated += sentence.length;
          return targetCharacter <= accumulated || index === sentences.length - 1;
        });
        const safeIndex = Math.max(0, sentenceIndex);
        if (safeIndex === currentSentenceIndex) return;
        currentSentenceIndex = safeIndex;
        options.onSentenceChange?.(sentences[safeIndex] || cleanedText, safeIndex, sentences.length);
      };
      try {
        options.onSentenceChange?.(sentences[0] || cleanedText, 0, sentences.length);
        await playAudioSourceWithLipSync(audioSource, rate, controller, options.onAmplitude, publishProgress);
      } catch (error) {
        if (controller.cancelled) return;
        await playStreamedSentences(iterateSentences(sentences), options, controller, rate);
      }
    } else if (!controller.cancelled) {
      await playStreamedSentences(iterateSentences(sentences), options, controller, rate);
    }

    if (!controller.cancelled) options.onEnd?.();
  } catch (error) {
    if (!controller.cancelled) {
      options.onError?.(
        error instanceof Error ? error.message : 'Không thể phát giọng đọc tiếng Việt.'
      );
      options.onAmplitude?.(0);
    }
  } finally {
    if (activeStopController === controller) activeStopController = null;
  }
}

/**
 * Stream completed tutor sentences into ZeroTTS while the model is still
 * generating the rest of its response.
 */
export async function speakVietnameseStream(
  sentenceStream: AsyncIterable<string>,
  options: Omit<SpeakVietnameseOptions, 'text'>
): Promise<void> {
  stopVietnameseSpeech();
  const controller = { cancelled: false };
  activeStopController = controller;
  options.onStart?.();
  try {
    await playStreamedSentences(sentenceStream, options, controller, options.rate ?? 1.05);
    if (!controller.cancelled) options.onEnd?.();
  } catch (error) {
    if (!controller.cancelled) {
      options.onError?.(
        error instanceof Error ? error.message : 'Không thể phát giọng đọc tiếng Việt.'
      );
      options.onAmplitude?.(0);
    }
  } finally {
    if (activeStopController === controller) activeStopController = null;
  }
}
