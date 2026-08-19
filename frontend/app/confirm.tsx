import React, { useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Card, Chip } from "@/src/components/ui";
import { useTheme, spacing, radius, CATEGORY_COLORS } from "@/src/theme";
import { scanStore } from "@/src/lib/scanStore";
import { api } from "@/src/api/client";
import { formatPrice, formatDate, haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";

type LineItem = {
  id: string;
  name: string;
  price: number | null;
  qty: number;
  category: string;
  return_days: number;
  warranty_months: number;
  selected: boolean;
};

function buildLineItems(result: any): LineItem[] {
  const products = Array.isArray(result?.products) ? result.products : Array.isArray(result?.items) ? result.items : [];
  if (products.length) {
    return products.map((it: any, i: number) => ({
      id: `line-${i}-${String(it.name || "").slice(0, 20)}`,
      name: String(it.name || "—"),
      price: it.price == null ? null : Number(it.price),
      qty: Math.max(1, Number(it.qty) || 1),
      category: it.category || result.category || "diger",
      return_days: it.return_days ?? result.return_days ?? 14,
      warranty_months: it.warranty_months ?? result.warranty_months ?? 24,
      selected: true,
    }));
  }
  if (result?.product_name) {
    return [
      {
        id: "line-0",
        name: result.product_name,
        price: result.total == null ? null : Number(result.total),
        qty: 1,
        category: result.category || "diger",
        return_days: result.return_days ?? 14,
        warranty_months: result.warranty_months ?? 24,
        selected: true,
      },
    ];
  }
  return [];
}

export default function Confirm() {
  const { colors } = useTheme();
  const { t, tc } = useT();
  const router = useRouter();
  const draft = scanStore.get();
  const r = draft.result || {};
  const [lines, setLines] = useState<LineItem[]>(() => buildLineItems(r));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const lowConfidence = (r.confidence ?? 1) < 0.7;
  const selected = useMemo(() => lines.filter((l) => l.selected), [lines]);
  const cat = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.diger;
  const multi = lines.length > 1;

  const toggle = (id: string) => {
    haptic.light();
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, selected: !l.selected } : l)));
  };

  const toggleAll = (value: boolean) => {
    haptic.light();
    setLines((prev) => prev.map((l) => ({ ...l, selected: value })));
  };

  const confirm = async () => {
    if (!selected.length) return;
    setSaving(true);
    setStatus(t("findingImages"));
    try {
      let imageMap: Record<string, string> = {};
      try {
        const lookup = await api.lookupProductImages(
          selected.map((l) => ({ name: l.name })),
          r.merchant
        );
        for (const row of lookup.results || []) {
          if (row.image_url) imageMap[row.name] = row.image_url;
        }
      } catch {
        // görsel arama başarısız olsa da kayıt devam etsin
      }

      setStatus(t("savingProducts"));
      const { products } = await api.createProductsFromReceipt({
        merchant: r.merchant || null,
        purchase_date: r.purchase_date || null,
        currency: r.currency || "TL",
        return_days: r.return_days ?? 14,
        warranty_months: r.warranty_months ?? 24,
        receipt_path: draft.imagePath || null,
        products: selected.map((l) => ({
          name: l.name,
          price: l.price,
          category: l.category,
          return_days: l.return_days,
          warranty_months: l.warranty_months,
          image_url: imageMap[l.name] || null,
          qty: l.qty,
        })),
      });

      scanStore.set({ result: { ...r, savedIds: products.map((p: any) => p.id) } });
      haptic.success();
      const ids = products.map((p: any) => p.id).join(",");
      router.replace(`/success?ids=${ids}&count=${products.length}`);
    } catch (e) {
      haptic.error();
      setSaving(false);
      setStatus("");
    }
  };

  return (
    <Screen>
      <Header
        title={multi ? t("confirmMultiT") : t("confirmT")}
        subtitle={multi ? t("confirmMultiB", { n: lines.length }) : t("confirmB")}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {lowConfidence ? (
          <View style={[styles.warn, { backgroundColor: "rgba(233,183,92,0.15)" }]}>
            <Feather name="alert-circle" size={18} color={colors.warning} />
            <AppText variant="caption" color={colors.warning} style={{ flex: 1 }}>
              {t("lowConf")}
            </AppText>
          </View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(400)}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={[styles.icon, { backgroundColor: cat.bg }]}>
                <Feather name="shopping-bag" size={22} color={cat.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="card" numberOfLines={2}>
                  {r.merchant || t("store")}
                </AppText>
                <AppText variant="caption" color={colors.mutedText}>
                  {formatDate(r.purchase_date)} · {formatPrice(r.total, r.currency || "TL")}
                  {r.receipt_language && r.receipt_language !== "unknown"
                    ? ` · ${t("receiptLang", { lang: String(r.receipt_language).toUpperCase() })}`
                    : ""}
                </AppText>
              </View>
              {multi ? (
                <Chip label={t("nItems", { n: lines.length })} bg={cat.bg} color={cat.fg} />
              ) : (
                <Chip label={tc(r.category)} bg={cat.bg} color={cat.fg} />
              )}
            </View>
          </Card>
        </Animated.View>

        {multi ? (
          <View style={[styles.listHead, { marginTop: spacing.md }]}>
            <AppText variant="body" weight="semibold">
              {t("receiptItems")}
            </AppText>
            <Pressable onPress={() => toggleAll(selected.length !== lines.length)}>
              <AppText variant="caption" color={colors.brandDark}>
                {selected.length === lines.length ? t("deselectAll") : t("selectAll")}
              </AppText>
            </Pressable>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {lines.map((line, index) => {
            const lineCat = CATEGORY_COLORS[line.category] || CATEGORY_COLORS.diger;
            return (
              <Animated.View key={line.id} entering={FadeInDown.delay(index * 40).duration(300)}>
                <Pressable
                  onPress={() => multi && toggle(line.id)}
                  style={[
                    styles.lineRow,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: line.selected ? colors.brand : colors.border,
                    },
                  ]}
                >
                  {multi ? (
                    <View
                      style={[
                        styles.check,
                        {
                          backgroundColor: line.selected ? colors.brand : "transparent",
                          borderColor: line.selected ? colors.brand : colors.border,
                        },
                      ]}
                    >
                      {line.selected ? <Feather name="check" size={14} color={colors.onBrand} /> : null}
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="semibold" numberOfLines={2}>
                      {line.name}
                    </AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <Chip label={tc(line.category)} bg={lineCat.bg} color={lineCat.fg} />
                      {line.qty > 1 ? (
                        <AppText variant="caption" color={colors.mutedText}>
                          {t("qtyShort", { n: line.qty })}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                  <AppText variant="body" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
                    {formatPrice(line.price, r.currency || "TL")}
                  </AppText>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {status ? (
          <AppText variant="caption" color={colors.mutedText} style={{ marginTop: spacing.md, textAlign: "center" }}>
            {status}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          testID="confirm-correct"
          title={multi ? t("saveNProducts", { n: selected.length }) : t("yesCorrect")}
          onPress={confirm}
          loading={saving}
          disabled={!selected.length}
        />
        <Button
          testID="confirm-edit"
          title={t("edit")}
          variant="secondary"
          onPress={() => router.replace("/add-manually")}
          disabled={saving}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warn: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  icon: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { padding: spacing.lg, gap: spacing.md, borderTopWidth: 1 },
});
