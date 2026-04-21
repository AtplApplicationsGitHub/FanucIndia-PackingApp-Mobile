import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'material_fg_data';
const LOCATION_KEY = 'material_fg_location';

async function getUserScopedKey(baseKey: string) {
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
    return `${baseKey}_${String(userId)}`;
  } catch {
    return `${baseKey}_anonymous`;
  }
}

export async function loadMaterialFGData() {
  try {
    const scopedKey = await getUserScopedKey(KEY);
    const json = await AsyncStorage.getItem(scopedKey);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Failed to load material FG data:', e);
    return null;
  }
}

export async function saveMaterialFGData(data: any) {
  try {
    const scopedKey = await getUserScopedKey(KEY);
    await AsyncStorage.setItem(scopedKey, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save material FG data:', e);
  }
}

export async function clearMaterialFGData() {
  try {
    const scopedKey = await getUserScopedKey(KEY);
    await AsyncStorage.removeItem(scopedKey);
  } catch (e) {
    console.error('Failed to clear material FG data:', e);
  }
}

export async function loadMaterialFGLocation() {
  try {
    const scopedKey = await getUserScopedKey(LOCATION_KEY);
    return await AsyncStorage.getItem(scopedKey);
  } catch (e) {
    console.error('Failed to load material FG location:', e);
    return null;
  }
}

export async function saveMaterialFGLocation(loc: string) {
  try {
    const scopedKey = await getUserScopedKey(LOCATION_KEY);
    await AsyncStorage.setItem(scopedKey, loc);
  } catch (e) {
    console.error('Failed to save material FG location:', e);
  }
}

export async function clearMaterialFGLocation() {
  try {
    const scopedKey = await getUserScopedKey(LOCATION_KEY);
    await AsyncStorage.removeItem(scopedKey);
  } catch (e) {
    console.error('Failed to clear material FG location:', e);
  }
}
