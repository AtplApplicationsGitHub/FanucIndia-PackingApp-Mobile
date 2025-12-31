import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'material_fg_data';

export async function loadMaterialFGData() {
  try {
    const json = await AsyncStorage.getItem(KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load material FG data:', e);
    return null;
  }
}

export async function saveMaterialFGData(data: any) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save material FG data:', e);
  }
}

export async function clearMaterialFGData() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.error('Failed to clear material FG data:', e);
  }
}
