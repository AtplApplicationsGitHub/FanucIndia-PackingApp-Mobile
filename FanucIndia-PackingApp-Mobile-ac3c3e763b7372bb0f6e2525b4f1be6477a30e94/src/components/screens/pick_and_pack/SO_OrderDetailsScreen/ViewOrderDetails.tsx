import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const C = {
  pageBg: "#F7F7F8",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  greenBg: "#E6F9EC",
  accent: "#111827",
  greenText: "#166534",
  yellowBg: "#FEF3C7",
  yellowText: "#92400E",
  primaryBtn: "#111827",
  primaryBtnText: "#FFFFFF",
  icon: "#111827",
  danger: "#B91C1C",
};

export type ViewOrderDetailsProps = {
  visible: boolean;
  data?: {
    materialCode?: string;
    description?: string;
    batchNo?: string;
    soDonorBatch?: string;
    certNo?: string;
    binNo?: string | number;
    adf?: string;
    requiredQty?: number;
    issuedQty?: number;
    packedQty?: number;
    issuedAt?: string;
    packedAt?: string;
  };
  onClose: () => void;
};

const ViewOrderDetails: React.FC<ViewOrderDetailsProps> = ({
  visible,
  data,
  onClose,
}) => {
  if (!data) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="cube-outline" size={18} color={C.headerText} />
              <Text style={styles.title}>
                {data.materialCode ?? "Material"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={C.headerText} />
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Description</Text>
              <Text style={styles.value}>{data.description ?? "-"}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Batch No</Text>
              <Text style={styles.value}>{data.batchNo ?? "-"}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>SO Donor Batch</Text>
              <Text style={styles.value}>{data.soDonorBatch ?? "-"}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Cert No</Text>
              <Text style={styles.value}>{data.certNo ?? "-"}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>A/D/F</Text>
              <Text style={styles.value}>{data.adf ?? "-"}</Text>
            </View>

            {/* Grid Stats */}
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Bin No</Text>
                <Text style={styles.gridValue}>
                  {String(data.binNo ?? "-")}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Required Qty</Text>
                <Text style={styles.gridValue}>
                  {data.requiredQty ?? 0}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Issued Qty</Text>
                <Text style={styles.gridValue}>
                  {data.issuedQty ?? 0}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Packed Qty</Text>
                <Text style={styles.gridValue}>
                  {data.packedQty ?? 0}
                </Text>
              </View>

              {data.issuedAt && (
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Issued At</Text>
                  <Text style={styles.gridValue}>
                    {new Date(data.issuedAt).toLocaleString()}
                  </Text>
                </View>
              )}

              {data.packedAt && (
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Packed At</Text>
                  <Text style={styles.gridValue}>
                    {new Date(data.packedAt).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: C.headerText,
  },
  body: {
    padding: 16,
    gap: 12,
  },
  infoRow: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: C.subText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 14,
    color: C.headerText,
    lineHeight: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  gridItem: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#FAFAFA",
  },
  gridLabel: {
    fontSize: 11,
    color: C.subText,
    fontWeight: "700",
  },
  gridValue: {
    fontSize: 16,
    color: C.headerText,
    fontWeight: "800",
    marginTop: 2,
  },
});

export default ViewOrderDetails;