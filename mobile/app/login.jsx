import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/api.js";
import { useAuth } from "../src/auth.jsx";
import { useTheme } from "../src/theme.js";
import { Badge, Button, Chips, ErrorText, Field, Screen, T } from "../src/ui.jsx";

export default function Login() {
  const c = useTheme();
  const { login, logout, meta } = useAuth();
  const [step, setStep] = useState("phone"); // phone → code → register
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(null);
  const [reg, setReg] = useState({ name: "", city: "", body: "Тент", capacity: "20", vehicleModel: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true); setError(null);
    try {
      const r = await api("/auth/request-code", { method: "POST", body: { phone } });
      setDevCode(r.devCode ?? null);
      setStep("code");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError(null);
    try {
      const body = { phone, code, ...(step === "register" ? { role: "driver", ...reg, capacity: Number(reg.capacity) } : {}) };
      const r = await api("/auth/verify", { method: "POST", body });
      if (r.user.role !== "driver") {
        setError("Это приложение для водителей. Логисты работают в веб-кабинете QADAMIX.");
        await logout();
        return;
      }
      await login(r.token);
    } catch (e) {
      if (e.data?.needsRegistration) setStep("register");
      else setError(e.message);
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Screen contentStyle={{ gap: 16, paddingTop: 32 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
            <T variant="h2" color="#fff">{">_"}</T>
          </View>
          <View style={{ gap: 4 }}>
            <T variant="h1">{step === "register" ? "Расскажите о машине" : "QADAMIX для водителей"}</T>
            <T muted>
              {step === "phone" && "Грузы под вашу машину, отклик в одно касание, статус рейса без звонков."}
              {step === "code" && `Мы отправили код на ${phone}`}
              {step === "register" && "Логисты увидят это в карточке. Изменить можно в профиле."}
            </T>
          </View>

          {step === "phone" && (
            <>
              <Field label="Номер телефона" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="+7 7XX XXX XX XX" />
              <Button title="Получить код" onPress={requestCode} loading={busy} disabled={phone.replace(/\D/g, "").length < 10} />
              <View style={{ gap: 8, marginTop: 8 }}>
                <T variant="xs" muted>Демо-водители (нажмите, чтобы подставить номер):</T>
                <Chips options={[["+7 701 100 00 01", "Иван · тент 20 т"], ["+7 701 100 00 02", "Дмитрий · тент 22 т"], ["+7 701 100 00 05", "Ерлан · реф 20 т"], ["+7 701 100 00 11", "Бауыржан · борт 22 т"]]}
                  value={phone} onChange={setPhone} />
              </View>
            </>
          )}

          {step === "code" && (
            <>
              <Field label="Код из SMS" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={4} autoComplete="sms-otp" textContentType="oneTimeCode" placeholder="0000" autoFocus />
              {devCode && <Badge tone="info" icon="information-circle" label={`SMS ещё не подключены. Код: ${devCode}`} />}
              <Button title="Войти" onPress={verify} loading={busy} disabled={code.length !== 4} />
              <Button title="Другой номер" variant="ghost" onPress={() => { setStep("phone"); setCode(""); }} />
            </>
          )}

          {step === "register" && (
            <>
              <Field label="Имя и фамилия" value={reg.name} onChangeText={(v) => setReg({ ...reg, name: v })} autoComplete="name" />
              <T variant="small" style={{ fontWeight: "700" }}>Где сейчас машина</T>
              <Chips options={meta.cities} value={reg.city} onChange={(v) => setReg({ ...reg, city: v })} />
              <T variant="small" style={{ fontWeight: "700" }}>Кузов</T>
              <Chips options={meta.bodyTypes} value={reg.body} onChange={(v) => setReg({ ...reg, body: v })} />
              <Field label="Грузоподъёмность, т" value={reg.capacity} onChangeText={(v) => setReg({ ...reg, capacity: v.replace(/[^\d.]/g, "") })} keyboardType="decimal-pad" />
              <Field label="Марка и модель" value={reg.vehicleModel} onChangeText={(v) => setReg({ ...reg, vehicleModel: v })} placeholder="Например, MAN TGX" />
              <Button title="Начать работу" onPress={verify} loading={busy} disabled={reg.name.trim().length < 2 || !reg.city || !Number(reg.capacity)} />
            </>
          )}
          <ErrorText error={error} />
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
