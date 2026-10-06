import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Адрес API: из EXPO_PUBLIC_API_URL, иначе — тот же компьютер, где запущен Metro (порт 4000).
// На телефоне в Expo Go hostUri выглядит как "192.168.1.5:8081", поэтому берём оттуда IP.
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  // "same-origin": веб-сборка в Docker, nginx проксирует /api на сервер
  if (fromEnv === "same-origin" && Platform.OS === "web") return window.location.origin;
  if (fromEnv && fromEnv !== "same-origin") return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "web") return `${window.location.protocol}//${window.location.hostname}:4000`;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:4000`;
}
export const API_URL = resolveApiUrl();

const TOKEN_KEY = "qadamix.driver.token";
export const tokenStore = {
  async get() {
    try {
      return Platform.OS === "web" ? localStorage.getItem(TOKEN_KEY) : await SecureStore.getItemAsync(TOKEN_KEY);
    } catch { return null; }
  },
  async set(token) {
    try {
      if (Platform.OS === "web") token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
      else if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      else await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch { /* хранилище недоступно — останемся без сохранённого входа */ }
  },
};

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let token = null;
let onUnauthorized = () => {};
export const setSession = (t, onExpired) => { token = t; if (onExpired) onUnauthorized = onExpired; };

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Нет связи с сервером (${API_URL}). Проверьте интернет`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data.error || `Ошибка ${res.status}`, data);
  return data;
}

export const qs = (params) => {
  const parts = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};
