import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { ThemeProvider } from "@/src/theme";
import { LanguageProvider } from "@/src/i18n";
import { api } from "@/src/api/client";
import { setMoneyConfig } from "@/src/lib/format";
import { registerForPush, listenToNotificationOpens } from "@/src/lib/push";
import { pingNow } from "@/src/lib/session";
import { useRouter } from "expo-router";

LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { theme, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Live FX rates + preferred currency
  useEffect(() => {
    let active = true;
    api
      .fxRates()
      .then((r: any) => {
        if (active) setMoneyConfig(user?.currency || "TL", r.rates);
      })
      .catch(() => setMoneyConfig(user?.currency || "TL", null));
    return () => {
      active = false;
    };
  }, [user?.currency]);

  // Push registration + tap handling + session heartbeat
  useEffect(() => {
    if (!user?.id) return;
    registerForPush(user.id);
    pingNow();
    const t = setInterval(pingNow, 5 * 60 * 1000);
    const sub = listenToNotificationOpens((url) => {
      try {
        router.push(url as any);
      } catch {}
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [user?.id]);

  return (
    <ThemeProvider mode={theme}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="scan" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="processing" options={{ animation: "fade" }} />
        <Stack.Screen name="success" options={{ animation: "fade" }} />
        <Stack.Screen name="assistant" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="search" options={{ animation: "slide_from_bottom" }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      // icon fonts ready; ThemedStack hides splash once auth resolves
    }
  }, [loaded, error]);

  // Android'de sistem alt navigation bar'ını (geri/son uygulamalar) uygulama açıkken gizle.
  // Bu sayede kendi alt tab menümüz altta takılmadan görünür.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    return () => {
      NavigationBar.setVisibilityAsync("visible").catch(() => {});
    };
  }, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <AuthProvider>
            <LanguageProvider>
              <ThemedStack />
            </LanguageProvider>
          </AuthProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
