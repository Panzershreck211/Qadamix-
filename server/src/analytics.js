import { all, one } from "./db.js";

// Фильтр «свои грузы» для логиста; админ видит всю платформу.
const scope = (user) => (user.role === "logist" ? { sql: "c.logist_id = $1", params: [user.id] } : { sql: "TRUE", params: [] });

/** Полная аналитика кабинета логиста за последние `months` месяцев. */
export async function logistAnalytics(user, months = 6) {
  const s = scope(user);
  const p = (extra) => [...s.params, ...extra];
  const n = s.params.length;

  const kpi = await one(
    `SELECT
       COUNT(*) FILTER (WHERE c.status = 'open') AS open,
       COUNT(*) FILTER (WHERE c.status IN ('assigned','loading','in_transit')) AS active,
       COUNT(*) FILTER (WHERE c.status = 'in_transit') AS in_transit,
       COUNT(*) FILTER (WHERE c.status = 'delivered' AND c.delivered_at >= date_trunc('month', now())) AS delivered_month,
       COALESCE(SUM(c.price) FILTER (WHERE c.status = 'delivered' AND c.delivered_at >= date_trunc('month', now())), 0) AS turnover_month,
       ROUND(AVG(c.price::numeric / NULLIF(c.distance_km, 0)) FILTER (WHERE c.status = 'delivered' AND c.delivered_at > now() - interval '90 days'), 0) AS avg_per_km,
       ROUND((AVG(EXTRACT(EPOCH FROM (c.assigned_at - c.created_at)) / 60) FILTER (WHERE c.assigned_at IS NOT NULL AND c.created_at > now() - interval '90 days'))::numeric, 0) AS avg_assign_min
     FROM cargos c WHERE ${s.sql}`,
    s.params,
  );
  const drivers = await one(`SELECT COUNT(*) FILTER (WHERE status = 'free') AS free, COUNT(*) AS total FROM drivers`);

  const monthly = await all(
    `WITH m AS (SELECT generate_series(date_trunc('month', now()) - ($${n + 1}::int - 1) * interval '1 month', date_trunc('month', now()), interval '1 month') AS month)
     SELECT to_char(m.month, 'YYYY-MM') AS month,
            COUNT(c.id) AS trips,
            COALESCE(SUM(c.price), 0) AS turnover,
            COALESCE(ROUND(AVG(c.price::numeric / NULLIF(c.distance_km, 0)), 0), 0) AS avg_per_km,
            COALESCE(SUM(c.distance_km), 0) AS km
     FROM m LEFT JOIN cargos c ON date_trunc('month', c.delivered_at) = m.month AND c.status = 'delivered' AND ${s.sql}
     GROUP BY m.month ORDER BY m.month`,
    p([months]),
  );

  const since = `c.created_at > now() - ($${n + 1}::int * interval '1 month')`;
  const routes = await all(
    `SELECT c.from_city || ' → ' || c.to_city AS route, COUNT(*) AS trips, SUM(c.price) AS turnover,
            ROUND(AVG(c.price)) AS avg_price
     FROM cargos c WHERE ${s.sql} AND c.status = 'delivered' AND ${since}
     GROUP BY 1 ORDER BY trips DESC, turnover DESC LIMIT 8`,
    p([months]),
  );
  const bodies = await all(
    `SELECT c.body, COUNT(*) AS trips FROM cargos c WHERE ${s.sql} AND c.status = 'delivered' AND ${since}
     GROUP BY 1 ORDER BY trips DESC`,
    p([months]),
  );
  const topDrivers = await all(
    `SELECT u.id, u.name, d.rating, d.vehicle_model, d.body, COUNT(*) AS trips, SUM(c.price) AS turnover
     FROM cargos c JOIN users u ON u.id = c.driver_id JOIN drivers d ON d.user_id = c.driver_id
     WHERE ${s.sql} AND c.status = 'delivered' AND ${since}
     GROUP BY u.id, u.name, d.rating, d.vehicle_model, d.body ORDER BY trips DESC LIMIT 6`,
    p([months]),
  );
  const offersStats = await one(
    `SELECT ROUND(AVG(cnt), 1) AS avg_offers FROM (
       SELECT COUNT(o.id) AS cnt FROM cargos c LEFT JOIN offers o ON o.cargo_id = c.id AND o.source = 'driver'
       WHERE ${s.sql} AND ${since} GROUP BY c.id) t`,
    p([months]),
  );

  return { kpi: { ...kpi, free_drivers: drivers.free, total_drivers: drivers.total, avg_offers: offersStats?.avg_offers ?? 0 }, monthly, routes, bodies, topDrivers };
}

/** Короткая сводка для ассистента (логист — бизнес, водитель — свои рейсы и заработок). */
export async function analyticsSummary(user, months = 1) {
  if (user.role === "driver") {
    const r = await one(
      `SELECT COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at > now() - ($2::int * interval '1 month')) AS trips,
              COALESCE(SUM(price) FILTER (WHERE status = 'delivered' AND delivered_at > now() - ($2::int * interval '1 month')), 0) AS earned_kzt,
              COALESCE(SUM(distance_km) FILTER (WHERE status = 'delivered' AND delivered_at > now() - ($2::int * interval '1 month')), 0) AS km,
              COUNT(*) FILTER (WHERE status IN ('assigned','loading','in_transit')) AS active_trips
       FROM cargos WHERE driver_id = $1`,
      [user.id, months],
    );
    const d = await one("SELECT rating, trips AS total_trips, city, status FROM drivers WHERE user_id = $1", [user.id]);
    return { period_months: months, ...r, ...d };
  }
  const a = await logistAnalytics(user, Math.max(months, 1));
  return {
    period_months: months,
    open_cargos: a.kpi.open, active_trips: a.kpi.active, in_transit: a.kpi.in_transit,
    delivered_this_month: a.kpi.delivered_month, turnover_this_month_kzt: a.kpi.turnover_month,
    avg_rate_per_km_kzt: a.kpi.avg_per_km, avg_minutes_to_find_truck: a.kpi.avg_assign_min,
    free_drivers_on_platform: a.kpi.free_drivers,
    by_month: a.monthly, top_routes: a.routes.slice(0, 5), top_drivers: a.topDrivers.slice(0, 3).map((d) => ({ name: d.name, trips: d.trips })),
  };
}
