// src/components/storage/material_dispatch_storage.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'material_dispatch_data';

async function getUserScopedKey() {
  try {
    const rawUser = await AsyncStorage.getItem("user");
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    const displayName = await AsyncStorage.getItem("displayName");
    const userId =
      parsedUser?.id ??
      parsedUser?.email ??
      parsedUser?.username ??
      displayName ??
      "anonymous";
    return `${KEY}_${String(userId)}`;
  } catch {
    return `${KEY}_anonymous`;
  }
}

export async function loadDispatchData() {
  try {
    const scopedKey = await getUserScopedKey();
    const json = await AsyncStorage.getItem(scopedKey);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load dispatch data:', e);
    return null;
  }
}

export async function saveDispatchData(data: any) {
  try {
    const scopedKey = await getUserScopedKey();
    await AsyncStorage.setItem(scopedKey, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save dispatch data:', e);
  }
}

export async function clearDispatchData() {
  try {
    const scopedKey = await getUserScopedKey();
    await AsyncStorage.removeItem(scopedKey);
  } catch (e) {
    console.error('Failed to clear dispatch data:', e);
  }
}