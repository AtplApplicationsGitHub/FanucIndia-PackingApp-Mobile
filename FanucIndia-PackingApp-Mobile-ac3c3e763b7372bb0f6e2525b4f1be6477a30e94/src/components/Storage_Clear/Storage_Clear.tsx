// src/components/Storage_Clear/Storage_Clear.tsx
import React, { FC, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  TouchableOpacity,
  Modal,
  View,
  Text,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";

type ClearStorageModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const ClearStorageModal: FC<ClearStorageModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Ionicons name="warning" size={22} color="#FFA000" />
            <Text style={styles.modalTitle}>Clear Storage</Text>
          </View>

          <Text style={styles.modalMessage}>
            Are you sure you want to clear all local storage data? This action cannot be undone.
          </Text>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={onConfirm}>
              <Text style={styles.confirmButtonText}>Clear Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

type MessageModalProps = {
  visible: boolean;
  message: string;
  onClose: () => void;
};

const SuccessModal: FC<MessageModalProps> = ({ visible, message, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.headerRow}>
            <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
            <Text style={styles.modalTitle}>Success</Text>
          </View>

          <Text style={styles.modalMessage}>{message}</Text>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.button, styles.successButton]} onPress={onClose}>
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const ErrorModal: FC<MessageModalProps> = ({ visible, message, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.headerRow}>
            <Ionicons name="close-circle" size={22} color="#F44336" />
            <Text style={styles.modalTitle}>Error</Text>
          </View>

          <Text style={styles.modalMessage}>{message}</Text>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.button, styles.errorButton]} onPress={onClose}>
              <Text style={styles.errorButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const RefreshButton: FC = () => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleRefresh = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmClear = async () => {
    setShowConfirmModal(false);
    try {
      await AsyncStorage.clear();
      setSuccessMessage("All local storage data has been cleared successfully.");
      setShowSuccessModal(true);
    } catch (err) {
      console.error("AsyncStorage.clear error:", err);
      setErrorMessage("Failed to clear storage. Please try again.");
      setShowErrorModal(true);
    }
  };

  const closeModals = () => {
    setShowConfirmModal(false);
    setShowSuccessModal(false);
    setShowErrorModal(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleRefresh}
        style={{ padding: 6, backgroundColor: "transparent" }}
        activeOpacity={0.7}
      >
        <Ionicons name="refresh-outline" size={24} color="#2151F5" />
      </TouchableOpacity>

      <ClearStorageModal visible={showConfirmModal} onClose={closeModals} onConfirm={handleConfirmClear} />

      <SuccessModal visible={showSuccessModal} message={successMessage} onClose={closeModals} />

      <ErrorModal visible={showErrorModal} message={errorMessage} onClose={closeModals} />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 22,
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
    color: "#333",
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 20,
    color: "#666",
    marginBottom: 18,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 10,
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: "#FF3B30",
  },
  confirmButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  successButton: {
    backgroundColor: "#4CAF50",
    flex: 1,
  },
  successButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  errorButton: {
    backgroundColor: "#F44336",
    flex: 1,
  },
  errorButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
