import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, qs } from "../api.js";
import { useAuth } from "../auth.jsx";
import { money, day, plural } from "../format.js";
import { Icon, StatusBadge, Empty, useApi, useToast } from "../components/ui.jsx";

const FILTERS = [
  ["active", "В работе и поиске"], ["open", "Ищем машину"], ["delivered", "Доставлены"], ["cancelled", "Отменены"], ["", "Все"],
];

export default function Cargos() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "active";
  const [q, setQ] = useState(params.get("q") ?? "");
  const navigate = useNavigate();
  const { data, loading, error } = useApi(`/cargos${qs({ status, q: params.get("q") })}`, { interval: 30000 });

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      q ? next.set("q", q) : next.delete("q");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Грузы</h1>
          <p className="page-sub">Ваши заявки, отклики водителей и рейсы</p>
        </div>
        {user.role !== "admin" && <Link to="/cargos/new" className="btn btn-primary"><Icon name="plus" />Новый груз</Link>}
      </div>

      <div className="filters">
        <div className="seg" role="group" aria-label="Статус">
          {FILTERS.map(([v, label]) => (
            <button key={v} aria-pressed={status === v} onClick={() => { const n = new URLSearchParams(params); n.set("status", v); setParams(n); }}>{label}</button>
          ))}
        </div>
        <input className="input" type="search" placeholder="Код, город или груз" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск" style={{ maxWidth: "18rem" }} />
      </div>

      <section className="card">
        {error ? <Empty title="Не удалось загрузить грузы">{error.message}</Empty>
          : loading && !data ? <Empty title="Загружаем…" />
          : !data?.length ? <Empty title="Грузов нет">Поменяйте фильтр или создайте новый груз.</Empty>
          : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Груз</th><th>Маршрут</th><th>Загрузка</th><th>Параметры</th><th>Ставка</th><th>Статус</th><th>Водитель / отклики</th></tr></thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.code} className="clickable" onClick={() => navigate(`/cargos/${c.code}`)}>
                      <td><Link to={`/cargos/${c.code}`} onClick={(e) => e.stopPropagation()}><strong>{c.code}</strong></Link></td>
                      <td><span className="route">{c.from_city} → {c.to_city}</span><div className="xs muted">{c.distance_km ? `${c.distance_km} км` : ""}{c.kind ? ` · ${c.kind}` : ""}</div></td>
                      <td>{day(c.load_date)}</td>
                      <td className="num">{c.weight} т · {c.body}</td>
                      <td className="num">{money(c.price)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>{c.driver_name ?? (c.status === "open"
                        ? (c.offers_count > 0 ? <span className="badge b-primary">{c.offers_count} {plural(c.offers_count, "отклик", "отклика", "откликов")}</span> : <span className="muted small">ждём откликов</span>)
                        : "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { fromCity: "", toCity: "", loadDate: "", weight: "", volume: "", body: "Тент", kind: "", price: "", notes: "" };

export function NewCargo() {
  const { meta } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY, loadDate: today() });
  const [raw, setRaw] = useState("");
  const [parsing, setParsing] = useState(false);
  const [rate, setRate] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Подсказка рыночной ставки, когда известны маршрут, вес и кузов
  useEffect(() => {
    setRate(null);
    if (!meta.cities.includes(form.fromCity) || !meta.cities.includes(form.toCity) || form.fromCity === form.toCity) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api(`/rate-estimate${qs({ from: form.fromCity, to: form.toCity, weight: form.weight || 20, body: form.body })}`, { signal: ctrl.signal })
        .then(setRate).catch(() => {});
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [form.fromCity, form.toCity, form.weight, form.body, meta.cities]);

  async function parse() {
    setParsing(true); setError(null);
    try {
      const p = await api("/cargos/parse", { method: "POST", body: { text: raw } });
      const filled = Object.entries(p).filter(([k, v]) => k in EMPTY && v != null);
      setForm((f) => ({ ...f, ...Object.fromEntries(filled.map(([k, v]) => [k, String(v)])) }));
      toast(filled.length ? `Заполнено полей: ${filled.length}. Проверьте и дополните` : "Не удалось ничего распознать — заполните форму вручную");
    } catch (e) { setError(e.message); } finally { setParsing(false); }
  }

  // Ставка в разы ниже рынка почти всегда опечатка (5 000 вместо 500 000) — просим подтвердить
  const priceTooLow = rate && Number(form.price) > 0 && Number(form.price) < rate.low * 0.5;
  const [lowConfirmed, setLowConfirmed] = useState(false);
  useEffect(() => { setLowConfirmed(false); setError(null); }, [form.price]);

  async function submit(e) {
    e.preventDefault();
    if (priceTooLow && !lowConfirmed) {
      setLowConfirmed(true);
      setError(`Ставка ${money(Number(form.price))} в ${Math.round(rate.market / Number(form.price))} раз ниже рынка (${money(rate.low)} – ${money(rate.high)}). Проверьте число или нажмите «Опубликовать» ещё раз.`);
      return;
    }
    setSaving(true); setError(null);
    try {
      const body = { ...form, weight: Number(form.weight), price: Number(form.price), volume: form.volume ? Number(form.volume) : null, kind: form.kind || null, notes: form.notes || null };
      const c = await api("/cargos", { method: "POST", body });
      toast(`Груз ${c.code} создан${c.notifiedDrivers ? `, уведомили водителей: ${c.notifiedDrivers}` : ""}`);
      navigate(`/cargos/${c.code}`);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/cargos" className="small muted row" style={{ gap: ".25rem" }}><Icon name="arrowLeft" />Грузы</Link>
          <h1 className="page-title">Новый груз</h1>
        </div>
      </div>

      <section className="card card-pad stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2 className="card-title">Вставьте заявку текстом</h2>
          <span className="xs muted">{meta.assistantMode === "claude" ? "Разбирает Claude" : "Разбор по правилам"}</span>
        </div>
        <textarea className="textarea" value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Текст заявки"
          placeholder="Например, сообщение из WhatsApp: «Нужна фура тент 20т Астана-Алматы на завтра, 300к, загрузка с 9:00»" />
        <div><button className="btn btn-outline" onClick={parse} disabled={parsing || raw.trim().length < 5}><Icon name="wand" />{parsing ? "Разбираю…" : "Заполнить форму из текста"}</button></div>
      </section>

      <form className="card card-pad stack" onSubmit={submit}>
        <datalist id="cities">{meta.cities.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="form-grid">
          <div className="field"><label htmlFor="from">Откуда</label><input id="from" className="input" list="cities" value={form.fromCity} onChange={set("fromCity")} required autoComplete="off" /></div>
          <div className="field"><label htmlFor="to">Куда</label><input id="to" className="input" list="cities" value={form.toCity} onChange={set("toCity")} required autoComplete="off" /></div>
          <div className="field"><label htmlFor="date">Дата загрузки</label><input id="date" className="input" type="date" min={today()} value={form.loadDate} onChange={set("loadDate")} required /></div>
          <div className="field"><label htmlFor="weight">Вес, т</label><input id="weight" className="input num" type="number" step="0.1" min="0.1" max="80" value={form.weight} onChange={set("weight")} required /></div>
          <div className="field"><label htmlFor="volume">Объём, м³</label><input id="volume" className="input num" type="number" step="0.1" min="0" value={form.volume} onChange={set("volume")} /></div>
          <div className="field"><label htmlFor="body">Кузов</label>
            <select id="body" className="select" value={form.body} onChange={set("body")}>{meta.bodyTypes.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div className="field"><label htmlFor="kind">Что везём</label><input id="kind" className="input" value={form.kind} onChange={set("kind")} placeholder="стройматериалы" /></div>
          <div className="field"><label htmlFor="price">Ставка, ₸</label><input id="price" className="input num" type="number" step="1000" min="0" value={form.price} onChange={set("price")} required /></div>
        </div>
        {rate && (
          <div className="mini" style={{ background: "var(--muted)" }}>
            <div className="row between">
              <span>Рыночная ставка: <strong className="num">{money(rate.low)} – {money(rate.high)}</strong> · ~{rate.distanceKm} км · {rate.perKm} ₸/км</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm((f) => ({ ...f, price: String(rate.market) }))}>Поставить {money(rate.market)}</button>
            </div>
            <span className="xs muted">По данным: {rate.basedOn}</span>
          </div>
        )}
        <div className="field"><label htmlFor="notes">Особые условия</label><textarea id="notes" className="textarea" value={form.notes} onChange={set("notes")} placeholder="Время загрузки, ремни, температурный режим…" /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="row"><button className="btn btn-primary" disabled={saving}>{saving ? "Сохраняю…" : priceTooLow && lowConfirmed ? "Опубликовать с такой ставкой" : "Опубликовать груз"}</button>
          <span className="xs muted">Подходящие свободные водители получат уведомление</span></div>
      </form>
    </>
  );
}
