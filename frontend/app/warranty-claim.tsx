import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Input, Card, Skeleton } from "@/src/components/ui";
import { ProductThumb } from "@/src/components/ProductCard";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { formatDate, haptic } from "@/src/lib/format";

export default function WarrantyClaim() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [problem, setProblem] = useState("");
  const [loading, setLoading] = useState(false);
  const [claim, setClaim] = useState<any>(null);

  useEffect(() => {
    api.getProduct(id).then(setProduct).catch(() => {});
  }, [id]);

  const generate = async () => {
    if (!problem.trim()) return;
    setLoading(true);
    haptic.medium();
    try {
      const res = await api.warrantyClaim(id, problem.trim());
      setClaim(res);
      haptic.success();
    } catch {
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title="Garanti talebi" subtitle="Üründe ne sorun var?" onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {product ? (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <ProductThumb path={product.image_path} category={product.category} size={52} />
            <View style={{ flex: 1 }}>
              <AppText variant="card" numberOfLines={1}>
                {product.name}
              </AppText>
              <AppText variant="caption" color={colors.mutedText}>
                {product.merchant} · {formatDate(product.purchase_date)}
              </AppText>
            </View>
          </Card>
        ) : (
          <Skeleton height={80} radius={24} />
        )}

        <Input
          testID="claim-problem"
          label="Sorunu anlat"
          placeholder="Örn. Sol kulaklık ses vermiyor."
          value={problem}
          onChangeText={setProblem}
          multiline
          style={{ height: 100, textAlignVertical: "top", paddingTop: 12 }}
        />

        <Button
          testID="claim-generate"
          title="Başvuruyu hazırla"
          onPress={generate}
          loading={loading}
          icon={<Feather name="zap" size={18} color={colors.onBrand} />}
        />

        {claim ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={[styles.ready, { backgroundColor: "rgba(104,181,138,0.12)" }]}>
              <Feather name="check-circle" size={18} color={colors.success} />
              <AppText variant="body" weight="semibold" color={colors.success}>
                Garanti başvurun hazır.
              </AppText>
            </View>
            <Card style={{ marginTop: spacing.md }}>
              <AppText variant="caption" color={colors.mutedText}>
                Başvuru metni
              </AppText>
              <AppText variant="body" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
                {claim.claim_text}
              </AppText>
            </Card>
          </Animated.View>
        ) : null}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ready: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, borderRadius: radius.md },
});
