import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Logo } from "../components/Layout.jsx";

const DEMO = [
  ["+7 701 000 00 01", "Логист · Айгерим Сапарова, Qadam Logistics"],
  ["+7 701 000 00 02", "Логист · Данияр Ермеков, Ак Жол Логистик"],
  ["+7 701 000 00 00", "Администратор · проверка водителей"],
];

export default function Login() {
  const { login } = useAuth();
  const [step, setStep] = useState("phone"); // phone → code → register
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [reg, setReg] = useState({ name: "", company: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e?.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await api("/auth/request-code", { method: "POST", body: { phone } });
      setDevCode(r.devCode ?? null);
      setCode("");
      setStep("code");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function verify(e) {
    e?.preventDefault();
    setError(null); setBusy(true);
    try {
      const body = { phone, code, ...(step === "register" ? { role: "logist", name: reg.name, company: reg.company || undefined } : {}) };
      const r = await api("/auth/verify", { method: "POST", body });
      if (r.user.role === "driver") {
        setError("Кабинет водителя — в мобильном приложении QADAMIX. Здесь работают логисты.");
        return;
      }
      login(r.token, r.user);
    } catch (err) {
      if (err.data?.needsRegistration) { setStep("register"); setError(null); }
      else setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap app-bg">
      <div className="card login-card">
        <Logo />
        <div>
          <h1 className="page-title" style={{ fontSize: "1.5rem" }}>
            {step === "register" ? "Регистрация логиста" : "Вход в кабинет логиста"}
          </h1>
          <p className="page-sub">
            {step === "phone" && "Введите номер телефона — пришлём код для входа."}
            {step === "code" && `Код отправлен на ${phone}.`}
            {step === "register" && "Номер подтверждён. Расскажите о себе — это увидят водители."}
          </p>
        </div>

        {step === "phone" && (
          <form className="stack" onSubmit={requestCode}>
            <div className="field">
              <label htmlFor="phone">Номер телефона</label>
              <input id="phone" className="input" inputMode="tel" autoComplete="tel" placeholder="+7 7XX XXX XX XX"
                value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <button className="btn btn-primary" disabled={busy || phone.replace(/\D/g, "").length < 10}>Получить код</button>
          </form>
        )}

        {step === "code" && (
          <form className="stack" onSubmit={verify}>
            <div className="field">
              <label htmlFor="code">Код из SMS</label>
              <input id="code" className="input num" inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="0000"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus required />
            </div>
            {devCode && <div className="badge b-info">SMS ещё не подключены. Код для входа: {devCode}</div>}
            <button className="btn btn-primary" disabled={busy || code.length !== 4}>Войти</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep("phone")}>Другой номер</button>
          </form>
        )}

        {step === "register" && (
          <form className="stack" onSubmit={verify}>
            <div className="field">
              <label htmlFor="name">Имя и фамилия</label>
              <input id="name" className="input" autoComplete="name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} required minLength={2} />
            </div>
            <div className="field">
              <label htmlFor="company">Компания</label>
              <input id="company" className="input" autoComplete="organization" placeholder="ТОО «…»" value={reg.company} onChange={(e) => setReg({ ...reg, company: e.target.value })} />
            </div>
            <button className="btn btn-primary" disabled={busy || reg.name.trim().length < 2}>Создать кабинет</button>
          </form>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        {step === "phone" && (
          <div className="demo-accounts">
            <span className="xs muted">Демо-аккаунты:</span>
            {DEMO.map(([p, label]) => (
              <button key={p} type="button" onClick={() => setPhone(p)}><strong className="num">{p}</strong> — {label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
