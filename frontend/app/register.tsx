import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme, spacing } from "@/src/theme";
import { AppText, Button, Input } from "@/src/components/ui";
import { Header } from "@/src/components/layout";
import { useAuth } from "@/src/context/AuthContext";
import { haptic } from "@/src/lib/format";

export default function Register() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name || !email || !password) {
      setError("Lütfen tüm alanları doldur");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signUp(name.trim(), email.trim(), password);
      haptic.success();
      router.replace("/(tabs)");
    } catch (e: any) {
      haptic.error();
      setError(e.message || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <LinearGradient colors={[colors.surfaceTertiary, colors.surface]} style={StyleSheet.absoluteFill} />
      <Header title="Hesap oluştur" subtitle="Saklio’ya ilk adımını at" onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={{ gap: spacing.md }}>
          <Input
            testID="register-name"
            label="Adın"
            placeholder="Adın Soyadın"
            value={name}
            onChangeText={setName}
            icon={<Feather name="user" size={18} color={colors.mutedText} />}
          />
          <Input
            testID="register-email"
            label="E-posta"
            placeholder="ornek@mail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            icon={<Feather name="mail" size={18} color={colors.mutedText} />}
          />
          <Input
            testID="register-password"
            label="Şifre"
            placeholder="En az 6 karakter"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            icon={<Feather name="lock" size={18} color={colors.mutedText} />}
            error={error}
          />
          <Button testID="register-submit" title="Kayıt ol" onPress={submit} loading={loading} />
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.lg },
});
