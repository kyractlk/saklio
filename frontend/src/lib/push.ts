import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "@/src/api/client";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function listenToNotificationOpens(onUrl: (url: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((resp) => {
    const url = (resp.notification.request.content.data as any)?.action_url;
    if (url && typeof url === "string") onUrl(url);
  });
}

export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;
    if (!Device.isDevice) return null; // simulators can't get tokens

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Saklio",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#8FCFAE",
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResp.data;

    await api.registerPush({
      user_id: userId,
      platform: Platform.OS,
      device_token: token,
      device_name: Device.modelName || Device.deviceName || Platform.OS,
    });
    return token;
  } catch (e) {
    // non-blocking
    return null;
  }
}
