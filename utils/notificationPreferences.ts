
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_NOTIFICATIONS_KEY = '@reminder_notifications_enabled';
const BOSS_SPAWN_NOTIFICATIONS_KEY = '@boss_spawn_notifications_enabled';
const GUILD_EVENT_NOTIFICATIONS_KEY = '@guild_event_notifications_enabled';

export const isReminderNotificationsEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(REMINDER_NOTIFICATIONS_KEY);
    // Default to true if not set
    return value === null ? true : value === 'true';
  } catch (error) {
    console.error('Error checking reminder notification preference:', error);
    return true;
  }
};

export const isBossSpawnNotificationsEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(BOSS_SPAWN_NOTIFICATIONS_KEY);
    // Default to true if not set
    return value === null ? true : value === 'true';
  } catch (error) {
    console.error('Error checking boss spawn notification preference:', error);
    return true;
  }
};

export const isGuildEventNotificationsEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(GUILD_EVENT_NOTIFICATIONS_KEY);
    // Default to true if not set
    return value === null ? true : value === 'true';
  } catch (error) {
    console.error('Error checking guild event notification preference:', error);
    return true;
  }
};

export const setReminderNotificationsEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(REMINDER_NOTIFICATIONS_KEY, enabled.toString());
  } catch (error) {
    console.error('Error setting reminder notification preference:', error);
  }
};

export const setBossSpawnNotificationsEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(BOSS_SPAWN_NOTIFICATIONS_KEY, enabled.toString());
  } catch (error) {
    console.error('Error setting boss spawn notification preference:', error);
  }
};

export const setGuildEventNotificationsEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(GUILD_EVENT_NOTIFICATIONS_KEY, enabled.toString());
  } catch (error) {
    console.error('Error setting guild event notification preference:', error);
  }
};
