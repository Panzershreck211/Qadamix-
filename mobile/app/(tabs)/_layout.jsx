import { Pressable, View, Text } from "react-native";
import { Tabs, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../src/theme.js";
import { useApi } from "../../src/ui.jsx";

function Bell() {
  const c = useTheme();
  const router = useRouter();
  const { data } = useApi("/notifications", { interval: 20000 });
  const unread = data?.unread ?? 0;
  return (
    <Pressable onPress={() => router.push("/notifications")} accessibilityLabel={`Уведомления${unread ? `, новых: ${unread}` : ""}`} hitSlop={10} style={{ marginRight: 16 }}>
      <Ionicons name="notifications-outline" size={24} color={c.fg} />
      {unread > 0 && (
        <View style={{ position: "absolute", top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  const c = useTheme();
  const tab = (title, icon) => ({
    title,
    tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? icon : `${icon}-outline`} size={24} color={color} />,
  });
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      headerStyle: { backgroundColor: c.card }, headerTintColor: c.fg, headerShadowVisible: false,
      headerTitleStyle: { fontWeight: "800" },
      headerRight: () => <Bell />,
      sceneStyle: { backgroundColor: c.bg },
    }}>
      <Tabs.Screen name="index" options={{ ...tab("Грузы", "cube"), headerTitle: "Подходящие грузы" }} />
      <Tabs.Screen name="offers" options={{ ...tab("Отклики", "paper-plane"), headerTitle: "Мои отклики" }} />
      <Tabs.Screen name="trip" options={{ ...tab("Рейс", "navigate"), headerTitle: "Текущий рейс" }} />
      <Tabs.Screen name="assistant" options={{ ...tab("Помощник", "sparkles"), headerTitle: "AI-диспетчер" }} />
      <Tabs.Screen name="profile" options={{ ...tab("Профиль", "person-circle"), headerTitle: "Профиль" }} />
    </Tabs>
  );
}
