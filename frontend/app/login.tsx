import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme, spacing } from "@/src/theme";
import { AppText, Button, Input } from "@/src/components/ui";
import { SaklioLogo } from "@/src/components/Illustrations";
import { useAuth } from "@/src/context/AuthContext";
import { haptic } from "@/src/lib/format";
import { LangSwitch, useT } from "@/src/i18n";
import { AystechMark } from "@/src/components/AystechMark";

export default function Login() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useT();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email || !password) {
      setError(t("fillAll"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      haptic.success();
      router.replace("/(tabs)");
    } catch (e: any) {
      haptic.error();
      setError(e.message || t("loginFail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient
        colors={[colors.surfaceTertiary, colors.surface]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        <View style={{ alignItems: "flex-end", marginBottom: spacing.md }}>
          <LangSwitch />
        </View>
        <View style={styles.header}>
          <SaklioLogo size={64} color={colors.brandDark} accent={colors.brand} />
          <AppText variant="title" style={{ marginTop: spacing.md }}>
            {t("welcomeBack")}
          </AppText>
          <AppText variant="body" color={colors.mutedText} style={{ marginTop: 4 }}>
            {t("slogan")}
          </AppText>
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={{ gap: spacing.md }}>
          <Input
            testID="login-email"
            label={t("email")}
            placeholder={t("emailPh")}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            icon={<Feather name="mail" size={18} color={colors.mutedText} />}
          />
          <Input
            testID="login-password"
            label={t("password")}
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            icon={<Feather name="lock" size={18} color={colors.mutedText} />}
            error={error}
          />
          <Button testID="login-submit" title={t("continueEmail")} onPress={submit} loading={loading} />
          <Pressable
            testID="go-forgot"
            onPress={() => { haptic.light(); router.push("/forgot"); }}
            style={{ alignItems: "center", marginTop: spacing.sm }}
          >
            <AppText variant="caption" color={colors.brandDark}>{t("forgotPassword")}</AppText>
          </Pressable>
        </Animated.View>

        <Pressable
          testID="go-register"
          onPress={() => {
            haptic.light();
            router.push("/register");
          }}
          style={{ marginTop: spacing.lg, alignItems: "center" }}
        >
          <AppText variant="body" color={colors.mutedText}>
            {t("noAccount")}<AppText color={colors.brandDark} weight="semibold">{t("register")}</AppText>
          </AppText>
        </Pressable>

        <AppText variant="caption" color={colors.mutedText} style={styles.privacy}>
          {t("privacy")}
        </AppText>
        <AystechMark compact />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: spacing.xl },
  privacy: { textAlign: "center", marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
