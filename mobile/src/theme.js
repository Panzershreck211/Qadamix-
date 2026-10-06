import { useColorScheme } from "react-native";

// Цвета бренда QADAMIX (из веб-кабинета), переведённые в hex для React Native
const light = {
  bg: "#F6F8FB", card: "#FFFFFF", fg: "#232B3A", muted: "#6B7385", border: "#E3E8EF", soft: "#EEF2F7",
  primary: "#2F6FD6", primaryFg: "#FFFFFF", primarySoft: "#E2EBFA",
  success: "#2E9E6A", successSoft: "#E1F4EA", warning: "#C98A1B", warningSoft: "#FBF0D9",
  danger: "#D9443A", dangerSoft: "#FBE6E4", info: "#2F86C9", infoSoft: "#E1EFF9",
};
const dark = {
  bg: "#11161F", card: "#1A212C", fg: "#E9EDF3", muted: "#98A1B2", border: "#2A3342", soft: "#222A37",
  primary: "#5B93EA", primaryFg: "#FFFFFF", primarySoft: "#1F3150",
  success: "#4DC28B", successSoft: "#173226", warning: "#E3AE4A", warningSoft: "#3A2E16",
  danger: "#F06A5F", dangerSoft: "#3A1C1A", info: "#5FAEE8", infoSoft: "#16293A",
};

export function useTheme() {
  return useColorScheme() === "dark" ? dark : light;
}

export const font = {
  h1: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  h2: { fontSize: 19, fontWeight: "700", letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  xs: { fontSize: 12 },
};
