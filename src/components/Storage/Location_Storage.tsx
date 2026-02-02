import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@location_accuracy_session';

class LocationStorage {
  /**
   * Save the entire state of the Location screen
   */
  static async saveSession(data: {
    excelData: any[];
    fileName: string | null;
    scannedRecords: any[]; // Array of ScannedRecord (includes Timestamp)
    reportFiles: any[]; // Array of ScannedRecord (includes Timestamp)
    scanLocation: string;
    isLocationLocked: boolean;
    scanSoYd: string;
    isVerified: boolean;
    isReportView: boolean;
  }): Promise<void> {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
      console.error('Failed to save location session', e);
    }
  }

  /**
   * Load the saved session
   */
  static async getSession(): Promise<{
    excelData: any[];
    fileName: string | null;
    scannedRecords: any[];
    reportFiles: any[];
    scanLocation: string;
    isLocationLocked: boolean;
    scanSoYd: string;
    isVerified: boolean;
    isReportView: boolean;
  } | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
      console.error('Failed to load location session', e);
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
      console.error('Failed to clear location session', e);
    }
  }
}

export default LocationStorage;
