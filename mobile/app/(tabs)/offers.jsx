import { useRouter } from "expo-router";
import { money, day, ago, OFFER_STATUS } from "../../src/format.js";
import { Badge, Card, Empty, ErrorText, Row, Screen, T, useApi } from "../../src/ui.jsx";

export default function Offers() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi("/my/offers", { interval: 20000 });
  const invites = (data ?? []).filter((o) => o.source === "invite" && o.status === "pending" && o.cargo_status === "open");
  const mine = (data ?? []).filter((o) => o.source === "driver");

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <ErrorText error={error} />
      {invites.length > 0 && <T variant="h3">Вас приглашают</T>}
      {invites.map((o) => (
        <Card key={o.id} onPress={() => router.push(`/cargo/${o.code}`)}>
          <Badge tone="success" icon="star" label="Логист выбрал вашу машину" />
          <T variant="h2">{o.from_city} → {o.to_city}</T>
          <T muted>{o.code} · {day(o.load_date)} · {o.weight} т · {o.body} · {money(o.cargo_price)}</T>
          <T variant="small" style={{ fontWeight: "700" }}>Откройте груз и подтвердите цену →</T>
        </Card>
      ))}

      {mine.length > 0 && <T variant="h3">Мои отклики</T>}
      {data && mine.length === 0 && invites.length === 0 && (
        <Empty icon="paper-plane-outline" title="Откликов пока нет" text="Откройте подходящий груз во вкладке «Грузы» и предложите цену" />
      )}
      {mine.map((o) => {
        const s = o.status === "accepted" && o.cargo_status === "delivered" ? { label: "Рейс выполнен", tone: "success" }
          : o.status === "accepted" && o.cargo_status === "cancelled" ? { label: "Рейс отменён", tone: "neutral" }
          : OFFER_STATUS[o.status];
        return (
          <Card key={o.id} onPress={() => (o.status === "accepted" ? router.push("/trip") : router.push(`/cargo/${o.code}`))}>
            <Row between><T variant="xs" muted>{o.code} · {ago(o.created_at)}</T><Badge tone={s.tone} label={s.label} /></Row>
            <T variant="h3">{o.from_city} → {o.to_city}</T>
            <T muted>{day(o.load_date)} · {o.weight} т · {o.body}</T>
            <T>Ваша цена: <T style={{ fontWeight: "800" }}>{money(o.price)}</T>{o.price !== o.cargo_price ? <T muted> (ставка логиста {money(o.cargo_price)})</T> : null}</T>
          </Card>
        );
      })}
    </Screen>
  );
}
