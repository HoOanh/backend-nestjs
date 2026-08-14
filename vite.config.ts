import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tutorHandler from './api/tutor';
import { handleApiRequest } from './api/index';

function localBackendApi(): Plugin {
  return {
    name: 'local-backend-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url || '';
        if (!url.startsWith('/api/')) {
          next();
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
              response.end(JSON.stringify({ error: 'Request body không phải JSON hợp lệ.' }));
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
              { method: request.method, body, headers: request.headers as Record<string, string | string[] | undefined> },
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
            { method: request.method, url: request.url, body, headers: request.headers as Record<string, string | string[] | undefined> },
            {
              status(code: number) {
                statusCode = code;
                return this;
              },
              json(payload: any) {
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
  process.env.GEMINI_API_KEY ||= env.GEMINI_API_KEY;
  process.env.ADMIN_EMAIL ||= env.ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD ||= env.ADMIN_PASSWORD;

  return {
    plugins: [react(), localBackendApi()],
    server: {
      port: 5173,
      open: true
    }
  };
});
