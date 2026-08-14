interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface VercelRequest {
  method?: string;
  body: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: { error?: string; reply?: string }): VercelResponse;
  setHeader?(name: string, value: string): void;
  writeHead?(code: number, headers?: Record<string, string>): void;
  write?(chunk: string | Uint8Array): boolean;
  end?(chunk?: string | Uint8Array): void;
}

declare const process: {
  env: Record<string, string | undefined>;
};

const DEFAULT_MODEL = 'gemini-2.5-flash';

function sanitizeModel(model?: string): string {
  if (model && /^[a-zA-Z0-9.\-_]+$/.test(model)) {
    return model;
  }
  return DEFAULT_MODEL;
}

interface TutorRequestBody {
  lesson?: {
    title?: string;
    tag?: string;
    theory?: string;
    realCodeSnippet?: string;
  };
  messages?: TutorMessage[];
  model?: string;
  stream?: boolean;
}

const SYSTEM_PROMPT = `Em là một tutor kỹ thuật của eSmiles Backend Academy.
Nhiệm vụ: giúp học viên hiểu thật chắc bài học hiện tại trước khi làm trắc nghiệm.
Quy tắc bắt buộc:
1. Chỉ dùng thông tin trong LESSON_CONTEXT và suy luận trực tiếp từ đó. Không bịa API, quy ước hoặc kiến thức không có căn cứ.
2. Trả lời bằng tiếng Việt, xưng "em", gọi người học là "ĐẠI CA". Giọng rõ, thẳng, kỹ thuật.
3. Nếu câu hỏi chưa rõ, hỏi lại đúng một câu ngắn. Nếu hỏi ngoài bài, nói rõ giới hạn rồi liên hệ nó với khái niệm gần nhất trong bài.
4. Khi giải thích code, đi từ vấn đề -> cơ chế -> ví dụ -> kết luận ngắn. Dùng markdown gọn và chuẩn (headings ###, bold **, bullet lists -, code blocks \`\`\`ts).
5. Không đưa đáp án trắc nghiệm nếu người học chưa hỏi; ưu tiên giải thích để người học tự suy luận.
6. Nếu người học hỏi một đoạn cụ thể, tập trung đúng đoạn đó, không giảng lại toàn bộ bài.`;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: 'Thiếu GEMINI_API_KEY trên server.' });
  }

  const body = (request.body || {}) as TutorRequestBody;
  const lesson = body.lesson;
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const model = sanitizeModel(body.model);
  const isStream = body.stream !== false && typeof response.write === 'function';

  if (!lesson?.title || messages.length === 0) {
    return response.status(400).json({ error: 'Dữ liệu bài học hoặc hội thoại không hợp lệ.' });
  }

  const contents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }]
  }));
  const prompt = `${SYSTEM_PROMPT}\n\nLESSON_CONTEXT:\nTitle: ${lesson.title}\nTag: ${lesson.tag || ''}\n\n${lesson.theory || ''}\n\nREAL_CODE:\n${lesson.realCodeSnippet || ''}`;

  try {
    const endpoint = isStream
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents,
        generationConfig: { temperature: 0.25, maxOutputTokens: 2048 }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let errorMsg = `Gemini trả về lỗi HTTP ${geminiResponse.status}.`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMsg = errorJson.error.message;
        }
      } catch {}
      return response.status(geminiResponse.status || 502).json({ error: errorMsg });
    }

    if (isStream) {
      if (typeof response.setHeader === 'function') {
        response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache, no-transform');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('X-Accel-Buffering', 'no');
      }
      if (typeof response.writeHead === 'function') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
      }

      const reader = geminiResponse.body?.getReader();
      if (!reader) {
        throw new Error('Không thể đọc stream từ Gemini.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
            if (text && response.write) {
              response.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          } catch {
            // ignore partial JSON parse error
          }
        }
      }

      if (buffer.trim().startsWith('data:')) {
        const jsonStr = buffer.trim().replace(/^data:\s*/, '');
        try {
          const parsed = JSON.parse(jsonStr) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
          if (text && response.write) {
            response.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch {}
      }

      if (response.write) {
        response.write('data: [DONE]\n\n');
      }
      if (typeof response.end === 'function') {
        response.end();
      }
      return;
    }

    // Non-streaming fallback
    const responseText = await geminiResponse.text();
    let data: {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    } = {};
    try {
      if (responseText.trim()) data = JSON.parse(responseText) as typeof data;
    } catch {
      return response.status(502).json({ error: `Gemini trả về dữ liệu không hợp lệ (HTTP ${geminiResponse.status}).` });
    }
    const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!reply) {
      return response.status(502).json({ error: data.error?.message || `Gemini không trả được câu trả lời (HTTP ${geminiResponse.status}).` });
    }
    return response.status(200).json({ reply });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Không kết nối được tới Gemini.';
    if (isStream && typeof response.write === 'function') {
      response.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      if (typeof response.end === 'function') response.end();
      return;
    }
    return response.status(502).json({ error: errorMsg });
  }
}
