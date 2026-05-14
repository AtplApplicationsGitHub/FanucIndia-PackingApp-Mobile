import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Vibration,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TableData {
  sn: number;
  soNumber: string;
}

const SoundDemoScreen: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [tableData, setTableData] = useState<TableData[]>([]);

  const playErrorSound = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/error.mp3')
      );
      await sound.playAsync();

      // Forcefully stop the sound exactly after 1 second (1000ms) to keep it short!
      setTimeout(async () => {
        await sound.stopAsync();
        await sound.unloadAsync();
      }, 1000);
    } catch (error) {
      console.log('Sound playback failed', error);
    }
  };

  const handleSubmit = async () => {
    if (inputValue.trim() === '') {
      Alert.alert('Error', 'Invalid input'); // ✅ Guaranteed to pop up FIRST

      // Read settings from AsyncStorage, defaulting to true
      const sResult = await AsyncStorage.getItem('soundEnabled');
      const vResult = await AsyncStorage.getItem('vibrationEnabled');
      const shouldPlaySound = sResult === null || sResult === 'true';
      const shouldVibrate = vResult === null || vResult === 'true';

      if (shouldPlaySound) playErrorSound();
      if (shouldVibrate) {
        // Warning: Requires android.permission.VIBRATE in AndroidManifest
        try { Vibration.vibrate(300); } catch (e) {}
      }

    } else {
      console.log('Valid input');
      setTableData((prev) => [
        ...prev,
        {
          sn: prev.length + 1,
          soNumber: inputValue.trim(),
        },
      ]);
      setInputValue('');
    }
  };

  const renderItem = ({ item }: { item: TableData }) => (
    <View style={styles.tableRow}>
      <Text style={styles.cellSn}>{item.sn}</Text>
      <Text style={styles.cellSo}>{item.soNumber}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter SO number"
          value={inputValue}
          onChangeText={setInputValue}
        />
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderSn}>S/n</Text>
          <Text style={styles.tableHeaderSo}>SO number</Text>
        </View>
        <FlatList
          data={tableData}
          keyExtractor={(item) => item.sn.toString()}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No data available</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
};

export default SoundDemoScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E4E9',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#FFD84A',
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    fontWeight: '700',
    color: '#000',
    fontSize: 14,
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E4E9',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E4E9',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeaderSn: {
    flex: 0.3,
    fontWeight: '700',
    fontSize: 14,
    color: '#525866',
  },
  tableHeaderSo: {
    flex: 0.7,
    fontWeight: '700',
    fontSize: 14,
    color: '#525866',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cellSn: {
    flex: 0.3,
    fontSize: 14,
    color: '#333',
  },
  cellSo: {
    flex: 0.7,
    fontSize: 14,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#9CA3AF',
    fontSize: 14,
  },
});
