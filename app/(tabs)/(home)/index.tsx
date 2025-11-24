
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/styles/commonStyles';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  reportBossSpawn,
  getLatestBossSpawn,
  subscribeToSpawnUpdates,
  unsubscribeFromSpawnUpdates,
} from '@/services/bossTimerService';

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

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  inWindow: boolean;
}

export default function HomeScreen() {
  const [lastSpawnTime, setLastSpawnTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);

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
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications to receive boss spawn alerts.'
        );
        return false;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('boss-timer', {
          name: 'Boss Timer Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }

      console.log('Notification permissions granted');
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  const loadLastSpawnTime = async () => {
    try {
      console.log('Loading last spawn time...');
      
      // First try to get from local storage
      const savedTime = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedTime) {
        const time = parseInt(savedTime, 10);
        console.log('Found saved spawn time:', time);
        setLastSpawnTime(time);
        updateTimeRemaining(time);
      }

      // Then fetch the latest from database to ensure sync
      const latestSpawn = await getLatestBossSpawn();
      if (latestSpawn && latestSpawn !== parseInt(savedTime || '0', 10)) {
        console.log('Database has newer spawn time:', latestSpawn);
        setLastSpawnTime(latestSpawn);
        updateTimeRemaining(latestSpawn);
      }
    } catch (error) {
      console.error('Error loading last spawn time:', error);
    }
  };

  const updateTimeRemaining = useCallback((spawnTime?: number) => {
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
  }, [lastSpawnTime]);

  const handleSpawnUpdate = useCallback((spawnTime: number) => {
    console.log('UI received spawn update:', spawnTime);
    setLastSpawnTime(spawnTime);
    updateTimeRemaining(spawnTime);
  }, [updateTimeRemaining]);

  const initializeApp = useCallback(async () => {
    console.log('Initializing app...');
    
    await requestNotificationPermissions();
    await loadLastSpawnTime();

    // Subscribe to real-time updates
    if (!channelRef.current) {
      console.log('Creating realtime subscription...');
      const channel = subscribeToSpawnUpdates(handleSpawnUpdate);
      channelRef.current = channel;
      
      // Monitor connection status
      const checkStatus = () => {
        if (channelRef.current) {
          const state = channelRef.current.state;
          setConnectionStatus(state);
          console.log('Channel state:', state);
        }
      };
      
      checkStatus();
      const statusInterval = setInterval(checkStatus, 5000);
      
      return () => clearInterval(statusInterval);
    }
  }, [handleSpawnUpdate]);

  useEffect(() => {
    const cleanup = initializeApp();

    return () => {
      if (channelRef.current) {
        unsubscribeFromSpawnUpdates(channelRef.current);
        channelRef.current = null;
      }
      if (cleanup) {
        cleanup.then(fn => fn && fn());
      }
    };
  }, [initializeApp]);

  useEffect(() => {
    if (lastSpawnTime) {
      const interval = setInterval(() => {
        updateTimeRemaining();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lastSpawnTime, updateTimeRemaining]);

  const handleBossSpawned = async () => {
    if (isSubmitting) {
      console.log('Already submitting, ignoring click');
      return;
    }

    console.log('Boss spawned button pressed!');
    setIsSubmitting(true);
    const now = Date.now();
    
    try {
      console.log('Calling reportBossSpawn...');
      const success = await reportBossSpawn(now);
      
      if (success) {
        console.log('Boss spawn reported successfully!');
        setLastSpawnTime(now);
        Alert.alert(
          'Boss Spawned!',
          'All users have been notified! Timer started and notifications scheduled.'
        );
      } else {
        console.error('reportBossSpawn returned false');
        Alert.alert(
          'Error',
          'Failed to report boss spawn. Please check your connection and try again.'
        );
      }
    } catch (error) {
      console.error('Exception handling boss spawn:', error);
      Alert.alert(
        'Error',
        'An error occurred while reporting the boss spawn. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (time: TimeRemaining) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`;
  };

  return (
    <View style={styles.container}>
      <Image 
        source={require('../../../assets/images/a9113830-9f44-4312-b6c0-0804db9c58e6.webp')} 
        style={styles.bannerImage}
        resizeMode="cover"
      />
      
      <View style={styles.content}>
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>
            {timeRemaining?.inWindow ? 'WINDOW CLOSES IN:' : 'WINDOW OPENS IN:'}
          </Text>
          <Text style={styles.timerText}>
            {timeRemaining ? formatTime(timeRemaining) : '00:00:00'}
          </Text>
          {__DEV__ && (
            <Text style={styles.debugText}>
              Status: {connectionStatus}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.spawnButton, isSubmitting && styles.spawnButtonDisabled]}
          onPress={handleBossSpawned}
          activeOpacity={0.8}
          disabled={isSubmitting}
        >
          <Text style={styles.spawnButtonText}>
            {isSubmitting ? 'Notifying All Users...' : 'Boss Spawned!'}
          </Text>
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
  bannerImage: {
    width: '100%',
    height: 250,
    marginTop: 80,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: -80,
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
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 10,
  },
  spawnButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    boxShadow: '0px 6px 20px rgba(220, 20, 60, 0.4)',
    elevation: 8,
  },
  spawnButtonDisabled: {
    opacity: 0.6,
  },
  spawnButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
