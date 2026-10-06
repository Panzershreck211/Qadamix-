import { useState } from "react";
import { qs } from "../api.js";
import { useAuth } from "../auth.jsx";
import { money, day, initials, STATUS, tripsLabel, reviewsLabel } from "../format.js";
import { Icon, VerifyBadge, DriverStatusBadge, Empty, Dialog, useApi } from "../components/ui.jsx";
import { FleetMap } from "../components/Map.jsx";

export default function Drivers() {
  const { meta } = useAuth();
  const [f, setF] = useState({ status: "free", city: "", body: "", minCapacity: "" });
  const { data, loading } = useApi(`/drivers${qs(f)}`, { interval: 30000 });
  const [openId, setOpenId] = useState(null);
  const [view, setView] = useState("list");
  const fleet = useApi(view === "map" ? "/fleet" : null, { interval: 15000 });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Водители и машины</h1>
          <p className="page-sub">Кто свободен, где стоит машина и насколько ей можно доверять</p>
        </div>
      </div>

      <div className="filters">
        <div className="seg" role="group" aria-label="Вид">
          {[["list", "Список"], ["map", "Карта"]].map(([v, l]) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Статус">
          {[["free", "Свободны"], ["busy", "В рейсе"], ["any", "Все"]].map(([v, l]) => (
            <button key={v} aria-pressed={f.status === v} onClick={() => setF((x) => ({ ...x, status: v }))}>{l}</button>
          ))}
        </div>
        <select className="select" value={f.city} onChange={set("city")} aria-label="Город">
          <option value="">Любой город</option>{meta.cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="select" value={f.body} onChange={set("body")} aria-label="Кузов">
          <option value="">Любой кузов</option>{meta.bodyTypes.map((b) => <option key={b}>{b}</option>)}
        </select>
        <input className="input num" type="number" min="1" placeholder="От, т" value={f.minCapacity} onChange={set("minCapacity")} aria-label="Минимальная грузоподъёмность" style={{ minWidth: 0, width: "7rem" }} />
      </div>

      {view === "map" ? (
        <section className="card card-pad stack">
          {!fleet.data ? <Empty title="Загружаем карту…" /> : <FleetMap drivers={fleet.data.filter((d) => (f.status === "any" || d.status === f.status) && (!f.city || d.city === f.city) && (!f.body || d.body === f.body) && (!f.minCapacity || d.capacity >= Number(f.minCapacity)))} />}
          <p className="xs muted">Точные GPS-координаты видны только у водителей на ваших рейсах. Остальные машины показаны в своём городе — примерно, чтобы не раскрывать перемещения водителей.</p>
        </section>
      ) : (
      <section className="card">
        {loading && !data ? <Empty title="Загружаем…" /> : !data?.length ? (
          <Empty icon="truck" title="Под эти условия машин нет">Снимите фильтр по городу или кузову.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Водитель</th><th>Машина</th><th>Где сейчас</th><th>Рейтинг</th><th>Статус</th><th>Документы</th></tr></thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.id} className="clickable" onClick={() => setOpenId(d.id)}>
                    <td><div className="row" style={{ flexWrap: "nowrap" }}><div className="avatar">{initials(d.name)}</div><div><strong>{d.name}</strong><div className="xs muted num">{d.phone}</div></div></div></td>
                    <td>{d.vehicle_model}<div className="xs muted">{d.body} · {d.capacity} т{d.volume ? ` · ${d.volume} м³` : ""}</div></td>
                    <td><span className="row" style={{ gap: ".25rem" }}><Icon name="pin" className="muted" />{d.city}</span></td>
                    <td className="num">★ {d.rating} <span className="xs muted">· {tripsLabel(d.trips)}</span></td>
                    <td><DriverStatusBadge status={d.status} /></td>
                    <td><VerifyBadge verify={d.verify} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}
      {openId && <DriverDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function DriverDialog({ id, onClose }) {
  const { data: d } = useApi(`/drivers/${id}`);
  return (
    <Dialog title={d?.name ?? "Водитель"} onClose={onClose}>
      {!d ? <Empty title="Загружаем…" /> : (
        <>
          <div className="row"><DriverStatusBadge status={d.status} /><VerifyBadge verify={d.verify} /><span className="small">★ {d.rating} · {tripsLabel(d.trips)} · {reviewsLabel(d.reviews_count)}</span></div>
          <dl className="form-grid small">
            {[["Машина", d.vehicle_model], ["Кузов", d.body], ["Грузоподъёмность", `${d.capacity} т`], ["Объём", d.volume ? `${d.volume} м³` : "—"],
              ["Госномер", d.plate || "—"], ["Сейчас в", d.city], ["Направления", d.directions || "—"], ["Телефон", d.phone]].map(([k, v]) => (
              <div key={k}><dt className="xs muted">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <a className="btn btn-primary" href={`tel:${d.phone}`}><Icon name="phone" />Позвонить {d.phone}</a>
          {d.recent_trips?.length > 0 && (
            <div className="stack">
              <h3 className="card-title" style={{ fontSize: ".95rem" }}>Последние рейсы</h3>
              {d.recent_trips.slice(0, 5).map((t) => (
                <div key={t.code} className="row between small"><span>{t.code} · {t.from_city} → {t.to_city}</span><span className="muted">{STATUS[t.status]?.label} · {day(t.load_date)} · {money(t.price)}</span></div>
              ))}
            </div>
          )}
          {d.reviews?.length > 0 && (
            <div className="stack">
              <h3 className="card-title" style={{ fontSize: ".95rem" }}>Отзывы</h3>
              {d.reviews.slice(0, 4).map((r, i) => (
                <div key={i} className="mini"><div className="row between"><strong>{"★".repeat(r.rating)}</strong><span className="xs muted">{r.company} · {r.code}</span></div>{r.comment && <div>{r.comment}</div>}</div>
              ))}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

