// VehicleEntry.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import UploadImages from "../Vehicle_Entry/upload_Images";

type Customer = { id: string; name: string };
type Photo = { uri: string; name: string };

export default function VehicleEntryScreen() {
  // Form fields
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [vehicleNumber, setVehicleNumber] = useState("");      
  const [transporterName, setTransporterName] = useState("");
  const [driverNumber, setDriverNumber] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [entrySaved, setEntrySaved] = useState(false);

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>([]);

  const searchDebounce = useRef<NodeJS.Timeout | null>(null);

  // Fake Master Customers (Local only)
  const MASTER_CUSTOMERS: Customer[] = [
    { id: "1", name: "Ramesh Kumar" },
    { id: "2", name: "Suresh Naik" },
    { id: "3", name: "Vijay Rao" },
    { id: "4", name: "Anitha R" },
    { id: "5", name: "Kiran Patil" },
  ];

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission required", "Camera access is needed to take photos.");
        }

        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libraryStatus !== "granted") {
          Alert.alert("Permission required", "Gallery access is needed to pick photos.");
        }
      }
    })();
  }, []);

  // Customer search with debounce
  useEffect(() => {
    if (customerQuery.length < 3) {
      setCustomers([]);
      return;
    }

    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    searchDebounce.current = setTimeout(() => {
      const filtered = MASTER_CUSTOMERS.filter((c) =>
        c.name.toLowerCase().includes(customerQuery.toLowerCase())
      );
      setCustomers(filtered);
    }, 300);
  }, [customerQuery]);

  // Vehicle number formatting
  const onVehicleChange = (raw: string) => {
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    setVehicleNumber(cleaned);
  };

  const isVehicleValid = (v: string) => /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(v);
  const isDriverValid = (d: string) => /^\d{10}$/.test(d);

  const allFieldsValid = () =>
    selectedCustomer !== null &&
    isVehicleValid(vehicleNumber) &&
    transporterName.trim().length > 0 &&
    isDriverValid(driverNumber);

  // Save entry
  const saveEntry = () => {
    if (!allFieldsValid()) {
      Alert.alert("Invalid Data", "Please fill all fields correctly.");
      return;
    }

    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setEntrySaved(true);
      Alert.alert("Success", "Vehicle entry saved locally!");
    }, 800);
  };

  // Clear all fields
  const clearAll = () => {
    setCustomerQuery("");
    setSelectedCustomer(null);
    setCustomers([]);
    setVehicleNumber("");
    setTransporterName("");
    setDriverNumber("");
    setPhotos([]);
    setEntrySaved(false);
  };

  return (
    <View style={styles.container}>
      {/* Customer Search */}
      <TextInput
        style={styles.input}
        placeholder="Customer Name *"
        value={customerQuery}
        onChangeText={(t) => {
          setCustomerQuery(t);
          setEntrySaved(false);
        }}
      />

      {customers.length > 0 && (
        <FlatList
          style={styles.searchList}
          data={customers}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchItem}
              onPress={() => {
                setSelectedCustomer(item);
                setCustomerQuery(item.name);
                setCustomers([]);
              }}
            >
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Selected Customer Display */}

      {/* Vehicle Number */}
      <TextInput
        style={styles.input}
        placeholder="Vehicle Number (e.g. KA01AB1234) *"
        value={vehicleNumber}
        onChangeText={onVehicleChange}
        autoCapitalize="characters"
      />
      {!isVehicleValid(vehicleNumber) && vehicleNumber.length > 0 && (
        <Text style={styles.error}>Invalid format (e.g. KA01AB1234)</Text>
      )}

      {/* Driver Mobile */}
      <TextInput
        style={styles.input}
        placeholder="Driver Mobile (10 digits) *"
        value={driverNumber}
        keyboardType="number-pad"
        maxLength={10}
        onChangeText={(t) => setDriverNumber(t.replace(/[^0-9]/g, ""))}
      />
      {!isDriverValid(driverNumber) && driverNumber.length > 0 && (
        <Text style={styles.error}>Must be exactly 10 digits</Text>
      )}

      {/* Transporter */}
      <TextInput
        style={styles.input}
        placeholder="Transporter Name *"
        value={transporterName}
        onChangeText={setTransporterName}
      />

      {/* Action Buttons - Side by Side */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.saveBtn]}
          onPress={saveEntry}
          disabled={saving || entrySaved}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnContent}>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Save Entry</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.clearBtn]}
          onPress={clearAll}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Clear All</Text>
        </TouchableOpacity>
      </View>
      {/* Upload Images - Only after save */}
      {entrySaved && <UploadImages photos={photos} setPhotos={setPhotos} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    fontSize: 16,
  },
  error: { fontSize: 12, color: "#c00", marginTop: 4, marginLeft: 4 },
  selectedCustomer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "#e6f7ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#91d5ff",
  },
  selectedText: { color: "#007AFF", fontWeight: "600" },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 10,
    gap: 8,
  },
  saveBtn: {
    backgroundColor: "#007AFF",
  },
  clearBtn: {
    backgroundColor: "#FF3B30",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },

  successBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    padding: 12,
    backgroundColor: "#d4edda",
    borderRadius: 8,
    borderColor: "#c3e6cb",
    borderWidth: 1,
  },
  successText: {
    marginLeft: 8,
    color: "#155724",
    fontWeight: "600",
  },

  searchList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: "#eee",
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    zIndex: 10,
  },
  searchItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
});