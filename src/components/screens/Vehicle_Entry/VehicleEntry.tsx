// src/screens/VehicleEntry.tsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef, // ← Added
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
  Animated,
  Keyboard, // Optional: dismiss keyboard if needed
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useVehicleEntry, Customer } from "../../Api/Hooks/UseVehicleEntry";
import UploadImages from "./upload_Images";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  VehicleEntryDraft,
} from "../../Storage/VehicleEntry_Stroage";

// Reusable Clean Modal (unchanged)
const CleanModal = ({
  visible,
  title,
  message,
  type = "info",
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title?: string;
  message: string;
  type?: "success" | "error" | "confirm" | "info";
  onConfirm?: () => void;
  onCancel?: () => void;
}) => {
  const scaleValue = new Animated.Value(0.3);
  const opacityValue = new Animated.Value(0.3);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const iconColor =
    type === "success"
      ? "#28a745"
      : type === "error"
      ? "#dc3545"
      : type === "confirm"
      ? "#dc3545"
      : "#007bff";

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.cleanModalCard,
            {
              transform: [{ scale: scaleValue }],
              opacity: opacityValue,
            },
          ]}
        >
          {type === "success" && (
            <Ionicons name="checkmark-circle" size={56} color="#28a745" style={{ marginBottom: 12 }} />
          )}
          {type === "error" && (
            <Ionicons name="close-circle" size={56} color="#dc3545" style={{ marginBottom: 12 }} />
          )}

          {title && <Text style={styles.cleanModalTitle}>{title}</Text>}
          <Text style={styles.cleanModalMessage}>{message}</Text>

          <View style={styles.cleanModalButtons}>
            {type === "confirm" && onCancel && (
              <Pressable style={styles.keepBtn} onPress={onCancel}>
                <Text style={styles.keepBtnText}>Keep</Text>
              </Pressable>
            )}

            <Pressable
              style={[
                styles.actionBtn,
                type === "confirm" || type === "error" ? styles.clearBtn : styles.okBtn,
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.actionBtnText}>
                {type === "confirm" ? "Clear" : "OK"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function VehicleEntryScreen() {
  const customerInputRef = useRef<TextInput>(null); // ← For auto-focus

  const {
    customers,
    loadingCustomers,
    saving,
    error,
    debouncedSearch,
    saveVehicleEntry,
    clearCustomers,
  } = useVehicleEntry();

  // === Local State ===
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [driverNumber, setDriverNumber] = useState("");
  const [photos, setPhotos] = useState<any[]>([]);
  const [savedEntryId, setSavedEntryId] = useState<number | null>(null);
  
  // This controls whether Save button is allowed (false after successful save)
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({});

  // === Auto-focus on mount ===
  useEffect(() => {
    const timer = setTimeout(() => {
      customerInputRef.current?.focus();
    }, 300); // Small delay ensures view is ready
    return () => clearTimeout(timer);
  }, []);

  // === Load draft ===
  useEffect(() => {
    (async () => {
      const draft = await loadDraft();
      if (draft) {
        setCustomerQuery(draft.customerQuery ?? "");
        setSelectedCustomer(draft.selectedCustomer ?? null);
        setVehicleNumber(draft.vehicleNumber ?? "");
        setTransporterName(draft.transporterName ?? "");
        setDriverNumber(draft.driverNumber ?? "");
        setPhotos(draft.photos ?? []);
        setSavedEntryId(draft.savedEntryId ?? null);
        setIsSavedSuccessfully(draft.entrySaved ?? false);
      }
    })();
  }, []);

  // === Auto-save draft ===
  const persistDraft = useCallback(() => {
    const draft: VehicleEntryDraft = {
      customerQuery,
      selectedCustomer,
      vehicleNumber,
      transporterName,
      driverNumber,
      photos,
      savedEntryId,
      entrySaved: isSavedSuccessfully,
    };
    saveDraft(draft);
  }, [
    customerQuery,
    selectedCustomer,
    vehicleNumber,
    transporterName,
    driverNumber,
    photos,
    savedEntryId,
    isSavedSuccessfully,
  ]);

  useEffect(() => {
    persistDraft();
  }, [persistDraft]);

  // === Permissions ===
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    })();
  }, []);

  // === Validation ===
  const formatVehicleNumber = (text: string) => {
    const cleaned = text.replace(/\s+/g, "").toUpperCase();
    setVehicleNumber(cleaned);
  };

  const isDriverValid = (d: string) => /^\d{10}$/.test(d);
  const isFormValid = () =>
    selectedCustomer &&
    vehicleNumber.trim().length >= 6 &&
    transporterName.trim() !== "" &&
    isDriverValid(driverNumber);

  // === Save Handler ===
  const handleSave = async () => {
    if (!isFormValid()) {
      setModalConfig({
        type: "error",
        message: "Please fill all required fields correctly.",
        onConfirm: () => setModalVisible(false),
      });
      setModalVisible(true);
      return;
    }

    // Prevent double save
    if (isSavedSuccessfully) return;

    const result = await saveVehicleEntry({
      customerName: selectedCustomer!.name,
      vehicleNumber: vehicleNumber.trim(),
      transporterName: transporterName.trim(),
      driverNumber,
    });

    if (result?.id) {
      setSavedEntryId(result.id);
      setIsSavedSuccessfully(true); // ← Block future saves

      setModalConfig({
        type: "success",
        title: "Success!",
        message: "Vehicle entry saved successfully!",
        onConfirm: () => setModalVisible(false),
      });
    } else {
      setModalConfig({
        type: "error",
        message: error || "Failed to save entry. Please try again.",
        onConfirm: () => setModalVisible(false),
      });
    }
    setModalVisible(true);
  };

  // === Clear All & Reset Form ===
  const clearAll = () => {
    setModalConfig({
      type: "confirm",
      title: "Clear Form?",
      message: "This will clear all fields and allow a new entry.",
      onConfirm: async () => {
        // Reset everything
        setCustomerQuery("");
        setSelectedCustomer(null);
        clearCustomers();
        setVehicleNumber("");
        setTransporterName("");
        setDriverNumber("");
        setPhotos([]);
        setSavedEntryId(null);
        setIsSavedSuccessfully(false); // ← Re-enable save button

        await clearDraft();
        setModalVisible(false);

        // Refocus customer input after clear
        setTimeout(() => customerInputRef.current?.focus(), 300);
      },
      onCancel: () => setModalVisible(false),
    });
    setModalVisible(true);
  };

  // === Determine Save Button State ===
  const canSave = isFormValid() && !isSavedSuccessfully && !saving;

  return (
    <View style={styles.container}>
      {/* Customer Search - Auto Focus */}
      <TextInput
        ref={customerInputRef}
        style={styles.input}
        placeholder="Search Customer Name"
        value={customerQuery}
        onChangeText={(text) => {
          setCustomerQuery(text);
          setSelectedCustomer(null);
          if (isSavedSuccessfully) setIsSavedSuccessfully(false); // allow edit → re-enable save
          debouncedSearch(text);
        }}
        editable={!isSavedSuccessfully} // optional: lock input after save
      />

      {loadingCustomers && (
        <ActivityIndicator style={{ marginTop: 8 }} color="#007AFF" />
      )}

      {customers.length > 0 && !selectedCustomer && (
        <FlatList
          style={styles.dropdown}
          data={customers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setSelectedCustomer(item);
                setCustomerQuery(item.name);
                clearCustomers();
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.customerName}>{item.name}</Text>
              <Text style={styles.customerAddr}>{item.address}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Vehicle Number */}
      <TextInput
        style={styles.input}
        placeholder="Vehicle Number*"
        value={vehicleNumber}
        onChangeText={formatVehicleNumber}
        autoCapitalize="characters"
        editable={!isSavedSuccessfully}
      />

      {/* Driver Mobile */}
      <TextInput
        style={styles.input}
        placeholder="Driver Mobile (10 digits) *"
        value={driverNumber}
        keyboardType="number-pad"
        maxLength={10}
        onChangeText={(t) => setDriverNumber(t.replace(/[^0-9]/g, ""))}
        editable={!isSavedSuccessfully}
      />
      {driverNumber.length > 0 && !isDriverValid(driverNumber) && (
        <Text style={styles.errorText}>Enter exactly 10 digits</Text>
      )}

      {/* Transporter Name */}
      <TextInput
        style={styles.input}
        placeholder="Transporter Name *"
        value={transporterName}
        onChangeText={setTransporterName}
        editable={!isSavedSuccessfully}
      />

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.saveBtn,
            !canSave && styles.btnDisabled,
          ]}
          onPress={handleSave}
          disabled={!canSave}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>
                {isSavedSuccessfully ? "Saved" : "Save"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.clearBtn]}
          onPress={clearAll}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Upload Images Section - Only after save */}
      {isSavedSuccessfully && savedEntryId && (
        <View>
          <UploadImages
            vehicleEntryId={savedEntryId}
            photos={photos}
            setPhotos={setPhotos}
            onUploadSuccess={() => {}}
          />
        </View>
      )}
      {/* Clean Modal */}
      <CleanModal
        visible={modalVisible}
        title={modalConfig.title}
        message={modalConfig.message || ""}
        type={modalConfig.type || "info"}
        onConfirm={modalConfig.onConfirm || (() => setModalVisible(false))}
        onCancel={modalConfig.onCancel}
      />
    </View>
  );
}

// Styles (only added successBox back + minor tweak)
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f8f9fa" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    marginTop: 12,
  },
  dropdown: {
    maxHeight: 200,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  customerName: { fontSize: 16, fontWeight: "600" },
  customerAddr: { fontSize: 13, color: "#666", marginTop: 2 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  saveBtn: { backgroundColor: "#007AFF" },
  clearBtn: { backgroundColor: "#FF3B30" },
  btnDisabled: { backgroundColor: "#aaa", opacity: 0.7 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#d32f2f", marginTop: 6, fontSize: 13 },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d4edda",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#c3e6cb",
  },
  successText: {
    marginLeft: 10,
    color: "#155724",
    fontWeight: "600",
    fontSize: 15,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  cleanModalCard: {
    backgroundColor: "#fff",
    width: "88%",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  cleanModalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#212529",
    marginBottom: 8,
  },
  cleanModalMessage: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  cleanModalButtons: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
    justifyContent: "center",
  },
  keepBtn: {
    backgroundColor: "#e9ecef",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    minWidth: 110,
  },
  keepBtnText: {
    color: "#212529",
    fontSize: 16,
    fontWeight: "600",
  },
  actionBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    minWidth: 110,
  },
  okBtn: { backgroundColor: "#007AFF" },
  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});