// ─────────────────────────────────────────
// API клиент — обёртка над fetch
// Автоматически добавляет JWT и рефрешит токен
// ─────────────────────────────────────────

const BASE = '/api/v1';

// Safe storage — localStorage недоступен в Telegram Mini App на iOS (Safari ITP)
const ss = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch {} },
  del: (k: string): void => { try { localStorage.removeItem(k); } catch {} },
};

let accessToken: string | null = ss.get('accessToken');
let refreshToken: string | null = ss.get('refreshToken');

export const setTokens = (at: string, rt: string) => {
  accessToken = at;
  refreshToken = rt;
  ss.set('accessToken', at);
  ss.set('refreshToken', rt);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  ss.del('accessToken');
  ss.del('refreshToken');
};

export const getAccessToken = () => accessToken;

async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { clearTokens(); return false; }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const ok = await doRefresh();
    if (ok) return apiFetch<T>(path, options, false);
    // Рефреш не удался — кидаем юзера на логин
    clearTokens();
    window.location.reload();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Shortcuts ──
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, form: FormData) => {
    // For multipart, don't set Content-Type (browser sets it with boundary)
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return fetch(`${BASE}${path}`, { method: 'POST', headers, body: form })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<T>;
      });
  },
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
