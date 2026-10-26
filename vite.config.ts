import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

function localBackendApi(): Plugin {
  return {
    name: 'local-backend-api',
    async configureServer(server) {
      const [
        { default: tutorHandler },
        { handleApiRequest },
        {
          canUseZeroTts,
          stopLocalZeroTtsService,
          streamWithZeroTts,
          synthesizeWithZeroTts,
          warmLocalZeroTtsService
        }
      ] = await Promise.all([
        import('./server/tutor.ts'),
        import('./server/index.ts'),
        import('./server/zerotts.ts')
      ]);
      server.httpServer?.once('close', () => {
        void stopLocalZeroTtsService();
      });
      server.middlewares.use((request, response, next) => {
        if ((request.url || '').split('?')[0].startsWith('/ai-classroom/')) {
          response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        }
        next();
      });
      void warmLocalZeroTtsService().catch((error: unknown) => {
        console.error('ZeroTTS warmup failed:', error);
      });

      server.middlewares.use(async (request, response, next) => {
        const url = request.url || '';
        if (!url.startsWith('/api/')) {
          next();
          return;
        }

        const ttsPath = url.split('?')[0];
        if (ttsPath === '/api/tts' || ttsPath === '/api/tts/stream') {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.setHeader('Allow', 'POST');
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ error: 'Chỉ hỗ trợ POST.' }));
            return;
          }

          if (!canUseZeroTts(request.headers as Record<string, string | string[] | undefined>)) {
            response.statusCode = 401;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ error: 'Đăng nhập để sử dụng giọng đọc của lớp học.' }));
            return;
          }

          let rawBody = '';
          let bodyTooLarge = false;
          request.on('data', (chunk: unknown) => {
            rawBody += String(chunk);
            if (rawBody.length > 32768) bodyTooLarge = true;
          });
          request.on('end', async () => {
            if (bodyTooLarge) {
              response.statusCode = 413;
              response.setHeader('Content-Type', 'application/json; charset=utf-8');
              response.end(JSON.stringify({ error: 'Request TTS quá lớn.' }));
              return;
            }

            let payload: unknown;
            try {
              payload = rawBody ? (JSON.parse(rawBody) as unknown) : {};
            } catch {
              response.statusCode = 400;
              response.setHeader('Content-Type', 'application/json; charset=utf-8');
              response.end(JSON.stringify({ error: 'Request TTS không phải JSON hợp lệ.' }));
              return;
            }
            const text =
              payload && typeof payload === 'object' && 'text' in payload &&
              typeof payload.text === 'string'
                ? payload.text
                : '';
            const sentences =
              payload && typeof payload === 'object' && 'sentences' in payload &&
              Array.isArray(payload.sentences) &&
              payload.sentences.every((sentence: unknown) => typeof sentence === 'string')
                ? payload.sentences
                : text
                  ? [text]
                  : [];
            try {
              if (ttsPath === '/api/tts/stream') {
                const result = await streamWithZeroTts(sentences);
                response.statusCode = result.status;
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
                    response.write(Buffer.from(value));
                  }
                  response.end();
                } finally {
                  reader.releaseLock();
                }
                return;
              }

              const result = await synthesizeWithZeroTts(text);
              response.statusCode = result.status;
              response.setHeader('Content-Type', result.contentType);
              response.setHeader('Cache-Control', 'no-store');
              response.end(Buffer.from(result.body));
            } catch (error) {
              console.error('ZeroTTS API request failed:', error);
              if (!response.headersSent) {
                response.statusCode = 503;
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
                response.end(JSON.stringify({ error: 'Không phát được giọng đọc lúc này.' }));
              } else {
                response.end();
              }
            }
          });
          return;
        }

        // Special case: /api/tutor handled by AI engine
        if (url === '/api/tutor' || url.startsWith('/api/tutor?')) {
          if (request.method !== 'POST') {
            next();
            return;
          }

          let rawBody = '';
          request.on('data', (chunk: unknown) => {
            rawBody += String(chunk);
          });
          request.on('end', async () => {
            let body: unknown = {};
            try {
              body = rawBody ? (JSON.parse(rawBody) as unknown) : {};
            } catch {
              response.statusCode = 400;
              response.setHeader('Content-Type', 'application/json');
              response.end(
                JSON.stringify({
                  error: 'Request body không phải JSON hợp lệ.'
                })
              );
              return;
            }

            let statusCode = 200;
            const resAdapter = {
              status(code: number) {
                statusCode = code;
                response.statusCode = code;
                return this;
              },
              json(payload: { error?: string; reply?: string }) {
                response.statusCode = statusCode;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(payload));
                return this;
              },
              setHeader(name: string, value: string) {
                response.setHeader(name, value);
                return this;
              },
              writeHead(code: number, headers?: Record<string, string>) {
                statusCode = code;
                response.writeHead(code, headers);
                return this;
              },
              write(chunk: string | Uint8Array) {
                return response.write(chunk);
              },
              end(data?: string | Uint8Array) {
                return response.end(data);
              }
            };

            await tutorHandler(
              {
                method: request.method,
                body,
                headers: request.headers as Record<
                  string,
                  string | string[] | undefined
                >
              },
              resAdapter
            );
          });
          return;
        }

        // Handle all other REST APIs (Users, Plans, Progress, History, Stats)
        let rawBody = '';
        request.on('data', (chunk: unknown) => {
          rawBody += String(chunk);
        });
        request.on('end', async () => {
          let body: unknown = {};
          if (rawBody) {
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = {};
            }
          }

          let statusCode = 200;
          await handleApiRequest(
            {
              method: request.method,
              url: request.url,
              body,
              headers: request.headers as Record<
                string,
                string | string[] | undefined
              >
            },
            {
              status(code: number) {
                statusCode = code;
                return this;
              },
              json(payload: unknown) {
                response.statusCode = statusCode;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(payload));
                return this;
              },
              setHeader(name: string, value: string) {
                response.setHeader(name, value);
              }
            }
          );
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  process.env.GEMINI_TTS_MODEL = env.GEMINI_TTS_MODEL || process.env.GEMINI_TTS_MODEL;
  process.env.GEMINI_TTS_VOICE = env.GEMINI_TTS_VOICE || process.env.GEMINI_TTS_VOICE;
  process.env.ADMIN_EMAIL = env.ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  return {
    plugins: [react(), tailwindcss(), localBackendApi()],
    optimizeDeps: {
      exclude: ['onnxruntime-web']
    },
    worker: {
      format: 'es'
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (
              id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/motion-') ||
              id.includes('node_modules/react-resizable-panels') ||
              id.includes('node_modules/sonner') ||
              id.includes('node_modules/canvas-confetti')
            ) {
              return 'vendor-ui';
            }
            if (id.includes('/src/data/curriculum/chapter')) {
              if (/\/chapter([1-5])(\/|\.)/.test(id)) {
                return 'curriculum-part1';
              }
              return 'curriculum-part2';
            }
            if (id.includes('/src/data/sprintExams') || id.includes('/src/data/finalExam')) {
              return 'curriculum-exams';
            }
          }
        }
      }
    },
    server: {
      port: 5173,
      open: true
    }
  };
});
