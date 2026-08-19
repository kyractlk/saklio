import React from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { Tabs } from "expo-router";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTheme, radius } from "@/src/theme";
import { AppText } from "@/src/components/ui";
import { useT } from "@/src/i18n";
import { haptic } from "@/src/lib/format";

const TAB_KEYS: Record<string, string> = {
  index: "tab_home", stuff: "tab_stuff", activity: "tab_activity", profile: "tab_profile",
};
const TAB_ICON: Record<string, string> = { index: "home", stuff: "grid", activity: "bell", profile: "user" };

function CustomTabBar({ state, navigation }: any) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const scanScale = useSharedValue(1);
  const scanStyle = useAnimatedStyle(() => ({ transform: [{ scale: scanScale.value }] }));

  // routes excluding a phantom "scan" (we render scan as floating button)
  const routes = state.routes.filter((r: any) => r.name !== "scan");

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || 12 }]}>
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? "dark" : "light"}
        style={[styles.bar, { borderColor: colors.border, backgroundColor: colors.glassBg }]}
      >
        {routes.slice(0, 2).map((route: any) => (
          <TabItem key={route.name} route={route} state={state} navigation={navigation} />
        ))}

        <View style={{ width: 64 }} />

        {routes.slice(2).map((route: any) => (
          <TabItem key={route.name} route={route} state={state} navigation={navigation} />
        ))}
      </BlurView>

      <Animated.View style={[styles.scanWrap, scanStyle, { bottom: (insets.bottom || 12) + 22 }]}>
        <Pressable
          testID="tab-scan"
          onPressIn={() => (scanScale.value = withSpring(0.9))}
          onPressOut={() => (scanScale.value = withSpring(1))}
          onPress={() => {
            haptic.heavy();
            router.push("/scan");
          }}
          style={[styles.scanBtn, { backgroundColor: colors.brand, shadowColor: colors.brandDark }]}
        >
          <Feather name="maximize" size={26} color={colors.onBrand} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function TabItem({ route, state, navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const focused = state.routes[state.index].name === route.name;
  return (
    <Pressable
      testID={`tab-${route.name}`}
      style={styles.item}
      onPress={() => {
        haptic.light();
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
      }}
    >
      <Feather name={TAB_ICON[route.name] as any} size={22} color={focused ? colors.brandDark : colors.tabInactive} />
      <AppText
        variant="caption"
        color={focused ? colors.brandDark : colors.tabInactive}
        style={{ fontSize: 10, marginTop: 3 }}
      >
        {t(TAB_KEYS[route.name])}
      </AppText>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="stuff" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Tab bar'ı absolute konumlandırınca içerik üstüne biniyor.
    // Expo Router'da custom tabBar'ımızın layout içinde yer ayırmasını sağlıyoruz.
    position: "relative",
    left: 0,
    right: 0,
    width: "100%",
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    marginHorizontal: 16,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "space-around",
    width: "92%",
    ...Platform.select({
      android: { elevation: 8 },
      default: {},
    }),
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center" },
  scanWrap: { position: "absolute", alignSelf: "center" },
  scanBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
});
