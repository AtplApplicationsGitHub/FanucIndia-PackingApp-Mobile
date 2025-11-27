// SalesOrder_table_Storage.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storing download timestamps
const DOWNLOAD_TIMESTAMP_KEY = '@so_download_timestamp_';

class SalesOrderTableStorage {
  // Save download timestamp for a specific SO
  static async setDownloadedTimestamp(soNumber: string): Promise<void> {
    try {
      const timestamp = Date.now();
      await AsyncStorage.setItem(`${DOWNLOAD_TIMESTAMP_KEY}${soNumber}`, timestamp.toString());
    } catch (error) {
      console.warn('Failed to save download timestamp', error);
    }
  }

  // Get download timestamp
  static async getDownloadedTimestamp(soNumber: string): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(`${DOWNLOAD_TIMESTAMP_KEY}${soNumber}`);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.warn('Failed to get download timestamp', error);
      return null;
    }
  }

  // Remove timestamp when order is deleted or undownloaded
  static async removeDownloadedTimestamp(soNumber: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${DOWNLOAD_TIMESTAMP_KEY}${soNumber}`);
    } catch (error) {
      console.warn('Failed to remove download timestamp', error);
    }
  }

  // Optional: Clear all (for logout, etc.)
  static async clearAllTimestamps(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const soKeys = keys.filter(k => k.startsWith(DOWNLOAD_TIMESTAMP_KEY));
      await AsyncStorage.multiRemove(soKeys);
    } catch (error) {
      console.warn('Failed to clear timestamps', error);
    }
  }
}

export default SalesOrderTableStorage;