import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Modal, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, { SlideInDown } from "react-native-reanimated";
import { Screen } from "@/src/components/layout";
import { AppText, Card } from "@/src/components/ui";
import { useTheme, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/i18n";
import { api } from "@/src/api/client";
import { haptic, setMoneyConfig } from "@/src/lib/format";
import { legalUrl } from "@/src/lib/site";
import { AystechMark } from "@/src/components/AystechMark";

const THEME_NAMES: Record<string, string> = { soft: "Saklio Soft", dark: "Saklio Dark", color: "Saklio Color", sunset: "Saklio Sunset", ocean: "Saklio Ocean" };
const CURRENCIES = [
  { code: "TL", key: "cur_TL", sym: "₺" },
  { code: "USD", key: "cur_USD", sym: "$" },
  { code: "EUR", key: "cur_EUR", sym: "€" },
  { code: "SEK", key: "cur_SEK", sym: "kr" },
  { code: "DKK", key: "cur_DKK", sym: "kr" },
];
const LANGS = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut, theme, refresh } = useAuth();
  const { t, lang, setLang } = useT();
  const [curOpen, setCurOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const selectCurrency = async (code: string) => {
    haptic.success();
    setCurOpen(false);
    setMoneyConfig(code, null);
    try {
      await api.updateProfile({ currency: code });
      await refresh();
    } catch {}
  };

  const selectLang = (code: "tr" | "en") => {
    haptic.success();
    setLangOpen(false);
    setLang(code);
    api.updateProfile({ language: code }).catch(() => {});
  };

  const rows: { icon: any; label: string; value?: string; onPress: () => void; soon?: boolean }[] = [
    { icon: "user", label: t("account"), value: user?.email, onPress: () => {} },
    { icon: "dollar-sign", label: t("currency"), value: user?.currency || "TL", onPress: () => setCurOpen(true) },
    { icon: "globe", label: t("language"), value: LANGS.find((l) => l.code === lang)?.label, onPress: () => setLangOpen(true) },
    { icon: "bell", label: t("notifications"), onPress: () => router.push("/notifications") },
    { icon: "shopping-cart", label: t("shoppingList"), onPress: () => router.push("/shopping-list") },
    { icon: "pie-chart", label: t("finance"), onPress: () => router.push("/finance") },
    { icon: "droplet", label: t("theme"), value: THEME_NAMES[theme], onPress: () => router.push("/theme-settings") },
  ];

  const connectRows: { icon: any; label: string; onPress: () => void; soon?: boolean }[] = [
    { icon: "mail", label: t("connectGmail"), onPress: () => {}, soon: true },
    { icon: "inbox", label: t("connectOutlook"), onPress: () => {}, soon: true },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title">{t("profile")}</AppText>

        {/* Profile card */}
        <Card style={{ marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
            <AppText variant="title" color={colors.onBrand}>
              {(user?.name?.charAt(0) || "S").toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="section">{user?.name || t("saklioUser")}</AppText>
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

        {/* Connected accounts */}
        <AppText variant="caption" color={colors.mutedText} style={styles.sectionLabel}>
          {t("connectedAccounts")}
        </AppText>
        <View style={[styles.list, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: spacing.sm }]}>
          {connectRows.map((r, i) => (
            <View
              key={r.label}
              style={[styles.row, i < connectRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                <Feather name={r.icon} size={18} color={colors.brandDark} />
              </View>
              <AppText variant="body" style={{ flex: 1 }} color={colors.mutedText}>
                {r.label}
              </AppText>
              <View style={[styles.soonBadge, { backgroundColor: colors.surfaceTertiary }]}>
                <AppText variant="caption" color={colors.brandDark} weight="semibold">
                  {t("soon")}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        {/* Data & privacy */}
        <AppText variant="caption" color={colors.mutedText} style={styles.sectionLabel}>
          {t("myData")}
        </AppText>
        <View style={[styles.list, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: spacing.sm }]}>
          <Pressable
            testID="data-export"
            onPress={() => {
              haptic.light();
              router.push("/data?mode=export");
            }}
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceTertiary }]}>
              <Feather name="download" size={18} color={colors.brandDark} />
            </View>
            <AppText variant="body" style={{ flex: 1 }}>
              {t("exportData")}
            </AppText>
            <Feather name="chevron-right" size={18} color={colors.mutedText} />
          </Pressable>
          <Pressable
            testID="data-delete"
            onPress={() => {
              haptic.warning();
              router.push("/data?mode=delete");
            }}
            style={styles.row}
          >
            <View style={[styles.rowIcon, { backgroundColor: "rgba(223,124,118,0.15)" }]}>
              <Feather name="trash-2" size={18} color={colors.error} />
            </View>
            <AppText variant="body" color={colors.error} style={{ flex: 1 }}>
              {t("deleteData")}
            </AppText>
            <Feather name="chevron-right" size={18} color={colors.error} />
          </Pressable>
        </View>
        <AppText variant="caption" color={colors.mutedText} style={styles.sectionLabel}>
          {t("legal")}
        </AppText>
        <View style={[styles.list, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: spacing.sm }]}>
          {[
            { href: legalUrl("/privacy"), label: t("privacyPolicy") },
            { href: legalUrl("/terms"), label: t("terms") },
            { href: legalUrl("/child-safety"), label: t("childSafety") },
            { href: legalUrl("/delete-account"), label: t("deleteAccount") },
            { href: legalUrl("/support"), label: t("support") },
          ].map((l, i, arr) => (
            <Pressable
              key={l.href}
              onPress={() => {
                haptic.light();
                Linking.openURL(l.href);
              }}
              style={[styles.row, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <AppText variant="body" style={{ flex: 1 }}>
                {l.label}
              </AppText>
              <Feather name="external-link" size={16} color={colors.mutedText} />
            </Pressable>
          ))}
        </View>
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
            {t("signOut")}
          </AppText>
        </Pressable>

        <AppText variant="caption" color={colors.mutedText} style={{ textAlign: "center", marginTop: spacing.lg }}>
          saklio · v1.0.0
        </AppText>
        <AystechMark compact />
      </ScrollView>

      <Modal visible={curOpen} transparent animationType="fade" onRequestClose={() => setCurOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCurOpen(false)} />
        <Animated.View entering={SlideInDown.springify().damping(12)} style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <AppText variant="section" style={{ marginBottom: spacing.md }}>
            {t("currencyTitle")}
          </AppText>
          {CURRENCIES.map((c) => {
            const active = (user?.currency || "TL") === c.code;
            return (
              <Pressable
                key={c.code}
                testID={`currency-${c.code}`}
                onPress={() => selectCurrency(c.code)}
                style={[styles.curRow, { borderColor: active ? colors.brand : colors.border, borderWidth: active ? 2 : 1, backgroundColor: colors.surfaceSecondary }]}
              >
                <View style={[styles.curSym, { backgroundColor: colors.surfaceTertiary }]}>
                  <AppText variant="card" color={colors.brandDark}>
                    {c.sym}
                  </AppText>
                </View>
                <AppText variant="body" style={{ flex: 1 }}>
                  {t(c.key)}
                </AppText>
                <AppText variant="caption" color={colors.mutedText}>
                  {c.code}
                </AppText>
                {active ? <Feather name="check" size={18} color={colors.brand} /> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </Modal>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLangOpen(false)} />
        <Animated.View entering={SlideInDown.springify().damping(12)} style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <AppText variant="section" style={{ marginBottom: spacing.md }}>
            {t("languageTitle")}
          </AppText>
          {LANGS.map((l) => {
            const active = lang === l.code;
            return (
              <Pressable
                key={l.code}
                testID={`lang-${l.code}`}
                onPress={() => selectLang(l.code as "tr" | "en")}
                style={[styles.curRow, { borderColor: active ? colors.brand : colors.border, borderWidth: active ? 2 : 1, backgroundColor: colors.surfaceSecondary }]}
              >
                <View style={[styles.curSym, { backgroundColor: colors.surfaceTertiary }]}>
                  <AppText variant="card">{l.flag}</AppText>
                </View>
                <AppText variant="body" style={{ flex: 1 }}>
                  {l.label}
                </AppText>
                {active ? <Feather name="check" size={18} color={colors.brand} /> : null}
              </Pressable>
            );
          })}
        </Animated.View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  list: { marginTop: spacing.lg, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  sectionLabel: { marginTop: spacing.xl, marginLeft: spacing.sm, letterSpacing: 0.5 },
  soonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: spacing.md },
  curRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  curSym: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
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
