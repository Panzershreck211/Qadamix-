// Справочник городов с реальными координатами. Расстояние по дорогам оцениваем
// как расстояние по прямой × ROAD_FACTOR — точности хватает для подбора и ставок,
// пока не подключён картографический сервис.
export const CITIES = {
  "Астана": [51.1694, 71.4491],
  "Алматы": [43.2389, 76.8897],
  "Шымкент": [42.3417, 69.5901],
  "Караганда": [49.8047, 73.1094],
  "Актобе": [50.2839, 57.1670],
  "Атырау": [47.0945, 51.9238],
  "Костанай": [53.2144, 63.6246],
  "Кокшетау": [53.2833, 69.3833],
  "Павлодар": [52.2873, 76.9674],
  "Усть-Каменогорск": [49.9483, 82.6279],
  "Тараз": [42.9000, 71.3667],
  "Актау": [43.6500, 51.1667],
  "Семей": [50.4111, 80.2275],
  "Туркестан": [43.2973, 68.2518],
  "Кызылорда": [44.8488, 65.4823],
  "Хоргос": [44.2167, 80.4167],
  "Петропавловск": [54.8667, 69.1500],
  "Уральск": [51.2333, 51.3667],
  "Талдыкорган": [45.0167, 78.3667],
  "Жезказган": [47.7833, 67.7667],
  "Экибастуз": [51.7298, 75.3266],
  "Ташкент": [41.2995, 69.2401],
  "Бишкек": [42.8746, 74.5698],
  "Москва": [55.7558, 37.6173],
  "Екатеринбург": [56.8389, 60.6057],
  "Новосибирск": [55.0084, 82.9357],
  "Омск": [54.9885, 73.3242],
  "Урумчи": [43.8256, 87.6168],
};

export const CITY_NAMES = Object.keys(CITIES);
const ROAD_FACTOR = 1.25;

// Формы, в которых город встречается в тексте: «из Астаны», «в Алматы», «Шымкента».
const ALIASES = {
  "Астана": ["астан", "нур-султан", "нурсултан"],
  "Алматы": ["алмат", "алма-ат"],
  "Шымкент": ["шымкент", "чимкент"],
  "Караганда": ["караганд"],
  "Актобе": ["актобе", "актюбинск"],
  "Атырау": ["атырау"],
  "Костанай": ["костана", "кустана"],
  "Кокшетау": ["кокшетау", "кокчетав"],
  "Павлодар": ["павлодар"],
  "Усть-Каменогорск": ["усть-каменогорск", "усть каменогорск", "оскемен", "өскемен"],
  "Тараз": ["тараз"],
  "Актау": ["актау"],
  "Семей": ["семей", "семипалатинск"],
  "Туркестан": ["туркестан"],
  "Кызылорда": ["кызылорд"],
  "Хоргос": ["хоргос"],
  "Петропавловск": ["петропавловск"],
  "Уральск": ["уральск", "орал"],
  "Талдыкорган": ["талдыкорган"],
  "Жезказган": ["жезказган"],
  "Экибастуз": ["экибастуз"],
  "Ташкент": ["ташкент"],
  "Бишкек": ["бишкек"],
  "Москва": ["москв"],
  "Екатеринбург": ["екатеринбург"],
  "Новосибирск": ["новосибирск"],
  "Омск": ["омск"],
  "Урумчи": ["урумчи"],
};

export function normalizeCity(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/ё/g, "е");
  for (const [name, aliases] of Object.entries(ALIASES)) {
    if (name.toLowerCase() === s || aliases.some((a) => s.startsWith(a))) return name;
  }
  return null;
}

/** Все города в порядке появления в тексте. */
export function findCitiesInText(text) {
  const s = String(text).toLowerCase().replace(/ё/g, "е");
  const hits = [];
  for (const [name, aliases] of Object.entries(ALIASES)) {
    let best = -1;
    for (const a of aliases) {
      const re = new RegExp(`(^|[^а-яәіңғүұқөһa-z])${a.replace(/[-\s]/g, "[-\\s]")}`, "i");
      const m = re.exec(s);
      if (m && (best === -1 || m.index < best)) best = m.index;
    }
    if (best >= 0) hits.push([name, best]);
  }
  return hits.sort((a, b) => a[1] - b[1]).map(([n]) => n);
}

function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Расстояние по прямой между двумя точками [lat, lon], км. */
export const straightKm = (a, b) => haversineKm(a, b);

/** Ближайший город справочника к координатам: { name, km } (km — по прямой). */
export function nearestCity(lat, lon) {
  let best = null;
  for (const [name, coords] of Object.entries(CITIES)) {
    const km = haversineKm([lat, lon], coords);
    if (!best || km < best.km) best = { name, km: Math.round(km) };
  }
  return best;
}

/** Оценка расстояния по дорогам от точки до города, км. */
export function roadKmFromPoint(lat, lon, city) {
  const c = CITIES[normalizeCity(city)];
  return c ? Math.round(haversineKm([lat, lon], c) * ROAD_FACTOR) : null;
}

/** Ориентировочное расстояние по дорогам, км (округлено до 10). null — город не в справочнике. */
export function roadDistanceKm(from, to) {
  const a = CITIES[normalizeCity(from)], b = CITIES[normalizeCity(to)];
  if (!a || !b) return null;
  if (a === b) return 0;
  return Math.round((haversineKm(a, b) * ROAD_FACTOR) / 10) * 10;
}
