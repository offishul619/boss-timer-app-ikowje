
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)/',
      icon: 'timer',
      label: 'Timer',
    },
    {
      name: 'guild-events',
      route: '/(tabs)/guild-events',
      icon: 'event',
      label: 'Events',
    },
    {
      name: 'settings',
      route: '/(tabs)/settings',
      icon: 'settings',
      label: 'Settings',
    },
  ];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="guild-events" name="guild-events" />
        <Stack.Screen key="settings" name="settings" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
