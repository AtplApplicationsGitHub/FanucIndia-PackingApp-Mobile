// src/screens/VehicleEntry_Storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@VehicleEntry_Draft';

export interface VehicleEntryDraft {
  customerQuery: string;
  selectedCustomer: any;        // Customer object (or null)
  vehicleNumber: string;
  transporterName: string;
  driverNumber: string;
  photos: any[];                // array of image objects
  savedEntryId: number | null;
  entrySaved: boolean;
}

export const saveDraft = async (draft: VehicleEntryDraft): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (e) {
    console.warn('Failed to save draft', e);
  }
};

export const loadDraft = async (): Promise<VehicleEntryDraft | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VehicleEntryDraft;
  } catch (e) {
    console.warn('Failed to load draft', e);
    return null;
  }
};

export const clearDraft = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear draft', e);
  }
};