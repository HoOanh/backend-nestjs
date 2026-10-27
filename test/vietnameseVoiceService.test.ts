import { afterEach, describe, expect, test } from 'bun:test';
import {
  fetchZeroTtsPcmFrames,
  preloadVietnameseSpeechSequence,
  stopVietnameseSpeech,
  speakVietnamese
} from '../src/services/vietnameseVoiceService.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  stopVietnameseSpeech();
  globalThis.fetch = originalFetch;
});

describe('batched ZeroTTS stream', () => {
  test('an empty audio stream does not announce readiness or advance the lesson', async () => {
    globalThis.fetch = async () => new Response(new Uint8Array(), { headers: { 'X-Audio-Sample-Rate': '24000' } });
    let ready = 0;
    let ended = 0;
    const errors: string[] = [];
    await speakVietnamese({ text: 'Kiểm tra âm thanh.', onAudioReady: () => ready += 1, onEnd: () => ended += 1, onError: (message) => errors.push(message) });
    expect(ready).toBe(0);
    expect(ended).toBe(0);
    expect(errors).toEqual(['Chưa nhận được âm thanh để bắt đầu bài giảng.']);
  });
  test('replaces obsolete lookahead without restarting the next beat', () => {
    const requests = new Map<string, AbortSignal>();
    globalThis.fetch = async (_input, init) => {
      const signal = init?.signal;
      if (!signal) throw new Error('Expected an abortable preload');
      const { sentences } = JSON.parse(String(init?.body)) as { sentences: string[] };
      requests.set(sentences[0], signal);
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
      });
    };

    preloadVietnameseSpeechSequence(['Đoạn cũ.', 'Đoạn tiếp.']);
    const retained = requests.get('Đoạn tiếp.');
    preloadVietnameseSpeechSequence(['Đoạn tiếp.', 'Đoạn mới.']);

    expect(requests.get('Đoạn cũ.')?.aborted).toBe(true);
    expect(requests.get('Đoạn tiếp.')).toBe(retained);
    expect(retained?.aborted).toBe(false);
    expect(requests.get('Đoạn mới.')?.aborted).toBe(false);
    stopVietnameseSpeech();
    expect([...requests.values()].every((signal) => signal.aborted)).toBe(true);
  });

  test('does not enqueue speech that was cancelled before generation', async () => {
    let requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      throw new Error('Cancelled speech must not fetch');
    };
    const abort = new AbortController();
    abort.abort();
    await fetchZeroTtsPcmFrames(['Đã huỷ.'], { cancelled: false, signal: abort.signal }, () => {});
    expect(requests).toBe(0);
  });

  test('sends one request for a beat and preserves sentence indexes across partial chunks', async () => {
    const frames = new Uint8Array(20);
    const view = new DataView(frames.buffer);
    view.setUint32(0, 0, false);
    view.setUint32(4, 2, false);
    view.setInt16(8, 16384, true);
    view.setUint32(10, 1, false);
    view.setUint32(14, 2, false);
    view.setInt16(18, -16384, true);

    let requestCount = 0;
    let requestBody = '';
    globalThis.fetch = async (_input, init) => {
      requestCount += 1;
      requestBody = String(init?.body ?? '');
      const chunks = [frames.slice(0, 3), frames.slice(3, 11), frames.slice(11)];
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        }
      });
      return new Response(body, { headers: { 'X-Audio-Sample-Rate': '24000' } });
    };

    const received: Array<{ sentenceIndex: number; sample: number }> = [];
    await fetchZeroTtsPcmFrames(['Câu đầu.', 'Câu sau.'], { cancelled: false }, (samples, _rate, sentenceIndex) => {
      received.push({ sentenceIndex, sample: samples[0] });
    }, false);

    expect(requestCount).toBe(1);
    expect(JSON.parse(requestBody)).toEqual({ sentences: ['Câu đầu.', 'Câu sau.'] });
    expect(received).toEqual([
      { sentenceIndex: 0, sample: 0.5 },
      { sentenceIndex: 1, sample: -0.5 }
    ]);
  });
});
