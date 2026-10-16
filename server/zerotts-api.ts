import { canUseZeroTts, synthesizeWithZeroTts } from './zerotts.ts';

interface ZeroTtsRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface ZeroTtsResponse {
  status(code: number): ZeroTtsResponse;
  setHeader(name: string, value: string): ZeroTtsResponse;
  end(body?: Uint8Array | string): void;
}

export default async function handler(
  request: ZeroTtsRequest,
  response: ZeroTtsResponse
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

  const text =
    payload && typeof payload === 'object' && 'text' in payload &&
    typeof payload.text === 'string'
      ? payload.text
      : '';
  const result = await synthesizeWithZeroTts(text);
  response
    .status(result.status)
    .setHeader('Content-Type', result.contentType)
    .setHeader('Cache-Control', 'no-store')
    .end(result.body);
}
