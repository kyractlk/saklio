import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { Camera } from "expo-camera";
import { getMediaLibraryPermissionsAsync } from "expo-image-picker";
import * as Device from "expo-device";
import { api } from "@/src/api/client";

export async function collectPermissions() {
  const [n, c, p] = await Promise.all([
    Notifications.getPermissionsAsync().catch(() => ({ status: "undetermined" as const })),
    Camera.getCameraPermissionsAsync().catch(() => ({ status: "undetermined" as const })),
    getMediaLibraryPermissionsAsync().catch(() => ({ status: "undetermined" as const })),
  ]);
  return {
    notifications: n.status || "undetermined",
    camera: c.status || "undetermined",
    photos: p.status || "undetermined",
  };
}

export async function pingNow() {
  try {
    const permissions = await collectPermissions();
    await api.pingSession({
      permissions,
      platform: Platform.OS,
      device: Device.modelName || Device.deviceName || Platform.OS,
    });
  } catch {
    // non-blocking
  }
}
