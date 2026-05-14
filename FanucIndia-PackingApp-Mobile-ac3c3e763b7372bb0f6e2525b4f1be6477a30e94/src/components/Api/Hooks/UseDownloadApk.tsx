import { useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import Toast from "react-native-toast-message";

// Destructure from the FileSystem namespace for better runtime compatibility
const { StorageAccessFramework } = FileSystem;

export interface VersionInfo {
  appName: string;
  latestVersion: string;
  fileName: string;
  downloadUrl: string;
}

export const useDownloadApk = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  // ✅ Generic API fetch (pass endpoint dynamically)
  const fetchVersionInfo = async (url: string) => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch version info");
      }

      const data: VersionInfo = await response.json();
      setVersionInfo(data);
      return data;
    } catch (error) {
      console.error("Version check error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to fetch version info",
      });
      return null;
    }
  };

  // ✅ Main download function
  const downloadAndSaveApk = async (apiUrl: string) => {
    setLoading(true);
    setProgress(0);

    try {
      const info = await fetchVersionInfo(apiUrl);
      if (!info) {
        setLoading(false);
        return;
      }

      const { downloadUrl, fileName } = info;

      // Accessing directory constants safely
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!dir) throw new Error("No valid directory found");

      const localUri = `${dir}${fileName}`;

      // 1. Download to local cache (fast and efficient)
      const callback = (downloadProgress: any) => {
        const p =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        setProgress(Math.round(p * 100));
      };

      const resumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localUri,
        {},
        callback
      );

      const result = await resumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error("Download failed: No result from download");
      }

      // Verify file integrity (Check if file is empty)
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error("Downloaded file is empty (0 bytes). Check the server URL.");
      }

      // 2. Android Storage Access Framework (SAF) Handling
      // Memory-efficient saving method (Avoiding OOM)
      if (Platform.OS === "android" && StorageAccessFramework) {
        try {
          const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();

          if (permission.granted) {
            // Remove extension for naming, as createFileAsync handles it
            const safFileName = fileName.toLowerCase().endsWith(".apk")
              ? fileName.slice(0, -4)
              : fileName;

            const destUri = await StorageAccessFramework.createFileAsync(
              permission.directoryUri,
              safFileName,
              "application/vnd.android.package-archive"
            );

            // Using native copyAsync which respects file streams (No memory issues)
            await FileSystem.copyAsync({
              from: result.uri,
              to: destUri,
            });

            Toast.show({
              type: "success",
              text1: "Success",
              text2: "APK saved to your selected folder",
            });

            await FileSystem.deleteAsync(result.uri, { idempotent: true });
            return;
          }
        } catch (safError) {
          console.error("SAF Native Copy Error, falling back to Share:", safError);
          // If native copy fails (common with SAF destinations), we MUST use shareAsync
          // which is the only reliable way on some Android versions.
        }
      }

      // 3. Fallback: System Share Menu
      // This is the "Better Way": It's native, handles OOM perfectly, 
      // and allows users to either Install directly or Save to Files.
      Toast.show({
        type: "info",
        text1: "Download Complete",
        text2: "Opening save options...",
      });
      
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/vnd.android.package-archive",
        dialogTitle: "Install or Save APK",
      });

    } catch (error: any) {
      console.error("Download error:", error);
      Toast.show({
        type: "error",
        text1: "Download Failed",
        text2: error.message || "Something went wrong",
      });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return {
    loading,
    progress,
    versionInfo,
    fetchVersionInfo,
    downloadAndSaveApk,
  };
};
