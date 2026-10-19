import { canUseZeroTts, streamWithZeroTts } from './zerotts.ts';

interface ZeroTtsStreamRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface ZeroTtsStreamResponse {
  status(code: number): ZeroTtsStreamResponse;
  setHeader(name: string, value: string): ZeroTtsStreamResponse;
  write(chunk: Uint8Array): boolean;
  end(body?: Uint8Array | string): void;
}

export default async function handler(
  request: ZeroTtsStreamRequest,
  response: ZeroTtsStreamResponse
): Promise<void> {
  if (request.method !== 'POST') {
    response
      .status(405)
      .setHeader('Allow', 'POST')
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .end(JSON.stringify({ error: 'Chỉ hỗ trợ POST.' }));
    return;
  }

  if (!canUseZeroTts(request.headers || {})) {
    response
      .status(401)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .end(JSON.stringify({ error: 'Đăng nhập để sử dụng giọng đọc của lớp học.' }));
    return;
  }

  let payload = request.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      response
        .status(400)
        .setHeader('Content-Type', 'application/json; charset=utf-8')
        .end(JSON.stringify({ error: 'Request TTS không phải JSON hợp lệ.' }));
      return;
    }
  }

  const sentences =
    payload && typeof payload === 'object' && 'sentences' in payload &&
    Array.isArray(payload.sentences) &&
    payload.sentences.every((sentence: unknown) => typeof sentence === 'string')
      ? payload.sentences
      : payload && typeof payload === 'object' && 'text' in payload &&
        typeof payload.text === 'string'
        ? [payload.text]
        : [];
  const result = await streamWithZeroTts(sentences);
  response.status(result.status);
  for (const [name, value] of result.headers) response.setHeader(name, value);

  if (!result.body) {
    response.end();
    return;
  }

  const reader = result.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response.write(value);
    }
    response.end();
  } catch (error) {
    console.error('ZeroTTS stream response failed:', error);
    response.end();
  } finally {
    reader.releaseLock();
  }
}
