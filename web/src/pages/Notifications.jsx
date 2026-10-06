import { useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../api.js";
import { ago } from "../format.js";
import { Icon, Empty, useApi } from "../components/ui.jsx";

export default function Notifications() {
  const navigate = useNavigate();
  const { reloadNotifications } = useOutletContext();
  const { data, reload } = useApi("/notifications", { interval: 20000 });

  async function markRead(id) {
    await api("/notifications/read", { method: "POST", body: id ? { id } : {} });
    reload(true);
    reloadNotifications();
  }

  async function open(n) {
    if (!n.read) await markRead(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Уведомления</h1>
          <p className="page-sub">{data ? (data.unread ? `Непрочитанных: ${data.unread}` : "Всё прочитано") : " "}</p>
        </div>
        {data?.unread > 0 && <button className="btn btn-outline" onClick={() => markRead()}>Отметить всё прочитанным</button>}
      </div>
      <section className="card">
        {!data ? <Empty title="Загружаем…" /> : data.items.length === 0 ? <Empty icon="bell" title="Уведомлений пока нет" /> : (
          data.items.map((n) => (
            <button key={n.id} className="list-item" style={{ width: "100%", textAlign: "left" }} onClick={() => open(n)}>
              <span className="avatar" style={n.read ? { background: "var(--muted)", color: "var(--muted-fg)" } : undefined}><Icon name="bell" /></span>
              <span className="grow">
                <span className="row between">
                  <strong style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</strong>
                  <span className="xs muted">{ago(n.created_at)}</span>
                </span>
                {n.body && <span className="small muted" style={{ display: "block" }}>{n.body}</span>}
              </span>
            </button>
          ))
        )}
      </section>
    </>
  );
}
