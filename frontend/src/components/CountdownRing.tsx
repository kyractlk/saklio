import React, { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { AppText } from "./ui";
import { useTheme } from "@/src/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function CountdownRing({
  size = 120,
  stroke = 10,
  progress, // 0..1 remaining
  color,
  label,
  sublabel,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, progress)), {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, p]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - p.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ alignItems: "center" }}>
        <AppText variant="section" weight="bold" style={{ fontVariant: ["tabular-nums"] }}>
          {label}
        </AppText>
        {sublabel ? (
          <AppText variant="caption" color={colors.mutedText}>
            {sublabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
