import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
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

export default function DataScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const isDelete = mode === "delete";

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"intro" | "code" | "done">("intro");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const doExport = async () => {
    setLoading(true);
    setError("");
    try {
      const res: any = await api.exportData();
      haptic.success();
      setStep("done");
      setMsg(
        res.sent
          ? `Verilerin ${res.email} adresine gönderildi (${res.counts.products} ürün, ${res.counts.documents} belge).`
          : `Verilerin hazırlandı (${res.counts.products} ürün, ${res.counts.documents} belge). E-posta gönderimi şu an yapılamadı, yayınlandıktan sonra teslim edilecek.`
      );
    } catch (e: any) {
      haptic.error();
      setError(e.message || "İşlem başarısız");
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
      if (res.debug_code) setMsg(`Test kodu: ${res.debug_code}`);
      else setMsg(`Onay kodu ${res.email} adresine gönderildi.`);
    } catch (e: any) {
      setError(e.message || "İşlem başarısız");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (code.length < 6) {
      setError("6 haneli kodu gir");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.confirmReset(code);
      haptic.success();
      setStep("done");
      setMsg("Tüm ürün ve belge verilerin silindi. Hesabın aktif.");
    } catch (e: any) {
      haptic.error();
      setError(e.message || "Kod hatalı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title={isDelete ? "Verilerimi sil" : "Verilerimi indir"} onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled" bottomOffset={20}>
        {step === "done" ? (
          <Animated.View entering={FadeInDown} style={{ alignItems: "center", paddingTop: spacing.xl }}>
            <View style={[styles.circle, { backgroundColor: isDelete ? colors.error : colors.brand }]}>
              <Feather name="check" size={40} color="#fff" />
            </View>
            <AppText variant="section" style={{ marginTop: spacing.lg, textAlign: "center" }}>
              İşlem tamam
            </AppText>
            <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
              {msg}
            </AppText>
            <Button title="Bitti" onPress={() => router.back()} style={{ marginTop: spacing.xl, minWidth: 200 }} />
          </Animated.View>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[styles.icon, { backgroundColor: isDelete ? "rgba(223,124,118,0.15)" : colors.surfaceTertiary }]}>
                  <Feather name={isDelete ? "trash-2" : "download"} size={22} color={isDelete ? colors.error : colors.brandDark} />
                </View>
                <AppText variant="body" color={colors.mutedText} style={{ flex: 1 }}>
                  {isDelete
                    ? "Tüm ürünlerin, belgelerin ve asistan geçmişin silinir. Hesabın açık kalır. Onay için e-postana bir kod göndeririz."
                    : "Ürünlerin, belgelerin ve asistan geçmişin dahil tüm verilerin JSON dosyası olarak e-postana gönderilir."}
                </AppText>
              </View>
              <AppText variant="caption" color={colors.mutedText} style={{ marginTop: spacing.md }}>
                E-posta: {user?.email}
              </AppText>
            </Card>

            {step === "code" && (
              <View style={{ marginTop: spacing.lg }}>
                <Input
                  testID="reset-code"
                  label="Onay kodu"
                  placeholder="6 haneli kod"
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
                <Button testID="do-export" title="Verilerimi e-posta ile gönder" onPress={doExport} loading={loading} />
              ) : step === "intro" ? (
                <Button testID="request-code" title="Onay kodu gönder" onPress={requestCode} loading={loading} />
              ) : (
                <Button testID="confirm-delete" title="Verilerimi kalıcı olarak sil" onPress={confirmDelete} loading={loading} />
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
