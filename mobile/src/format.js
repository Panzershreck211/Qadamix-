export const money = (n) => (n == null ? "—" : `${Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ")} ₸`);

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function day(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === -1) return "вчера";
  return `${d} ${MONTHS[m - 1]}`;
}

export function dateTime(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ago(ts) {
  const min = Math.round((Date.now() - new Date(ts)) / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return dateTime(ts);
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}
export const tripsLabel = (n) => `${n} ${plural(n, "рейс", "рейса", "рейсов")}`;

// tone — ключ цвета темы: primary | success | warning | danger | info | neutral
export const STATUS = {
  open: { label: "Ищут машину", tone: "warning" },
  assigned: { label: "Вы назначены", tone: "primary" },
  loading: { label: "На загрузке", tone: "info" },
  in_transit: { label: "В пути", tone: "info" },
  delivered: { label: "Доставлен", tone: "success" },
  cancelled: { label: "Отменён", tone: "neutral" },
  note: { label: "Комментарий", tone: "neutral" },
};

export const OFFER_STATUS = {
  pending: { label: "Ждёт ответа логиста", tone: "warning" },
  accepted: { label: "Принят — вы везёте", tone: "success" },
  rejected: { label: "Выбрали другого", tone: "neutral" },
  withdrawn: { label: "Вы отозвали", tone: "neutral" },
};

export const scoreTone = (s) => (s >= 80 ? "success" : s >= 60 ? "warning" : "danger");
