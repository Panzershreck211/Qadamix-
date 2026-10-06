import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Icon, useApi } from "./ui.jsx";
import Assistant from "./Assistant.jsx";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="QADAMIX — на главную">
      <span className="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 17.5 9.5 12 4 6.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.5 18h7" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="logo-text">QADAMIX</span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chat, setChat] = useState({ conversationId: null, messages: [] });
  const notif = useApi("/notifications", { interval: 20000 });
  const unread = notif.data?.unread ?? 0;

  const links = [
    { to: "/", label: "Главная", icon: "dashboard", end: true },
    { to: "/cargos", label: "Грузы", icon: "package" },
    { to: "/drivers", label: "Водители", icon: "truck" },
    { to: "/analytics", label: "Аналитика", icon: "chart" },
    ...(user.role === "admin" ? [{ to: "/admin", label: "Проверка", icon: "shield" }] : []),
  ];

  return (
    <div className="app-bg">
      <header className="header">
        <div className="container header-inner">
          <Logo />
          <nav className="nav" aria-label="Разделы">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}><Icon name={l.icon} />{l.label}</NavLink>
            ))}
          </nav>
          <div className="header-right">
            <Link to="/notifications" className="icon-btn" aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`}>
              <Icon name="bell" />
              {unread > 0 && <span className="dot">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <div className="user-chip">
              <strong className="small">{user.name}</strong>
              <span className="xs muted">{user.company ?? (user.role === "admin" ? "Администратор" : "Логист")}</span>
            </div>
            <button className="icon-btn" onClick={logout} aria-label="Выйти" title="Выйти"><Icon name="logout" /></button>
          </div>
        </div>
      </header>
      <main className="container page">
        <Outlet context={{ reloadNotifications: notif.reload, openAssistant: () => setAssistantOpen(true) }} />
      </main>
      {!assistantOpen && (
        <button className="fab" onClick={() => setAssistantOpen(true)}><Icon name="sparkles" />AI-диспетчер</button>
      )}
      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} state={chat} setState={setChat} />
    </div>
  );
}
