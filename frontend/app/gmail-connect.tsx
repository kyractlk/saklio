import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Card } from "@/src/components/ui";
import { MailInboxIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { formatPrice, haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";

type Phase = "idle" | "scanning" | "result";

export default function GmailConnect() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [found, setFound] = useState(0);
  const [importing, setImporting] = useState(false);

  const connect = async () => {
    haptic.medium();
    setPhase("scanning");
    let total = 61;
    try {
      const preview: any = await api.gmailPreview();
      total = preview.found || 61;
    } catch {}
    setFound(total);
    // animated counter 12 -> 27 -> 43 -> total
    const targets = [12, 27, 43, total];
    let i = 0;
    const step = () => {
      if (i < targets.length) {
        setCount(targets[i]);
        haptic.light();
        i++;
        setTimeout(step, 600);
      } else {
        setPhase("result");
        haptic.success();
      }
    };
    step();
  };

  const doImport = async () => {
    setImporting(true);
    haptic.medium();
    try {
      await api.gmailImport();
      haptic.success();
      router.replace("/(tabs)");
    } catch {
      setImporting(false);
    }
  };

  return (
    <Screen>
      <Header title={t("importPurchases")} onBack={() => router.back()} />
      <View style={styles.container}>
        {phase === "idle" && (
          <Animated.View entering={FadeIn} style={styles.center}>
            <View style={[styles.illoWrap, { backgroundColor: colors.surfaceTertiary }]}>
              <MailInboxIllustration size={200} brand={colors.brand} ink={colors.onSurface} />
            </View>
            <AppText variant="section" style={{ marginTop: spacing.xl, textAlign: "center" }}>
              {t("gmailFindT")}
            </AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center", maxWidth: 300 }}>
              {t("gmailFindB")}
            </AppText>
          </Animated.View>
        )}

        {phase === "scanning" && (
          <View style={styles.center}>
            <AppText variant="display" color={colors.brandDark} style={{ fontVariant: ["tabular-nums"] }}>
              {count}
            </AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm }}>
              {t("productsFound")}
            </AppText>
          </View>
        )}

        {phase === "result" && (
          <Animated.View entering={FadeInDown} style={styles.center}>
            <View style={[styles.checkCircle, { backgroundColor: colors.brand }]}>
              <Feather name="check" size={40} color={colors.onBrand} />
            </View>
            <AppText variant="title" style={{ marginTop: spacing.lg, textAlign: "center" }}>
              {t("foundPurchases", { n: found })}
            </AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
              {t("foundPurchasesB")}
            </AppText>
          </Animated.View>
        )}
      </View>

      <View style={styles.footer}>
        {phase === "idle" && (
          <Button
            testID="gmail-connect-btn"
            title={t("connectGmailCta")}
            onPress={connect}
            icon={<Feather name="mail" size={18} color={colors.onBrand} />}
          />
        )}
        {phase === "result" && (
          <>
            <Button testID="gmail-import-all" title={t("importAll")} onPress={doImport} loading={importing} />
            <Button testID="gmail-review" title={t("skipForNow")} variant="ghost" onPress={() => router.back()} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg },
  center: { alignItems: "center", justifyContent: "center" },
  illoWrap: { width: 260, height: 240, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  checkCircle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
