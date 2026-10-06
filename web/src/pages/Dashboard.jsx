import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../auth.jsx";
import { money, num, day, monthLabel, plural, tripsLabel } from "../format.js";
import { Icon, StatusBadge, Empty, useApi } from "../components/ui.jsx";

export function Kpi({ label, value, note }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {note && <div className="kpi-note">{note}</div>}
    </div>
  );
}

export const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13 },
  labelStyle: { color: "var(--muted-fg)" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { openAssistant } = useOutletContext();
  const navigate = useNavigate();
  const analytics = useApi("/analytics?months=6", { interval: 60000 });
  const cargos = useApi("/cargos?status=active", { interval: 20000 });

  const k = analytics.data?.kpi;
  const list = cargos.data ?? [];
  const needAction = list.filter((c) => c.status === "open");
  const onRoad = list.filter((c) => c.status !== "open");
  const monthly = (analytics.data?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Добрый день, {user.name.split(" ")[0]}</h1>
          <p className="page-sub">{user.role === "admin" ? "Сводка по всей платформе" : `${user.company ?? ""} · сводка по вашим грузам`}</p>
        </div>
        <div className="row">
          <button className="btn btn-outline" onClick={openAssistant}><Icon name="sparkles" />Спросить AI-диспетчера</button>
          {user.role !== "admin" && <Link to="/cargos/new" className="btn btn-primary"><Icon name="plus" />Новый груз</Link>}
        </div>
      </div>

      <section className="grid kpis" aria-label="Показатели">
        <Kpi label="Ищем машину" value={num(k?.open)} note={k ? `в среднем ${num(k.avg_offers, 1)} отклика на груз` : null} />
        <Kpi label="В работе" value={num(k?.active)} note={k ? `в пути: ${k.in_transit}` : null} />
        <Kpi label="Доставлено в этом месяце" value={num(k?.delivered_month)} />
        <Kpi label="Оборот за месяц" value={k ? money(k.turnover_month) : "—"} />
        <Kpi label="Средняя ставка" value={k?.avg_per_km ? `${num(k.avg_per_km)} ₸/км` : "—"} note="за 90 дней" />
        <Kpi label="Машину находим за" value={k?.avg_assign_min != null ? `${num(k.avg_assign_min)} мин` : "—"} note={k ? `свободно машин: ${k.free_drivers} из ${k.total_drivers}` : null} />
      </section>

      <div className="grid two-col">
        <section className="card card-pad">
          <div className="card-head">
            <h2 className="card-title">Нужно ваше решение</h2>
            <Link to="/cargos?status=open" className="small muted">Все грузы →</Link>
          </div>
          {needAction.length === 0 ? (
            <Empty title="Все грузы распределены">Создайте новый груз — подходящие водители получат уведомление.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Груз</th><th>Маршрут</th><th>Загрузка</th><th>Ставка</th><th>Отклики</th></tr></thead>
                <tbody>
                  {needAction.map((c) => (
                    <tr key={c.code} className="clickable" onClick={() => navigate(`/cargos/${c.code}`)}>
                      <td><Link to={`/cargos/${c.code}`}><strong>{c.code}</strong></Link></td>
                      <td><span className="route">{c.from_city} → {c.to_city}</span><div className="xs muted">{c.weight} т · {c.body}</div></td>
                      <td>{day(c.load_date)}</td>
                      <td className="num">{money(c.price)}</td>
                      <td>{c.offers_count > 0
                        ? <span className="badge b-primary">{c.offers_count} {plural(c.offers_count, "отклик", "отклика", "откликов")}</span>
                        : <span className="badge b-neutral">ждём</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card card-pad">
          <div className="card-head"><h2 className="card-title">В работе</h2></div>
          {onRoad.length === 0 ? <Empty icon="truck" title="Нет рейсов в работе" /> : (
            <div className="stack">
              {onRoad.map((c) => (
                <Link key={c.code} to={`/cargos/${c.code}`} className="mini card-link">
                  <div className="row between"><strong>{c.code}</strong><StatusBadge status={c.status} /></div>
                  <div className="route">{c.from_city} → {c.to_city}</div>
                  <div className="muted">{c.driver_name} · {c.weight} т · {money(c.price)}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card card-pad">
        <div className="card-head">
          <h2 className="card-title">Доставленные рейсы за полгода</h2>
          <Link to="/analytics" className="small muted">Вся аналитика →</Link>
        </div>
        <div className="chart-box">
          <ResponsiveContainer>
            <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gTrips" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-fg)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted-fg)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => [tripsLabel(v), "Доставлено"]} />
              <Area type="monotone" dataKey="trips" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gTrips)" dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
