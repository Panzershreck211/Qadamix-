const TOKEN_KEY = "qadamix.token";

export const tokenStore = {
  get() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* приватный режим */ } },
};

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = "GET", body, signal } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError(0, "Нет связи с сервером. Проверьте, что API запущен");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data.error || `Ошибка ${res.status}`, data);
  return data;
}

export const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};
