import { useState } from "react";
import { Link, useParams, useOutletContext } from "react-router-dom";
import { api } from "../api.js";
import { money, day, dateTime, ago, STATUS, initials, tripsLabel } from "../format.js";
import { Icon, StatusBadge, VerifyBadge, DriverStatusBadge, ScoreBadge, Empty, Dialog, useApi, useToast } from "../components/ui.jsx";
import { TrackMap } from "../components/Map.jsx";

const FLOW = ["assigned", "loading", "in_transit", "delivered"];
const FLOW_LABELS = ["Назначена", "Загрузка", "В пути", "Доставлен"];

export default function CargoDetail() {
  const { code } = useParams();
  const { reloadNotifications } = useOutletContext();
  const toast = useToast();
  const cargo = useApi(`/cargos/${code}`, { interval: 15000 });
  const offers = useApi(`/cargos/${code}/offers`, { interval: 15000 });
  const isOpen = cargo.data?.status === "open";
  const matches = useApi(isOpen ? `/cargos/${code}/matches?limit=8` : null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const reloadAll = () => { cargo.reload(true); offers.reload(true); if (isOpen) matches.reload(true); reloadNotifications?.(); };

  async function act(path, okText, body) {
    setBusy(true);
    try {
      await api(path, { method: "POST", body });
      toast(okText);
      reloadAll();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); setConfirm(null); }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api(`/cargos/${code}`, { method: "PATCH", body: { status: "cancelled" } });
      toast(`Груз ${code} отменён`);
      reloadAll();
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); setConfirm(null); }
  }

  if (cargo.error) return <Empty title="Груз не найден">{cargo.error.message} <Link to="/cargos">К списку грузов</Link></Empty>;
  const c = cargo.data;
  if (!c) return <Empty title="Загружаем…" />;

  const step = FLOW.indexOf(c.status);
  const pending = (offers.data ?? []).filter((o) => o.status === "pending" && o.source === "driver");
  const invited = (offers.data ?? []).filter((o) => o.status === "pending" && o.source === "invite");

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/cargos" className="small muted row" style={{ gap: ".25rem" }}><Icon name="arrowLeft" />Грузы</Link>
          <div className="row" style={{ marginTop: ".25rem" }}>
            <h1 className="page-title">{c.from_city} → {c.to_city}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="page-sub">{c.code} · загрузка {day(c.load_date)} · {c.weight} т · {c.body}{c.kind ? ` · ${c.kind}` : ""}</p>
        </div>
        <div className="row">
          {["assigned", "loading", "in_transit", "delivered"].includes(c.status) && (
            <Link to={`/cargos/${c.code}/contract`} className="btn btn-outline"><Icon name="file" />Договор-заявка</Link>
          )}
          {["open", "assigned"].includes(c.status) && (
            <button className="btn btn-danger" onClick={() => setConfirm({ type: "cancel" })}>Отменить груз</button>
          )}
        </div>
      </div>

      <div className="grid two-col">
        <div className="grid" style={{ alignContent: "start" }}>
          {c.status !== "open" && c.status !== "cancelled" && (
            <section className="card card-pad stack">
              <div className="steps" aria-label="Этапы рейса">{FLOW.map((s, i) => <div key={s} className={`step ${i <= step ? "on" : ""}`} />)}</div>
              <div className="steps xs muted">{FLOW_LABELS.map((l) => <span key={l}>{l}</span>)}</div>
              {c.driver_name && (
                <div className="row" style={{ marginTop: ".5rem" }}>
                  <div className="avatar">{initials(c.driver_name)}</div>
                  <div className="grow">
                    <strong>{c.driver_name}</strong>
                    <div className="small muted">{c.driver_vehicle} · {c.driver_body} · {c.driver_capacity} т{c.driver_plate ? ` · ${c.driver_plate}` : ""}</div>
                  </div>
                  <a className="btn btn-outline btn-sm" href={`tel:${c.driver_phone}`}><Icon name="phone" />{c.driver_phone}</a>
                </div>
              )}
            </section>
          )}

          {["assigned", "loading", "in_transit", "delivered"].includes(c.status) && <TrackCard code={c.code} status={c.status} />}

          {isOpen && (
            <section className="card card-pad">
              <div className="card-head">
                <h2 className="card-title">Отклики водителей</h2>
                <span className="xs muted">обновляется автоматически</span>
              </div>
              {pending.length === 0 ? (
                <Empty icon="truck" title="Откликов пока нет">Пригласите подходящих водителей из подбора ниже — им придёт уведомление.</Empty>
              ) : (
                <div className="stack">
                  {pending.map((o) => (
                    <div key={o.id} className="mini">
                      <div className="row between">
                        <div className="row">
                          <div className="avatar">{initials(o.driver_name)}</div>
                          <div>
                            <strong>{o.driver_name}</strong>
                            <div className="xs muted">★ {o.rating} · {tripsLabel(o.trips)} · {o.vehicle_model} · {o.body} {o.capacity} т · {o.city}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="kpi-value" style={{ fontSize: "1.2rem" }}>{money(o.price)}</div>
                          {o.price !== c.price && <div className={`xs ${o.price < c.price ? "" : "muted"}`} style={o.price < c.price ? { color: "var(--success)" } : undefined}>{o.price < c.price ? "ниже" : "выше"} вашей ставки на {money(Math.abs(o.price - c.price))}</div>}
                        </div>
                      </div>
                      {o.comment && <div className="small">«{o.comment}»</div>}
                      <div className="row between">
                        <div className="row"><VerifyBadge verify={o.verify} /><span className="xs muted">{ago(o.created_at)}</span></div>
                        <div className="row">
                          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(`/offers/${o.id}/reject`, "Отклик отклонён")}>Отклонить</button>
                          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setConfirm({ type: "accept", offer: o })}><Icon name="check" />Выбрать</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {invited.length > 0 && <p className="xs muted" style={{ marginTop: ".75rem" }}>Приглашены и ещё не ответили: {invited.map((o) => o.driver_name).join(", ")}</p>}
            </section>
          )}

          {isOpen && (
            <section className="card card-pad">
              <div className="card-head">
                <h2 className="card-title">Подбор машин</h2>
                <span className="xs muted">по кузову, тоннажу, расстоянию до загрузки и проверке документов</span>
              </div>
              {!matches.data ? <Empty title="Подбираем…" /> : (
                <div className="stack">
                  {matches.data.map((d) => {
                    const state = d.offer?.source === "driver" ? "откликнулся" : d.offer ? "приглашён" : null;
                    return (
                      <div key={d.id} className="list-item" style={{ padding: ".6rem 0" }}>
                        <div className="avatar">{initials(d.name)}</div>
                        <div className="grow">
                          <div className="row"><strong>{d.name}</strong><ScoreBadge score={d.score} /><DriverStatusBadge status={d.status} /></div>
                          <div className="xs muted">{d.vehicle_model} · {d.body} · {d.capacity} т · {d.city} · ★ {d.rating}</div>
                          <div className="xs">{d.reasons.join(" · ")}</div>
                        </div>
                        {state ? <span className="badge b-neutral">{state}</span> : (
                          <button className="btn btn-outline btn-sm" disabled={busy || d.status !== "free"} onClick={() => act(`/cargos/${c.code}/invite`, `${d.name} получил приглашение`, { driverId: d.id })}>
                            <Icon name="send" />Пригласить
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {c.status === "delivered" && <ReviewBox cargo={c} onDone={() => cargo.reload(true)} />}
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card card-pad">
            <h2 className="card-title" style={{ marginBottom: ".75rem" }}>Параметры</h2>
            <dl className="stack small">
              {[
                ["Ставка", <strong className="num" key="p">{money(c.price)}</strong>],
                ["Расстояние", c.distance_km ? `~${c.distance_km} км · ${money(c.price / c.distance_km)}/км` : "—"],
                ["Загрузка", day(c.load_date)],
                ["Вес / объём", `${c.weight} т${c.volume ? ` / ${c.volume} м³` : ""}`],
                ["Кузов", c.body],
                ["Груз", c.kind || "—"],
                ["Условия", c.notes || "—"],
                ["Создан", dateTime(c.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="row between" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <dt className="muted">{k}</dt><dd style={{ textAlign: "right" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="card-title" style={{ marginBottom: ".75rem" }}>История рейса</h2>
            {c.events.length === 0 ? <p className="small muted">Событий пока нет — появятся, когда водитель начнёт рейс.</p> : (
              <div className="timeline">
                {c.events.map((e) => (
                  <div key={e.id} className={`tl-item ${e.status === "note" ? "note" : "done"}`}>
                    <span className="tl-dot" />
                    <div>
                      <div className="row"><strong className="small">{STATUS[e.status]?.label ?? "Комментарий"}</strong>{e.city && <span className="xs muted">· {e.city}</span>}</div>
                      {e.note && <div className="small">{e.note}</div>}
                      <div className="xs muted">{dateTime(e.created_at)} · {e.author}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {confirm?.type === "accept" && (
        <Dialog title="Выбрать перевозчика?" onClose={() => setConfirm(null)}>
          <p>{confirm.offer.driver_name} повезёт {c.code} {c.from_city} → {c.to_city} за <strong>{money(confirm.offer.price)}</strong>. Остальные отклики будут отклонены, водителям придёт уведомление.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Отмена</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => act(`/offers/${confirm.offer.id}/accept`, `${confirm.offer.driver_name} назначен на рейс`)}>Назначить</button>
          </div>
        </Dialog>
      )}
      {confirm?.type === "cancel" && (
        <Dialog title={`Отменить ${c.code}?`} onClose={() => setConfirm(null)}>
          <p>Груз снимется с публикации{c.driver_name ? `, водитель ${c.driver_name} получит уведомление` : ", отклики будут отклонены"}.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Не отменять</button>
            <button className="btn btn-danger" disabled={busy} onClick={cancel}>Отменить груз</button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function TrackCard({ code, status }) {
  const live = ["assigned", "loading", "in_transit"].includes(status);
  const { data: t } = useApi(`/cargos/${code}/track`, { interval: live ? 10000 : 0 });
  if (!t) return null;
  const etaText = t.eta_at
    ? new Date(t.eta_at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : status === "delivered" ? "доставлен" : "—";
  return (
    <section className="card card-pad stack">
      <div className="row between">
        <h2 className="card-title">Где машина</h2>
        <span className="small">
          <span className={`live-dot ${t.signal === "live" ? "" : "off"}`} />
          {t.signal === "live" ? "GPS на связи" : t.signal === "stale" ? `последний сигнал ${ago(t.last.at)}` : live ? "водитель ещё не включил GPS" : "трек записан"}
        </span>
      </div>
      {t.last || t.track?.length ? <TrackMap track={t} /> : (
        <Empty icon="pin" title="Точек пока нет">Координаты появятся, когда водитель включит передачу GPS в приложении.</Empty>
      )}
      {t.last && (
        <div className="gps-stats">
          <div><div className="k">Сейчас</div><div className="v">{t.last.nearest.km <= 15 ? t.last.nearest.name : `${t.last.nearest.name}, ${t.last.nearest.km} км`}</div></div>
          <div><div className="k">Скорость</div><div className="v">{t.last.speed_kmh != null ? `${Math.round(t.last.speed_kmh)} км/ч` : "—"}</div></div>
          <div><div className="k">Пройдено</div><div className="v">{t.traveled_km} км</div></div>
          <div><div className="k">Осталось</div><div className="v">{t.remaining_km != null ? `~${t.remaining_km} км` : "—"}</div></div>
          <div><div className="k">Прибытие</div><div className="v">{etaText}</div></div>
        </div>
      )}
      {t.progress != null && <div className="progress" aria-label={`Пройдено ${Math.round(t.progress * 100)}%`}><span style={{ width: `${t.progress * 100}%` }} /></div>}
    </section>
  );
}

function ReviewBox({ cargo, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(cargo.review?.rating ?? 5);
  const [comment, setComment] = useState(cargo.review?.comment ?? "");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/cargos/${cargo.code}/review`, { method: "POST", body: { rating, comment } });
      toast("Отзыв сохранён — рейтинг водителя обновлён");
      onDone();
    } catch (err) { toast(err.message, "error"); } finally { setBusy(false); }
  }
  return (
    <form className="card card-pad stack" onSubmit={submit}>
      <h2 className="card-title">{cargo.review ? "Ваш отзыв" : "Оцените перевозчика"}</h2>
      <div className="row" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} из 5`} onClick={() => setRating(n)}
            style={{ color: n <= rating ? "var(--warning)" : "var(--border)" }}>
            <Icon name="star" className="" />
          </button>
        ))}
      </div>
      <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Как прошёл рейс?" aria-label="Комментарий" />
      <div><button className="btn btn-primary" disabled={busy}>{cargo.review ? "Обновить отзыв" : "Отправить отзыв"}</button></div>
    </form>
  );
}
