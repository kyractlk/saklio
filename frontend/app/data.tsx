import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen, Header } from "@/src/components/layout";
import { AppText, Button, Input, Card } from "@/src/components/ui";
import { ShieldIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { haptic } from "@/src/lib/format";
import { useT } from "@/src/i18n";
import { exportReportHtml, downloadHtmlFile, downloadJsonFile } from "@/src/lib/email-templates";

export default function DataScreen() {
  const { colors } = useTheme();
  const { t, lang } = useT();
  const router = useRouter();
  const { user } = useAuth();
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const isDelete = mode === "delete";

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"intro" | "code" | "done">("intro");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const doExportDownload = async () => {
    setLoading(true);
    setError("");
    try {
      const res: any = await api.exportData({ sendEmail: false });
      haptic.success();
      if (res.payload) {
        const html = exportReportHtml(lang, res.payload);
        downloadHtmlFile("saklio-export.html", html);
        downloadJsonFile("saklio-export.json", res.payload);
      }
      setStep("done");
      setMsg(t("exportReady", { products: res.counts?.products || 0, documents: res.counts?.documents || 0 }));
    } catch (e: any) {
      haptic.error();
      setError(e.message || t("opFailed"));
    } finally {
      setLoading(false);
    }
  };

  const doExportEmail = async () => {
    setLoading(true);
    setError("");
    try {
      const res: any = await api.exportData({ sendEmail: true });
      haptic.success();
      setStep("done");
      setMsg(t("exportSent", { email: res.email, products: res.counts.products, documents: res.counts.documents }));
    } catch (e: any) {
      haptic.error();
      setError(e.message || t("opFailed"));
    } finally {
      setLoading(false);
    }
  };

  const requestCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res: any = await api.requestReset();
      haptic.medium();
      setStep("code");
      if (res.debug_code) setMsg(t("testCode", { code: res.debug_code }));
      else setMsg(t("codeSentTo", { email: res.email }));
    } catch (e: any) {
      setError(e.message || t("opFailed"));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (code.length < 6) {
      setError(t("enterCode6"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.confirmReset(code);
      haptic.success();
      setStep("done");
      setMsg(t("dataDeleted"));
    } catch (e: any) {
      haptic.error();
      setError(e.message || t("codeWrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title={isDelete ? t("deleteTitle") : t("exportTitle")} onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled" bottomOffset={20}>
        {step === "done" ? (
          <Animated.View entering={FadeInDown} style={{ alignItems: "center", paddingTop: spacing.xl }}>
            <View style={[styles.circle, { backgroundColor: isDelete ? colors.error : colors.brand }]}>
              <Feather name="check" size={40} color="#fff" />
            </View>
            <AppText variant="section" style={{ marginTop: spacing.lg, textAlign: "center" }}>
              {t("opDone")}
            </AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
              {msg}
            </AppText>
            <Button title={t("done")} onPress={() => router.back()} style={{ marginTop: spacing.xl, minWidth: 200 }} />
          </Animated.View>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[styles.icon, { backgroundColor: isDelete ? "rgba(223,124,118,0.15)" : colors.surfaceTertiary }]}>
                  <Feather name={isDelete ? "trash-2" : "download"} size={22} color={isDelete ? colors.error : colors.brandDark} />
                </View>
                <AppText variant="body" color={colors.mutedText} style={{ flex: 1 }}>
                  {isDelete ? t("deleteInfo") : t("exportInfo")}
                </AppText>
              </View>
              <AppText variant="caption" color={colors.mutedText} style={{ marginTop: spacing.md }}>
                {t("emailLabel")}: {user?.email}
              </AppText>
            </Card>

            {step === "code" && (
              <View style={{ marginTop: spacing.lg }}>
                <Input
                  testID="reset-code"
                  label={t("confirmCode")}
                  placeholder={t("codePlaceholder")}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  maxLength={6}
                  error={error}
                />
              </View>
            )}

            {msg ? (
              <AppText variant="caption" color={colors.brandDark} style={{ marginTop: spacing.md }}>
                {msg}
              </AppText>
            ) : null}
            {error && step !== "code" ? (
              <AppText variant="caption" color={colors.error} style={{ marginTop: spacing.sm }}>
                {error}
              </AppText>
            ) : null}

            <View style={{ marginTop: spacing.xl }}>
              {!isDelete ? (
                <Button
                  testID="do-export"
                  title={t("exportTitle")}
                  onPress={() => {
                    Alert.alert(t("exportTitle"), t("exportChooseInfo"), [
                      { text: t("exportDownloadBtn"), onPress: doExportDownload },
                      { text: t("sendMyData"), onPress: doExportEmail },
                    ]);
                  }}
                  loading={loading}
                />
              ) : step === "intro" ? (
                <Button testID="request-code" title={t("sendCode")} onPress={requestCode} loading={loading} />
              ) : (
                <Button testID="confirm-delete" title={t("deletePermanently")} onPress={confirmDelete} loading={loading} />
              )}
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  circle: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
