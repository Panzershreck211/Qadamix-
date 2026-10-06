import { useEffect, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/api.js";
import { useTheme } from "../../src/theme.js";
import { money, day, scoreTone, OFFER_STATUS, STATUS } from "../../src/format.js";
import { Badge, Button, Card, Empty, ErrorText, Field, Row, Screen, T, useApi } from "../../src/ui.jsx";

// Подтверждение действия: на телефоне — системный диалог, в браузере — window.confirm
function confirmAction(title, message) {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => Alert.alert(title, message, [
    { text: "Отмена", style: "cancel", onPress: () => resolve(false) },
    { text: "Да", onPress: () => resolve(true) },
  ]));
}

export default function CargoScreen() {
  const { code } = useLocalSearchParams();
  const router = useRouter();
  const c = useTheme();
  const { data: cargo, error, reload } = useApi(`/cargos/${code}`);
  const [price, setPrice] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (cargo) setPrice(String(cargo.myOffer?.source === "driver" ? cargo.myOffer.price : cargo.price));
  }, [cargo?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Screen><Empty icon="alert-circle-outline" title="Груз недоступен" text={error.message} /></Screen>;
  if (!cargo) return <Screen><Empty icon="hourglass-outline" title="Загружаем…" /></Screen>;

  const mine = cargo.myOffer;
  const offered = mine?.source === "driver" && mine.status !== "withdrawn";
  const isMyTrip = cargo.driver_name && !cargo.match; // назначенному водителю сервер не присылает оценку

  async function sendOffer() {
    setBusy(true); setFormError(null);
    try {
      await api(`/cargos/${cargo.code}/offers`, { method: "POST", body: { price: Number(price), comment: comment || undefined } });
      await reload();
    } catch (e) { setFormError(e.message); } finally { setBusy(false); }
  }

  async function withdraw() {
    if (!(await confirmAction("Отозвать отклик?", "Логист больше не увидит ваше предложение по этому грузу"))) return;
    setBusy(true);
    try { await api(`/offers/${mine.id}`, { method: "DELETE" }); await reload(); }
    catch (e) { setFormError(e.message); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: cargo.code }} />
      <Card>
        <Row between>
          <Badge tone={STATUS[cargo.status]?.tone} label={STATUS[cargo.status]?.label} />
          {cargo.match && <Badge tone={scoreTone(cargo.match.score)} label={`подходит на ${cargo.match.score}%`} />}
        </Row>
        <T variant="h1">{cargo.from_city} → {cargo.to_city}</T>
        <T variant="h2" color={c.primary}>{money(cargo.price)}</T>
        {cargo.distance_km ? <T muted>~{cargo.distance_km} км · {Math.round(cargo.price / cargo.distance_km)} ₸/км</T> : null}
      </Card>

      <Card>
        {[
          ["Загрузка", day(cargo.load_date)],
          ["Груз", `${cargo.weight} т${cargo.volume ? `, ${cargo.volume} м³` : ""}${cargo.kind ? ` · ${cargo.kind}` : ""}`],
          ["Кузов", cargo.body],
          ["Заказчик", cargo.logist_company ?? cargo.logist_name],
          ...(cargo.notes ? [["Условия", cargo.notes]] : []),
        ].map(([k, v]) => (
          <Row key={k} between style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <T muted>{k}</T><T style={{ flexShrink: 1, textAlign: "right", fontWeight: "600" }}>{v}</T>
          </Row>
        ))}
      </Card>

      {cargo.match?.reasons && (
        <Card>
          <T variant="h3">Почему подходит</T>
          {cargo.match.reasons.map((r) => <T key={r} muted>• {r}</T>)}
        </Card>
      )}

      {isMyTrip ? (
        <Button title="Открыть текущий рейс" icon="navigate" onPress={() => router.replace("/trip")} />
      ) : cargo.status !== "open" ? (
        <Empty icon="lock-closed-outline" title="Машина уже назначена" text="Этот груз забрал другой перевозчик" />
      ) : (
        <Card>
          <T variant="h3">{offered ? "Ваш отклик" : mine?.source === "invite" ? "Логист приглашает вас" : "Откликнуться"}</T>
          {offered && <Badge tone={OFFER_STATUS[mine.status]?.tone} label={`${OFFER_STATUS[mine.status]?.label} · ${money(mine.price)}`} />}
          <Field label="Ваша цена, ₸" value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ""))} keyboardType="number-pad" />
          {Number(price) !== cargo.price && price !== "" && (
            <T variant="small" muted>{Number(price) > cargo.price ? "Выше" : "Ниже"} ставки логиста на {money(Math.abs(Number(price) - cargo.price))}</T>
          )}
          <Field label="Комментарий" value={comment} onChangeText={setComment} placeholder="Когда сможете встать на загрузку" maxLength={500} />
          <ErrorText error={formError} />
          <Button title={offered ? "Обновить отклик" : "Откликнуться"} icon="paper-plane" onPress={sendOffer} loading={busy} disabled={!Number(price)} />
          {offered && mine.status === "pending" && <Button title="Отозвать отклик" variant="danger" small onPress={withdraw} disabled={busy} />}
        </Card>
      )}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
