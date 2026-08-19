import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Button, Input } from "@/src/components/ui";
import { Header } from "@/src/components/layout";
import { api } from "@/src/api/client";
import { haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";

type Step = "email" | "code" | "done";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const { t } = useT();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError(t("fillAll")); return; }
    setLoading(true);
    setError("");
    try {
      await api.sendPasswordResetCode(trimmed);
      haptic.medium();
      setMsg(t("forgotCodeSent", { email: trimmed }));
      setStep("code");
    } catch (e: any) {
      haptic.error();
      setError(e.message || t("opFailed"));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (code.length < 6) { setError(t("enterCode6")); return; }
    if (password.length < 6) { setError(t("errWeakPassword")); return; }
    setLoading(true);
    setError("");
    try {
      await api.confirmPasswordResetCode(email.trim().toLowerCase(), code.trim(), password);
      haptic.success();
      setStep("done");
    } catch (e: any) {
      haptic.error();
      setError(e.message || t("codeWrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={t("forgotTitle")} onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {step === "done" ? (
          <Animated.View entering={FadeInDown} style={styles.done}>
            <View style={[styles.circle, { backgroundColor: colors.brand }]}>
              <Feather name="check" size={40} color="#fff" />
            </View>
            <AppText variant="section" style={{ marginTop: spacing.lg, textAlign: "center" }}>
              {t("opDone")}
            </AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
              {t("forgotDone")}
            </AppText>
            <Button
              title={t("forgotGoLogin")}
              onPress={() => router.replace("/login")}
              style={{ marginTop: spacing.xl, minWidth: 220 }}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: spacing.md }}>
            <AppText variant="body" color={colors.mutedText}>
              {t("forgotInfo")}
            </AppText>

            <Input
              testID="forgot-email"
              label={t("email")}
              placeholder={t("emailPh")}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={step === "email"}
              icon={<Feather name="mail" size={18} color={colors.mutedText} />}
            />

            {step === "code" && (
              <>
                {msg ? (
                  <AppText variant="caption" color={colors.brandDark}>{msg}</AppText>
                ) : null}
                <Input
                  testID="forgot-code"
                  label={t("confirmCode")}
                  placeholder={t("codePlaceholder")}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                  icon={<Feather name="hash" size={18} color={colors.mutedText} />}
                />
                <Input
                  testID="forgot-newpass"
                  label={t("forgotNewPass")}
                  placeholder={t("forgotNewPassPh")}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  icon={<Feather name="lock" size={18} color={colors.mutedText} />}
                />
              </>
            )}

            {error ? (
              <AppText variant="caption" color={colors.error}>{error}</AppText>
            ) : null}

            {step === "email" ? (
              <Button testID="forgot-send" title={t("forgotSend")} onPress={sendCode} loading={loading} />
            ) : (
              <Button testID="forgot-confirm" title={t("forgotConfirm")} onPress={confirm} loading={loading} />
            )}
          </Animated.View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.md },
  done: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing.xl * 2 },
  circle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
});
