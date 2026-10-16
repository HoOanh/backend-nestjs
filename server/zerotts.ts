import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { isAuthenticatedApiRequest } from './index.ts';

const LOCAL_ZEROTTS_URL = 'http://127.0.0.1:4179';
const LOCAL_STARTUP_TIMEOUT_MS = 5 * 60 * 1000;
const SYNTHESIS_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TEXT_CHARACTERS = 6000;

let localProcess: ChildProcess | null = null;
let localStartup: Promise<void> | null = null;

export interface ZeroTtsResult {
  status: number;
  contentType: string;
  body: Uint8Array;
}

function jsonResult(status: number, error: string): ZeroTtsResult {
  return {
    status,
    contentType: 'application/json; charset=utf-8',
    body: new TextEncoder().encode(JSON.stringify({ error }))
  };
}

async function isLocalServiceReady(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCAL_ZEROTTS_URL}/health`, {
      signal: AbortSignal.timeout(1500)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForLocalService(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + LOCAL_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`ZeroTTS server stopped during startup (exit ${child.exitCode}).`);
    }
    if (await isLocalServiceReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('ZeroTTS khởi động quá lâu. Kiểm tra log backend để biết thêm chi tiết.');
}

async function startLocalService(): Promise<void> {
  if (await isLocalServiceReady()) return;
  if (localStartup) return localStartup;

  const root = process.cwd();
  const child = spawn(
    process.env.UV_EXECUTABLE || 'uv',
    [
      'run',
      '--no-project',
      '--python',
      '3.13',
      '--with-requirements',
      path.join(root, 'requirements-instructor-audio.txt'),
      'python',
      path.join(root, 'scripts/zerotts-server.py')
    ],
    {
      cwd: root,
      env: { ...process.env, ZEROTTS_HOST: '127.0.0.1', ZEROTTS_PORT: '4179' },
      stdio: 'inherit'
    }
  );
  localProcess = child;
  child.on('error', (error) => {
    console.error('Could not start the local ZeroTTS service:', error);
  });
  child.on('exit', () => {
    if (localProcess === child) localProcess = null;
    localStartup = null;
  });

  localStartup = waitForLocalService(child).finally(() => {
    if (localProcess !== child) localStartup = null;
  });
  return localStartup;
}

export async function warmLocalZeroTtsService(): Promise<void> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.ZEROTTS_URL || isServerless) return;
  await startLocalService();
}

export async function stopLocalZeroTtsService(): Promise<void> {
  if (!localProcess) return;
  const child = localProcess;
  localProcess = null;
  localStartup = null;
  child.kill('SIGTERM');
}

export async function synthesizeWithZeroTts(text: string): Promise<ZeroTtsResult> {
  const cleanedText = text.trim();
  if (!cleanedText) return jsonResult(400, 'Thiếu nội dung cần đọc.');
  if (cleanedText.length > MAX_TEXT_CHARACTERS) {
    return jsonResult(413, 'Đoạn đọc vượt quá giới hạn 6.000 ký tự.');
  }

  const configuredService = process.env.ZEROTTS_URL?.replace(/\/+$/, '');
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!configuredService && isServerless) {
    return jsonResult(
      503,
      'ZeroTTS chưa được nối với backend suy luận. Cấu hình ZEROTTS_URL trỏ tới dịch vụ ZeroTTS của ứng dụng.'
    );
  }

  const endpoint = configuredService
    ? `${configuredService}/synthesize`
    : `${LOCAL_ZEROTTS_URL}/synthesize`;

  try {
    if (!configuredService) await startLocalService();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ZEROTTS_API_KEY
          ? { 'X-ZeroTTS-Key': process.env.ZEROTTS_API_KEY }
          : {})
      },
      body: JSON.stringify({ text: cleanedText }),
      signal: AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS)
    });
    const body = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      body
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ZeroTTS request failed:', message);
    return jsonResult(
      503,
      `Không kết nối được ZeroTTS. ${message}`
    );
  }
}

export async function streamWithZeroTts(text: string): Promise<Response> {
  const cleanedText = text.trim();
  if (!cleanedText) {
    return new Response(JSON.stringify({ error: 'Thiếu nội dung cần đọc.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
  if (cleanedText.length > MAX_TEXT_CHARACTERS) {
    return new Response(JSON.stringify({ error: 'Đoạn đọc vượt quá giới hạn 6.000 ký tự.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const configuredService = process.env.ZEROTTS_URL?.replace(/\/+$/, '');
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!configuredService && isServerless) {
    return new Response(JSON.stringify({
      error: 'ZeroTTS chưa được nối với backend suy luận. Cấu hình ZEROTTS_URL.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  const endpoint = configuredService
    ? `${configuredService}/synthesize/stream`
    : `${LOCAL_ZEROTTS_URL}/synthesize/stream`;

  try {
    if (!configuredService) await startLocalService();
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ZEROTTS_API_KEY
          ? { 'X-ZeroTTS-Key': process.env.ZEROTTS_API_KEY }
          : {})
      },
      body: JSON.stringify({ text: cleanedText }),
      signal: AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS)
    });
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream'
    });
    const sampleRate = upstream.headers.get('x-audio-sample-rate');
    if (sampleRate) headers.set('X-Audio-Sample-Rate', sampleRate);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('ZeroTTS streaming request failed:', message);
    return new Response(JSON.stringify({ error: `Không kết nối được ZeroTTS. ${message}` }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

export function canUseZeroTts(headers: Record<string, string | string[] | undefined>): boolean {
  return isAuthenticatedApiRequest(headers);
}
