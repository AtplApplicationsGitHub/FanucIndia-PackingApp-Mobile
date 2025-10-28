import React from "react";
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
import type { OrdersSummaryItem } from "../../Api/SalesOrder_server";

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
    return { so: 1.2, status: 1.6, items: 0.8, material: 0.9, action: 1.2 };
  } else if (screenWidth < 400) {
    return { so: 1.1, status: 1.4, items: 0.9, material: 1.0, action: 1.1 };
  } else {
    return { so: 1.0, status: 1.3, items: 1.0, material: 1.1, action: 1.0 };
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

const Row: React.FC<{
  item: OrdersSummaryItem;
  onPress?: () => void;
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
  const currentPhase = phase;
  const isUploading = uploading;

  // Determine status text based on current state
  const statusText =
    (item as any)?.status ??
    (isUploading
      ? "Uploading..."
      : !downloaded
      ? "Not downloaded"
      : currentPhase === "issue" && !issueCompleted
      ? "Issuing in progress"
      : currentPhase === "issue" && issueCompleted
      ? "Ready to upload (Issue)"
      : currentPhase === "packing" && !packCompleted
      ? "Packing in progress"
      : currentPhase === "packing" && packCompleted
      ? "Ready to upload (Packing)"
      : "Unknown status");

  const totalItems = (item as any)?.totalItems != null ? String((item as any).totalItems) : "-";
  const totalMaterials = (item as any)?.totalMaterials != null ? String((item as any).totalMaterials) : "-";

  // Show download only when not downloaded
  const showDownloadOnly = !downloaded;
  
  // Show progress actions when downloaded but current phase is not completed
  const showProgressActions = downloaded && 
    ((currentPhase === "issue" && !issueCompleted) || 
     (currentPhase === "packing" && !packCompleted));
  
  // Show upload button only when current phase is completed
  const showUploadButton = downloaded && 
    ((currentPhase === "issue" && issueCompleted) || 
     (currentPhase === "packing" && packCompleted));

  const isSOClickable = downloaded && !showUploadButton;

  const rowStyle = [
    styles.row,
    showUploadButton && { backgroundColor: C.greenBg, borderColor: C.greenBorder },
    isUploading && { opacity: 0.9 },
  ];

  return (
    <View style={rowStyle}>
      {/* SO */}
      <View style={[styles.cell, { flex: columnFlex.so }]}>
        {isSOClickable && onView ? (
          <Pressable
            onPress={onView}
            disabled={isUploading}
            accessibilityLabel={`View order ${item.saleOrderNumber}`}
            style={styles.soPressable}
          >
            <Text
              style={[
                styles.soText,
                { color: C.blue, textDecorationLine: "underline" },
                isUploading && { opacity: 0.4 },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.saleOrderNumber}
            </Text>
          </Pressable>
        ) : (
          <Text
            style={[
              styles.soText,
              showUploadButton && { color: C.greenText },
              isUploading && { opacity: 0.4 },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.saleOrderNumber}
          </Text>
        )}
      </View>

      {/* Status */}
      <View style={[styles.cell, { flex: columnFlex.status }]}>
        <Text
          numberOfLines={2}
          style={[
            styles.statusText,
            showUploadButton ? { color: C.greenText, fontWeight: "700" } : undefined,
            isUploading ? { color: C.blue } : undefined,
            currentPhase === "packing" && !packCompleted ? { color: C.orange } : undefined,
          ]}
        >
          {statusText}
        </Text>
      </View>

      {/* Items */}
      <View style={[styles.cell, styles.centerCell, { flex: columnFlex.items }]}>
        <Text style={styles.metricText}>{totalItems}</Text>
      </View>

      {/* Material */}
      <View style={[styles.cell, styles.centerCell, { flex: columnFlex.material }]}>
        <Text style={styles.metricText}>{totalMaterials}</Text>
      </View>

      {/* Action */}
      <View style={[styles.cell, styles.actionCell, { flex: columnFlex.action }]}>
        <View style={styles.actionBar}>
          {showDownloadOnly && onDownload && (
            <IconTap onPress={onDownload} disabled={isUploading} ariaLabel="Download order details">
              <Ionicons name="download-outline" size={20} color={isUploading ? C.gray : C.icon} />
            </IconTap>
          )}

          {(showProgressActions || showUploadButton) && onDocument && (
            <IconTap onPress={onDocument} disabled={isUploading} ariaLabel="Open documents">
              <Ionicons name="document-outline" size={20} color={isUploading ? C.gray : C.icon} />
            </IconTap>
          )}

          {showUploadButton && onUpload && (
            isUploading ? (
              <ActivityIndicator size="small" color={C.blue} />
            ) : (
              <IconTap onPress={onUpload} disabled={isUploading} ariaLabel={`Upload ${currentPhase} data`}>
                <Ionicons name="cloud-upload-outline" size={20} color={C.blue} />
              </IconTap>
            )
          )}

          {downloaded && onDelete && (
            <IconTap onPress={onDelete} disabled={isUploading} ariaLabel="Delete local order data">
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
        <Text style={[styles.thText, styles.thCenter, { flex: columnFlex.items }]}>Items</Text>
        <Text style={[styles.thText, styles.thCenter, { flex: columnFlex.material }]}>Material</Text>
        <Text style={[styles.thText, styles.thRight, { flex: columnFlex.action }]}>Action</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.saleOrderNumber}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh ?? undefined} colors={[C.blue]} tintColor={C.blue} />
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const so = item.saleOrderNumber;
          const downloaded = !!downloadedMap[so];
          const issueCompleted = !!issueCompletedMap[so];
          const packCompleted = !!packCompletedMap[so];
          const phase = phaseMap[so] ?? "issue";
          const isUploading = uploading === so;

          return (
            <Row
              item={item}
              onDownload={onDownload ? () => onDownload(item) : undefined}
              onView={onView ? () => onView(item) : undefined}
              onUpload={onUpload ? () => onUpload(item) : undefined}
              onDocument={onDocument ? () => onDocument(item) : undefined}
              onDelete={onDelete ? () => onDelete(item) : undefined}
              downloaded={downloaded}
              issueCompleted={issueCompleted}
              packCompleted={packCompleted}
              phase={phase}
              uploading={isUploading}
              columnFlex={columnFlex}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={C.gray} />
            <Text style={styles.emptyTitle}>No orders</Text>
            <Text style={styles.emptySub}>Pull to refresh or try again later.</Text>
          </View>
        }
        contentContainerStyle={data.length === 0 ? { flex: 1 } : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default SalesOrdersStyledTable;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.pageBg, paddingHorizontal: 12, paddingTop: 8 },

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

  actionBar: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 1, flexWrap: "nowrap" },

  iconTap: {
    backgroundColor: "transparent",
    borderWidth: 0,
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },

  sep: { height: 8 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.headerText, marginTop: 12 },
  emptySub: { marginTop: 4, color: C.subText, fontSize: 14, textAlign: "center" },
});