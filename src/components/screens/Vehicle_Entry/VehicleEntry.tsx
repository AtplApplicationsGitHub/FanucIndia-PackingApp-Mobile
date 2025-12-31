// src/screens/VehicleEntry.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVehicleEntry, Customer } from '../../Api/Hooks/UseVehicleEntry';
import UploadImages from './upload_Images';
import {
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
  VehicleDraft,
} from '../../Storage/VehicleEntry_Storage';

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

  const [savedEntryId, setSavedEntryId] = useState<number | null>(null);
  const [entrySaved, setEntrySaved] = useState(false);
  const [allPhotosUploaded, setAllPhotosUploaded] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(false); // NEW: Prevent multiple saves

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error' | 'confirm'>('success');
  const [onConfirm, setOnConfirm] = useState<() => void>(() => { }); // For confirmation modal

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const customerInputRef = useRef<TextInput>(null);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await loadDraftFromStorage();
      if (draft) {
        setCustomerQuery(draft.customerQuery || '');
        setSelectedCustomer(draft.selectedCustomer || null);
        setVehicleNumber(draft.vehicleNumber || '');
        setTransporterName(draft.transporterName || '');
        setDriverNumber(draft.driverNumber || '');

        setSavedEntryId(draft.savedEntryId || null);
        setEntrySaved(!!draft.savedEntryId);
        setAllPhotosUploaded(draft.allPhotosUploaded || false);
        setSaveDisabled(!!draft.savedEntryId); // Disable save if already saved
      }
      setTimeout(() => customerInputRef.current?.focus(), 300);
    };
    loadDraft();
  }, []);

  // Save draft whenever relevant data changes (but only if not fully completed)
  useEffect(() => {
    if (!allPhotosUploaded) {
      const draft: VehicleDraft = {
        customerQuery,
        selectedCustomer: selectedCustomer || undefined,
        vehicleNumber,
        transporterName,
        driverNumber,

        savedEntryId: savedEntryId || undefined,
        allPhotosUploaded: false,
      };
      saveDraftToStorage(draft);
    }
  }, [
    customerQuery,
    selectedCustomer,
    vehicleNumber,
    transporterName,
    driverNumber,

    savedEntryId,
    allPhotosUploaded,
  ]);

  // Request permissions
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
    })();
  }, []);

  const formatVehicleNumber = (text: string) => {
    const trimmed = text.trim().toUpperCase();
    setVehicleNumber(trimmed);
  };

  const isDriverValid = (d: string) => /^\d{10}$/.test(d.trim());

  const isFormValid = () =>
    selectedCustomer &&
    vehicleNumber.trim().length > 0 &&
    transporterName.trim().length > 0 &&
    isDriverValid(driverNumber);

  const showModal = (
    type: 'success' | 'error' | 'confirm',
    title: string,
    message: string,
    onConfirmAction?: () => void
  ) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setOnConfirm(() => onConfirmAction || (() => { }));
    setModalVisible(true);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
    });
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      showModal('error', 'Invalid Data', 'Please fill all required fields correctly.\n\n• Select a customer\n• Enter vehicle number\n• Enter valid 10-digit driver mobile\n• Enter transporter name');
      return;
    }

    const result = await saveVehicleEntry({
      customerName: selectedCustomer!.name,
      vehicleNumber: vehicleNumber.trim(),
      transporterName: transporterName.trim(),
      driverNumber: driverNumber.trim(),
    });

    if (result?.id) {
      setSavedEntryId(result.id);
      setEntrySaved(true);
      setAllPhotosUploaded(false);
      setSaveDisabled(true); // Disable save button after success
      showModal('success', 'Success!', `Vehicle Entry Saved!`);
    } else {
      showModal('error', 'Error', error || 'Failed to save vehicle entry. Please try again.');
    }
  };

  const confirmClearAll = () => {
    showModal(
      'confirm',
      'Clear All Data?',
      'Are you sure you want to clear all entered data?',
      async () => {
        await clearDraftFromStorage();
        setCustomerQuery('');
        setSelectedCustomer(null);
        clearCustomers();
        setVehicleNumber('');
        setTransporterName('');
        setDriverNumber('');

        setSavedEntryId(null);
        setEntrySaved(false);
        setAllPhotosUploaded(false);
        setSaveDisabled(false);
        hideModal();
        customerInputRef.current?.focus();
      }
    );
  };

  const handleUploadComplete = async () => {
    setAllPhotosUploaded(true);
    await clearDraftFromStorage();
    setSaveDisabled(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Customer Search */}
        <TextInput
          ref={customerInputRef}
          style={styles.input}
          placeholder="Search Customer Name (min 3 chars) *"
          value={customerQuery}
          onChangeText={(text) => {
            setCustomerQuery(text);
            setSelectedCustomer(null);
            if (text.trim().length >= 3) {
              debouncedSearch(text);
            } else {
              clearCustomers();
            }
          }}
        />

        {loadingCustomers && (
          <ActivityIndicator style={{ marginTop: 8 }} color="#007AFF" />
        )}

        {/* Customer Dropdown List */}
        {customers.length > 0 && !selectedCustomer && (
          <View style={styles.dropdownContainer}>
            <FlatList
              data={customers}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedCustomer(item);
                    setCustomerQuery(item.name);
                    clearCustomers();
                  }}
                >
                  <Text style={styles.customerName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.customerAddr} numberOfLines={2}>
                    {item.address}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Vehicle Number */}
        <TextInput
          style={styles.input}
          placeholder="Vehicle Number *"
          value={vehicleNumber}
          onChangeText={formatVehicleNumber}
          autoCapitalize="characters"
        />

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
          <Text style={styles.errorText}>Enter 10 digits</Text>
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
            style={[
              styles.btn,
              styles.saveBtn,
              (!isFormValid() || saving || saveDisabled || entrySaved) && styles.btnDisabled,
            ]}
            onPress={handleSave}
            disabled={!isFormValid() || saving || saveDisabled || entrySaved}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.btnText}>
                  {entrySaved ? 'Entry Saved' : 'Save Entry'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={confirmClearAll}>
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.btnText}>Clear All</Text>
          </TouchableOpacity>

          {entrySaved && savedEntryId && (
            <View style={styles.attachWrapper}>
              <UploadImages
                vehicleEntryId={savedEntryId}
                onUploadSuccess={handleUploadComplete}
                renderTrigger={(openModal) => (
                  <TouchableOpacity style={styles.attachBtn} onPress={openModal}>
                    <Ionicons name="attach-outline" size={26} color="#1976D2" />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* Upload Section - shown only after entry is saved */}


        {error && !modalVisible && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      {/* Unified Modal */}
      <Modal transparent visible={modalVisible} animationType="none" onRequestClose={hideModal}>
        <Pressable style={styles.modalOverlay} onPress={modalType === 'confirm' ? undefined : hideModal}>
          <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
            <Pressable>
              <View style={styles.modalHeader}>

                <Text style={styles.modalTitle}>{modalTitle}</Text>
              </View>
              <Text style={styles.modalMessage}>{modalMessage}</Text>

              <View style={styles.modalButtonRow}>
                {modalType === 'confirm' && (
                  <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={hideModal}>
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    modalType === 'confirm' ? styles.modalConfirmButton : styles.modalOkButton,
                  ]}
                  onPress={() => {
                    if (modalType === 'confirm') {
                      onConfirm();
                    } else {
                      hideModal();
                    }
                  }}
                >
                  <Text style={styles.modalButtonText}>
                    {modalType === 'confirm' ? 'OK' : 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    paddingBottom: 40,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    marginTop: 12,
  },
  dropdownContainer: {
    maxHeight: 220,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  customerAddr: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
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
  attachWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  attachBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#E3F2FD', // Light blue background for the icon
  },
  btnDisabled: { backgroundColor: '#aaa' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  errorText: { color: '#d32f2f', marginTop: 6, fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginLeft: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },

  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalOkButton: { backgroundColor: '#007AFF' },
  modalConfirmButton: { backgroundColor: '#d32f2f' },
  modalCancelButton: { backgroundColor: '#aaa' },
  modalButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});