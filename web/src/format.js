export const money = (n) => (n == null ? "—" : `${Math.round(n).toLocaleString("ru-RU")} ₸`);
export const num = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString("ru-RU", { maximumFractionDigits: d }));

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

/** "2026-10-07" → "7 октября" (+ «сегодня/завтра») */
export function day(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  return `${d} ${MONTHS_FULL[m - 1]}${y !== today.getFullYear() ? ` ${y}` : ""}`;
}

export function dateTime(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ago(ts) {
  const min = Math.round((Date.now() - new Date(ts)) / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  return d === 1 ? "вчера" : `${d} дн назад`;
}

export const monthLabel = (ym) => MONTHS_NOM[Number(ym.slice(5, 7)) - 1].slice(0, 3);

export const STATUS = {
  open: { label: "Ищем машину", cls: "b-warning" },
  assigned: { label: "Машина назначена", cls: "b-primary" },
  loading: { label: "На загрузке", cls: "b-info" },
  in_transit: { label: "В пути", cls: "b-info" },
  delivered: { label: "Доставлен", cls: "b-success" },
  cancelled: { label: "Отменён", cls: "b-neutral" },
  note: { label: "Комментарий", cls: "b-neutral" },
};

export const VERIFY = {
  verified: { label: "Проверен", cls: "b-success" },
  pending: { label: "На проверке", cls: "b-warning" },
  rejected: { label: "Отклонён", cls: "b-danger" },
  none: { label: "Не проверен", cls: "b-danger" },
};

export const DRIVER_STATUS = {
  free: { label: "Свободен", cls: "b-success" },
  busy: { label: "В рейсе", cls: "b-info" },
  offline: { label: "Не на линии", cls: "b-neutral" },
};

export const initials = (name = "") => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}

export const scoreClass = (s) => (s >= 80 ? "b-success" : s >= 60 ? "b-warning" : "b-danger");

export const tripsLabel = (n) => `${n} ${plural(n, "рейс", "рейса", "рейсов")}`;
export const reviewsLabel = (n) => `${n} ${plural(n, "отзыв", "отзыва", "отзывов")}`;
