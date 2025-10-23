import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Pressable,
  Modal,
  StatusBar,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons ,MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import {
  createDispatchHeader,
  linkSalesOrder,
  deleteSalesOrderLink,
  uploadAttachments,
  type CreateDispatchHeaderRequest,
  type LinkDispatchSORequest,
  type ApiResult,
} from "../../Api/material_dispatch_server";
import { loadDispatchData, saveDispatchData, clearDispatchData } from "../../Storage/material_dispatch_storage";

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
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [fileName, setFileName] = useState<string>("No file chosen");
  const [expanded, setExpanded] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showNewFormModal, setShowNewFormModal] = useState(false);

  const animatedHeight = useState(new Animated.Value(1))[0];
  const salesOpacity = useState(new Animated.Value(0))[0];

  const formHeight = 350;

  const customerRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  const onChange = (k: keyof DispatchForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const isFormValid = useMemo(() => {
    const { customer, address, transporter, vehicleNo } = form;
    return !!customer?.trim() && !!address?.trim() && !!transporter?.trim() && !!vehicleNo?.trim();
  }, [form]);

  const handleChooseFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const file = res.assets?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name ?? "Selected file");
    }
  };

  const handleClear = () => {
    setForm({ customer: "", address: "", transporter: "", vehicleNo: "" });
    setDispatchId(null);
    setSelectedFile(null);
    setFileName("No file chosen");
    setItems([]);
  };

  const handleAddNew = () => {
    setShowNewFormModal(true);
  };

  const confirmNewForm = async () => {
    await clearDispatchData();
    handleClear();
    if (!expanded) {
      toggleExpand();
    }
    setShowNewFormModal(false);
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
  };

  const handleSave = async () => {
    const { customer, transporter, address, vehicleNo } = form;

    const payload: CreateDispatchHeaderRequest = {
      customerName: customer.trim(),
      transporterName: transporter.trim(),
      address: address.trim(),
      vehicleNumber: vehicleNo.trim(),
    };

    try {
      const result: ApiResult = await createDispatchHeader(payload);
      if (result.ok) {
        const headerId = result.data.id;
        if (!headerId) {
          setErrorMessage("Invalid response from server.");
          setShowError(true);
          return;
        }
        setDispatchId(`${headerId}`);

        let uploadSuccess = true;
        if (selectedFile) {
          const uploadResult: ApiResult = await uploadAttachments(`${headerId}`, [selectedFile]);
          if (!uploadResult.ok) {
            uploadSuccess = false;
            console.warn("File upload failed:", uploadResult.error);
          }
        }

        const message = `Dispatch created successfully!${!uploadSuccess ? '\n\nNote: File upload failed.' : ''}`;
        setShowSuccess(true);
        if (expanded) toggleExpand();
        setTimeout(() => {
          setShowSuccess(false);
        }, 500);

        if (uploadSuccess) {
          setSelectedFile(null);
          setFileName("No file chosen");
        }
      } else {
        setErrorMessage(result.error || "Failed to create dispatch header.");
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setShowError(true);
    }
  };

  const formHeightInterpolate = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, formHeight],
  });

  const scaleInterpolate = animatedHeight;

  /** ------------------ Sales Orders + Scanner ------------------ */
  const [value, setValue] = useState("");
  const [items, setItems] = useState<SOEntry[]>([]);
  const total = useMemo(() => items.length, [items]);

  function normalizeSO(raw: string) {
    return raw.replace(/\s+/g, "").toUpperCase();
  }

  async function addSO(raw: string) {
    const so = normalizeSO(raw);
    if (!so) return;

    if (!dispatchId) {
      setErrorMessage("Please create a dispatch header first.");
      setShowError(true);
      return;
    }

    // Check for duplicate SO
    if (items.some((x) => x.soId === so)) {
      setErrorMessage(`Sales Order ${so} is already linked to this dispatch.`);
      setShowError(true);
      setValue("");
      return;
    }

    const payload: LinkDispatchSORequest = { saleOrderNumber: so };

    try {
      const result: ApiResult<DispatchSOLink> = await linkSalesOrder(dispatchId, payload);
      if (result.ok) {
        const link = result.data;
        setItems((prev) => [
          ...prev,
          {
            soId: so,
            linkId: link.id,
            createdAt: new Date(link.createdAt).getTime(),
          },
        ]);
      } else {
        setErrorMessage(result.error || "Failed to link sales order.");
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setShowError(true);
    }

    setValue("");
  }

  async function removeSO(linkId: number) {
    if (!dispatchId) {
      setErrorMessage("Please create a dispatch header first.");
      setShowError(true);
      return;
    }

    try {
      const result: ApiResult = await deleteSalesOrderLink(linkId);
      if (result.ok) {
        setItems((prev) => prev.filter((x) => x.linkId !== linkId));
      } else {
        setErrorMessage(result.error || "Failed to remove sales order.");
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setShowError(true);
    }
  }

  function clearAll() {
    setItems([]);
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    const hh = d.getHours() % 12 || 12;
    const mm = `${d.getMinutes()}`.padStart(2, "0");
    const ampm = d.getHours() >= 12 ? "PM" : "AM";
    return `${hh}:${mm} ${ampm}`;
  }

  // Camera / Scanner state
  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);

  const openScanner = async () => {
    if (!dispatchId) {
      setErrorMessage("Please create a dispatch header first.");
      setShowError(true);
      return;
    }

    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        setErrorMessage("Camera access is required to scan QR codes and barcodes.");
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
  };

  const onScanned = (result: BarcodeScanningResult) => {
    if (scanLocked) return;
    setScanLocked(true);
    const data = result?.data ?? "";
    addSO(data);
    setTimeout(() => {
      closeScanner();
    }, 250);
  };

  const canSubmit = value.trim().length > 0;

  // Load from local storage on mount
  useEffect(() => {
    const loadData = async () => {
      const data = await loadDispatchData();
      if (data) {
        setForm(data.form);
        setDispatchId(data.dispatchId);
        setItems(data.items || []);
        setFileName(data.fileName || "No file chosen");
        if (data.selectedFile) {
          setSelectedFile({
            name: data.selectedFile.name,
            uri: data.selectedFile.uri,
            mimeType: data.selectedFile.mimeType,
            size: data.selectedFile.size,
          } as DocumentPicker.DocumentPickerAsset);
        }
        if (data.dispatchId) {
          setExpanded(false);
          animatedHeight.setValue(0);
          salesOpacity.setValue(1);
        }
      }
    };
    loadData();
  }, []);

  // Focus logic
  useEffect(() => {
    if (dispatchId) {
      soRef.current?.focus();
    } else {
      customerRef.current?.focus();
    }
  }, [dispatchId]);

  // Save to local storage when state changes
  useEffect(() => {
    const dataToSave = {
      form,
      dispatchId,
      items,
      fileName,
      selectedFile: selectedFile
        ? {
            name: selectedFile.name,
            uri: selectedFile.uri,
            mimeType: selectedFile.mimeType,
            size: selectedFile.size,
          }
        : null,
    };
    saveDispatchData(dataToSave);
  }, [form, dispatchId, items, fileName, selectedFile]);

  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {/* Header Row */}
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
          </View>
        </View>

        {/* Animated Form Section */}
        <Animated.View
          style={{
            overflow: "hidden",
            height: formHeightInterpolate,
            opacity: animatedHeight,
            transform: [
              {
                scaleY: scaleInterpolate,
              },
            ],
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

            <View style={styles.fileRow}>
              <TouchableOpacity onPress={handleChooseFile} style={styles.fileBtn}>
                <Text style={styles.fileBtnText}>Choose File</Text>
              </TouchableOpacity>
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={handleSave} 
              disabled={!isFormValid}
              style={[
                styles.saveBtn,
                !isFormValid && { opacity: 0.5 }
              ]}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Sales Orders Section */}
        <Animated.View style={{ opacity: salesOpacity, flex: 1 }}>
          <View style={styles_sales.inputRow}>
            <View style={styles_sales.inputWrap}>
              <TextInput
                ref={soRef}
                value={value}
                onChangeText={setValue}
                placeholder= "Scan or enter SO"
                placeholderTextColor={C_sales.sub}
                style={[styles_sales.input, { paddingRight: 44 }]} 
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => addSO(value)}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType={Platform.select({ ios: "default", android: "visible-password" })}
              />

              <Pressable
                onPress={openScanner}
                style={({ pressed }) => [
                  styles_sales.scanBtn,
                  pressed && { opacity: 0.85 },
                ]}
                hitSlop={10}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={C.accent} />
              </Pressable>
            </View>

            <TouchableOpacity
              onPress={() => addSO(value)}
              activeOpacity={0.9}
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
              Total SOs: <Text style={styles_sales.totalNum}>{total}</Text>
            </Text>
          </View>

          <View style={styles_sales.tableCard}>
            <View style={[styles_sales.row, styles_sales.headerRow]}>
              <Text style={[styles_sales.th, { width: 40, textAlign: "left" }]}>S/No</Text>
              <Text style={[styles_sales.th, { flex: 1 }]}>SO Number</Text>
              <Text style={[styles_sales.th, { width: 80 }]}>Timing</Text>
              <Text style={[styles_sales.th, { width: 72, textAlign: "right" }]}>Action</Text>
            </View>

            <FlatList
              data={items}
              keyExtractor={(it) => it.linkId.toString()}
              contentContainerStyle={items.length === 0 && { paddingVertical: 24 }}
              ItemSeparatorComponent={() => <View style={styles_sales.divider} />}
              ListEmptyComponent={<Text style={styles_sales.empty}> </Text>}
              renderItem={({ item, index }) => (
                <View style={styles_sales.row}>
                  <Text style={[styles_sales.td, { width: 40 }]}>{index + 1}</Text>
                  <Text style={[styles_sales.td, { flex: 1 }]} numberOfLines={1}>
                    {item.soId}
                  </Text>
                  <Text style={[styles_sales.td, { width: 80 }]}>
                    {formatTime(item.createdAt)}
                  </Text>
                  <View style={[styles_sales.td, { width: 72, alignItems: "flex-end" }]}>
                    <Pressable
                      onPress={() => removeSO(item.linkId)}
                      hitSlop={8}
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

      {/* New Form Confirmation Modal */}
      <Modal
        visible={showNewFormModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewFormModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Start New Form</Text>
            <Text style={styles.confirmationMessage}>
              Are you sure you want to start a new form? This action will clear all current data 
            </Text>
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

      {/* Success Modal */}
      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccess(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Text style={styles.modalTitle}>Dispatch created successfully!</Text>
            <TouchableOpacity
              onPress={() => setShowSuccess(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showError}
        transparent
        animationType="fade"
        onRequestClose={() => setShowError(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.modalTitle}>{errorMessage}</Text>
            <TouchableOpacity
              onPress={() => setShowError(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-screen Scanner */}
      <Modal
        visible={scanVisible}
        onRequestClose={closeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
      >
        <StatusBar hidden />
        <View style={styles_scan.fullscreenCameraWrap}>
          <CameraView
            style={styles_scan.fullscreenCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "code128", "ean13", "ean8", "upc_a", "upc_e", "code39", "code93", "codabar", "itf"],
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
            <Text style={styles_scan.fullscreenHint}>Align the code within the frame</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MaterialDispatchScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.select({ ios: 8, android: 10 }),
    backgroundColor: C.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    justifyContent: "space-between",
  },
  arrowBtn: {
    padding: 6,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  clearText: {
    color: C.red,
    fontWeight: "600",
  },
  addNewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.grayBtn,
  },
  addNewText: {
    color: C.text,
    fontWeight: "600",
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  row2: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  half: {
    flex: 1,
    marginBottom: 0,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
    marginBottom: 10,
  },
  fileBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.grayBtn,
  },
  fileBtnText: {
    color: C.text,
    fontWeight: "600",
  },
  fileName: {
    flex: 1,
    color: C.text,
  },
  saveBtn: {
    backgroundColor: C.blue,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 14,
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  banner: {
    backgroundColor: "#C4B5FD",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 14,
    marginVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  bannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  errorModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: C.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  confirmationModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    alignItems: "center",
  },
  confirmationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EFF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  confirmationMessage: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmationButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  confirmationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  confirmButton: {
    backgroundColor: "#2151F5",
  },
  cancelButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 15,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
});

const styles_sales = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: C_sales.text,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputWrap: {
    position: "relative",
    flex: 1,
  },
  input: {
    backgroundColor: C_sales.card,
    borderColor: C_sales.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 15,
    color: C_sales.text,
  },
  scanBtn: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 36,
  },
  submitBtnOuter: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C_sales.pill,
    borderWidth: 1,
    borderColor: C_sales.border,
  },
  submitTextOuter: { color: C_sales.blue, fontWeight: "700", fontSize: 14 },
  totalPill: {
    alignSelf: "stretch",
    marginTop: 10,
    backgroundColor: C_sales.pill,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C_sales.border,
  },
  totalText: { color: C_sales.sub, fontSize: 13 },
  totalNum: { fontWeight: "700", color: C_sales.text },
  clearBtn: {
    marginTop: 10,
    backgroundColor: C_sales.card,
    borderColor: C_sales.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: C_sales.text, fontWeight: "600" },
  tableCard: {
    marginTop: 12,
    backgroundColor: C_sales.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C_sales.border,
    overflow: "hidden",
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerRow: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: C_sales.border,
  },
  th: {
    fontSize: 13,
    fontWeight: "700",
    color: C_sales.text,
  },
  td: {
    fontSize: 14,
    color: C_sales.text,
  },
  divider: { height: 1, backgroundColor: C_sales.border },
  iconBtn: {
    height: 30,
    width: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    textAlign: "center",
    color: C_sales.sub,
    fontSize: 13,
  },
});

const styles_scan = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  topBar: {
    position: "absolute",
    top: Platform.select({ ios: 50, android: 20 }),
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  title: { color: "#111827", fontWeight: "700", fontSize: 14 },
  roundBtn: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: "70%",
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    borderRadius: 16,
    opacity: 0.9,
  },
  hint: {
    marginTop: 16,
    color: "#FFFFFF",
    fontSize: 14,
  },
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.select({ ios: 44, android: 16 }),
    left: 16,
    right: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 },
  fullscreenCloseBtn: {
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  fullscreenBottomBar: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 10,
    alignItems: "center",
  },
  fullscreenHint: { color: "#fff", fontSize: 12 },
});