interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface VercelRequest {
  method?: string;
  body: unknown;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(payload: { error?: string; reply?: string }): VercelResponse;
}

declare const process: {
  env: Record<string, string | undefined>;
};

const ALLOWED_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'] as const;
type GeminiModel = (typeof ALLOWED_MODELS)[number];

interface TutorRequestBody {
  lesson?: {
    title?: string;
    tag?: string;
    theory?: string;
    realCodeSnippet?: string;
  };
  messages?: TutorMessage[];
  model?: string;
}

const SYSTEM_PROMPT = `Em là một tutor kỹ thuật của eSmiles Backend Academy.
Nhiệm vụ: giúp học viên hiểu thật chắc bài học hiện tại trước khi làm trắc nghiệm.
Quy tắc bắt buộc:
1. Chỉ dùng thông tin trong LESSON_CONTEXT và suy luận trực tiếp từ đó. Không bịa API, quy ước hoặc kiến thức không có căn cứ.
2. Trả lời bằng tiếng Việt, xưng "em", gọi người học là "ĐẠI CA". Giọng rõ, thẳng, kỹ thuật.
3. Nếu câu hỏi chưa rõ, hỏi lại đúng một câu ngắn. Nếu hỏi ngoài bài, nói rõ giới hạn rồi liên hệ nó với khái niệm gần nhất trong bài.
4. Khi giải thích code, đi từ vấn đề -> cơ chế -> ví dụ -> kết luận ngắn. Dùng markdown gọn.
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
  const model: GeminiModel = ALLOWED_MODELS.includes(body.model as GeminiModel)
    ? (body.model as GeminiModel)
    : 'gemini-2.5-flash-lite';
  if (!lesson?.title || messages.length === 0) {
    return response.status(400).json({ error: 'Dữ liệu bài học hoặc hội thoại không hợp lệ.' });
  }

  const contents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }]
  }));
  const prompt = `${SYSTEM_PROMPT}\n\nLESSON_CONTEXT:\nTitle: ${lesson.title}\nTag: ${lesson.tag || ''}\n\n${lesson.theory || ''}\n\nREAL_CODE:\n${lesson.realCodeSnippet || ''}`;

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt }] },
          contents,
          generationConfig: { temperature: 0.25, maxOutputTokens: 900 }
        })
      }
    );
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
    if (!geminiResponse.ok || !reply) {
      return response.status(502).json({ error: data.error?.message || `Gemini không trả được câu trả lời (HTTP ${geminiResponse.status}).` });
    }
    return response.status(200).json({ reply });
  } catch {
    return response.status(502).json({ error: 'Không kết nối được tới Gemini.' });
  }
}
