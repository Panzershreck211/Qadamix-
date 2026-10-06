// GPS-трекинг водителя.
// • Собственная сборка (EAS / expo run): фоновая передача через TaskManager + уведомление «рейс в пути» на Android.
// • Expo Go и браузер: фоновые службы недоступны — передаём, пока приложение открыто (watchPositionAsync).
// Точки сначала кладутся в очередь на телефоне и отправляются пачками — без связи ничего не теряется.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, tokenStore } from "./api.js";

export const GPS_TASK = "qadamix-gps";
const QUEUE_KEY = "qadamix.gps.queue";
const MAX_QUEUE = 5000;   // ~2 суток точек раз в 30 с
const BATCH = 200;
const OPTIONS = { accuracy: Location.Accuracy.High, timeInterval: 30000, distanceInterval: 150 };

// ---------- Состояние для интерфейса ----------
let state = { mode: "off", lastPoint: null, lastSentAt: null, nearestCity: null, queued: 0, error: null };
const listeners = new Set();
const setState = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); };

export function useGps() {
  const [s, set] = useState(state);
  useEffect(() => { listeners.add(set); return () => listeners.delete(set); }, []);
  return s;
}

// ---------- Очередь точек ----------
const toPoint = (loc) => ({
  lat: loc.coords.latitude,
  lon: loc.coords.longitude,
  speed: loc.coords.speed != null && loc.coords.speed >= 0 ? Math.round(loc.coords.speed * 3.6) : null, // м/с → км/ч
  heading: loc.coords.heading != null && loc.coords.heading >= 0 ? Math.round(loc.coords.heading) : null,
  accuracy: loc.coords.accuracy != null ? Math.round(loc.coords.accuracy) : null,
  recordedAt: new Date(loc.timestamp).toISOString(),
});

async function readQueue() {
  try { return JSON.parse(await AsyncStorage.getItem(QUEUE_KEY)) ?? []; } catch { return []; }
}
async function writeQueue(q) {
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch { /* память переполнена — потеряем самые старые точки */ }
}

async function authFetch(path, method, body) {
  const token = await tokenStore.get();
  if (!token) throw new Error("not signed in");
  return fetch(`${API_URL}/api${path}`, {
    method, body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
}

export async function enqueue(locations) {
  const q = await readQueue();
  q.push(...locations.map(toPoint));
  await writeQueue(q);
  setState({ lastPoint: q.at(-1), queued: q.length });
  await flush();
}

let flushing = false;
export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    let q = await readQueue();
    while (q.length) {
      const batch = q.slice(0, BATCH);
      const res = await authFetch("/me/positions", "POST", { points: batch });
      if (res.status === 400) { q = q.slice(batch.length); await writeQueue(q); continue; } // битая пачка — не держим её вечно
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      q = q.slice(batch.length);
      await writeQueue(q);
      const data = await res.json();
      setState({ lastSentAt: new Date().toISOString(), nearestCity: data.nearestCity, error: null });
    }
    setState({ queued: 0 });
  } catch {
    setState({ error: "Нет связи — точки сохранены и отправятся автоматически", queued: (await readQueue()).length });
  } finally {
    flushing = false;
  }
}

// Фоновая задача должна быть объявлена при загрузке модуля (до монтирования React)
if (Platform.OS !== "web") {
  TaskManager.defineTask(GPS_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    await enqueue(data.locations);
  });
}

async function reportEnabled(enabled) {
  try { await authFetch("/me/gps", "PATCH", { enabled }); } catch { /* не критично */ }
}

let watcher = null;

export async function startTracking() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    setState({ error: Platform.OS === "web"
      ? "Браузер не дал доступ к геолокации. Разрешите его в настройках сайта (значок замка в адресной строке)"
      : "Нет доступа к геолокации. Разрешите его в настройках телефона" });
    return;
  }
  // Первая точка сразу, не дожидаясь интервала
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((l) => enqueue([l])).catch(() => {});

  if (Platform.OS !== "web") {
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === "granted") {
        await Location.startLocationUpdatesAsync(GPS_TASK, {
          ...OPTIONS,
          activityType: Location.ActivityType.AutomotiveNavigation,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: { notificationTitle: "QADAMIX: рейс в пути", notificationBody: "Заказчик видит машину на карте", notificationColor: "#2F6FD6" },
        });
        setState({ mode: "background", error: null });
        await reportEnabled(true);
        return;
      }
    } catch {
      // Expo Go: фоновые службы недоступны — работаем, пока приложение открыто
    }
  }
  watcher?.remove();
  watcher = await Location.watchPositionAsync(OPTIONS, (loc) => enqueue([loc]), (err) => setState({ error: String(err) }));
  setState({ mode: "foreground", error: null });
  await reportEnabled(true);
}

export async function stopTracking() {
  watcher?.remove();
  watcher = null;
  if (Platform.OS !== "web") {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK)) await Location.stopLocationUpdatesAsync(GPS_TASK);
    } catch { /* задача не запускалась */ }
  }
  setState({ mode: "off" });
  await reportEnabled(false);
  await flush(); // дослать то, что осталось в очереди
}

/** При запуске приложения: узнать, не работает ли уже фоновая задача, и дослать очередь. */
export async function syncTracking() {
  if (Platform.OS !== "web") {
    try { if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK)) setState({ mode: "background" }); } catch { /* Expo Go */ }
  }
  setState({ queued: (await readQueue()).length });
  flush();
}
