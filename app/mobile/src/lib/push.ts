import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { post } from './api';

/**
 * Powiadomienia push (A3.4, P8) przez usługi Apple i Google (Expo Notifications).
 * Treść powiadomienia nie zawiera danych o zdrowiu — serwer wysyła tylko „Nowa wiadomość w aplikacji” itp.;
 * szczegóły widać dopiero po odblokowaniu aplikacji.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

let registered = false;

export async function registerPush(): Promise<void> {
  if (registered || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Eternal', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await post('/api/push/expo', { token: data });
    registered = true;
  } catch {
    // brak zgody, brak usług Google albo projekt EAS nieskonfigurowany — powiadomienia przyjdą e-mailem/SMS (fallback serwera)
  }
}
