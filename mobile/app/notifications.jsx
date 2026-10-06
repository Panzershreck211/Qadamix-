import { useRouter } from "expo-router";
import { api } from "../src/api.js";
import { ago } from "../src/format.js";
import { useTheme } from "../src/theme.js";
import { Button, Card, Empty, Row, Screen, T, useApi } from "../src/ui.jsx";

// Ссылки в уведомлениях с сервера → экраны приложения
const route = (link) => {
  if (!link) return null;
  if (link.startsWith("/trip")) return "/trip";
  if (link.startsWith("/cargo/")) return link;
  return null;
};

export default function Notifications() {
  const c = useTheme();
  const router = useRouter();
  const { data, reload, loading } = useApi("/notifications");

  async function open(n) {
    if (!n.read) await api("/notifications/read", { method: "POST", body: { id: n.id } }).catch(() => {});
    const to = route(n.link);
    if (to) router.push(to);
    else reload();
  }

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      {data?.unread > 0 && (
        <Button title="Отметить всё прочитанным" variant="outline" small
          onPress={async () => { await api("/notifications/read", { method: "POST", body: {} }); reload(); }} />
      )}
      {data?.items.length === 0 && <Empty icon="notifications-outline" title="Уведомлений пока нет" />}
      {data?.items.map((n) => (
        <Card key={n.id} onPress={() => open(n)} style={!n.read ? { borderColor: c.primary } : undefined}>
          <Row between style={{ flexWrap: "nowrap" }}>
            <T style={{ fontWeight: n.read ? "500" : "800", flexShrink: 1 }}>{n.title}</T>
            <T variant="xs" muted>{ago(n.created_at)}</T>
          </Row>
          {n.body && <T muted variant="small">{n.body}</T>}
        </Card>
      ))}
    </Screen>
  );
}
