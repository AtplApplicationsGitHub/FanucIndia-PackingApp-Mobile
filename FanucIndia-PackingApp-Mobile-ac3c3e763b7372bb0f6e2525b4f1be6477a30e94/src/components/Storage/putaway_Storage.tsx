import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@putaway_session_v1';

export type ScannedRecord = {
  id: string; // Unique ID for list
  SO?: string;
  YD?: string;
  Location: string; // System location (if matched) or Derived
  ScanLocation: string;
  Status: 'Valid' | 'Invalid' | 'Missing' | 'Duplicate';
  Timestamp: number;
};

export type ExcelRow = {
  SO: string;
  YD: string | undefined;
  Location: string;
};

// Define the shape of the full session
export type PutAwaySessionData = {
    excelData: ExcelRow[];
    fileName: string | null;
    scannedRecords: ScannedRecord[];
    reportFiles: ScannedRecord[];
    scanLocation: string;
    isLocationLocked: boolean;
    scanSoYd: string;
    isVerified: boolean;
    isReportView: boolean;
    filterType: 'ALL' | 'Scanned' | 'Empty';
};


class PutAwayStorage {
  /**
   * Save the entire state of the PutAway screen
   */
  static async saveSession(data: PutAwaySessionData): Promise<void> {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save putaway session', e);
    }
  }

  /**
   * Load the saved session
   */
  static async getSession(): Promise<PutAwaySessionData | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error('Failed to load putaway session', e);
      return null;
    }
  }

  /**
   * Clear the session data
   */
  static async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear putaway session', e);
    }
  }
}

export default PutAwayStorage;
