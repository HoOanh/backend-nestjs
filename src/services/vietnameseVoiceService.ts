// ZeroTTS Vietnamese lecture audio with Web Audio amplitude tracking.

import { streamZeroTtsInBrowser, stopBrowserZeroTts } from './zeroTtsBrowser';

export interface SpeakVietnameseOptions {
  text: string;
  rate?: number;
  onStart?: () => void;
  onSentenceChange?: (sentence: string, index: number, total: number) => void;
  onSentenceEnd?: (sentence: string, index: number, total: number) => void;
  onAudioReady?: () => void;
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
const preloadedTtsAudio = new Map<string, PreparedSpeechTask>();

function usesBrowserZeroTts(): boolean {
  return import.meta.env.PROD && import.meta.env.VITE_ZEROTTS_ENABLED !== 'true';
}

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
  stopBrowserZeroTts();
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
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

interface StreamAudioSession {
  context: AudioContext;
  analyser: AnalyserNode;
  scheduleCursor: number;
}

type PreparedSpeechEvent =
  | { type: 'frame'; sentence: string; sentenceIndex: number; sampleRate: number; samples: Float32Array<ArrayBuffer> }
  | { type: 'sentence-end'; sentence: string; sentenceIndex: number };

class PreparedSpeechQueue {
  private readonly events: PreparedSpeechEvent[] = [];
  private readonly waiters: Array<() => void> = [];
  private closed = false;
  private discarded = false;
  private failure: Error | null = null;

  push(event: PreparedSpeechEvent): void {
    if (this.closed || this.discarded) return;
    this.events.push(event);
    this.wakeReaders();
  }

  close(error?: unknown): void {
    if (this.closed) return;
    this.closed = true;
    this.failure = error instanceof Error ? error : error ? new Error(String(error)) : null;
    this.wakeReaders();
  }

  discard(): void {
    this.discarded = true;
    this.events.length = 0;
    this.close();
  }

  private wakeReaders(): void {
    for (const wake of this.waiters.splice(0)) wake();
  }

  async *read(): AsyncGenerator<PreparedSpeechEvent, void, undefined> {
    while (true) {
      const event = this.events.shift();
      if (event) {
        yield event;
        continue;
      }
      if (this.closed) {
        if (this.failure) throw this.failure;
        return;
      }
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }
}

interface PreparedSpeechTask {
  sentences: string[];
  queue: PreparedSpeechQueue;
  producer: Promise<void>;
}

async function requestZeroTtsAudio(
  text: string,
  controller: { cancelled: boolean },
  trackAsActive = true
): Promise<string> {
  const requestController = new AbortController();
  if (trackAsActive) activeTtsRequest = requestController;
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
    if (trackAsActive) activeAudioObjectUrls.add(audioUrl);
    return audioUrl;
  } finally {
    if (trackAsActive && activeTtsRequest === requestController) activeTtsRequest = null;
  }
}

/** Start one lookahead request while the current beat's audio is playing. */
export function preloadVietnameseSpeech(rawText: string): void {
  const text = normalizeTextForVietnameseSpeech(rawText);
  if (!text || preloadedTtsAudio.has(text)) return;

  const task = createPreparedSpeechTask(text);
  preloadedTtsAudio.set(text, task);
  void task.producer.catch(() => {
    if (preloadedTtsAudio.get(text) === task) preloadedTtsAudio.delete(text);
  });

  while (preloadedTtsAudio.size > 3) {
    const [oldestText, oldestTask] = preloadedTtsAudio.entries().next().value ?? [];
    if (typeof oldestText !== 'string' || !oldestTask) break;
    preloadedTtsAudio.delete(oldestText);
    oldestTask.queue.discard();
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
  session: StreamAudioSession,
  onFirstFrame?: (startAt: number) => void
): Promise<void> {
  let sentenceStarted = false;
  await fetchZeroTtsPcmFrames([text], controller, (samples, sampleRate) => {
    if (session.context.state === 'suspended') void session.context.resume();
    const { startAt } = schedulePcmFrame(samples, sampleRate, rate, session, controller);
    if (!sentenceStarted) {
      sentenceStarted = true;
      onFirstFrame?.(startAt);
    }
  });
}

export async function fetchZeroTtsPcmFrames(
  sentences: string[],
  controller: { cancelled: boolean },
  onFrame: (samples: Float32Array<ArrayBuffer>, sampleRate: number, sentenceIndex: number) => void,
  trackAsActive = true
): Promise<void> {
  if (usesBrowserZeroTts()) {
    await streamZeroTtsInBrowser(sentences, controller, onFrame, trackAsActive);
    return;
  }

  const requestController = new AbortController();
  if (trackAsActive) activeTtsRequest = requestController;
  try {
    const response = await fetch('/api/tts/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sentences }),
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

    const reader = response.body.getReader();
    let pending = new Uint8Array(0);
    let lastSentenceIndex = 0;
    try {
      while (!controller.cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        const combined = new Uint8Array(pending.length + value.length);
        combined.set(pending);
        combined.set(value, pending.length);
        pending = combined;

        while (pending.length >= 8) {
          const frameHeader = new DataView(pending.buffer, pending.byteOffset, pending.byteLength);
          const sentenceIndex = frameHeader.getUint32(0, false);
          const frameSize = frameHeader.getUint32(4, false);
          if (frameSize <= 0 || frameSize > 4_000_000 || frameSize % 2 !== 0) {
            throw new Error('ZeroTTS trả khung âm thanh không hợp lệ.');
          }
          if (sentenceIndex >= sentences.length) throw new Error('ZeroTTS trả chỉ mục câu không hợp lệ.');
          if (sentenceIndex < lastSentenceIndex) throw new Error('ZeroTTS trả câu âm thanh sai thứ tự.');
          if (pending.length < frameSize + 8) break;

          const pcm = new DataView(pending.buffer, pending.byteOffset + 8, frameSize);
          const samples = new Float32Array(frameSize / 2);
          for (let index = 0; index < samples.length; index += 1) {
            samples[index] = pcm.getInt16(index * 2, true) / 32768;
          }
          onFrame(samples, sampleRate, sentenceIndex);
          lastSentenceIndex = sentenceIndex;
          pending = pending.slice(frameSize + 8);
        }
      }
      if (!controller.cancelled && pending.length > 0) {
        throw new Error('ZeroTTS kết thúc giữa chừng một khung âm thanh.');
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    if (trackAsActive && activeTtsRequest === requestController) activeTtsRequest = null;
  }
}

function scheduleFocusCallback(
  callback: () => void,
  context: AudioContext,
  targetTime: number,
  controller: { cancelled: boolean }
): void {
  const delay = Math.max(0, (targetTime - context.currentTime) * 1000);
  window.setTimeout(() => {
    if (!controller.cancelled) callback();
  }, delay);
}

function schedulePcmFrame(
  samples: Float32Array<ArrayBuffer>,
  sampleRate: number,
  rate: number,
  session: StreamAudioSession,
  controller: { cancelled: boolean }
): { startAt: number; endAt: number } {
  const audioBuffer = session.context.createBuffer(1, samples.length, sampleRate);
  audioBuffer.copyToChannel(samples, 0);
  const source = session.context.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = Math.min(1.5, Math.max(0.8, rate));
  source.connect(session.analyser);
  const startAt = Math.max(session.scheduleCursor, session.context.currentTime + 0.025);
  source.onended = () => activeStreamAudioSources.delete(source);
  activeStreamAudioSources.add(source);
  source.start(startAt);
  const endAt = startAt + audioBuffer.duration / source.playbackRate.value;
  session.scheduleCursor = endAt;
  return { startAt, endAt };
}

function createPreparedSpeechTask(text: string): PreparedSpeechTask {
  const sentences = splitIntoVietnameseSentences(text);
  const queue = new PreparedSpeechQueue();
  const task: PreparedSpeechTask = {
    sentences,
    queue,
    producer: Promise.resolve()
  };
  task.producer = (async () => {
    try {
      const controller = { cancelled: false };
      let activeSentenceIndex = -1;
      await fetchZeroTtsPcmFrames(sentences, controller, (samples, sampleRate, sentenceIndex) => {
        if (activeSentenceIndex >= 0 && sentenceIndex !== activeSentenceIndex) {
          queue.push({
            type: 'sentence-end',
            sentence: sentences[activeSentenceIndex],
            sentenceIndex: activeSentenceIndex
          });
        }
        activeSentenceIndex = sentenceIndex;
        queue.push({
          type: 'frame',
          sentence: sentences[sentenceIndex],
          sentenceIndex,
          sampleRate,
          samples
        });
      }, false);
      if (activeSentenceIndex >= 0) {
        queue.push({
          type: 'sentence-end',
          sentence: sentences[activeSentenceIndex],
          sentenceIndex: activeSentenceIndex
        });
      }
      queue.close();
    } catch (error) {
      queue.close(error);
    }
  })();
  return task;
}

async function playPreparedTtsTask(
  task: PreparedSpeechTask,
  options: Omit<SpeakVietnameseOptions, 'text'>,
  controller: { cancelled: boolean },
  rate: number
): Promise<void> {
  if (usesBrowserZeroTts()) {
    const browserSession = createStreamAudioSession();
    if (!browserSession) {
      await task.producer;
      await playPreparedPcmWithoutWebAudio(task, options, controller, rate);
      return;
    }
    await playPreparedBrowserTtsTask(task, options, controller, rate, browserSession);
    return;
  }

  const session = createStreamAudioSession();
  if (!session) {
    await task.producer;
    await playPreparedPcmWithoutWebAudio(task, options, controller, rate);
    return;
  }
  if (session.context.state === 'suspended') await session.context.resume();

  const dataArray = new Uint8Array(new ArrayBuffer(session.analyser.frequencyBinCount));
  let animationFrame = 0;
  const pumpAmplitude = () => {
    if (controller.cancelled) return;
    session.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let index = 1; index < Math.min(28, dataArray.length); index += 1) sum += dataArray[index];
    options.onAmplitude?.(Math.min(1, Math.max(0, (sum / (dataArray.length * 255)) * 2.4)));
    animationFrame = requestAnimationFrame(pumpAmplitude);
  };
  animationFrame = requestAnimationFrame(pumpAmplitude);

  let activeSentenceIndex = -1;
  let scheduledFrames = 0;
  let streamFailure: Error | null = null;
  try {
    try {
      for await (const event of task.queue.read()) {
        if (controller.cancelled) break;
        if (event.type === 'frame') {
          const { startAt } = schedulePcmFrame(
            event.samples,
            event.sampleRate,
            rate,
            session,
            controller
          );
          scheduledFrames += 1;
          if (event.sentenceIndex !== activeSentenceIndex) {
            activeSentenceIndex = event.sentenceIndex;
            scheduleFocusCallback(
              () => options.onSentenceChange?.(event.sentence, event.sentenceIndex, task.sentences.length),
              session.context,
              startAt,
              controller
            );
          }
        } else {
          const endAt = session.scheduleCursor;
          scheduleFocusCallback(
            () => options.onSentenceEnd?.(event.sentence, event.sentenceIndex, task.sentences.length),
            session.context,
            endAt,
            controller
          );
        }
      }
    } catch (error) {
      streamFailure = error instanceof Error ? error : new Error(String(error));
    }

    if (streamFailure && scheduledFrames === 0 && !controller.cancelled) {
      if (usesBrowserZeroTts()) throw streamFailure;
      await playStreamedSentences(iterateSentences(task.sentences), options, controller, rate);
      return;
    }
    options.onAudioReady?.();
    await waitForStreamPlayback(session, controller);
    if (streamFailure && !controller.cancelled) options.onError?.(streamFailure.message);
  } finally {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    options.onAmplitude?.(0);
  }
}

async function playPreparedBrowserTtsTask(
  task: PreparedSpeechTask,
  options: Omit<SpeakVietnameseOptions, 'text'>,
  controller: { cancelled: boolean },
  rate: number,
  session: StreamAudioSession
): Promise<void> {
  if (session.context.state === 'suspended') await session.context.resume();

  const dataArray = new Uint8Array(new ArrayBuffer(session.analyser.frequencyBinCount));
  let animationFrame = 0;
  const pumpAmplitude = () => {
    if (controller.cancelled) return;
    session.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let index = 1; index < Math.min(28, dataArray.length); index += 1) sum += dataArray[index];
    options.onAmplitude?.(Math.min(1, Math.max(0, (sum / (dataArray.length * 255)) * 2.4)));
    animationFrame = requestAnimationFrame(pumpAmplitude);
  };
  animationFrame = requestAnimationFrame(pumpAmplitude);

  let streamFailure: Error | null = null;
  let activeSentenceIndex = -1;
  let activeSentence = '';
  let activeSampleRate = 0;
  let activeFrames: Float32Array<ArrayBuffer>[] = [];
  let activeSampleCount = 0;
  let pendingSeconds = 0;
  let audioReadySent = false;
  let sentenceStartScheduled = false;
  let hasScheduledAudio = false;
  const initialBufferSeconds = 1.2;
  const playbackChunkSeconds = 0.8;

  const flushActiveFrames = () => {
    if (activeSampleCount === 0 || activeSampleRate === 0 || controller.cancelled) return;
    const sentenceText = activeSentence;
    const sentenceIndex = activeSentenceIndex;
    const samples = new Float32Array(activeSampleCount);
    let offset = 0;
    for (const frame of activeFrames) {
      samples.set(frame, offset);
      offset += frame.length;
    }
    const { startAt, endAt } = schedulePcmFrame(
      samples,
      activeSampleRate,
      rate,
      session,
      controller
    );
    if (!sentenceStartScheduled) {
      sentenceStartScheduled = true;
      scheduleFocusCallback(
        () => options.onSentenceChange?.(sentenceText, sentenceIndex, task.sentences.length),
        session.context,
        startAt,
        controller
      );
    }
    hasScheduledAudio = true;
    if (!audioReadySent) {
      audioReadySent = true;
      options.onAudioReady?.();
    }
    pendingSeconds = Math.max(0, pendingSeconds - activeSampleCount / activeSampleRate);
    activeFrames = [];
    activeSampleCount = 0;
    return endAt;
  };

  const finishActiveSentence = () => {
    if (activeSentenceIndex < 0) return;
    const sentenceText = activeSentence;
    const sentenceIndex = activeSentenceIndex;
    const endAt = flushActiveFrames() ?? session.scheduleCursor;
    if (sentenceStartScheduled) {
      scheduleFocusCallback(
        () => options.onSentenceEnd?.(sentenceText, sentenceIndex, task.sentences.length),
        session.context,
        endAt,
        controller
      );
    }
    activeSentenceIndex = -1;
    activeSentence = '';
    activeSampleRate = 0;
    activeFrames = [];
    activeSampleCount = 0;
    sentenceStartScheduled = false;
  };

  try {
    try {
      for await (const event of task.queue.read()) {
        if (controller.cancelled) break;
        if (event.type === 'frame') {
          if (activeSentenceIndex >= 0 && activeSentenceIndex !== event.sentenceIndex) {
            finishActiveSentence();
          }
          if (activeSentenceIndex < 0) {
            activeSentenceIndex = event.sentenceIndex;
            activeSentence = event.sentence;
            activeSampleRate = event.sampleRate;
          }
          activeFrames.push(event.samples);
          activeSampleCount += event.samples.length;
          pendingSeconds += event.samples.length / event.sampleRate;
          if (
            (audioReadySent && activeSampleCount / activeSampleRate >= playbackChunkSeconds) ||
            (!audioReadySent && pendingSeconds >= initialBufferSeconds)
          ) {
            flushActiveFrames();
          }
        } else {
          finishActiveSentence();
        }
      }
    } catch (error) {
      streamFailure = error instanceof Error ? error : new Error(String(error));
    }

    finishActiveSentence();
    if (controller.cancelled || !hasScheduledAudio) {
      if (streamFailure && !controller.cancelled) throw streamFailure;
      return;
    }

    await waitForStreamPlayback(session, controller);
    if (streamFailure && !controller.cancelled) options.onError?.(streamFailure.message);
  } finally {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    options.onAmplitude?.(0);
  }
}

async function playPreparedPcmWithoutWebAudio(
  task: PreparedSpeechTask,
  options: Omit<SpeakVietnameseOptions, 'text'>,
  controller: { cancelled: boolean },
  rate: number
): Promise<void> {
  const sentenceFrames = task.sentences.map(() => [] as Float32Array<ArrayBuffer>[]);
  const sentenceSamples = task.sentences.map(() => 0);
  let sampleRate = 0;
  for await (const event of task.queue.read()) {
    if (event.type !== 'frame') continue;
    sampleRate = event.sampleRate;
    sentenceFrames[event.sentenceIndex].push(event.samples);
    sentenceSamples[event.sentenceIndex] += event.samples.length;
  }
  if (controller.cancelled || sampleRate === 0) return;

  const sampleCount = sentenceSamples.reduce((total, count) => total + count, 0);
  const wav = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(wav);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, sampleCount * 2, true);
  let sampleOffset = 44;
  const sentenceEndTimes: number[] = [];
  let elapsedSamples = 0;
  for (const frames of sentenceFrames) {
    for (const samples of frames) {
      for (const sample of samples) {
        view.setInt16(sampleOffset, Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), true);
        sampleOffset += 2;
      }
    }
    elapsedSamples += frames.reduce((total, samples) => total + samples.length, 0);
    sentenceEndTimes.push(elapsedSamples / sampleRate);
  }

  const audioUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  const audio = new Audio(audioUrl);
  audio.playbackRate = Math.min(1.5, Math.max(0.8, rate));
  currentAudioElement = audio;
  activeAudioObjectUrls.add(audioUrl);
  let activeSentenceIndex = -1;
  const updateSentenceFocus = () => {
    const elapsed = audio.currentTime * audio.playbackRate;
    const sentenceIndex = sentenceEndTimes.findIndex((endTime) => elapsed < endTime);
    const nextIndex = sentenceIndex < 0 ? task.sentences.length - 1 : sentenceIndex;
    if (nextIndex === activeSentenceIndex) return;
    activeSentenceIndex = nextIndex;
    options.onSentenceChange?.(task.sentences[nextIndex], nextIndex, task.sentences.length);
  };
  updateSentenceFocus();
  options.onAudioReady?.();

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onpause = null;
      audio.onerror = null;
      if (currentAudioElement === audio) currentAudioElement = null;
      URL.revokeObjectURL(audioUrl);
      activeAudioObjectUrls.delete(audioUrl);
      options.onAmplitude?.(0);
    };
    audio.ontimeupdate = updateSentenceFocus;
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onpause = () => {
      if (!controller.cancelled) return;
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('Không phát được âm thanh ZeroTTS đã chuẩn bị.'));
    };
    void audio.play().catch((error: unknown) => {
      cleanup();
      reject(error);
    });
  });
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
  let audioReadySent = false;
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
        const currentSentenceIndex = sentenceIndex;
        sentenceIndex += 1;

        const cursorBeforeSentence = session?.scheduleCursor ?? 0;
        try {
          if (!session) throw new Error('Web Audio không được trình duyệt hỗ trợ.');
          await streamZeroTtsSentence(sentence, rate, controller, session, (sentenceStartAt) => {
            scheduleFocusCallback(
              () => options.onSentenceChange?.(sentence, currentSentenceIndex, sentenceIndex),
              session.context,
              sentenceStartAt,
              controller
            );
          });
          const sentenceEndAt = session.scheduleCursor;
          const delay = Math.max(0, (sentenceEndAt - session.context.currentTime) * 1000);
          window.setTimeout(() => {
            if (!controller.cancelled) {
              options.onSentenceEnd?.(sentence, currentSentenceIndex, sentenceIndex);
            }
          }, delay);
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
          if (usesBrowserZeroTts()) {
            failed = true;
            options.onError?.(
              error instanceof Error ? error.message : 'Không thể phát giọng ZeroTTS trên trình duyệt.'
            );
            continue;
          }
          try {
            const audioUrl = await requestZeroTtsAudio(sentence, controller);
            options.onSentenceChange?.(sentence, currentSentenceIndex, sentenceIndex);
            if (!audioReadySent) {
              options.onAudioReady?.();
              audioReadySent = true;
            }
            await playAudioSourceWithLipSync(audioUrl, rate, controller, options.onAmplitude);
            options.onSentenceEnd?.(sentence, currentSentenceIndex, sentenceIndex);
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
    if (!audioReadySent) {
      options.onAudioReady?.();
      audioReadySent = true;
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
 * Stream each sentence's PCM as it is generated; the next beat is prepared
 * while these scheduled frames are still playing.
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
    const preparedTask = preloadedTtsAudio.get(cleanedText) ?? createPreparedSpeechTask(cleanedText);
    preloadedTtsAudio.delete(cleanedText);

    if (controller.cancelled) return;
    if (preparedTask) {
      await playPreparedTtsTask(preparedTask, options, controller, rate);
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
