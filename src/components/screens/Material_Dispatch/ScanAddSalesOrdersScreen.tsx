// src/screens/ScanAddSalesOrdersScreen.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";

type SOEntry = {
  id: string;        // SO number
  createdAt: number; // epoch ms
};

const C = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  border: "#E6E8EF",
  text: "#0B1220",
  sub: "#6B7280",
  blue: "#2151F5",
  pill: "#F3F4F6",
  hover: "#F9FAFB",
  danger: "#EF4444",
  overlay: "rgba(0,0,0,0.35)",
};

const ScanAddSalesOrdersScreen: React.FC = () => {
  const [value, setValue] = useState("");
  const [items, setItems] = useState<SOEntry[]>([]);
  const total = useMemo(() => items.length, [items]);

  // Camera/scan state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  function normalizeSO(raw: string) {
    // Trim spaces, keep visible ascii, uppercase
    return raw.replace(/\s+/g, "").toUpperCase();
  }

  function addSO(raw: string) {
    const so = normalizeSO(raw);
    if (!so) return;
    setItems((prev) => {
      if (prev.some((x) => x.id === so)) return prev; // dedupe
      return [...prev, { id: so, createdAt: Date.now() }];
    });
    setValue("");
  }

  function removeSO(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
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

  async function openScanner() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    scanLock.current = false;
    setIsScannerOpen(true);
  }

  function closeScanner() {
    setIsScannerOpen(false);
    scanLock.current = false;
  }

  function handleBarcodeScan(result: BarcodeScanningResult) {
    if (scanLock.current) return;
    scanLock.current = true;

    // Prefer 'raw' if present; otherwise use 'data'
    const data = (result as any)?.raw ?? result.data ?? "";
    if (data) {
      Vibration.vibrate(40);
      addSO(String(data));
    }

    // Brief delay to avoid multiple triggers, then close
    setTimeout(() => {
      closeScanner();
    }, 250);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Title */}
        <Text style={styles.title}>Scan / Add Sales Orders</Text>

        {/* Input with embedded Scan button */}
        <View style={styles.inputWrap}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Scan or type SO, then press Enter"
            placeholderTextColor={C.sub}
            style={styles.input}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => addSO(value)}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType={Platform.select({ ios: "default", android: "visible-password" })}
          />
          <Pressable
            onPress={openScanner}
            hitSlop={10}
            style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="scan-outline" size={20} color={C.blue} />
          </Pressable>
        </View>

        {/* Total pill */}
        <View style={styles.totalPill}>
          <Text style={styles.totalText}>
            Total SOs: <Text style={styles.totalNum}>{total}</Text>
          </Text>
        </View>

        {/* Clear all */}
        <Pressable
          onPress={clearAll}
          style={({ pressed }) => [
            styles.clearBtn,
            pressed && { opacity: 0.9 },
            total === 0 && { opacity: 0.5 },
          ]}
          disabled={total === 0}
        >
          <Text style={styles.clearText}>Clear all</Text>
        </Pressable>

        {/* Table */}
        <View style={styles.tableCard}>
          {/* Header */}
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.th, { width: 40, textAlign: "left" }]}>#</Text>
            <Text style={[styles.th, { flex: 1 }]}>SO Number</Text>
            <Text style={[styles.th, { width: 80 }]}>Timing</Text>
            <Text style={[styles.th, { width: 72, textAlign: "right" }]}>Action</Text>
          </View>

          {/* Body */}
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={items.length === 0 && { paddingVertical: 24 }}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            ListEmptyComponent={<Text style={styles.empty}> </Text>}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <Text style={[styles.td, { width: 40 }]}>{index + 1}</Text>
                <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>
                  {item.id}
                </Text>
                <Text style={[styles.td, { width: 80 }]}>{formatTime(item.createdAt)}</Text>
                <View style={[styles.td, { width: 72, alignItems: "flex-end" }]}>
                  <Pressable
                    onPress={() => removeSO(item.id)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && { backgroundColor: C.hover },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={18} color={C.danger} />
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      </View>

      {/* Full-screen Scanner */}
      <Modal visible={isScannerOpen} animationType="slide" onRequestClose={closeScanner}>
        <View style={styles.cameraRoot}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchOn}
            onBarcodeScanned={handleBarcodeScan}
            barcodeScannerSettings={{
              // Wide support: QR + common 1D/2D formats
              barcodeTypes: [
                "qr",
                "aztec",
                "pdf417",
                "dataMatrix",
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code128",
                "code39",
                "code93",
                "itf14",
                "interleaved2of5",
              ],
            }}
          />

          {/* Top bar */}
          <View style={styles.camTopBar}>
            <Pressable onPress={closeScanner} hitSlop={10} style={styles.camTopBtn}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              <Text style={styles.camTopTitle}>Scan SO</Text>
            </Pressable>

            <Pressable
              onPress={() => setTorchOn((s) => !s)}
              hitSlop={10}
              style={styles.flashBtn}
            >
              <Ionicons
                name={torchOn ? "flashlight" : "flashlight-outline"}
                size={22}
                color="#FFFFFF"
              />
            </Pressable>
          </View>

          {/* Subtle frame guide */}
          <View style={styles.frameWrap}>
            <View style={styles.frame} />
            <Text style={styles.frameHint}>Align QR / Barcode within the frame</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ScanAddSalesOrdersScreen;

/* --------------------------- Styles --------------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, padding: 12 },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
    marginBottom: 10,
  },

  // Input with scan icon
  inputWrap: {
    position: "relative",
  },
  input: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 44, // space for the scan icon
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 15,
    color: C.text,
  },
  scanBtn: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    width: 32,
  },

  totalPill: {
    alignSelf: "stretch",
    marginTop: 10,
    backgroundColor: C.pill,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  totalText: { color: C.sub, fontSize: 13 },
  totalNum: { fontWeight: "700", color: C.text },
  clearBtn: {
    marginTop: 10,
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: C.text, fontWeight: "600" },
  tableCard: {
    marginTop: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
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
    borderBottomColor: C.border,
  },
  th: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
  },
  td: {
    fontSize: 14,
    color: C.text,
  },
  divider: { height: 1, backgroundColor: C.border },
  iconBtn: {
    height: 30,
    width: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    textAlign: "center",
    color: C.sub,
    fontSize: 13,
  },

  // Camera styles
  cameraRoot: { flex: 1, backgroundColor: "#000" },
  camTopBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  camTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: C.overlay,
    borderRadius: 10,
  },
  camTopTitle: { color: "#FFF", fontWeight: "700", fontSize: 16, marginLeft: 2 },
  flashBtn: {
    padding: 8,
    backgroundColor: C.overlay,
    borderRadius: 10,
  },

  frameWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "20%",
    alignItems: "center",
  },
  frame: {
    width: "72%",
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
  },
  frameHint: {
    color: "#FFF",
    marginTop: 12,
    fontSize: 13,
    textAlign: "center",
    opacity: 0.9,
  },
});
