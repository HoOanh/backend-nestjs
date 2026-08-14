import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tutorHandler from './api/tutor';

function localTutorApi(): Plugin {
  return {
    name: 'local-tutor-api',
    configureServer(server) {
      server.middlewares.use('/api/tutor', (request, response, next) => {
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
            body = rawBody ? JSON.parse(rawBody) as unknown : {};
          } catch {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Request body không phải JSON hợp lệ.' }));
            return;
          }

          let statusCode = 200;
          await tutorHandler(
            { method: request.method, body },
            {
              status(code: number) {
                statusCode = code;
                return this;
              },
              json(payload: { error?: string; reply?: string }) {
                response.statusCode = statusCode;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(payload));
                return this;
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

  return {
    plugins: [react(), localTutorApi()],
    server: {
      port: 5173,
      open: true
    }
  };
});
