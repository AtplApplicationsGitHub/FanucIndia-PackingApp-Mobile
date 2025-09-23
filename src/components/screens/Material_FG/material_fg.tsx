// src/screens/MaterialFGTransferScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

type ScanItem = {
  id: string;
  location: string;
  soNumber: string;
  timeISO: string; // store ISO for sorting; show hh:mm am/pm in UI
};

const COLORS = {
  bg: "#F7F7F8",
  card: "#FFFFFF",
  border: "#E6E7EB",
  text: "#0B0F19",
  subtext: "#667085",
  accent: "#111827", // dark
  primary: "#FACC15", // yellow-400
  primarySoft: "#FFF7CC",
  danger: "#EF4444",
  muted: "#9CA3AF",
  tableStripe: "#FAFAFB",
};

// ---------- Helpers ----------
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const hh = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${hh}:${mm} ${ampm}`;
};

// ---------- Lightweight “modern” modal ----------
type DialogProps = {
  visible: boolean;
  icon?: React.ReactNode;
  title: string;
  message?: string;
  cancelText?: string;
  okText?: string;
  destructive?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  oneButton?: boolean;
};
const Dialog: React.FC<DialogProps> = ({
  visible,
  icon,
  title,
  message,
  cancelText = "Cancel",
  okText = "OK",
  destructive,
  onCancel,
  onOk,
  oneButton,
}) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
    <View style={styles.modalBackdrop}>
      <Pressable style={styles.modalBackdropTouchable} onPress={onCancel} />
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          {icon}
          <Text style={styles.modalTitle}>{title}</Text>
        </View>
        {!!message && <Text style={styles.modalMessage}>{message}</Text>}

        <View style={styles.modalActions}>
          {!oneButton && (
            <TouchableOpacity style={[styles.btn, styles.btnGhost2]} onPress={onCancel}>
              <Text style={[styles.btnGhost2Text]}>{cancelText}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.btn,
              destructive ? styles.btnDestructive : styles.btnPrimary2,
              oneButton && { flex: 1 },
            ]}
            onPress={onOk}
          >
            <Text style={styles.btnPrimary2Text}>{okText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const MaterialFGTransferScreen: React.FC = () => {
  const [location, setLocation] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [items, setItems] = useState<ScanItem[]>([]);

  const locationRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  // ----- dialogs state -----
  const [confirmClear, setConfirmClear] = useState(false);
  const [messageDlg, setMessageDlg] = useState<{
    show: boolean;
    title: string;
    subtitle?: string;
    onOk?: () => void;
  }>({ show: false, title: "" });

  const totalScanned = items.length;

  // Auto-focus Location on mount
  useEffect(() => {
    const t = setTimeout(() => locationRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const showMessage = (title: string, subtitle?: string) =>
    setMessageDlg({ show: true, title, subtitle });

  const addItem = () => {
    const loc = location.trim();
    const so = soNumber.trim();

    if (!loc) {
      showMessage("Missing location", "Please enter or scan a location.");
      locationRef.current?.focus();
      return;
    }
    if (!so) {
      showMessage("Missing SO number", "Please enter or scan a Sales Order number.");
      soRef.current?.focus();
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timeISO = new Date().toISOString();

    setItems((prev) => [{ id, location: loc, soNumber: so, timeISO }, ...prev]);
    setSoNumber("");
    soRef.current?.focus();
  };

  const clearForm = () => {
    setLocation("");
    setSoNumber("");
    setConfirmClear(false);
    setTimeout(() => locationRef.current?.focus(), 50);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Make the whole screen scrollable */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Form Card */}
          <View style={styles.card}>
            <View style={styles.field}>
              <Ionicons name="location-outline" size={18} color={COLORS.muted} />
              <TextInput
                ref={locationRef}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter/scan Location"
                placeholderTextColor={COLORS.muted}
                returnKeyType="next"
                onSubmitEditing={() => soRef.current?.focus()}
                style={styles.input}
                autoCapitalize="characters"
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.field}>
              <MaterialCommunityIcons name="barcode-scan" size={18} color={COLORS.muted} />
              <TextInput
                ref={soRef}
                value={soNumber}
                onChangeText={setSoNumber}
                placeholder="Enter/scan SO number (Enter to save)"
                placeholderTextColor={COLORS.muted}
                returnKeyType="done"
                onSubmitEditing={addItem} // ENTER to save
                style={styles.input}
                autoCapitalize="none"
                keyboardType="default"
              />
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={addItem} activeOpacity={0.85}>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => setConfirmClear(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle-outline" size={18} color={COLORS.accent} />
                <Text style={styles.btnGhostText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Table Card */}
          <View style={styles.tableCard}>
            <Text style={styles.metric}>
              <Text style={styles.metricLabel}>Total Scanned: </Text>
              <Text style={styles.metricValue}>{totalScanned}</Text>
            </Text>

            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 0.6, textAlign: "left" }]}>S/No</Text>
              <Text style={[styles.th, { flex: 2 }]}>Location</Text>
              <Text style={[styles.th, { flex: 2 }]}>SO Number</Text>
              <Text style={[styles.th, { flex: 1.4 }]}>Time</Text>
            </View>

            {/* Let ScrollView handle scrolling; disable scrolling inside FlatList */}
            <FlatList
              data={items}
              keyExtractor={(x) => x.id}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={28}
                    color={COLORS.muted}
                  />
                  <Text style={styles.emptyText}>No scans yet</Text>
                  <Text style={styles.emptySub}>
                    Scan a location and SO, then press Save (or press Enter).
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={() =>
                    setMessageDlg({
                      show: true,
                      title: "Remove entry?",
                      subtitle: `SO ${item.soNumber} @ ${item.location}`,
                      onOk: () => {
                        removeItem(item.id);
                        setMessageDlg({ show: false, title: "" });
                      },
                    })
                  }
                  onPress={() =>
                    setMessageDlg({
                      show: true,
                      title: "Remove entry?",
                      subtitle: `SO ${item.soNumber} @ ${item.location}`,
                      onOk: () => {
                        removeItem(item.id);
                        setMessageDlg({ show: false, title: "" });
                      },
                    })
                  }
                >
                  <View
                    style={[
                      styles.tr,
                      { backgroundColor: index % 2 === 0 ? COLORS.tableStripe : "#FFFFFF" },
                    ]}
                  >
                    <Text style={[styles.td, { flex: 0.6, textAlign: "left" }]}>
                      {totalScanned - index}
                    </Text>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
                      {item.location}
                    </Text>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
                      {item.soNumber}
                    </Text>
                    <Text style={[styles.td, { flex: 1.4 }]}>{fmtTime(item.timeISO)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirm Clear Dialog */}
      <Dialog
        visible={confirmClear}
        icon={<Ionicons name="trash-outline" size={22} color={COLORS.danger} />}
        title="Clear fields?"
        message="This will clear Location and SO inputs."
        cancelText="Keep"
        okText="Clear"
        destructive
        onCancel={() => setConfirmClear(false)}
        onOk={clearForm}
      />

      {/* Message Dialog (validation + row actions) */}
      <Dialog
        visible={messageDlg.show}
        icon={<Ionicons name="information-circle-outline" size={22} color={COLORS.accent} />}
        title={messageDlg.title}
        message={messageDlg.subtitle}
        okText="OK"
        oneButton={!messageDlg.onOk}
        onOk={
          messageDlg.onOk
            ? messageDlg.onOk
            : () => setMessageDlg({ show: false, title: "" })
        }
        onCancel={() => setMessageDlg({ show: false, title: "" })}
      />
    </SafeAreaView>
  );
};

export default MaterialFGTransferScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 20,
    flexGrow: 1,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  btnGhost: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGhostText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 16,
  },

  tableCard: {
    marginTop: 14,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: "hidden",
  },
  metric: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  metricLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: "600",
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#FCFCFD",
  },
  th: {
    fontWeight: "700",
    fontSize: 12,
    color: COLORS.subtext,
  },
  tr: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  td: {
    fontSize: 14,
    color: COLORS.text,
  },
  emptyWrap: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
  },
  emptyText: {
    fontWeight: "700",
    color: COLORS.text,
  },
  emptySub: {
    color: COLORS.subtext,
    fontSize: 12,
  },

  // modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modalBackdropTouchable: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "stretch",
    gap: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  modalMessage: { color: COLORS.subtext, fontSize: 14 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4, justifyContent: "flex-end" },

  btn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  btnGhost2: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGhost2Text: { color: COLORS.text, fontWeight: "700" },
  btnPrimary2: { backgroundColor: COLORS.accent },
  btnPrimary2Text: { color: "#fff", fontWeight: "700" },
  btnDestructive: { backgroundColor: COLORS.danger },
});
