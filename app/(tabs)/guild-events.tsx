
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import DropdownMenu from '@/components/DropdownMenu';
import { IconSymbol } from '@/components/IconSymbol';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/app/integrations/supabase/client';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUILD_EVENT_NOTIFICATIONS_KEY = '@guild_event_notifications_enabled';

interface GuildEvent {
  id: string;
  event_name: string;
  event_date_time: number;
  created_at: string;
}

export default function GuildEventsScreen() {
  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventName, setEventName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualDateInput, setManualDateInput] = useState('');
  const [useManualDate, setUseManualDate] = useState(false);

  useEffect(() => {
    loadEvents();
    setupRealtimeSubscription();
  }, []);

  const loadEvents = async () => {
    try {
      console.log('Loading guild events...');
      const { data, error } = await supabase
        .from('guild_events')
        .select('*')
        .order('event_date_time', { ascending: true });

      if (error) {
        console.error('Error loading guild events:', error);
        return;
      }

      if (data) {
        console.log('Guild events loaded:', data);
        // Filter out past events
        const now = Date.now();
        const upcomingEvents = data.filter(event => event.event_date_time > now);
        setEvents(upcomingEvents);
      }
    } catch (error) {
      console.error('Exception loading guild events:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('guild_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guild_events',
        },
        (payload) => {
          console.log('Guild event change received:', payload);
          loadEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const parseManualDate = (dateString: string): Date | null => {
    // Expected format: MM/DD/YYYY
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;

    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (year < 2000 || year > 2100) return null;

    const date = new Date(year, month - 1, day);
    return date;
  };

  const convertToEasternTime = (date: Date, time: Date): number => {
    // Combine date and time
    const combined = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      time.getHours(),
      time.getMinutes(),
      0,
      0
    );

    // Return timestamp in milliseconds
    return combined.getTime();
  };

  const scheduleEventNotification = async (eventName: string, eventDateTime: number) => {
    try {
      const notificationsEnabled = await AsyncStorage.getItem(GUILD_EVENT_NOTIFICATIONS_KEY);
      if (notificationsEnabled === 'false') {
        console.log('Guild event notifications are disabled');
        return;
      }

      const oneHourBefore = eventDateTime - (60 * 60 * 1000);
      const now = Date.now();

      if (oneHourBefore > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Guild Event Reminder',
            body: `"${eventName}" starts in 1 hour!`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(oneHourBefore),
            channelId: 'guild-events',
          },
        });
        console.log('Guild event notification scheduled for:', new Date(oneHourBefore));
      }
    } catch (error) {
      console.error('Error scheduling guild event notification:', error);
    }
  };

  const handleCreateEvent = async () => {
    if (!eventName.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    // Determine which date to use
    let dateToUse = selectedDate;
    if (useManualDate && manualDateInput.trim()) {
      const parsedDate = parseManualDate(manualDateInput);
      if (!parsedDate) {
        Alert.alert('Error', 'Invalid date format. Please use MM/DD/YYYY');
        return;
      }
      dateToUse = parsedDate;
    }

    setIsSubmitting(true);

    try {
      const eventDateTime = convertToEasternTime(dateToUse, selectedTime);
      const now = Date.now();

      if (eventDateTime <= now) {
        Alert.alert('Error', 'Event date and time must be in the future');
        setIsSubmitting(false);
        return;
      }

      console.log('Creating guild event:', {
        event_name: eventName,
        event_date_time: eventDateTime,
      });

      const { data, error } = await supabase
        .from('guild_events')
        .insert({
          event_name: eventName,
          event_date_time: eventDateTime,
        })
        .select();

      if (error) {
        console.error('Error creating guild event:', error);
        Alert.alert('Error', `Failed to create event: ${error.message}`);
        setIsSubmitting(false);
        return;
      }

      console.log('Guild event created successfully:', data);

      // Schedule notification
      await scheduleEventNotification(eventName, eventDateTime);

      // Reset form
      setEventName('');
      setSelectedDate(new Date());
      setSelectedTime(new Date());
      setManualDateInput('');
      setUseManualDate(false);
      setShowCreateModal(false);
      
      Alert.alert('Success', 'Guild event created successfully!');
      
      // Reload events
      await loadEvents();
    } catch (error) {
      console.error('Exception creating guild event:', error);
      Alert.alert('Error', 'An error occurred while creating the event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('guild_events')
                .delete()
                .eq('id', eventId);

              if (error) {
                console.error('Error deleting guild event:', error);
                Alert.alert('Error', 'Failed to delete event.');
                return;
              }

              await loadEvents();
            } catch (error) {
              console.error('Exception deleting guild event:', error);
            }
          },
        },
      ]
    );
  };

  const formatEventDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    };
    return date.toLocaleString('en-US', options) + ' ET';
  };

  const getTimeUntilEvent = (timestamp: number): string => {
    const now = Date.now();
    const diff = timestamp - now;

    if (diff <= 0) return 'Event started';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const onDateChange = (event: any, date?: Date) => {
    console.log('Date picker event:', event.type, date);
    
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (event.type === 'set' && date) {
      setSelectedDate(date);
      console.log('Date selected:', date);
    } else if (event.type === 'dismissed') {
      console.log('Date picker dismissed');
    }
  };

  const onTimeChange = (event: any, time?: Date) => {
    console.log('Time picker event:', event.type, time);
    
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (event.type === 'set' && time) {
      setSelectedTime(time);
      console.log('Time selected:', time);
    } else if (event.type === 'dismissed') {
      console.log('Time picker dismissed');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dropdownContainer}>
        <DropdownMenu />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Guild Events</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.7}
          >
            <IconSymbol
              ios_icon_name="plus.circle.fill"
              android_material_icon_name="add_circle"
              size={24}
              color={colors.text}
            />
            <Text style={styles.createButtonText}>Create Event</Text>
          </TouchableOpacity>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="event"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateText}>No upcoming events</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first guild event to get started
            </Text>
          </View>
        ) : (
          <View style={styles.eventsContainer}>
            {events.map((event, index) => (
              <React.Fragment key={index}>
              <View style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventIconContainer}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="event"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventName}>{event.event_name}</Text>
                    <Text style={styles.eventDateTime}>
                      {formatEventDateTime(event.event_date_time)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteEvent(event.id)}
                    style={styles.deleteButton}
                    activeOpacity={0.7}
                  >
                    <IconSymbol
                      ios_icon_name="trash"
                      android_material_icon_name="delete"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.eventFooter}>
                  <View style={styles.countdownBadge}>
                    <IconSymbol
                      ios_icon_name="clock"
                      android_material_icon_name="schedule"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.countdownText}>
                      {getTimeUntilEvent(event.event_date_time)}
                    </Text>
                  </View>
                </View>
              </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Guild Event</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <Text style={styles.inputLabel}>Event Name</Text>
                <TextInput
                  style={styles.input}
                  value={eventName}
                  onChangeText={setEventName}
                  placeholder="Enter event name"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={100}
                />

                <Text style={styles.inputLabel}>Date</Text>
                
                <View style={styles.dateInputToggle}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !useManualDate && styles.toggleButtonActive,
                    ]}
                    onPress={() => setUseManualDate(false)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        !useManualDate && styles.toggleButtonTextActive,
                      ]}
                    >
                      Calendar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      useManualDate && styles.toggleButtonActive,
                    ]}
                    onPress={() => setUseManualDate(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        useManualDate && styles.toggleButtonTextActive,
                      ]}
                    >
                      Manual
                    </Text>
                  </TouchableOpacity>
                </View>

                {useManualDate ? (
                  <TextInput
                    style={styles.input}
                    value={manualDateInput}
                    onChangeText={setManualDateInput}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => {
                      console.log('Opening date picker');
                      setShowDatePicker(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="calendar_today"
                      size={20}
                      color={colors.text}
                    />
                    <Text style={styles.dateTimeButtonText}>
                      {selectedDate.toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>
                )}

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )}

                <Text style={styles.inputLabel}>Time (Eastern Time)</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => {
                    console.log('Opening time picker');
                    setShowTimePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    ios_icon_name="clock"
                    android_material_icon_name="access_time"
                    size={20}
                    color={colors.text}
                  />
                  <Text style={styles.dateTimeButtonText}>
                    {selectedTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </Text>
                </TouchableOpacity>

                {showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimeChange}
                  />
                )}

                <Text style={styles.timezoneNote}>
                  All times are in Eastern Time (ET)
                </Text>

                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  onPress={handleCreateEvent}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? 'Creating...' : 'Create Event'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dropdownContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 60,
    right: 0,
    zIndex: 1000,
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
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  eventsContainer: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(220, 20, 60, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  eventDateTime: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: 4,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 20, 60, 0.2)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  formScrollView: {
    flex: 1,
  },
  formContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: -8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  dateInputToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleButtonTextActive: {
    color: colors.text,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  timezoneNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: -8,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
});
