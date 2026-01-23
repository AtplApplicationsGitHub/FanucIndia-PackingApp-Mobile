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

const LOCATION_KEY = 'material_fg_location';

export async function loadMaterialFGLocation() {
  try {
    return await AsyncStorage.getItem(LOCATION_KEY);
  } catch (e) {
    console.error('Failed to load material FG location:', e);
    return null;
  }
}

export async function saveMaterialFGLocation(loc: string) {
  try {
    await AsyncStorage.setItem(LOCATION_KEY, loc);
  } catch (e) {
    console.error('Failed to save material FG location:', e);
  }
}

export async function clearMaterialFGLocation() {
  try {
    await AsyncStorage.removeItem(LOCATION_KEY);
  } catch (e) {
    console.error('Failed to clear material FG location:', e);
  }
}
