import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const SettingsScreen: React.FC = () => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

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