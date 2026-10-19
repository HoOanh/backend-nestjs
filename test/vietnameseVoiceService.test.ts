import { afterEach, describe, expect, test } from 'bun:test';
import { fetchZeroTtsPcmFrames } from '../src/services/vietnameseVoiceService.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('batched ZeroTTS stream', () => {
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
