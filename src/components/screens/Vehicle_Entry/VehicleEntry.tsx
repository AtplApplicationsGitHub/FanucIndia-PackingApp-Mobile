// src/screens/VehicleEntry.tsx
import React, { useEffect, useState } from "react";
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVehicleEntry, Customer } from '../../Api/Hooks/UseVehicleEntry';
import UploadImages from './upload_Images'; // Make sure path is correct

export default function VehicleEntryScreen() {
  const {
    customers,
    loadingCustomers,
    saving,
    error,
    debouncedSearch,
    saveVehicleEntry,
    clearCustomers,
  } = useVehicleEntry();

  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [driverNumber, setDriverNumber] = useState('');
  const [entrySaved, setEntrySaved] = useState(false);
    const [photos, setPhotos] = React.useState([]);
  const [savedEntryId, setSavedEntryId] = React.useState<number | null>(null);

  // Permissions
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    })();
  }, []);

  // Validation
  const formatVehicleNumber = (text: string) => {
    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    setVehicleNumber(cleaned);
  };

  const isVehicleValid = (v: string) => /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(v);
  const isDriverValid = (d: string) => /^\d{10}$/.test(d);

  const isFormValid = () =>
    selectedCustomer &&
    isVehicleValid(vehicleNumber) &&
    transporterName.trim() &&
    isDriverValid(driverNumber);

  const handleSave = async () => {
    if (!isFormValid()) {
      Alert.alert('Invalid Data', 'Please fill all fields correctly.');
      return;
    }

    const result = await saveVehicleEntry({
      customerName: selectedCustomer!.name,
      vehicleNumber,
      transporterName,
      driverNumber,
    });

    if (result?.id) {
      setSavedEntryId(result.id);
      setEntrySaved(true);
      Alert.alert('Success!', `Vehicle Entry Saved! ID: ${result.id}`);
    } else {
      Alert.alert('Error', error || 'Failed to save entry');
    }
  };

  const clearAll = () => {
    setCustomerQuery('');
    setSelectedCustomer(null);
    clearCustomers();
    setVehicleNumber('');
    setTransporterName('');
    setDriverNumber('');
    setPhotos([]);
    setEntrySaved(false);
    setSavedEntryId(null);
  };

  return (
    <View style={styles.container}>
      {/* Customer Search */}
      <TextInput
        style={styles.input}
        placeholder="Search Customer Name (min 3 chars) *"
        value={customerQuery}
        onChangeText={(text) => {
          setCustomerQuery(text);
          setSelectedCustomer(null);
          setEntrySaved(false);
          debouncedSearch(text);
        }}
      />

      {loadingCustomers && (
        <ActivityIndicator style={{ marginTop: 8 }} color="#007AFF" />
      )}

      {customers.length > 0 && !selectedCustomer && (
        <FlatList
          style={styles.dropdown}
          data={customers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setSelectedCustomer(item);
                setCustomerQuery(item.name);
                clearCustomers();
              }}
            >
              <Text style={styles.customerName}>{item.name}</Text>
              <Text style={styles.customerAddr}>{item.address}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Vehicle Number */}
      <TextInput
        style={styles.input}
        placeholder="Vehicle Number (e.g. MH12AB1234) *"
        value={vehicleNumber}
        onChangeText={formatVehicleNumber}
        autoCapitalize="characters"
      />
      {!isVehicleValid(vehicleNumber) && vehicleNumber.length > 6 && (
        <Text style={styles.errorText}>Invalid format. Use: MH12AB1234</Text>
      )}

      {/* Driver Mobile */}
      <TextInput
        style={styles.input}
        placeholder="Driver Mobile (10 digits) *"
        value={driverNumber}
        keyboardType="number-pad"
        maxLength={10}
        onChangeText={(t) => setDriverNumber(t.replace(/[^0-9]/g, ''))}
      />
      {!isDriverValid(driverNumber) && driverNumber.length > 0 && (
        <Text style={styles.errorText}>Enter exactly 10 digits</Text>
      )}

      {/* Transporter Name */}
      <TextInput
        style={styles.input}
        placeholder="Transporter Name *"
        value={transporterName}
        onChangeText={setTransporterName}
      />

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.btn, styles.saveBtn, (!isFormValid() || saving) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!isFormValid() || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>Save Entry</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={clearAll}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Success + Upload Section */}
      {entrySaved && savedEntryId && (
        <>
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={24} color="green" />
            <Text style={styles.successText}>
              Vehicle Entry saved successfully! (ID: {savedEntryId})
            </Text>
          </View>

          {/* PASS savedEntryId HERE */}
          <UploadImages
            vehicleEntryId={savedEntryId}
            photos={photos}
            setPhotos={setPhotos}
            onUploadSuccess={() => {
              Alert.alert("Uploaded!", "All photos uploaded successfully.");
            }}
          />
        </>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    marginTop: 12,
  },
  dropdown: {
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  customerName: { fontSize: 16, fontWeight: '600' },
  customerAddr: { fontSize: 13, color: '#666', marginTop: 2 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveBtn: { backgroundColor: '#007AFF' },
  clearBtn: { backgroundColor: '#FF3B30' },
  btnDisabled: { backgroundColor: '#aaa' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#d32f2f', marginTop: 6, fontSize: 13 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  successText: { marginLeft: 10, color: '#155724', fontWeight: '600' },
});