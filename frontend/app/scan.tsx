import React, { useRef, useState, useEffect } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator, Linking, Platform } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
} from "react-native-reanimated";
import { AppText, Button } from "@/src/components/ui";
import { useTheme, spacing, radius } from "@/src/theme";
import { scanStore } from "@/src/lib/scanStore";
import { haptic } from "@/src/lib/format";

export default function Scan() {
  const { colors } = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  const scanLine = useSharedValue(0);
  useEffect(() => {
    scanLine.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [scanLine]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scanLine.value * 260 }] }));

  const goProcess = (uri: string, base64?: string) => {
    scanStore.clear();
    scanStore.set({ uri, base64 });
    haptic.success();
    router.replace("/processing");
  };

  const capture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    haptic.heavy();
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.uri) goProcess(photo.uri, photo.base64);
    } catch {
      setCapturing(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      goProcess(res.assets[0].uri, res.assets[0].base64 || undefined);
    }
  };

  // Permission gate
  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.surface, padding: spacing.xl }]}>
        <Feather name="camera" size={48} color={colors.brand} />
        <AppText variant="section" style={{ marginTop: spacing.lg, textAlign: "center" }}>
          Fişini taramak için kamera izni
        </AppText>
        <AppText variant="body" color={colors.mutedText} style={{ marginTop: spacing.sm, textAlign: "center" }}>
          Saklio yalnızca fiş tararken kameranı kullanır.
        </AppText>
        <View style={{ marginTop: spacing.xl, width: "100%", gap: spacing.md }}>
          {permission.canAskAgain ? (
            <Button testID="grant-camera" title="Kamera iznini ver" onPress={requestPermission} />
          ) : (
            <Button testID="open-settings" title="Ayarları aç" onPress={() => Linking.openSettings()} />
          )}
          <Button testID="pick-gallery-alt" title="Galeriden seç" variant="secondary" onPress={pickImage} />
          <Button title="Vazgeç" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable testID="scan-close" onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
          <AppText variant="card" color="#fff">
            Fiş Tara
          </AppText>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            {/* corners */}
            {[
              [styles.cTL],
              [styles.cTR],
              [styles.cBL],
              [styles.cBR],
            ].map((s, i) => (
              <View key={i} style={[styles.corner, s[0], { borderColor: colors.brand }]} />
            ))}
            <Animated.View style={[styles.scanLine, lineStyle, { backgroundColor: colors.brand }]} />
          </View>
          <AppText variant="body" color="#fff" style={{ marginTop: spacing.lg, textAlign: "center" }}>
            Fişi çerçevenin içine getir
          </AppText>
        </View>

        <View style={styles.controls}>
          <Pressable testID="pick-gallery" onPress={pickImage} style={styles.sideBtn}>
            <Feather name="image" size={24} color="#fff" />
          </Pressable>
          <Pressable testID="capture-btn" onPress={capture} style={styles.shutter}>
            {capturing ? (
              <ActivityIndicator color={colors.brandDark} />
            ) : (
              <View style={[styles.shutterInner, { backgroundColor: colors.brand }]} />
            )}
          </Pressable>
          <View style={styles.sideBtn} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const FRAME = 280;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  frameWrap: { alignItems: "center" },
  frame: { width: FRAME, height: FRAME, borderRadius: radius.lg, overflow: "hidden" },
  corner: { position: "absolute", width: 40, height: 40, borderWidth: 4 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: radius.lg },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: radius.lg },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: radius.lg },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: radius.lg },
  scanLine: { position: "absolute", left: 8, right: 8, height: 3, borderRadius: 2, opacity: 0.9 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  sideBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.5)",
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29 },
});
