// src/Storage/VehicleEntry_Storage.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer } from '../Api/Hooks/UseVehicleEntry'; // Adjust path if needed

const DRAFT_KEY = '@vehicle_entry_draft';

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
    return `${DRAFT_KEY}_${String(userId)}`;
  } catch {
    return `${DRAFT_KEY}_anonymous`;
  }
}

export type VehicleDraft = {
  customerQuery: string;
  selectedCustomer?: Customer;
  vehicleNumber: string;
  transporterName: string;
  driverNumber: string;
  inTime?: string;
  outTime?: string;

  savedEntryId?: number;
  allPhotosUploaded?: boolean;
};

export const saveDraftToStorage = async (draft: VehicleDraft): Promise<void> => {
  try {
    const scopedKey = await getUserScopedKey();
    const jsonValue = JSON.stringify(draft);
    await AsyncStorage.setItem(scopedKey, jsonValue);
  } catch (error) {
    console.error('Error saving vehicle entry draft:', error);
    // Optionally handle error (e.g., show toast)
  }
};

export const loadDraftFromStorage = async (): Promise<VehicleDraft | null> => {
  try {
    const scopedKey = await getUserScopedKey();
    const jsonValue = await AsyncStorage.getItem(scopedKey);
    if (jsonValue === null) {
      return null;
    }
    const draft: VehicleDraft = JSON.parse(jsonValue);



    return draft;
  } catch (error) {
    console.error('Error loading vehicle entry draft:', error);
    return null;
  }
};

export const clearDraftFromStorage = async (): Promise<void> => {
  try {
    const scopedKey = await getUserScopedKey();
    await AsyncStorage.removeItem(scopedKey);
  } catch (error) {
    console.error('Error clearing vehicle entry draft:', error);
  }
};