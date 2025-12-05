// src/upload_Images/UploadImages.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useVehicleEntry, Attachment } from "../../Api/Hooks/UseVehicleEntry";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Photo = {
  uri: string;
  name: string;
  type: string;
};

type UploadImagesProps = {
  vehicleEntryId: number | null;
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
  onUploadSuccess?: () => void;
};

export default function UploadImages({
  vehicleEntryId,
  photos,
  setPhotos,
  onUploadSuccess,
}: UploadImagesProps) {
  const { uploadAttachments, uploadingAttachments, fetchAttachments } =
    useVehicleEntry();

  useVehicleEntry();
  const [photoModalVisible, setPhotoModalVisible] = React.useState(false);
  const [loadingExisting, setLoadingExisting] = React.useState(false);
  const [existingAttachments, setExistingAttachments] = React.useState<
    Attachment[]
  >([]);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Permissions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  // Compress Image
  const compressImage = async (
    uri: string,
    fileName?: string
  ): Promise<Photo> => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        uri: manipResult.uri,
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

  const openModal = () => {
    setPhotoModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setPhotoModalVisible(false));
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Camera access is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const compressed = await compressImage(asset.uri, name);
      setPhotos((prev) => [...prev, compressed]);
      closeModal();
    }
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Gallery access is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const name = asset.fileName || `gallery_${Date.now()}.jpg`;
      const compressed = await compressImage(asset.uri, name);
      setPhotos((prev) => [...prev, compressed]);
      closeModal();
    }
  };

  const deletePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const handleUpload = async () => {
    if (!vehicleEntryId || photos.length === 0) return;

    try {
      const result = await uploadAttachments(vehicleEntryId, photos);

      if (result && (Array.isArray(result) ? result.length >= 0 : true)) {
        Alert.alert("Success", `${photos.length} photo(s) uploaded!`);
        setPhotos([]);
        await refreshExisting();
        onUploadSuccess?.();
      }
    } catch (err: any) {
      const msg = err?.message?.includes("413")
        ? "Image too large! Try smaller photos."
        : "Upload failed. Please try again.";
      Alert.alert("Upload Failed", msg);
    }
  };

  const refreshExisting = async () => {
    if (!vehicleEntryId) return;
    setLoadingExisting(true);
    try {
      const fetched = await fetchAttachments(vehicleEntryId);
      if (fetched) setExistingAttachments(fetched);
    } catch (err) {
      console.error("Failed to refresh attachments", err);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (vehicleEntryId) {
      refreshExisting();
    } else {
      setExistingAttachments([]);
    }
  }, [vehicleEntryId]);

  const openAttachment = async (url: string) => {
    if (!url) {
      Alert.alert("Error", "No URL available.");
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert("Cannot open", "Device cannot open this file.");
    }
  };

  const hasNewPhotos = photos.length > 0;
  const hasExistingPhotos = existingAttachments.length > 0;

  return (
    <>
      <View style={styles.container}>
        {vehicleEntryId && (
          <View style={styles.actionButtons}>
            {hasNewPhotos && (
              <TouchableOpacity
                style={[
                  styles.uploadBtn,
                  uploadingAttachments && styles.disabledButton,
                ]}
                onPress={handleUpload}
                disabled={uploadingAttachments}
              >
                {uploadingAttachments ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.btnText}>Upload ({photos.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.addBtn} onPress={openModal}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.btnText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Existing Photos from Server */}
        {loadingExisting ? (
          <ActivityIndicator style={{ marginVertical: 20 }} />
        ) : hasExistingPhotos ? (
          <View style={styles.listContainer}>
            <Text style={styles.listLabel}>
              Uploaded Photos ({existingAttachments.length})
            </Text>
            <FlatList
              horizontal
              data={existingAttachments}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.fileItem}
                  onPress={() => openAttachment(item.url)}
                >
                  <Ionicons name="document-outline" size={32} color="#6366F1" />
                  <Text style={styles.fileName} numberOfLines={2}>
                    {item.fileName}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        {/* New Photos (Pending Upload) */}
        {hasNewPhotos ? (
          <View style={styles.listContainer}>
            <Text style={styles.listLabel}>
              Ready to Upload ({photos.length})
            </Text>
            <FlatList
              horizontal
              data={photos}
              keyExtractor={(item) => item.uri}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.fileItemSimple}>
                  <Ionicons name="image-outline" size={32} color="#6366F1" />
                  <Text style={styles.fileNameSimple} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteIconSimple}
                    onPress={() => deletePhoto(item.uri)}
                  >
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        ) : vehicleEntryId ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={60} color="#D1D5DB" />
            <Text style={styles.emptyText}>No photos added yet</Text>
            <Text style={styles.emptySubText}>
              Tap "Add Photo" to get started
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.savePrompt}>
              Save the entry first to add photos
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        transparent
        visible={photoModalVisible}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
          />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Add Photo</Text>

            <TouchableOpacity style={styles.option} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={28} color="#6366F1" />
              <Text style={styles.optionText}>Take Photo</Text>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={pickFromGallery}>
              <Ionicons name="image-outline" size={28} color="#8B5CF6" />
              <Text style={styles.optionText}>Choose from Gallery</Text>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 16,
    gap: 12,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 8,
  },
  listContainer: {
    marginBottom: 20,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  fileItem: {
    width: 120,
    alignItems: "center",
    marginRight: 16,
    position: "relative",
  },
  thumbnail: {
    width: 120,
    height: 90,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  fileName: {
    marginTop: 8,
    fontSize: 12,
    color: "#4B5563",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  deleteIcon: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
    fontWeight: "600",
  },
  emptySubText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 6,
  },
  savePrompt: {
    fontSize: 15,
    color: "#EF4444",
    fontWeight: "500",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
    color: "#1F2937",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    marginBottom: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 17,
    marginLeft: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  cancelBtn: {
    padding: 16,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 17,
    color: "#374151",
    fontWeight: "600",
  },

  fileItemSimple: {
    width: 120,
    alignItems: "center",
    marginRight: 16,
    position: "relative",
    paddingTop: 8,
  },
  fileNameSimple: {
    marginTop: 8,
    fontSize: 12,
    color: "#4B5563",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  deleteIconSimple: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 11,
  },
});
