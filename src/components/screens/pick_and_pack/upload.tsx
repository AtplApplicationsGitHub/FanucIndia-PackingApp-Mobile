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
import { Ionicons } from '@expo/vector-icons';

import { uploadAttachments, fetchExistingAttachments, type AttachmentItem } from "../../Api/SalesOrder_server";

interface FileItem {
  id: string;
  name: string;
  description: string;
  status: "Pending" | "Uploading" | "Uploaded" | "Failed";
  uri: string;
  mimeType?: string;
  timestamp: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function AttachmentScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { saleOrderNumber } = route.params as { saleOrderNumber: string };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `Upload Attachments for SO ${saleOrderNumber}`,
    });
  }, [navigation, saleOrderNumber]);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    const loadExisting = async () => {
      try {
        const ex = await fetchExistingAttachments(saleOrderNumber);
        setExistingAttachments(ex);
      } catch (e: any) {
        console.error("Failed to load existing attachments:", e);
        Alert.alert("Error", "Failed to load existing attachments. Proceeding without them.");
      }
    };
    loadExisting();
  }, [saleOrderNumber]);

  const existingFiles: FileItem[] = useMemo(
    () =>
      existingAttachments.map((att, index) => ({
        id: `ex-${index}`,
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
    while (displayFiles.some(f => f.name === name)) {
      const extIndex = baseName.lastIndexOf('.');
      const ext = extIndex > -1 ? baseName.slice(extIndex) : '';
      const nameWithoutExt = extIndex > -1 ? baseName.slice(0, extIndex) : baseName;
      name = `${nameWithoutExt} (${counter})${ext}`;
      counter++;
    }
    return name;
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', '*/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;

      const validFiles = result.assets.filter(file => file.size <= MAX_FILE_SIZE);
      const largeFiles = result.assets.filter(file => file.size > MAX_FILE_SIZE);

      if (largeFiles.length > 0) {
        Alert.alert("File Too Large", `Some files exceed the 10MB limit and were not added: ${largeFiles.map(f => f.name).join(', ')}`);
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

      setFiles(prev => [...prev, ...newFiles]);
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
    const pendingFiles = files.filter(f => f.status === "Pending");
    if (pendingFiles.length === 0) {
      Alert.alert("No new files", "Please add at least one new file to upload.");
      return;
    }

    if (uploading) return;

    setUploading(true);
    
    try {
      setFiles(prev => prev.map(f => 
        f.status === "Pending" ? { ...f, status: "Uploading" as const } : f
      ));

      const attachments: AttachmentItem[] = pendingFiles.map(file => {
        console.log("Preparing upload for file:", {
          name: file.name,
          uri: file.uri,
          type: file.mimeType || "application/octet-stream",
          description: file.description || ""
        });
        return {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
          description: file.description || ""
        };
      });

      await uploadAttachments(saleOrderNumber, attachments);
      await loadExistingAttachments();
      setFiles([]);
      setModalTitle("Success");
      setModalMessage(`${pendingFiles.length} new file(s) uploaded successfully!`);
      setModalVisible(true);
    } catch (e: any) {
      console.error("Upload error:", e);
      setFiles(prev => prev.map(f => 
        f.status === "Uploading" ? { ...f, status: "Failed" as const } : f
      ));
      let errorMessage = e?.message ?? "Please try again.";
      if (errorMessage.includes('413')) {
        errorMessage = "The file(s) are too large to upload. Please select smaller files or upload fewer at a time.";
      }
      setModalTitle("Upload Failed");
      setModalMessage(errorMessage);
      setModalVisible(true);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileDescription = (id: string, description: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, description, timestamp: Date.now() } : f
    ));
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

  const pendingCount = files.filter(f => f.status === "Pending").length;

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
          if (item.status !== "Uploaded" && !uploading) {
            updateFileDescription(item.id, text);
          }
        }}
        editable={!uploading && item.status === "Pending"}
      />
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
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={pickFile}
        disabled={uploading}
      >
        <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
        <Text style={styles.addButtonText}>Add New Files</Text>
      </TouchableOpacity>

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
          />
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.uploadLabel}>
          Total Attachments: {displayFiles.length}
        </Text>
        <Text style={styles.uploadDesc}>
          {(existingFiles.length > 0 && `(${existingFiles.length} already uploaded) `) || ""}
          Upload {pendingCount > 0 && `${pendingCount} new file${pendingCount > 1 ? 's' : ''}`} to the server for order {saleOrderNumber}
        </Text>
        <TouchableOpacity 
          style={[
            styles.uploadButton, 
            (uploading || pendingCount === 0) && { opacity: 0.7 }
          ]} 
          onPress={uploadFiles}
          disabled={uploading || pendingCount === 0}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>
                {`Upload New Files (${pendingCount})`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fff", 
    padding: 16 
  },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#B0BEC5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  addButtonText: { 
    color: "#2196F3", 
    marginLeft: 6, 
    fontWeight: "500" 
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    paddingVertical: 8,
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
    height: 35,
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#B0BEC5",
    borderRadius: 8,
  },
  emptyText: { fontSize: 14, fontWeight: "500", marginTop: 8, color: "#757575" },
  emptySubText: { fontSize: 12, color: "#B0BEC5", textAlign: "center" },
  footer: { 
    marginTop: 16, 
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  uploadLabel: { fontWeight: "bold", fontSize: 14, color: "#424242" },
  uploadDesc: { fontSize: 12, color: "#757575", marginBottom: 10, textAlign: "center" },
  uploadButton: {
    flexDirection: "row",
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 200,
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 14,
  },
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