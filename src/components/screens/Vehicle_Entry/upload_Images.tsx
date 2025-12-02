// upload_Images/UploadImages.tsx
import React from "react";
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
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { useVehicleEntry } from "../../Api/Hooks/UseVehicleEntry";

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
  const { uploadAttachments, uploadingAttachments } = useVehicleEntry();

  const [photoModalVisible, setPhotoModalVisible] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // request permissions for camera and library
  const requestCameraPermission = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === "granted";
    } catch (err) {
      console.warn("Camera permission request failed", err);
      return false;
    }
  };

  const requestMediaLibraryPermission = async () => {
    try {
      // On web/expo-managed older versions this can differ; use requestMediaLibraryPermissionsAsync
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === "granted";
    } catch (err) {
      console.warn("Media library permission request failed", err);
      return false;
    }
  };

  // Compress image to avoid 413
  const compressImage = async (uri: string, fileName?: string): Promise<Photo> => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Max 1200px width
        {
          compress: 0.7, // 70% quality
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false,
        }
      );

      return {
        uri: manipResult.uri,
        name: fileName || `photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      };
    } catch (err) {
      console.warn("Compression failed, using original", err);
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
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert("Permission required", "Camera access is required to take a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
        allowsEditing: false,
        exif: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        // Some platforms may not provide fileName; build fallback
        const fallbackName =
          (asset.fileName && asset.fileName.length > 0 && asset.fileName) || `cam_${Date.now()}.jpg`;
        const compressed = await compressImage(asset.uri, fallbackName);
        setPhotos(prev => [...prev, compressed]);
        closeModal();
      }
    } catch (err) {
      console.error("takePhoto error:", err);
      Alert.alert("Error", "Unable to take photo. Try again.");
    }
  };

  const pickFromGallery = async () => {
    try {
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) {
        Alert.alert("Permission required", "Media library access is required to pick a photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const fallbackName =
          (asset.fileName && asset.fileName.length > 0 && asset.fileName) || `gal_${Date.now()}.jpg`;
        const compressed = await compressImage(asset.uri, fallbackName);
        setPhotos(prev => [...prev, compressed]);
        closeModal();
      }
    } catch (err) {
      console.error("pickFromGallery error:", err);
      Alert.alert("Error", "Unable to pick image. Try again.");
    }
  };

  const deletePhoto = (uri: string) => {
    setPhotos(prev => prev.filter(p => p.uri !== uri));
  };

  const handleUpload = async () => {
    if (!vehicleEntryId) {
      Alert.alert("Error", "Save vehicle entry first.");
      return;
    }

    if (photos.length === 0) {
      Alert.alert("No Photos", "Add at least one photo.");
      return;
    }

    Alert.alert("Upload Photos", `Upload ${photos.length} photo(s)?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Upload",
        onPress: async () => {
          try {
            // uploadAttachments is expected to handle FormData or whatever API shape your hook expects
            const result = await uploadAttachments(vehicleEntryId!, photos);

            if (result && Array.isArray(result) && result.length > 0) {
              Alert.alert("Success", `${photos.length} photo(s) uploaded successfully!`);
              setPhotos([]);
              onUploadSuccess?.();
            } else {
              // sometimes API returns single object or status — adapt as needed in useVehicleEntry
              if (result && (result as any).success) {
                Alert.alert("Success", `${photos.length} photo(s) uploaded successfully!`);
                setPhotos([]);
                onUploadSuccess?.();
              } else {
                throw new Error("Empty or invalid response");
              }
            }
          } catch (err: any) {
            console.error("Upload error:", err);
            const message =
              typeof err === "string"
                ? err
                : err?.message ||
                  (err?.toString && err.toString()) ||
                  "Upload failed. Try again.";

            const msg =
              message.includes("413") || message.includes("Payload")
                ? "Image too large! Please try with smaller photos."
                : message;

            Alert.alert("Upload Failed", msg);
          }
        },
      },
    ]);
  };

  return (
    <>
      <View style={styles.photosSection}>
        <View style={styles.photosHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>{photos.length}</Text>
            </View>
          </View>

          <View style={styles.headerButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.uploadBtn,
                (!vehicleEntryId || photos.length === 0 || uploadingAttachments) && styles.disabledButton,
              ]}
              onPress={handleUpload}
              disabled={!vehicleEntryId || photos.length === 0 || uploadingAttachments}
            >
              {uploadingAttachments ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Upload</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.addPhotoBtn} onPress={openModal}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.buttonText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          horizontal
          data={photos}
          keyExtractor={item => item.uri}
          showsHorizontalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptySubtitle}>Tap "Add Photo" to begin</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.photoItem}>
              <View style={styles.photoContainer}>
                <Image source={{ uri: item.uri }} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoNumber}>
                  <Text style={styles.photoNumberText}>{index + 1}</Text>
                </View>
              </View>
              <View style={styles.photoInfo}>
                <Text style={styles.photoName} numberOfLines={1}>
                  {item.name}
                </Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePhoto(item.uri)}>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>

      {/* Bottom Sheet */}
      <Modal animationType="none" transparent visible={photoModalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <Animated.View style={[styles.bottomSheetContent, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.dragHandle} />
            <Text style={styles.modalTitle}>Add Photo</Text>

            <View style={styles.modalOptions}>
              <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
                <View style={[styles.optionIcon, { backgroundColor: "#E0E7FF" }]}>
                  <Ionicons name="camera" size={28} color="#6366F1" />
                </View>
                <Text style={styles.modalOptionText}>Take Photo</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption} onPress={pickFromGallery}>
                <View style={[styles.optionIcon, { backgroundColor: "#F3E8FF" }]}>
                  <Ionicons name="image" size={28} color="#8B5CF6" />
                </View>
                <Text style={styles.modalOptionText}>Choose from Gallery</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalCancel} onPress={closeModal}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// Keep all your beautiful styles here (unchanged)
const styles = StyleSheet.create({
  photosSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  photosHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  titleContainer: { flexDirection: "row", alignItems: "center" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1F2937" },
  photoCountBadge: { backgroundColor: "#6366F1", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: "center" },
  photoCountText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  headerButtonsContainer: { flexDirection: "row" },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    marginRight: 12,
  },
  addPhotoBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#10B981" },
  disabledButton: { backgroundColor: "#D1D5DB", opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", marginLeft: 8 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 40, width: 300 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: "#9CA3AF", marginTop: 4, textAlign: "center" },
  photoItem: { marginRight: 16, borderRadius: 12, overflow: "hidden", backgroundColor: "#F8FAFC", width: 160 },
  photoContainer: { position: "relative" },
  photo: { width: 160, height: 120 },
  photoNumber: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  photoNumberText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  photoInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, backgroundColor: "#fff" },
  photoName: { flex: 1, fontSize: 12, color: "#4B5563", marginRight: 8 },
  deleteBtn: { backgroundColor: "#EF4444", padding: 6, borderRadius: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalBackdrop: { flex: 1 },
  bottomSheetContent: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  dragHandle: { width: 40, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#1F2937", textAlign: "center", marginBottom: 20 },
  modalOptions: { marginBottom: 20 },
  modalOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#F1F5F9" },
  optionIcon: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalOptionText: { fontSize: 16, color: "#1F2937", fontWeight: "600", flex: 1, marginLeft: 16 },
  modalCancel: { padding: 16, alignItems: "center", borderRadius: 12, backgroundColor: "#F3F4F6" },
  modalCancelText: { fontSize: 16, color: "#374151", fontWeight: "600" },
});
