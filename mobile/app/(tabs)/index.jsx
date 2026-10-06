import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { qs } from "../../src/api.js";
import { useAuth } from "../../src/auth.jsx";
import { useTheme } from "../../src/theme.js";
import { money, day, scoreTone } from "../../src/format.js";
import { Badge, Card, Chips, Empty, ErrorText, Row, Screen, T, useApi } from "../../src/ui.jsx";

export function CargoCard({ c, onPress }) {
  const theme = useTheme();
  const offered = c.my_offer_status === "pending" && c.my_offer_source === "driver";
  const invited = c.my_offer_source === "invite" && c.my_offer_status === "pending";
  return (
    <Card onPress={onPress}>
      <Row between>
        <T variant="xs" muted>{c.code} · {day(c.load_date)}</T>
        {c.match && <Badge tone={scoreTone(c.match.score)} label={`подходит на ${c.match.score}%`} />}
      </Row>
      <T variant="h2">{c.from_city} → {c.to_city}</T>
      <T muted>{c.weight} т · {c.body}{c.distance_km ? ` · ${c.distance_km} км` : ""}{c.kind ? ` · ${c.kind}` : ""}</T>
      <Row between>
        <T variant="h2" color={theme.primary}>{money(c.price)}</T>
        {c.distance_km ? <T variant="small" muted>{Math.round(c.price / c.distance_km)} ₸/км</T> : null}
      </Row>
      {c.match?.reasons && <T variant="xs" muted>{c.match.reasons.slice(0, 3).join(" · ")}</T>}
      {(offered || invited) && (
        <View style={{ marginTop: 2 }}>
          {offered && <Badge tone="primary" icon="paper-plane" label="Вы откликнулись" />}
          {invited && <Badge tone="success" icon="star" label="Логист приглашает вас" />}
        </View>
      )}
    </Card>
  );
}

export default function Market() {
  const router = useRouter();
  const theme = useTheme();
  const { driver, meta } = useAuth();
  const [scope, setScope] = useState("fit"); // fit — подходящие, near — из моего города, all — все
  const [body, setBody] = useState("");
  // «В моём городе» показывает все грузы оттуда (с оценкой), «Под мою машину» — только подходящие
  const path = `/market${qs({ all: scope !== "fit" ? 1 : undefined, from: scope === "near" ? driver?.city : undefined, body })}`;
  const { data, error, loading, reload } = useApi(path, { interval: 30000 });

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload}>
      <T muted>Машина: {driver?.vehicle_model ?? "не указана"} · {driver?.body} · {driver?.capacity} т · сейчас: {driver?.city}</T>
      <Chips options={[["fit", "Под мою машину"], ["near", "Загрузка в моём городе"], ["all", "Все грузы"]]} value={scope} onChange={setScope} />
      <Chips options={[["", "Любой кузов"], ...meta.bodyTypes.map((b) => [b, b])]} value={body} onChange={setBody} />
      <ErrorText error={error} />
      {data?.length === 0 && (
        <Empty icon="search-outline" title="Подходящих грузов нет" text={scope === "fit" ? "Покажем все грузы, даже если они не идеально подходят машине" : "Потяните вниз, чтобы обновить"}>
          {scope !== "all" && <T color={theme.primary} onPress={() => setScope("all")} style={{ fontWeight: "700" }}>Показать все грузы</T>}
        </Empty>
      )}
      {data?.map((c) => <CargoCard key={c.code} c={c} onPress={() => router.push(`/cargo/${c.code}`)} />)}
    </Screen>
  );
}
