import React, { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, Pressable, Switch, Share } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText, Button, Card, Skeleton } from "@/src/components/ui";
import { CountdownRing } from "@/src/components/CountdownRing";
import { ProductThumb, useFileUrl } from "@/src/components/ProductCard";
import { useTheme, spacing, radius, CATEGORY_COLORS, CATEGORY_LABELS } from "@/src/theme";
import { api } from "@/src/api/client";
import { formatPrice, formatDate, daysLabel, haptic } from "@/src/lib/format";

export default function ProductDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const imgUrl = useFileUrl(product?.image_path);

  const load = useCallback(async () => {
    try {
      const p = await api.getProduct(id);
      setProduct(p);
      setNotifyReturn(p.notify_return !== false);
      setNotifyWarranty(p.notify_warranty !== false);
    } catch {}
    setLoading(false);
  }, [id]);

  const [notifyReturn, setNotifyReturn] = useState(true);
  const [notifyWarranty, setNotifyWarranty] = useState(true);

  const shareProduct = async () => {
    try {
      haptic.medium();
      const res: any = await api.shareProduct(id);
      await Share.share({
        message: `Saklio'da bir ürün paylaştım: ${product?.name}\n${res.deeplink}`,
      });
    } catch {}
  };

  const toggleNotify = async (field: "return" | "warranty", val: boolean) => {
    haptic.light();
    if (field === "return") setNotifyReturn(val);
    else setNotifyWarranty(val);
    try {
      await api.updateNotify(id, field === "return" ? { notify_return: val } : { notify_warranty: val });
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Skeleton height={320} radius={0} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={30} width="70%" />
          <Skeleton height={120} radius={24} />
        </View>
      </View>
    );
  }

  const cat = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.diger;
  const rdl = product.return_days_left;
  const wdl = product.warranty_days_left;
  const returnProgress = Math.max(0, Math.min(1, rdl / (product.return_days || 14)));
  const returnColor = rdl < 0 ? colors.mutedText : rdl <= 3 ? colors.error : rdl <= 5 ? colors.warning : colors.brand;

  const timeline = buildTimeline(product);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={styles.hero}>
          {imgUrl ? (
            <Image source={{ uri: imgUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: cat.bg, alignItems: "center", justifyContent: "center" }]}>
              <Feather name="package" size={72} color={cat.fg} />
            </View>
          )}
          <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.3)"]} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["top"]} style={styles.heroTop}>
            <Pressable testID="detail-back" onPress={() => router.back()} style={styles.roundBtn}>
              <Feather name="chevron-left" size={24} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable testID="detail-share" onPress={shareProduct} style={styles.roundBtn}>
                <Feather name="share-2" size={19} color="#fff" />
              </Pressable>
              <Pressable
                testID="detail-delete"
                onPress={async () => {
                  haptic.warning();
                  await api.deleteProduct(id);
                  router.back();
                }}
                style={styles.roundBtn}
              >
                <Feather name="trash-2" size={20} color="#fff" />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ padding: spacing.lg }}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <AppText variant="title">{product.name}</AppText>
            <AppText variant="section" color={colors.brandDark} style={{ marginTop: 4, fontVariant: ["tabular-nums"] }}>
              {formatPrice(product.price, product.currency)}
            </AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: 2 }}>
              {product.merchant || "—"} · {formatDate(product.purchase_date)}
            </AppText>
          </Animated.View>

          {/* Status section */}
          <AppText variant="section" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
            Durum
          </AppText>
          <View style={styles.statusRow}>
            <Card style={styles.statusCard}>
              <CountdownRing
                size={100}
                stroke={9}
                progress={returnProgress}
                color={returnColor}
                label={rdl < 0 ? "0" : `${rdl}`}
                sublabel="gün"
              />
              <AppText variant="caption" color={colors.mutedText} style={{ marginTop: spacing.sm }}>
                İade süresi
              </AppText>
            </Card>
            <View style={{ flex: 1, gap: spacing.md }}>
              <Card style={{ paddingVertical: spacing.md }}>
                <AppText variant="caption" color={colors.mutedText}>
                  Garanti
                </AppText>
                <AppText variant="card" color={colors.brandDark} style={{ marginTop: 2 }}>
                  {daysLabel(wdl)}
                </AppText>
              </Card>
              <Card style={{ paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather
                  name={product.receipt_path || product.image_path ? "check-circle" : "alert-circle"}
                  size={18}
                  color={product.receipt_path || product.image_path ? colors.success : colors.warning}
                />
                <View>
                  <AppText variant="caption" color={colors.mutedText}>
                    Fiş
                  </AppText>
                  <AppText variant="card">
                    {product.receipt_path || product.image_path ? "Kayıtlı" : "Eksik"}
                  </AppText>
                </View>
              </Card>
            </View>
          </View>

          {/* Timeline */}
          <AppText variant="section" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
            Yaşam döngüsü
          </AppText>
          <Card>
            {timeline.map((t, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={{ alignItems: "center" }}>
                  <View style={[styles.tlDot, { backgroundColor: t.color, borderColor: colors.surfaceSecondary }]} />
                  {i < timeline.length - 1 && <View style={[styles.tlLine, { backgroundColor: colors.border }]} />}
                </View>
                <View style={{ flex: 1, paddingBottom: i < timeline.length - 1 ? spacing.lg : 0 }}>
                  <AppText variant="body" weight="semibold">
                    {t.title}
                  </AppText>
                  <AppText variant="caption" color={colors.mutedText}>
                    {t.date}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>

          {/* Notification preferences */}
          <AppText variant="section" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
            Bildirim tercihleri
          </AppText>
          <Card style={{ gap: spacing.md }}>
            <View style={styles.notifyRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="semibold">
                  İade hatırlatması
                </AppText>
                <AppText variant="caption" color={colors.mutedText}>
                  Süre bitmeden haber ver
                </AppText>
              </View>
              <Switch
                testID="notify-return"
                value={notifyReturn}
                onValueChange={(v) => toggleNotify("return", v)}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
            <View style={[styles.notifyRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="semibold">
                  Garanti hatırlatması
                </AppText>
                <AppText variant="caption" color={colors.mutedText}>
                  Garanti bitmeden haber ver
                </AppText>
              </View>
              <Switch
                testID="notify-warranty"
                value={notifyWarranty}
                onValueChange={(v) => toggleNotify("warranty", v)}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          </Card>

          {/* Actions */}
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Button
              testID="action-return"
              title="İade edebilir miyim?"
              icon={<Feather name="rotate-ccw" size={18} color={colors.onBrand} />}
              onPress={() => router.push(`/return/${id}`)}
            />
            <Button
              testID="action-warranty"
              title="Garanti talebi oluştur"
              variant="secondary"
              icon={<Feather name="shield" size={18} color={colors.onSurface} />}
              onPress={() => router.push(`/warranty-claim?id=${id}`)}
            />
            <Button
              testID="action-documents"
              title="Belgeler"
              variant="secondary"
              icon={<Feather name="folder" size={18} color={colors.onSurface} />}
              onPress={() => router.push(`/documents/${id}`)}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function buildTimeline(p: any) {
  const items: { title: string; date: string; color: string }[] = [];
  const base = p.purchase_date ? new Date(p.purchase_date) : new Date();
  items.push({ title: "Satın alındı", date: formatDate(p.purchase_date), color: "#68B58A" });
  if (p.receipt_path || p.image_path) {
    items.push({ title: "Fiş kaydedildi", date: formatDate(p.purchase_date), color: "#8FCFAE" });
  }
  const returnDate = new Date(base.getTime() + (p.return_days || 14) * 86400000);
  items.push({ title: "İade süresi bitiyor", date: formatDate(returnDate.toISOString()), color: "#E9B75C" });
  const warrantyEnd = new Date(base.getTime() + (p.warranty_months || 24) * 30 * 86400000);
  items.push({ title: "Garanti bitiyor", date: formatDate(warrantyEnd.toISOString()), color: "#DF7C76" });
  return items;
}

const styles = StyleSheet.create({
  hero: { height: 300, backgroundColor: "#ddd" },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: { flexDirection: "row", gap: spacing.md },
  statusCard: { alignItems: "center", justifyContent: "center", width: 150 },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  notifyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tlDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  tlLine: { width: 2, flex: 1, marginVertical: 2 },
});
