import { handleApiRequest } from './router.ts';

interface VercelRequest {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  statusCode?: number;
  status(code: number): VercelResponse;
  json(data: unknown): VercelResponse;
  setHeader?(name: string, value: string): void;
  end(data?: string): void;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let statusCode = 200;
  const resAdapter = {
    status(code: number) {
      statusCode = code;
      if (typeof res.status === 'function') {
        res.status(code);
      } else {
        res.statusCode = code;
      }
      return this;
    },
    json(data: unknown) {
      if (typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(statusCode).json(data);
      }
      res.statusCode = statusCode;
      res.end(JSON.stringify(data));
      return this;
    },
    setHeader(name: string, value: string) {
      if (typeof res.setHeader === 'function') {
        res.setHeader(name, value);
      }
      return this;
    }
  };

  const rawUrl = req.url || '';
  const normalizedUrl = rawUrl.startsWith('/api') ? rawUrl : '/api' + rawUrl;

  await handleApiRequest(
    {
      method: req.method,
      url: normalizedUrl,
      body: req.body,
      headers: req.headers
    },
    resAdapter
  );
}
