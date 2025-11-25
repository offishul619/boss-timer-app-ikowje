
import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger key="home" name="(home)">
        <Icon sf="timer" />
        <Label>Timer</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="guild-events" name="guild-events">
        <Icon sf="calendar" />
        <Label>Events</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="settings" name="settings">
        <Icon sf="gear" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
