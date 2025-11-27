// SalesOrdersStyledTable.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrdersSummaryItem } from "../../../Api/Hooks/UseSalesOrder";
import SalesOrderTableStorage from "../../../Storage/SalesOrder_table_Storage"; // Make sure path is correct

type Props = {
  data?: OrdersSummaryItem[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onRowPress?: (o: OrdersSummaryItem) => void;
  onDownload?: (o: OrdersSummaryItem) => void;
  onView?: (o: OrdersSummaryItem) => void;
  onUpload?: (o: OrdersSummaryItem) => void;
  onDocument?: (o: OrdersSummaryItem) => void;
  onDelete?: (o: OrdersSummaryItem) => void;
  downloadedMap?: Record<string, boolean>;
  issueCompletedMap?: Record<string, boolean>;
  packCompletedMap?: Record<string, boolean>;
  phaseMap?: Record<string, "issue" | "packing">;
  uploading?: string | null;
};

const C = {
  pageBg: "#F7F7F8",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  icon: "#111827",
  greenBg: "#E7F8EE",
  greenText: "#067647",
  greenBorder: "#B7E4C7",
  gray: "#6B7280",
  blue: "#2563EB",
  orange: "#F59E0B",
};

const getColumnFlex = (screenWidth: number) => {
  if (screenWidth < 350) {
    return { so: 1.5, status: 1.6, gap: 0.3, priority: 0.8, action: 1.5 };
  } else if (screenWidth < 400) {
    return { so: 1.4, status: 1.4, gap: 0.3, priority: 0.9, action: 1.4 };
  } else {
    return { so: 1.3, status: 1.3, gap: 0.3, priority: 1.0, action: 1.3 };
  }
};

const IconTap: React.FC<
  React.PropsWithChildren<{
    onPress?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
    hitSlop?: number;
  }>
> = ({ onPress, disabled, ariaLabel, children, hitSlop = 8 }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel={ariaLabel}
    style={[styles.iconTap, disabled && { opacity: 0.4 }]}
    hitSlop={hitSlop}
  >
    {children}
  </Pressable>
);

const getRelativeLabel = (secs: number) => {
  if (secs < 1) return "just now";
  if (secs < 60) return `${secs} sec${secs === 1 ? "" : "s"} ago`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    return `${m} min${m === 1 ? "" : "s"} ago`;
  }
  if (secs < 86400) {
    const h = Math.floor(secs / 3600);
    return `${h} hr${h === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(secs / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const Row: React.FC<{
  item: OrdersSummaryItem;
  onDownload?: () => void;
  onView?: () => void;
  onUpload?: () => void;
  onDocument?: () => void;
  onDelete?: () => void;
  downloaded?: boolean;
  issueCompleted?: boolean;
  packCompleted?: boolean;
  phase?: "issue" | "packing";
  uploading?: boolean;
  columnFlex: ReturnType<typeof getColumnFlex>;
}> = ({
  item,
  onDownload,
  onView,
  onUpload,
  onDocument,
  onDelete,
  downloaded = false,
  issueCompleted = false,
  packCompleted = false,
  phase = "issue",
  uploading = false,
  columnFlex,
}) => {
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const isUploading = uploading;

  // Persistent timer based on saved timestamp
  useEffect(() => {
    if (!downloaded) {
      setElapsedSec(0);
      return;
    }

    let mounted = true;
    let interval: NodeJS.Timeout;

    const updateElapsed = async () => {
      const savedTs = await SalesOrderTableStorage.getDownloadedTimestamp(item.saleOrderNumber);
      if (!savedTs || !mounted) return;

      const diff = Math.floor((Date.now() - savedTs) / 1000);
      setElapsedSec(diff);
    };

    updateElapsed(); // Immediate update
    interval = setInterval(updateElapsed, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [downloaded, item.saleOrderNumber]);

  const currentPhase = phase;
  const showUploadButton =
    downloaded &&
    ((currentPhase === "issue" && issueCompleted) ||
      (currentPhase === "packing" && packCompleted));

  const showProgressActions =
    downloaded &&
    ((currentPhase === "issue" && !issueCompleted) ||
      (currentPhase === "packing" && !packCompleted));

  const isSOClickable = downloaded && !showUploadButton;
  const timerIsLink = elapsedSec >= 3600 && !!onView;

  const rowStyle = [
    styles.row,
    showUploadButton && {
      backgroundColor: C.greenBg,
      borderColor: C.greenBorder,
    },
    isUploading && { opacity: 0.9 },
  ];

  // Wrap download/delete to save/remove timestamp
  const handleDownload = async () => {
    await SalesOrderTableStorage.setDownloadedTimestamp(item.saleOrderNumber);
    onDownload?.();
  };

  const handleDelete = async () => {
    await SalesOrderTableStorage.removeDownloadedTimestamp(item.saleOrderNumber);
    onDelete?.();
  };

  return (
    <View style={rowStyle}>
      {/* SO + Timer */}
      <View style={[styles.cell, { flex: columnFlex.so }]}>
        {isSOClickable && onView ? (
          <Pressable onPress={onView} disabled={isUploading} style={styles.soPressable}>
            <Text style={[styles.soText, { color: C.blue, textDecorationLine: "underline" }]}>
              {item.saleOrderNumber}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.soText, showUploadButton && { color: C.greenText }]}>
            {item.saleOrderNumber}
          </Text>
        )}

        {/* Persistent Relative Timer */}
        <View style={{ marginTop: 6 }}>
          {downloaded && (
            timerIsLink && onView ? (
              <Pressable onPress={onView} disabled={isUploading}>
                <Text style={[styles.smallTimer, { color: C.blue, textDecorationLine: "underline" }]}>
                  {getRelativeLabel(elapsedSec)}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.smallTimer}>
                {getRelativeLabel(elapsedSec)}
              </Text>
            )
          )}
        </View>
      </View>

      {/* Status */}
      <View style={[styles.cell, { flex: columnFlex.status }]}>
        <Text
          numberOfLines={2}
          style={[
            styles.statusText,
            showUploadButton && { color: C.greenText, fontWeight: "700" },
            isUploading && { color: C.blue },
            currentPhase === "packing" && !packCompleted && { color: C.orange },
          ]}
        >
          {item.status}
        </Text>
      </View>

      {/* Priority */}
      <View style={[styles.cell, styles.centerCell, { flex: columnFlex.priority }]}>
        <Text style={styles.metricText}>{item.priority ?? "-"}</Text>
      </View>

      {/* Actions */}
      <View style={[styles.cell, styles.actionCell, { flex: columnFlex.action }]}>
        <View style={styles.actionBar}>
          {/* Download */}
          {!downloaded && onDownload && (
            <IconTap onPress={handleDownload} disabled={isUploading} ariaLabel="Download">
              <Ionicons name="download-outline" size={20} color={isUploading ? C.gray : C.icon} />
            </IconTap>
          )}

          {/* Document */}
          {(showProgressActions || showUploadButton) && onDocument && (
            <IconTap onPress={onDocument} disabled={isUploading} ariaLabel="Documents">
              <Ionicons name="document-outline" size={20} color={isUploading ? C.gray : C.icon} />
            </IconTap>
          )}

          {/* Upload */}
          {showUploadButton && onUpload && (
            isUploading ? (
              <ActivityIndicator size="small" color={C.blue} />
            ) : (
              <IconTap onPress={onUpload} ariaLabel="Upload">
                <Ionicons name="cloud-upload-outline" size={20} color={C.blue} />
              </IconTap>
            )
          )}

          {/* Delete */}
          {downloaded && onDelete && (
            <IconTap onPress={handleDelete} disabled={isUploading} ariaLabel="Delete local data">
              <Ionicons name="trash-outline" size={20} color={isUploading ? C.gray : C.icon} />
            </IconTap>
          )}
        </View>
      </View>
    </View>
  );
};

const SalesOrdersStyledTable: React.FC<Props> = ({
  data = [],
  refreshing = false,
  onRefresh,
  onDownload,
  onView,
  onUpload,
  onDocument,
  onDelete,
  downloadedMap = {},
  issueCompletedMap = {},
  packCompletedMap = {},
  phaseMap = {},
  uploading = null,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const columnFlex = getColumnFlex(screenWidth);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, { flex: columnFlex.so }]}>SO</Text>
        <Text style={[styles.thText, { flex: columnFlex.status }]}>Status</Text>
        <Text style={[styles.thText, styles.thCenter, { flex: columnFlex.priority }]}>
          Priority
        </Text>
        <Text style={[styles.thText, styles.thRight, { flex: columnFlex.action }]}>
          Action
        </Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.saleOrderNumber}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.blue]} tintColor={C.blue} />
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const so = item.saleOrderNumber;
          return (
            <Row
              item={item}
              onDownload={onDownload ? () => onDownload(item) : undefined}
              onView={onView ? () => onView(item) : undefined}
              onUpload={onUpload ? () => onUpload(item) : undefined}
              onDocument={onDocument ? () => onDocument(item) : undefined}
              onDelete={onDelete ? () => onDelete(item) : undefined}
              downloaded={!!downloadedMap[so]}
              issueCompleted={!!issueCompletedMap[so]}
              packCompleted={!!packCompletedMap[so]}
              phase={phaseMap[so] ?? "issue"}
              uploading={uploading === so}
              columnFlex={columnFlex}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={C.gray} />
            <Text style={styles.emptyTitle}>No orders</Text>
          </View>
        }
        contentContainerStyle={data.length === 0 ? { flex: 1 } : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default SalesOrdersStyledTable;

// Styles unchanged
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.pageBg,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#FFF",
  },
  thText: { fontSize: 12, fontWeight: "700", color: C.gray },
  thCenter: { textAlign: "center" },
  thRight: { textAlign: "right" },
  row: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
  },
  cell: { paddingHorizontal: 4, justifyContent: "center" },
  centerCell: { alignItems: "center" },
  actionCell: { alignItems: "flex-end" },
  soPressable: { paddingVertical: 2 },
  soText: { color: "#111827", fontSize: 14, fontWeight: "700" },
  statusText: { color: "#111827", fontSize: 13, fontWeight: "600", lineHeight: 16 },
  metricText: { color: "#111827", fontSize: 13, fontWeight: "500" },
  actionBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  iconTap: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  sep: { height: 8 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.headerText,
    marginTop: 12,
  },
  smallTimer: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
});