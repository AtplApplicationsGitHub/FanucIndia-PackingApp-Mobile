// src/screens/MaterialIssueScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";

type IssueRow = {
  id: string;
  materialCode: string;
  binNo: string;
  requiredQty: number;
  issueStage: number;
};

const COLORS = {
  bg: "#F7F7F8",
  card: "#FFFFFF",
  border: "#E6E7EB",
  text: "#0B0F19",
  subtext: "#667085",
  primary: "#FACC15", // yellow-400
  primaryDeep: "#EAB308",
  chip: "#FFF7CC",
  stripe: "#FAFAFB",
  pill: "#F3F4F6",
};

const SHADOW =
  Platform.OS === "ios"
    ? { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }
    : { elevation: 2 };

const SAMPLE: IssueRow[] = [
  { id: "1", materialCode: "A1-B1-C1", binNo: "21-E-02", requiredQty: 8, issueStage: 1 },
  { id: "2", materialCode: "A2-B2-C2", binNo: "BIN-29455", requiredQty: 1, issueStage: 1 },
  { id: "3", materialCode: "A3-B3-C3", binNo: "BIN-35742", requiredQty: 1, issueStage: 0 },
  { id: "4", materialCode: "A4-B4-C4", binNo: "BIN-35742", requiredQty: 3, issueStage: 0 },
  { id: "5", materialCode: "A5-B5-C5", binNo: "21-E-02", requiredQty: 1, issueStage: 0 },
];

const StatCard = ({ title, value, subtitle }: { title: string; value: string; subtitle: string }) => (
  <View style={[styles.statCard, SHADOW]}>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statSub}>{subtitle}</Text>
  </View>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.pill}>
    <Text style={styles.pillText}>{children}</Text>
  </View>
);

const HeaderCell = ({ children, flex = 1, align = "left" as "left" | "center" | "right" }) => (
  <View style={[styles.hCell, { flex, alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center" }]}>
    <Text style={styles.hText}>{children}</Text>
  </View>
);

const Cell = ({
  children,
  flex = 1,
  align = "left" as "left" | "center" | "right",
}: {
  children: React.ReactNode;
  flex?: number;
  align?: "left" | "center" | "right";
}) => (
  <View
    style={[
      styles.cell,
      { flex, alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center" },
    ]}
  >
    {typeof children === "string" || typeof children === "number" ? (
      <Text style={styles.cellText}>{children}</Text>
    ) : (
      children
    )}
  </View>
);

const MaterialIssueScreen: React.FC = () => {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!query.trim()) return SAMPLE;
    const q = query.toLowerCase();
    return SAMPLE.filter(
      (r) =>
        r.materialCode.toLowerCase().includes(q) ||
        r.binNo.toLowerCase().includes(q) ||
        r.id.includes(q)
    );
  }, [query]);

  const totalCompleted = 1; // example
  const required = 14;
  const issued = 2;

  const renderHeaderRow = () => (
    <View style={styles.thead}>
      <HeaderCell flex={0.7} align="left">S.No</HeaderCell>
      <HeaderCell flex={1.8} align="left">Material Code</HeaderCell>
      <HeaderCell flex={1.3} align="left">Bin No</HeaderCell>
      <HeaderCell flex={1} align="center">Required Qty</HeaderCell>
      <HeaderCell flex={1} align="center">Issue Stage</HeaderCell>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Stats */}
      <View style={styles.row}>
        <StatCard title="Total Issues" value={`${totalCompleted}/5`} subtitle="Materials completed" />
        <StatCard title="Required vs Issued" value={`${issued}/${required}`} subtitle="Items progress" />
      </View>

      {/* Search + Buttons */}
      <View style={[styles.controls, SHADOW]}>
        <TextInput
          placeholder="Scan / Enter Material Code"
          placeholderTextColor={COLORS.subtext}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          returnKeyType="search"
        />
        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
          <Text style={styles.btnText}>SUBMIT</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.btnGhost, pressed && styles.btnGhostPressed]}>
          <Text style={styles.btnGhostText}>UPDATE</Text>
        </Pressable>
      </View>

      {/* Phase chip */}
      <View style={styles.phaseRow}>
        <Text style={styles.phaseLabel}>Current Phase:</Text>
        <View style={styles.phaseChip}>
          <Text style={styles.phaseText}>Issue</Text>
        </View>
      </View>

      {/* Table Card */}
      <View style={[styles.tableCard, SHADOW]}>
        {renderHeaderRow()}
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          stickyHeaderIndices={[0]}
          ListHeaderComponent={() => <View style={{ height: 0 }} />} // keeps FlatList happy with sticky
          renderItem={({ item, index }) => {
            const striped = index % 2 === 1;
            const isSelected = selectedId === item.id;
            return (
              <Pressable
                onPress={() => setSelectedId(isSelected ? null : item.id)}
                style={[
                  styles.trow,
                  striped && { backgroundColor: COLORS.stripe },
                  isSelected && { borderColor: COLORS.primaryDeep, borderWidth: 1 },
                ]}
              >
                <Cell flex={0.7}>{item.id}</Cell>
                <Cell flex={1.8}>{item.materialCode}</Cell>
                <Cell flex={1.3}>{item.binNo}</Cell>
                <Cell flex={1} align="center">
                  <Pill>{item.requiredQty}</Pill>
                </Cell>
                <Cell flex={1} align="center">
                  <Pill>{item.issueStage}</Pill>
                </Cell>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySub}>Try a different code or bin number</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

export default MaterialIssueScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statTitle: { color: COLORS.subtext, fontSize: 12, marginBottom: 6 },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  statSub: { color: COLORS.subtext, fontSize: 11, marginTop: 2 },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 10,
    gap: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: "#FCFCFD",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: COLORS.text,
  },
  btn: {
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPressed: { opacity: 0.9 },
  btnText: { fontWeight: "700", color: "#111827", letterSpacing: 0.5 },

  btnGhost: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.chip,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  btnGhostPressed: { opacity: 0.85 },
  btnGhostText: { fontWeight: "700", color: "#7C6513" },

  phaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  phaseLabel: { color: COLORS.subtext, fontSize: 12 },
  phaseChip: {
    backgroundColor: COLORS.chip,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  phaseText: { color: "#7C6513", fontWeight: "700", fontSize: 12 },

  tableCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#FFF9DB",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  hCell: { justifyContent: "center", paddingRight: 6 },
  hText: { color: "#7C6513", fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },

  trow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
  },
  cell: { justifyContent: "center", paddingRight: 6 },
  cellText: { color: COLORS.text, fontSize: 13.5 },

  pill: {
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.pill,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pillText: { fontWeight: "700", color: COLORS.text, fontSize: 12 },

  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 12,
    opacity: 0.6,
  },

  empty: { alignItems: "center", paddingVertical: 28, gap: 6 },
  emptyTitle: { fontWeight: "700", color: COLORS.text },
  emptySub: { color: COLORS.subtext, fontSize: 12 },
});
