export function apiHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const token = localStorage.getItem('mirai_access_token');
  if (token) h.Authorization = `Bearer ${token}`;
  /** Do not send `X-Tenant-Id` here. With `ALLOW_X_TENANT_ID`, the API would override the JWT `tid`
   *  with a stale `mirai_tenant_id` from localStorage (e.g. after using another workspace), hiding projects/boards. */
  return h;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const base = apiHeaders() as Record<string, string>;
  for (const [k, v] of Object.entries(base)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  const res = await fetch(`/api${path}`, { ...init, headers });
  
  // Automatically redirect to login and clear credentials on 401 Unauthorized
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    localStorage.removeItem('mirai_access_token');
    localStorage.removeItem('mirai_tenant_id');
    localStorage.removeItem('mirai_refresh_token');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
      window.location.href = '/login?expired=true';
    }
  }
  
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error ?? res.statusText);
    const code = (body as { code?: string }).code;
    if (code) (err as Error & { code?: string }).code = code;
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return body as T;
}
