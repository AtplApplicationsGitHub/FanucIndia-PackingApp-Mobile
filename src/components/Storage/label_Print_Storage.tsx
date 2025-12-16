// src/storage/labelPrintStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "LABEL_PRINT_DATA";

export type StoredLabelPrintData = {
  sos: { id: string; soNumber: string }[];
  customerName: string | null;
  customerAddress: string | null;
  isCustomerLocked: boolean;
};

const defaultData: StoredLabelPrintData = {
  sos: [],
  customerName: null,
  customerAddress: null,
  isCustomerLocked: false,
};

export const labelPrintStorage = {
  async save(data: StoredLabelPrintData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save label print data", error);
    }
  },

  async load(): Promise<StoredLabelPrintData> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (!json) return defaultData;

      const parsed = JSON.parse(json);
      return {
        sos: Array.isArray(parsed.sos) ? parsed.sos : [],
        customerName: parsed.customerName || null,
        customerAddress: parsed.customerAddress || null,
        isCustomerLocked: !!parsed.isCustomerLocked,
      };
    } catch (error) {
      console.error("Failed to load label print data", error);
      return defaultData;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear label print data", error);
    }
  },
};