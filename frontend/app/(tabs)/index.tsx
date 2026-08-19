import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Screen } from "@/src/components/layout";
import { AppText, Card, Skeleton } from "@/src/components/ui";
import { CountdownRing } from "@/src/components/CountdownRing";
import { ProductCard } from "@/src/components/ProductCard";
import { EmptyBoxIllustration } from "@/src/components/Illustrations";
import { EmptyState } from "@/src/components/layout";
import { useTheme, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/i18n";
import { api } from "@/src/api/client";
import { formatPrice, daysLabel, haptic } from "@/src/lib/format";
import { spendSummary, ymKey } from "@/src/lib/spend";

export default function Home() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { t, tc } = useT();
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api.dashboard(), api.listProducts()]);
      setData(d);
      setProducts(p as any[]);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const actNow = data?.act_now || [];
  const firstName = user?.name?.split(" ")[0] || "";
  const monthSpend = spendSummary(products, ymKey());

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{t("hello")} {firstName} 👋</AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: 2 }}>
              {actNow.length > 0 ? t("todoSome", { n: actNow.length }) : t("allGood")}
            </AppText>
          </View>
          <Pressable
            testID="home-avatar"
            onPress={() => router.push("/(tabs)/profile")}
            style={[styles.avatar, { backgroundColor: colors.brand }]}
          >
            <AppText variant="card" color={colors.onBrand}>
              {firstName.charAt(0).toUpperCase() || "S"}
            </AppText>
          </Pressable>
        </View>

        {/* Search */}
        <Pressable
          testID="home-search"
          onPress={() => router.push("/search")}
          style={[styles.search, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <Feather name="search" size={18} color={colors.mutedText} />
          <AppText variant="body" color={colors.mutedText}>
            {t("searchPlaceholder")}
          </AppText>
        </Pressable>

        {loading ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }}>
            <Skeleton height={150} radius={24} />
            <Skeleton height={80} radius={24} />
            <Skeleton height={80} radius={24} />
          </View>
        ) : products.length === 0 ? (
          <View style={{ height: 460 }}>
            <EmptyState
              testID="home-empty"
              illustration={<EmptyBoxIllustration size={200} brand={colors.brand} ink={colors.onSurface} />}
              title={t("emptyHomeT")}
              body={t("emptyHomeB")}
              cta={t("scanFirst")}
              onCta={() => router.push("/scan")}
            />
            <Pressable
              testID="home-seed"
              onPress={async () => {
                haptic.light();
                await api.seedDemo();
                load();
              }}
              style={{ alignItems: "center", marginTop: -20 }}
            >
              <AppText variant="caption" color={colors.mutedText}>
                {t("exploreDemo")}
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Act now */}
            {actNow.length > 0 && (
              <View style={{ marginTop: spacing.sm }}>
                <View style={styles.sectionHead}>
                  <AppText variant="section">{t("actNow")}</AppText>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
                >
                  {actNow.map((p: any, i: number) => (
                    <ActNowCard key={p.id} product={p} index={i} onPress={() => router.push(`/product/${p.id}`)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Returnable summary */}
            {data?.returnable_count > 0 && (
              <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
                <Pressable testID="home-return-summary" onPress={() => router.push("/return-center")}>
                  <LinearGradient
                    colors={[colors.brand, colors.brandDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.summary}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" color={colors.onBrand} style={{ opacity: 0.9 }}>
                        {t("returnCenter")}
                      </AppText>
                      <AppText variant="section" color={colors.onBrand} style={{ marginTop: 4 }}>
                        {t("worthValue", { v: formatPrice(data.returnable_value, data.currency) })}
                      </AppText>
                      <AppText variant="body" color={colors.onBrand} style={{ opacity: 0.9 }}>
                        {t("returnableCount", { n: data.returnable_count })}
                      </AppText>
                    </View>
                    <Feather name="arrow-up-right" size={24} color={colors.onBrand} />
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            )}

            {/* Monthly spend */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <Pressable testID="home-finance" onPress={() => router.push("/finance")}>
                <View style={[styles.financeCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={[styles.quickIcon, { backgroundColor: colors.surfaceTertiary }]}>
                    <Feather name="pie-chart" size={18} color={colors.brandDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" color={colors.mutedText}>
                      {t("financeThisMonth")}
                    </AppText>
                    <AppText variant="section" style={{ marginTop: 2, fontVariant: ["tabular-nums"] }}>
                      {formatPrice(monthSpend.total, data?.currency || user?.currency)}
                    </AppText>
                    <AppText variant="body" color={colors.mutedText}>
                      {monthSpend.top
                        ? `${tc(monthSpend.top.category)} · ${t("financeShare", { n: Math.round(monthSpend.top.share * 100) })}`
                        : t("finance")}
                    </AppText>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedText} />
                </View>
              </Pressable>
            </Animated.View>

            {/* Quick actions */}
            <View style={styles.quickRow}>
              <QuickAction icon="message-circle" label={t("assistant")} onPress={() => router.push("/assistant")} />
              <QuickAction icon="shopping-cart" label={t("shoppingList")} onPress={() => router.push("/shopping-list")} />
            </View>

            {/* Recent */}
            <View style={styles.sectionHead}>
              <AppText variant="section">{t("recent")}</AppText>
              <Pressable onPress={() => router.push("/(tabs)/stuff")}>
                <AppText variant="body" color={colors.brandDark}>
                  {t("all")}
                </AppText>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {products.slice(0, 5).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} onPress={() => router.push(`/product/${p.id}`)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ActNowCard({ product, onPress, index }: { product: any; onPress: () => void; index: number }) {
  const { colors } = useTheme();
  const { t } = useT();
  const days = product.return_days_left ?? product.warranty_days_left ?? 0;
  const isReturn = product.return_status === "ending";
  const total = isReturn ? product.return_days || 14 : (product.warranty_months || 24) * 30;
  const progress = Math.max(0, Math.min(1, days / total));
  const ringColor = days <= 2 ? colors.error : days <= 5 ? colors.warning : colors.brand;

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable
        testID={`actnow-${product.id}`}
        onPress={() => {
          haptic.light();
          onPress();
        }}
        style={[styles.actCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      >
        <CountdownRing
          size={72}
          stroke={7}
          progress={progress}
          color={ringColor}
          label={`${Math.max(0, days)}`}
          sublabel={t("days")}
        />
        <AppText variant="card" numberOfLines={2} style={{ marginTop: spacing.sm }}>
          {product.name}
        </AppText>
        <AppText variant="caption" color={colors.mutedText}>
          {isReturn ? t("returnEnding") : t("warrantyEnding")}
        </AppText>
        <AppText variant="body" weight="semibold" style={{ marginTop: 4, fontVariant: ["tabular-nums"] }}>
          {formatPrice(product.price, product.currency)}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`quick-${icon}`}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={[styles.quick, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: colors.surfaceTertiary }]}>
        <Feather name={icon} size={18} color={colors.brandDark} />
      </View>
      <AppText variant="caption" style={{ flex: 1 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  actCard: {
    width: 170,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  quickRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  financeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quick: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  quickIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
});
