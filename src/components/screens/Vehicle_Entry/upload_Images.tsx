// upload_Images/UploadImages.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useVehicleEntry } from "../../Api/Hooks/UseVehicleEntry";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

type Photo = {
  id: string;
  uri: string;
  name: string;
  type: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
};

type Attachment = {
  path: string;
  fileName: string;
  uploadedAt: string;
  size?: number;
  mimeType: string;
  url?: string;
};

type UploadImagesProps = {
  vehicleEntryId: number | null;
  onUploadSuccess?: () => void;
  renderTrigger?: (openModal: () => void) => React.ReactNode;
};

// Reusable Message Modal
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

export default function UploadImages({
  vehicleEntryId,
  onUploadSuccess,
  renderTrigger,
}: UploadImagesProps) {
  const { uploadAttachments, fetchAttachments, uploadingAttachments, loadingAttachments } = useVehicleEntry();
  const insets = useSafeAreaInsets();

  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

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

  const screenHeight = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    if (modalVisible && vehicleEntryId) {
      loadExistingAttachments();
    }
  }, [modalVisible, vehicleEntryId]);

  const loadExistingAttachments = async () => {
    if (!vehicleEntryId) return;
    const attachments = await fetchAttachments(vehicleEntryId);
    if (attachments && Array.isArray(attachments)) {
      setExistingAttachments(attachments);
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || libraryStatus !== "granted") {
      setMsgModal({
        visible: true,
        type: "error",
        title: "Permission Denied",
        message: "Please allow access to camera and photo library.",
      });
      return false;
    }
    return true;
  };

  const compressImage = async (uri: string, fileName?: string): Promise<Omit<Photo, "id" | "status">> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        uri: result.uri,
        name: fileName || `photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      };
    } catch {
      return {
        uri,
        name: fileName || `photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      };
    }
  };

  const getNextImageName = (usedNames: Set<string>): string => {
    let i = 1;
    while (true) {
      const name = `IMG_${i}.jpg`;
      if (!usedNames.has(name)) return name;
      i++;
    }
  };

  const takePhoto = async () => {
    const hasPerm = await requestPermissions();
    if (!hasPerm) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      
      const usedNames = new Set([
        ...existingAttachments.map((a) => a.fileName),
        ...localPhotos.map((p) => p.name),
      ]);
      const nextName = getNextImageName(usedNames);
      
      const compressed = await compressImage(asset.uri, nextName);
      const newPhoto: Photo = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...compressed,
        name: compressed.name,
        status: "pending",
      };
      setLocalPhotos((prev) => [newPhoto, ...prev]);
      setActionSheetVisible(false);
    }
  };

  const pickFromGallery = async () => {
    const hasPerm = await requestPermissions();
    if (!hasPerm) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets) {
      const usedNames = new Set([
        ...existingAttachments.map((a) => a.fileName),
        ...localPhotos.map((p) => p.name),
      ]);

      const newPhotos: Photo[] = [];
      
      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        const nextName = getNextImageName(usedNames);
        usedNames.add(nextName);

        const compressed = await compressImage(asset.uri, nextName);
        newPhotos.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
          ...compressed,
          name: compressed.name,
          status: "pending",
        });
      }

      setLocalPhotos((prev) => [...newPhotos, ...prev]);
      setActionSheetVisible(false);
    }
  };

  const removeLocalPhoto = (id: string) => {
    setLocalPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpload = async () => {
    if (!vehicleEntryId) {
      setMsgModal({
        visible: true,
        type: "error",
        title: "Error",
        message: "Vehicle entry must be saved before uploading photos.",
      });
      return;
    }

    const pending = localPhotos.filter((p) => p.status === "pending");
    if (pending.length === 0) return;

    // Mark pending as uploading
    setLocalPhotos((prev) =>
      prev.map((p) => (p.status === "pending" ? { ...p, status: "uploading" } : p))
    );

    try {
      const payload = pending.map((p) => ({
        uri: p.uri,
        name: p.name,
        type: p.type,
      }));

      const uploaded = await uploadAttachments(vehicleEntryId, payload);

      // Safely handle possibly null/undefined uploaded response
      const uploadedArray = Array.isArray(uploaded) ? uploaded : [];
      const uploadedFileNames = uploadedArray
        .map((item: any) => item?.fileName || item?.name)
        .filter(Boolean);

      let successfullyUploadedCount = 0;

      setLocalPhotos((prev) => {
        return prev
          .filter((photo) => {
            if (photo.status !== "uploading") return true;

            const wasUploaded = uploadedFileNames.includes(photo.name);
            if (wasUploaded) {
              successfullyUploadedCount++;
              return false; // Remove successful
            }
            return true; // Keep for retry
          })
          .map((photo) =>
            photo.status === "uploading" ? { ...photo, status: "failed" } : photo
          );
      });

      // Refresh attachments from server
      await loadExistingAttachments();
      onUploadSuccess?.();

      if (successfullyUploadedCount > 0) {
        setMsgModal({
          visible: true,
          type: "success",
          title: "Upload Successful!",
          message: `${successfullyUploadedCount} photo${successfullyUploadedCount > 1 ? "s" : ""} uploaded successfully.`,
        });
      } else {
        // No photos uploaded successfully
        setMsgModal({
          visible: true,
          type: "error",
          title: "Upload Failed",
          message: "None of the photos were uploaded. Please try again.",
        });
      }
    } catch (err: any) {
      // Mark all uploading as failed on error
      setLocalPhotos((prev) =>
        prev.map((p) => (p.status === "uploading" ? { ...p, status: "failed" } : p))
      );

      let title = "Upload Failed";
      let message = err?.message || "Something went wrong. Please try again.";

      if (typeof err?.message === "string" && (err.message.includes("413") || err.message.includes("Payload"))) {
        title = "File Too Large";
        message = "One or more images are too large. Try smaller photos or fewer at once.";
      }

      setMsgModal({
        visible: true,
        type: "error",
        title,
        message,
      });
    }
  };

  // Combine local + server files for display
  const allFiles = [
    ...localPhotos,
    ...existingAttachments.map((a) => ({
      id: a.path + a.uploadedAt,
      name: a.fileName,
      status: "uploaded" as const,
    })),
  ];

  const pendingCount = localPhotos.filter((p) => p.status === "pending").length;
  const totalCount = allFiles.length;

  const renderItem = ({ item, index }: { item: any; index: number }) => (
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
          }}
        >
          {item.status === "uploading" ? "Uploading..." : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </Text>
        {"uri" in item && (item.status === "pending" || item.status === "failed") && (
          <TouchableOpacity onPress={() => removeLocalPhoto(item.id)} disabled={uploadingAttachments}>
            <Ionicons name="close-circle" size={22} color="#E11D48" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const openActionSheet = () => {
    setActionSheetVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeActionSheet = () => {
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setActionSheetVisible(false));
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setModalVisible(true))
      ) : (
        <TouchableOpacity style={styles.mainAddBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="attach-outline" size={26} color="#1976D2" />
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={false} statusBarTranslucent>
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <StatusBar style="dark" />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </TouchableOpacity>
            <Text style={styles.title}>
              Attachments{totalCount > 0 ? ` (${totalCount})` : ""}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.buttonBar}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={openActionSheet}
              disabled={uploadingAttachments}
            >
              <Ionicons name="add-circle-outline" size={24} color="#2196F3" />
              <Text style={styles.addText}>Add Photos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.uploadBtn,
                (uploadingAttachments || pendingCount === 0) && styles.disabled,
              ]}
              onPress={handleUpload}
              disabled={uploadingAttachments || pendingCount === 0}
            >
              {uploadingAttachments ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                  <Text style={styles.uploadText}>
                    Upload{pendingCount > 0 ? ` (${pendingCount})` : ""}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {loadingAttachments ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          ) : allFiles.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={70} color="#CFD8DC" />
              <Text style={styles.emptyText}>No photos yet</Text>
              <Text style={styles.emptySub}>Tap "Add Photos" to begin</Text>
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
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            </>
          )}

          <Modal visible={actionSheetVisible} transparent animationType="fade" statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={closeActionSheet}>
              <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: Math.max(insets.bottom, 20) }]}>
                <Text style={styles.sheetTitle}>Add Photo</Text>
                <TouchableOpacity style={styles.sheetItem} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={26} color="#5856D6" />
                  <Text style={styles.sheetText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetItem} onPress={pickFromGallery}>
                  <Ionicons name="images-outline" size={26} color="#16A34A" />
                  <Text style={styles.sheetText}>Choose from Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetItem, styles.cancel]} onPress={closeActionSheet}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </Animated.View>
            </Pressable>
          </Modal>
        </View>
      </Modal>

      <MessageModal
        visible={msgModal.visible}
        type={msgModal.type}
        title={msgModal.title}
        message={msgModal.message}
        onClose={() => setMsgModal((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
}

// Styles
const styles = StyleSheet.create({
  mainAddBtn: {
    padding: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

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
    textAlign: "center",
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 8,
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
    // paddingBottom will be set dynamically via style prop
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
