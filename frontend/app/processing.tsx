import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Screen } from "@/src/components/layout";
import { AppText, Button } from "@/src/components/ui";
import { ScanReceiptIllustration, ReceiptErrorIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { scanStore } from "@/src/lib/scanStore";
import { api, uploadImage } from "@/src/api/client";
import { compressImageBase64, uriToBase64 } from "@/src/lib/image-b64";
import { haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";

export default function Processing() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();
  const STEPS = [t("step1"), t("step2"), t("step3"), t("step4"), t("step5")];
  const [step, setStep] = useState(0);
  const [error, setError] = useState(false);
  const doneRef = useRef(false);
  const resultRef = useRef<any>(null);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    const draft = scanStore.get();
    // Kick off the real AI scan
    (async () => {
      try {
        let b64 = draft.base64;
        if (!b64 && draft.uri) b64 = await uriToBase64(draft.uri);
        if (!b64) throw new Error("no image");
        b64 = await compressImageBase64(b64);
        const res = await api.scan(b64);
        resultRef.current = res;
        // upload image in background (best effort)
        if (draft.uri) {
          uploadImage(draft.uri)
            .then((path) => scanStore.set({ imagePath: path }))
            .catch(() => {});
        }
      } catch (e) {
        resultRef.current = "error";
      }
    })();

    // Animate steps
    const interval = setInterval(() => {
      setStep((s) => {
        if (s < STEPS.length - 1) {
          haptic.light();
          return s + 1;
        }
        return s;
      });
    }, 700);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // When steps complete AND result is ready -> navigate
    if (step >= STEPS.length - 1 && !doneRef.current) {
      const check = setInterval(() => {
        if (resultRef.current && !doneRef.current) {
          doneRef.current = true;
          clearInterval(check);
          if (resultRef.current === "error") {
            haptic.error();
            setError(true);
          } else {
            scanStore.set({ result: resultRef.current });
            haptic.success();
            router.replace("/confirm");
          }
        }
      }, 300);
      return () => clearInterval(check);
    }
  }, [step, router]);

  if (error) {
    return (
      <Screen>
        <Animated.View entering={FadeIn} style={styles.errorWrap}>
          <ReceiptErrorIllustration size={180} brand={colors.error} ink={colors.onSurface} />
          <AppText variant="title" style={{ marginTop: spacing.lg, textAlign: "center" }}>
            {t("scanErrT")}
          </AppText>
          <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
            {t("scanErrB")}
          </AppText>
          <View style={{ width: "100%", gap: spacing.md, marginTop: spacing.xl }}>
            <Button testID="retry-scan" title={t("retryScan")} onPress={() => router.replace("/scan")} />
            <Button
              testID="manual-entry"
              title={t("manualEntry")}
              variant="secondary"
              onPress={() => router.replace("/add-manually")}
            />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Animated.View style={[styles.illo, pulseStyle, { backgroundColor: colors.surfaceTertiary }]}>
          <ScanReceiptIllustration size={140} brand={colors.brand} ink={colors.onSurface} />
        </Animated.View>

        <AppText variant="title" style={{ marginTop: spacing.xl }}>
          {t("working")}
        </AppText>
        <AppText variant="body" color={colors.mutedText} style={{ marginTop: 4 }}>
          {t("processingReceipt")}
        </AppText>

        <View style={styles.steps}>
          {STEPS.map((label, i) => {
            const active = i <= step;
            const done = i < step;
            return (
              <Animated.View key={label} entering={FadeInDown.delay(i * 100)}>
                <View style={[styles.stepRow, { opacity: active ? 1 : 0.35 }]}>
                  <View
                    style={[
                      styles.stepIcon,
                      {
                        backgroundColor: done ? colors.brand : active ? colors.surfaceTertiary : colors.surfaceSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {done ? (
                      <Feather name="check" size={14} color={colors.onBrand} />
                    ) : active ? (
                      <View style={[styles.dot, { backgroundColor: colors.brandDark }]} />
                    ) : null}
                  </View>
                  <AppText variant="body" weight={active ? "medium" : "regular"}>
                    {label}
                  </AppText>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  illo: { width: 200, height: 200, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  steps: { marginTop: spacing.xl, gap: spacing.md, alignSelf: "stretch", paddingHorizontal: spacing.md },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepIcon: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
