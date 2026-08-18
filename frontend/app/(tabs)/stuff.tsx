import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, StyleSheet, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen, EmptyState } from "@/src/components/layout";
import { AppText, Skeleton, Chip } from "@/src/components/ui";
import { ProductCard, ProductThumb, StatusChips } from "@/src/components/ProductCard";
import { EmptyBoxIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius, CATEGORY_LABELS } from "@/src/theme";
import { api } from "@/src/api/client";
import { formatPrice, haptic } from "@/src/lib/format";

const CATEGORIES = ["tumu", "elektronik", "moda", "ev", "otomotiv", "diger"];

export default function MyStuff() {
  const { colors } = useTheme();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("tumu");
  const [grid, setGrid] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.listProducts(category);
      setProducts(p as any[]);
    } catch {}
    setLoading(false);
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      {/* Sticky header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <AppText variant="title">Eşyalarım</AppText>
          <Pressable
            testID="view-toggle"
            onPress={() => {
              haptic.light();
              setGrid((g) => !g);
            }}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Feather name={grid ? "list" : "grid"} size={20} color={colors.onSurface} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginTop: spacing.md }}
        >
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                testID={`filter-${c}`}
                onPress={() => {
                  haptic.light();
                  setCategory(c);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.brandDark : colors.surfaceSecondary,
                    borderColor: active ? colors.brandDark : colors.border,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color={active ? colors.onBrand : colors.mutedText}
                  weight="medium"
                >
                  {CATEGORY_LABELS[c]}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={92} radius={24} />
          ))}
        </View>
      ) : products.length === 0 ? (
        <EmptyState
          testID="stuff-empty"
          illustration={<EmptyBoxIllustration size={180} brand={colors.brand} ink={colors.onSurface} />}
          title="Bu kategoride ürün yok"
          body="Yeni bir fiş tarayarak eşyalarını eklemeye başla."
          cta="Fiş tara"
          onCta={() => router.push("/scan")}
        />
      ) : grid ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.md, paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              testID={`grid-${item.id}`}
              onPress={() => {
                haptic.light();
                router.push(`/product/${item.id}`);
              }}
              style={[styles.gridCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <ProductThumb path={item.image_path} category={item.category} size={150} />
              <AppText variant="card" numberOfLines={1} style={{ marginTop: spacing.sm }}>
                {item.name}
              </AppText>
              <AppText variant="caption" color={colors.mutedText}>
                {item.merchant || "—"}
              </AppText>
              <AppText variant="body" weight="semibold" style={{ marginTop: 2 }}>
                {formatPrice(item.price, item.currency)}
              </AppText>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <ProductCard product={item} index={index} onPress={() => router.push(`/product/${item.id}`)} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 0, paddingTop: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  gridCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
