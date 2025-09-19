// src/components/PickAndPack/pick_and_pack.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY_YELLOW = "#FACC15"; // yellow-400
const ACCENT = "#0B0F19";         // near-black
const MUTED = "#6B7280";          // gray-500
const SURFACE = "#FFF9DB";        // soft yellow surface

type Props = {
  onContinue?: () => void;
};

const PickAndPackWelcome: React.FC<Props> = ({ onContinue }) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="cube-outline" size={64} color={PRIMARY_YELLOW} />
        <Text style={styles.title}>Pick & Pack</Text>
        <Text style={styles.subtitle}>Welcome to Picking Module</Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.info}>
          Scan, verify, and prepare materials for dispatch. Track status and
          ensure accurate packing for each order.
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        accessibilityLabel="Start Pick and Pack"
        style={styles.button}
        onPress={onContinue}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonText}>Start Picking</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default PickAndPackWelcome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: ACCENT,
    marginTop: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: MUTED,
    marginTop: 6,
  },
  body: {
    marginBottom: 40,
    paddingHorizontal: 12,
  },
  info: {
    fontSize: 15,
    textAlign: "center",
    color: ACCENT,
    lineHeight: 22,
  },
  button: {
    flexDirection: "row",
    backgroundColor: PRIMARY_YELLOW,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    alignItems: "center",
    elevation: 3,
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
