// src/components/storage/material_dispatch_storage.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'material_dispatch_data';

export async function loadDispatchData() {
  try {
    const json = await AsyncStorage.getItem(KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load dispatch data:', e);
    return null;
  }
}

export async function saveDispatchData(data: any) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save dispatch data:', e);
  }
}

export async function clearDispatchData() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.error('Failed to clear dispatch data:', e);
  }
}