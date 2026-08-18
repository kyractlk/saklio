import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Card, Skeleton } from "@/src/components/ui";
import { ProductThumb } from "@/src/components/ProductCard";
import { SaklioLogo } from "@/src/components/Illustrations";
import { useTheme, spacing, radius, CATEGORY_LABELS } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { formatPrice, formatDate, daysLabel, haptic } from "@/src/lib/format";

export default function ShareImport() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    api
      .getShare(token)
      .then(setData)
      .catch(() => setError(true));
  }, [token, user, authLoading]);

  const accept = async () => {
    setAdding(true);
    try {
      const p: any = await api.acceptShare(token);
      haptic.success();
      router.replace(`/product/${p.id}`);
    } catch {
      haptic.error();
      setAdding(false);
    }
  };

  if (error) {
    return (
      <Screen>
        <Header title="Paylaşım" onBack={() => router.replace("/(tabs)")} />
        <View style={styles.center}>
          <Feather name="link" size={48} color={colors.mutedText} />
          <AppText variant="section" style={{ marginTop: spacing.lg }}>
            Paylaşım bulunamadı
          </AppText>
          <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
            Bu bağlantının süresi dolmuş olabilir.
          </AppText>
        </View>
      </Screen>
    );
  }

  const p = data?.product;

  return (
    <Screen>
      <Header title="Ürün paylaşımı" onBack={() => router.replace("/(tabs)")} />
      <View style={{ flex: 1, padding: spacing.lg }}>
        <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
          <SaklioLogo size={44} color={colors.brandDark} accent={colors.brand} />
          <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
            {data ? `${data.from_name || "Bir kullanıcı"} seninle bir ürün paylaştı` : "Yükleniyor…"}
          </AppText>
        </View>

        {!p ? (
          <Skeleton height={180} radius={24} />
        ) : (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Card>
              <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                <ProductThumb path={p.image_path} category={p.category} size={72} />
                <View style={{ flex: 1 }}>
                  <AppText variant="card" numberOfLines={2}>
                    {p.name}
                  </AppText>
                  <AppText variant="caption" color={colors.mutedText}>
                    {p.merchant || "—"} · {CATEGORY_LABELS[p.category] || "Diğer"}
                  </AppText>
                  <AppText variant="body" weight="semibold" style={{ marginTop: 4 }}>
                    {formatPrice(p.price, p.currency)}
                  </AppText>
                </View>
              </View>
              <View style={[styles.stats, { borderTopColor: colors.border }]}>
                <View style={styles.stat}>
                  <AppText variant="caption" color={colors.mutedText}>
                    İade
                  </AppText>
                  <AppText variant="body" weight="semibold" color={colors.success}>
                    {daysLabel(p.return_days_left)}
                  </AppText>
                </View>
                <View style={styles.stat}>
                  <AppText variant="caption" color={colors.mutedText}>
                    Garanti
                  </AppText>
                  <AppText variant="body" weight="semibold" color={colors.brandDark}>
                    {daysLabel(p.warranty_days_left)}
                  </AppText>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Button testID="accept-share" title="Ürünü ekle" onPress={accept} loading={adding} disabled={!p} />
        <Button title="Vazgeç" variant="ghost" onPress={() => router.replace("/(tabs)")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  stats: { flexDirection: "row", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
});
