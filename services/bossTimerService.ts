
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

    // Cancel all existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();

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
      trigger: null,
    });
    console.log('Immediate notification sent');
  } catch (error) {
    console.error('Error sending immediate notification:', error);
  }
};

export const reportBossSpawn = async (spawnTime: number): Promise<boolean> => {
  try {
    console.log('Reporting boss spawn at:', spawnTime);
    
    // Insert into database - this will trigger the broadcast to all users
    const { data, error } = await supabase
      .from('boss_spawns')
      .insert({
        spawned_at: spawnTime,
      })
      .select();

    if (error) {
      console.error('Supabase error reporting boss spawn:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
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
    console.error('Exception in reportBossSpawn:', error);
    return false;
  }
};

export const getLatestBossSpawn = async (): Promise<number | null> => {
  try {
    console.log('Fetching latest boss spawn...');
    
    const { data, error } = await supabase
      .from('boss_spawns')
      .select('spawned_at')
      .order('spawned_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase error fetching latest boss spawn:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return null;
    }

    // Check if we got any results
    if (!data || data.length === 0) {
      console.log('No boss spawns found in database');
      return null;
    }

    const spawnTime = data[0].spawned_at;
    console.log('Latest boss spawn found:', spawnTime);
    
    // Save locally
    await AsyncStorage.setItem(STORAGE_KEY, spawnTime.toString());
    return spawnTime;
  } catch (error) {
    console.error('Exception in getLatestBossSpawn:', error);
    return null;
  }
};

export const subscribeToSpawnUpdates = (
  onSpawnUpdate: (spawnTime: number) => void
): RealtimeChannel => {
  console.log('Setting up boss spawn subscription...');
  
  // Use private channel as required by realtime.broadcast_changes
  const channel = supabase.channel('boss:spawns', {
    config: {
      private: true,
    },
  })
    .on('broadcast', { event: 'INSERT' }, async (payload) => {
      console.log('Boss spawn INSERT broadcast received!');
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      try {
        // The payload from realtime.broadcast_changes has a different structure
        const record = payload.payload.record || payload.payload;
        const spawnTime = record.spawned_at;
        
        console.log('Processing spawn time:', spawnTime);
        
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
      } catch (error) {
        console.error('Error processing boss spawn broadcast:', error);
      }
    })
    .subscribe(async (status, err) => {
      console.log('Boss spawn channel status:', status);
      if (err) {
        console.error('Boss spawn channel error:', err);
      }
      
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to boss spawn updates!');
        // Set auth for private channel
        await supabase.realtime.setAuth();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Channel error occurred, will retry automatically');
      } else if (status === 'TIMED_OUT') {
        console.error('Channel subscription timed out');
      } else if (status === 'CLOSED') {
        console.log('Channel closed');
      }
    });

  return channel;
};

export const unsubscribeFromSpawnUpdates = (channel: RealtimeChannel) => {
  if (channel) {
    console.log('Unsubscribing from boss spawn updates...');
    supabase.removeChannel(channel);
  }
};
