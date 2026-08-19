import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Card, Skeleton } from "@/src/components/ui";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";

export default function ReturnDetail() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    Promise.all([api.returnVerdict(id), api.getProduct(id)])
      .then(([v, p]) => {
        setData(v);
        setProduct(p);
        haptic.light();
      })
      .catch(() => {});
  }, [id]);

  const checks = [
    { key: "receipt", label: t("chkReceipt") },
    { key: "in_time", label: t("chkTime") },
    { key: "type_ok", label: t("chkType") },
  ];

  const positive = data?.days_left >= 0;

  return (
    <Screen>
      <Header title={t("canReturnT")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {!data ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={140} radius={24} />
            <Skeleton height={180} radius={24} />
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <Card style={{ backgroundColor: positive ? "rgba(104,181,138,0.12)" : "rgba(223,124,118,0.12)", borderColor: positive ? colors.success : colors.error }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={[styles.verdictIcon, { backgroundColor: positive ? colors.success : colors.error }]}>
                    <Feather name={positive ? "check" : "x"} size={26} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="section">{data.verdict}</AppText>
                    <AppText variant="body" color={colors.mutedText} style={{ marginTop: 2 }}>
                      {data.detail}
                    </AppText>
                  </View>
                </View>
              </Card>
            </Animated.View>

            <AppText variant="section" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              {t("forReturn")}
            </AppText>
            <Card style={{ gap: spacing.md }}>
              {checks.map((c) => {
                const ok = data.checks?.[c.key];
                return (
                  <View key={c.key} style={styles.checkRow}>
                    <Feather
                      name={ok ? "check-circle" : "x-circle"}
                      size={20}
                      color={ok ? colors.success : colors.mutedText}
                    />
                    <AppText variant="body" color={ok ? colors.onSurface : colors.mutedText}>
                      {c.label}
                    </AppText>
                  </View>
                );
              })}
            </Card>

            <View style={[styles.warn, { backgroundColor: "rgba(233,183,92,0.15)" }]}>
              <Feather name="info" size={18} color={colors.warning} />
              <AppText variant="caption" color={colors.warning} style={{ flex: 1 }}>
                {data.warning}
              </AppText>
            </View>
          </>
        )}
      </ScrollView>

      {data && positive ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Button
            testID="start-return"
            title={started ? t("returnStarted") : t("startReturn")}
            onPress={() => {
              haptic.success();
              setStarted(true);
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  verdictIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  warn: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  footer: { padding: spacing.lg, borderTopWidth: 1 },
});
