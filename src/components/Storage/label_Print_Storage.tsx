// src/storage/labelPrintStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "LABEL_PRINT_DATA";

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
    return `${STORAGE_KEY}_${String(userId)}`;
  } catch {
    return `${STORAGE_KEY}_anonymous`;
  }
}

export type StoredLabelPrintData = {
  sos: {
    id: string; // client id
    serverId: number | string; // 🔹 database id
    soNumber: string;
    outboundDelivery?: string;
  }[];
  customerName: string | null;
  customerAddress: string | null;
  contactNumber: string | null;
  boxNumber: string | null;
  cncPacking: string | null;
  isCustomerLocked: boolean;
};

const defaultData: StoredLabelPrintData = {
  sos: [],
  customerName: null,
  customerAddress: null,
  contactNumber: null,
  boxNumber: "1/1",
  cncPacking: "CNC PACKING",
  isCustomerLocked: false,
};

export const labelPrintStorage = {
  async save(data: StoredLabelPrintData): Promise<void> {
    try {
      const scopedKey = await getUserScopedKey();
      await AsyncStorage.setItem(scopedKey, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save label print data", error);
    }
  },

  async load(): Promise<StoredLabelPrintData> {
    try {
      const scopedKey = await getUserScopedKey();
      const json = await AsyncStorage.getItem(scopedKey);
      if (!json) return defaultData;

      const parsed = JSON.parse(json);
      return {
        sos: Array.isArray(parsed.sos) ? parsed.sos : [],
        customerName: parsed.customerName || null,
        customerAddress: parsed.customerAddress || null,
        contactNumber: parsed.contactNumber || null,
        boxNumber: parsed.boxNumber || "1/1",
        cncPacking: parsed.cncPacking || "CNC PACKING",
        isCustomerLocked: !!parsed.isCustomerLocked,
      };
    } catch (error) {
      console.error("Failed to load label print data", error);
      return defaultData;
    }
  },

  async clear(): Promise<void> {
    try {
      const scopedKey = await getUserScopedKey();
      await AsyncStorage.removeItem(scopedKey);
    } catch (error) {
      console.error("Failed to clear label print data", error);
    }
  },
};
