export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && url.startsWith('/api/teacher/') && !url.endsWith('/session'))
      window.dispatchEvent(new Event('teacher-session-expired'));
    throw new ApiError(response.status, payload.message || '请求失败，请稍后重试');
  }
  return response.json() as Promise<T>;
}
function readTeacherKey() {
  if (!window.location.pathname.startsWith('/teacher')) return null;
  return new URLSearchParams(window.location.hash.slice(1)).get('key');
}
let session: Promise<unknown> | null = null;
let pendingKey: string | null = null;
export function openTeacherSession() {
  const key = readTeacherKey();
  if (session && pendingKey === key) return session;
  const request =
    key !== null
      ? api('/api/teacher/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
        })
      : api('/api/teacher/session');
  const attempt: Promise<unknown> = request
    .then((result) => {
      // A failed request must leave the original link usable for retry or reload.
      // Do not clear a newer link if it was opened while this request was in flight.
      if (key !== null && readTeacherKey() === key) {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        fragment.delete('key');
        const remaining = fragment.toString();
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + window.location.search + (remaining ? `#${remaining}` : ''),
        );
      }
      return result;
    })
    .finally(() => {
      // Deduplicate in-flight requests only. Failed and stale sessions can be checked again.
      if (session === attempt) {
        session = null;
        pendingKey = null;
      }
    });
  session = attempt;
  pendingKey = key;
  return attempt;
}
export async function closeTeacherSession() {
  await api('/api/teacher/session', { method: 'DELETE' });
  session = null;
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}
