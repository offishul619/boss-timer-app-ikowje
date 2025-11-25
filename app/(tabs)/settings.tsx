
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/styles/commonStyles';

const REMINDER_NOTIFICATIONS_KEY = '@reminder_notifications_enabled';
const BOSS_SPAWN_NOTIFICATIONS_KEY = '@boss_spawn_notifications_enabled';

export default function SettingsScreen() {
  const [reminderNotificationsEnabled, setReminderNotificationsEnabled] = useState(true);
  const [bossSpawnNotificationsEnabled, setBossSpawnNotificationsEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const reminderSetting = await AsyncStorage.getItem(REMINDER_NOTIFICATIONS_KEY);
      const bossSpawnSetting = await AsyncStorage.getItem(BOSS_SPAWN_NOTIFICATIONS_KEY);

      if (reminderSetting !== null) {
        setReminderNotificationsEnabled(reminderSetting === 'true');
      }
      if (bossSpawnSetting !== null) {
        setBossSpawnNotificationsEnabled(bossSpawnSetting === 'true');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleReminderToggle = async (value: boolean) => {
    try {
      setReminderNotificationsEnabled(value);
      await AsyncStorage.setItem(REMINDER_NOTIFICATIONS_KEY, value.toString());
      console.log('Reminder notifications:', value ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error saving reminder notification setting:', error);
    }
  };

  const handleBossSpawnToggle = async (value: boolean) => {
    try {
      setBossSpawnNotificationsEnabled(value);
      await AsyncStorage.setItem(BOSS_SPAWN_NOTIFICATIONS_KEY, value.toString());
      console.log('Boss spawn notifications:', value ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error saving boss spawn notification setting:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Reminder Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive hourly reminders during the spawn window
              </Text>
            </View>
            <Switch
              value={reminderNotificationsEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.textSecondary, true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : colors.text}
              ios_backgroundColor={colors.textSecondary}
            />
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Boss Spawn Notifications</Text>
              <Text style={styles.settingDescription}>
                Get notified when someone reports the boss has spawned
              </Text>
            </View>
            <Switch
              value={bossSpawnNotificationsEnabled}
              onValueChange={handleBossSpawnToggle}
              trackColor={{ false: colors.textSecondary, true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? undefined : colors.text}
              ios_backgroundColor={colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Notification settings control which alerts you receive. You can disable specific types of notifications while keeping others active.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'android' ? 48 : 60,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: 'rgba(220, 20, 60, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 20, 60, 0.3)',
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
