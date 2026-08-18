import React from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen } from "@/src/components/layout";
import { AppText, Card } from "@/src/components/ui";
import { useTheme, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { haptic } from "@/src/lib/format";

const THEME_NAMES: Record<string, string> = { soft: "Saklio Soft", dark: "Saklio Dark", color: "Saklio Color" };

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut, theme } = useAuth();

  const rows: { icon: any; label: string; value?: string; onPress: () => void; danger?: boolean }[] = [
    { icon: "user", label: "Hesabım", value: user?.email, onPress: () => {} },
    { icon: "dollar-sign", label: "Para birimim", value: user?.currency || "TL", onPress: () => {} },
    { icon: "globe", label: "Dil", value: "Türkçe", onPress: () => {} },
    { icon: "bell", label: "Bildirimler", onPress: () => router.push("/notifications") },
    { icon: "mail", label: "Bağlı hesaplar", value: "Gmail", onPress: () => router.push("/gmail-connect") },
    { icon: "droplet", label: "Tema", value: THEME_NAMES[theme], onPress: () => router.push("/theme-settings") },
    { icon: "download", label: "Verilerimi indir", onPress: () => {} },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title">Profil</AppText>

        {/* Profile card */}
        <Card style={{ marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
            <AppText variant="title" color={colors.onBrand}>
              {(user?.name?.charAt(0) || "S").toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="section">{user?.name || "Saklio Kullanıcısı"}</AppText>
            <AppText variant="body" color={colors.mutedText}>
              {user?.email}
            </AppText>
          </View>
        </Card>

        {/* Settings list */}
        <View style={[styles.list, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {rows.map((r, i) => (
            <Pressable
              key={r.label}
              testID={`profile-${r.icon}`}
              onPress={() => {
                haptic.light();
                r.onPress();
              }}
              style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                <Feather name={r.icon} size={18} color={colors.brandDark} />
              </View>
              <AppText variant="body" style={{ flex: 1 }}>
                {r.label}
              </AppText>
              {r.value ? (
                <AppText variant="caption" color={colors.mutedText}>
                  {r.value}
                </AppText>
              ) : null}
              <Feather name="chevron-right" size={18} color={colors.mutedText} />
            </Pressable>
          ))}
        </View>

        {/* Sign out */}
        <Pressable
          testID="sign-out"
          onPress={async () => {
            haptic.medium();
            await signOut();
            router.replace("/login");
          }}
          style={[styles.signout, { borderColor: colors.border }]}
        >
          <Feather name="log-out" size={18} color={colors.error} />
          <AppText variant="body" color={colors.error} weight="semibold">
            Çıkış yap
          </AppText>
        </Pressable>

        <AppText variant="caption" color={colors.mutedText} style={{ textAlign: "center", marginTop: spacing.lg }}>
          saklio · v1.0.0
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  list: { marginTop: spacing.lg, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  signout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: spacing.lg,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
