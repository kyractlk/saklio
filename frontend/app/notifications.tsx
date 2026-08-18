import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header, EmptyState } from "@/src/components/layout";
import { AppText } from "@/src/components/ui";
import { ShieldIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { haptic } from "@/src/lib/format";

const ICONS: Record<string, any> = { return: "rotate-ccw", warranty: "shield" };

export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .notifications()
      .then((n: any) => setNotes(n))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <Header title="Bildirimler" onBack={() => router.back()} />
      <FlatList
        data={notes}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={{ paddingTop: 60 }}>
              <EmptyState
                illustration={<ShieldIllustration size={160} brand={colors.brand} ink={colors.onSurface} />}
                title="Her şey güncel"
                body="Yaklaşan iade ve garanti tarihleri burada görünecek."
              />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const urgent = item.days <= 3;
          const accent = urgent ? colors.error : colors.warning;
          return (
            <Animated.View entering={FadeInDown.delay(index * 60)}>
              <Pressable
                testID={`note-${index}`}
                onPress={() => {
                  haptic.light();
                  if (item.product_id) router.push(`/product/${item.product_id}`);
                }}
                style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <View style={[styles.icon, { backgroundColor: urgent ? "rgba(223,124,118,0.15)" : "rgba(233,183,92,0.15)" }]}>
                  <Feather name={ICONS[item.type] || "bell"} size={20} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="card">{item.title}</AppText>
                  <AppText variant="caption" color={colors.mutedText} style={{ marginTop: 2 }}>
                    {item.body}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedText} />
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
