// AttachmentsModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import {
  uploadAttachments,
  getAttachments,
  type ApiResult,
  type DispatchAttachment,
} from "../../Api/material_dispatch_server";

// ---- Color palette (adjust to your theme) ----
const C = {
  bg: "#101316",
  card: "#171B20",
  border: "#232A31",
  text: "#E8EDF2",
  hint: "#92A0AF",
  blue: "#3B82F6",
  green: "#22C55E",
  red: "#EF4444",
  overlay: "rgba(0,0,0,0.55)",
};

// ---- Props ----
type Props = {
  visible: boolean;
  dispatchId: string; // or number, match your backend
  onClose: () => void;
  onUploaded?: (files: DispatchAttachment[]) => void;
};

// ---- Local types ----
type PickedFile = {
  uri: string;
  name: string;
  size?: number | null;
  mimeType?: string | null;
  base64?: string; // filled when preparing upload
};

export default function AttachmentsModal({
  visible,
  dispatchId,
  onClose,
  onUploaded,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<PickedFile[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<DispatchAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // ----- Load previously uploaded attachments whenever modal opens -----
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!visible || !dispatchId) return;
      setLoadingExisting(true);
      const res = (await getAttachments(dispatchId)) as ApiResult<DispatchAttachment[]>;
      if (mounted) {
        if (res?.ok && Array.isArray(res.data)) {
          setUploadedAttachments(res.data);
        } else {
          // Optionally surface error to user
          setUploadedAttachments([]);
        }
        setLoadingExisting(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [visible, dispatchId]);

  // ----- File selection -----
  const handleFileSelect = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      // In SDKs where multiple is true, result can be a single or multi result.
      if (result.canceled) return;

      const picked: PickedFile[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name ?? "file",
        size: a.size ?? null,
        mimeType: a.mimeType ?? null,
      }));

      // Merge unique by URI+name to avoid duplicates
      setSelectedFiles((prev) => {
        const key = (f: PickedFile) => `${f.uri}|${f.name}`;
        const existing = new Set(prev.map(key));
        const merged = [...prev];
        for (const f of picked) {
          if (!existing.has(key(f))) merged.push(f);
        }
        return merged;
      });
    } catch (e) {
      // Optionally show a toast/snackbar
      console.warn("File select error:", e);
    }
  }, []);

  // ----- Remove file from selection -----
  const removeSelectedFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ----- Upload selected files -----
  const handleFileUpload = useCallback(async () => {
    if (!dispatchId || selectedFiles.length === 0) return;

    try {
      setUploading(true);

      // Read as base64
      const filesWithB64: PickedFile[] = [];
      for (const f of selectedFiles) {
        const base64 = await FileSystem.readAsStringAsync(f.uri, { encoding: FileSystem.EncodingType.Base64 });
        filesWithB64.push({ ...f, base64 });
      }

      // Construct payload expected by your API
      // Adjust the shape if your API differs.
      const payload = {
        dispatchId,
        files: filesWithB64.map((f) => ({
          fileName: f.name,
          mimeType: f.mimeType ?? "application/octet-stream",
          base64: f.base64!, // present now
        })),
      };

      const res = (await uploadAttachments(payload)) as ApiResult<DispatchAttachment[]>;
      if (!res?.ok) {
        throw new Error(res?.message || "Upload failed");
      }

      // Refresh list
      const refreshed = (await getAttachments(dispatchId)) as ApiResult<DispatchAttachment[]>;
      if (refreshed?.ok && Array.isArray(refreshed.data)) {
        setUploadedAttachments(refreshed.data);
        onUploaded?.(refreshed.data);
      }

      // Clear the selection after success
      setSelectedFiles([]);
    } catch (e: any) {
      console.warn("Upload error:", e?.message || e);
      // Optionally show a toast/snackbar
    } finally {
      setUploading(false);
    }
  }, [dispatchId, onUploaded, selectedFiles]);

  // ----- Derived counts / labels -----
  const selectedCount = selectedFiles.length;
  const uploadedCount = uploadedAttachments.length;

  // ----- Render -----
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.fileModal}>
          {/* Header */}
          <View style={styles.fileModalHeader}>
            <Text style={styles.fileModalTitle}>Upload Attachments</Text>
            <TouchableOpacity onPress={onClose} style={styles.fileModalCloseBtn}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* Selected Files Section */}
          <View style={styles.selectedFilesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Selected Files</Text>
              <Text style={styles.fileCount}>({selectedCount} files)</Text>
            </View>

            {selectedCount > 0 ? (
              <View style={styles.selectedFilesContainer}>
                <ScrollView style={styles.selectedFilesList} showsVerticalScrollIndicator={false}>
                  {selectedFiles.map((file, index) => (
                    <View key={`${file.uri}-${index}`} style={styles.selectedFileItem}>
                      <View style={styles.fileInfo}>
                        <Ionicons name="document-outline" size={18} color={C.blue} />
                        <View style={styles.fileDetails}>
                          <Text style={styles.selectedFileName} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <Text style={styles.fileSize}>
                            {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Size unknown"}
                          </Text>
                        </View>
                      </View>
                      <Pressable onPress={() => removeSelectedFile(index)} style={styles.removeFileBtn}>
                        <Ionicons name="close-circle" size={20} color={C.red} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={40} color={C.hint} />
                <Text style={styles.emptyStateText}>No files selected</Text>
                <Text style={styles.emptyStateSubtext}>Choose files to upload</Text>
              </View>
            )}
          </View>

          {/* Uploaded Files Section */}
          <View style={styles.uploadedFilesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Uploaded Files</Text>
              <Text style={styles.fileCount}>
                {loadingExisting ? "" : `(${uploadedCount} files)`}
              </Text>
            </View>

            <View style={styles.uploadedFilesContainer}>
              {loadingExisting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : uploadedCount > 0 ? (
                <ScrollView style={styles.uploadedFilesList} showsVerticalScrollIndicator={false}>
                  {uploadedAttachments.map((file) => (
                    <View key={file.id} style={styles.uploadedFileItem}>
                      <View style={styles.fileInfo}>
                        <Ionicons name="checkmark-circle" size={18} color={C.green} />
                        <View style={styles.fileDetails}>
                          <Text style={styles.uploadedFileName} numberOfLines={1}>
                            {file.fileName}
                          </Text>
                          <Text style={styles.fileUploadDate}>
                            Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="cloud-done-outline" size={28} color={C.hint} />
                  <Text style={styles.emptyStateText}>No uploaded files yet</Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.fileModalActions}>
            <TouchableOpacity onPress={handleFileSelect} style={[styles.fileModalBtn, styles.fileSelectBtn]}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.fileSelectText}>Choose Files</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleFileUpload}
              disabled={selectedFiles.length === 0 || uploading}
              style={[
                styles.fileModalBtn,
                styles.uploadBtn,
                (selectedFiles.length === 0 || uploading) && styles.disabledBtn,
              ]}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                  <Text style={styles.uploadBtnText}>Upload ({selectedCount})</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  fileModal: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  fileModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  fileModalTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "600",
  },
  fileModalCloseBtn: {
    padding: 6,
    borderRadius: 999,
  },

  // Selected section
  selectedFilesSection: {
    marginTop: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "600",
  },
  fileCount: {
    color: C.hint,
    fontSize: 12,
  },

  selectedFilesContainer: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  selectedFilesList: {
    padding: 8,
  },
  selectedFileItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F1317",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "85%",
  },
  fileDetails: {
    flexShrink: 1,
  },
  selectedFileName: {
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
  },
  fileSize: {
    color: C.hint,
    fontSize: 12,
    marginTop: 2,
  },
  removeFileBtn: {
    padding: 2,
    borderRadius: 999,
  },

  // Uploaded section
  uploadedFilesSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  uploadedFilesContainer: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  uploadedFilesList: {
    padding: 8,
  },
  uploadedFileItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E1318",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  uploadedFileName: {
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
  },
  uploadedFileDate: {
    color: C.hint,
    fontSize: 12,
  },
  fileUploadDate: {
    color: C.hint,
    fontSize: 12,
    marginTop: 2,
  },

  // Empty states
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    gap: 6,
  },
  emptyStateSmall: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 6,
  },
  emptyStateText: {
    color: C.text,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyStateSubtext: {
    color: C.hint,
    fontSize: 12,
  },

  // Actions
  fileModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  fileModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  fileSelectBtn: {
    backgroundColor: C.blue,
  },
  fileSelectText: {
    color: "#fff",
    fontWeight: "600",
  },
  uploadBtn: {
    backgroundColor: C.green,
  },
  uploadBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.5,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  loadingText: {
    color: C.hint,
    fontSize: 12,
  },
});
