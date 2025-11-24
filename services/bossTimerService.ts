
import { supabase } from '@/app/integrations/supabase/client';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY = '@boss_timer_last_spawn';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export interface BossSpawn {
  id: string;
  spawned_at: number;
  created_at: string;
}

export const scheduleNotifications = async (spawnTime: number) => {
  try {
    const now = Date.now();

    // Schedule hourly notifications during the 12-24 hour window
    for (let i = 12; i < 24; i++) {
      const notificationTime = spawnTime + (i * ONE_HOUR);
      
      if (notificationTime > now) {
        const hoursLeft = 24 - i;
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Boss Spawn Alert',
            body: `Boss can spawn! ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} left in window.`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(notificationTime),
            channelId: 'boss-timer',
          },
        });
      }
    }

    // Schedule 15-minute notifications during the last hour
    const lastHourStart = spawnTime + (23 * ONE_HOUR);
    if (lastHourStart > now) {
      for (let i = 0; i < 4; i++) {
        const notificationTime = lastHourStart + (i * FIFTEEN_MINUTES);
        
        if (notificationTime > now) {
          const minutesLeft = 60 - (i * 15);
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Boss Spawn Alert - Final Hour!',
              body: `Boss can spawn! Only ${minutesLeft} minutes left in window!`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(notificationTime),
              channelId: 'boss-timer',
            },
          });
        }
      }
    }

    console.log('Notifications scheduled successfully');
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
};

export const sendImmediateNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 Boss Spawned!',
        body: 'The contested boss has spawned! Get ready!',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // Send immediately
    });
    console.log('Immediate notification sent');
  } catch (error) {
    console.error('Error sending immediate notification:', error);
  }
};

export const reportBossSpawn = async (spawnTime: number): Promise<boolean> => {
  try {
    // Insert into database - this will trigger the broadcast to all users
    const { data, error } = await supabase
      .from('boss_spawns')
      .insert({
        spawned_at: spawnTime,
      })
      .select()
      .single();

    if (error) {
      console.error('Error reporting boss spawn:', error);
      return false;
    }

    console.log('Boss spawn reported successfully:', data);
    
    // Save locally
    await AsyncStorage.setItem(STORAGE_KEY, spawnTime.toString());
    
    // Cancel all scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Schedule new notifications
    const notificationsEnabled = await AsyncStorage.getItem('@notifications_enabled');
    if (notificationsEnabled !== 'false') {
      await scheduleNotifications(spawnTime);
    }

    return true;
  } catch (error) {
    console.error('Error in reportBossSpawn:', error);
    return false;
  }
};

export const getLatestBossSpawn = async (): Promise<number | null> => {
  try {
    const { data, error } = await supabase
      .from('boss_spawns')
      .select('spawned_at')
      .order('spawned_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching latest boss spawn:', error);
      return null;
    }

    if (data) {
      // Save locally
      await AsyncStorage.setItem(STORAGE_KEY, data.spawned_at.toString());
      return data.spawned_at;
    }

    return null;
  } catch (error) {
    console.error('Error in getLatestBossSpawn:', error);
    return null;
  }
};

export const subscribeToSpawnUpdates = (
  onSpawnUpdate: (spawnTime: number) => void
): RealtimeChannel => {
  console.log('Subscribing to boss spawn updates...');
  
  const channel = supabase.channel('boss:spawns')
    .on('broadcast', { event: 'boss_spawned' }, async (payload) => {
      console.log('Boss spawn broadcast received:', payload);
      
      const spawnData = payload.payload as BossSpawn;
      const spawnTime = spawnData.spawned_at;
      
      // Save locally
      await AsyncStorage.setItem(STORAGE_KEY, spawnTime.toString());
      
      // Send immediate notification to this user
      await sendImmediateNotification();
      
      // Cancel all scheduled notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Schedule new notifications
      const notificationsEnabled = await AsyncStorage.getItem('@notifications_enabled');
      if (notificationsEnabled !== 'false') {
        await scheduleNotifications(spawnTime);
      }
      
      // Update UI
      onSpawnUpdate(spawnTime);
    })
    .subscribe((status) => {
      console.log('Boss spawn channel status:', status);
    });

  return channel;
};

export const unsubscribeFromSpawnUpdates = (channel: RealtimeChannel) => {
  if (channel) {
    supabase.removeChannel(channel);
    console.log('Unsubscribed from boss spawn updates');
  }
};
