import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Screen } from "@/src/components/layout";
import { AppText, Button, Card } from "@/src/components/ui";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { formatPrice, daysLabel, haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";

const CONFETTI = Array.from({ length: 14 });

export default function Success() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);

  const scale = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.6)) });
    checkScale.value = withDelay(300, withSequence(withTiming(1.2, { duration: 200 }), withTiming(1, { duration: 150 })));
    haptic.success();
    if (id) api.getProduct(id).then(setProduct).catch(() => {});
  }, [id]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  return (
    <Screen>
      <View style={styles.container}>
        {/* confetti */}
        {CONFETTI.map((_, i) => (
          <Confetti key={i} index={i} color={i % 2 ? colors.brand : colors.warning} />
        ))}

        <Animated.View style={[styles.circle, circleStyle, { backgroundColor: colors.brand }]}>
          <Animated.View style={checkStyle}>
            <Feather name="check" size={56} color={colors.onBrand} />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(500)}>
          <AppText variant="title" style={{ marginTop: spacing.xl, textAlign: "center" }}>
            {t("added")}
          </AppText>
        </Animated.View>

        {product ? (
          <Animated.View entering={FadeInDown.delay(650)} style={{ alignSelf: "stretch", marginTop: spacing.xl }}>
            <Card>
              <AppText variant="card" numberOfLines={2}>
                {product.name}
              </AppText>
              <AppText variant="body" color={colors.mutedText} style={{ marginTop: 2 }}>
                {product.merchant} · {formatPrice(product.price, product.currency)}
              </AppText>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <AppText variant="caption" color={colors.mutedText}>
                    {t("returnShort")}
                  </AppText>
                  <AppText variant="body" weight="semibold" color={colors.success}>
                    {daysLabel(product.return_days_left)}
                  </AppText>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <AppText variant="caption" color={colors.mutedText}>
                    {t("warranty")}
                  </AppText>
                  <AppText variant="body" weight="semibold" color={colors.brandDark}>
                    {daysLabel(product.warranty_days_left)}
                  </AppText>
                </View>
              </View>
            </Card>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          testID="success-view-product"
          title={t("viewProduct")}
          onPress={() => router.replace(id ? `/product/${id}` : "/(tabs)")}
        />
        <Button title={t("backHome")} variant="ghost" onPress={() => router.replace("/(tabs)")} />
      </View>
    </Screen>
  );
}

function Confetti({ index, color }: { index: number; color: string }) {
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    const delay = index * 40;
    ty.value = withDelay(delay, withTiming(300 + Math.random() * 200, { duration: 1400, easing: Easing.out(Easing.quad) }));
    opacity.value = withDelay(delay + 800, withTiming(0, { duration: 600 }));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { rotate: `${index * 40}deg` }],
    opacity: opacity.value,
  }));
  const left = 40 + ((index * 37) % 300);
  return (
    <Animated.View
      style={[
        { position: "absolute", top: 120, left, width: 8, height: 12, borderRadius: 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  circle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  divider: { width: 1, height: 36 },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
