import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme, font } from "./theme.js";
import { api } from "./api.js";

export function T({ style, variant = "body", color, muted, children, ...rest }) {
  const c = useTheme();
  return <Text style={[font[variant], { color: color ?? (muted ? c.muted : c.fg) }, style]} {...rest}>{children}</Text>;
}

export function Screen({ children, refreshing, onRefresh, contentStyle }) {
  const c = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={[{ padding: 16, gap: 12, paddingBottom: 40 }, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }) {
  const c = useTheme();
  const base = { backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 18, padding: 14, gap: 8 };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>{children}</Pressable>;
}

export function Badge({ tone = "neutral", label, icon }) {
  const c = useTheme();
  const map = {
    primary: [c.primarySoft, c.primary], success: [c.successSoft, c.success], warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger], info: [c.infoSoft, c.info], neutral: [c.soft, c.muted],
  };
  const [bg, fg] = map[tone] ?? map.neutral;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" }}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function Button({ title, onPress, variant = "primary", icon, disabled, loading, small, style }) {
  const c = useTheme();
  const v = {
    primary: { bg: c.primary, fg: c.primaryFg, border: c.primary },
    outline: { bg: c.card, fg: c.fg, border: c.border },
    success: { bg: c.success, fg: "#fff", border: c.success },
    danger: { bg: c.card, fg: c.danger, border: c.danger },
    ghost: { bg: "transparent", fg: c.primary, border: "transparent" },
  }[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        minHeight: small ? 38 : 50, paddingHorizontal: small ? 14 : 18, borderRadius: 99,
        backgroundColor: v.bg, borderWidth: 1.5, borderColor: v.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      }, style]}>
      {loading ? <ActivityIndicator color={v.fg} /> : icon && <Ionicons name={icon} size={small ? 16 : 19} color={v.fg} />}
      <Text style={{ color: v.fg, fontWeight: "700", fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <T variant="small" style={{ fontWeight: "700" }}>{label}</T>}
      <TextInput placeholderTextColor={c.muted} accessibilityLabel={label ?? props.placeholder}
        style={[{ minHeight: 50, borderWidth: 1.5, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: c.fg, backgroundColor: c.card }, style]}
        {...props} />
    </View>
  );
}

/** Горизонтальный выбор из вариантов (кузов, город и т.п.) */
export function Chips({ options, value, onChange, allowEmpty }) {
  const c = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {options.map((o) => {
        const [val, label] = Array.isArray(o) ? o : [o, o];
        const on = value === val;
        return (
          <Pressable key={String(val)} onPress={() => onChange(on && allowEmpty ? "" : val)}
            style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5,
              borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.card }}>
            <Text style={{ color: on ? c.primary : c.fg, fontWeight: "600", fontSize: 14 }}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Row({ children, style, between }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }, between && { justifyContent: "space-between" }, style]}>{children}</View>;
}

export function Empty({ icon = "cube-outline", title, text, children }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 28, gap: 8 }}>
      <Ionicons name={icon} size={34} color={c.muted} />
      <T variant="h3" style={{ textAlign: "center" }}>{title}</T>
      {text && <T muted style={{ textAlign: "center" }}>{text}</T>}
      {children}
    </View>
  );
}

export function ErrorText({ error }) {
  const c = useTheme();
  if (!error) return null;
  return <T color={c.danger} accessibilityRole="alert">{typeof error === "string" ? error : error.message}</T>;
}

/** Загрузка с API: перезапрашивает при возврате на экран и по интервалу */
export function useApi(path, { interval } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api(path);
      setState({ data, error: null, loading: false });
    } catch (e) {
      setState((s) => ({ ...s, error: e, loading: false }));
    }
  }, [path]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!interval) return;
    const t = setInterval(load, interval);
    return () => clearInterval(t);
  }, [load, interval]);
  return { ...state, reload: load };
}
