// upload_images/UploadImages.tsx
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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

type Photo = { uri: string; name: string };

type UploadImagesProps = {
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function UploadImages({ photos, setPhotos }: UploadImagesProps) {
  const [photoModalVisible, setPhotoModalVisible] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
    }).start(() => {
      setPhotoModalVisible(false);
    });
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      const fileName = `photo_${Date.now()}.jpg`;
      setPhotos((prev) => [{ uri, name: fileName }, ...prev]);
      closeModal();
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const uploadImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need gallery permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      const fileName = `image_${Date.now()}.jpg`;
      setPhotos((prev) => [{ uri, name: fileName }, ...prev]);
      closeModal();
    } catch (err) {
      console.error("Gallery error:", err);
    }
  };

  const deletePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  };

  const uploadToServer = () => {
    if (photos.length === 0) {
      alert("No photos to upload!");
      return;
    }
    console.log("Uploading photos to server:", photos);
    // Add your upload logic here
    alert(`${photos.length} photos ready for upload!`);
  };

  return (
    <>
      {/* Photos Section */}
      <View style={styles.photosSection}>
        <View style={styles.photosHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>{photos.length}</Text>
            </View>
          </View>

          <View style={styles.headerButtonsContainer}>
            {/* Upload Button */}
            <TouchableOpacity 
              style={[
                styles.uploadBtn, 
                photos.length === 0 && styles.disabledButton
              ]} 
              onPress={uploadToServer}
              disabled={photos.length === 0}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={photos.length === 0 ? "#9CA3AF" : "#FFFFFF"} />
              <Text style={[
                styles.buttonText,
                photos.length === 0 && styles.disabledButtonText
              ]}>
                Upload
              </Text>
            </TouchableOpacity>

            {/* Add Photo Button */}
            <TouchableOpacity
              style={styles.addPhotoBtn}
              onPress={openModal}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          horizontal
          data={photos}
          keyExtractor={(item) => item.uri}
          showsHorizontalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No photos yet</Text>
              <Text style={styles.emptySubtitle}>Add photos to get started</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.photoItem}>
              <View style={styles.photoContainer}>
                <Image source={{ uri: item.uri }} style={styles.photo} />
                <View style={styles.photoNumber}>
                  <Text style={styles.photoNumberText}>{index + 1}</Text>
                </View>
              </View>
              <View style={styles.photoInfo}>
                <Text style={styles.photoName} numberOfLines={1}>
                  {item.name}
                </Text>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deletePhoto(item.uri)}
                >
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={photoModalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeModal}
          />
          <Animated.View 
            style={[
              styles.bottomSheetContent,
              {
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Drag Handle */}
            <View style={styles.dragHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Photo</Text>
              <Text style={styles.modalSubtitle}>Choose how you want to add photos</Text>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
                <View style={[styles.optionIcon, { backgroundColor: '#E0E7FF' }]}>
                  <Ionicons name="camera" size={28} color="#6366F1" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.modalOptionText}>Take Photo</Text>
                  <Text style={styles.modalOptionDescription}>Use your camera to capture a new photo</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption} onPress={uploadImage}>
                <View style={[styles.optionIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="image" size={28} color="#8B5CF6" />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.modalOptionText}>Choose from Gallery</Text>
                  <Text style={styles.modalOptionDescription}>Select an existing photo from your gallery</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={closeModal}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  photosSection: { 
    marginTop: 24, 
    paddingTop: 20, 
    borderTopWidth: 1, 
    borderTopColor: "#F3F4F6",
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  photosHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: "#1F2937",
    letterSpacing: -0.5,
  },
  photoCountBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  headerButtonsContainer: { 
    flexDirection: "row", 
    gap: 12,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#6366F1",
    shadowColor: "#6366F1",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: "#F3F4F6",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: { 
    color: "#FFFFFF", 
    fontSize: 14, 
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  disabledButtonText: {
    color: "#9CA3AF",
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    width: 300,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  photoItem: { 
    marginRight: 16, 
    borderRadius: 12, 
    overflow: "hidden", 
    backgroundColor: "#F8FAFC",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    width: 160,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: { 
    width: 160, 
    height: 120,
  },
  photoNumber: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNumberText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  photoInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
  },
  photoName: { 
    flex: 1, 
    fontSize: 12, 
    color: "#4B5563", 
    marginRight: 8,
    fontWeight: '500',
  },
  deleteBtn: { 
    backgroundColor: "#EF4444", 
    padding: 6, 
    borderRadius: 6,
    shadowColor: "#EF4444",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  // Bottom Sheet Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBackdrop: {
    flex: 1,
  },
  bottomSheetContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: "700", 
    textAlign: "center", 
    marginBottom: 4,
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOptions: {
    gap: 12,
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  modalOptionText: { 
    fontSize: 16, 
    color: "#1F2937",
    fontWeight: '600',
    marginBottom: 2,
  },
  modalOptionDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalCancel: { 
    padding: 16, 
    alignItems: "center", 
    borderRadius: 12, 
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: { 
    fontSize: 16, 
    color: "#374151", 
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});