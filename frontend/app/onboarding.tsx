import React, { useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { storage } from "@/src/utils/storage";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Button } from "@/src/components/ui";
import {
  ScanReceiptIllustration,
  CalendarIllustration,
  ShieldIllustration,
  EmptyBoxIllustration,
} from "@/src/components/Illustrations";
import { haptic } from "@/src/lib/format";
import { LangSwitch, useT } from "@/src/i18n";

const SLIDE_ILLOS = [ScanReceiptIllustration, CalendarIllustration, ShieldIllustration, EmptyBoxIllustration];
const SLIDE_KEYS = [
  { t: "ob1_t", b: "ob1_b" },
  { t: "ob2_t", b: "ob2_b" },
  { t: "ob3_t", b: "ob3_b" },
  { t: "ob4_t", b: "ob4_b" },
];

export default function Onboarding() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);

  const finish = async () => {
    await storage.setItem("saklio_onboarded", true);
    router.replace("/login");
  };

  const next = () => {
    haptic.light();
    if (page < SLIDE_KEYS.length - 1) {
      ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
      setPage(page + 1);
    } else {
      finish();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.top}>
        <LangSwitch />
        <Pressable testID="skip-onboarding" onPress={finish}>
          <AppText variant="body" color={colors.mutedText}>
            {t("skip")}
          </AppText>
        </Pressable>
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDE_KEYS.map((s, i) => {
          const Illo = SLIDE_ILLOS[i];
          return (
            <View key={s.t} style={[styles.slide, { width }]}>
              <View style={[styles.illoWrap, { backgroundColor: colors.surfaceTertiary }]}>
                <Illo size={220} brand={colors.brand} ink={colors.onSurface} />
              </View>
              <Animated.View entering={FadeInUp.duration(400)} style={{ marginTop: spacing.xl }}>
                <AppText variant="title" style={{ textAlign: "center" }}>
                  {t(s.t)}
                </AppText>
                <AppText
                  variant="body"
                  color={colors.mutedText}
                  style={{ textAlign: "center", marginTop: spacing.md, lineHeight: 24, fontSize: 16 }}
                >
                  {t(s.b)}
                </AppText>
              </Animated.View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDE_KEYS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === page ? colors.brand : colors.border,
              }}
            />
          ))}
        </View>
        <Button
          testID="onboarding-next"
          title={page === SLIDE_KEYS.length - 1 ? t("getStarted") : t("continue")}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  illoWrap: {
    width: 280,
    height: 280,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
});
