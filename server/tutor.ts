import {
  recordTutorTrace,
  authorizeTutorRequest,
  getPersistedModelCooldowns
} from './index.ts';
import { DEFAULT_MODEL, FALLBACK_MODELS, SYSTEM_PROMPT } from './tutor-config.ts';

interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: {
    data: string;
    mimeType: string;
  };
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

const LEGACY_MODEL_ALIASES: Record<string, string> = {
  antigravity: 'gemini-3.8-flash',
  'gemini-3.7-flash': 'gemini-3.8-flash',
  'gemini-3.5-flash': 'gemini-3.6-flash',
  'gemma-4-31b': 'gemma-4-31b-it'
};

const modelCooldownUntil = new Map<string, number>();

function sanitizeModel(model?: string): string {
  if (model && /^[a-zA-Z0-9.\-_]+$/.test(model)) {
    return LEGACY_MODEL_ALIASES[model] || model;
  }
  return DEFAULT_MODEL;
}

interface TutorRequestBody {
  sessionId?: string;
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

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const traceBody = (request.body || {}) as TutorRequestBody;
  const denied = authorizeTutorRequest(request.headers, traceBody.sessionId);
  if (denied)
    return response
      .status(denied)
      .json({
        error:
          denied === 401
            ? 'Chưa đăng nhập'
            : 'Không có quyền sử dụng phiên chat này'
      });
  const trace = (
    level: 'INFO' | 'WARN' | 'ERROR',
    event: string,
    metadata: Record<string, unknown>
  ) =>
    recordTutorTrace(
      request.headers,
      traceBody.sessionId,
      level,
      event,
      metadata
    );
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    trace('ERROR', 'AI_CONFIGURATION_ERROR', { reason: 'Missing API key' });
    return response
      .status(500)
      .json({ error: 'Thiếu GEMINI_API_KEY trên server.' });
  }

  const body = (request.body || {}) as TutorRequestBody;
  const lesson = body.lesson;
  const rawMessages = Array.isArray(body.messages)
    ? body.messages.slice(-16)
    : [];
  const model = sanitizeModel(body.model);
  const isStream =
    body.stream !== false && typeof response.write === 'function';

  if (!lesson?.title || rawMessages.length === 0) {
    return response
      .status(400)
      .json({ error: 'Dữ liệu bài học hoặc hội thoại không hợp lệ.' });
  }

  // 1. Build sanitized Gemini multi-turn contents
  // Gemini requires:
  // - First turn MUST be 'user'
  // - Turns MUST alternate between 'user' and 'model'
  // - Consecutive same-role turns must be combined into one
  const contents: Array<{
    role: 'user' | 'model';
    parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }>;
  }> = [];

  for (const message of rawMessages) {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];

    if (message.content && message.content.trim()) {
      parts.push({ text: message.content });
    }
    if (message.image?.data && message.image?.mimeType) {
      const cleanBase64 = message.image.data.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: message.image.mimeType,
          data: cleanBase64
        }
      });
    }

    if (parts.length === 0) continue;

    if (contents.length === 0) {
      // First turn must be user; skip introductory assistant greetings
      if (role !== 'user') continue;
      contents.push({ role, parts });
    } else {
      const prev = contents[contents.length - 1];
      if (prev.role === role) {
        // Merge consecutive turns with the same role
        prev.parts.push(...parts);
      } else {
        contents.push({ role, parts });
      }
    }
  }

  if (contents.length === 0) {
    return response
      .status(400)
      .json({ error: 'Không tìm thấy câu hỏi hợp lệ từ học viên.' });
  }
  const prompt = `${SYSTEM_PROMPT}\n\nLESSON_CONTEXT:\nTitle: ${lesson.title}\nTag: ${lesson.tag || ''}\n\n${lesson.theory || ''}\n\nREAL_CODE:\n${lesson.realCodeSnippet || ''}`;
  const estimatedPromptTokens = Math.max(
    1,
    Math.ceil((prompt.length + JSON.stringify(contents).length) / 4)
  );

  // Keep enough time for streaming before Vercel's 30-second function limit.
  const now = Date.now();
  try {
    const persistedCooldowns = getPersistedModelCooldowns(now);
    for (const [m, until] of persistedCooldowns.entries()) {
      const existing = modelCooldownUntil.get(m) ?? 0;
      if (until > existing) modelCooldownUntil.set(m, until);
    }
  } catch {}
  const baseCandidates = [
    model,
    ...FALLBACK_MODELS.filter((m) => m !== model)
  ];
  const healthyCandidates = baseCandidates.filter(
    (m) => (modelCooldownUntil.get(m) ?? 0) <= now
  );
  const cooledDownCandidates = baseCandidates.filter(
    (m) => (modelCooldownUntil.get(m) ?? 0) > now
  );
  const modelChain = [...healthyCandidates, ...cooledDownCandidates].slice(0, 3);
  const requestDeadline = AbortSignal.timeout(24_000);

  let currentActiveModel = model;
  let activeGeminiResponse: Response | null = null;
  let lastErrorMsg = '';

  try {
    for (let i = 0; i < modelChain.length; i++) {
      const candidate = modelChain[i];
      try {
        const endpoint = isStream
          ? `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const generationConfig = candidate.startsWith('gemini-3.')
          ? { maxOutputTokens: 2048 }
          : { temperature: 0.25, maxOutputTokens: 2048 };
        const candidateController = new AbortController();
        const candidateTimeout = setTimeout(
          () => candidateController.abort(),
          7_000
        );

        let candidateResponse: Response;
        try {
          candidateResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.any([
              requestDeadline,
              candidateController.signal
            ]),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: prompt }] },
              contents,
              generationConfig
            })
          });
        } finally {
          clearTimeout(candidateTimeout);
        }

        if (candidateResponse.ok) {
          modelCooldownUntil.delete(candidate);
          trace('INFO', 'AI_PROVIDER_ACCEPTED', {
            requestedModel: model,
            actualModel: candidate,
            isFallback: candidate !== model,
            attempt: i + 1,
            status: candidateResponse.status
          });
          currentActiveModel = candidate;
          activeGeminiResponse = candidateResponse;
          if (candidate !== model) {
            console.info(
              `[Tutor] Silent fallback dispatched to ${candidate} (original requested: ${model})`
            );
          }
          break;
        }

        let cooldownMs = 0;
        if (candidateResponse.status === 429) {
          cooldownMs = 60_000;
          modelCooldownUntil.set(candidate, Date.now() + cooldownMs);
        } else if (candidateResponse.status === 503) {
          cooldownMs = 30_000;
          modelCooldownUntil.set(candidate, Date.now() + cooldownMs);
        } else if (candidateResponse.status === 404) {
          cooldownMs = 300_000;
          modelCooldownUntil.set(candidate, Date.now() + cooldownMs);
        }

        const errorText = await candidateResponse.text();
        let parsedMsg = `HTTP ${candidateResponse.status}`;
        try {
          const errorJson = JSON.parse(errorText) as {
            error?: { message?: string };
          };
          if (errorJson.error?.message) {
            parsedMsg = errorJson.error.message;
          }
        } catch {}
        trace('WARN', 'AI_PROVIDER_REJECTED', {
          requestedModel: model,
          model: candidate,
          attempt: i + 1,
          status: candidateResponse.status,
          error: parsedMsg,
          cooldownMs
        });
        lastErrorMsg = `[${candidate}] HTTP ${candidateResponse.status}: ${parsedMsg}`;
        console.warn(
          `Gemini model ${candidate} failed (${candidateResponse.status}): ${parsedMsg}. Trying next fallback...`
        );
      } catch (subErr) {
        const netMsg =
          subErr instanceof Error ? subErr.message : 'Network error';
        lastErrorMsg = netMsg;
        trace('WARN', 'AI_PROVIDER_NETWORK_ERROR', {
          requestedModel: model,
          model: candidate,
          attempt: i + 1,
          error: netMsg
        });
        console.warn(`Failed to connect to ${candidate}:`, subErr);
      }
    }

    if (!activeGeminiResponse) {
      trace('ERROR', 'AI_REQUEST_FAILED', {
        requestedModel: model,
        durationMs: Date.now() - startedAt,
        error: lastErrorMsg
      });
      return response.status(503).json({
        error: `Máy chủ AI Google đang quá tải tạm thời (${lastErrorMsg}). ĐẠI CA vui lòng thử lại sau giây lát.`
      });
    }

    const geminiResponse = activeGeminiResponse;

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
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
      }

      const reader = geminiResponse.body?.getReader();
      if (!reader) {
        throw new Error('Không thể đọc stream từ Gemini.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let streamedLength = 0;
      let providerPromptTokens = 0;
      let providerCompletionTokens = 0;
      let providerTotalTokens = 0;

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
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
              usageMetadata?: {
                promptTokenCount?: number;
                candidatesTokenCount?: number;
                totalTokenCount?: number;
              };
            };
            if (parsed.usageMetadata) {
              if (parsed.usageMetadata.promptTokenCount) {
                providerPromptTokens = parsed.usageMetadata.promptTokenCount;
              }
              if (parsed.usageMetadata.candidatesTokenCount) {
                providerCompletionTokens =
                  parsed.usageMetadata.candidatesTokenCount;
              }
              if (parsed.usageMetadata.totalTokenCount) {
                providerTotalTokens = parsed.usageMetadata.totalTokenCount;
              }
            }
            const text = parsed.candidates?.[0]?.content?.parts
              ?.map((p) => p.text || '')
              .join('');
            if (text && response.write) {
              streamedLength += text.length;
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
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              totalTokenCount?: number;
            };
          };
          if (parsed.usageMetadata) {
            if (parsed.usageMetadata.promptTokenCount) {
              providerPromptTokens = parsed.usageMetadata.promptTokenCount;
            }
            if (parsed.usageMetadata.candidatesTokenCount) {
              providerCompletionTokens =
                parsed.usageMetadata.candidatesTokenCount;
            }
            if (parsed.usageMetadata.totalTokenCount) {
              providerTotalTokens = parsed.usageMetadata.totalTokenCount;
            }
          }
          const text = parsed.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || '')
            .join('');
          if (text && response.write) {
            streamedLength += text.length;
            response.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch {}
      }

      if (response.write) {
        const promptTokens = providerPromptTokens || estimatedPromptTokens;
        const completionTokens =
          providerCompletionTokens || Math.max(1, Math.ceil(streamedLength / 4));
        const totalTokens =
          providerTotalTokens || promptTokens + completionTokens;
        trace('INFO', 'AI_STREAM_COMPLETE', {
          requestedModel: model,
          actualModel: currentActiveModel,
          isFallback: currentActiveModel !== model,
          durationMs: Date.now() - startedAt,
          responseLength: streamedLength,
          promptTokens,
          completionTokens,
          totalTokens
        });
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
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      error?: { message?: string };
    } = {};
    try {
      if (responseText.trim()) data = JSON.parse(responseText) as typeof data;
    } catch {
      return response
        .status(502)
        .json({
          error: `Gemini trả về dữ liệu không hợp lệ (HTTP ${geminiResponse.status}).`
        });
    }
    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();
    if (!reply) {
      return response
        .status(502)
        .json({
          error:
            data.error?.message ||
            `Gemini không trả được câu trả lời (HTTP ${geminiResponse.status}).`
        });
    }
    const promptTokens =
      data.usageMetadata?.promptTokenCount || estimatedPromptTokens;
    const completionTokens =
      data.usageMetadata?.candidatesTokenCount ||
      Math.max(1, Math.ceil(reply.length / 4));
    const totalTokens =
      data.usageMetadata?.totalTokenCount || promptTokens + completionTokens;
    trace('INFO', 'AI_RESPONSE_COMPLETE', {
      requestedModel: model,
      actualModel: currentActiveModel,
      isFallback: currentActiveModel !== model,
      durationMs: Date.now() - startedAt,
      responseLength: reply.length,
      promptTokens,
      completionTokens,
      totalTokens
    });
    return response.status(200).json({ reply });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : 'Không kết nối được tới Gemini.';
    trace('ERROR', 'AI_REQUEST_ERROR', {
      requestedModel: model,
      actualModel: currentActiveModel,
      durationMs: Date.now() - startedAt,
      error: errorMsg
    });
    if (isStream && typeof response.write === 'function') {
      response.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      if (typeof response.end === 'function') response.end();
      return;
    }
    return response.status(502).json({ error: errorMsg });
  }
}
