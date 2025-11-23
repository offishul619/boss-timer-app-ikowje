
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/styles/commonStyles';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEY = '@boss_timer_last_spawn';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  inWindow: boolean;
}

export default function HomeScreen() {
  const [lastSpawnTime, setLastSpawnTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (lastSpawnTime) {
      const interval = setInterval(() => {
        updateTimeRemaining();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lastSpawnTime]);

  const initializeApp = async () => {
    await requestNotificationPermissions();
    await loadLastSpawnTime();
    await loadNotificationSettings();
  };

  const requestNotificationPermissions = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  const loadLastSpawnTime = async () => {
    try {
      const savedTime = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedTime) {
        const time = parseInt(savedTime, 10);
        setLastSpawnTime(time);
        updateTimeRemaining(time);
      }
    } catch (error) {
      console.error('Error loading last spawn time:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('@notifications_enabled');
      if (enabled !== null) {
        setNotificationsEnabled(enabled === 'true');
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const updateTimeRemaining = (spawnTime?: number) => {
    const time = spawnTime || lastSpawnTime;
    if (!time) return;

    const now = Date.now();
    const timeSinceSpawn = now - time;

    if (timeSinceSpawn < TWELVE_HOURS) {
      const remaining = TWELVE_HOURS - timeSinceSpawn;
      setTimeRemaining({
        hours: Math.floor(remaining / ONE_HOUR),
        minutes: Math.floor((remaining % ONE_HOUR) / 60000),
        seconds: Math.floor((remaining % 60000) / 1000),
        inWindow: false,
      });
    } else if (timeSinceSpawn < TWENTY_FOUR_HOURS) {
      const windowRemaining = TWENTY_FOUR_HOURS - timeSinceSpawn;
      setTimeRemaining({
        hours: Math.floor(windowRemaining / ONE_HOUR),
        minutes: Math.floor((windowRemaining % ONE_HOUR) / 60000),
        seconds: Math.floor((windowRemaining % 60000) / 1000),
        inWindow: true,
      });
    } else {
      setTimeRemaining(null);
    }
  };

  const handleBossSpawned = async () => {
    const now = Date.now();
    setLastSpawnTime(now);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, now.toString());
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      if (notificationsEnabled) {
        await scheduleNotifications(now);
      }
      
      Alert.alert('Boss Spawned!', 'Timer started. Notifications scheduled.');
    } catch (error) {
      console.error('Error handling boss spawn:', error);
      Alert.alert('Error', 'Failed to save spawn time.');
    }
  };

  const scheduleNotifications = async (spawnTime: number) => {
    try {
      const now = Date.now();

      for (let i = 12; i < 24; i++) {
        const notificationTime = spawnTime + (i * ONE_HOUR);
        
        if (notificationTime > now) {
          const hoursLeft = 24 - i;
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Boss Spawn Alert',
              body: `Boss can spawn! ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} left in window.`,
              sound: 'default',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(notificationTime),
            },
          });
        }
      }

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
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(notificationTime),
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

  const formatTime = (time: TimeRemaining) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require('@/assets/images/4f3bc69d-9004-4977-8c4d-af99dd8316c5.webp')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Text style={styles.title}>Devils of Ascension</Text>
        <Text style={styles.subtitle}>Contested Timer</Text>

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>
            {timeRemaining?.inWindow ? 'WINDOW CLOSES IN:' : 'WINDOW OPENS IN:'}
          </Text>
          <Text style={styles.timerText}>
            {timeRemaining ? formatTime(timeRemaining) : '00:00:00'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.spawnButton}
          onPress={handleBossSpawned}
          activeOpacity={0.8}
        >
          <Text style={styles.spawnButtonText}>Boss Spawned!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 15,
  },
  logo: {
    width: 500,
    height: 500,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 60,
    textAlign: 'center',
  },
  timerCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 20,
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  spawnButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  spawnButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
