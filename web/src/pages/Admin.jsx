import { useState } from "react";
import { api } from "../api.js";
import { initials, dateTime } from "../format.js";
import { VerifyBadge, DriverStatusBadge, Empty, useApi, useToast } from "../components/ui.jsx";

export default function Admin() {
  const toast = useToast();
  const [filter, setFilter] = useState("pending");
  const { data, reload } = useApi(`/admin/drivers${filter ? `?verify=${filter}` : ""}`);

  async function setVerify(d, verify) {
    try {
      await api(`/admin/drivers/${d.user_id}/verify`, { method: "POST", body: { verify } });
      toast(`${d.name}: ${verify === "verified" ? "документы приняты" : "документы отклонены"}`);
      reload(true);
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Проверка водителей</h1>
          <p className="page-sub">Документы водителя проверяются вручную, после этого логисты видят отметку «Проверен»</p>
        </div>
        <div className="seg" role="group" aria-label="Фильтр">
          {[["pending", "Ждут проверки"], ["none", "Без документов"], ["rejected", "Отклонены"], ["verified", "Проверены"], ["", "Все"]].map(([v, l]) => (
            <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>
      <section className="card">
        {!data ? <Empty title="Загружаем…" /> : data.length === 0 ? <Empty icon="shield" title="Очередь пуста" /> : data.map((d) => (
          <div key={d.user_id} className="list-item">
            <div className="avatar">{initials(d.name)}</div>
            <div className="grow">
              <div className="row"><strong>{d.name}</strong><VerifyBadge verify={d.verify} /><DriverStatusBadge status={d.status} /></div>
              <div className="small muted">{d.phone} · {d.vehicle_model ?? "машина не указана"} · {d.body ?? "—"} · {d.capacity ?? "?"} т · {d.plate ?? "без номера"} · {d.city}</div>
              <div className="xs muted">Зарегистрирован {dateTime(d.created_at)}</div>
            </div>
            <div className="row">
              {d.verify !== "rejected" && <button className="btn btn-danger btn-sm" onClick={() => setVerify(d, "rejected")}>Отклонить</button>}
              {d.verify !== "verified" && <button className="btn btn-success btn-sm" onClick={() => setVerify(d, "verified")}>Подтвердить</button>}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
