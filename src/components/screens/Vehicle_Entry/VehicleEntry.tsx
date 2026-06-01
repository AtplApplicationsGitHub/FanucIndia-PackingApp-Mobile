// src/screens/VehicleEntry.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
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
import { useVehicleEntry, Customer, Transporter } from '../../Api/Hooks/UseVehicleEntry';
import UploadImages from './upload_Images';
import {
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
  VehicleDraft,
} from '../../Storage/VehicleEntry_Storage';

const TimeSelectionField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [period, setPeriod] = useState('AM');

  useEffect(() => {
    if (value) {
      const parts = value.split(' ');
      setTimeStr(parts[0] || '');
      setPeriod(parts[1] || 'AM');
    } else {
      setTimeStr('');
      setPeriod('AM');
    }
  }, [value]);

  const handleTextChange = (text: string) => {
    let digits = text.replace(/[^0-9]/g, '');
    digits = digits.substring(0, 4);

    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.substring(0, 2)}:${digits.substring(2)}`;
    }

    setTimeStr(formatted);

    if (formatted.trim() !== '') {
      onChange(`${formatted} ${period}`);
    } else {
      onChange('');
    }
  };

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    if (timeStr.trim() !== '') {
      onChange(`${timeStr} ${newPeriod}`);
    }
  };

  return (
    <View style={styles.timeSelectionContainer}>
      <TextInput
        style={styles.timeTextInput}
        placeholder={label}
        value={timeStr}
        onChangeText={handleTextChange}
        keyboardType="number-pad"
        maxLength={5}
      />
      <TouchableOpacity
        style={[styles.amPmButton, period === 'PM' && styles.amPmButtonActive]}
        onPress={togglePeriod}
      >
        <Text style={[styles.amPmButtonText, period === 'PM' && styles.amPmButtonTextActive]}>
          {period}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default function VehicleEntryScreen() {
  const {
    customers,
    loadingCustomers,
    transporters,
    loadingTransporters,
    saving,
    error,
    debouncedSearch,
    debouncedTransporterSearch,
    saveVehicleEntry,
    clearCustomers,
    setTransporters,
  } = useVehicleEntry();

  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [selectedTransporter, setSelectedTransporter] = useState<Transporter | null>(null);
  const [driverNumber, setDriverNumber] = useState('');
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');

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

  // Filter and sort customers: ensure matches starting with query appear at the top
  const sortedCustomers = useMemo(() => {
    if (!customers || customers.length === 0) return [];

    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers;

    return [...customers].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      const startsWithA = nameA.startsWith(query);
      const startsWithB = nameB.startsWith(query);

      if (startsWithA && !startsWithB) return -1;
      if (!startsWithA && startsWithB) return 1;
      return 0;
    });
  }, [customers, customerQuery]);

  // Filter and sort transporters: ensure matches starting with query appear at the top
  const sortedTransporters = useMemo(() => {
    if (!transporters || transporters.length === 0) return [];

    const query = transporterName.trim().toLowerCase();
    if (!query) return transporters;

    return [...transporters].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      const startsWithA = nameA.startsWith(query);
      const startsWithB = nameB.startsWith(query);

      if (startsWithA && !startsWithB) return -1;
      if (!startsWithA && startsWithB) return 1;
      return 0;
    });
  }, [transporters, transporterName]);

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
        setInTime(draft.inTime || '');
        setOutTime(draft.outTime || '');

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
        inTime,
        outTime,

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

  const isDriverValid = (d: string) => {
    return /^\d*$/.test(d.trim());
  };

  const isFormValid = () =>
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
      showModal('error', 'Invalid Data', 'Please fill all required fields correctly.\n\n• Enter vehicle number\n• Enter transporter name');
      return;
    }

    const tInTime = inTime.trim();
    if (tInTime !== '' && !/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i.test(tInTime)) {
      showModal('error', 'Invalid Time', 'In Time must be a valid 12-hour format time (e.g., 10:30 AM)');
      return;
    }

    const tOutTime = outTime.trim();
    if (tOutTime !== '' && !/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i.test(tOutTime)) {
      showModal('error', 'Invalid Time', 'Out Time must be a valid 12-hour format time (e.g., 05:45 PM)');
      return;
    }

    const payload: any = {
      customerName: selectedCustomer ? selectedCustomer.name : customerQuery.trim(),
      vehicleNumber: vehicleNumber.trim(),
      transporterName: transporterName.trim(),
      driverNumber: driverNumber.trim(),
    };

    if (tInTime !== '') payload.inTime = tInTime;
    if (tOutTime !== '') payload.outTime = tOutTime;

    const result = await saveVehicleEntry(payload);

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
        setSelectedTransporter(null);
        setTransporters([]);
        setDriverNumber('');
        setInTime('');
        setOutTime('');

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
    setSaveDisabled(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          ref={customerInputRef}
          style={styles.input}
          placeholder="Search Customer Name (min 3 chars) (Optional)"
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
        {sortedCustomers.length > 0 && !selectedCustomer && (
          <View style={styles.dropdownContainer}>
            <FlatList
              data={sortedCustomers}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
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
          placeholder="Driver Mobile (Optional)"
          value={driverNumber}
          keyboardType="number-pad"
          onChangeText={(t) => setDriverNumber(t.replace(/[^0-9]/g, ''))}
        />

        {/* Transporter Name */}
        <TextInput
          style={styles.input}
          placeholder="Transporter Name * (min 3 chars)"
          value={transporterName}
          onChangeText={(text) => {
            setTransporterName(text);
            setSelectedTransporter(null);
            if (text.trim().length >= 3) {
              debouncedTransporterSearch(text);
            } else {
              setTransporters([]);
            }
          }}
        />

        {loadingTransporters && (
          <ActivityIndicator style={{ marginTop: 8 }} color="#007AFF" />
        )}

        {/* Transporter Dropdown List */}
        {sortedTransporters.length > 0 && !selectedTransporter && (
          <View style={styles.dropdownContainer}>
            <FlatList
              data={sortedTransporters}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedTransporter(item);
                    setTransporterName(item.name);
                    setTransporters([]);
                  }}
                >
                  <Text style={styles.customerName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Time Inputs */}
        <View style={styles.timeRow}>
          <TimeSelectionField
            label="In Time"
            value={inTime}
            onChange={setInTime}
          />
          <TimeSelectionField
            label="Out Time"
            value={outTime}
            onChange={setOutTime}
          />
        </View>

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
    padding: 5,
    backgroundColor: '#f8f9fa',
    paddingBottom: 0,
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
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeSelectionContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  timeTextInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
  },
  amPmButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
  },
  amPmButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  amPmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  amPmButtonTextActive: {
    color: '#007AFF',
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
