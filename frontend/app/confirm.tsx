import React, { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Card, Chip } from "@/src/components/ui";
import { useTheme, spacing, radius, CATEGORY_COLORS, CATEGORY_LABELS } from "@/src/theme";
import { scanStore } from "@/src/lib/scanStore";
import { api } from "@/src/api/client";
import { formatPrice, formatDate, haptic } from "@/src/lib/format";

export default function Confirm() {
  const { colors } = useTheme();
  const router = useRouter();
  const draft = scanStore.get();
  const r = draft.result || {};
  const [saving, setSaving] = useState(false);

  const lowConfidence = (r.confidence ?? 1) < 0.7;
  const cat = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.diger;

  const rows = [
    { label: "Ürün", value: r.product_name || "—" },
    { label: "Mağaza", value: r.merchant || "—" },
    { label: "Fiyat", value: formatPrice(r.total, r.currency || "TL") },
    { label: "Tarih", value: formatDate(r.purchase_date) },
    { label: "İade süresi", value: `${r.return_days ?? 14} gün` },
    { label: "Garanti", value: `${r.warranty_months ?? 24} ay` },
  ];

  const confirm = async () => {
    setSaving(true);
    try {
      const product = await api.createProduct({
        name: r.product_name || r.merchant || "Ürün",
        merchant: r.merchant || null,
        category: r.category || "diger",
        price: r.total ?? null,
        currency: r.currency || "TL",
        purchase_date: r.purchase_date || null,
        return_days: r.return_days ?? 14,
        warranty_months: r.warranty_months ?? 24,
        image_path: draft.imagePath || null,
        receipt_path: draft.imagePath || null,
        items: (r.items || []).map((it: any) => ({ name: it.name, price: it.price ?? null })),
      });
      scanStore.set({ result: { ...r, id: (product as any).id } });
      haptic.success();
      router.replace(`/success?id=${(product as any).id}`);
    } catch (e) {
      haptic.error();
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="Bunu doğru mu anladım?" subtitle="Bilgileri kontrol et ve onayla" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {lowConfidence ? (
          <View style={[styles.warn, { backgroundColor: "rgba(233,183,92,0.15)" }]}>
            <Feather name="alert-circle" size={18} color={colors.warning} />
            <AppText variant="caption" color={colors.warning} style={{ flex: 1 }}>
              Bazı bilgilerden tam emin olamadım. Lütfen kontrol et.
            </AppText>
          </View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(400)}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={[styles.icon, { backgroundColor: cat.bg }]}>
                <Feather name="check-circle" size={24} color={cat.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="card" numberOfLines={2}>
                  {r.product_name || "Ürün"}
                </AppText>
                <Chip label={CATEGORY_LABELS[r.category] || "Diğer"} bg={cat.bg} color={cat.fg} />
              </View>
            </View>

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {rows.map((row) => (
                <View key={row.label} style={styles.detailRow}>
                  <AppText variant="body" color={colors.mutedText}>
                    {row.label}
                  </AppText>
                  <AppText variant="body" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
                    {row.value}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button testID="confirm-correct" title="Evet, doğru" onPress={confirm} loading={saving} />
        <Button
          testID="confirm-edit"
          title="Düzelt"
          variant="secondary"
          onPress={() => router.replace("/add-manually")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warn: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  icon: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footer: { padding: spacing.lg, gap: spacing.md, borderTopWidth: 1 },
});
