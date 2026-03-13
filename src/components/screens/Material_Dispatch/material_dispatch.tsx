// material_dispatch.tsx
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
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
  Vibration,
  Platform,
} from "react-native";
import { useKeyboardDisabled } from "../../utils/keyboard";
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
  getAttachments,
  useTransportersLookup,
  type Transporter,
  type CreateDispatchHeaderRequest,
  type UpdateDispatchHeaderRequest,
  type LinkDispatchSORequest,
  type DispatchAttachment,
} from "../../Api/Hooks/Usematerial_dispatch";

import {
  loadDispatchData,
  saveDispatchData,
  clearDispatchData,
} from "../../Storage/material_dispatch_storage";

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import UploadModal from "./Upload";

type DispatchForm = {
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
    transporter: "",
    vehicleNo: "",
  });
  const [dispatchId, setDispatchId] = useState<string | null>(null);

  const [uploadedAttachments, setUploadedAttachments] = useState<
    DispatchAttachment[]
  >([]);
  const [trWidth, setTrWidth] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);

  // Transporter Lookup
  const {
    transporters,
    loadingTransporters,
    debouncedSearchTransporters,
    clearTransporters,
  } = useTransportersLookup();

  // Filter and sort transporters: ensure matches starting with query appear at the top
  const sortedTransporters = useMemo(() => {
    if (!transporters || transporters.length === 0) return [];
    
    const query = form.transporter.trim().toLowerCase();
    if (!query) return transporters;

    return [...transporters].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      const startsWithA = nameA.startsWith(query);
      const startsWithB = nameB.startsWith(query);

      if (startsWithA && !startsWithB) return -1;
      if (!startsWithA && startsWithB) return 1;
      return 0; 
    });
  }, [transporters, form.transporter]);

  // Keyboard & Scan State
  const [keyboardDisabled] = useKeyboardDisabled();
  const sessionCodesRef = useRef<Set<string>>(new Set());
  const pendingScansRef = useRef<string[]>([]);
  const [queueTrigger, setQueueTrigger] = useState(0);
  const processingRef = useRef(false);

  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const transporterRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  const onChange = (k: keyof DispatchForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const isFormValid = useMemo(() => {
    const { transporter, vehicleNo } = form;
    return !!transporter?.trim() && !!vehicleNo?.trim();
  }, [form]);

  // ✅ total attachments from server only
  const totalAttachments = uploadedAttachments.length;

  const handleClear = () => {
    setForm({ transporter: "", vehicleNo: "" });
    setDispatchId(null);
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
    setShowNewFormModal(false);
    setTimeout(() => transporterRef.current?.focus(), 100);
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
      transporterName: form.transporter.trim(),
      vehicleNumber: form.vehicleNo.trim(),
    } as any;

    try {
      const result = await createDispatchHeader(payload);
      if (result.ok) {
        const id = (result.data as any).id;
        setDispatchId(id);
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
      transporterName: form.transporter.trim(),
      vehicleNumber: form.vehicleNo.trim(),
    } as any;

    try {
      const result = await updateDispatchHeader(dispatchId, payload);
      if (result.ok) {
        showToast("Updated successfully!", "success");
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

  /* ------------------- FILE PICKER MODAL TRIGGER ------------------- */
  const openFilePicker = () => {
    if (!dispatchId) {
      setErrorMessage("Save header first.");
      setShowError(true);
      return;
    }
    setShowFileModal(true);
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

  /* ------------------- SALES ORDERS ------------------- */
  const [value, setValue] = useState("");
  const [items, setItems] = useState<SOEntry[]>([]);
  // sortMode: 'recent' (LIFO), 'asc' (A-Z), 'desc' (Z-A)
  const [sortMode, setSortMode] = useState<"recent" | "asc" | "desc">("recent");
  const total = useMemo(() => items.length, [items]);

  function normalizeSO(raw: string) {
    return raw.replace(/\s+/g, "").toUpperCase();
  }

  const clearAndFocusSO = () => {
    setValue("");
    focusSOInput();
  };

  async function coreAddSO(raw: string, isScan = false) {
    const so = normalizeSO(raw);
    if (!so || !dispatchId) {
      if (!isScan) clearAndFocusSO();
      return;
    }

    // Check duplicates locally first
    if (items.some((x) => x.soId === so)) {
      if (!isScan) {
        setErrorMessage(`SO ${so} already added.`);
        setShowError(true);
        clearAndFocusSO();
      } else {
        // Scanner feedback for duplicate?
        // We can just ignore or show toast.
      }
      return;
    }

    const payload: LinkDispatchSORequest = { saleOrderNumber: so } as any;

    try {
      const result = await linkSalesOrder(dispatchId, payload);
      if (result.ok) {
        const link = result.data;
        setItems((prev) => [
          {
            soId: so,
            linkId: link.id,
            createdAt: new Date(link.createdAt).getTime(),
          },
          ...prev,
        ]);
        
        if (!isScan) clearAndFocusSO();
        else {
             // Update feedback if scanning
             setLastScannedCode(so);
             setSessionCount(prev => prev + 1);
        }
      } else {
        if (!isScan) {
           setErrorMessage(result.error || "Failed to link SO.");
           setShowError(true);
           clearAndFocusSO();
        } else {
           console.log("Scan add failed:", result.error);
           // Maybe show toast?
        }
      }
    } catch {
       if (!isScan) {
         setErrorMessage("Failed to link SO.");
         setShowError(true);
         clearAndFocusSO();
       }
    }
  }

  // Queue Processor
  useEffect(() => {
    const process = async () => {
        if (processingRef.current) return;
        if (pendingScansRef.current.length === 0) return;

        processingRef.current = true;
        const nextSo = pendingScansRef.current.shift();

        if (nextSo) {
            await coreAddSO(nextSo, true);
        }

        processingRef.current = false;
        
        if (pendingScansRef.current.length > 0) {
            setQueueTrigger(c => c + 1);
        }
    };
    process();
  }, [queueTrigger, items, dispatchId]);

  // Public entry point
  function addSO(raw: string, isScan = false) {
      if (isScan) {
          pendingScansRef.current.push(raw);
          setQueueTrigger(c => c + 1);
      } else {
          // Manual entry - run direct or via queue? 
          // Better direct if we want immediate feedback, but coreAddSO is async.
          // Let's use coreAddSO directly for manual to handle errors in UI.
          coreAddSO(raw, false);
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
    
    // Reset session
    sessionCodesRef.current.clear();
    pendingScansRef.current = [];
    setLastScannedCode(null);
    setSessionCount(0);
    setScanVisible(true);
  };

  const closeScanner = () => {
    setScanVisible(false);
    focusSOInput();
  };

  const handleScanned = (result: BarcodeScanningResult) => {
    const value = (result?.data ?? "").trim();
    if (!value) return;
    
    // Prevent duplicate scans in same session
    if (sessionCodesRef.current.has(value)) return;
    
    sessionCodesRef.current.add(value);
    Vibration.vibrate();
    
    // Add to queue
    addSO(value, true);
    
    // Update local feedback immediately so user knows scan was registered
    // Actual success count updates when API returns in coreAddSO
  };

  const canSubmit = value.trim().length > 0;

  /* ------------------- PERSISTENCE & FOCUS ------------------- */
  useEffect(() => {
    const load = async () => {
      const data = await loadDispatchData();
      if (data) {
        const loadedForm: DispatchForm = {
          transporter: data.form?.transporter ?? "",
          // Normalize stored vehicle number: remove spaces + uppercase
          vehicleNo: (data.form?.vehicleNo ?? "").replace(/\s+/g, "").toUpperCase(),
        };
        setForm(loadedForm);
        setDispatchId(data.dispatchId);
        setItems(data.items || []);
        if (data.dispatchId) {
          await loadAttachments();
        }
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timeoutId = setTimeout(() => {
        if (dispatchId) {
          soRef.current?.focus();
        } else {
          transporterRef.current?.focus();
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }, [dispatchId])
  );

  useEffect(() => {
    if (dispatchId) focusSOInput();
  }, [dispatchId, focusSOInput]);

  useEffect(() => {
    saveDispatchData({
      form,
      dispatchId,
      items,
    });
  }, [form, dispatchId, items]);

  useEffect(() => {
    if (dispatchId) loadAttachments();
  }, [dispatchId]);

  /* ------------------- RENDER ------------------- */
  // Sorting Logic
  const toggleSortMode = () => {
      setSortMode(prev => {
          if (prev === 'recent') return 'asc';
          if (prev === 'asc') return 'desc';
          return 'recent';
      });
  };

  const getSortIcon = () => {
      switch(sortMode) {
          case 'asc': return 'sort-alphabetical-ascending';
          case 'desc': return 'sort-alphabetical-descending';
          default: return 'history';
      }
  };

  const sortedItems = useMemo(() => {
    if (sortMode === 'recent') {
        return items; // Already LIFO if we prepend
    }
    return [...items].sort((a, b) => {
      const valA = a.soId || "";
      const valB = b.soId || "";
      if (sortMode === 'asc') {
        return valA.localeCompare(valB);
      } else {
        return valB.localeCompare(valA);
      }
    });
  }, [items, sortMode]);

  const navigation = useNavigation();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center", marginRight: 5 }}>
          <TouchableOpacity onPress={handleAddNew} style={styles.addNewBtn}>
            <Text style={styles.addNewText}>Add New</Text>
          </TouchableOpacity>
          {dispatchId ? (
            <TouchableOpacity onPress={openFilePicker} style={[styles.attachBtn, { marginLeft: 10 }]}>
              <Ionicons name="attach" size={22} color={C.blue} />
              {totalAttachments > 0 && (
                <View style={styles.attachmentBadge}>
                  <Text style={styles.attachmentBadgeText}>
                    {totalAttachments}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ),
    });
  }, [navigation, handleAddNew, dispatchId, openFilePicker, totalAttachments]);

  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {/* Form */}
        <View style={[styles.row2, { zIndex: 2000, alignItems: 'flex-start' }]}>
          <View style={{ flex: 1 }} onLayout={(e) => setTrWidth(e.nativeEvent.layout.width)}>
            <View style={styles.inputContainer}>
              <TextInput
                ref={transporterRef}
                style={[styles.input, { flex: 1, paddingRight: form.transporter ? 40 : 12 }]}
                placeholder={keyboardDisabled ? "" : "Transporter"}
                placeholderTextColor={C.hint}
                value={form.transporter}
                onChangeText={(t) => {
                  onChange("transporter", t);
                  if (t.trim().length >= 3) {
                    debouncedSearchTransporters(t);
                  } else {
                    clearTransporters();
                  }
                }}
                onBlur={() => {
                  // Increased delay to ensure scroll/tap actions are registered
                  setTimeout(() => clearTransporters(), 500);
                }}
                showSoftInputOnFocus={!keyboardDisabled}
              />
              {form.transporter.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearInputBtn}
                  onPress={() => {
                    onChange("transporter", "");
                    clearTransporters();
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={C.hint} />
                </TouchableOpacity>
              )}
              {loadingTransporters && (
                <ActivityIndicator 
                  size="small" 
                  color={C.blue} 
                  style={styles.spinnerIcon} 
                />
              )}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder={keyboardDisabled ? "Scan..." : "Vehicle Number"}
              placeholderTextColor={C.hint}
              autoCapitalize="characters"
              showSoftInputOnFocus={!keyboardDisabled}
              value={form.vehicleNo}
              onChangeText={(t) => {
                const cleaned = t.replace(/\s+/g, "").toUpperCase();
                onChange("vehicleNo", cleaned);
              }}
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
              <Ionicons
                name={dispatchId ? "sync-outline" : "save-outline"}
                size={24}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Dropdown - Positioned relative to container to avoid Android touch clipping */}
        {sortedTransporters.length > 0 && (
          <View style={styles.dropdownOverlay}>
            <View style={[styles.dropdownContainer, { width: trWidth || '48%' }]}>
              <FlatList
                data={sortedTransporters}
                keyExtractor={(item) => item.id.toString()}
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled={true}
                style={{ maxHeight: 280 }}
                showsVerticalScrollIndicator={true}
                persistentScrollbar={true}
                contentContainerStyle={{ paddingVertical: 4 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      onChange("transporter", item.name);
                      clearTransporters();
                    }}
                  >
                    <Ionicons name="bus-outline" size={16} color={C.blue} style={{ marginRight: 10 }} />
                    <Text style={styles.transporterName}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        )}

        {/* SO & Attachments Section - ONLY RENDER IF DISPATCH ID EXISTS */}
        {dispatchId ? (
          <View style={{ flex: 1 }}>
            <View style={styles_sales.inputRow}>
              <View style={styles_sales.inputWrap}>
                <TextInput
                  ref={soRef}
                  value={value}
                  onChangeText={setValue}
                  placeholder={keyboardDisabled ? "Scan SO..." : "Scan or enter SO"}
                  placeholderTextColor={C_sales.sub}
                  style={[styles_sales.input, { paddingRight: 44 }]}
                  returnKeyType="done"
                  onSubmitEditing={() => addSO(value)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  showSoftInputOnFocus={!keyboardDisabled}
                />
                <Pressable onPress={openScanner} style={styles_sales.scanBtn}>
                  <MaterialCommunityIcons
                    name="qrcode-scan"
                    size={20}
                    color={C.accent}
                  />
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
                Total SOs: <Text style={styles_sales.totalNum}>{total}</Text> |
                Attachments:{" "}
                <Text style={styles_sales.totalNum}>{totalAttachments}</Text>
              </Text>
            </View>

            {/* SO List */}
            <View style={[styles_sales.tableCard, { marginTop: 12 }]}>
              <View style={[styles_sales.row, styles_sales.headerRow]}>
                <Text style={[styles_sales.th, { width: 40 }]}>S/No</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles_sales.th}>SO Number</Text>
                  <TouchableOpacity 
                      onPress={toggleSortMode}
                      style={{
                          padding: 4,
                          backgroundColor: '#E5E7EB',
                          borderRadius: 6,
                          marginLeft: 6
                      }}
                  >
                      <MaterialCommunityIcons 
                          name={getSortIcon()} 
                          size={16} 
                          color={C.accent} 
                      />
                  </TouchableOpacity>
                </View>
                <Text style={[styles_sales.th, { width: 80 }]}>Time</Text>
                <Text
                  style={[styles_sales.th, { width: 72, textAlign: "right" }]}
                >
                  Action
                </Text>
              </View>
              <FlatList
                style={{ flex: 1 }}
                data={sortedItems}

                keyExtractor={(it) => it.linkId.toString()}
                contentContainerStyle={
                  items.length === 0 && { paddingVertical: 24 }
                }
                ItemSeparatorComponent={() => (
                  <View style={styles_sales.divider} />
                )}
                renderItem={({ item, index }) => (
                  <View style={styles_sales.row}>
                    <Text style={[styles_sales.td, { width: 40 }]}>
                      {sortMode === 'desc' ? items.length - index : index + 1}
                    </Text>
                    <Text style={[styles_sales.td, { flex: 1 }]}>
                      {item.soId}
                    </Text>
                    <Text style={[styles_sales.td, { width: 80 }]}>
                      {formatTime(item.createdAt)}
                    </Text>
                    <View
                      style={[
                        { width: 72, alignItems: "flex-end" },
                      ]}
                    >
                      <Pressable
                        onPress={() => removeSO(item.linkId)}
                        style={({ pressed }) => [
                          styles_sales.iconBtn,
                          pressed && { backgroundColor: C_sales.hover },
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={C_sales.danger}
                        />
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* ---------- MODALS ---------- */}
      <Modal visible={showNewFormModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Start New Form</Text>
            <Text style={styles.confirmationMessage}>
              This will clear all current data.
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
            <TouchableOpacity
              onPress={() => setShowError(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------- FILE MODAL ---------- */}
      <UploadModal
        visible={showFileModal}
        dispatchId={dispatchId!} // guarded by openFilePicker
        onClose={() => {
          setShowFileModal(false);
          loadAttachments(); // Refresh badge count
        }}
        onUploadSuccess={() => {
          loadAttachments(); // Refresh list + badge
        }}
      />

      {/* ---------- SCANNER MODAL ---------- */}
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
               barcodeTypes: [
                "qr", "code128", "ean13", "ean8", "upc_a", "upc_e", 
                "code39", "codabar", "code93", "pdf417", "datamatrix"
              ],
            }}
            onBarcodeScanned={handleScanned}
          />
          
          {/* Top Bar */}
          <View style={styles_scan.fullscreenTopBar}>
            <Text style={styles_scan.fullscreenTitle}>Multi-Scan Mode</Text>
            <Pressable onPress={closeScanner} style={styles_scan.fullscreenCloseBtn}>
              <Text style={styles_scan.closeBtnText}>Done</Text>
            </Pressable>
          </View>
          
          {/* Bottom Bar with Feedback */}
          <View style={styles_scan.fullscreenBottomBar}>
            <Text style={styles_scan.fullscreenHint}>Align codes within frame to scan</Text>
            {sessionCount > 0 && (
               <View style={styles_scan.scanFeedback}>
                  <Text style={styles_scan.scanCounter}>Scanned: {sessionCount}</Text>
                  {lastScannedCode && (
                     <Text style={styles_scan.lastScanText} numberOfLines={1}>
                        Last: {lastScannedCode}
                     </Text>
                  )}
               </View>
            )}
          </View>
          
          {/* Focus Frame Overlay */}
          <View style={styles_scan.focusFrameContainer} pointerEvents="none">
             <View style={[styles_scan.focusFrame, sessionCount > 0 ? { borderColor: "#10B981" } : null]} />
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
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: C.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    justifyContent: "space-between",
  },
  arrowBtn: { padding: 6 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  addNewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.grayBtn,
  },
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
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: C.text,
    backgroundColor: "#fff",
    height: 48,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 8, marginBottom: 10 },
  half: { flex: 1, marginBottom: 0 },
  saveBtn: {
    backgroundColor: C.blue,
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledBtn: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "80%",
  },
  errorModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "80%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: C.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: { color: "#fff", fontWeight: "600" },
  confirmationModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  confirmationMessage: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmationButtons: { flexDirection: "row", gap: 12, width: "100%" },
  confirmationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  confirmButton: { backgroundColor: "#2151F5" },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  confirmButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  dropdownOverlay: {
    position: 'absolute',
    top: 58, // Exactly below the header row
    left: 14, // Matches container horizontal padding
    right: 14,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  transporterName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  clearInputBtn: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  spinnerIcon: {
    position: 'absolute',
    right: 35,
    top: 14,
  },
});

const styles_sales = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputWrap: { position: "relative", flex: 1 },
  input: {
    backgroundColor: C_sales.card,
    borderColor: C_sales.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C_sales.text,
  },
  scanBtn: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: "center",
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
  tableCard: {
    flex: 1,
    marginTop: 4,
    backgroundColor: C_sales.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C_sales.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerRow: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: C_sales.border,
  },
  th: { fontSize: 11, fontWeight: "700", color: C_sales.text },
  td: { fontSize: 12, color: C_sales.text },
  divider: { height: 1, backgroundColor: C_sales.border },
  iconBtn: {
    height: 24,
    width: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

const styles_scan = StyleSheet.create({
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 44 : 16,
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  fullscreenCloseBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    fontWeight: "700", color: "#000", fontSize: 14
  },
  fullscreenBottomBar: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  fullscreenHint: { color: "#ccc", fontSize: 13 },
  scanFeedback: {
     alignItems: "center",
     width: "100%",
  },
  scanCounter: { color: "#4ADE80", fontWeight: "700", fontSize: 16 },
  lastScanText: { color: "#fff", fontSize: 14, marginTop: 2, textAlign: "center", width: "100%" },
  
  focusFrameContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  focusFrame: {
    width: 260, height: 260, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24
  }
});
