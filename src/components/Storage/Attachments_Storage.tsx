import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ATTACHMENT_PERSISTENCE";

export interface AttachmentSession {
  soNumber: string;
  activeSoNumber: string;
  selectedVariantId: number | string | null;
  selectedObdNumber: string;
  existingAttachments: any[];
  pendingFiles: any[];
}

export const saveAttachmentSession = async (session: AttachmentSession) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Failed to save attachment session:", error);
  }
};

export const getAttachmentSession = async (): Promise<AttachmentSession | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to get attachment session:", error);
    return null;
  }
};

export const clearAttachmentSession = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear attachment session:", error);
  }
};
