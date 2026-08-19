import React from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText } from "@/src/components/ui";
import { useTheme, spacing, radius, ThemeMode } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";

const THEMES: { key: ThemeMode; name: string; desc: string; swatches: string[]; bg: string; ink: string }[] = [
  { key: "soft", name: "Saklio Soft", desc: "themeSoft", swatches: ["#F8F7F2", "#8FCFAE", "#5B9F7D"], bg: "#F8F7F2", ink: "#202522" },
  { key: "dark", name: "Saklio Dark", desc: "themeDark", swatches: ["#111512", "#8FD3AF", "#202722"], bg: "#111512", ink: "#F6F7F6" },
  { key: "color", name: "Saklio Color", desc: "themeColor", swatches: ["#FBF9FF", "#A9C7F5", "#D1C4E9"], bg: "#FBF9FF", ink: "#26233A" },
  { key: "sunset", name: "Saklio Sunset", desc: "themeSunset", swatches: ["#FFF6F0", "#F0A87E", "#D97D4E"], bg: "#FFF6F0", ink: "#3A2A22" },
  { key: "ocean", name: "Saklio Ocean", desc: "themeOcean", swatches: ["#F1F7FB", "#6FB7D6", "#3E86A8"], bg: "#F1F7FB", ink: "#16303F" },
];

export default function ThemeSettings() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { theme, setTheme } = useAuth();

  return (
    <Screen>
      <Header title={t("theme")} subtitle={t("themeSub")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {THEMES.map((item, i) => {
          const active = theme === item.key;
          return (
            <Animated.View key={item.key} entering={FadeInDown.delay(i * 80)}>
              <Pressable
                testID={`theme-${item.key}`}
                onPress={() => {
                  haptic.success();
                  setTheme(item.key);
                }}
                style={[
                  styles.card,
                  { backgroundColor: item.bg, borderColor: active ? colors.brand : colors.border, borderWidth: active ? 2.5 : 1 },
                ]}
              >
                <View style={styles.preview}>
                  {item.swatches.map((s, j) => (
                    <View key={j} style={[styles.swatch, { backgroundColor: s, borderColor: item.ink + "22" }]} />
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="card" color={item.ink}>
                    {item.name}
                  </AppText>
                  <AppText variant="caption" style={{ color: item.ink, opacity: 0.6, marginTop: 2 }}>
                    {t(item.desc)}
                  </AppText>
                </View>
                {active ? (
                  <View style={[styles.check, { backgroundColor: colors.brand }]}>
                    <Feather name="check" size={16} color={colors.onBrand} />
                  </View>
                ) : (
                  <View style={[styles.emptyCheck, { borderColor: item.ink + "33" }]} />
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg },
  preview: { flexDirection: "row" },
  swatch: { width: 26, height: 40, borderRadius: 6, marginLeft: -6, borderWidth: 1 },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emptyCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
});
