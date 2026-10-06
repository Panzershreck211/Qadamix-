import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { money, num, monthLabel, tripsLabel } from "../format.js";
import { Empty, useApi } from "../components/ui.jsx";
import { Kpi, tooltipStyle } from "./Dashboard.jsx";

const axis = { tick: { fill: "var(--muted-fg)", fontSize: 12 }, axisLine: false, tickLine: false };
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export default function Analytics() {
  const [months, setMonths] = useState(6);
  const { data, loading } = useApi(`/analytics?months=${months}`);
  if (loading && !data) return <Empty title="Считаем…" />;
  if (!data) return <Empty title="Нет данных" />;

  const monthly = data.monthly.map((m) => ({ ...m, label: monthLabel(m.month), turnoverM: Math.round(m.turnover / 100000) / 10 }));
  const totals = data.monthly.reduce((s, m) => ({ trips: s.trips + m.trips, turnover: s.turnover + m.turnover, km: s.km + m.km }), { trips: 0, turnover: 0, km: 0 });
  const k = data.kpi;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Аналитика</h1>
          <p className="page-sub">Только доставленные рейсы — по данным платформы, без оценок</p>
        </div>
        <div className="seg" role="group" aria-label="Период">
          {[[3, "3 мес"], [6, "6 мес"], [12, "12 мес"]].map(([v, l]) => (
            <button key={v} aria-pressed={months === v} onClick={() => setMonths(v)}>{l}</button>
          ))}
        </div>
      </div>

      <section className="grid kpis">
        <Kpi label="Рейсов за период" value={num(totals.trips)} />
        <Kpi label="Оборот за период" value={money(totals.turnover)} />
        <Kpi label="Средний чек" value={money(totals.trips ? totals.turnover / totals.trips : null)} />
        <Kpi label="Пробег с грузом" value={`${num(totals.km)} км`} />
        <Kpi label="Средняя ставка (90 дн)" value={k.avg_per_km ? `${num(k.avg_per_km)} ₸/км` : "—"} />
        <Kpi label="Время поиска машины" value={k.avg_assign_min != null ? `${num(k.avg_assign_min)} мин` : "—"} note={`откликов на груз: ${num(k.avg_offers, 1)}`} />
      </section>

      <div className="grid two-col even">
        <section className="card card-pad">
          <h2 className="card-title">Рейсы и оборот по месяцам</h2>
          <div className="chart-box" style={{ height: 280, marginTop: ".75rem" }}>
            <ResponsiveContainer>
              <ComposedChart data={monthly} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis yAxisId="t" allowDecimals={false} {...axis} />
                <YAxis yAxisId="m" orientation="right" {...axis} tickFormatter={(v) => `${v}м`} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => (n === "turnoverM" ? [`${v} млн ₸`, "Оборот"] : [v, "Рейсов"])} />
                <Bar yAxisId="t" dataKey="trips" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Line yAxisId="m" dataKey="turnoverM" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="row xs muted"><span>■ рейсы (слева)</span><span style={{ color: "var(--chart-1)" }}>— оборот, млн ₸ (справа)</span></div>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Средняя ставка, ₸/км</h2>
          <div className="chart-box" style={{ height: 280, marginTop: ".75rem" }}>
            <ResponsiveContainer>
              <BarChart data={monthly.filter((m) => m.trips)} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} domain={[0, "auto"]} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} ₸/км`, "Ставка"]} />
                <Bar dataKey="avg_per_km" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid two-col even">
        <section className="card card-pad">
          <h2 className="card-title" style={{ marginBottom: ".75rem" }}>Направления</h2>
          {data.routes.length === 0 ? <Empty title="Нет доставленных рейсов за период" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Маршрут</th><th>Рейсов</th><th>Средняя ставка</th><th>Оборот</th></tr></thead>
                <tbody>
                  {data.routes.map((r) => {
                    const share = r.trips / data.routes[0].trips;
                    return (
                      <tr key={r.route}>
                        <td><span className="route">{r.route}</span><div className="progress" style={{ marginTop: ".35rem", maxWidth: "12rem" }}><span style={{ width: `${share * 100}%` }} /></div></td>
                        <td className="num">{r.trips}</td>
                        <td className="num">{money(r.avg_price)}</td>
                        <td className="num">{money(r.turnover)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card card-pad">
            <h2 className="card-title" style={{ marginBottom: ".75rem" }}>Кузова</h2>
            <div className="chart-box" style={{ height: Math.max(120, data.bodies.length * 38) }}>
              <ResponsiveContainer>
                <BarChart data={data.bodies} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="body" width={130} {...axis} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [v, "Рейсов"]} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="trips" radius={[0, 6, 6, 0]} maxBarSize={22} label={{ position: "right", fill: "var(--muted-fg)", fontSize: 12 }}>
                    {data.bodies.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="card card-pad">
            <h2 className="card-title" style={{ marginBottom: ".5rem" }}>Лучшие перевозчики</h2>
            {data.topDrivers.map((d) => (
              <div key={d.id} className="row between small" style={{ padding: ".4rem 0", borderBottom: "1px solid var(--border)" }}>
                <span><strong>{d.name}</strong> <span className="muted">· {d.vehicle_model} · ★ {d.rating}</span></span>
                <span className="num">{tripsLabel(d.trips)} · {money(d.turnover)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
