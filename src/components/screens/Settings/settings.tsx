import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Paths } from 'expo-file-system';

type StorageInfo = {
  total: number;
  available: number;
  used: number;
};

const bytesToGB = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.00 GB';
  return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
};

const SettingsScreen: React.FC = () => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    total: 0,
    available: 0,
    used: 0,
  });
  const [storageError, setStorageError] = useState('');

  const loadStorageInfo = () => {
    try {
      if (Platform.OS === 'web') {
        setStorageInfo({ total: 0, available: 0, used: 0 });
        setStorageError('Open this app on Android or iOS to view device storage.');
        return;
      }

      const total = Paths.totalDiskSpace || 0;
      const available = Paths.availableDiskSpace || 0;
      const used = Math.max(total - available, 0);

      setStorageInfo({ total, available, used });
      setStorageError('');
    } catch (e) {
      console.error('Failed to load storage info', e);
      setStorageError('Unable to read device storage');
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const sound = await AsyncStorage.getItem('soundEnabled');
        const vibration = await AsyncStorage.getItem('vibrationEnabled');

        // Default to ON (true) if undefined
        if (sound !== null) setIsSoundEnabled(sound === 'true'); 
        if (vibration !== null) setIsVibrationEnabled(vibration === 'true');
      } catch (e) {
        console.error('Failed to load settings', e);
      } finally {
        setLoading(false);
      }
    };
    loadStorageInfo();
    loadSettings();
  }, []);

  const toggleSound = async (value: boolean) => {
    setIsSoundEnabled(value);
    await AsyncStorage.setItem('soundEnabled', value.toString());
  };

  const toggleVibration = async (value: boolean) => {
    setIsVibrationEnabled(value);
    await AsyncStorage.setItem('vibrationEnabled', value.toString());
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFD84A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconContainer, { backgroundColor: '#E8F7EF' }]}>
                <MaterialIcons name="storage" size={24} color="#16A34A" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Device Storage</Text>
                <Text style={styles.settingDescription}>
                  Used internal storage
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={loadStorageInfo}
              activeOpacity={0.75}
              style={styles.refreshButton}
              accessibilityRole="button"
              accessibilityLabel="Refresh storage information"
            >
              <Ionicons name="refresh" size={18} color="#111827" />
            </TouchableOpacity>
          </View>

          {storageError ? (
            <Text style={styles.errorText}>{storageError}</Text>
          ) : (
            <View style={styles.usedStorageBox}>
              <Text style={styles.usedStorageValue}>{bytesToGB(storageInfo.used)}</Text>
              <Text style={styles.storageLabel}>Used</Text>
            </View>
          )}
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingInfo}>
            <View style={[styles.iconContainer, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="volume-high-outline" size={24} color="#4F46E5" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <Text style={styles.settingDescription}>
                Play alert sounds inside screens
              </Text>
            </View>
          </View>
          <Switch
            value={isSoundEnabled}
            onValueChange={toggleSound}
            trackColor={{ false: '#E2E4E9', true: '#FFD84A' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E2E4E9"
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingInfo}>
            <View style={[styles.iconContainer, { backgroundColor: '#FFF0F0' }]}>
              <MaterialIcons name="vibration" size={24} color="#EF4444" />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Vibration</Text>
              <Text style={styles.settingDescription}>
                Feel haptic feedback on errors
              </Text>
            </View>
          </View>
          <Switch
            value={isVibrationEnabled}
            onValueChange={toggleVibration}
            trackColor={{ false: '#E2E4E9', true: '#FFD84A' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E2E4E9"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  content: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  loading: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
    borderRadius: 20,
    // Soft, premium shadow
    shadowColor: '#1A202C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  storageCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#1A202C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usedStorageBox: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: 4,
  },
  usedStorageValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529',
  },
  storageLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 22,
  },
  settingTextContainer: { 
    flex: 1, 
    justifyContent: 'center',
  },
  settingLabel: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#212529',
    marginBottom: 4,
  },
  settingDescription: { 
    fontSize: 14, 
    color: '#6C757D', 
    lineHeight: 20,
  },
});
