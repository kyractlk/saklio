import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { ThemeProvider } from "@/src/theme";
import { LanguageProvider } from "@/src/i18n";
import { api } from "@/src/api/client";
import { setMoneyConfig } from "@/src/lib/format";
import { registerForPush } from "@/src/lib/push";
import * as Notifications from "expo-notifications";
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

  // Push registration + tap handling
  useEffect(() => {
    if (user?.id) registerForPush(user.id);
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const url = (resp.notification.request.content.data as any)?.action_url;
      if (url && typeof url === "string") {
        try {
          router.push(url as any);
        } catch {}
      }
    });
    return () => sub.remove();
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
