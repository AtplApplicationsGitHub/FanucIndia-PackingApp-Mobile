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
  Platform,
  StatusBar,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useKeyboardDisabled } from "../../utils/keyboard";

import {
  uploadAttachments,
  fetchExistingAttachments,
  type AttachmentItem,
  updateAttachmentDescription,
} from "../../Api/Hooks/UseSalesOrder";

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

export default function Attachments() {
  const navigation = useNavigation();
  const [keyboardDisabled] = useKeyboardDisabled();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Attachments",
    });
  }, [navigation]);

  const [soNumber, setSoNumber] = useState("");
  const [activeSoNumber, setActiveSoNumber] = useState("");

  const [files, setFiles] = useState<FileItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Status and scanner Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Action Sheet Modal state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  // Camera permissions and state for barcode scanning
  const [permission, requestPermission] = useCameraPermissions();
  const [scanModalVisible, setScanModalVisible] = useState(false);

  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const loadExisting = async (soNo: string) => {
    if (!soNo.trim()) {
      Alert.alert("Error", "Please enter an SO number");
      return;
    }
    setIsLoading(true);
    setActiveSoNumber(soNo);
    try {
      const ex = await fetchExistingAttachments(soNo);
      setExistingAttachments(ex);
      setFiles([]);
    } catch (e: any) {
      console.error("Failed to load existing attachments:", e);
      Alert.alert(
        "Error",
        "Failed to load existing attachments. Proceeding without them."
      );
      setExistingAttachments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openScanner = async () => {
    try {
      if (!permission) {
        const res = await requestPermission();
        if (!res.granted) {
          return Alert.alert("Permission Required", "Allow camera access to scan.");
        }
      } else if (!permission.granted) {
        if (!permission.canAskAgain) {
          return Alert.alert("Camera Disabled", "Please enable camera access.");
        }
        const res = await requestPermission();
        if (!res.granted) {
          return Alert.alert("Permission Denied", "Camera permission is required.");
        }
      }
      setScanModalVisible(true);
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "Failed to access camera permission.");
    }
  };

  const closeScanner = () => {
    setScanModalVisible(false);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const value = (result?.data ?? "").trim();
    if (!value) return;
    setSoNumber(value.toUpperCase());
    setScanModalVisible(false);
    loadExisting(value.toUpperCase());
  };

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

  /* Action Sheet Functions */
  const openActionSheet = () => {
    if (!activeSoNumber) {
      Alert.alert("Missing SO Number", "Please fetch or enter an SO number first.");
      return;
    }
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

  const requestImagePermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || libraryStatus !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Please allow access to camera and photo library."
      );
      return false;
    }
    return true;
  };

  const compressImage = async (uri: string, fileName?: string) => {
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

  const takePhoto = async () => {
    const hasPerm = await requestImagePermissions();
    if (!hasPerm) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        Alert.alert("File Too Large", `Photo exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
        return;
      }
      
      const nextName = getUniqueName(`IMG_${Math.floor(Date.now() / 1000)}.jpg`);
      const compressed = await compressImage(asset.uri, nextName);
      
      const newPhoto: FileItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: compressed.name,
        description: "",
        status: "Pending",
        uri: compressed.uri,
        mimeType: compressed.type,
        timestamp: Date.now(),
      };
      
      setFiles((prev) => [newPhoto, ...prev]);
      closeActionSheet();
    }
  };

  const pickFromGallery = async () => {
    const hasPerm = await requestImagePermissions();
    if (!hasPerm) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      const newPhotos: FileItem[] = [];
      const tooBig: any[] = [];
      const selectedAssets = result.assets.slice(0, 5);
      
      for (let i = 0; i < selectedAssets.length; i++) {
        const asset = selectedAssets[i];

        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
          tooBig.push(asset);
          continue;
        }

        const nextName = getUniqueName(`IMG_${Math.floor(Date.now() / 1000)}_${i}.jpg`);
        const compressed = await compressImage(asset.uri, nextName);
        
        newPhotos.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          name: compressed.name,
          description: "",
          status: "Pending",
          uri: compressed.uri,
          mimeType: compressed.type,
          timestamp: Date.now() + i,
        });
      }

      if (tooBig.length > 0) {
        Alert.alert(
          "Files Too Large",
          `${tooBig.length} file(s) exceeded the ${MAX_FILE_SIZE_MB} MB limit and were skipped.`
        );
      }

      if (newPhotos.length > 0) {
        setFiles((prev) => [...newPhotos, ...prev]);
        closeActionSheet();
      }
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["*/*"],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets) {
        return;
      }

      const assets = result.assets;
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
          id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
          name: uniqueName,
          description: "",
          status: "Pending",
          uri: file.uri,
          mimeType: file.mimeType ?? "application/octet-stream",
          timestamp: Date.now() + index,
        };
      });

      setFiles((prev) => [...newFiles, ...prev]);
      closeActionSheet();
    } catch (error: any) {
      console.error("Document picker error:", error);
      Alert.alert("Error", error.message || "Unable to pick document(s)");
    }
  };

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === "Pending");
    if (pendingFiles.length === 0) {
      Alert.alert("No new files", "Please add at least one new file to upload.");
      return;
    }

    if (!activeSoNumber) return;

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

      await uploadAttachments(activeSoNumber, attachments);
      
      const ex = await fetchExistingAttachments(activeSoNumber);
      setExistingAttachments(ex);
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
      if (activeSoNumber) {
        const ex = await fetchExistingAttachments(activeSoNumber);
        setExistingAttachments(ex);
      }
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
            style={[styles.cellDescription, styles.inputNormal]}
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
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Search Input mimicking label_Print.tsx */}
      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <View style={styles.inputFieldWrapper}>
            <TextInput
              value={soNumber}
              onChangeText={setSoNumber}
              placeholder={keyboardDisabled ? "Scan SO..." : "Enter or scan"}
              placeholderTextColor="#9ca3af"
              style={styles.input}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={() => loadExisting(soNumber)}
              editable={!isLoading}
              showSoftInputOnFocus={!keyboardDisabled}
            />
            <Pressable
              onPress={openScanner}
              disabled={isLoading}
              style={styles.scanBtn}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={20}
                color={isLoading ? "#ccc" : "#3b82f6"}
              />
            </Pressable>
          </View>
          <TouchableOpacity
            onPress={() => loadExisting(soNumber)}
            disabled={isLoading || !soNumber.trim()}
            style={[
              styles.iconBtn,
              { backgroundColor: "#10b981" },
              (isLoading || !soNumber.trim()) && styles.btnDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Buttons */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.fixedButton, styles.addButton, uploading && { opacity: 0.7 }]}
          onPress={openActionSheet}
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
          disabled={uploading || pendingCount === 0 || !activeSoNumber}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.fixedButtonTextUpload}>
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
            {activeSoNumber
              ? "Tap \"New Files\" to add attachments"
              : "Scan or fetch an SO first to add files"}
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

      {/* Action Sheet Modal */}
      <Modal visible={actionSheetVisible} transparent animationType="fade" statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={closeActionSheet}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Attachment</Text>
            <TouchableOpacity style={styles.sheetItem} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={26} color="#5856D6" />
              <Text style={styles.sheetText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={26} color="#16A34A" />
              <Text style={styles.sheetText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetItem} onPress={pickDocument}>
              <Ionicons name="document-attach-outline" size={26} color="#F59E0B" />
              <Text style={styles.sheetText}>Choose Document</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetItem, styles.cancel]} onPress={closeActionSheet}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Fullscreen Camera Modal */}
      <Modal
        visible={scanModalVisible}
        onRequestClose={closeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
      >
        <StatusBar hidden />
        <View style={styles.fullscreenCameraWrap}>
          <CameraView
            style={styles.fullscreenCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "qr",
                "code128",
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code39",
                "codabar",
                "code93",
                "pdf417",
                "datamatrix",
              ],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenTitle}>Scan SO</Text>
            <Pressable onPress={closeScanner} style={styles.fullscreenCloseBtn}>
              <Text style={styles.closeBtnText}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.fullscreenBottomBar}>
            <Text style={styles.fullscreenHint}>Align codes within frame</Text>
          </View>
          <View style={styles.focusFrameContainer} pointerEvents="none">
            <View style={styles.focusFrame} />
          </View>
        </View>
      </Modal>

      {/* Status Modal */}
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

  /* Input Card mimics label_Print's SO Input */
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  inputFieldWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingLeft: 6,
    height: 36,
  },
  input: { flex: 1, fontSize: 13, color: "#1f2937", paddingVertical: 0 },
  scanBtn: { padding: 6 },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  btnDisabled: { opacity: 0.6 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  fixedButton: {
    width: BUTTON_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  fixedButtonText: { marginLeft: 6, fontWeight: "500", fontSize: 14, color: "#2196F3" },
  fixedButtonTextUpload: { marginLeft: 6, fontWeight: "500", fontSize: 14, color: "#fff" },
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
  inputNormal: { fontSize: 12, paddingHorizontal: 8, height: 40 },
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

  /* Base Modal */
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "#fff", padding: 24, borderRadius: 12, alignItems: "center", width: "85%", maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginTop: 12, marginBottom: 8 },
  modalMessage: { fontSize: 14, textAlign: "center", color: "#555", lineHeight: 20, marginBottom: 20 },
  modalButton: { backgroundColor: "#2196F3", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  modalButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },

  /* Action Sheet Modal */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#DFE4EA",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    color: "#263238",
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  sheetText: { marginLeft: 16, fontSize: 16, color: "#263238", fontWeight: "500" },
  cancel: {
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    paddingTop: 16,
  },
  cancelText: {
    textAlign: "center",
    fontSize: 16,
    color: "#E11D48",
    fontWeight: "600",
  },

  /* Fullscreen Camera Modal Styles */
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.select({ ios: 44, android: 16 }),
    left: 16,
    right: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  fullscreenCloseBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closeBtnText: { fontWeight: "700", color: "#000", fontSize: 13 },
  fullscreenBottomBar: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  fullscreenHint: { color: "#ccc", fontSize: 12 },
  focusFrameContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  focusFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 20,
  },
});
