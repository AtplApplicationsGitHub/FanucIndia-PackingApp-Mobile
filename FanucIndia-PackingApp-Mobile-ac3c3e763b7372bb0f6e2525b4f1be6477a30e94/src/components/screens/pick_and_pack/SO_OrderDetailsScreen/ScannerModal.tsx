// src/screens/pick_and_pack/SO_OrderDetailsScreen/ScannerModal.tsx

import React from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Text,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, BarcodeScanningResult } from "expo-camera";

const C = {
  danger: "#B91C1C",
};

type ScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  scanLock: boolean;
};

const ScannerModal: React.FC<ScannerModalProps> = ({
  visible,
  onClose,
  onBarcodeScanned,
  scanLock,
}) => {
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
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
              "pdf417",
              "code128",
              "code39",
              "code93",
              "codabar",
              "ean13",
              "ean8",
              "upc_a",
              "upc_e",
            ],
          }}
          onBarcodeScanned={scanLock ? undefined : onBarcodeScanned}
        />

        {/* Top Bar */}
        <View style={styles.fullscreenTopBar}>
          <Text style={styles.fullscreenTitle}>Scan a code</Text>
          <Pressable onPress={onClose} style={styles.fullscreenCloseBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Bottom Hint */}
        <View style={styles.fullscreenBottomBar}>
          <Text style={styles.fullscreenHint}>
            Align the code within the frame
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  fullscreenTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    flex: 1,
  },
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

export default ScannerModal;