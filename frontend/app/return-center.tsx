import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Header, EmptyState } from "@/src/components/layout";
import { AppText, Skeleton } from "@/src/components/ui";
import { ProductCard } from "@/src/components/ProductCard";
import { ShieldIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { formatPrice } from "@/src/lib/format";
import { useT } from "@/src/i18n";

export default function ReturnCenter() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listProducts()
      .then((p: any) => setProducts(p.filter((x: any) => ["active", "ending"].includes(x.return_status))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = products.reduce((s, p) => s + (p.price || 0), 0);

  return (
    <Screen>
      <Header title={t("returnCenter")} onBack={() => router.back()} />
      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Skeleton height={100} radius={24} />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={90} radius={24} />
          ))}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            products.length > 0 ? (
              <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.summary}>
                <AppText variant="body" color={colors.onBrand} style={{ opacity: 0.9 }}>
                  {t("totalReturnableValue")}
                </AppText>
                <AppText variant="title" color={colors.onBrand} style={{ fontVariant: ["tabular-nums"], marginTop: 4 }}>
                  {formatPrice(total, "TL")}
                </AppText>
                <AppText variant="body" color={colors.onBrand} style={{ opacity: 0.9 }}>
                  {t("returnableCount", { n: products.length })}
                </AppText>
              </LinearGradient>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 60 }}>
              <EmptyState
                illustration={<ShieldIllustration size={160} brand={colors.brand} ink={colors.onSurface} />}
                title={t("noReturnable")}
                body={t("noReturnableB")}
              />
            </View>
          }
          renderItem={({ item, index }) => (
            <ProductCard product={item} index={index} onPress={() => router.push(`/return/${item.id}`)} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.sm },
});
