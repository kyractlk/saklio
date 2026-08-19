import React, { useCallback, useMemo, useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, Share, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen, Header, EmptyState } from "@/src/components/layout";
import { AppText, Button } from "@/src/components/ui";
import { EmptyBoxIllustration } from "@/src/components/Illustrations";
import { useTheme, spacing, radius, CATEGORY_COLORS } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { useT } from "@/src/i18n";
import { api } from "@/src/api/client";
import { formatPrice, haptic } from "@/src/lib/format";
import { spendSummary, ymKey, shiftMonth, formatMonthLabel } from "@/src/lib/spend";
import { spendingReportHtml, spendingReportText, downloadHtmlFile } from "@/src/lib/email-templates";

export default function Finance() {
  const { colors } = useTheme();
  const { t, tc, lang } = useT();
  const { user } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [month, setMonth] = useState(ymKey());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts((await api.listProducts()) as any[]);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const currency = user?.currency || "TL";
  const summary = useMemo(() => spendSummary(products, month), [products, month]);
  const thisMonth = ymKey();
  const monthLabel = formatMonthLabel(month, lang);

  const reportPayload = {
    monthLabel,
    total: formatPrice(summary.total, currency),
    count: summary.count,
    top: summary.top ? tc(summary.top.category) : undefined,
    sectors: summary.sectors.map((s) => ({
      name: tc(s.category),
      amount: formatPrice(s.amount, currency),
      share: `%${Math.round(s.share * 100)}`,
    })),
  };

  const download = async () => {
    haptic.medium();
    const html = spendingReportHtml(lang, reportPayload);
    if (Platform.OS === "web") {
      downloadHtmlFile(`saklio-harcama-${month}.html`, html);
    } else {
      await Share.share({ message: spendingReportText(lang, reportPayload), title: t("finance") });
    }
    setMsg(t("financeReady"));
  };

  const emailMe = async () => {
    haptic.medium();
    const html = spendingReportHtml(lang, reportPayload);
    setBusy(true);
    try {
      await api.sendMyEmail({
        subject: `${t("finance")} · ${monthLabel}`,
        html,
        text: spendingReportText(lang, reportPayload),
        attachment: { filename: `saklio-harcama-${month}.html`, content: html, type: "text/html; charset=utf-8" },
      });
      if (Platform.OS === "web") downloadHtmlFile(`saklio-harcama-${month}.html`, html);
      setMsg(t("financeMailed"));
    } catch {
      haptic.error();
      setMsg(t("financeReady"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t("finance")} subtitle={t("financeSub")} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.md }}>
        <View style={styles.monthRow}>
          <Pressable testID="finance-prev" onPress={() => setMonth(shiftMonth(month, -1))} style={[styles.monthBtn, { borderColor: colors.border }]}>
            <Feather name="chevron-left" size={20} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <AppText variant="section">{monthLabel}</AppText>
            <AppText variant="caption" color={colors.mutedText}>
              {month === thisMonth ? t("financeThisMonth") : t("financeLastMonth")}
            </AppText>
          </View>
          <Pressable
            testID="finance-next"
            onPress={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= thisMonth}
            style={[styles.monthBtn, { borderColor: colors.border, opacity: month >= thisMonth ? 0.35 : 1 }]}
          >
            <Feather name="chevron-right" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={[styles.totalCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <AppText variant="caption" color={colors.mutedText}>
            {t("financeTotal")}
          </AppText>
          <AppText variant="title" style={{ marginTop: 4, fontVariant: ["tabular-nums"] }}>
            {formatPrice(summary.total, currency)}
          </AppText>
          <AppText variant="body" color={colors.mutedText} style={{ marginTop: 4 }}>
            {t("financeReceipts", { n: summary.count })}
          </AppText>
        </View>

        {summary.top ? (
          <View style={[styles.totalCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <AppText variant="caption" color={colors.mutedText}>
              {t("financeTop")}
            </AppText>
            <AppText variant="section" style={{ marginTop: 4 }}>
              {tc(summary.top.category)}
            </AppText>
            <AppText variant="body" color={colors.mutedText}>
              {formatPrice(summary.top.amount, currency)} · {t("financeShare", { n: Math.round(summary.top.share * 100) })}
            </AppText>
          </View>
        ) : null}

        {summary.sectors.length === 0 ? (
          <EmptyState
            illustration={<EmptyBoxIllustration size={140} brand={colors.brand} ink={colors.onSurface} />}
            title={t("financeEmptyT")}
            body={t("financeEmptyB")}
            cta={t("scanFirst")}
            onCta={() => router.push("/scan")}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {summary.sectors.map((s) => {
              const cat = CATEGORY_COLORS[s.category] || CATEGORY_COLORS.diger;
              return (
                <View key={s.category} style={[styles.sectorRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <View style={[styles.dot, { backgroundColor: cat.bg }]} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="semibold">
                      {tc(s.category)}
                    </AppText>
                    <View style={[styles.barTrack, { backgroundColor: colors.surfaceTertiary }]}>
                      <View style={[styles.barFill, { width: `${Math.max(6, Math.round(s.share * 100))}%`, backgroundColor: cat.fg }]} />
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText variant="body" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
                      {formatPrice(s.amount, currency)}
                    </AppText>
                    <AppText variant="caption" color={colors.mutedText}>
                      {t("financeShare", { n: Math.round(s.share * 100) })}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button title={t("downloadFinance")} onPress={download} disabled={busy} />
          <Button title={t("emailFinance")} variant="secondary" onPress={emailMe} disabled={busy} />
          {msg ? (
            <AppText variant="caption" color={colors.mutedText} style={{ textAlign: "center" }}>
              {msg}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  monthBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  totalCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  sectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  barTrack: { height: 6, borderRadius: 3, marginTop: 8, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
});
