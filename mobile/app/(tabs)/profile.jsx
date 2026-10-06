import { useState } from "react";
import { View } from "react-native";
import { api } from "../../src/api.js";
import { useAuth } from "../../src/auth.jsx";
import { useTheme } from "../../src/theme.js";
import { tripsLabel } from "../../src/format.js";
import { Badge, Button, Card, Chips, ErrorText, Field, Row, Screen, T } from "../../src/ui.jsx";

const VERIFY = {
  verified: ["success", "Документы проверены"], pending: ["warning", "Документы на проверке"],
  rejected: ["danger", "Документы отклонены"], none: ["danger", "Документы не загружены"],
};
const STATUS_OPTIONS = [["free", "Свободен"], ["busy", "Занят"], ["offline", "Не на линии"]];

export default function Profile() {
  const c = useTheme();
  const { user, driver, refresh, logout, meta } = useAuth();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function patch(body) {
    setBusy(true); setError(null);
    try { await api("/me/driver", { method: "PATCH", body }); await refresh(); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }

  const startEdit = () => {
    setForm({ name: user.name, vehicleModel: driver.vehicle_model ?? "", body: driver.body ?? "Тент", capacity: String(driver.capacity ?? ""), plate: driver.plate ?? "", directions: driver.directions ?? "" });
    setEdit(true);
  };
  const [vTone, vLabel] = VERIFY[driver?.verify] ?? VERIFY.none;

  return (
    <Screen>
      <Card>
        <Row>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <T variant="h2" color={c.primary}>{user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="h2">{user.name}</T>
            <T muted>{user.phone} · ★ {driver?.rating || "—"} · {tripsLabel(driver?.trips ?? 0)}</T>
          </View>
        </Row>
        <Badge tone={vTone} icon="shield-checkmark" label={vLabel} />
        {driver?.verify !== "verified" && <T variant="small" muted>Логисты чаще выбирают проверенных водителей. Проверку документов проводит администратор QADAMIX.</T>}
      </Card>

      <Card>
        <T variant="h3">Мой статус</T>
        <T variant="small" muted>Свободных водителей логисты видят в подборе и приглашают на рейсы</T>
        <Chips options={STATUS_OPTIONS} value={driver?.status} onChange={(v) => v !== driver.status && patch({ status: v })} />
        <T variant="h3" style={{ marginTop: 6 }}>Где машина сейчас</T>
        <Chips options={[driver?.city, ...meta.cities.filter((x) => x !== driver?.city)].filter(Boolean)} value={driver?.city} onChange={(v) => v !== driver.city && patch({ city: v })} />
      </Card>

      {!edit ? (
        <Card>
          <Row between><T variant="h3">Машина</T><Button title="Изменить" variant="ghost" small onPress={startEdit} /></Row>
          {[["Марка", driver?.vehicle_model], ["Кузов", driver?.body], ["Грузоподъёмность", driver?.capacity ? `${driver.capacity} т` : null],
            ["Госномер", driver?.plate], ["Направления", driver?.directions]].map(([k, v]) => (
            <Row key={k} between style={{ flexWrap: "nowrap" }}><T muted>{k}</T><T style={{ fontWeight: "600", flexShrink: 1, textAlign: "right" }}>{v || "—"}</T></Row>
          ))}
        </Card>
      ) : (
        <Card>
          <T variant="h3">Машина</T>
          <Field label="Имя и фамилия" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="Марка и модель" value={form.vehicleModel} onChangeText={(v) => setForm({ ...form, vehicleModel: v })} />
          <T variant="small" style={{ fontWeight: "700" }}>Кузов</T>
          <Chips options={meta.bodyTypes} value={form.body} onChange={(v) => setForm({ ...form, body: v })} />
          <Field label="Грузоподъёмность, т" value={form.capacity} keyboardType="decimal-pad" onChangeText={(v) => setForm({ ...form, capacity: v.replace(/[^\d.]/g, "") })} />
          <Field label="Госномер" value={form.plate} autoCapitalize="characters" onChangeText={(v) => setForm({ ...form, plate: v })} />
          <Field label="Направления" value={form.directions} placeholder="Казахстан, Казахстан → Россия" onChangeText={(v) => setForm({ ...form, directions: v })} />
          <Button title="Сохранить" loading={busy} onPress={async () => { if (await patch({ ...form, capacity: Number(form.capacity) || undefined })) setEdit(false); }} />
          <Button title="Отмена" variant="ghost" small onPress={() => setEdit(false)} />
        </Card>
      )}
      <ErrorText error={error} />
      <Button title="Выйти" variant="danger" icon="log-out-outline" onPress={logout} />
    </Screen>
  );
}
