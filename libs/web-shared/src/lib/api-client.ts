// Thin typed fetch wrapper for the pickleball API. Holds the JWT in
// localStorage and attaches it as a Bearer token on every request.

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

// Shipped "web key" that unlocks the guest + calendar-read endpoints
// (PublicKeyGuard on the API). Inlined into the bundle at build time, so it's a
// bar against casual/direct access, not a secret. Empty in dev — the API's gate
// is off until WEB_PUBLIC_API_KEY is set there too.
const WEB_KEY = process.env.NEXT_PUBLIC_WEB_KEY ?? '';

const TOKEN_KEY = 'pp_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (WEB_KEY) headers['X-Web-Key'] = WEB_KEY;
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = Array.isArray(data?.message)
        ? data.message.join(', ')
        : (data?.message ?? message);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const api = {
  get: <T>(path: string) => req<T>('GET', path),
  post: <T>(path: string, body?: unknown) => req<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('PATCH', path, body),
  del: <T>(path: string) => req<T>('DELETE', path),
};
