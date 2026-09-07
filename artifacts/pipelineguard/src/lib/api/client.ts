import type { SourceMode } from '@/lib/types';
import { replayFetch } from '@/lib/replay/cassette';

/**
 * The browser talks to the FastAPI gateway, not to the old in-browser
 * analyzer. Set this to the deployed gateway URL in production; the local
 * default keeps the frontend and backend independently runnable.
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';
const USE_CLIENT_MOCK_FALLBACK = !import.meta.env.VITE_API_BASE;

export interface ApiResult<T> {
  data: T;
  /** Which source answered. Rendered in the status pill. */
  source: SourceMode;
  latencyMs: number;
  gateway: string;
  at: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The single fetch used by every screen.
 *
 * Live and replay take the same code path and return the same envelope. The
 * only difference is where the bytes came from -- and because the cassette
 * records the gateway's own deterministic latency, even the pacing matches.
 * There is no "replay mode" branch inside any component.
 */
export async function apiGet<T>(path: string, mode: SourceMode): Promise<ApiResult<T>> {
  const clean = path.replace(/^\//, '');

  if (mode === 'replay') {
    return replayFetch<T>(clean);
  }

  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${clean}`, { cache: 'no-store' });
  } catch (error) {
    // The imported app used a Next catch-all route for local fixtures. Vite
    // has no server route, so keep the same local-first experience by using
    // the bundled cassette only when the shared relative gateway is absent.
    if (USE_CLIENT_MOCK_FALLBACK) {
      const fallback = await replayFetch<T>(clean);
      return { ...fallback, source: 'live', gateway: 'client-mock' };
    }
    throw error;
  }
  const body = await readJson(res);
  if (USE_CLIENT_MOCK_FALLBACK && !res.headers.get('content-type')?.includes('application/json')) {
    const fallback = await replayFetch<T>(clean);
    return { ...fallback, source: 'live', gateway: 'client-mock' };
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      clean,
      errorMessage(body, `Gateway returned ${res.status} for /${clean}`),
      body,
    );
  }

  const data = body as T;
  return {
    data,
    source: 'live',
    latencyMs: Number(res.headers.get('x-pg-latency-ms')) || Math.round(performance.now() - started),
    gateway: res.headers.get('x-pg-gateway') ?? 'unknown',
    at: Date.now(),
  };
}

/** The one write-capable browser boundary. It never logs or persists bodies. */
export async function apiPost<T>(
  path: string,
  body: unknown,
): Promise<ApiResult<T>> {
  const clean = path.replace(/^\//, '');
  const started = performance.now();
  const res = await fetch(`${API_BASE}/${clean}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const responseBody = await readJson(res);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      clean,
      errorMessage(responseBody, `Gateway returned ${res.status} for /${clean}`),
      responseBody,
    );
  }

  return {
    data: responseBody as T,
    source: 'live',
    latencyMs: Number(res.headers.get('x-pg-latency-ms')) || Math.round(performance.now() - started),
    gateway: res.headers.get('x-pg-gateway') ?? 'unknown',
    at: Date.now(),
  };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const value = body as { message?: unknown; detail?: unknown; error?: unknown };
  if (typeof value.message === 'string' && value.message.trim()) return value.message;
  if (typeof value.error === 'string' && value.error.trim()) return value.error;
  if (typeof value.detail === 'string' && value.detail.trim()) return value.detail;
  if (value.detail && typeof value.detail === 'object') {
    const detail = value.detail as { message?: unknown; error?: unknown };
    if (typeof detail.message === 'string' && detail.message.trim()) return detail.message;
    if (typeof detail.error === 'string' && detail.error.trim()) return detail.error;
  }
  return fallback;
}
