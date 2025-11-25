
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBossSpawnNotificationsEnabled } from '@/utils/notificationPreferences';

const PUSH_TOKEN_KEY = '@push_token';

export interface PushToken {
  token: string;
  device_id: string;
  platform: string;
  created_at?: string;
  updated_at?: string;
}

export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id',
    });

    const token = tokenData.data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('boss-timer', {
        name: 'Boss Timer Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
};

export const savePushTokenToSupabase = async (token: string): Promise<boolean> => {
  try {
    if (!isSupabaseConfigured()) {
      console.log('Supabase is not configured. Push notifications will not work across devices.');
      return false;
    }

    const deviceId = await getDeviceId();
    const platform = Platform.OS;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          token,
          device_id: deviceId,
          platform,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'device_id',
        }
      );

    if (error) {
      console.error('Error saving push token to Supabase:', error);
      return false;
    }

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('Push token saved successfully');
    return true;
  } catch (error) {
    console.error('Error in savePushTokenToSupabase:', error);
    return false;
  }
};

export const sendBossSpawnNotification = async (): Promise<boolean> => {
  try {
    // Check if boss spawn notifications are enabled
    const isEnabled = await isBossSpawnNotificationsEnabled();
    if (!isEnabled) {
      console.log('Boss spawn notifications are disabled by user preference');
      return true; // Return true because it's not an error, just disabled
    }

    if (!isSupabaseConfigured()) {
      console.log('Supabase is not configured. Cannot send notifications to other users.');
      return false;
    }

    const { data, error } = await supabase.functions.invoke('send-boss-notification', {
      body: {
        title: '🔥 Boss Spawned!',
        body: 'The contested boss has spawned! Get ready!',
        data: {
          type: 'boss_spawn',
          timestamp: new Date().toISOString(),
        },
      },
    });

    if (error) {
      console.error('Error sending boss spawn notification:', error);
      return false;
    }

    console.log('Boss spawn notification sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Error in sendBossSpawnNotification:', error);
    return false;
  }
};

const getDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem('@device_id');
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await AsyncStorage.setItem('@device_id', deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
};

export const initializePushNotifications = async (): Promise<void> => {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await savePushTokenToSupabase(token);
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};
