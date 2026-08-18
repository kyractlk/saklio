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

const THEMES: { key: ThemeMode; name: string; desc: string; swatches: string[]; bg: string; ink: string }[] = [
  { key: "soft", name: "Saklio Soft", desc: "Sıcak krem & mint — sakin ve premium", swatches: ["#F8F7F2", "#8FCFAE", "#5B9F7D"], bg: "#F8F7F2", ink: "#202522" },
  { key: "dark", name: "Saklio Dark", desc: "Tam karanlık mod — göz dostu", swatches: ["#111512", "#8FD3AF", "#202722"], bg: "#111512", ink: "#F6F7F6" },
  { key: "color", name: "Saklio Color", desc: "Pastel tonlar — genç ve canlı", swatches: ["#FBF9FF", "#A9C7F5", "#D1C4E9"], bg: "#FBF9FF", ink: "#26233A" },
  { key: "sunset", name: "Saklio Sunset", desc: "Sıcak şeftali — enerjik ve davetkâr", swatches: ["#FFF6F0", "#F0A87E", "#D97D4E"], bg: "#FFF6F0", ink: "#3A2A22" },
  { key: "ocean", name: "Saklio Ocean", desc: "Ferah mavi — sakin ve berrak", swatches: ["#F1F7FB", "#6FB7D6", "#3E86A8"], bg: "#F1F7FB", ink: "#16303F" },
];

export default function ThemeSettings() {
  const { colors } = useTheme();
  const router = useRouter();
  const { theme, setTheme } = useAuth();

  return (
    <Screen>
      <Header title="Tema" subtitle="Saklio’yu kendine göre ayarla" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {THEMES.map((t, i) => {
          const active = theme === t.key;
          return (
            <Animated.View key={t.key} entering={FadeInDown.delay(i * 80)}>
              <Pressable
                testID={`theme-${t.key}`}
                onPress={() => {
                  haptic.success();
                  setTheme(t.key);
                }}
                style={[
                  styles.card,
                  { backgroundColor: t.bg, borderColor: active ? colors.brand : colors.border, borderWidth: active ? 2.5 : 1 },
                ]}
              >
                <View style={styles.preview}>
                  {t.swatches.map((s, j) => (
                    <View key={j} style={[styles.swatch, { backgroundColor: s, borderColor: t.ink + "22" }]} />
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="card" color={t.ink}>
                    {t.name}
                  </AppText>
                  <AppText variant="caption" style={{ color: t.ink, opacity: 0.6, marginTop: 2 }}>
                    {t.desc}
                  </AppText>
                </View>
                {active ? (
                  <View style={[styles.check, { backgroundColor: colors.brand }]}>
                    <Feather name="check" size={16} color={colors.onBrand} />
                  </View>
                ) : (
                  <View style={[styles.emptyCheck, { borderColor: t.ink + "33" }]} />
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
