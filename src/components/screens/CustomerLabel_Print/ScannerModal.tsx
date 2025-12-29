// src/screens/ScannerModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
} from "react-native";
import { CameraView, BarcodeScanningResult } from "expo-camera";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const COLORS = {
  accent: "#3b82f6",
};

type ScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  scanLock: boolean;
};

export default function ScannerModal({
  visible,
  onClose,
  onBarcodeScanned,
  scanLock,
}: ScannerModalProps) {
  return (
    <Modal visible={visible} transparent={false} animationType="slide">
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
          onBarcodeScanned={scanLock ? undefined : onBarcodeScanned}
        />

        {/* Top Overlay */}
        <View style={styles.overlayTop}>
          <Text style={styles.scanTitle}>Scan SO Barcode</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
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
          <Text style={styles.scanHint}>
            Align barcode within the frame
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlayTop: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  scanTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    padding: 10,
  },
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