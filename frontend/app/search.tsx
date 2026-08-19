import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, TextInput, FlatList } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen, Header, EmptyState } from "@/src/components/layout";
import { AppText } from "@/src/components/ui";
import { ProductCard } from "@/src/components/ProductCard";
import { ScanReceiptIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { useT } from "@/src/i18n";

export default function Search() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    api.listProducts().then((p: any) => setProducts(p)).catch(() => {});
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.merchant?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [query, products]);

  return (
    <Screen edges={["top"]}>
      <Header title={t("search")} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedText} />
          <TextInput
            testID="search-input"
            autoFocus
            style={{ flex: 1, color: colors.onSurface, fontSize: 16 }}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={colors.mutedText}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <ProductCard product={item} index={index} onPress={() => router.push(`/product/${item.id}`)} />
          )}
          ListEmptyComponent={
            <View style={{ paddingTop: 60 }}>
              <EmptyState
                illustration={<ScanReceiptIllustration size={140} brand={colors.brand} ink={colors.onSurface} />}
                title={t("noResultsT")}
                body={t("noResultsB")}
              />
            </View>
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: spacing.lg,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
});
