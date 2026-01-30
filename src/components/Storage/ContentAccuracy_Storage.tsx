import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'CONTENT_ACCURACY_SESSION_V1';

export type SessionData = {
  excelData: any[];
  fileName: string | null;
  scannedRecords: any[];
  reportFiles: any[];
  scanLocation: string;
  isLocationLocked: boolean;
  scanSO: string;
  isSOLocked: boolean;
  scanMaterial: string;
  isVerified: boolean;
  isReportView: boolean;
};

export const saveSession = async (data: SessionData) => {
  try {
    const jsonValue = JSON.stringify(data);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save Content Accuracy session', e);
  }
};

export const getSession = async (): Promise<SessionData | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Failed to load Content Accuracy session', e);
    return null;
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear Content Accuracy session', e);
  }
};

const ContentAccuracyStorage = {
    saveSession,
    getSession,
    clearSession
};

export default ContentAccuracyStorage;
