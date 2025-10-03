// src/screens/AttachmentScreen.tsx
import React, { useState, useLayoutEffect } from "react";
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
import { uploadAttachments, type AttachmentItem } from "../../Api/SalesOrder_server";

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
  const [uploading, setUploading] = useState(false);

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

  // Upload Files
  const uploadFiles = async () => {
    if (files.length === 0) {
      Alert.alert("No files", "Please add at least one file to upload.");
      return;
    }

    if (uploading) return;

    setUploading(true);
    
    try {
      // Update all files to uploading status
      setFiles(prev => prev.map(f => ({ ...f, status: "Uploading" as const })));

      // Prepare attachments for upload
      const attachments: AttachmentItem[] = files.map(file => ({
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
        description: file.description,
      }));

      // Upload attachments
      await uploadAttachments(saleOrderNumber, attachments);

      // Update status to uploaded
      setFiles(prev => prev.map(f => ({ ...f, status: "Uploaded" as const })));
      
      Alert.alert("Success", `${files.length} file(s) uploaded successfully!`);
    } catch (e: any) {
      console.error("Upload error:", e);
      // Update status to failed for all files
      setFiles(prev => prev.map(f => ({ ...f, status: "Failed" as const })));
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

  const uploadedCount = files.filter(f => f.status === "Uploaded").length;
  const totalCount = files.length;

  const renderItem = ({ item, index }: { item: FileItem; index: number }) => (
    <View style={styles.row}>
      <Text style={styles.cell}>{index + 1}</Text>
      <Text style={styles.cell} numberOfLines={1} ellipsizeMode="middle">
        {item.name}
      </Text>
      <TextInput
        style={[styles.cell, styles.input]}
        placeholder="Enter description"
        value={item.description}
        onChangeText={(text) => {
          const updated = [...files];
          const fileIndex = updated.findIndex(f => f.id === item.id);
          if (fileIndex !== -1) {
            updated[fileIndex].description = text;
            setFiles(updated);
          }
        }}
        editable={!uploading && item.status === "Pending"}
      />
      <View style={[styles.cell, styles.statusCell]}>
        <Text style={{ color: getStatusColor(item.status) }}>
          {getStatusText(item.status)}
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeFile(item.id)}
        disabled={uploading || item.status === "Uploading"}
      >
        <Ionicons name="close-circle" size={20} color="#ff4444" />
      </TouchableOpacity>
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
        <Text style={styles.addButtonText}>Add Files</Text>
      </TouchableOpacity>

      {/* File List */}
      {files.length === 0 ? (
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
            <Text style={styles.headerCell}>#</Text>
            <Text style={styles.headerCell}>File Name</Text>
            <Text style={styles.headerCell}>Description</Text>
            <Text style={styles.headerCell}>Status</Text>
            <Text style={styles.headerCell}>Action</Text>
          </View>

          <FlatList
            data={files}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.fileList}
          />
        </>
      )}

      {/* Upload Button */}
      <View style={styles.footer}>
        <Text style={styles.uploadLabel}>
          Upload Attachments {totalCount > 0 && `(${uploadedCount}/${totalCount})`}
        </Text>
        <Text style={styles.uploadDesc}>
          Upload all attachments to the server for order {saleOrderNumber}
        </Text>
        <TouchableOpacity 
          style={[
            styles.uploadButton, 
            (uploading || totalCount === 0) && { opacity: 0.7 }
          ]} 
          onPress={uploadFiles}
          disabled={uploading || totalCount === 0}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          )}
          <Text style={styles.uploadButtonText}>
            {uploading ? "Uploading..." : "Upload Attachments"}
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
    padding: 8,
    marginBottom: 8,
  },
  headerCell: { 
    flex: 1, 
    fontWeight: "bold", 
    textAlign: "center", 
    fontSize: 12 
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 8,
    alignItems: "center",
  },
  cell: { 
    flex: 1, 
    textAlign: "center", 
    fontSize: 12,
    paddingHorizontal: 2,
  },
  statusCell: {
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    fontSize: 12,
    paddingHorizontal: 4,
    height: 28,
  },
  removeButton: {
    padding: 4,
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