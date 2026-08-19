import React from "react";
import { Image, Linking, Pressable, View, StyleSheet } from "react-native";
import { AppText } from "./ui";
import { useTheme, spacing } from "@/src/theme";

export function AystechMark({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => Linking.openURL("https://sakliov2.web.app/support")}
      style={[styles.wrap, compact && { marginTop: spacing.md }]}
    >
      <Image source={require("../../assets/images/aystech.png")} style={compact ? styles.logoSm : styles.logo} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <AppText variant="caption" color={colors.mutedText} style={{ textAlign: "center" }}>
          Produced by aystech · Kayra Çatalkaya
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 6, marginTop: spacing.xl, paddingBottom: spacing.md },
  logo: { width: 140, height: 48 },
  logoSm: { width: 110, height: 36 },
});
