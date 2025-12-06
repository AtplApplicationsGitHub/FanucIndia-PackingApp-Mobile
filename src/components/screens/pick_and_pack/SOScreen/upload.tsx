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
  Pressable,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
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
const DEBOUNCE_DELAY = 800;

export default function AttachmentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { saleOrderNumber } = route.params as { saleOrderNumber: string };

  const [files, setFiles] = useState<FileItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `SO ${saleOrderNumber}`,
    });
  }, [navigation, saleOrderNumber]);

  useEffect(() => {
    loadExistingAttachments();
  }, [saleOrderNumber]);

  const loadExistingAttachments = async () => {
    try {
      const ex = await fetchExistingAttachments(saleOrderNumber);
      setExistingAttachments(ex);
    } catch (e: any) {
      console.error("Failed to load existing attachments:", e);
      showModal("Error", "Failed to load existing attachments.", "error");
    }
  };

  const existingFiles: FileItem[] = useMemo(
    () =>
      existingAttachments.map((att) => ({
        id: att.id || att.uri,
        dbId: att.id,
        name: att.name,
        description: att.description || "",
        status: "Uploaded" as const,
        uri: att.uri,
        mimeType: att.type,
        timestamp: 0,
      })),
    [existingAttachments]
  );

  const displayFiles = useMemo(
    () => [...existingFiles, ...files].sort((a, b) => b.timestamp - a.timestamp),
    [existingFiles, files]
  );

  const getUniqueName = (baseName: string): string => {
    let name = baseName;
    let counter = 1;
    while (displayFiles.some((f) => f.name === name)) {
      const extIndex = baseName.lastIndexOf(".");
      const ext = extIndex > -1 ? baseName.slice(extIndex) : "";
      const nameWithoutExt = extIndex > -1 ? baseName.slice(0, extIndex) : baseName;
      name = `${nameWithoutExt}-${counter}${ext}`;
      counter++;
    }
    return name;
  };

  const showModal = (title: string, message: string, type: "success" | "error" = "success") => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setModalVisible(true);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      handlePickedFiles(result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.fileName || `Image-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      })));
    }
    setActionSheetVisible(false);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow camera access to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      handlePickedFiles([{
        uri: asset.uri,
        name: asset.fileName || `Photo-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      }]);
    }
    setActionSheetVisible(false);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        handlePickedFiles(result.assets);
      }
    } catch (err) {
      console.error("Document picker error:", err);
    }
    setActionSheetVisible(false);
  };

  const handlePickedFiles = (assets: any[]) => {
    const validFiles = assets.filter(f => !f.size || f.size <= MAX_FILE_SIZE);
    const largeFiles = assets.filter(f => f.size && f.size > MAX_FILE_SIZE);

    if (largeFiles.length > 0) {
      const names = largeFiles.map(f => `• ${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`).join("\n");
      Alert.alert(`File Too Large (> ${MAX_FILE_SIZE_MB} MB)`, `Skipped:\n\n${names}`);
    }

    if (validFiles.length === 0) return;

    const newFiles: FileItem[] = validFiles.map((file, i) => {
      const safeName = file.name || `File-${Date.now()}-${i}`;
      return {
        id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        name: getUniqueName(safeName),
        description: "",
        status: "Pending",
        uri: file.uri,
        mimeType: file.mimeType || "application/octet-stream",
        timestamp: Date.now() + i,
      };
    });

    setFiles(prev => [...prev, ...newFiles]);
  };

  const uploadFiles = async () => {
    const pendingFiles = files.filter(f => f.status === "Pending");
    if (pendingFiles.length === 0) {
      Alert.alert("No Files", "Add at least one file to upload.");
      return;
    }

    setUploading(true);
    setFiles(prev => prev.map(f => f.status === "Pending" ? { ...f, status: "Uploading" } : f));

    try {
      const attachments: AttachmentItem[] = pendingFiles.map(file => ({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
        description: file.description || "",
      }));

      await uploadAttachments(saleOrderNumber, attachments);
      await loadExistingAttachments();
      setFiles([]);
      showModal("Upload Successful!", `${pendingFiles.length} file(s) uploaded successfully.`, "success");
    } catch (e: any) {
      setFiles(prev => prev.map(f => f.status === "Uploading" ? { ...f, status: "Failed" } : f));
      const msg = e?.message?.includes("413")
        ? "Upload rejected: Files too large or too many at once."
        : e?.message || "Upload failed. Try again.";
      showModal("Upload Failed", msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileDescription = (id: string, text: string) => {
    const isNew = files.some(f => f.id === id);
    if (isNew) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, description: text, timestamp: Date.now() } : f));
    } else {
      setExistingAttachments(prev => prev.map(att => {
        if ((att.id || att.uri) === id) return { ...att, description: text };
        return att;
      }));
    }
  };

  const saveDescription = async (dbId: string, description: string, itemId: string) => {
    if (savingIds.has(itemId)) return;
    setSavingIds(s => new Set(s).add(itemId));

    try {
      await updateAttachmentDescription(dbId, description.trim());
    } catch (err) {
      await loadExistingAttachments();
      showModal("Save Failed", "Could not save description.", "error");
    } finally {
      setSavingIds(s => { const n = new Set(s); n.delete(itemId); return n; });
    }
  };

  const handleDescriptionChange = (item: FileItem, text: string) => {
    updateFileDescription(item.id, text);
    if (item.status === "Uploaded" && item.dbId) {
      clearTimeout(debounceTimerRef.current[item.id]);
      debounceTimerRef.current[item.id] = setTimeout(() => {
        saveDescription(item.dbId!, text, item.id);
      }, DEBOUNCE_DELAY);
    }
  };

  const pendingCount = files.filter(f => f.status === "Pending").length;

  const renderItem = ({ item, index }: { item: FileItem; index: number }) => {
    const isSaving = savingIds.has(item.id);
    return (
      <View style={styles.row}>
        <Text style={styles.cellSNo}>{index + 1}</Text>
        <Text style={styles.cellName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.descriptionContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add description..."
            value={item.description}
            onChangeText={(t) => handleDescriptionChange(item, t)}
            editable={!uploading && (item.status !== "Uploading")}
          />
          {isSaving && <ActivityIndicator size={12} color="#2196F3" style={{ marginLeft: 6 }} />}
        </View>
        <View style={styles.statusCell}>
          <Text style={{ color: item.status === "Uploaded" ? "#4CAF50" : item.status === "Failed" ? "#F44336" : "#FF9800", fontSize: 11 }}>
            {item.status === "Uploading" ? "Uploading..." : item.status}
          </Text>
          {item.status === "Pending" && (
            <TouchableOpacity onPress={() => removeFile(item.id)} disabled={uploading}>
              <Ionicons name="close-circle" size={20} color="#F44336" />
            </TouchableOpacity>
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
          style={[styles.fixedButton, styles.addButton]}
          onPress={() => setActionSheetVisible(true)}
          disabled={uploading}
        >
          <Ionicons name="add-circle-outline" size={22} color="#2196F3" />
          <Text style={styles.addButtonText}>Add Files</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fixedButton, styles.uploadButton, (uploading || pendingCount === 0) && styles.disabledBtn]}
          onPress={uploadFiles}
          disabled={uploading || pendingCount === 0}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload ({pendingCount})</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Empty State or List */}
      {displayFiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="documents-outline" size={64} color="#CFD8DC" />
          <Text style={styles.emptyText}>No attachments yet</Text>
          <Text style={styles.emptySubText}>Tap "Add Files" to get started</Text>
        </View>
      ) : (
        <>
          <View style={styles.tableHeader}>
            <Text style={styles.headerCellSNo}>#</Text>
            <Text style={styles.headerCellName}>File Name</Text>
            <Text style={styles.headerCellDescription}>Description</Text>
            <Text style={styles.headerCellStatus}>Status</Text>
          </View>
          <FlatList
            data={displayFiles}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
          />
        </>
      )}

      {/* Beautiful Action Sheet */}
      <Modal visible={actionSheetVisible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setActionSheetVisible(false)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>Add Attachment</Text>
            <TouchableOpacity style={styles.actionItem} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#2196F3" />
              <Text style={styles.actionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={24} color="#4CAF50" />
              <Text style={styles.actionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={pickDocument}>
              <Ionicons name="document-outline" size={24} color="#FF9800" />
              <Text style={styles.actionText}>Choose File</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionItem, styles.cancelItem]} onPress={() => setActionSheetVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Success/Error Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons
              name={modalType === "success" ? "checkmark-circle" : "alert-circle"}
              size={56}
              color={modalType === "success" ? "#4CAF50" : "#F44336"}
            />
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity style={styles.modalOkBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ==================== STYLES ==================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
  fixedButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, width: BUTTON_WIDTH },
  addButton: { backgroundColor: "#E3F2FD", borderWidth: 1.5, borderColor: "#2196F3" },
  addButtonText: { marginLeft: 8, fontWeight: "600", color: "#1976D2", fontSize: 15 },
  uploadButton: { backgroundColor: "#2196F3" },
  uploadButtonText: { marginLeft: 8, fontWeight: "600", color: "#fff", fontSize: 15 },
  disabledBtn: { opacity: 0.6 },
  tableHeader: { flexDirection: "row", backgroundColor: "#ECEFF1", paddingVertical: 12, paddingHorizontal: 8 },
  headerCellSNo: { flex: 0.8, fontWeight: "bold", fontSize: 12, color: "#546E7A", textAlign: "center" },
  headerCellName: { flex: 3, fontWeight: "bold", fontSize: 12, color: "#546E7A", paddingLeft: 8 },
  headerCellDescription: { flex: 4, fontWeight: "bold", fontSize: 12, color: "#546E7A", paddingLeft: 8 },
  headerCellStatus: { flex: 2, fontWeight: "bold", fontSize: 12, color: "#546E7A", textAlign: "center" },
  row: { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: "#eee" },
  cellSNo: { flex: 0.8, textAlign: "center", fontSize: 13, color: "#455A64" },
  cellName: { flex: 3, fontSize: 13, color: "#263238", paddingLeft: 8 },
  descriptionContainer: { flex: 4, flexDirection: "row", alignItems: "center" },
  input: { flex: 1, fontSize: 13, backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 10, height: 40 },
  statusCell: { flex: 2, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 8 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#455A64", marginTop: 16 },
  emptySubText: { fontSize: 14, color: "#78909C", marginTop: 8 },

  // Action Sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  actionSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 20 },
  actionSheetTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center", color: "#263238", marginBottom: 20 },
  actionItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 24 },
  actionText: { marginLeft: 16, fontSize: 17, color: "#263238" },
  cancelItem: { marginTop: 10, borderTopWidth: 1, borderColor: "#eee", paddingTop: 16 },
  cancelText: { textAlign: "center", fontSize: 18, color: "#F44336", fontWeight: "600" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", padding: 30, borderRadius: 20, alignItems: "center", width: "88%", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  modalTitle: { fontSize: 22, fontWeight: "bold", marginTop: 16, color: "#263238" },
  modalMessage: { fontSize: 15, color: "#546E7A", textAlign: "center", marginVertical: 12, lineHeight: 22 },
  modalOkBtn: { backgroundColor: "#2196F3", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 10 },
  modalOkText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});