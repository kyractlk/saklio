import React from "react";
import { View, Pressable, StyleSheet, ScrollViewProps } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { AppText, Button } from "./ui";
import { useTheme, spacing } from "@/src/theme";
import { haptic } from "@/src/lib/format";

export function Screen({
  children,
  edges = ["top"],
  style,
}: {
  children: React.ReactNode;
  edges?: ("top" | "bottom" | "left" | "right")[];
  style?: any;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.surface }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  right,
  large,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  large?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack !== undefined ? (
          <Pressable
            testID="back-button"
            onPress={() => {
              haptic.light();
              onBack ? onBack() : router.back();
            }}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <Feather name="chevron-left" size={22} color={colors.onSurface} />
          </Pressable>
        ) : (
          <View style={{ flex: 1 }}>
            <AppText variant={large ? "title" : "section"}>{title}</AppText>
            {subtitle ? <AppText variant="body" color={colors.mutedText}>{subtitle}</AppText> : null}
          </View>
        )}
        {right}
      </View>
      {onBack !== undefined ? (
        <View style={{ marginTop: spacing.sm }}>
          <AppText variant="title">{title}</AppText>
          {subtitle ? <AppText variant="body" color={colors.mutedText}>{subtitle}</AppText> : null}
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({
  illustration,
  title,
  body,
  cta,
  onCta,
  testID,
}: {
  illustration: React.ReactNode;
  title: string;
  body?: string;
  cta?: string;
  onCta?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.empty} testID={testID}>
      {illustration}
      <AppText variant="section" style={{ marginTop: spacing.lg, textAlign: "center" }}>
        {title}
      </AppText>
      {body ? (
        <AppText
          variant="body"
          color={colors.mutedText}
          style={{ marginTop: spacing.sm, textAlign: "center", maxWidth: 300 }}
        >
          {body}
        </AppText>
      ) : null}
      {cta && onCta ? (
        <Button title={cta} onPress={onCta} testID="empty-cta" style={{ marginTop: spacing.lg, minWidth: 220 }} />
      ) : null}
    </Animated.View>
  );
}

export function IconButton({
  name,
  onPress,
  testID,
  badge,
}: {
  name: any;
  onPress: () => void;
  testID?: string;
  badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <Feather name={name} size={20} color={colors.onSurface} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.error }]}>
          <AppText variant="caption" color="#fff" style={{ fontSize: 10 }}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});
