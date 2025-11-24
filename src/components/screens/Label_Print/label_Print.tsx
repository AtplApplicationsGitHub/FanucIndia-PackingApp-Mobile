// src/screens/CustomerLabelPrint.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Pressable,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { useVerifySO } from "../../Api/Hooks/label_Print";

type SOItem = {
  id: string;
  soNumber: string;
};

const COLORS = {
  accent: "#3b82f6",
  muted: "#9ca3af",
  bg: "#f3f6fb",
  success: "#10b981",
  danger: "#ef4444",
  primary: "#2563eb",
};

export default function CustomerLabelPrint(): JSX.Element {
  const [soNumber, setSoNumber] = useState<string>("");
  const [sos, setSos] = useState<SOItem[]>([]);

  // Customer state — locked after first valid SO
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const [isCustomerLocked, setIsCustomerLocked] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Scanner
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const { verifySO, loading, error: verifyError } = useVerifySO();

  // Request permission on mount
  useEffect(() => {
    requestPermission();
  }, []);

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan barcodes.");
        return;
      }
    }
    scanLockRef.current = false;
    setScanModalVisible(true);
  };

  const closeScanner = () => {
    setScanModalVisible(false);
    scanLockRef.current = false;
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const data = result.data?.trim();
    if (data) {
      addSO(data);
      setTimeout(() => closeScanner(), 800);
    } else {
      scanLockRef.current = false;
    }
  };

  const addSO = async (value?: string) => {
    const soToAdd = (value || soNumber).trim().toUpperCase();

    if (!soToAdd) {
      Alert.alert("Invalid Input", "Please enter or scan a Sales Order number.");
      scanLockRef.current = false;
      return;
    }

    if (sos.some((item) => item.soNumber === soToAdd)) {
      Alert.alert("Duplicate", `SO "${soToAdd}" is already in the list.`);
      setSoNumber("");
      inputRef.current?.focus();
      scanLockRef.current = false;
      return;
    }

    if (loading) return;

    const result = await verifySO(soToAdd);

    if (!result) {
      Alert.alert(
        "Invalid SO",
        verifyError || "SO not found or invalid. Please check and try again."
      );
      setSoNumber("");
      inputRef.current?.focus();
      scanLockRef.current = false;
      return;
    }

    const { customerName: newName, address: newAddress } = result;

    // Lock customer on first successful SO
    if (!isCustomerLocked) {
      setCustomerName(newName);
      setCustomerAddress(newAddress);
      setIsCustomerLocked(true);
    } else {
      // Validate same customer
      if (customerName !== newName || customerAddress !== newAddress) {
        Alert.alert(
          "Customer Mismatch",
          "This SO belongs to a different customer. All SOs must be for the same customer.",
          [{ text: "OK" }]
        );
        scanLockRef.current = false;
        return;
      }
    }

    // Success: Add to list
    const newItem: SOItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      soNumber: soToAdd,
    };
    setSos((prev) => [newItem, ...prev]);
    setSoNumber("");
    inputRef.current?.focus();
    scanLockRef.current = false;
  };

  const onPrint = () => {
    if (sos.length === 0) {
      Alert.alert("Nothing to Print", "Please add at least one Sales Order.");
      return;
    }

    Alert.alert(
      "Print Labels",
      `Customer: ${customerName}\nAddress: ${customerAddress}\n\nPrint ${sos.length} label(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Print",
          onPress: () => {
            console.log("Printing labels:", {
              customerName,
              customerAddress,
              salesOrders: sos.map((s) => s.soNumber),
            });
            // TODO: Call your actual print API here
          },
        },
      ]
    );
  };

  const onClearAll = () => {
    Alert.alert("Clear All", "Remove all SOs and reset customer?", [
      { text: "Cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: () => {
          setSos([]);
          setCustomerName(null);
          setCustomerAddress(null);
          setIsCustomerLocked(false);
          setSoNumber("");
          inputRef.current?.focus();
        },
      },
    ]);
  };

  const renderRow = ({ item }: { item: SOItem }) => (
    <View style={styles.row}>
      <Text style={styles.soText}>{item.soNumber}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Input Card */}
      <View style={styles.inputCard}>
        <View style={styles.inputFieldWrapper}>
          <TextInput
            ref={inputRef}
            value={soNumber}
            onChangeText={setSoNumber}
            placeholder="Enter or scan SO"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={() => addSO()}
            editable={!loading}
          />

          <Pressable onPress={openScanner} style={styles.scanBtn} disabled={loading}>
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={22}
              color={loading ? "#ccc" : COLORS.accent}
            />
          </Pressable>

          <TouchableOpacity
            style={[styles.btnSmall, styles.saveBtn]}
            onPress={() => addSO()}
            disabled={loading || !soNumber.trim()}
          >
            <Text style={styles.saveBtnText}>
              {loading ? "Checking..." : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={[styles.btn, styles.printBtn]} onPress={onPrint}>
            <Ionicons name="print" size={18} color="#fff" />
            <Text style={styles.btnText}>Print Labels</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={onClearAll}>
            <Ionicons name="trash" size={18} color={COLORS.danger} />
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Card */}
      {isCustomerLocked && (
        <View style={styles.customerCard}>
          <Text style={styles.inputLabelSmall}>Customer Details (Locked)</Text>
          <View style={styles.fixedField}>
            <Text style={styles.fixedLabel}>Name:</Text>
            <Text style={styles.fixedValue}>{customerName}</Text>
          </View>
          <View style={[styles.fixedField, { marginTop: 10 }]}>
            <Text style={styles.fixedLabel}>Address:</Text>
            <Text style={styles.fixedValue}>{customerAddress}</Text>
          </View>
        </View>
      )}

      {/* SO List */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.headerText}>
            Sales Orders {sos.length > 0 ? `(${sos.length})` : ""}
          </Text>
        </View>

        <FlatList
          data={sos}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>
              {isCustomerLocked
                ? "No additional SOs added yet"
                : "Scan or enter the first SO to begin"}
            </Text>
          )}
        />
      </View>

      {/* Modern Full-Screen Scanner Modal */}
      <Modal visible={scanModalVisible} transparent={false} animationType="slide">
        <StatusBar hidden />
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "qr",
                "code128",
                "code39",
                "code93",
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "pdf417",
                "datamatrix",
              ],
            }}
            onBarcodeScanned={scanLockRef.current ? undefined : handleBarcodeScanned}
          />

          {/* Top Bar */}
          <View style={styles.overlayTop}>
            <Text style={styles.scanTitle}>Scan SO Barcode</Text>
            <Pressable onPress={closeScanner} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>

          {/* Scan Frame */}
          <View style={styles.scanFrame}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>

          {/* Bottom Hint */}
          <View style={styles.overlayBottom}>
            <Text style={styles.scanHint}>Align barcode within the frame</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Updated Styles (same beautiful look + modern scanner)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 17,
    paddingVertical :1,
  },
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginTop: 10,
  },
  inputFieldWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    height: 54,
  },
  input: { flex: 1, fontSize: 17, color: "#1f2937" },
  scanBtn: { padding: 10 },
  btnSmall: {
    marginLeft: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveBtn: { backgroundColor: COLORS.success },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  printBtn: { backgroundColor: COLORS.primary },
  clearBtn: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  btnText: { color: "#fff", marginLeft: 8, fontWeight: "600" },
  clearText: { color: COLORS.danger, marginLeft: 8, fontWeight: "600" },

  customerCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.success,
  },
  inputLabelSmall: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: "700",
    marginBottom: 8,
  },
  fixedField: { flexDirection: "row", alignItems: "flex-start" },
  fixedLabel: { fontSize: 15, color: "#64748b", width: 80, fontWeight: "600" },
  fixedValue: { fontSize: 15, color: "#1e293b", fontWeight: "500", flex: 1 },

  tableCard: {
    flex: 1,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tableHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  row: { paddingVertical: 16, paddingHorizontal: 16 },
  soText: { fontSize: 18, fontWeight: "600", color: "#1d4ed8" },
  separator: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 16 },
  emptyText: {
    textAlign: "center",
    color: COLORS.muted,
    padding: 40,
    fontStyle: "italic",
    fontSize: 15,
  },

  // Scanner UI (Modern & Beautiful)
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  overlayTop: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  scanTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
  closeBtn: { position: "absolute", right: 0, padding: 10 },
  scanFrame: {
    position: "absolute",
    top: "50%",
    left: "10%",
    right: "10%",
    height: 280,
    marginTop: -140,
    borderWidth: 2,
    borderColor: "rgba(59, 130, 246, 0.9)",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  cornerTopLeft: {
    position: "absolute",
    top: -12,
    left: -12,
    width: 50,
    height: 50,
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderColor: COLORS.accent,
  },
  cornerTopRight: {
    position: "absolute",
    top: -12,
    right: -12,
    width: 50,
    height: 50,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderColor: COLORS.accent,
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: -12,
    left: -12,
    width: 50,
    height: 50,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderColor: COLORS.accent,
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: -12,
    right: -12,
    width: 50,
    height: 50,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderColor: COLORS.accent,
  },
  overlayBottom: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scanHint: {
    color: "#fff",
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    fontWeight: "600",
  },
});