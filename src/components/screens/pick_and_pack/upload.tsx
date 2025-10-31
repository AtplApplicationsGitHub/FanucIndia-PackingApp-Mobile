import React, { useState, useLayoutEffect, useMemo, useEffect } from "react";
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
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";

import {
  uploadAttachments,
  fetchExistingAttachments,
  type AttachmentItem,
  updateAttachmentDescription,
} from "../../Api/SalesOrder_server";

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

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BUTTON_WIDTH = 140;               // <-- same size for both buttons

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
  const [existingAttachments, setExistingAttachments] = useState<
    AttachmentItem[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [dirtyDescriptions, setDirtyDescriptions] = useState<
    Record<string, { original: string; current: string }>
  >({});

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
        const dirtyState = dirtyDescriptions[uniqueId];
        const currentDescription = dirtyState
          ? dirtyState.current
          : att.description || "";
        const isDirty = dirtyState
          ? dirtyState.current !== dirtyState.original
          : false;

        return {
          id: uniqueId,
          dbId: att.id,
          name: att.name,
          description: currentDescription,
          status: "Uploaded" as const,
          uri: att.uri,
          mimeType: att.type,
          timestamp: 0,
          isDirty,
        };
      }),
    [existingAttachments, dirtyDescriptions]
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

      if (result.canceled) return;

      const validFiles = result.assets.filter(
        (file) => file.size <= MAX_FILE_SIZE
      );
      const largeFiles = result.assets.filter(
        (file) => file.size > MAX_FILE_SIZE
      );

      if (largeFiles.length > 0) {
        Alert.alert(
          "File Too Large",
          `Some files exceed the 10MB limit and were not added: ${largeFiles
            .map((f) => f.name)
            .join(", ")}`
        );
      }

      const newFiles: FileItem[] = validFiles.map((file, index) => {
        const uniqueName = getUniqueName(file.name || "Unknown");
        return {
          id: `${Date.now()}-${index}`,
          name: uniqueName,
          description: "",
          status: "Pending",
          uri: file.uri,
          mimeType: file.mimeType,
          timestamp: Date.now(),
        };
      });

      setFiles((prev) => [...prev, ...newFiles]);
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Unable to pick file");
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
      Alert.alert(
        "No new files",
        "Please add at least one new file to upload."
      );
      return;
    }

    if (uploading) return;

    setUploading(true);

    try {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "Pending" ? { ...f, status: "Uploading" as const } : f
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
      setModalTitle("Success");
      setModalMessage(
        `${pendingFiles.length} new file(s) uploaded successfully!`
      );
      setModalVisible(true);
    } catch (e: any) {
      console.error("Upload error:", e);
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "Uploading" ? { ...f, status: "Failed" as const } : f
        )
      );
      let errorMessage = e?.message ?? "Please try again.";
      if (errorMessage.includes("413")) {
        errorMessage =
          "The file(s) are too large to upload. Please select smaller files or upload fewer at a time.";
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
      setDirtyDescriptions((prev) => {
        const originalItem = existingAttachments.find(
          (att) => (att.id || att.uri) === id
        );
        const originalDescription = originalItem?.description || "";

        if (newDescription === originalDescription) {
          const { [id]: _, ...rest } = prev;
          return rest;
        } else {
          return {
            ...prev,
            [id]: {
              original: prev[id]?.original ?? originalDescription,
              current: newDescription,
            },
          };
        }
      });
    }
  };

  const getStatusColor = (status: FileItem["status"]) => {
    switch (status) {
      case "Uploaded":
        return "#4CAF50";
      case "Failed":
        return "#F44336";
      case "Uploading":
        return "#2196F3";
      default:
        return "#FF9800";
    }
  };

  const getStatusText = (status: FileItem["status"]) => {
    switch (status) {
      case "Uploaded":
        return "Uploaded";
      case "Failed":
        return "Failed";
      case "Uploading":
        return "Uploading...";
      default:
        return "Pending";
    }
  };

  const pendingCount = files.filter((f) => f.status === "Pending").length;

  const handleUpdateDescription = async (
    item: FileItem,
    newDescription: string
  ) => {
    const uniqueId = item.id;
    const dirtyState = dirtyDescriptions[uniqueId];

    if (
      item.status !== "Uploaded" ||
      !item.dbId ||
      !dirtyState ||
      !item.isDirty
    ) {
      return;
    }

    try {
      await updateAttachmentDescription(item.dbId, newDescription.trim());

      setDirtyDescriptions((prev) => {
        const { [uniqueId]: _, ...rest } = prev;
        return rest;
      });

      await loadExistingAttachments();
    } catch (error: any) {
      console.error("Failed to update description:", error);
      setModalTitle("Update Failed");
      setModalMessage(
        error?.message || "Could not update the description. Please try again."
      );
      setModalVisible(true);
    }
  };

  const renderItem = ({ item, index }: { item: FileItem; index: number }) => (
    <View style={styles.row}>
      <Text style={styles.cellSNo}>{index + 1}</Text>
      <Text style={styles.cellName} numberOfLines={1} ellipsizeMode="tail">
        {item.name}
      </Text>
      <TextInput
        style={[styles.cellDescription, styles.input]}
        placeholder="Enter description"
        value={item.description}
        onChangeText={(text) => {
          if (!uploading) {
            updateFileDescription(item.id, text);
          }
        }}
        editable={
          !uploading &&
          (item.status === "Pending" || item.status === "Uploaded")
        }
        onEndEditing={(e) => handleUpdateDescription(item, e.nativeEvent.text)}
        onSubmitEditing={() => handleUpdateDescription(item, item.description)}
        returnKeyType="done"
        blurOnSubmit={true}
      />
      <View style={styles.actionsCell}>
        {item.status === "Uploaded" && (
          <TouchableOpacity
            onPress={() => handleUpdateDescription(item, item.description)}
            disabled={!item.isDirty || uploading}
          >
            <Ionicons
              name="save-outline"
              size={22}
              color={!item.isDirty || uploading ? "#B0BEC5" : "#2196F3"}
              style={{ opacity: !item.isDirty || uploading ? 0.5 : 1 }}
            />
          </TouchableOpacity>
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
            <Ionicons name="close-circle" size={16} color="#F44336" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ------------------- HEADER WITH FIXED-SIZE BUTTONS ------------------- */}
      <View style={styles.header}>
        {/* NEW FILES BUTTON */}
        <TouchableOpacity
          style={[
            styles.fixedButton,
            styles.addButton,
            uploading && { opacity: 0.7 },
          ]}
          onPress={pickFile}
          disabled={uploading}
        >
          <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
          <Text style={styles.fixedButtonText}>New Files</Text>
        </TouchableOpacity>

        {/* UPLOAD BUTTON */}
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
                {`Upload (${pendingCount})`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ------------------- FILE LIST SECTION ------------------- */}
      {displayFiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-outline" size={48} color="#B0BEC5" />
          <Text style={styles.emptyText}>No attachments yet</Text>
          <Text style={styles.emptySubText}>
            Add your first attachment using the button above
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

      {/* ------------------- MODAL ------------------- */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
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

/* ------------------- STYLES ------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },

  /* ---------- HEADER ---------- */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },

  /* Base for both buttons (same width & height) */
  fixedButton: {
    width: BUTTON_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  fixedButtonText: {
    marginLeft: 6,
    fontWeight: "500",
    fontSize: 14,
  },

  /* NEW FILES BUTTON */
  addButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#B0BEC5",
    backgroundColor: "#fff",
  },

  /* UPLOAD BUTTON */
  uploadButton: {
    backgroundColor: "#2196F3",
  },

  /* ---------- TABLE ---------- */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerCellSNo: {
    flex: 1,
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 12,
    color: "#757575",
  },
  headerCellName: {
    flex: 3,
    fontWeight: "bold",
    textAlign: "left",
    fontSize: 12,
    paddingLeft: 8,
    color: "#757575",
  },
  headerCellDescription: {
    flex: 4,
    fontWeight: "bold",
    textAlign: "left",
    fontSize: 12,
    paddingLeft: 8,
    color: "#757575",
  },
  headerCellStatus: {
    flex: 2,
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 12,
    color: "#757575",
  },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 12,
    alignItems: "center",
    minHeight: 50,
  },
  cellSNo: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#424242",
  },
  cellName: {
    flex: 3,
    textAlign: "left",
    fontSize: 12,
    paddingLeft: 8,
    color: "#424242",
  },
  cellDescription: {
    flex: 4,
    paddingLeft: 8,
  },
  input: {
    fontSize: 12,
    paddingHorizontal: 8,
    height: 40,
    textAlignVertical: "center",
  },
  actionsCell: {
    flex: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  statusCell: {
    flex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 8,
  },
  removeButton: {
    paddingLeft: 8,
  },

  fileList: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#B0BEC5",
    borderRadius: 8,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    color: "#757575",
  },
  emptySubText: {
    fontSize: 12,
    color: "#B0BEC5",
    textAlign: "center",
    marginTop: 4,
  },

  /* ---------- MODAL ---------- */
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});