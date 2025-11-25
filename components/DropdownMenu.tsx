
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useRouter } from 'expo-router';

export default function DropdownMenu() {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  const handleNavigate = (route: string) => {
    setIsVisible(false);
    router.push(route);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setIsVisible(!isVisible)}
        style={styles.menuButton}
        activeOpacity={0.7}
      >
        <IconSymbol
          ios_icon_name="ellipsis.circle.fill"
          android_material_icon_name="more_vert"
          size={28}
          color={colors.text}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate('/(tabs)/(home)/')}
              activeOpacity={0.7}
            >
              <IconSymbol
                ios_icon_name="house.fill"
                android_material_icon_name="home"
                size={20}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Main Screen</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigate('/(tabs)/settings')}
              activeOpacity={0.7}
            >
              <IconSymbol
                ios_icon_name="gear"
                android_material_icon_name="settings"
                size={20}
                color={colors.text}
              />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  menuButton: {
    padding: 8,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  dropdownContainer: {
    marginTop: 60,
    marginRight: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    minWidth: 200,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.textSecondary,
    opacity: 0.3,
  },
});
