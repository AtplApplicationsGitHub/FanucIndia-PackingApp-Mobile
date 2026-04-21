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
  Vibration,
} from "react-native";
import { Audio } from "expo-av";
import { useNavigation } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeyboardDisabled } from "../../utils/keyboard";

import {
  uploadAttachments,
  fetchExistingAttachments,
  type AttachmentItem,
  updateAttachmentDescription,
} from "../../Api/Hooks/UseSalesOrder";

import {
  fetchSoVariants,
  uploadMobileAttachments,
  fetchMobileAttachments,
  type SoVariant,
} from "../../Api/Hooks/UseAttachments";
import {
  saveAttachmentSession,
  getAttachmentSession,
  clearAttachmentSession,
} from "../../Storage/Attachments_Storage";
import { useFocusEffect } from "@react-navigation/native";

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

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_FILE_SIZE_MB = 500;
const BUTTON_WIDTH = 140;
const DEBOUNCE_DELAY = 800; // ms

export default function Attachments() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const inputRef = useRef<TextInput>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Attachments",
    });
  }, [navigation]);

  const [soNumber, setSoNumber] = useState("");
  const [activeSoNumber, setActiveSoNumber] = useState("");

  // Global keyboard toggle
  const [keyboardDisabled, setKeyboardDisabled] = useKeyboardDisabled();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Status and scanner Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Variant (OBD) selection state
  const [variants, setVariants] = useState<SoVariant[]>([]);
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | string | null>(null);
  const [selectedObdNumber, setSelectedObdNumber] = useState("");

  // Action Sheet Modal state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  // Camera permissions and state for barcode scanning
  const [permission, requestPermission] = useCameraPermissions();
  const [scanModalVisible, setScanModalVisible] = useState(false);

  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const initialLoadRef = useRef(true);

  // 1. Initial Load from Persistent Storage
  useEffect(() => {
    const init = async () => {
      const saved = await getAttachmentSession();
      if (saved) {
        setSoNumber(saved.soNumber);
        setActiveSoNumber(saved.activeSoNumber);
        setSelectedVariantId(saved.selectedVariantId);
        setSelectedObdNumber(saved.selectedObdNumber);
        setExistingAttachments(saved.existingAttachments);
        setFiles(saved.pendingFiles);
      }
      initialLoadRef.current = false;
    };
    init();
  }, []);

  // 2. Persist state changes (Debounced)
  useEffect(() => {
    if (initialLoadRef.current) return;
    const timeout = setTimeout(async () => {
      await saveAttachmentSession({
        soNumber,
        activeSoNumber,
        selectedVariantId,
        selectedObdNumber,
        existingAttachments,
        pendingFiles: files,
      });
    }, 1000); // 1-second debounce to prevent UI lag during typing

    return () => clearTimeout(timeout);
  }, [soNumber, activeSoNumber, selectedVariantId, selectedObdNumber, existingAttachments, files]);

  // 3. Auto-focus on entry
  useFocusEffect(
    React.useCallback(() => {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 300); // 300ms delay to ensure navigation transition is smooth
      return () => clearTimeout(timeout);
    }, [])
  );

  // 4. Persistence Focus (Refocus if blurred in Scan Only mode)
  useEffect(() => {
    if (keyboardDisabled && !modalVisible && !variantModalVisible && !scanModalVisible && !actionSheetVisible && !isLoading && !uploading) {
        const timer = setTimeout(() => {
            if (navigation.isFocused()) {
                inputRef.current?.focus();
            }
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [keyboardDisabled, modalVisible, variantModalVisible, scanModalVisible, actionSheetVisible, isLoading, uploading, navigation]);

  const handleBlur = () => {
    if (keyboardDisabled && !modalVisible && !variantModalVisible && !scanModalVisible && !actionSheetVisible && !isLoading && !uploading) {
        setTimeout(() => {
            if (navigation.isFocused() && !modalVisible && !variantModalVisible && !scanModalVisible && !actionSheetVisible && !isLoading && !uploading) {
                inputRef.current?.focus();
            }
        }, 100);
    }
  };

  const triggerVibration = async (duration = 400) => {
    try {
      const vResult = await AsyncStorage.getItem("vibrationEnabled");
      if (vResult === null || vResult === "true") {
        Vibration.vibrate(duration);
      }
    } catch (e) {
      console.log("Vibration error", e);
    }
  };

  const playErrorSound = async () => {
    try {
      const sResult = await AsyncStorage.getItem("soundEnabled");
      if (sResult !== null && sResult !== "true") return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/sounds/error.mp3")
      );
      await sound.playAsync();
      setTimeout(async () => {
        await sound.stopAsync();
        await sound.unloadAsync();
      }, 1000);
    } catch (e) {
      console.log("Sound error", e);
    }
  };

  const clearSession = async () => {
    setSoNumber("");
    setActiveSoNumber("");
    setSelectedVariantId(null);
    setSelectedObdNumber("");
    setExistingAttachments([]);
    setFiles([]);
    await clearAttachmentSession();
    inputRef.current?.focus();
  };

  const loadExisting = async (soNo: string) => {
    if (!soNo.trim()) {
      playErrorSound();
      triggerVibration(400);
      setModalTitle("Input Required");
      setModalMessage("Please enter or scan a Sales Order number first.");
      setModalVisible(true);
      return;
    }
    if (isLoading || uploading) return; // Prevent concurrent calls

    setIsLoading(true);
    setActiveSoNumber(soNo.trim().toUpperCase());
    setVariants([]);
    setSelectedVariantId(null);
    setSelectedObdNumber("");

    try {
      // 1. Fetch SO variants (OBDs)
      const vars = await fetchSoVariants(soNo);
      setVariants(vars);

      if (vars.length === 0) {
        playErrorSound();
        triggerVibration(400);
        setModalTitle("Invalid SO");
        setModalMessage("Please check the SO number again");
        setModalVisible(true);
        setExistingAttachments([]);
        setSoNumber("");
        setTimeout(() => inputRef.current?.focus(), 100);
      } else if (vars.length === 1) {
        // Only one OBD, auto-select it
        await handleSelectVariant(vars[0]);
      } else {
        // Multiple OBDs, show selection popup
        setVariantModalVisible(true);
      }
      setFiles([]);
    } catch (e: any) {
      console.error("Failed to load SO variants:", e);
      playErrorSound();
      triggerVibration(400);
      setModalTitle("Invalid SO");
      setModalMessage("Please check the SO number again");
      setModalVisible(true);
      setExistingAttachments([]);
      setSoNumber("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVariant = async (variant: SoVariant) => {
    setVariantModalVisible(false);
    setSelectedVariantId(variant.id);
    setSelectedObdNumber(variant.outboundDelivery);
    
    // If we're already loading (e.g. called from loadExisting), don't set it again but don't return either
    const wasLoading = isLoading;
    if (!wasLoading) setIsLoading(true);
    
    try {
      const ex = await fetchMobileAttachments(variant.id);
      setExistingAttachments(ex);
    } catch (e: any) {
      console.error("Failed to load attachments:", e);
      setModalTitle("Fetch Failed");
      setModalMessage("Failed to load existing attachments for this delivery variant.");
      setModalVisible(true);
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
      setModalTitle("Error");
      setModalMessage("Failed to access camera permission.");
      setModalVisible(true);
    }
  };

  const closeScanner = () => {
    setScanModalVisible(false);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (isLoading) return; // Prevent concurrent calls if scanner fires rapidly
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

  const getUniqueName = (baseName: string, batchNames: string[] = []): string => {
    let name = baseName;
    let counter = 1;
    const exists = (n: string) => displayFiles.some((f) => f.name === n) || batchNames.includes(n);

    while (exists(name)) {
      const extIndex = baseName.lastIndexOf(".");
      const ext = extIndex > -1 ? baseName.slice(extIndex) : "";
      const nameWithoutExt =
        extIndex > -1 ? baseName.slice(0, extIndex) : baseName;
      name = `${nameWithoutExt}-${counter}${ext}`;
      counter++;
    }
    return name;
  };

  const getNextPhotoName = (offset = 0, batchNames: string[] = []) => {
    let maxCounter = 0;
    const regex = /^IMG_(\d+)\.jpg$/i;
    const allNames = [...displayFiles.map(f => f.name), ...batchNames];

    allNames.forEach((n) => {
      const match = n.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxCounter) maxCounter = num;
      }
    });
    return `IMG_${maxCounter + 1 + offset}.jpg`;
  };

  /* Action Sheet Functions */
  const openActionSheet = () => {
    if (!activeSoNumber) {
      setModalTitle("Missing SO Number");
      setModalMessage("Please fetch or enter an SO number first.");
      setModalVisible(true);
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
      setModalTitle("Permission Denied");
      setModalMessage("Please allow access to camera and photo library.");
      setModalVisible(true);
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
        setModalTitle("File Too Large");
        setModalMessage(`Photo exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
        setModalVisible(true);
        return;
      }
      
      const nextName = getNextPhotoName();
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
      setIsLoading(true);
      const assetsArr = result.assets;
      const isLimitExceeded = assetsArr.length > 5;
      
      // Close sheet first to avoid Modal conflict
      closeActionSheet();

      // Process with delay for smooth transition and Modal visibility
      setTimeout(async () => {
        try {
          const newPhotos: FileItem[] = [];
          const tooBig: any[] = [];
          const selectedAssets = assetsArr.slice(0, 5);
          const batchNames: string[] = [];
          
          for (let i = 0; i < selectedAssets.length; i++) {
            const asset = selectedAssets[i];
            if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
              tooBig.push(asset);
              continue;
            }

            const nextName = getNextPhotoName(i, batchNames);
            batchNames.push(nextName);
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

          if (isLimitExceeded) {
            setModalTitle("Limit Reached");
            setModalMessage("Only 5 photos can be selected at once. Taking the first 5.");
            setModalVisible(true);
          } else if (tooBig.length > 0) {
            setModalTitle("Files Too Large");
            setModalMessage(`${tooBig.length} file(s) exceeded the ${MAX_FILE_SIZE_MB} MB limit and were skipped.`);
            setModalVisible(true);
          }

          if (newPhotos.length > 0) {
            setFiles((prev) => [...newPhotos, ...prev]);
          }
        } finally {
          setIsLoading(false);
        }
      }, 600);
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

      setIsLoading(true);
      const assetsArr = result.assets;
      const isLimitExceeded = assetsArr.length > 3;
      
      closeActionSheet();

      setTimeout(() => {
        try {
          const selectedAssets = assetsArr.slice(0, 3);
          const largeFiles = selectedAssets.filter(
            (file) => file.size != null && file.size > MAX_FILE_SIZE
          );
          const validFiles = selectedAssets.filter(
            (file) => file.size == null || file.size <= MAX_FILE_SIZE
          );

          if (isLimitExceeded) {
            setModalTitle("Limit Reached");
            setModalMessage("Only 3 documents can be selected at once. Taking the first 3.");
            setModalVisible(true);
          } else if (largeFiles.length > 0) {
            setModalTitle(`File Too Large (> ${MAX_FILE_SIZE_MB} MB)`);
            setModalMessage(`${largeFiles.length} file(s) were skipped due to size.`);
            setModalVisible(true);
          }

          if (validFiles.length > 0) {
            const batchNames: string[] = [];
            const newFiles: FileItem[] = validFiles.map((file, index) => {
              const safeName = file.name || `File-${Date.now()}-${index}`;
              const uniqueName = getUniqueName(safeName, batchNames);
              batchNames.push(uniqueName);

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
          } else if (!isLimitExceeded && largeFiles.length === 0) {
            setModalTitle("No Files Selected");
            setModalMessage("No valid files were picked.");
            setModalVisible(true);
          }
        } finally {
          setIsLoading(false);
        }
      }, 600);
    } catch (error: any) {
      console.error("Document picker error:", error);
      setIsLoading(false);
      setModalTitle("Picker Error");
      setModalMessage(error.message || "Unable to pick document(s)");
      setModalVisible(true);
    }
  };

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === "Pending");
    if (pendingFiles.length === 0) {
      setModalTitle("No new files");
      setModalMessage("Please add at least one new file to upload.");
      setModalVisible(true);
      return;
    }

    if (!activeSoNumber) return;

    if (!selectedVariantId) {
      setModalTitle("Wait");
      setModalMessage("Please select an OBD/Sales Order variant first.");
      setModalVisible(true);
      return;
    }

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

      await uploadMobileAttachments(selectedVariantId, attachments);
      
      // Refresh current attachments
      if (selectedVariantId) {
          const ex = await fetchMobileAttachments(selectedVariantId);
          setExistingAttachments(ex);
      } else {
        const currentFiles = await fetchSoVariants(activeSoNumber);
        if (currentFiles.length === 1) {
            await handleSelectVariant(currentFiles[0]);
        }
      }

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

  const removeFile = React.useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updateFileDescription = React.useCallback((id: string, newDescription: string) => {
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
  }, [files]);

  const saveDescription = React.useCallback(async (dbId: string, description: string, itemId: string) => {
    if (savingIds.has(itemId)) return;

    setSavingIds((prev) => new Set(prev).add(itemId));

    try {
      await updateAttachmentDescription(dbId, description.trim());
    } catch (error: any) {
      console.error("Failed to update description:", error);
      if (selectedVariantId) {
        try {
          const ex = await fetchMobileAttachments(selectedVariantId);
          setExistingAttachments(ex);
        } catch (innerError) {
          console.error("Failed to refresh after description error:", innerError);
        }
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
  }, [savingIds, selectedVariantId]);

  const handleDescriptionChange = React.useCallback((item: FileItem, text: string) => {
    updateFileDescription(item.id, text);

    if (item.status === "Uploaded" && item.dbId) {
      if (debounceTimerRef.current[item.id]) {
        clearTimeout(debounceTimerRef.current[item.id]);
      }

      debounceTimerRef.current[item.id] = setTimeout(() => {
        saveDescription(item.dbId!, text, item.id);
      }, DEBOUNCE_DELAY);
    }
  }, [updateFileDescription, saveDescription]);

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

  const renderItem = React.useCallback(({ item, index }: { item: FileItem; index: number }) => {
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
  }, [savingIds, uploading, handleDescriptionChange, removeFile]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Search Input mimicking label_Print.tsx */}
      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <View style={styles.inputFieldWrapper}>
            <TextInput
              ref={inputRef}
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
              onBlur={handleBlur}
            />
            {soNumber.length > 0 && (
              <Pressable
                onPress={clearSession}
                style={{ padding: 6, opacity: 0.6 }}
              >
                <Ionicons name="close-circle" size={18} color="#64748b" />
              </Pressable>
            )}
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

      {/* 🔹 Selected OBD Display */}
      {selectedObdNumber ? (
        <Text style={styles.selectedVariantText}>
          OBD: <Text style={styles.boldText}>{selectedObdNumber}</Text>
        </Text>
      ) : null}

      {/* Header Buttons */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.fixedButton, styles.addButton, (uploading || isLoading) && { opacity: 0.7 }]}
          onPress={openActionSheet}
          disabled={uploading || isLoading}
        >
          <Ionicons name="add-circle-outline" size={20} color="#2196F3" />
          <Text style={styles.fixedButtonText}>New Files</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.fixedButton,
            styles.uploadButton,
            (uploading || isLoading || pendingCount === 0) && { opacity: 0.7 },
          ]}
          onPress={uploadFiles}
          disabled={uploading || isLoading || pendingCount === 0 || !activeSoNumber}
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
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
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

      {/* OBD / Variant Selection Modal */}
      <Modal
        visible={variantModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setVariantModalVisible(false)}
      >
        <View style={styles.variantModalOverlay}>
          <View style={styles.variantModalContent}>
            <Text style={styles.variantModalTitle}>
              Select OBD for {activeSoNumber} ({variants.length})
            </Text>
            <Text style={styles.variantModalSubtitle}>Multiple entries found. Please select one:</Text>
            
            <FlatList
              data={variants}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.variantItem}
                  onPress={() => handleSelectVariant(item)}
                >
                  <View style={styles.variantItemLeft}>
                    <Ionicons name="document-text-outline" size={24} color="#3b82f6" />
                    <View style={styles.variantTextWrap}>
                      <Text style={styles.variantObdText}>OBD: {item.outboundDelivery}</Text>
                      <Text style={styles.variantSoText}>SO: {item.saleOrderNumber}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                </TouchableOpacity>
              )}
              style={styles.variantList}
            />
            
            <TouchableOpacity
              style={styles.variantCloseBtn}
              onPress={() => setVariantModalVisible(false)}
            >
              <Text style={styles.variantCloseBtnText}>Cancel</Text>
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

  /* Variant Modal Styles */
  variantModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  variantModalContent: {
    backgroundColor: "#fff",
    width: "90%",
    maxHeight: "80%",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  variantModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  variantModalSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
  },
  variantList: {
    marginBottom: 16,
    maxHeight: 380, // Approximately 5 items height to ensure scrollability
  },
  variantItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  variantItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  variantTextWrap: {
    marginLeft: 12,
  },
  variantObdText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
  },
  variantSoText: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  variantCloseBtn: {
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  variantCloseBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ef4444",
  },
  selectedVariantText: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 12,
    marginLeft: 4,
  },
  boldText: {
    fontWeight: "bold",
    color: "#000",
  },
});
