// src/Storage/VehicleEntry_Storage.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer } from '../Api/Hooks/UseVehicleEntry'; // Adjust path if needed

const DRAFT_KEY = '@vehicle_entry_draft';

export type VehicleDraft = {
  customerQuery: string;
  selectedCustomer?: Customer;
  vehicleNumber: string;
  transporterName: string;
  driverNumber: string;

  savedEntryId?: number;
  allPhotosUploaded?: boolean;
};

export const saveDraftToStorage = async (draft: VehicleDraft): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(draft);
    await AsyncStorage.setItem(DRAFT_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving vehicle entry draft:', error);
    // Optionally handle error (e.g., show toast)
  }
};

export const loadDraftFromStorage = async (): Promise<VehicleDraft | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(DRAFT_KEY);
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
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.error('Error clearing vehicle entry draft:', error);
  }
};