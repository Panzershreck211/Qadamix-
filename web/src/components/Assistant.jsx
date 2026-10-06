import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { money, day } from "../format.js";
import { Icon, ScoreBadge, StatusBadge, DriverStatusBadge } from "./ui.jsx";

const SUGGESTIONS = [
  "Найди машину на завтра Астана — Алматы, 20 т, тент",
  "Свободные рефы в Алматы",
  "Какие мои грузы сейчас в пути?",
  "Сколько стоит рейс Караганда — Шымкент, 18 т?",
  "Обратный груз из Актобе",
  "Статистика за месяц",
];

function Card({ card, onNavigate }) {
  if (card.type === "cargo") {
    return (
      <Link to={`/cargos/${card.code}`} className="mini card-link" onClick={onNavigate}>
        <div className="row between"><strong>{card.code}</strong>{card.score != null ? <ScoreBadge score={card.score} /> : <StatusBadge status={card.status} />}</div>
        <div className="route">{card.from_city} → {card.to_city}</div>
        <div className="muted">{day(card.load_date)} · {card.weight} т · {card.body} · {money(card.price)}</div>
      </Link>
    );
  }
  return (
    <div className="mini">
      <div className="row between">
        <strong>{card.name}</strong>
        {card.score != null ? <ScoreBadge score={card.score} /> : <DriverStatusBadge status={card.status} />}
      </div>
      <div className="muted">{card.vehicle_model} · {card.body} · {card.capacity} т · {card.city} · ★ {card.rating}</div>
      {card.reasons && <div className="xs muted">{card.reasons.join(" · ")}</div>}
      {card.phone && <div className="xs">{card.phone}</div>}
    </div>
  );
}

export default function Assistant({ open, onClose, state, setState }) {
  const { meta } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }); }, [state.messages, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(message) {
    const q = message.trim();
    if (!q || busy) return;
    setText("");
    setState((s) => ({ ...s, messages: [...s.messages, { role: "me", text: q }] }));
    setBusy(true);
    try {
      const r = await api("/assistant", { method: "POST", body: { message: q, conversationId: state.conversationId } });
      setState((s) => ({ conversationId: r.conversationId, messages: [...s.messages, { role: "bot", text: r.reply, cards: r.cards }] }));
    } catch (e) {
      setState((s) => ({ ...s, messages: [...s.messages, { role: "bot", text: e.message, error: true }] }));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="AI-диспетчер">
        <div className="drawer-head">
          <span className="logo-mark" style={{ width: 32, height: 32 }}><Icon name="bot" className="" /></span>
          <div className="grow">
            <strong>AI-диспетчер</strong>
            <div className="xs muted">{meta.assistantMode === "claude" ? "Claude · ищет по данным платформы" : "Режим правил · подключите Claude API для свободных вопросов"}</div>
          </div>
          {state.messages.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setState({ conversationId: null, messages: [] })}>Новый диалог</button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="x" /></button>
        </div>
        <div className="drawer-body" ref={bodyRef}>
          {state.messages.length === 0 && (
            <>
              <div className="msg bot">Я ищу по грузам, машинам и рейсам платформы: подберу фуру, найду свободных водителей и обратную загрузку, оценю ставку и подскажу статус рейса.</div>
              <div className="chips">
                {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            </>
          )}
          {state.messages.map((m, i) => (
            <div key={i} style={{ display: "grid", gap: ".5rem" }}>
              <div className={`msg ${m.role}`} style={m.error ? { color: "var(--danger)" } : undefined}>{m.text}</div>
              {m.cards?.length > 0 && <div className="stack">{m.cards.map((c) => <Card key={`${c.type}${c.code ?? c.id}`} card={c} onNavigate={onClose} />)}</div>}
            </div>
          ))}
          {busy && <div className="msg bot"><span className="typing"><span /><span /><span /></span></div>}
        </div>
        <form className="row" style={{ padding: ".9rem", borderTop: "1px solid var(--border)", flexWrap: "nowrap", background: "var(--card)" }}
          onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input ref={inputRef} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: свободные тенты в Караганде" aria-label="Вопрос ассистенту" maxLength={2000} />
          <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Отправить"><Icon name="send" /></button>
        </form>
      </aside>
    </>
  );
}
