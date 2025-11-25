import React, {
  useState,
  useLayoutEffect,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";

import {
  uploadAttachments,
  fetchExistingAttachments,
  type AttachmentItem,
  updateAttachmentDescription,
} from "../../../Api/Hooks/UseSalesOrder";

interface FileItem {
  id: string;
  dbId?: string | null;
  name: string;
  description: string;
  status: "Pending" | "Uploading" | "Uploaded" | "Failed";
  uri: string;
  mimeType?: string;
  timestamp: number;
  isDirty?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE_MB = 10;
const BUTTON_WIDTH = 140;
const DEBOUNCE_DELAY = 800; // ms

export default function AttachmentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { saleOrderNumber } = route.params as { saleOrderNumber: string };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `SO ${saleOrderNumber}`,
    });
  }, [navigation, saleOrderNumber]);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const loadExisting = async () => {
      try {
        const ex = await fetchExistingAttachments(saleOrderNumber);
        setExistingAttachments(ex);
      } catch (e: any) {
        console.error("Failed to load existing attachments:", e);
        Alert.alert(
          "Error",
          "Failed to load existing attachments. Proceeding without them."
        );
      }
    };
    loadExisting();
  }, [saleOrderNumber]);

  const existingFiles: FileItem[] = useMemo(
    () =>
      existingAttachments.map((att) => {
        const uniqueId = att.id || att.uri;
        return {
          id: uniqueId,
          dbId: att.id,
          name: att.name,
          description: att.description || "",
          status: "Uploaded" as const,
          uri: att.uri,
          mimeType: att.type,
          timestamp: 0,
        };
      }),
    [existingAttachments]
  );

  const displayFiles = useMemo(
    () =>
      [...existingFiles, ...files].sort((a, b) => b.timestamp - a.timestamp),
    [existingFiles, files]
  );

  const getUniqueName = (baseName: string): string => {
    let name = baseName;
    let counter = 1;
    while (displayFiles.some((f) => f.name === name)) {
      const extIndex = baseName.lastIndexOf(".");
      const ext = extIndex > -1 ? baseName.slice(extIndex) : "";
      const nameWithoutExt =
        extIndex > -1 ? baseName.slice(0, extIndex) : baseName;
      name = `${nameWithoutExt}-${counter}${ext}`;
      counter++;
    }
    return name;
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "*/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets) {
        return;
      }

      const assets = result.assets;

      // Filter valid and large files safely (size can be null/undefined)
      const validFiles = assets.filter(
        (file) => file.size == null || file.size <= MAX_FILE_SIZE
      );

      const largeFiles = assets.filter(
        (file) => file.size != null && file.size > MAX_FILE_SIZE
      );

      if (largeFiles.length > 0) {
        const largeFileNames = largeFiles
          .map(
            (f) =>
              `• ${f.name} (${(f.size! / (1024 * 1024)).toFixed(1)} MB)`
          )
          .join("\n");

        Alert.alert(
          `File Too Large (> ${MAX_FILE_SIZE_MB} MB)`,
          `The following files were skipped:\n\n${largeFileNames}`,
          [{ text: "OK" }]
        );
      }

      if (validFiles.length === 0) {
        if (largeFiles.length === 0) {
          Alert.alert("No Files Selected", "No valid files were picked.");
        }
        return;
      }

      const newFiles: FileItem[] = validFiles.map((file, index) => {
        const safeName = file.name || `File-${Date.now()}-${index}`;
        const uniqueName = getUniqueName(safeName);

        return {
          id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
          name: uniqueName,
          description: "",
          status: "Pending",
          uri: file.uri,
          mimeType: file.mimeType ?? "application/octet-stream",
          timestamp: Date.now() + index,
        };
      });

      setFiles((prev) => [...prev, ...newFiles]);
    } catch (error: any) {
      console.error("Document picker error:", error);
      Alert.alert("Error", error.message || "Unable to pick file(s)");
    }
  };

  const loadExistingAttachments = async () => {
    try {
      const ex = await fetchExistingAttachments(saleOrderNumber);
      setExistingAttachments(ex);
    } catch (e: any) {
      console.error("Failed to reload existing attachments:", e);
    }
  };

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === "Pending");
    if (pendingFiles.length === 0) {
      Alert.alert("No new files", "Please add at least one new file to upload.");
      return;
    }

    if (uploading) return;

    setUploading(true);

    try {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "Pending" ? { ...f, status: "Uploading" } : f
        )
      );

      const attachments: AttachmentItem[] = pendingFiles.map((file) => ({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
        description: file.description || "",
      }));

      await uploadAttachments(saleOrderNumber, attachments);
      await loadExistingAttachments();
      setFiles([]);
      setModalTitle("Upload Successful");
      setModalMessage(`${pendingFiles.length} file(s) uploaded successfully!`);
      setModalVisible(true);
    } catch (e: any) {
      console.error("Upload error:", e);
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "Uploading" ? { ...f, status: "Failed" } : f
        )
      );

      let errorMessage = e?.message ?? "Upload failed. Please try again.";
      if (errorMessage.includes("413")) {
        errorMessage =
          "Server rejected the upload (file too large or too many files). Try uploading fewer or smaller files.";
      }

      setModalTitle("Upload Failed");
      setModalMessage(errorMessage);
      setModalVisible(true);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileDescription = (id: string, newDescription: string) => {
    const isNewFile = files.some((f) => f.id === id);

    if (isNewFile) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, description: newDescription, timestamp: Date.now() }
            : f
        )
      );
    } else {
      setExistingAttachments((prev) =>
        prev.map((att) => {
          const uniqueId = att.id || att.uri;
          if (uniqueId === id) {
            return { ...att, description: newDescription };
          }
          return att;
        })
      );
    }
  };

  const saveDescription = async (dbId: string, description: string, itemId: string) => {
    if (savingIds.has(itemId)) return;

    setSavingIds((prev) => new Set(prev).add(itemId));

    try {
      await updateAttachmentDescription(dbId, description.trim());
    } catch (error: any) {
      console.error("Failed to update description:", error);
      await loadExistingAttachments();
      setModalTitle("Save Failed");
      setModalMessage("Could not save description. Changes reverted.");
      setModalVisible(true);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleDescriptionChange = (item: FileItem, text: string) => {
    updateFileDescription(item.id, text);

    if (item.status === "Uploaded" && item.dbId) {
      if (debounceTimerRef.current[item.id]) {
        clearTimeout(debounceTimerRef.current[item.id]);
      }

      debounceTimerRef.current[item.id] = setTimeout(() => {
        saveDescription(item.dbId!, text, item.id);
      }, DEBOUNCE_DELAY);
    }
  };

  const getStatusColor = (status: FileItem["status"]) => {
    switch (status) {
      case "Uploaded": return "#4CAF50";
      case "Failed": return "#F44336";
      case "Uploading": return "#2196F3";
      default: return "#FF9800";
    }
  };

  const getStatusText = (status: FileItem["status"]) => {
    switch (status) {
      case "Uploaded": return "Uploaded";
      case "Failed": return "Failed";
      case "Uploading": return "Uploading...";
      default: return "Pending";
    }
  };

  const pendingCount = files.filter((f) => f.status === "Pending").length;

  const renderItem = ({ item, index }: { item: FileItem; index: number }) => {
    const isSaving = savingIds.has(item.id);

    return (
      <View style={styles.row}>
        <Text style={styles.cellSNo}>{index + 1}</Text>
        <Text style={styles.cellName} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        <View style={styles.descriptionContainer}>
          <TextInput
            style={[styles.cellDescription, styles.input]}
            placeholder="Enter description (optional)"
            value={item.description}
            onChangeText={(text) => handleDescriptionChange(item, text)}
            editable={!uploading && (item.status === "Pending" || item.status === "Uploaded")}
            returnKeyType="done"
            blurOnSubmit={true}
          />
          {isSaving && (
            <ActivityIndicator size={14} color="#2196F3" style={styles.savingIndicator} />
          )}
        </View>
        <View style={styles.statusCell}>
          <Text style={{ color: getStatusColor(item.status), fontSize: 12 }}>
            {getStatusText(item.status)}
          </Text>
          {item.status === "Pending" && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeFile(item.id)}
              disabled={uploading}
            >
              <Ionicons name="close-circle" size={18} color="#F44336" />
            </TouchableOpacity
            >
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Buttons */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.fixedButton, styles.addButton, uploading && { opacity: 0.7 }]}
          onPress={pickFile}
          disabled={uploading}
        >
          <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
          <Text style={styles.fixedButtonText}>New Files</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.fixedButton,
            styles.uploadButton,
            (uploading || pendingCount === 0) && { opacity: 0.7 },
          ]}
          onPress={uploadFiles}
          disabled={uploading || pendingCount === 0}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.fixedButtonText}>
                Upload ({pendingCount})
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* File List or Empty State */}
      {displayFiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-outline" size={48} color="#B0BEC5" />
          <Text style={styles.emptyText}>No attachments yet</Text>
          <Text style={styles.emptySubText}>
            Tap "New Files" to add attachments
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={styles.headerCellSNo}>S/No</Text>
            <Text style={styles.headerCellName}>File Name</Text>
            <Text style={styles.headerCellDescription}>Description</Text>
            <Text style={styles.headerCellStatus}>Status</Text>
          </View>

          <FlatList
            data={displayFiles}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.fileList}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Ionicons
              name={modalTitle.includes("Success") || modalTitle.includes("Successful") ? "checkmark-circle" : "alert-circle"}
              size={40}
              color={modalTitle.includes("Success") || modalTitle.includes("Successful") ? "#4CAF50" : "#F44336"}
            />
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ==================== STYLES ==================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 8,
  },
  fixedButton: {
    width: BUTTON_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  fixedButtonText: { marginLeft: 6, fontWeight: "500", fontSize: 14, color: "#da1010ff" },
  addButton: { borderWidth: 1, borderStyle: "dashed", borderColor: "#B0BEC5", backgroundColor: "#fff" },
  uploadButton: { backgroundColor: "#2196F3" },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerCellSNo: { flex: 1, fontWeight: "bold", textAlign: "center", fontSize: 12, color: "#757575" },
  headerCellName: { flex: 3, fontWeight: "bold", fontSize: 12, paddingLeft: 8, color: "#757575" },
  headerCellDescription: { flex: 4, fontWeight: "bold", fontSize: 12, paddingLeft: 8, color: "#757575" },
  headerCellStatus: { flex: 2, fontWeight: "bold", textAlign: "center", fontSize: 12, color: "#757575" },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 50,
  },
  cellSNo: { flex: 1, textAlign: "center", fontSize: 12, color: "#424242" },
  cellName: { flex: 3, fontSize: 12, paddingLeft: 8, color: "#424242" },
  descriptionContainer: { flex: 4, flexDirection: "row", alignItems: "center", paddingLeft: 8 },
  cellDescription: { flex: 1 },
  input: { fontSize: 12, paddingHorizontal: 8, height: 40 },
  savingIndicator: { marginLeft: 6 },
  statusCell: { flex: 2, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 8 },
  removeButton: { paddingLeft: 8 },

  fileList: { flex: 1 },
  listContent: { flexGrow: 1 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#B0BEC5",
    borderRadius: 12,
    marginTop: 20,
  },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 12, color: "#424242" },
  emptySubText: { fontSize: 13, color: "#78909C", textAlign: "center", marginTop: 6 },

  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "#fff", padding: 24, borderRadius: 12, alignItems: "center", width: "85%", maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginTop: 12, marginBottom: 8 },
  modalMessage: { fontSize: 14, textAlign: "center", color: "#555", lineHeight: 20, marginBottom: 20 },
  modalButton: { backgroundColor: "#2196F3", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  modalButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});