import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth.jsx";
import { useTheme } from "../src/theme.js";
import { syncTracking } from "../src/gps.js"; // регистрирует фоновую GPS-задачу при запуске
import { useEffect } from "react";

function Gate() {
  const { user, ready } = useAuth();
  const c = useTheme();
  const signedIn = user?.role === "driver";
  useEffect(() => { if (signedIn) syncTracking(); }, [signedIn]);
  if (!ready) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}><ActivityIndicator color={c.primary} /></View>;
  }
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: c.card }, headerTintColor: c.fg, headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg }, headerBackTitle: "Назад",
      }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="cargo/[code]" options={{ title: "Груз" }} />
          <Stack.Screen name="notifications" options={{ title: "Уведомления" }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
