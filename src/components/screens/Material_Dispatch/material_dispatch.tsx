// material_dispatch.tsx
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Pressable,
  Modal,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import {
  createDispatchHeader,
  updateDispatchHeader,
  linkSalesOrder,
  deleteSalesOrderLink,
  uploadAttachments,
  getAttachments,
  type CreateDispatchHeaderRequest,
  type UpdateDispatchHeaderRequest,
  type LinkDispatchSORequest,
  type ApiResult,
  type DispatchAttachment,
} from "../../Api/Hooks/Usematerial_dispatch";
import {
  loadDispatchData,
  saveDispatchData,
  clearDispatchData,
} from "../../Storage/material_dispatch_storage";
import { useFocusEffect } from "@react-navigation/native";

type DispatchForm = {
  customer: string;
  address: string;
  transporter: string;
  vehicleNo: string;
};

type SOEntry = {
  soId: string;
  linkId: number;
  createdAt: number;
};

type FileAttachment = {
  id?: string | number;
  fileName: string;
  uploadedAt?: string | number | Date | null;
};

const C = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  hint: "#9CA3AF",
  accent: "#111827",
  blue: "#2151F5",
  red: "#F87171",
  grayBtn: "#F3F4F6",
  green: "#10B981",
};

const C_sales = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  border: "#E6E8EF",
  text: "#0B1220",
  sub: "#6B7280",
  blue: "#2151F5",
  pill: "#F3F4F6",
  hover: "#F9FAFB",
  danger: "#EF4444",
};

const MaterialDispatchScreen: React.FC = () => {
  const [form, setForm] = useState<DispatchForm>({
    customer: "",
    address: "",
    transporter: "",
    vehicleNo: "",
  });
  const [dispatchId, setDispatchId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<
    DocumentPicker.DocumentPickerAsset[]
  >([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<
    DispatchAttachment[]
  >([]);
  const [expanded, setExpanded] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);

  const animatedHeight = useState(new Animated.Value(1))[0];
  const salesOpacity = useState(new Animated.Value(0))[0];
  const formHeight = 380;

  const customerRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  const onChange = (k: keyof DispatchForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const isFormValid = useMemo(() => {
    const { customer, address, transporter, vehicleNo } = form;
    return (
      !!customer?.trim() &&
      !!address?.trim() &&
      !!transporter?.trim() &&
      !!vehicleNo?.trim()
    );
  }, [form]);

  const totalAttachments = selectedFiles.length + uploadedAttachments.length;

  const handleClear = () => {
    setForm({ customer: "", address: "", transporter: "", vehicleNo: "" });
    setDispatchId(null);
    setSelectedFiles([]);
    setUploadedAttachments([]);
    setItems([]);
    setValue("");
  };

  const handleAddNew = () => {
    setShowNewFormModal(true);
  };

  const confirmNewForm = async () => {
    await clearDispatchData();
    handleClear();
    if (!expanded) toggleExpand();
    setShowNewFormModal(false);
    setTimeout(() => customerRef.current?.focus(), 100);
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const toValue = expanded ? 0 : 1;
    Animated.timing(animatedHeight, {
      toValue,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
    const salesToValue = expanded ? 1 : 0;
    Animated.timing(salesOpacity, {
      toValue: salesToValue,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);

    if (!expanded) {
      setTimeout(() => {
        soRef.current?.focus();
      }, 350);
    }
  };

  const focusSOInput = useCallback(() => {
    setTimeout(() => {
      soRef.current?.focus();
    }, 100);
  }, []);

  /* ------------------- HEADER ------------------- */
  const handleSaveHeader = async () => {
    if (!isFormValid || savingHeader) return;

    setSavingHeader(true);
    const payload: CreateDispatchHeaderRequest = {
      customerName: form.customer.trim(),
      transporterName: form.transporter.trim(),
      address: form.address.trim(),
      vehicleNumber: form.vehicleNo.trim(),
    };

    try {
      const result = await createDispatchHeader(payload);
      if (result.ok) {
        const id = (result.data as any).id;
        setDispatchId(id);
        if (expanded) toggleExpand();
        focusSOInput();
      } else {
        setErrorMessage(result.error || "Failed to save.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setShowError(true);
    } finally {
      setSavingHeader(false);
    }
  };

  const handleUpdateHeader = async () => {
  if (!isFormValid || savingHeader || !dispatchId) return;

  setSavingHeader(true);
  const payload: UpdateDispatchHeaderRequest = {
    customerName: form.customer.trim(),
    transporterName: form.transporter.trim(),
    address: form.address.trim(),
    vehicleNumber: form.vehicleNo.trim(),
  };

  try {
    const result = await updateDispatchHeader(dispatchId, payload);
    if (result.ok) {
      showToast("Updated successfully!", "success"); // This line
      focusSOInput();
    } else {
      setErrorMessage(result.error || "Failed to update.");
      setShowError(true);
    }
  } catch {
    setErrorMessage("Network error. Please try again.");
    setShowError(true);
  } finally {
    setSavingHeader(false);
  }
};
  /* ------------------- FILE PICKER ------------------- */
  const openFilePicker = () => {
    if (!dispatchId) {
      setErrorMessage("Save header first.");
      setShowError(true);
      return;
    }
    setShowFileModal(true);
  };

  const handleFileSelect = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    setSelectedFiles((prev) => [...prev, ...res.assets]);
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage("Please select files first.");
      setShowError(true);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadAttachments(dispatchId!, selectedFiles);
      if (result.ok) {
        showToast(`${selectedFiles.length} file(s) uploaded!`, "success");
        setSelectedFiles([]);
        setShowFileModal(false);
        await loadAttachments();
        focusSOInput();
      } else {
        setErrorMessage(result.error || "Upload failed.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Upload failed. Check connection.");
      setShowError(true);
    } finally {
      setUploading(false);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const loadAttachments = async () => {
    if (!dispatchId) return;
    try {
      const result = await getAttachments(dispatchId);
      if (result.ok) setUploadedAttachments(result.data);
    } catch {
      // silent
    }
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setErrorMessage(msg);
    if (type === "success") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } else {
      setShowError(true);
    }
  };

  const formHeightInterpolate = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, formHeight],
  });

  const scaleInterpolate = animatedHeight;

  /* ------------------- SALES ORDERS ------------------- */
  const [value, setValue] = useState("");
  const [items, setItems] = useState<SOEntry[]>([]);
  const total = useMemo(() => items.length, [items]);

  function normalizeSO(raw: string) {
    return raw.replace(/\s+/g, "").toUpperCase();
  }

  const clearAndFocusSO = () => {
    setValue("");
    focusSOInput();
  };

  async function addSO(raw: string) {
    const so = normalizeSO(raw);
    if (!so || !dispatchId) {
      clearAndFocusSO();
      return;
    }

    if (items.some((x) => x.soId === so)) {
      setErrorMessage(`SO ${so} already added.`);
      setShowError(true);
      clearAndFocusSO();
      return;
    }

    const payload: LinkDispatchSORequest = { saleOrderNumber: so };

    try {
      const result = await linkSalesOrder(dispatchId, payload);
      if (result.ok) {
        const link = result.data;
        setItems((prev) => [
          ...prev,
          { soId: so, linkId: link.id, createdAt: new Date(link.createdAt).getTime() },
        ]);
        clearAndFocusSO();
      } else {
        setErrorMessage(result.error || "Failed to link SO.");
        setShowError(true);
        clearAndFocusSO();
      }
    } catch {
      setErrorMessage("Failed to link SO.");
      setShowError(true);
      clearAndFocusSO();
    }
  }

  async function removeSO(linkId: number) {
    try {
      const result = await deleteSalesOrderLink(linkId);
      if (result.ok) {
        setItems((prev) => prev.filter((x) => x.linkId !== linkId));
        focusSOInput();
      } else {
        setErrorMessage(result.error || "Failed to remove SO.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Failed to remove SO.");
      setShowError(true);
    }
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    const hh = d.getHours() % 12 || 12;
    const mm = `${d.getMinutes()}`.padStart(2, "0");
    const ampm = d.getHours() >= 12 ? "PM" : "AM";
    return `${hh}:${mm} ${ampm}`;
  }

  /* ------------------- SCANNER ------------------- */
  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);

  const openScanner = async () => {
    if (!dispatchId) {
      setErrorMessage("Save header first.");
      setShowError(true);
      return;
    }
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        setErrorMessage("Camera permission required.");
        setShowError(true);
        return;
      }
    }
    setScanLocked(false);
    setScanVisible(true);
  };

  const closeScanner = () => {
    setScanVisible(false);
    setScanLocked(false);
    focusSOInput();
  };

  const onScanned = async (result: BarcodeScanningResult) => {
    if (scanLocked) return;
    setScanLocked(true);
    await addSO(result.data ?? "");
    // Auto-close after successful scan
    setTimeout(() => {
      closeScanner();
    }, 600);
  };

  const canSubmit = value.trim().length > 0;

  /* ------------------- PERSISTENCE & FOCUS ------------------- */
  useEffect(() => {
    const load = async () => {
      const data = await loadDispatchData();
      if (data) {
        setForm(data.form);
        setDispatchId(data.dispatchId);
        setItems(data.items || []);
        setSelectedFiles(data.selectedFiles || []);
        if (data.dispatchId) {
          setExpanded(false);
          animatedHeight.setValue(0);
          salesOpacity.setValue(1);
          await loadAttachments();
        }
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timeoutId = setTimeout(() => {
        if (dispatchId && !expanded) {
          soRef.current?.focus();
        } else {
          customerRef.current?.focus();
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }, [dispatchId, expanded])
  );

  useEffect(() => {
    if (!expanded && dispatchId) focusSOInput();
  }, [expanded, dispatchId]);

  useEffect(() => {
    saveDispatchData({
      form,
      dispatchId,
      items,
      selectedFiles,
    });
  }, [form, dispatchId, items, selectedFiles]);

  useEffect(() => {
    if (dispatchId) loadAttachments();
  }, [dispatchId]);

  /* ------------------- RENDER ------------------- */
  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          {dispatchId && (
            <TouchableOpacity onPress={toggleExpand} style={styles.arrowBtn}>
              <Ionicons
                name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
                size={24}
                color={C.text}
              />
            </TouchableOpacity>
          )}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleAddNew} style={styles.addNewBtn}>
              <Text style={styles.addNewText}>Add New</Text>
            </TouchableOpacity>
            {dispatchId && (
              <TouchableOpacity onPress={openFilePicker} style={styles.attachBtn}>
                <Ionicons name="attach" size={22} color={C.blue} />
                {totalAttachments > 0 && (
                  <View style={styles.attachmentBadge}>
                    <Text style={styles.attachmentBadgeText}>
                      {totalAttachments}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form */}
        <Animated.View
          style={{
            overflow: "hidden",
            height: formHeightInterpolate,
            opacity: animatedHeight,
            transform: [{ scaleY: scaleInterpolate }],
          }}
        >
          <View style={styles.card}>
            <TextInput
              ref={customerRef}
              style={styles.input}
              placeholder="Customer"
              placeholderTextColor={C.hint}
              value={form.customer}
              onChangeText={(t) => onChange("customer", t)}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Address"
              placeholderTextColor={C.hint}
              multiline
              value={form.address}
              onChangeText={(t) => onChange("address", t)}
            />
            <View style={styles.row2}>
              <TextInput
                style={[styles.input, styles.half]}
                placeholder="Transporter"
                placeholderTextColor={C.hint}
                value={form.transporter}
                onChangeText={(t) => onChange("transporter", t)}
              />
              <TextInput
                style={[styles.input, styles.half]}
                placeholder="Vehicle Number"
                placeholderTextColor={C.hint}
                autoCapitalize="characters"
                value={form.vehicleNo}
                onChangeText={(t) => onChange("vehicleNo", t)}
              />
            </View>

            <TouchableOpacity
              onPress={dispatchId ? handleUpdateHeader : handleSaveHeader}
              disabled={!isFormValid || savingHeader}
              style={[
                styles.saveBtn,
                (!isFormValid || savingHeader) && styles.disabledBtn,
              ]}
            >
              {savingHeader ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {dispatchId ? "Update" : "Save"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* SO & Attachments Section */}
        <Animated.View style={{ opacity: salesOpacity, flex: 1 }}>
          <View style={styles_sales.inputRow}>
            <View style={styles_sales.inputWrap}>
              <TextInput
                ref={soRef}
                value={value}
                onChangeText={setValue}
                placeholder="Scan or enter SO"
                placeholderTextColor={C_sales.sub}
                style={[styles_sales.input, { paddingRight: 44 }]}
                returnKeyType="done"
                onSubmitEditing={() => addSO(value)}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable onPress={openScanner} style={styles_sales.scanBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={C.accent} />
              </Pressable>
            </View>
            <TouchableOpacity
              onPress={() => addSO(value)}
              disabled={!canSubmit || !dispatchId}
              style={[
                styles_sales.submitBtnOuter,
                (!canSubmit || !dispatchId) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles_sales.submitTextOuter}>Submit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles_sales.totalPill}>
            <Text style={styles_sales.totalText}>
              Total SOs: <Text style={styles_sales.totalNum}>{total}</Text> | Attachments: <Text style={styles_sales.totalNum}>{totalAttachments}</Text>
            </Text>
          </View>

          {/* SO List */}
          <View style={[styles_sales.tableCard, { marginTop: 12 }]}>
            <View style={[styles_sales.row, styles_sales.headerRow]}>
              <Text style={[styles_sales.th, { width: 40 }]}>S/No</Text>
              <Text style={[styles_sales.th, { flex: 1 }]}>SO Number</Text>
              <Text style={[styles_sales.th, { width: 80 }]}>Time</Text>
              <Text style={[styles_sales.th, { width: 72, textAlign: "right" }]}>Action</Text>
            </View>
            <FlatList
              data={items}
              keyExtractor={(it) => it.linkId.toString()}
              contentContainerStyle={items.length === 0 && { paddingVertical: 24 }}
              ItemSeparatorComponent={() => <View style={styles_sales.divider} />}
              renderItem={({ item, index }) => (
                <View style={styles_sales.row}>
                  <Text style={[styles_sales.td, { width: 40 }]}>{index + 1}</Text>
                  <Text style={[styles_sales.td, { flex: 1 }]}>{item.soId}</Text>
                  <Text style={[styles_sales.td, { width: 80 }]}>{formatTime(item.createdAt)}</Text>
                  <View style={[styles_sales.td, { width: 72, alignItems: "flex-end" }]}>
                    <Pressable
                      onPress={() => removeSO(item.linkId)}
                      style={({ pressed }) => [
                        styles_sales.iconBtn,
                        pressed && { backgroundColor: C_sales.hover },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={18} color={C_sales.danger} />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>
        </Animated.View>
      </View>

      {/* ---------- MODALS ---------- */}
      <Modal visible={showNewFormModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Start New Form</Text>
            <Text style={styles.confirmationMessage}>This will clear all current data.</Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                onPress={() => setShowNewFormModal(false)}
                style={[styles.confirmationButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmNewForm}
                style={[styles.confirmationButton, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Text style={styles.modalTitle}>{errorMessage}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={showError} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.modalTitle}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => setShowError(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------- FILE MODAL ---------- */}
      <Modal visible={showFileModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.fileModal}>
            <View style={styles.fileModalHeader}>
              <Text style={styles.fileModalTitle}>Upload Attachments</Text>
              <TouchableOpacity onPress={() => setShowFileModal(false)} style={styles.fileModalCloseBtn}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            {/* Selected Files */}
            <View style={styles.selectedFilesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Selected Files</Text>
                <Text style={styles.fileCount}>({selectedFiles.length} files)</Text>
              </View>

              {selectedFiles.length > 0 ? (
                <View style={styles.selectedFilesContainer}>
                  <ScrollView style={styles.selectedFilesList} showsVerticalScrollIndicator={false}>
                    {selectedFiles.map((file, i) => (
                      <View key={i} style={styles.selectedFileItem}>
                        <View style={styles.fileInfo}>
                          <Ionicons name="document-outline" size={18} color={C.blue} />
                          <View style={styles.fileDetails}>
                            <Text style={styles.selectedFileName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={styles.fileSize}>
                              {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Size unknown"}
                            </Text>
                          </View>
                        </View>
                        <Pressable onPress={() => removeSelectedFile(i)} style={styles.removeFileBtn}>
                          <Ionicons name="close-circle" size={20} color={C.red} />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="document-outline" size={40} color={C.hint} />
                  <Text style={styles.emptyStateText}>No files selected</Text>
                  <Text style={styles.emptyStateSubtext}>Choose files to upload</Text>
                </View>
              )}
            </View>

            {/* Uploaded Files */}
            {uploadedAttachments?.length > 0 && (
  <View style={styles.uploadedFilesSection}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Uploaded Files</Text>
      <Text style={styles.fileCount}>({uploadedAttachments.length} files)</Text>
    </View>

    <View style={styles.uploadedFilesContainer}>
      <ScrollView style={styles.uploadedFilesList} showsVerticalScrollIndicator={false}>
        {uploadedAttachments.map((file: FileAttachment, index: number) => {
          // ensure we always pass a string key
          const key = file.id !== undefined && file.id !== null ? String(file.id) : `file-${index}`;

          // guard uploadedAt and format safely
          let uploadedDateText = "Uploaded —";
          if (file.uploadedAt) {
            const d = new Date(file.uploadedAt);
            uploadedDateText = isNaN(d.getTime()) ? "Uploaded —" : `Uploaded ${d.toLocaleDateString()}`;
          }

          return (
            <View key={key} style={styles.uploadedFileItem}>
              <View style={styles.fileInfo}>
                <Ionicons name="checkmark-circle" size={18} color={C.green} />
                <View style={styles.fileDetails}>
                  <Text style={styles.uploadedFileName} numberOfLines={1}>
                    {file.fileName ?? "Unnamed file"}
                  </Text>
                  <Text style={styles.fileUploadDate}>{uploadedDateText}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  </View>
)}

            {/* Buttons */}
            <View style={styles.fileModalActions}>
              <TouchableOpacity onPress={handleFileSelect} style={[styles.fileModalBtn, styles.fileSelectBtn]}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.fileSelectText}>Choose Files</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleFileUpload}
                disabled={selectedFiles.length === 0 || uploading}
                style={[
                  styles.fileModalBtn,
                  styles.uploadBtn,
                  (selectedFiles.length === 0 || uploading) && styles.disabledBtn,
                ]}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                    <Text style={styles.uploadBtnText}>Upload ({selectedFiles.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- SCANNER MODAL ---------- */}
      <Modal visible={scanVisible} animationType="slide" presentationStyle="fullScreen">
        <StatusBar hidden />
        <View style={styles_scan.fullscreenCameraWrap}>
          <CameraView
            style={styles_scan.fullscreenCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "code128", "ean13", "ean8", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={scanLocked ? undefined : onScanned}
          />
          <View style={styles_scan.fullscreenTopBar}>
            <Text style={styles_scan.fullscreenTitle}>Scan a code</Text>
            <Pressable onPress={closeScanner} style={styles_scan.fullscreenCloseBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles_scan.fullscreenBottomBar}>
            <Text style={styles_scan.fullscreenHint}>Align code in frame</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MaterialDispatchScreen;

/* ------------------------------------------------- STYLES ------------------------------------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 10, backgroundColor: C.bg },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, justifyContent: "space-between" },
  arrowBtn: { padding: 6 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  addNewBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: C.grayBtn },
  addNewText: { color: C.text, fontWeight: "600" },
  attachBtn: { padding: 8, position: "relative" },
  attachmentBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: C.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  attachmentBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, marginBottom: 10, backgroundColor: "#fff" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10, marginBottom: 10 },
  half: { flex: 1, marginBottom: 0 },
  saveBtn: { backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  disabledBtn: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  /* Modals */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },

  /* File Modal */
  fileModal: { backgroundColor: "#fff", borderRadius: 16, padding: 0, width: "90%", maxWidth: 400, maxHeight: "80%", overflow: "hidden" },
  fileModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  fileModalTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  fileModalCloseBtn: { padding: 4 },
  selectedFilesSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  uploadedFilesSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: C.text },
  fileCount: { fontSize: 14, color: C.hint },
  selectedFilesContainer: { maxHeight: 150 },
  uploadedFilesContainer: { maxHeight: 120 },
  selectedFilesList: { flexGrow: 0 },
  uploadedFilesList: { flexGrow: 0 },
  selectedFileItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#F8FAFC", borderRadius: 8, marginBottom: 8 },
  uploadedFileItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#F0F9FF", borderRadius: 8, marginBottom: 8 },
  fileInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  fileDetails: { marginLeft: 12, flex: 1 },
  selectedFileName: { fontSize: 14, fontWeight: "500", color: C.text, marginBottom: 2 },
  uploadedFileName: { fontSize: 14, fontWeight: "500", color: C.text, marginBottom: 2 },
  fileSize: { fontSize: 12, color: C.hint },
  fileUploadDate: { fontSize: 12, color: C.hint },
  removeFileBtn: { padding: 4 },
  emptyState: { alignItems: "center", paddingVertical: 30 },
  emptyStateText: { fontSize: 16, color: C.hint, marginTop: 8, fontWeight: "500" },
  emptyStateSubtext: { fontSize: 14, color: C.hint, marginTop: 4 },
  fileModalActions: { flexDirection: "row", padding: 20, gap: 12 },
  fileModalBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 10, gap: 8 },
  fileSelectBtn: { backgroundColor: C.grayBtn, borderWidth: 1, borderColor: C.border },
  uploadBtn: { backgroundColor: C.green },
  fileSelectText: { color: C.text, fontWeight: "600", fontSize: 14 },
  uploadBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  successModal: { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", width: "80%" },
  errorModal: { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", width: "80%" },
  modalTitle: { fontSize: 16, fontWeight: "600", color: C.text, textAlign: "center", marginBottom: 20 },
  modalButton: { backgroundColor: C.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  modalButtonText: { color: "#fff", fontWeight: "600" },
  confirmationModal: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, alignItems: "center" },
  confirmationTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 12 },
  confirmationMessage: { fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  confirmationButtons: { flexDirection: "row", gap: 12, width: "100%" },
  confirmationButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  cancelButton: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  confirmButton: { backgroundColor: "#2151F5" },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  confirmButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});

const styles_sales = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputWrap: { position: "relative", flex: 1 },
  input: { backgroundColor: C_sales.card, borderColor: C_sales.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C_sales.text },
  scanBtn: { position: "absolute", right: 6, top: 0, bottom: 0, justifyContent: "center", width: 36 },
  submitBtnOuter: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: C_sales.pill, borderWidth: 1, borderColor: C_sales.border },
  submitTextOuter: { color: C_sales.blue, fontWeight: "700", fontSize: 14 },
  totalPill: { marginTop: 10, backgroundColor: C_sales.pill, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: C_sales.border },
  totalText: { color: C_sales.sub, fontSize: 13 },
  totalNum: { fontWeight: "700", color: C_sales.text },
  tableCard: { marginTop: 12, backgroundColor: C_sales.card, borderRadius: 12, borderWidth: 1, borderColor: C_sales.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  headerRow: { backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: C_sales.border },
  th: { fontSize: 13, fontWeight: "700", color: C_sales.text },
  td: { fontSize: 14, color: C_sales.text },
  divider: { height: 1, backgroundColor: C_sales.border },
  iconBtn: { height: 30, width: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});

const styles_scan = StyleSheet.create({
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: { position: "absolute", top: 44, left: 16, right: 16, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 },
  fullscreenCloseBtn: { height: 28, width: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  fullscreenBottomBar: { position: "absolute", bottom: 24, left: 16, right: 16, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 10, alignItems: "center" },
  fullscreenHint: { color: "#fff", fontSize: 12 },

  /* Scan-again button (new) */
  scanAgainBtn: { position: "absolute", bottom: 80, left: 16, right: 16, alignItems: "center" },
  scanAgainInner: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", gap: 8 },
  scanAgainText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});