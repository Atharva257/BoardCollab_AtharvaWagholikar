const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.details
      ? Object.entries(data.details).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`).join('; ')
      : '';
    const err = new Error(detail || data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
