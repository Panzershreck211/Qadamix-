import { useState } from "react";
import { Linking, Switch, View } from "react-native";
import { api } from "../../src/api.js";
import { useAuth } from "../../src/auth.jsx";
import { useTheme } from "../../src/theme.js";
import { money, day, dateTime, ago, STATUS } from "../../src/format.js";
import { useGps, startTracking, stopTracking } from "../../src/gps.js";
import { Badge, Button, Card, Chips, Empty, ErrorText, Field, Row, Screen, T, useApi } from "../../src/ui.jsx";

// Следующий шаг рейса и подпись главной кнопки
const NEXT = {
  assigned: { status: "loading", title: "Я на загрузке", icon: "cube" },
  loading: { status: "in_transit", title: "Загрузился, выехал", icon: "navigate" },
  in_transit: { status: "delivered", title: "Груз доставлен", icon: "checkmark-circle" },
};
const FLOW = ["assigned", "loading", "in_transit", "delivered"];

export default function Trip() {
  const c = useTheme();
  const { refresh, meta } = useAuth();
  const { data: trips, error, loading, reload } = useApi("/my/trips", { interval: 30000 });
  const active = trips?.find((t) => ["assigned", "loading", "in_transit"].includes(t.status));
  const history = (trips ?? []).filter((t) => t !== active).slice(0, 10);
  const detail = useApi(active ? `/cargos/${active.code}` : null);
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const gps = useGps();
  const [gpsBusy, setGpsBusy] = useState(false);

  async function toggleGps(on) {
    setGpsBusy(true);
    try { on ? await startTracking() : await stopTracking(); } finally { setGpsBusy(false); }
  }

  async function post(status) {
    setBusy(true); setMsg(null);
    try {
      await api(`/cargos/${active.code}/events`, { method: "POST", body: { status, city: city || undefined, note: note || undefined } });
      setNote(""); setCity("");
      setMsg(status === "note" ? "Комментарий отправлен логисту" : `Статус обновлён: ${STATUS[status].label}`);
      if (status === "delivered" && gps.mode !== "off") await stopTracking(); // рейс закрыт — координаты больше не передаём
      await Promise.all([reload(), detail.reload(), refresh()]);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  if (!trips) return <Screen><ErrorText error={error} />{!error && <Empty icon="hourglass-outline" title="Загружаем…" />}</Screen>;

  return (
    <Screen refreshing={loading} onRefresh={() => { reload(); detail.reload(); }}>
      {!active ? (
        msg?.startsWith("Статус обновлён: Доставлен") ? (
          // Рейс только что закрыт — карточка рейса исчезла, поэтому подтверждаем отдельно
          <Card style={{ borderColor: c.success }}>
            <Badge tone="success" icon="checkmark-circle" label="Рейс завершён" />
            <T variant="h3">Груз доставлен — спасибо!</T>
            <T muted>Логист получил уведомление. Статус «Свободен» включён — новые подходящие грузы появятся во вкладке «Грузы».</T>
          </Card>
        ) : (
          <Empty icon="navigate-outline" title="Активного рейса нет" text="Когда логист примет ваш отклик, рейс появится здесь" />
        )
      ) : (
        <>
          <Card>
            <Row between><T variant="xs" muted>{active.code} · загрузка {day(active.load_date)}</T><Badge tone={STATUS[active.status].tone} label={STATUS[active.status].label} /></Row>
            <T variant="h1">{active.from_city} → {active.to_city}</T>
            <T muted>{active.weight} т · {active.body}{active.kind ? ` · ${active.kind}` : ""}{active.distance_km ? ` · ~${active.distance_km} км` : ""}</T>
            <T variant="h2" color={c.primary}>{money(active.price)}</T>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
              {FLOW.map((s, i) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= FLOW.indexOf(active.status) ? c.primary : c.soft }} />)}
            </View>
          </Card>

          <Card>
            <T variant="h3">Обновить статус</T>
            <T variant="small" muted>Логист видит статус сразу — без звонков</T>
            <T variant="small" style={{ fontWeight: "700" }}>Где вы сейчас (необязательно)</T>
            <Chips options={[active.from_city, active.to_city, ...meta.cities.filter((x) => x !== active.from_city && x !== active.to_city)]} value={city} onChange={setCity} allowEmpty />
            <Field placeholder="Комментарий: задержка, пробка, документы…" value={note} onChangeText={setNote} maxLength={500} />
            <Button title={NEXT[active.status].title} icon={NEXT[active.status].icon} variant={active.status === "in_transit" ? "success" : "primary"}
              onPress={() => post(NEXT[active.status].status)} loading={busy} />
            <Button title="Отправить только комментарий" variant="outline" small onPress={() => post("note")} disabled={busy || (!note && !city)} />
            {msg && <T variant="small" muted>{msg}</T>}
          </Card>

          <Card style={gps.mode === "off" ? { borderColor: c.warning } : undefined}>
            <Row between style={{ flexWrap: "nowrap" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="h3">Передавать GPS</T>
                <T variant="small" muted>
                  {gps.mode === "background" && "Работает в фоне — можно открыть навигатор"}
                  {gps.mode === "foreground" && "Работает, пока приложение открыто"}
                  {gps.mode === "off" && "Заказчик не видит машину на карте"}
                </T>
              </View>
              <Switch value={gps.mode !== "off"} onValueChange={toggleGps} disabled={gpsBusy}
                trackColor={{ true: c.primary, false: c.border }} accessibilityLabel="Передавать GPS" />
            </Row>
            {gps.mode !== "off" && (
              <T variant="small" muted>
                {gps.lastSentAt ? `Отправлено ${ago(gps.lastSentAt)}` : "Ищем спутники…"}
                {gps.nearestCity ? ` · рядом ${gps.nearestCity.name}${gps.nearestCity.km > 5 ? ` (${gps.nearestCity.km} км)` : ""}` : ""}
                {gps.lastPoint?.speed != null ? ` · ${gps.lastPoint.speed} км/ч` : ""}
              </T>
            )}
            {gps.queued > 0 && <Badge tone="warning" icon="cloud-offline" label={`В очереди точек: ${gps.queued}`} />}
            {gps.error && <T variant="small" color={c.warning}>{gps.error}</T>}
            {gps.mode === "foreground" && <T variant="xs" muted>В фоне GPS работает только в установленной версии приложения, не в Expo Go и не в браузере.</T>}
          </Card>

          <Card>
            <T variant="h3">Заказчик</T>
            <T>{active.logist_company ?? active.logist_name} · {active.logist_name}</T>
            <Button title={`Позвонить ${active.logist_phone}`} icon="call" variant="outline" small onPress={() => Linking.openURL(`tel:${active.logist_phone}`)} />
          </Card>

          {detail.data?.events?.length > 0 && (
            <Card>
              <T variant="h3">История</T>
              {[...detail.data.events].reverse().map((e) => (
                <View key={e.id} style={{ gap: 2, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <T style={{ fontWeight: "700" }}>{STATUS[e.status]?.label ?? "Комментарий"}{e.city ? ` · ${e.city}` : ""}</T>
                  {e.note && <T variant="small">{e.note}</T>}
                  <T variant="xs" muted>{dateTime(e.created_at)}</T>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {history.length > 0 && <T variant="h3" style={{ marginTop: 8 }}>Прошлые рейсы</T>}
      {history.map((t) => (
        <Card key={t.code}>
          <Row between><T style={{ fontWeight: "700" }}>{t.from_city} → {t.to_city}</T><Badge tone={STATUS[t.status].tone} label={STATUS[t.status].label} /></Row>
          <T variant="small" muted>{t.code} · {day(t.load_date)} · {money(t.price)}</T>
        </Card>
      ))}
    </Screen>
  );
}
