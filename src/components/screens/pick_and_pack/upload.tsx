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
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { uploadAttachments, fetchExistingAttachments, type AttachmentItem } from "../../Api/SalesOrder_server";

interface FileItem {
  id: string;
  name: string;
  description: string;
  status: "Pending" | "Uploading" | "Uploaded" | "Failed";
  uri: string;
  mimeType?: string;
}

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
      })),
    [existingAttachments]
  );

  const displayFiles = useMemo(
    () => [...existingFiles, ...files],
    [existingFiles, files]
  );

  // File Picker (supports any file type)
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", // allows all files
        copyToCacheDirectory: true,
        multiple: true, // Allow multiple file selection
      });

      if (result.canceled) return;

      const newFiles: FileItem[] = result.assets.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name || "Unknown",
        description: "",
        status: "Pending",
        uri: file.uri,
        mimeType: file.mimeType,
      }));

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

  // Upload Files
  const uploadFiles = async () => {
    const pendingFiles = files.filter(f => f.status === "Pending");
    if (pendingFiles.length === 0) {
      Alert.alert("No new files", "Please add at least one new file to upload.");
      return;
    }

    if (uploading) return;

    setUploading(true);
    
    try {
      // Update pending files to uploading status
      setFiles(prev => prev.map(f => 
        f.status === "Pending" ? { ...f, status: "Uploading" as const } : f
      ));

      // Prepare attachments for upload (only pending/new)
      const attachments: AttachmentItem[] = pendingFiles.map(file => ({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
        description: file.description,
      }));

      // Upload attachments
      await uploadAttachments(saleOrderNumber, attachments);

      // Reload existing attachments (now includes the new ones)
      await loadExistingAttachments();
      
      // Clear new files state
      setFiles([]);
      
      Alert.alert("Success", `${pendingFiles.length} new file(s) uploaded successfully!`);
    } catch (e: any) {
      console.error("Upload error:", e);
      // Update status to failed for pending files
      setFiles(prev => prev.map(f => 
        f.status === "Uploading" ? { ...f, status: "Failed" as const } : f
      ));
      Alert.alert("Upload Failed", e?.message ?? "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const getStatusColor = (status: FileItem["status"]) => {
    switch (status) {
      case "Uploaded": return "green";
      case "Failed": return "red";
      case "Uploading": return "blue";
      default: return "orange";
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
        {item.name.length > 10 ? `${item.name.substring(0, 10)}...` : item.name}
      </Text>
      <TextInput
        style={[styles.cellDescription, styles.input]}
        placeholder="Enter description"
        value={item.description}
        onChangeText={(text) => {
          if (item.status !== "Uploaded") {
            const updated = [...files];
            const fileIndex = updated.findIndex(f => f.id === item.id);
            if (fileIndex !== -1) {
              updated[fileIndex].description = text;
              setFiles(updated);
            }
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
            <Ionicons name="close-circle" size={16} color="#ff4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Add File Button */}
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={pickFile}
        disabled={uploading}
      >
        <Ionicons name="add-circle-outline" size={20} color="#007bff" />
        <Text style={styles.addButtonText}>Add New Files</Text>
      </TouchableOpacity>

      {/* File List */}
      {displayFiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-outline" size={48} color="#aaa" />
          <Text style={styles.emptyText}>No attachments yet</Text>
          <Text style={{ color: "#888", fontSize: 12, textAlign: "center" }}>
            Add your first attachment using the button above
          </Text>
        </View>
      ) : (
        <>
          {/* Table Header */}
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

      {/* Upload Button */}
      <View style={styles.footer}>
        <Text style={styles.uploadLabel}>
          Total Attachments: {displayFiles.length}
        </Text>
        <Text style={styles.uploadDesc}>
          {existingFiles.length > 0 && `(${existingFiles.length} already uploaded) `}
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
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          )}
          <Text style={styles.uploadButtonText}>
            {uploading ? "Uploading..." : `Upload New Files (${pendingCount})`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  addButtonText: { color: "#007bff", marginLeft: 6, fontWeight: "500" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  headerCellSNo: { 
    width: 50,
    fontWeight: "bold", 
    textAlign: "center", 
    fontSize: 12,
  },
  headerCellName: { 
    flex: 2,
    fontWeight: "bold", 
    textAlign: "left", 
    fontSize: 12,
    paddingLeft: 8,
  },
  headerCellDescription: { 
    flex: 3,
    fontWeight: "bold", 
    textAlign: "left", 
    fontSize: 12,
    paddingLeft: 8,
  },
  headerCellStatus: { 
    flex: 1.5,
    fontWeight: "bold", 
    textAlign: "center", 
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 8,
    alignItems: "center",
  },
  cellSNo: { 
    width: 50,
    textAlign: "center", 
    fontSize: 12,
  },
  cellName: {
    flex: 2,
    textAlign: "left",
    fontSize: 12,
    paddingLeft: 8,
  },
  cellDescription: { 
    flex: 3,
    paddingLeft: 8,
  },
  statusCell: {
    flex: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    fontSize: 12,
    paddingHorizontal: 8,
    height: 32,
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
    borderColor: "#ccc",
    borderRadius: 8,
  },
  emptyText: { fontSize: 14, fontWeight: "500", marginTop: 8 },
  footer: { 
    marginTop: 16, 
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  uploadLabel: { fontWeight: "bold", fontSize: 14 },
  uploadDesc: { fontSize: 12, color: "#555", marginBottom: 10, textAlign: "center" },
  uploadButton: {
    flexDirection: "row",
    backgroundColor: "#007bff",
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
});