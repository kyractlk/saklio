import React, { useState, useCallback, useMemo } from "react";
import { View, ScrollView, Pressable, StyleSheet, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import { Screen, EmptyState, IconButton } from "@/src/components/layout";
import { AppText, Skeleton } from "@/src/components/ui";
import { ProductThumb } from "@/src/components/ProductCard";
import { ShieldIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { useT } from "@/src/i18n";
import { api } from "@/src/api/client";
import { formatPrice, daysLabel, haptic } from "@/src/lib/format";

const MODES = [
  { key: "return", label: "returnCenter" },
  { key: "warranty", label: "warranties" },
];
const STATUS = [
  { key: "active", label: "active" },
  { key: "ending", label: "endingSoon" },
  { key: "expired", label: "expired" },
];

export default function Activity() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState("return");
  const [status, setStatus] = useState("active");
  const [products, setProducts] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, n] = await Promise.all([api.listProducts(), api.notifications()]);
      setProducts(p as any[]);
      setNotes(n as any[]);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const field = mode === "return" ? "return_status" : "warranty_status";
    return products.filter((p) => p[field] === status);
  }, [products, mode, status]);

  const summaryValue = useMemo(() => {
    if (mode !== "return") return 0;
    return products
      .filter((p) => ["active", "ending"].includes(p.return_status))
      .reduce((s, p) => s + (p.price || 0), 0);
  }, [products, mode]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AppText variant="title">{t("activity")}</AppText>
          <IconButton
            name="bell"
            testID="open-notifications"
            badge={notes.length || undefined}
            onPress={() => router.push("/notifications")}
          />
        </View>

        {/* Mode segmented */}
        <View style={[styles.segment, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                testID={`mode-${m.key}`}
                onPress={() => {
                  haptic.light();
                  setMode(m.key);
                }}
                style={[styles.segItem, active && { backgroundColor: colors.brand }]}
              >
                <AppText variant="body" weight="semibold" color={active ? colors.onBrand : colors.mutedText}>
                  {t(m.label)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Status chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginTop: spacing.md }}
        >
          {STATUS.map((s) => {
            const active = status === s.key;
            return (
              <Pressable
                key={s.key}
                testID={`status-${s.key}`}
                onPress={() => {
                  haptic.light();
                  setStatus(s.key);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.brandDark : colors.surfaceSecondary,
                    borderColor: active ? colors.brandDark : colors.border,
                  },
                ]}
              >
                <AppText variant="caption" weight="medium" color={active ? colors.onBrand : colors.mutedText}>
                  {t(s.label)}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={80} radius={20} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 130, gap: spacing.md, paddingTop: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            mode === "return" && summaryValue > 0 ? (
              <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.summary}>
                <Feather name="rotate-ccw" size={22} color={colors.onBrand} />
                <AppText variant="body" color={colors.onBrand} style={{ flex: 1 }}>
                  {t("totalReturnable", { v: formatPrice(summaryValue, "TL") })}
                </AppText>
              </LinearGradient>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 40 }}>
              <EmptyState
                illustration={<ShieldIllustration size={160} brand={colors.brand} ink={colors.onSurface} />}
                title={mode === "return" ? t("noneHereT_r") : t("noneHereT_w")}
                body={t("allGood")}
              />
            </View>
          }
          renderItem={({ item, index }) => (
            <ActivityRow
              product={item}
              mode={mode}
              index={index}
              onPress={() =>
                mode === "return" ? router.push(`/return/${item.id}`) : router.push(`/warranty-claim?id=${item.id}`)
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function ActivityRow({ product, mode, onPress, index }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const days = mode === "return" ? product.return_days_left : product.warranty_days_left;
  const color =
    days < 0 ? colors.mutedText : days <= 5 ? colors.error : days <= 30 ? colors.warning : colors.success;
  return (
    <Animated.View entering={FadeIn.delay(index * 50)}>
      <Pressable
        testID={`activity-${product.id}`}
        onPress={() => {
          haptic.light();
          onPress();
        }}
        style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      >
        <ProductThumb path={product.image_path} imageUrl={product.image_url} category={product.category} size={56} />
        <View style={{ flex: 1 }}>
          <AppText variant="card" numberOfLines={1}>
            {product.name}
          </AppText>
          <AppText variant="caption" color={colors.mutedText}>
            {product.merchant || "—"}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <AppText variant="caption" color={color} weight="semibold">
              {mode === "return" ? t("returnLabel") : t("warrantyLabel")}
              {daysLabel(days)}
            </AppText>
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedText} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  segItem: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
