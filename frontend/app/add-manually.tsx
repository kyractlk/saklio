import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Input } from "@/src/components/ui";
import { useTheme, spacing, radius, CATEGORY_LABELS } from "@/src/theme";
import { scanStore } from "@/src/lib/scanStore";
import { api } from "@/src/api/client";
import { haptic } from "@/src/lib/format";

const CATS = ["elektronik", "moda", "ev", "otomotiv", "diger"];

export default function AddManually() {
  const { colors } = useTheme();
  const router = useRouter();
  const r = scanStore.get().result || {};
  const draft = scanStore.get();

  const [name, setName] = useState(r.product_name || "");
  const [merchant, setMerchant] = useState(r.merchant || "");
  const [price, setPrice] = useState(r.total ? String(Math.round(r.total)) : "");
  const [category, setCategory] = useState(r.category || "diger");
  const [date, setDate] = useState(r.purchase_date || new Date().toISOString().slice(0, 10));
  const [returnDays, setReturnDays] = useState(String(r.return_days ?? 14));
  const [warranty, setWarranty] = useState(String(r.warranty_months ?? 24));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) {
      setError("Ürün adı gerekli");
      return;
    }
    setSaving(true);
    try {
      const product = await api.createProduct({
        name: name.trim(),
        merchant: merchant.trim() || null,
        category,
        price: price ? parseFloat(price) : null,
        currency: "TL",
        purchase_date: date ? new Date(date).toISOString() : null,
        return_days: parseInt(returnDays) || 14,
        warranty_months: parseInt(warranty) || 24,
        image_path: draft.imagePath || null,
        receipt_path: draft.imagePath || null,
      });
      haptic.success();
      router.replace(`/success?id=${(product as any).id}`);
    } catch (e) {
      haptic.error();
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="Ürünü elle ekle" subtitle="Bilgileri kendin doldur" onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        <Input testID="m-name" label="Ürün adı" placeholder="Örn. Sony WH-1000XM6" value={name} onChangeText={setName} error={error} />
        <Input testID="m-merchant" label="Mağaza" placeholder="Örn. MediaMarkt" value={merchant} onChangeText={setMerchant} />

        <View>
          <AppText variant="caption" color={colors.mutedText} style={{ marginBottom: 6 }}>
            Kategori
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {CATS.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  testID={`m-cat-${c}`}
                  onPress={() => {
                    haptic.light();
                    setCategory(c);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? colors.brandDark : colors.surfaceSecondary, borderColor: active ? colors.brandDark : colors.border },
                  ]}
                >
                  <AppText variant="caption" weight="medium" color={active ? colors.onBrand : colors.mutedText}>
                    {CATEGORY_LABELS[c]}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Input testID="m-price" label="Fiyat (TL)" placeholder="0" keyboardType="numeric" value={price} onChangeText={setPrice} />
        <Input testID="m-date" label="Satın alma tarihi (YYYY-AA-GG)" placeholder="2026-06-01" value={date} onChangeText={setDate} />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input testID="m-return" label="İade (gün)" keyboardType="numeric" value={returnDays} onChangeText={setReturnDays} />
          </View>
          <View style={{ flex: 1 }}>
            <Input testID="m-warranty" label="Garanti (ay)" keyboardType="numeric" value={warranty} onChangeText={setWarranty} />
          </View>
        </View>

        <Button testID="m-save" title="Kaydet" onPress={save} loading={saving} style={{ marginTop: spacing.sm }} />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { height: 40, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
