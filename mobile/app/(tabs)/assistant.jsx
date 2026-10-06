import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "../../src/api.js";
import { useAuth } from "../../src/auth.jsx";
import { useTheme } from "../../src/theme.js";
import { money, day, scoreTone } from "../../src/format.js";
import { Badge, Card, Chips, Row, T } from "../../src/ui.jsx";

const SUGGESTIONS = [
  "Грузы из моего города",
  "Обратный груз из Алматы",
  "Сколько стоит рейс Астана — Алматы, 20 т?",
  "Мой заработок за месяц",
];

export default function Assistant() {
  const c = useTheme();
  const router = useRouter();
  const { driver, meta } = useAuth();
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef(null);

  async function send(raw) {
    // «из моего города» подставляем конкретным городом, чтобы ассистент понял запрос
    const q = raw.replace(/из моего города/i, `из ${driver?.city ?? ""}`).trim();
    if (!q || busy) return;
    setText("");
    setMessages((m) => [...m, { role: "me", text: q }]);
    setBusy(true);
    try {
      const r = await api("/assistant", { method: "POST", body: { message: q, conversationId } });
      setConversationId(r.conversationId);
      setMessages((m) => [...m, { role: "bot", text: r.reply, cards: r.cards }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: e.message, error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  const bubble = (mine) => ({
    alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "88%", padding: 12, borderRadius: 18,
    backgroundColor: mine ? c.primary : c.card, borderWidth: mine ? 0 : 1, borderColor: c.border,
    borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4,
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
        {messages.length === 0 && (
          <>
            <View style={bubble(false)}>
              <T>Подберу грузы под вашу машину, найду обратную загрузку, оценю ставку и подскажу статус рейса. Спрашивайте как удобно.</T>
              <T variant="xs" muted style={{ marginTop: 6 }}>{meta.assistantMode === "claude" ? "Работает на Claude" : "Режим правил: понимаю типовые вопросы"}</T>
            </View>
            <Chips options={SUGGESTIONS} value={null} onChange={send} />
          </>
        )}
        {messages.map((m, i) => (
          <View key={i} style={{ gap: 8 }}>
            <View style={bubble(m.role === "me")}>
              <T color={m.role === "me" ? c.primaryFg : m.error ? c.danger : c.fg}>{m.text}</T>
            </View>
            {m.cards?.filter((x) => x.type === "cargo").map((x) => (
              <Card key={x.code} onPress={() => router.push(`/cargo/${x.code}`)}>
                <Row between><T variant="xs" muted>{x.code} · {day(x.load_date)}</T>{x.score != null && <Badge tone={scoreTone(x.score)} label={`${x.score}%`} />}</Row>
                <T variant="h3">{x.from_city} → {x.to_city}</T>
                <T muted>{x.weight} т · {x.body} · {money(x.price)}</T>
              </Card>
            ))}
          </View>
        ))}
        {busy && <View style={bubble(false)}><ActivityIndicator color={c.primary} /></View>}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card }}>
        <TextInput value={text} onChangeText={setText} placeholder="Например: груз из Шымкента на 20 т" placeholderTextColor={c.muted}
          onSubmitEditing={() => send(text)} returnKeyType="send" maxLength={2000} accessibilityLabel="Вопрос ассистенту"
          style={{ flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 16, color: c.fg, fontSize: 15, backgroundColor: c.bg }} />
        <Pressable onPress={() => send(text)} disabled={busy || !text.trim()} accessibilityLabel="Отправить"
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", opacity: busy || !text.trim() ? 0.5 : 1 }}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
