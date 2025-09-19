// src/components/MaterialFG/WelcomeScreen.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY_YELLOW = "#FACC15"; // yellow-400
const ACCENT = "#111827";         // gray-900
const MUTED = "#6B7280";          // gray-500
const SURFACE = "#FFF9DB";        // soft yellow surface

type Props = {
  onContinue?: () => void;
};

const MaterialFGWelcome: React.FC<Props> = ({ onContinue }) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="swap-horizontal" size={64} color={PRIMARY_YELLOW} />
        <Text style={styles.title}>Material FG / Transfer</Text>
        <Text style={styles.subtitle}>Welcome to Transfer Module</Text>
      </View>

      {/* Info */}
      <View style={styles.body}>
        <Text style={styles.info}>
          This module helps you manage finished goods and material transfers
          across different locations, ensuring smooth operations.
        </Text>
      </View>

      {/* Button */}
      <TouchableOpacity style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Proceed</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default MaterialFGWelcome;

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
    fontSize: 26,
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
    paddingHorizontal: 10,
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
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
});
