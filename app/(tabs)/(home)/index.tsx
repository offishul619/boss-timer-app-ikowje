
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
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
const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  inWindow: boolean;
  windowEndsIn: number;
}

export default function HomeScreen() {
  const [lastSpawnTime, setLastSpawnTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

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

      setPermissionStatus(finalStatus);

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Please enable notifications to receive boss spawn alerts.'
        );
        return false;
      }

      // Set up notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('boss-timer', {
          name: 'Boss Timer Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
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
      setNotificationsEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const updateTimeRemaining = (spawnTime?: number) => {
    const time = spawnTime || lastSpawnTime;
    if (!time) return;

    const now = Date.now();
    const timeSinceSpawn = now - time;
    const windowStartTime = time + TWELVE_HOURS;
    const windowEndTime = time + TWENTY_FOUR_HOURS;

    if (timeSinceSpawn < TWELVE_HOURS) {
      // Before window starts
      const remaining = TWELVE_HOURS - timeSinceSpawn;
      setTimeRemaining({
        hours: Math.floor(remaining / ONE_HOUR),
        minutes: Math.floor((remaining % ONE_HOUR) / 60000),
        seconds: Math.floor((remaining % 60000) / 1000),
        inWindow: false,
        windowEndsIn: 0,
      });
    } else if (timeSinceSpawn < TWENTY_FOUR_HOURS) {
      // In spawn window
      const windowRemaining = windowEndTime - now;
      setTimeRemaining({
        hours: Math.floor(windowRemaining / ONE_HOUR),
        minutes: Math.floor((windowRemaining % ONE_HOUR) / 60000),
        seconds: Math.floor((windowRemaining % 60000) / 1000),
        inWindow: true,
        windowEndsIn: windowRemaining,
      });
    } else {
      // Window has ended
      setTimeRemaining(null);
    }
  };

  const handleBossSpawned = async () => {
    const now = Date.now();
    setLastSpawnTime(now);
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY, now.toString());
      
      // Cancel all existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Schedule new notifications if enabled
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
      const windowStart = spawnTime + TWELVE_HOURS;
      const windowEnd = spawnTime + TWENTY_FOUR_HOURS;
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

      // Schedule 15-minute notifications for the last hour
      const lastHourStart = windowEnd - ONE_HOUR;
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

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    
    try {
      await AsyncStorage.setItem('@notifications_enabled', newValue.toString());
      
      if (newValue && lastSpawnTime) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await scheduleNotifications(lastSpawnTime);
        Alert.alert('Notifications Enabled', 'You will receive spawn alerts.');
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        Alert.alert('Notifications Disabled', 'You will not receive spawn alerts.');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
    }
  };

  const resetTimer = async () => {
    Alert.alert(
      'Reset Timer',
      'Are you sure you want to reset the boss timer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              await Notifications.cancelAllScheduledNotificationsAsync();
              setLastSpawnTime(null);
              setTimeRemaining(null);
              Alert.alert('Timer Reset', 'Boss timer has been reset.');
            } catch (error) {
              console.error('Error resetting timer:', error);
            }
          },
        },
      ]
    );
  };

  const formatTime = (time: TimeRemaining) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Boss Timer</Text>
        <Text style={styles.subtitle}>Track contested boss spawns</Text>
      </View>

      <View style={styles.card}>
        {!lastSpawnTime ? (
          <View style={styles.noTimerContainer}>
            <Text style={styles.noTimerText}>No active timer</Text>
            <Text style={styles.infoText}>
              Press the button below when the boss spawns to start tracking the next spawn window.
            </Text>
          </View>
        ) : timeRemaining ? (
          <View style={styles.timerContainer}>
            <Text style={styles.statusLabel}>
              {timeRemaining.inWindow ? 'BOSS CAN SPAWN!' : 'Window opens in:'}
            </Text>
            <Text style={[styles.timerText, timeRemaining.inWindow && styles.timerTextActive]}>
              {formatTime(timeRemaining)}
            </Text>
            {timeRemaining.inWindow && (
              <Text style={styles.windowInfo}>
                Window closes in {timeRemaining.hours}h {timeRemaining.minutes}m
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.noTimerContainer}>
            <Text style={styles.expiredText}>Spawn window has ended</Text>
            <Text style={styles.infoText}>
              Press the button below when the boss spawns again.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={handleBossSpawned}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>Boss Spawned!</Text>
      </TouchableOpacity>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Settings</Text>
        
        <TouchableOpacity
          style={styles.settingRow}
          onPress={toggleNotifications}
          activeOpacity={0.7}
        >
          <Text style={styles.settingLabel}>Enable Notifications</Text>
          <View style={[styles.toggle, notificationsEnabled && styles.toggleActive]}>
            <View style={[styles.toggleThumb, notificationsEnabled && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            • Hourly notifications during 12-24hr window
          </Text>
          <Text style={styles.infoBoxText}>
            • Every 15 minutes in the final hour
          </Text>
        </View>

        {lastSpawnTime && (
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={resetTimer}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Reset Timer</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Permission Status: {permissionStatus}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  noTimerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noTimerText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  expiredText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.highlight,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  timerTextActive: {
    color: colors.accent,
  },
  windowInfo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.highlight,
    marginTop: 16,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.textSecondary,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.accent,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  infoBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
