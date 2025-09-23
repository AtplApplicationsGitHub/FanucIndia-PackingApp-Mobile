// src/screens/SalesOrdersStyledTable.tsx
import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Order = {
  id: string;
  soNumber: string;
  priority: 1 | 2 | 3;               // 1 (high) → 3 (low)
  totalItems: number;
  status: "Assigned" | "In Progress" | "Completed";
};

type Props = {
  data?: Order[];
  onDownload?: (o: Order) => void;
};

const C = {
  pageBg: "#F7F7F8",
  softYellow: "#FFF7CC",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  // priority fills
  p1bg: "#FEE2E2",
  p1tx: "#B91C1C",
  p2bg: "#FEF3C7",
  p2tx: "#B45309",
  p3bg: "#DCFCE7",
  p3tx: "#166534",
  // status
  chipBg: "#F3F4F6",
  chipTx: "#111827",
  // CTA
  cta: "#111827",
  ctaTx: "#FFFFFF",
};

const sample: Order[] = [
  { id: "1", soNumber: "SO-240815", priority: 1, totalItems: 55, status: "Assigned" },
  { id: "2", soNumber: "SO-240342", priority: 1, totalItems: 64, status: "Assigned" },
  { id: "3", soNumber: "SO-240108", priority: 2, totalItems: 33, status: "Assigned" },
  { id: "4", soNumber: "SO-240406", priority: 2, totalItems: 41, status: "Assigned" },
  { id: "5", soNumber: "SO-240221", priority: 3, totalItems: 18, status: "Assigned" },
  { id: "6", soNumber: "SO-240477", priority: 3, totalItems: 12, status: "Assigned" },
];

const SalesOrdersStyledTable: React.FC<Props> = ({ data = sample, onDownload }) => {
  const renderHeaderBlock = () => (
    <View style={styles.blockHeader}>
      <Text style={styles.title}>Sales Orders Assigned to You</Text>
      <Text style={styles.subtitle}>
        Tap <Text style={styles.bold}>Actions</Text> to <Text style={styles.em}>Download</Text> →{" "}
        <Text style={styles.em}>View</Text> → <Text style={styles.em}>Upload</Text>.{" "}
        <Text style={styles.sub}>Priority: 1 (high) to 3 (low).</Text>
      </Text>
    </View>
  );

  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <HCell flex={2}>SO Number</HCell>
      <HCell flex={1} center>
        Priority
      </HCell>
      <HCell flex={1} center>
        Total Items
      </HCell>
      <HCell flex={2} center>
        Status
      </HCell>
      <HCell flex={2} right>
        Actions
      </HCell>
    </View>
  );

  const renderRow = ({ item, index }: { item: Order; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === (data?.length ?? 0) - 1;
    return (
      <View
        style={[
          styles.row,
          isFirst && styles.rowFirst,
          isLast && styles.rowLast,
          { borderTopWidth: index === 0 ? StyleSheet.hairlineWidth : 0 },
        ]}
      >
        <RCell flex={2}>
          <Text style={styles.soNumber}>{item.soNumber}</Text>
        </RCell>

        <RCell flex={1} center>
          <PriorityCircle level={item.priority} />
        </RCell>

        <RCell flex={1} center>
          <Text style={styles.cellText}>{item.totalItems}</Text>
        </RCell>

        <RCell flex={2} center>
          <StatusChip text={item.status} />
        </RCell>

        <RCell flex={2} right>
          <Pressable
            style={({ pressed }) => [styles.downloadBtn, pressed && { opacity: 0.9 }]}
            onPress={() => onDownload?.(item)}
          >
            <Ionicons name="download-outline" size={16} color={C.ctaTx} />
            <Text style={styles.downloadTx}></Text>
          </Pressable>
        </RCell>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {renderHeaderBlock()}
      <View style={styles.tableWrap}>
        {renderTableHeader()}
        <FlatList
          data={data}
          keyExtractor={(x) => x.id}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

/* ---- small atoms ---- */

const HCell: React.FC<{ flex?: number; center?: boolean; right?: boolean; children: React.ReactNode }> = ({
  flex = 1,
  center,
  right,
  children,
}) => (
  <View style={[{ flex, paddingVertical: 10 }, styles.hcell, center && styles.center, right && styles.right]}>
    <Text style={styles.htext}>{children}</Text>
  </View>
);

const RCell: React.FC<{ flex?: number; center?: boolean; right?: boolean; children: React.ReactNode }> = ({
  flex = 1,
  center,
  right,
  children,
}) => (
  <View style={[{ flex, paddingVertical: 14 }, center && styles.center, right && styles.right]}>{children}</View>
);

const PriorityCircle: React.FC<{ level: 1 | 2 | 3 }> = ({ level }) => {
  const map =
    level === 1
      ? { bg: C.p1bg, tx: C.p1tx }
      : level === 2
      ? { bg: C.p2bg, tx: C.p2tx }
      : { bg: C.p3bg, tx: C.p3tx };
  return (
    <View style={[styles.priorityCircle, { backgroundColor: map.bg }]}>
      <Text style={[styles.priorityNum, { color: map.tx }]}>{level}</Text>
    </View>
  );
};

const StatusChip: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.statusChip}>
    <Text style={styles.statusTx}>{text}</Text>
  </View>
);

export default SalesOrdersStyledTable;

/* ---- styles ---- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.pageBg,
    padding: 5,
    
  },

  blockHeader: {
    marginBottom: 10,
  },
  title: { color: C.headerText, fontSize: 18, fontWeight: "700" },
  subtitle: { color: C.subText, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  bold: { fontWeight: "700", color: C.headerText },
  em: { fontStyle: "italic", color: C.headerText },
  sub: { color: C.subText },

  tableWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    backgroundColor: C.card,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.softYellow,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
  },

  hcell: {
    paddingHorizontal: 8,
  },
  htext: {
    fontSize: 12,
    color: C.headerText,
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    paddingHorizontal: 12,
    backgroundColor: C.card,
  },
  rowFirst: {
    // (top corners already rounded by container)
  },
  rowLast: {
    // (bottom corners already rounded by container)
  },

  sep: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 12,
    marginRight: 12,
  },

  soNumber: { fontSize: 14.5, fontWeight: "700", color: C.headerText },
  cellText: { fontSize: 14.5, color: C.headerText },

  priorityCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityNum: { fontWeight: "800", fontSize: 12.5 },

  statusChip: {
    backgroundColor: C.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "center",
  },
  statusTx: {
    color: C.chipTx,
    fontSize: 12.5,
    fontWeight: "700",
  },

  downloadBtn: {
    backgroundColor: C.cta,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-end",
  },
  downloadTx: { color: C.ctaTx, fontWeight: "700", fontSize: 13 },

  center: { alignItems: "center", justifyContent: "center" },
  right: { alignItems: "flex-end", justifyContent: "center" },
});
