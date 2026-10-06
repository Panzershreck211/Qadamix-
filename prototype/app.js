/* QADAMIX — кабинет логиста (демо). Чистый JS, без сборки. */
(() => {
  "use strict";

  // ---------- Иконки (Lucide, MIT) ----------
  const ICONS = {
    bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  };
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  // ---------- Утилиты ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${Number(n).toLocaleString("ru-RU").replace(/,/g, " ")} ₸`;
  const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const fmtDate = (iso) => { const d = new Date(iso + "T00:00:00"); return isNaN(d) ? iso : `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
  const fmtDateNum = (iso) => { const d = new Date(iso + "T00:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("ru-RU"); };
  const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many; };

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem("qadamix:" + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem("qadamix:" + key, JSON.stringify(value)); } catch { /* приватный режим — работаем без сохранения */ } },
  };

  // ---------- Справочники ----------
  // Координаты городов на схематичной карте (viewBox 800×420)
  const CITIES = {
    "Астана": [472, 147.5], "Алматы": [573.5, 320.8], "Шымкент": [438.8, 340.5], "Караганда": [503.4, 176],
    "Актобе": [209.8, 165], "Атырау": [112, 235.2], "Костанай": [328, 101.4], "Кокшетау": [435.1, 99.2],
    "Павлодар": [573.5, 121.2], "Усть-Каменогорск": [678.8, 173.8], "Тараз": [472, 327.4], "Актау": [99.1, 312],
    "Семей": [636.3, 162.8], "Туркестан": [414.8, 318.6], "Кызылорда": [363.1, 285.7], "Хоргос": [638.2, 298.8],
  };
  const KM_PER_UNIT = 6.6;
  const distKm = (a, b) => {
    const p = CITIES[a], q = CITIES[b];
    if (!p || !q) return null;
    return Math.round((Math.hypot(p[0] - q[0], p[1] - q[1]) * KM_PER_UNIT) / 10) * 10;
  };
  const BODY_TYPES = ["Тент", "Борт", "Рефрижератор", "Изотерм", "Самосвал", "Низкорамный трал"];
  const STATUS_COLOR = { "Новый": "var(--muted-foreground)", "В пути": "var(--info)", "Загружена": "var(--success)", "Завершено": "var(--muted-foreground)" };
  const VERIFY = {
    ok: { text: "🟢 Проверен", cls: "badge-success" },
    pending: { text: "🟡 На проверке", cls: "badge-warning" },
    bad: { text: "🔴 Не подтверждён", cls: "badge-danger" },
  };

  // ---------- Демо-данные ----------
  const SEED_CARGOS = [
    { id: "K-1042", from: "Астана", to: "Алматы", fromCity: "Астана", toCity: "Алматы", date: "2026-08-12", weight: 20, body: "Тент", km: 1200, price: 295000, status: "Новый", kind: "Стройматериалы" },
    { id: "K-1041", from: "Караганда", to: "Шымкент", fromCity: "Караганда", toCity: "Шымкент", date: "2026-08-12", weight: 18, body: "Борт", km: 1450, price: 340000, status: "В пути", kind: "стройматериалы",
      trip: { via: ["Кызылорда"], at: "Кызылорда", eta: "15 августа, 11:00" } },
    { id: "K-1039", from: "Алматы", to: "Актобе", fromCity: "Алматы", toCity: "Актобе", date: "2026-08-10", weight: 12, body: "Тент", km: 1900, price: 520000, status: "Загружена", kind: "оборудование",
      trip: { via: ["Шымкент", "Кызылорда"], at: "Алматы", eta: "14 августа, 18:00" } },
    { id: "K-1035", from: "Хоргос (Китай → КЗ)", to: "Астана", fromCity: "Хоргос", toCity: "Астана", date: "2026-08-09", weight: 20, body: "Тент", km: 1600, price: 610000, status: "Завершено", kind: "товары народного потребления" },
    { id: "K-1030", from: "Атырау", to: "Актау", fromCity: "Атырау", toCity: "Актау", date: "2026-08-13", weight: 22, body: "Борт", km: 850, price: 260000, status: "Новый", kind: "трубы" },
    { id: "K-1028", from: "Костанай", to: "Астана", fromCity: "Костанай", toCity: "Астана", date: "2026-08-12", weight: 25, body: "Самосвал", km: 690, price: 230000, status: "Новый", kind: "зерно" },
  ];

  const CARRIERS = [
    { id: 1, initials: "ИП", name: "Иван Петров", rating: 4.9, trips: 118, reviews: 24, model: "MAN TGX", type: "Тягач с полуприцепом", body: "Тент", capacity: 20, city: "Астана", location: "Астана, Промзона", yard: 42, rate: 295000, verify: "ok", busy: false, directions: "Казахстан, Казахстан → Россия", phone: "+7 701 000 11 18" },
    { id: 2, initials: "ДК", name: "Дмитрий Ким", rating: 4.7, trips: 74, reviews: 19, model: "Volvo FH", type: "Тягач с полуприцепом", body: "Тент", capacity: 22, city: "Караганда", location: "Караганда", yard: 12, rate: 288000, verify: "ok", busy: false, directions: "Казахстан", phone: "+7 702 000 22 74" },
    { id: 3, initials: "ТБ", name: "Тимур Байжанов", rating: 5.0, trips: 64, reviews: 31, model: "Kenworth", type: "Тягач с тралом", body: "Низкорамный трал", capacity: 40, city: "Астана", location: "Астана", yard: 25, rate: 480000, verify: "ok", busy: false, directions: "Казахстан, Казахстан → Узбекистан", phone: "+7 705 000 33 64" },
    { id: 4, initials: "АЖ", name: "Айдос Жумабек", rating: 4.8, trips: 88, reviews: 22, model: "Renault Magnum", type: "Тягач с полуприцепом", body: "Тент", capacity: 20, city: "Павлодар", location: "Павлодар", yard: 15, rate: 292000, verify: "ok", busy: false, directions: "Казахстан", phone: "+7 707 000 44 88" },
    { id: 5, initials: "ЕА", name: "Ерлан Ахметов", rating: 4.8, trips: 96, reviews: 27, model: "Scania R500", type: "Тягач с полуприцепом", body: "Рефрижератор", capacity: 20, city: "Астана", location: "Астана, ЛОГИ-парк", yard: 68, rate: 310000, verify: "ok", busy: false, directions: "Казахстан, Казахстан → Китай", phone: "+7 708 000 55 96" },
    { id: 6, initials: "СО", name: "Санжар Оспанов", rating: 4.9, trips: 162, reviews: 41, model: "Mercedes Actros", type: "Тягач с полуприцепом", body: "Тент", capacity: 20, city: "Шымкент", location: "Шымкент", yard: 10, rate: 305000, verify: "ok", busy: true, directions: "Казахстан, Казахстан → Узбекистан", phone: "+7 747 000 66 62" },
    { id: 7, initials: "МС", name: "Марат Сейтжанов", rating: 4.4, trips: 33, reviews: 8, model: "DAF XF", type: "Тягач с полуприцепом", body: "Борт", capacity: 20, city: "Актобе", location: "Актобе", yard: 20, rate: 265000, verify: "bad", busy: false, directions: "Казахстан", phone: "+7 775 000 77 33" },
    { id: 8, initials: "АН", name: "Асхат Нурланов", rating: 4.6, trips: 51, reviews: 12, model: "Isuzu Forward", type: "Грузовик", body: "Изотерм", capacity: 10, city: "Алматы", location: "Алматы, Кульджинский тракт", yard: 30, rate: 210000, verify: "pending", busy: false, directions: "Казахстан", phone: "+7 776 000 88 51" },
  ];

  const SEED_DOCS = [
    { id: "d1042", title: "Договор-заявка №1042", cargo: "K-1042", route: "Астана → Алматы", date: "2026-08-11", type: "Договор-заявка", status: "Черновик" },
    { id: "d1041", title: "ТТН №1041", cargo: "K-1041", route: "Караганда → Шымкент", date: "2026-08-11", type: "ТТН", status: "Подписан" },
    { id: "d1039", title: "Счёт на оплату №1039", cargo: "K-1039", route: "Алматы → Актобе", date: "2026-08-10", type: "Счёт", status: "Отправлен" },
    { id: "d1035", title: "CMR №1035", cargo: "K-1035", route: "Хоргос → Астана", date: "2026-08-09", type: "CMR", status: "Подписан" },
  ];

  const SEED_NOTIFS = [
    { id: "n1", title: "AI нашёл 8 перевозчиков", time: "5 мин назад", body: "По грузу K-1042 Астана → Алматы подобраны подходящие машины.", read: false, tab: "carriers" },
    { id: "n2", title: "Водитель принял заявку", time: "1 ч назад", body: "Иван Петров подтвердил рейс K-1039.", read: false, tab: "tracking" },
    { id: "n3", title: "Найден обратный груз", time: "3 ч назад", body: "Актобе → Астана, 18 т, 240 000 ₸.", read: false, tab: "cargo" },
    { id: "n4", title: "Документы готовы", time: "Вчера", body: "Пакет документов по рейсу K-1041 сформирован.", read: true, tab: "docs" },
  ];

  const CHART_MONTHS = ["Мар", "Апр", "Май", "Июн", "Июл", "Авг"];
  const TRIPS_BY_MONTH = [42, 55, 61, 74, 88, 96];
  const ROUTES = [
    { label: "Астана → Алматы", value: 34 },
    { label: "Караганда → Шымкент", value: 21 },
    { label: "Алматы → Актобе", value: 18 },
    { label: "Хоргос → Астана", value: 15 },
    { label: "Атырау → Актау", value: 12 },
  ];
  const EXPENSES = [22.4, 23.8, 25.1, 26.9, 28.6, 30.0]; // млн ₸
  const EMPTY_RUN = [18, 16, 14, 12, 10, 9]; // %

  // ---------- Состояние ----------
  const state = {
    tab: store.get("tab", "home"),
    cargos: store.get("cargos", SEED_CARGOS),
    docs: store.get("docs", SEED_DOCS),
    notifs: store.get("notifs", SEED_NOTIFS),
    chats: store.get("chats", {}),
    matchFor: "K-1042",
    showMatch: false,
    showForm: false,
    trackId: null,
  };
  const save = () => { store.set("cargos", state.cargos); store.set("docs", state.docs); store.set("notifs", state.notifs); store.set("chats", state.chats); };
  const cargoById = (id) => state.cargos.find((c) => c.id === id);

  // ---------- AI-скоринг перевозчика ----------
  function scoreCarrier(car, cargo) {
    let s = 98;
    if (cargo) {
      if (car.body !== cargo.body) s -= (["Тент", "Борт"].includes(car.body) && ["Тент", "Борт"].includes(cargo.body)) ? 12 : 22;
      if (car.capacity < cargo.weight) s -= 35;
      const d = distKm(car.city, cargo.fromCity) ?? 300;
      s -= Math.min(20, Math.round(d / 50));
    }
    if (car.verify === "bad") s -= 18;
    if (car.verify === "pending") s -= 10;
    if (car.busy) s -= 4;
    return Math.max(5, Math.min(99, s));
  }
  const pickupKm = (car, cargo) => (cargo ? (distKm(car.city, cargo.fromCity) ?? 0) : 0) + car.yard;
  const rankCarriers = (cargo) => CARRIERS.map((c) => ({ ...c, match: scoreCarrier(c, cargo), pickup: pickupKm(c, cargo) }))
    .sort((a, b) => b.match - a.match || a.pickup - b.pickup);

  // ---------- Toast & Dialog ----------
  function toast(text) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    $("#toaster").appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  let lastFocus = null;
  function openDialog(html, onMount) {
    lastFocus = document.activeElement;
    const root = $("#dialog-root");
    root.innerHTML = `<div class="overlay" data-close><div class="dialog" role="dialog" aria-modal="true">${html}
      <button class="dialog-close" type="button" data-close aria-label="Закрыть">${icon("x")}</button></div></div>`;
    const dlg = $(".dialog", root);
    root.onclick = (e) => { if (e.target.hasAttribute("data-close") || e.target.closest(".dialog-close")) closeDialog(); };
    onMount?.(dlg);
    (dlg.querySelector("input, textarea, button:not(.dialog-close)") || dlg).focus();
  }
  function closeDialog() { $("#dialog-root").innerHTML = ""; lastFocus?.focus?.(); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#dialog-root").innerHTML) closeDialog(); });

  // ---------- Графики (SVG) ----------
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p / 2) * p * 2 || 1; }

  function lineChart(el, { labels, series, max, area = false, unit = "" }) {
    const W = Math.max(280, el.clientWidth), H = el.clientHeight || 240;
    const pad = { l: 36, r: 12, t: 10, b: 26 };
    const top = max ?? niceMax(Math.max(...series.flatMap((s) => s.data)));
    const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (labels.length - 1);
    const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
    let g = "";
    for (let k = 0; k <= 4; k++) {
      const v = (top / 4) * k;
      g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-dasharray="3 3"/>`;
      g += `<text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(1)}</text>`;
    }
    labels.forEach((l, i) => { g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${l}</text>`; });
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => [x(i), y(v)]);
      const d = smoothPath(pts);
      if (area && si === 0) {
        g += `<defs><linearGradient id="ag${si}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity=".22"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
        g += `<path d="${d} L ${pts.at(-1)[0]} ${y(0)} L ${pts[0][0]} ${y(0)} Z" fill="url(#ag${si})"/>`;
      }
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round"/>`;
      pts.forEach(([px, py], i) => {
        g += `<circle cx="${px}" cy="${py}" r="3.5" fill="var(--card)" stroke="${s.color}" stroke-width="2"><title>${labels[i]}: ${s.data[i]}${s.unit ?? unit} — ${s.name}</title></circle>`;
      });
    });
    el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(", "))}">${g}</svg>`;
  }

  function smoothPath(pts) {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  }

  function barChartH(el, items, color) {
    const W = Math.max(280, el.clientWidth), H = el.clientHeight || 240;
    const labelW = Math.min(170, W * 0.42), padR = 34;
    const max = Math.max(...items.map((i) => i.value));
    const rowH = H / items.length, barH = Math.min(22, rowH * 0.55);
    let g = "";
    items.forEach((it, i) => {
      const cy = rowH * i + rowH / 2;
      const w = ((W - labelW - padR) * it.value) / max;
      g += `<text x="0" y="${cy + 4}" style="fill:var(--foreground)">${esc(it.label)}</text>`;
      g += `<rect x="${labelW}" y="${cy - barH / 2}" width="${W - labelW - padR}" height="${barH}" rx="6" fill="var(--secondary)"/>`;
      g += `<rect x="${labelW}" y="${cy - barH / 2}" width="${w}" height="${barH}" rx="6" fill="${color}"><title>${esc(it.label)}: ${it.value} рейсов</title></rect>`;
      g += `<text x="${labelW + w + 6}" y="${cy + 4}">${it.value}</text>`;
    });
    el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="Рейсы по направлениям">${g}</svg>`;
  }

  // ---------- Вкладки ----------
  const VIEWS = {
    home() {
      const c = state.cargos;
      const free = CARRIERS.filter((x) => !x.busy && x.verify !== "bad").length;
      const stats = [
        ["Активные грузы", c.filter((x) => x.status === "Новый").length],
        ["Активные рейсы", c.filter((x) => x.status === "В пути" || x.status === "Загружена").length],
        ["Свободные машины", free],
        ["В пути", c.filter((x) => x.status === "В пути").length],
        ["Завершено", c.filter((x) => x.status === "Завершено").length],
        ["Экономия времени", "12 ч"],
      ];
      return {
        html: `
          <div class="grid stats">${stats.map(([k, v]) => `<div class="card stat"><div class="stat-label">${k}</div><div class="stat-value">${v}</div></div>`).join("")}</div>
          <div class="grid charts">
            <div class="card card-lg"><h2 class="card-title">Количество рейсов</h2><div class="chart" id="ch-trips"></div></div>
            <div class="card card-lg"><h2 class="card-title">Направления</h2><div class="chart" id="ch-routes"></div></div>
          </div>`,
        charts() {
          lineChart($("#ch-trips"), { labels: CHART_MONTHS, series: [{ name: "Рейсы", data: TRIPS_BY_MONTH, color: "var(--chart-1)" }], max: 100, area: true });
          barChartH($("#ch-routes"), ROUTES, "var(--chart-2)");
        },
      };
    },

    cargo() {
      const form = state.showForm ? cargoFormHtml() : "";
      const list = state.cargos.map((c) => `
        <article class="card cargo card-hover ${state.showMatch && state.matchFor === c.id ? "selected" : ""}">
          <div class="cargo-top"><span>${esc(c.id)}</span><span class="status" style="--dot:${STATUS_COLOR[c.status]}">${esc(c.status)}</span></div>
          <div class="cargo-route">${esc(c.from)} → ${esc(c.to)}</div>
          <div class="cargo-meta">${fmtDate(c.date)} · ${c.weight} т · ${esc(c.body)} · ${c.km ? c.km + " км" : "— км"}</div>
          <div class="cargo-price">${money(c.price)}</div>
          <button class="btn btn-outline btn-sm btn-pill" data-action="match" data-id="${esc(c.id)}">${icon("bot")} AI-подбор перевозчика</button>
        </article>`).join("");
      let match = "";
      if (state.showMatch) {
        const cargo = cargoById(state.matchFor);
        const ranked = rankCarriers(cargo);
        match = `<div class="match-head" id="match">${icon("sparkles")} AI подобрал ${ranked.length} ${plural(ranked.length, "подходящего перевозчика", "подходящих перевозчика", "подходящих перевозчиков")} для ${esc(cargo.id)}</div>
          <div class="grid cols-3">${ranked.map((r) => carrierCard(r)).join("")}</div>`;
      }
      return {
        html: `
          <div class="section-head"><h2 class="section-title">Мои грузы</h2>
            <button class="btn btn-primary btn-pill" data-action="toggle-form" aria-expanded="${state.showForm}">${icon(state.showForm ? "x" : "plus")} ${state.showForm ? "Скрыть форму" : "Добавить груз"}</button></div>
          ${form}
          <div class="grid cols-3">${list}</div>
          ${match}`,
      };
    },

    carriers() {
      const cargo = cargoById(state.matchFor);
      const ranked = rankCarriers(cargo);
      const options = state.cargos.filter((c) => c.status !== "Завершено")
        .map((c) => `<option value="${esc(c.id)}" ${c.id === state.matchFor ? "selected" : ""}>${esc(c.id)} · ${esc(c.from)} → ${esc(c.to)}</option>`).join("");
      return {
        html: `
          <div class="section-head"><h2 class="section-title">Перевозчики</h2>
            <label class="muted" style="display:flex;align-items:center;gap:.5rem">AI match для
              <select class="input" style="width:auto" data-action="match-select">${options}</select></label></div>
          <div class="grid cols-3">${ranked.map((r) => carrierCard(r)).join("")}</div>`,
      };
    },

    docs() {
      return {
        html: `<div class="list">${state.docs.map((d) => {
          const signed = d.status === "Подписан";
          return `<div class="card doc">
            <div><div class="doc-title">${esc(d.title)}</div><div class="doc-meta">${esc(d.route)} · ${fmtDateNum(d.date)} · ${esc(d.type)}</div></div>
            <div class="doc-actions">
              <span class="badge ${signed ? "badge-success" : "badge-secondary"}">${esc(d.status)}</span>
              <button class="btn btn-outline btn-sm" data-action="doc-view" data-id="${d.id}">${icon("eye")} Просмотреть</button>
              <button class="btn btn-outline btn-sm" data-action="doc-download" data-id="${d.id}">${icon("download")} Скачать</button>
              <button class="btn btn-primary btn-sm" data-action="doc-sign" data-id="${d.id}" ${signed ? "disabled" : ""}>${icon("pen")} ${signed ? "Подписано" : "Подписать"}</button>
            </div></div>`;
        }).join("")}</div>`,
      };
    },

    tracking() {
      const trips = state.cargos.filter((c) => c.trip && (c.status === "В пути" || c.status === "Загружена"));
      if (!trips.length) return { html: `<div class="card empty">Нет активных рейсов</div>` };
      const cur = trips.find((t) => t.id === state.trackId) || trips[0];
      state.trackId = cur.id;
      const t = cur.trip;
      const route = [cur.fromCity, ...(t.via || []), cur.toCity].filter((n) => CITIES[n]);
      const pts = route.map((n) => CITIES[n]);
      const [tx, ty] = CITIES[t.at] || pts[0];
      const cities = Object.entries(CITIES).map(([n, [x, y]]) =>
        `<g opacity="${route.includes(n) ? 0.9 : 0.55}"><circle cx="${x}" cy="${y}" r="3" fill="var(--muted-foreground)"/><text x="${x + 6}" y="${y + 3}" font-size="11" fill="var(--muted-foreground)">${n}</text></g>`).join("");
      const statusEmoji = cur.status === "В пути" ? "🔵" : "🟢";
      return {
        html: `
        <div class="card card-lg">
          <div class="section-head" style="margin:0">
            <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap"><h2 class="section-title">Отслеживание рейса ${esc(cur.id)}</h2><span class="badge badge-secondary">Демо-режим без GPS</span></div>
            ${trips.length > 1 ? `<div class="trip-switch">${trips.map((x) => `<button class="btn btn-outline btn-sm btn-pill" data-action="track" data-id="${esc(x.id)}" aria-pressed="${x.id === cur.id}">${esc(x.id)}</button>`).join("")}</div>` : ""}
          </div>
          <div class="map">
            <svg viewBox="0 0 800 420" role="img" aria-label="Карта маршрута ${esc(cur.fromCity)} — ${esc(cur.toCity)}">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" stroke-width="1" opacity=".6"/></pattern>
              </defs>
              <rect width="800" height="420" fill="url(#grid)"/>
              ${cities}
              <path d="${smoothPath(pts)}" fill="none" stroke="var(--primary)" stroke-opacity=".75" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 8"/>
              <circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="7" fill="var(--primary)"/>
              <circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="7" fill="var(--success)"/>
              <g class="truck" transform="translate(${tx} ${ty})">
                <circle r="16" fill="var(--primary)" opacity=".18"><animate attributeName="r" values="12;20;12" dur="2.4s" repeatCount="indefinite"/></circle>
                <circle r="9" fill="var(--primary)"/><circle r="3.5" fill="var(--primary-foreground)"/>
              </g>
            </svg>
            <div class="map-pills">
              <span class="glass pill">${icon("pin")} Откуда: ${esc(cur.fromCity)}</span>
              <span class="glass pill">${icon("navigation")} Куда: ${esc(cur.toCity)}</span>
              <span class="glass pill">${icon("truck")} Сейчас: ${esc(t.at)}</span>
            </div>
          </div>
          <div class="track-facts">
            <div><div class="k">Статус</div><div class="v">${statusEmoji} ${esc(cur.status)}</div></div>
            <div><div class="k">Текущая точка</div><div class="v">${esc(t.at)}</div></div>
            <div><div class="k">Прибытие</div><div class="v">${esc(t.eta)}</div></div>
            <div><div class="k">Груз</div><div class="v">${cur.weight} т, ${esc(cur.kind)}</div></div>
          </div>
        </div>`,
      };
    },

    analytics() {
      const avg = Math.round(state.cargos.reduce((s, c) => s + c.price, 0) / state.cargos.length / 1000) * 1000;
      const stats = [["Рейсов за месяц", TRIPS_BY_MONTH.at(-1)], ["Средняя ставка", money(avg)], ["Пустой пробег", EMPTY_RUN.at(-1) + "%"], ["Среднее время поиска", "8 мин"]];
      return {
        html: `
          <div class="grid stats stats-4">${stats.map(([k, v]) => `<div class="card stat"><div class="stat-label">${k}</div><div class="stat-value">${v}</div></div>`).join("")}</div>
          <div class="card card-lg" style="margin-top:1.5rem">
            <h2 class="card-title">Расходы и пустой пробег</h2>
            <div class="chart" id="ch-exp" style="height:260px"></div>
            <div class="chart-legend"><span><i style="background:var(--chart-1)"></i>Расходы, млн ₸</span><span><i style="background:var(--chart-4)"></i>Пустой пробег, %</span></div>
          </div>`,
        charts() {
          lineChart($("#ch-exp"), { labels: CHART_MONTHS, max: 40, series: [
            { name: "Расходы", data: EXPENSES, color: "var(--chart-1)", unit: " млн ₸" },
            { name: "Пустой пробег", data: EMPTY_RUN, color: "var(--chart-4)", unit: "%" },
          ] });
        },
      };
    },

    notifications() {
      return {
        html: `
          <div class="section-head" style="justify-content:flex-start"><button class="btn btn-outline btn-sm btn-pill" data-action="read-all">Отметить всё прочитанным</button></div>
          <div class="list">
            ${state.notifs.map((n) => `<button class="card notif card-hover ${n.read ? "read" : ""}" data-action="notif" data-id="${n.id}">
              <div class="notif-head"><div class="notif-title">${n.read ? "" : '<span class="unread" aria-label="Непрочитано"></span>'}${esc(n.title)}</div><div class="notif-time">${esc(n.time)}</div></div>
              <p class="notif-body">${esc(n.body)}</p></button>`).join("")}
            <div class="card hint">${icon("message")} Чат с водителями доступен в карточке перевозчика.</div>
          </div>`,
      };
    },
  };

  function carrierCard(r) {
    const v = VERIFY[r.verify];
    return `<article class="card carrier card-hover">
      <div class="carrier-head">
        <div class="avatar">${r.initials}</div>
        <div><div class="carrier-name">${esc(r.name)}</div><div class="rating">${icon("star")} ${r.rating} <span>· ${r.trips} ${plural(r.trips, "рейс", "рейса", "рейсов")}</span></div></div>
        <span class="badge badge-success">AI match ${r.match}%</span>
      </div>
      <div class="progress" aria-hidden="true"><span style="width:${r.match}%"></span></div>
      <dl class="facts">
        <div><dt>Транспорт</dt><dd>${esc(r.model)} · ${esc(r.body)}</dd></div>
        <div><dt>Грузоподъёмность</dt><dd>${r.capacity} т</dd></div>
        <div><dt>Направление</dt><dd>Казахстан</dd></div>
        <div><dt>До загрузки</dt><dd>${r.pickup} км</dd></div>
        <div><dt>Ставка</dt><dd>${money(r.rate)}</dd></div>
        <div><dt>Локация</dt><dd>${esc(r.location)}</dd></div>
      </dl>
      <div class="chips"><span class="badge ${v.cls}">${v.text}</span><span class="badge badge-secondary">${r.busy ? "Занят" : "Свободен"}</span></div>
      <div class="carrier-actions">
        <button class="btn btn-primary btn-sm" data-action="contact" data-id="${r.id}">${icon("phone")} Связаться</button>
        <button class="btn btn-outline btn-sm" data-action="offer" data-id="${r.id}" ${r.busy ? "disabled" : ""}>${icon("send")} Предложить рейс</button>
        <button class="btn btn-ghost btn-sm" data-action="details" data-id="${r.id}">Подробнее</button>
      </div>
    </article>`;
  }

  function cargoFormHtml() {
    const cityList = Object.keys(CITIES).map((c) => `<option value="${c}">`).join("");
    const f = (name, label, type = "text", attrs = "") => `<div class="field"><label for="f-${name}">${label}</label><input class="input" id="f-${name}" name="${name}" type="${type}" ${attrs}></div>`;
    return `<form class="card form" id="cargo-form" novalidate>
      <datalist id="cities">${cityList}</datalist>
      <div class="form-grid">
        ${f("from", "Откуда", "text", 'list="cities" required autocomplete="off"')}
        ${f("to", "Куда", "text", 'list="cities" required autocomplete="off"')}
        ${f("date", "Дата загрузки", "date", "required")}
        ${f("delivery", "Дата доставки", "date")}
        ${f("kind", "Тип груза", "text", 'placeholder="Например, стройматериалы"')}
        ${f("weight", "Вес, т", "number", 'min="0.1" step="0.1" required')}
        ${f("volume", "Объём, м³", "number", 'min="0" step="0.1"')}
        <div class="field"><label for="f-body">Тип кузова</label><select class="input" id="f-body" name="body" required>${BODY_TYPES.map((b) => `<option>${b}</option>`).join("")}</select></div>
        ${f("places", "Количество мест", "number", 'min="0" step="1"')}
        ${f("price", "Желаемая стоимость, ₸", "number", 'min="0" step="1000" required')}
        ${f("notes", "Особые требования")}
      </div>
      <div class="form-actions"><button class="btn btn-primary btn-pill" type="submit">Создать груз</button></div>
    </form>`;
  }

  function createCargo(form) {
    const data = Object.fromEntries(new FormData(form));
    let ok = true;
    $$("[required]", form).forEach((el) => {
      const bad = !String(el.value).trim() || (el.type === "number" && Number(el.value) <= 0);
      el.classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) { toast("Заполните обязательные поля: откуда, куда, дата, вес, кузов и стоимость"); return; }
    const nextNum = Math.max(...state.cargos.map((c) => parseInt(c.id.slice(2), 10))) + 1;
    const from = data.from.trim(), to = data.to.trim();
    const km = distKm(from, to);
    const cargo = { id: `K-${nextNum}`, from, to, fromCity: from, toCity: to, date: data.date, weight: Number(data.weight), body: data.body,
      km: km ? Math.round(km * 1.15 / 10) * 10 : null, price: Number(data.price), status: "Новый", kind: data.kind?.trim() || "груз" };
    state.cargos.unshift(cargo);
    state.docs.unshift({ id: "d" + nextNum, title: `Договор-заявка №${nextNum}`, cargo: cargo.id, route: `${from} → ${to}`, date: new Date().toISOString().slice(0, 10), type: "Договор-заявка", status: "Черновик" });
    const top = rankCarriers(cargo).filter((c) => c.match >= 70).length;
    state.notifs.unshift({ id: "n" + Date.now(), title: `AI нашёл ${top} ${plural(top, "перевозчика", "перевозчика", "перевозчиков")}`, time: "только что", body: `По грузу ${cargo.id} ${from} → ${to} подобраны подходящие машины.`, read: false, tab: "carriers" });
    state.showForm = false;
    state.matchFor = cargo.id;
    state.showMatch = true;
    save();
    toast(`Груз ${cargo.id} создан, договор-заявка в черновиках`);
    render();
    $("#match")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Диалоги ----------
  function carrierDetails(id) {
    const c = CARRIERS.find((x) => x.id === +id);
    const v = VERIFY[c.verify];
    openDialog(`<h2>${esc(c.name)}</h2><p class="muted" style="margin-top:-.75rem">${esc(c.city)} · ${c.trips} ${plural(c.trips, "рейс", "рейса", "рейсов")} · ${c.reviews} ${plural(c.reviews, "отзыв", "отзыва", "отзывов")}</p>
      <dl class="facts" style="margin:0">
        <div><dt>Транспорт</dt><dd>${esc(c.type)}</dd></div><div><dt>Марка</dt><dd>${esc(c.model)}</dd></div>
        <div><dt>Кузов</dt><dd>${esc(c.body)}</dd></div><div><dt>Грузоподъёмность</dt><dd>${c.capacity} т</dd></div>
        <div><dt>Направления</dt><dd>${esc(c.directions)}</dd></div><div><dt>Ставка</dt><dd>${money(c.rate)}</dd></div>
      </dl>
      <div class="muted" style="display:flex;align-items:center;gap:.5rem">${icon("pin")} ${esc(c.location)}</div>
      <span class="badge ${v.cls}">${v.text}</span>
      <div class="carrier-actions" style="margin:0"><button class="btn btn-primary btn-sm btn-pill" data-dlg="chat">${icon("message")} Написать</button>
      <button class="btn btn-outline btn-sm btn-pill" data-dlg="offer" ${c.busy ? "disabled" : ""}>${icon("send")} Предложить рейс</button></div>`,
      (dlg) => {
        dlg.querySelector('[data-dlg="chat"]').onclick = () => openChat(c.id);
        dlg.querySelector('[data-dlg="offer"]').onclick = () => { closeDialog(); offerTrip(c.id); };
      });
  }

  function openChat(id) {
    const c = CARRIERS.find((x) => x.id === +id);
    const msgs = state.chats[c.id] || [{ from: "them", text: `Здравствуйте! Я ${c.name.split(" ")[0]}, ${c.model}, ${c.body.toLowerCase()} ${c.capacity} т. Сейчас в: ${c.location}.` }];
    const renderMsgs = () => msgs.map((m) => `<div class="msg ${m.from}">${esc(m.text)}</div>`).join("");
    openDialog(`<h2>Чат: ${esc(c.name)}</h2><p class="muted" style="margin-top:-.75rem">${esc(c.phone)} · демо-чат, сообщения не отправляются водителю</p>
      <div class="chat" id="chat-log">${renderMsgs()}</div>
      <form class="chat-form" id="chat-form"><input class="input" name="text" placeholder="Сообщение…" autocomplete="off" aria-label="Сообщение"><button class="btn btn-primary btn-pill" type="submit" aria-label="Отправить">${icon("send")}</button></form>`,
      (dlg) => {
        const log = $("#chat-log", dlg); log.scrollTop = log.scrollHeight;
        $("#chat-form", dlg).onsubmit = (e) => {
          e.preventDefault();
          const input = e.target.text, text = input.value.trim();
          if (!text) return;
          msgs.push({ from: "me", text });
          state.chats[c.id] = msgs; save();
          log.innerHTML = renderMsgs(); log.scrollTop = log.scrollHeight; input.value = "";
          setTimeout(() => {
            msgs.push({ from: "them", text: c.busy ? "Сейчас на рейсе, освобожусь через 2 дня." : "Принято, могу подать машину. Пришлите заявку." });
            save(); log.innerHTML = renderMsgs(); log.scrollTop = log.scrollHeight;
          }, 900);
        };
      });
  }

  function offerTrip(id) {
    const c = CARRIERS.find((x) => x.id === +id);
    const cargo = cargoById(state.matchFor);
    toast(`Предложение рейса отправлено: ${c.name}${cargo ? ` (${cargo.id})` : ""}`);
  }

  function docText(d) {
    const cargo = cargoById(d.cargo);
    return `${d.title}\nТип: ${d.type}\nДата: ${fmtDateNum(d.date)}\nМаршрут: ${d.route}\n` +
      (cargo ? `Груз: ${cargo.weight} т, ${cargo.kind}, кузов ${cargo.body}\nСтоимость: ${money(cargo.price)}\n` : "") +
      `Статус: ${d.status}\n\nДемо-документ QADAMIX. Юридической силы не имеет.`;
  }

  function openDispatcher() {
    const log = [{ from: "them", text: "Я AI-диспетчер QADAMIX. Опишите груз, например: «Астана — Алматы, 20 т, тент». Подберу перевозчиков." }];
    const renderLog = () => log.map((m) => `<div class="msg ${m.from}">${m.html || esc(m.text)}</div>`).join("");
    openDialog(`<h2>${icon("bot")} AI-диспетчер</h2>
      <div class="chat" id="ai-log" style="max-height:340px">${renderLog()}</div>
      <form class="chat-form" id="ai-form"><input class="input" name="q" placeholder="Откуда — куда, вес, кузов…" autocomplete="off" aria-label="Запрос"><button class="btn btn-primary btn-pill" type="submit" aria-label="Отправить">${icon("send")}</button></form>`,
      (dlg) => {
        const box = $("#ai-log", dlg);
        $("#ai-form", dlg).onsubmit = (e) => {
          e.preventDefault();
          const q = e.target.q.value.trim();
          if (!q) return;
          e.target.q.value = "";
          log.push({ from: "me", text: q });
          const found = Object.keys(CITIES).map((n) => [n, q.toLowerCase().indexOf(n.toLowerCase().slice(0, 5))]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([n]) => n);
          const weight = Number((q.match(/(\d+(?:[.,]\d+)?)\s*т/) || [])[1]?.replace(",", ".")) || 20;
          const body = BODY_TYPES.find((b) => q.toLowerCase().includes(b.toLowerCase().slice(0, 4))) || "Тент";
          if (found.length < 2) {
            log.push({ from: "them", text: "Не нашёл два города в запросе. Укажите, откуда и куда везём (например, Караганда — Шымкент)." });
          } else {
            const tmp = { fromCity: found[0], toCity: found[1], weight, body };
            const top = rankCarriers(tmp).slice(0, 3);
            log.push({ from: "them", html: `${esc(found[0])} → ${esc(found[1])}, ${weight} т, ${esc(body.toLowerCase())}, ~${Math.round((distKm(found[0], found[1]) || 0) * 1.15 / 10) * 10} км. Лучшие варианты:<br>` +
              top.map((c, i) => `${i + 1}. ${esc(c.name)} — ${esc(c.model)}, ${c.match}%, ${money(c.rate)}`).join("<br>") });
          }
          box.innerHTML = renderLog(); box.scrollTop = box.scrollHeight;
        };
      });
  }

  // ---------- Рендер ----------
  let currentView = null;
  function render() {
    $$(".tabs [role=tab]").forEach((b) => {
      const on = b.dataset.tab === state.tab;
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
    });
    $("#notif-dot").hidden = !state.notifs.some((n) => !n.read);
    currentView = (VIEWS[state.tab] || VIEWS.home)();
    const panel = $("#panel");
    panel.innerHTML = currentView.html;
    panel.style.animation = "none"; void panel.offsetWidth; panel.style.animation = "";
    currentView.charts?.();
  }

  function setTab(tab) {
    state.tab = tab;
    store.set("tab", tab);
    render();
  }

  // Подставляем иконки в статичную разметку
  $$("[data-icon]").forEach((el) => { el.outerHTML = icon(el.dataset.icon); });

  $(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[role=tab]"); if (b) setTab(b.dataset.tab); });
  $(".tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const tabs = $$(".tabs [role=tab]"), i = tabs.findIndex((t) => t.dataset.tab === state.tab);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    setTab(next.dataset.tab); next.focus();
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.tagName === "SELECT") return;
    const id = el.dataset.id;
    switch (el.dataset.action) {
      case "open-dispatcher": openDispatcher(); break;
      case "toggle-form": state.showForm = !state.showForm; render(); if (state.showForm) $("#f-from")?.focus(); break;
      case "match":
        state.matchFor = id; state.showMatch = true; render();
        $("#match")?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "contact": openChat(id); break;
      case "details": carrierDetails(id); break;
      case "offer": offerTrip(id); break;
      case "track": state.trackId = id; render(); break;
      case "doc-view": { const d = state.docs.find((x) => x.id === id); openDialog(`<h2>${esc(d.title)}</h2><pre>${esc(docText(d))}</pre>`); break; }
      case "doc-download": {
        const d = state.docs.find((x) => x.id === id);
        const url = URL.createObjectURL(new Blob(["﻿" + docText(d)], { type: "text/plain;charset=utf-8" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: `${d.title.replace(/[^\wА-Яа-яЁё№-]+/g, "_")}.txt` });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        // В облачной версии скачивание блокируется — дублируем текст в буфер обмена
        navigator.clipboard?.writeText(docText(d)).then(() => toast(`${d.title}: текст скопирован в буфер обмена`), () => {});
        break;
      }
      case "doc-sign": { const d = state.docs.find((x) => x.id === id); d.status = "Подписан"; save(); toast(`${d.title} подписан ЭЦП (демо)`); render(); break; }
      case "read-all": state.notifs.forEach((n) => (n.read = true)); save(); render(); break;
      case "notif": { const n = state.notifs.find((x) => x.id === id); n.read = true; save(); if (n.tab) setTab(n.tab); else render(); break; }
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches('[data-action="match-select"]')) { state.matchFor = e.target.value; render(); }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "cargo-form") { e.preventDefault(); createCargo(e.target); }
  });

  let resizeT;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => currentView?.charts?.(), 120); });

  render();
})();
