// UseUpdate.ts
import { useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { API_ENDPOINTS } from "../Endpoints";
import Toast from "react-native-toast-message";

export interface VersionInfo {
  latestVersion: string;
  appName?: string;
  fileName?: string;
  downloadUrl: string;
  forceUpdate?: boolean; // Keep as optional for future use
}

export const useUpdate = (currentVersion: string) => {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);

  const checkUpdate = async (): Promise<VersionInfo | null> => {
    try {
      setChecking(true);
      const url = API_ENDPOINTS.APP.LATEST_VERSION;
      const response = await fetch(url);
      const data: VersionInfo = await response.json();

      if (data.latestVersion && isNewerVersion(currentVersion, data.latestVersion)) {
        return data;
      }
      return null;
    } catch (error) {
      console.error("Update check failed:", error);
      return null;
    } finally {
      setChecking(false);
    }
  };

  const isNewerVersion = (oldVer: string, newVer: string) => {
    const cleanOld = oldVer.replace(/[^0-9.]/g, "");
    const cleanNew = newVer.replace(/[^0-9.]/g, "");
    const oldParts = cleanOld.split(".").map(Number);
    const newParts = cleanNew.split(".").map(Number);

    for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
      const oldPart = oldParts[i] || 0;
      const newPart = newParts[i] || 0;
      if (newPart > oldPart) return true;
      if (newPart < oldPart) return false;
    }
    return false;
  };

  const downloadAndInstall = async (customDownloadUrl?: string) => {
    try {
      setDownloading(true);
      setDownloaded(false);
      setDownloadProgress(0);

      const downloadUrl = customDownloadUrl || API_ENDPOINTS.APP.DOWNLOAD;
      const filename = "app-update.apk";
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
          const p = progress.totalBytesWritten / (progress.totalBytesExpectedToWrite || 1);
          setDownloadProgress(p);
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (result && result.uri) {
        setDownloading(false);
        setDownloaded(true);
        setLocalFileUri(result.uri);
        Toast.show({
          type: "success",
          text1: "Download Complete",
          text2: "Ready to install.",
        });
      }
    } catch (error) {
      console.error("Download failed:", error);
      setDownloading(false);
      setDownloaded(false);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: "Try again later.",
      });
    }
  };

  const triggerInstall = async () => {
    if (!localFileUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localFileUri, {
          mimeType: "application/vnd.android.package-archive",
          dialogTitle: "Install Update",
        });
      }
    } catch (error) {
      console.error("Installation trigger failed:", error);
    }
  };

  return {
    checkUpdate,
    downloadAndInstall,
    triggerInstall,
    checking,
    downloading,
    downloaded,
    downloadProgress,
  };
};
