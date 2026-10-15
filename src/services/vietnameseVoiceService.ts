// Vietnamese Voice & Real-Time Lip-Sync Engine for 3D Lecture Hall
// Uses /api/tts (Vietnamese Neural TTS) with Web Audio API AnalyserNode for 60fps 3D mouth lip-sync,
// plus automatic fallback to Browser Native vi-VN SpeechSynthesis Voice (Linh / Google Tiếng Việt / HoaiMy).

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
let cachedVietnameseVoice: SpeechSynthesisVoice | null = null;

/**
 * Clean markdown, ASCII diagrams, and normalize common tech abbreviations
 * so Vietnamese TTS pronounces them naturally like a real Vietnamese lecturer.
 */
export function normalizeTextForVietnameseSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' . Mở phần minh họa trên bảng. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬▲▼◀▶→←↑↓⚡🎯💡📌🔥✅❌✋🎙️]/g, ' ')
    .replace(/[#*>_~|]/g, ' ')
    .replace(/\bNestJS\b/gi, 'Nest J S')
    .replace(/\bNode\.?js\b/gi, 'Node J S')
    .replace(/\bIoC\b/g, 'I O C')
    .replace(/\bJWT\b/g, 'J W T')
    .replace(/\bSQL\b/g, 'S Q L')
    .replace(/\bAPI\b/g, 'A P I')
    .replace(/\bHTTP\b/g, 'H T T P')
    .replace(/\bCPU\b/g, 'C P U')
    .replace(/\bDTO\b/g, 'D T O')
    .replace(/\bORM\b/g, 'O R M')
    .replace(/\bCRUD\b/g, 'C R U D')
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
 * Resolve the best available native Vietnamese voice in the browser.
 */
export async function resolveNativeVietnameseVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  if (cachedVietnameseVoice) return cachedVietnameseVoice;

  const pickBestVoice = (
    voices: SpeechSynthesisVoice[]
  ): SpeechSynthesisVoice | null => {
    const viVoices = voices.filter(
      (v) =>
        v.lang.toLowerCase().startsWith('vi') ||
        v.name.toLowerCase().includes('viet') ||
        v.name.toLowerCase().includes('tiếng việt') ||
        v.name.toLowerCase().includes('linh') ||
        v.name.toLowerCase().includes('hoaimy') ||
        v.name.toLowerCase().includes('namminh')
    );
    if (viVoices.length === 0) return null;

    // Prefer Google Tiếng Việt, Microsoft HoaiMy/NamMinh, or Apple Linh
    const preferred = viVoices.find((v) =>
      /google|natural|neural|hoaimy|namminh|linh/i.test(v.name)
    );
    return preferred || viVoices[0];
  };

  const immediate = window.speechSynthesis.getVoices();
  const foundImmediate = pickBestVoice(immediate);
  if (foundImmediate) {
    cachedVietnameseVoice = foundImmediate;
    return foundImmediate;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const voices = window.speechSynthesis.getVoices();
      const chosen = pickBestVoice(voices);
      cachedVietnameseVoice = chosen;
      resolve(chosen);
    };
    window.speechSynthesis.addEventListener('voiceschanged', finish, {
      once: true
    });
    setTimeout(finish, 650);
  });
}

/**
 * Stop any ongoing Vietnamese speech playback immediately.
 */
export function stopVietnameseSpeech(): void {
  if (activeStopController) {
    activeStopController.cancelled = true;
    activeStopController = null;
  }
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.src = '';
    } catch {
      // Ignore cleanup errors
    }
    currentAudioElement = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore speechSynthesis cancel errors
    }
  }
}

/**
 * Play a single base64 MP3 data URI with Web Audio API real-time amplitude analysis for 3D lip-sync.
 */
async function playAudioDataUriWithLipSync(
  dataUri: string,
  rate: number,
  controller: { cancelled: boolean },
  onAmplitude?: (amplitude: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (controller.cancelled) {
      resolve();
      return;
    }

    const audio = new Audio(dataUri);
    audio.playbackRate = Math.min(1.5, Math.max(0.8, rate));
    currentAudioElement = audio;

    let animFrameId = 0;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array<ArrayBuffer> | null = null;

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
      if (animFrameId) cancelAnimationFrame(animFrameId);
      onAmplitude?.(0);
      if (currentAudioElement === audio) {
        currentAudioElement = null;
      }
    };

    audio.onplay = () => {
      animFrameId = requestAnimationFrame(pumpAmplitude);
    };

    audio.onended = () => {
      cleanup();
      resolve();
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

/**
 * Fallback to Browser Native Vietnamese SpeechSynthesis (`vi-VN`) with simulated lip-sync.
 */
async function speakWithNativeBrowserVietnamese(
  sentences: string[],
  rate: number,
  controller: { cancelled: boolean },
  options: SpeakVietnameseOptions
): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.('Trình duyệt không hỗ trợ phát giọng nói.');
    options.onEnd?.();
    return;
  }

  const viVoice = await resolveNativeVietnameseVoice();
  window.speechSynthesis.cancel();

  for (let i = 0; i < sentences.length; i++) {
    if (controller.cancelled) break;
    const sentence = sentences[i];
    options.onSentenceChange?.(sentence, i, sentences.length);

    await new Promise<void>((resolve) => {
      if (controller.cancelled) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = 'vi-VN';
      if (viVoice) {
        utterance.voice = viVoice;
      }
      utterance.rate = Math.min(1.35, Math.max(0.85, rate));
      utterance.pitch = 1.0;

      let intervalId: ReturnType<typeof setInterval> | null = null;
      const stopSim = () => {
        if (intervalId) clearInterval(intervalId);
        options.onAmplitude?.(0);
      };

      utterance.onstart = () => {
        intervalId = setInterval(() => {
          if (controller.cancelled) {
            stopSim();
            return;
          }
          const t = performance.now() * 0.016;
          const level =
            Math.abs(Math.sin(t) * Math.sin(t * 0.43)) * 0.85 + 0.1;
          options.onAmplitude?.(level);
        }, 40);
      };

      utterance.onend = () => {
        stopSim();
        resolve();
      };

      utterance.onerror = () => {
        stopSim();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}

/**
 * Speak Vietnamese lecture content with real-time 3D lip-sync and live sentence subtitles.
 * Always prioritizes genuine Vietnamese TTS via /api/tts, with seamless fallback to native vi-VN voice.
 */
export async function speakVietnamese(
  options: SpeakVietnameseOptions
): Promise<void> {
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
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanedText })
    });

    if (controller.cancelled) return;

    if (response.ok) {
      const payload = (await response.json()) as {
        success?: boolean;
        chunks?: string[];
        audioChunks?: string[];
      };

      if (
        payload.success &&
        Array.isArray(payload.audioChunks) &&
        payload.audioChunks.length > 0
      ) {
        const textChunks = payload.chunks || [];
        for (let i = 0; i < payload.audioChunks.length; i++) {
          if (controller.cancelled) break;
          const currentSentence =
            textChunks[i] || cleanedText.slice(0, 160);
          options.onSentenceChange?.(
            currentSentence,
            i,
            payload.audioChunks.length
          );
          await playAudioDataUriWithLipSync(
            payload.audioChunks[i],
            rate,
            controller,
            options.onAmplitude
          );
        }

        if (!controller.cancelled) {
          options.onAmplitude?.(0);
          options.onEnd?.();
        }
        return;
      }
    }
  } catch {
    // Fall through to native Vietnamese browser voice if /api/tts fails
  }

  if (controller.cancelled) return;

  const sentences = splitIntoVietnameseSentences(cleanedText);
  await speakWithNativeBrowserVietnamese(sentences, rate, controller, options);

  if (!controller.cancelled) {
    options.onAmplitude?.(0);
    options.onEnd?.();
  }
}
