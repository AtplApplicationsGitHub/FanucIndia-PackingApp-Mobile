import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import {
  uploadAttachments,
  getAttachments,
  type DispatchAttachment,
} from "../../Api/Hooks/Usematerial_dispatch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB
const MAX_FILE_SIZE_MB = 200;

type Props = {
  visible: boolean;
  dispatchId: string;
  onClose: () => void;
  onUploadSuccess?: () => void;
};

interface LocalFile {
  id: string | number;
  uri: string;
  name: string;
  type: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
}

type AnyFile =
  | LocalFile
  | {
      id: string | number;
      name: string;
      status: "uploaded";
    };

// Reusable Message Modal Component
const MessageModal: React.FC<{
  visible: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
}> = ({ visible, type, title, message, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={styles.msgOverlay} onPress={onClose}>
        <View style={styles.msgContainer}>
          <Ionicons
            name={type === "success" ? "checkmark-circle" : "alert-circle"}
            size={60}
            color={type === "success" ? "#16A34A" : "#E11D48"}
          />
          <Text style={styles.msgTitle}>{title}</Text>
          <Text style={styles.msgText}>{message}</Text>
          <TouchableOpacity style={styles.msgButton} onPress={onClose}>
            <Text style={styles.msgButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

const UploadModal: React.FC<Props> = ({
  visible,
  dispatchId,
  onClose,
  onUploadSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [serverFiles, setServerFiles] = useState<DispatchAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  // Message Modal States
  const [msgModal, setMsgModal] = useState<{
    visible: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    visible: false,
    type: "success",
    title: "",
    message: "",
  });

  useEffect(() => {
    if (visible && dispatchId) {
      loadServerFiles();
      setLocalFiles([]);
    }
  }, [visible, dispatchId]);

  const loadServerFiles = async () => {
    if (!dispatchId) return;
    setLoading(true);
    try {
      const res = await getAttachments(dispatchId);
      if (res.ok && Array.isArray(res.data)) {
        setServerFiles(res.data);
      }
    } catch (err) {
      console.error("Load attachments error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to normalize names for comparison (case-insensitive)
  const getAllExistingNames = () => {
    return new Set([
      ...serverFiles.map((f) => (f.fileName || "").toLowerCase()),
      ...localFiles.map((f) => f.name.toLowerCase()),
    ]);
  };

  // Ensures a unique name for any file (e.g., handles duplicates by appending (1), (2))
  const getUniqueName = (baseName: string): string => {
    const existing = getAllExistingNames();

    if (!existing.has(baseName.toLowerCase())) {
      return baseName;
    }

    // Split name and extension
    let namePart = baseName;
    let extPart = "";
    const lastDotIndex = baseName.lastIndexOf(".");
    
    if (lastDotIndex !== -1) {
      namePart = baseName.substring(0, lastDotIndex);
      extPart = baseName.substring(lastDotIndex);
    }

    let i = 1;
    while (true) {
      const candidate = `${namePart}(${i})${extPart}`;
      if (!existing.has(candidate.toLowerCase())) {
        return candidate;
      }
      i++;
    }
  };

  // Specifically for Camera: generates photo1.jpg, photo2.jpg, etc.
  const getNextPhotoName = () => {
    const existing = getAllExistingNames();
    let i = 1;
    while (true) {
      const candidate = `photo${i}.jpg`;
      if (!existing.has(candidate.toLowerCase())) {
        return candidate;
      }
      i++;
    }
  };

  const compressImage = async (uri: string, fileName?: string) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        uri: result.uri,
        name: fileName,
        type: "image/jpeg",
      };
    } catch (err) {
      return { uri, name: fileName, type: "image/jpeg" };
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setMsgModal({
        visible: true,
        type: "error",
        title: "Permission Denied",
        message: "Please allow access to your photo library to select files.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets) {
      const existing = getAllExistingNames();
      const processedAssets = [];
      const selectedAssets = result.assets.slice(0, 5);

      for (const a of selectedAssets) {
        let i = 1;
        let candidate = "";
        // Find the next available IMG_X.jpg
        while (true) {
          candidate = `IMG_${i}.jpg`;
          if (!existing.has(candidate.toLowerCase())) {
            existing.add(candidate.toLowerCase());
            break;
          }
          i++;
        }

        // Compress if it's an image
        if (a.type === 'image' || (a.mimeType && a.mimeType.startsWith('image/'))) {
          const compressed = await compressImage(a.uri, candidate);
          processedAssets.push({
            uri: compressed.uri,
            name: compressed.name || candidate,
            type: compressed.type,
            size: null, // Size check bypassed for compressed images
          });
        } else {
          processedAssets.push({
            uri: a.uri,
            name: candidate,
            type: a.mimeType || "image/jpeg",
            size: a.fileSize,
          });
        }
      }

      handlePickedFiles(processedAssets);
    }
    setActionSheetVisible(false);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setMsgModal({
        visible: true,
        type: "error",
        title: "Permission Denied",
        message: "Please allow camera access to take photos.",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      // Force 'photoX.jpg' naming for camera
      const name = getNextPhotoName();
      
      const compressed = await compressImage(a.uri, name);

      handlePickedFiles([
        {
          uri: compressed.uri,
          name: compressed.name || name,
          type: compressed.type || "image/jpeg",
          size: null, // Size check bypassed
        },
      ]);
    }
    setActionSheetVisible(false);
  };



  const handlePickedFiles = (assets: any[]) => {
    const valid = assets.filter((f) => !f.size || f.size <= MAX_FILE_SIZE);
    const tooBig = assets.filter((f) => f.size && f.size > MAX_FILE_SIZE);

    if (tooBig.length > 0) {
      const list = tooBig
        .map(
          (f) => `• ${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`
        )
        .join("\n");

      setMsgModal({
        visible: true,
        type: "error",
        title: "File Too Large",
        message: `Files larger than ${MAX_FILE_SIZE_MB} MB cannot be uploaded.\n\nSkipped:\n${list}`,
      });
    }

    if (valid.length === 0) return;

    const newFiles: LocalFile[] = valid.map((f, i) => {
      // If we provided a specific name (like from camera), try to keep it. 
      // getUniqueName will just verify it's free, or append (1) if collision occurred in the split second.
      const safeName = getUniqueName(f.name || `file_${i}`);
      
      return {
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        uri: f.uri,
        name: safeName,
        type: f.type || "application/octet-stream", // Ensure type is present
        status: "pending",
      };
    });

    // New files added to the TOP
    setLocalFiles((prev) => [...newFiles, ...prev]);
  };

  const uploadFiles = async () => {
    const pending = localFiles.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setUploading(true);
    setLocalFiles((prev) =>
      prev.map((f) =>
        f.status === "pending" ? { ...f, status: "uploading" } : f
      )
    );

    try {
      const payload = pending.map((f) => ({
        uri: f.uri,
        name: f.name,
        type: f.type,
      }));

      const res = await uploadAttachments(dispatchId, payload);

      if (res.ok) {
        setLocalFiles([]);
        await loadServerFiles();
        onUploadSuccess?.();

        setMsgModal({
          visible: true,
          type: "success",
          title: "Upload Successful!",
          message: `${pending.length} file${
            pending.length > 1 ? "s" : ""
          } uploaded successfully.`,
        });
      } else {
        throw new Error(res.error || "Upload failed");
      }
    } catch (err: any) {
      // Mark uploading files as failed
      setLocalFiles((prev) =>
        prev.filter((f) => f.status !== "uploading")
      );

      let title = "Upload Failed";
      let message =
        err?.message || "Something went wrong. Please try again.";

      if (typeof err?.message === "string" && err.message.includes("413")) {
        title = "File Too Large";
        message =
          "Upload rejected: One or more files are too large or too many files were sent at once.";
      }

      setMsgModal({
        visible: true,
        type: "error",
        title,
        message,
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string | number) => {
    setLocalFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Combine lists for display
  const allFiles: AnyFile[] = [
    ...localFiles,
    ...serverFiles.map((f) => ({
      id: f.id || `server-${Math.random()}`,
      name: f.fileName || "Unknown",
      status: "uploaded" as const,
    })),
  ];

  const pendingCount = localFiles.filter((f) => f.status === "pending").length;
  const totalCount = allFiles.length;

  const renderItem = ({ item, index }: { item: AnyFile; index: number }) => (
    <View style={styles.row}>
      <Text style={styles.cellNo}>{index + 1}</Text>
      <Text style={styles.cellName} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={styles.statusCell}>
        <Text
          style={{
            fontSize: 12,
            color:
              item.status === "uploaded"
                ? "#16A34A"
                : item.status === "failed"
                ? "#E11D48"
                : item.status === "uploading"
                ? "#FF9800"
                : "#666",
            marginRight: 12,
          }}
        >
          {item.status === "uploading"
            ? "Uploading..."
            : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
        {"uri" in item && item.status === "pending" && (
          <TouchableOpacity
            onPress={() => removeFile(item.id)}
            disabled={uploading}
          >
            <Ionicons name="close-circle" size={24} color="#E11D48" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <StatusBar style="dark" />
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>
              Attachments{totalCount > 0 ? ` (${totalCount})` : ""}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Buttons */}
          <View style={styles.buttonBar}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setActionSheetVisible(true)}
              disabled={uploading}
            >
              <Ionicons name="add-circle-outline" size={24} color="#2196F3" />
              <Text style={styles.addText}>Add Files</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadBtn,
                (uploading || pendingCount === 0) && styles.disabled,
              ]}
              onPress={uploadFiles}
              disabled={uploading || pendingCount === 0}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={22}
                    color="#fff"
                  />
                  <Text style={styles.uploadText}>
                    Upload{pendingCount > 0 ? ` (${pendingCount})` : ""}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          ) : allFiles.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="documents-outline" size={70} color="#CFD8DC" />
              <Text style={styles.emptyText}>No attachments yet</Text>
              <Text style={styles.emptySub}>Tap "Add Files" to begin</Text>
            </View>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.hNo}>#</Text>
                <Text style={styles.hName}>File Name</Text>
                <Text style={styles.hStatus}>Status</Text>
              </View>
              <FlatList
                data={allFiles}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            </>
          )}

          {/* Action Sheet */}
          <Modal visible={actionSheetVisible} transparent animationType="fade" statusBarTranslucent>
            <Pressable
              style={styles.overlay}
              onPress={() => setActionSheetVisible(false)}
            >
              <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <Text style={styles.sheetTitle}>Add Attachment</Text>
                <TouchableOpacity style={styles.sheetItem} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={26} color="#5856D6" />
                  <Text style={styles.sheetText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetItem}
                  onPress={pickFromGallery}
                >
                  <Ionicons name="images-outline" size={26} color="#16A34A" />
                  <Text style={styles.sheetText}>Choose from Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetItem, styles.cancel]}
                  onPress={() => setActionSheetVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        </View>
      </Modal>

      {/* Custom Message Modal */}
      <MessageModal
        visible={msgModal.visible}
        type={msgModal.type}
        title={msgModal.title}
        message={msgModal.message}
        onClose={() =>
          setMsgModal((prev) => ({
            ...prev,
            visible: false,
          }))
        }
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#263238" },
  buttonBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  addBtn: {
    flexDirection: "row",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#2196F3",
    alignItems: "center",
  },
  addText: {
    marginLeft: 8,
    color: "#1976D2",
    fontWeight: "600",
    fontSize: 16,
  },
  uploadBtn: {
    flexDirection: "row",
    backgroundColor: "#2196F3",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  uploadText: {
    marginLeft: 8,
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  disabled: { opacity: 0.6 },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#ECEFF1",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  hNo: {
    flex: 0.8,
    fontWeight: "bold",
    fontSize: 12,
    color: "#546E7A",
    textAlign: "center",
  },
  hName: {
    flex: 5,
    fontWeight: "bold",
    fontSize: 12,
    color: "#546E7A",
    paddingLeft: 8,
  },
  hStatus: {
    flex: 2,
    fontWeight: "bold",
    fontSize: 12,
    color: "#546E7A",
    textAlign: "right",
    paddingRight: 36,
  },

  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  cellNo: { flex: 0.8, textAlign: "center", fontSize: 13, color: "#455A64" },
  cellName: { flex: 5, fontSize: 13, color: "#263238", paddingLeft: 8 },
  statusCell: {
    flex: 2,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingRight: 10,
  },

  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#455A64",
    marginTop: 16,
  },
  emptySub: { fontSize: 14, color: "#78909C", marginTop: 8 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    // paddingBottom dynamically set
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#263238",
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  sheetText: { marginLeft: 16, fontSize: 17, color: "#263238" },
  cancel: {
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
    paddingTop: 16,
  },
  cancelText: {
    textAlign: "center",
    fontSize: 18,
    color: "#E11D48",
    fontWeight: "600",
  },

  // Message Modal Styles
  msgOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  msgContainer: {
    marginHorizontal: 40,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  msgTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#263238",
    marginTop: 16,
    marginBottom: 10,
  },
  msgText: {
    fontSize: 16,
    color: "#455A64",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  msgButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  msgButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});

export default UploadModal;
