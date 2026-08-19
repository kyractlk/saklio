import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/theme";
import { SaklioLogo } from "@/src/components/Illustrations";
import { AppText } from "@/src/components/ui";
import { useT } from "@/src/i18n";

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const { t } = useT();

  const scale = useSharedValue(0.6);
  const translateY = useSharedValue(-30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    translateY.value = withSequence(
      withTiming(10, { duration: 500, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 300 })
    );
    scale.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) }));
  }, [opacity, translateY, scale]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(async () => {
      const seen = await storage.getItem<boolean>("saklio_onboarded", false);
      if (user) {
        router.replace("/(tabs)");
      } else if (!seen) {
        router.replace("/onboarding");
      } else {
        router.replace("/login");
      }
    }, 1900);
    return () => clearTimeout(t);
  }, [loading, user, router]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Animated.View style={logoStyle}>
        <SaklioLogo size={96} color={colors.brandDark} accent={colors.brand} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(900).duration(600)}>
        <AppText variant="title" style={{ marginTop: 24, letterSpacing: 4 }}>
          saklio
        </AppText>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(1300).duration(600)}>
        <AppText variant="body" color={colors.mutedText} style={{ marginTop: 8 }}>
          {t("tagline")}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
