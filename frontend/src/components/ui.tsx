import React from "react";
import {
  Text,
  TextProps,
  Pressable,
  PressableProps,
  View,
  ViewProps,
  StyleSheet,
  TextInput,
  TextInputProps,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  useAnimatedProps,
  interpolate,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useTheme, font, radius, spacing } from "@/src/theme";
import { haptic } from "@/src/lib/format";

type Variant = "display" | "title" | "section" | "card" | "body" | "caption";

export function AppText({
  variant = "body",
  color,
  weight,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; weight?: keyof typeof font.weight }) {
  const { colors } = useTheme();
  const map: Record<Variant, { size: number; weight: any }> = {
    display: { size: font.size["3xl"], weight: font.weight.bold },
    title: { size: font.size["2xl"], weight: font.weight.semibold },
    section: { size: font.size.xl, weight: font.weight.semibold },
    card: { size: font.size.lg, weight: font.weight.semibold },
    body: { size: font.size.base, weight: font.weight.regular },
    caption: { size: font.size.sm, weight: font.weight.medium },
  };
  const v = map[variant];
  return (
    <Text
      style={[
        {
          color: color || colors.onSurface,
          fontSize: v.size,
          fontWeight: weight ? font.weight[weight] : v.weight,
          letterSpacing: variant === "display" || variant === "title" ? -0.5 : 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: any;
  testID?: string;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === "primary" ? colors.brand : variant === "secondary" ? colors.surfaceSecondary : "transparent";
  const fg =
    variant === "primary" ? colors.onBrand : variant === "ghost" ? colors.brandDark : colors.onSurface;

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled || loading}
      onPressIn={() => (scale.value = withTiming(0.97, { duration: 100 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
      onPress={() => {
        haptic.medium();
        onPress?.();
      }}
      style={[
        styles.btn,
        aStyle,
        {
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={{ color: fg, fontWeight: font.weight.semibold, fontSize: font.size.lg }}>{title}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export function Card({ style, children, ...rest }: ViewProps & { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Chip({
  label,
  color,
  bg,
  testID,
}: {
  label: string;
  color?: string;
  bg?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: bg || colors.surfaceTertiary,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: color || colors.brandDark, fontSize: font.size.sm, fontWeight: font.weight.medium }}>
        {label}
      </Text>
    </View>
  );
}

export function Skeleton({
  width,
  height,
  radius: r = 12,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: any;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        { width: width as any, height: height || 16, borderRadius: r, backgroundColor: colors.border },
        aStyle,
        style,
      ]}
    />
  );
}

export function Input({
  label,
  icon,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; icon?: React.ReactNode; error?: string }) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ color: colors.mutedText, fontSize: font.size.sm, fontWeight: font.weight.medium }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.error : focused ? colors.brand : colors.border,
          paddingHorizontal: spacing.md,
          height: 54,
        }}
      >
        {icon}
        <TextInput
          style={[{ flex: 1, color: colors.onSurface, fontSize: font.size.lg }, style]}
          placeholderTextColor={colors.mutedText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
      </View>
      {error ? (
        <Text style={{ color: colors.error, fontSize: font.size.sm }}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
