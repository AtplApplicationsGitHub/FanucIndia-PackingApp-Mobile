import React, { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Modal,
  StatusBar,
  Vibration,
  Pressable,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import LocationStorage from '../../Storage/Location_Storage';
import { useKeyboardDisabled } from '../../utils/keyboard';

// --- Types ---
type ExcelRow = {
  SO: string;
  YD?: string;
  Location: string; // System location
};

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertConfig = {
  visible: boolean;
  message: string;
  buttons: AlertButton[];
};

type ScannedRecord = {
  id: string; // Unique ID for list
  SO?: string;
  YD?: string;
  Location: string; // System location (if matched) or Derived
  ScanLocation: string;
  Status: 'Valid' | 'Invalid' | 'Missing' | 'Duplicate';
  Timestamp: number;
};

// --- Theme Colors ---
const COLORS = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  primary: '#FACC15', // Yellow
  primaryText: '#0B0F19',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  duplicate: '#8B5CF6',
};

const LocationScreen = () => {
  const navigation = useNavigation();

  // --- State ---
  const [excelData, setExcelData] = useState<ExcelRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const [scanLocation, setScanLocation] = useState('');
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  
  const [scanSoYd, setScanSoYd] = useState('');
  
  const [scannedRecords, setScannedRecords] = useState<ScannedRecord[]>([]);
  const [reportFiles, setReportFiles] = useState<ScannedRecord[]>([]);
  
  const [isReportView, setIsReportView] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [keyboardDisabled] = useKeyboardDisabled();
  
  // --- Alert State ---
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    message: '',
    buttons: [],
  });
  
  
  const [menuVisible, setMenuVisible] = useState(false);

  const showAlert = (message: string, buttons?: AlertButton[]) => {
    setAlertConfig({
      visible: true,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
    });
  };

  const handleAlertAction = (action?: () => void) => {
      setAlertConfig(prev => ({ ...prev, visible: false }));
      if (action) setTimeout(action, 100); // Small delay to allow modal to close smoothly
  };

  // --- Camera State ---
  const [permission, requestPermission] = useCameraPermissions();
  const [scanModal, setScanModal] = useState(false);
  const [activeScanField, setActiveScanField] = useState<'LOCATION' | 'SO' | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScanStatus, setLastScanStatus] = useState<'ADDED' | 'DUPLICATE' | 'INVALID' | 'NOT_FOUND' | 'ERROR' | null>(null);

  // Multi-scan tracking
  const [sessionCount, setSessionCount] = useState(0);
  const sessionCodesRef = useRef<Set<string>>(new Set());

  // --- Persistence ---
  
  // Load Session on Mount
  useEffect(() => {
    const loadSession = async () => {
      const data = await LocationStorage.getSession();
      if (data) {
        setExcelData(data.excelData || []);
        setFileName(data.fileName || null);
        setScannedRecords(data.scannedRecords || []);
        setReportFiles(data.reportFiles || []);
        setScanLocation(data.scanLocation || '');
        setIsLocationLocked(data.isLocationLocked || false);
        setScanSoYd(data.scanSoYd || '');
        setIsVerified(data.isVerified || false);
        setIsReportView(data.isReportView || false);
      }
      setIsLoaded(true);
    };
    loadSession();
  }, []);

  // Save Session on Change
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      await LocationStorage.saveSession({
        excelData,
        fileName,
        scannedRecords,
        reportFiles,
        scanLocation,
        isLocationLocked,
        scanSoYd,
        isVerified,
        isReportView
      });
    };
    saveData();
  }, [
    excelData, 
    fileName, 
    scannedRecords, 
    reportFiles, 
    scanLocation, 
    isLocationLocked, 
    scanSoYd, 
    isVerified, 
    isReportView, 
    isLoaded
  ]);

  // --- Back Navigation Handler ---
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isReportView) {
        // Prevent default behavior of leaving the screen
        e.preventDefault();
        // Go back to main view
        setIsReportView(false);
      }
    });

    return unsubscribe;
  }, [navigation, isReportView]);

  // --- Focus Management ---
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', () => {
      locationInputRef.current?.blur();
      soYdInputRef.current?.blur();
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      // Auto-focus location input when entering screen if appropriate
      if (excelData.length > 0 && !isLocationLocked) {
         setTimeout(() => {
             if (navigation.isFocused()) {
                locationInputRef.current?.focus();
             }
         }, 400);
      }
    });

    return () => {
        unsubscribeBlur();
        unsubscribeFocus();
    };
  }, [navigation, excelData, isLocationLocked]);

  // Auto-focus when unlocking manually
  useEffect(() => {
      if (!isLocationLocked && excelData.length > 0 && navigation.isFocused()) {
          setTimeout(() => {
             locationInputRef.current?.focus();
          }, 200);
      }
  }, [isLocationLocked, excelData, navigation]);

  // --- Header Options ---
  useLayoutEffect(() => {
    navigation.setOptions({
        title: isReportView ? 'Location Report' : 'Location Accuracy',
        headerRight: () => {
             return (
                <TouchableOpacity 
                   onPress={() => setMenuVisible(true)}
                   style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, padding: 4 }}
                >
                    <Text style={{ marginRight: 4, color: COLORS.primaryText, fontWeight: '600', fontSize: 14 }}></Text>
                    <Ionicons name="chevron-down-circle-outline" size={22} color={COLORS.primaryText} />
                </TouchableOpacity>
             );
        },
    });
  }, [navigation, isReportView]);// Removed unused deps for cleaner updates

  // --- Refs ---
  const locationInputRef = useRef<TextInput>(null);
  const soYdInputRef = useRef<TextInput>(null);

  // --- Actions ---

  const handleUploadExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const b64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });

      const workbook = XLSX.read(b64, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

      if (jsonData.length === 0) {
        showAlert('Excel file is empty.');
        return;
      }

      // Validate Headers
      const firstRow = jsonData[0];
      const hasSO = 'SO' in firstRow;
      const hasLocation = 'Location' in firstRow;
      // YD might be optional or required column presence? User said "on that excel file SO YD Location this data dont allow another excel"
      // Let's check for SO and Location as critical. YD often optional but column should likely be there if template is strict.
      // We will check for SO and Location keys.
      if (!hasSO || !hasLocation) {
        showAlert('Invalid Excel format. Required columns: SO, Location, YD');
        return;
      }

      setFileName(file.name);

      // Basic Validation/Normalization
      const normalizedData = jsonData.map(row => ({
        SO: row.SO ? String(row.SO).trim() : '',
        YD: row.YD ? String(row.YD).trim() : undefined,
        Location: row.Location ? String(row.Location).trim() : '',
      })).filter(r => r.SO && r.Location); // Must have SO and Location

      setExcelData(normalizedData);
      
      // Auto focus the location input after data loads and UI renders
      setTimeout(() => {
        if (navigation.isFocused()) {
            locationInputRef.current?.focus();
        }
      }, 500);
    } catch (err: any) {
      console.error('Excel Upload Error:', err);
      showAlert(`Upload Failed: ${err.message || 'Check file and permissions.'}`);
    }
  };

  const handleLockLocation = (overrideValue?: string) => {
    const valueToCheck = overrideValue !== undefined ? overrideValue : scanLocation;
    
    if (!valueToCheck.trim()) {
      showAlert('Please scan a location first.');
      return;
    }

    if (overrideValue !== undefined) {
        setScanLocation(overrideValue);
    }

    setIsLocationLocked(true);
    // Auto focus next field
    setTimeout(() => {
        if (navigation.isFocused()) {
            soYdInputRef.current?.focus();
        }
    }, 500);
  };

  const handleClearSession = () => {
    showAlert('Are you sure you want to clear the current session?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Clear', 
        style: 'destructive', 
        onPress: async () => {
          await LocationStorage.clearSession();
          setScanLocation('');
          setScanSoYd('');
          setIsLocationLocked(false);
          setScannedRecords([]);
          setReportFiles([]);
          setIsReportView(false);
          setIsVerified(false);
          setExcelData([]);
          setFileName(null);
        }
      }
    ]);
  };

  const handleSaveEntry = (valueOverride?: string, fromScanner: boolean = false): 'ADDED' | 'DUPLICATE' | 'INVALID' | 'NOT_FOUND' | 'ERROR' => {
    const rawValue = typeof valueOverride === 'string' ? valueOverride : scanSoYd;
    
    if (!rawValue.trim()) {
      if (!fromScanner) showAlert('Please scan SO or YD.');
      return 'ERROR';
    }

    const val = rawValue.trim().toUpperCase();
    const currentLoc = scanLocation.trim().toUpperCase();
    
    // Check if match exists in Excel
    const match = excelData.find(d => 
      (d.SO && d.SO.toUpperCase() === val) || 
      (d.YD && d.YD.toUpperCase() === val)
    );

    if (match) {
        // Found in Excel. Now check Location Match.
        const isLocationMatch = match.Location && match.Location.toUpperCase() === currentLoc;

        if (isLocationMatch) {
             // Valid Logic
             const isDuplicate = scannedRecords.some(r => r.SO === match.SO && r.Status === 'Valid');

             if (isDuplicate) {
                 // Show Popup for Duplicate
                 showAlert('SO already added');

                 // Logic to clear and refocus
                 setScanSoYd('');
                 if (!fromScanner) {
                     setTimeout(() => soYdInputRef.current?.focus(), 100);
                 }
                 
                 // Do NOT add a duplicate record to the list
                 return 'DUPLICATE';
             }
 
             const newRecord: ScannedRecord = {
                 id: Date.now().toString(),
                 SO: match.SO, 
                 YD: match.YD || '',
                 Location: match.Location,
                 ScanLocation: currentLoc,
                 Status: 'Valid',
                 Timestamp: Date.now(),
             };
 
             // Add new Verified record and remove ANY previous record for this SO (Valid, Invalid, Missing)
             setScannedRecords(prev => {
                const filtered = prev.filter(r => r.SO !== match.SO);
                return [newRecord, ...filtered];
             });
             
             // Cleanup input
             setScanSoYd('');
             if (!fromScanner) {
                 setTimeout(() => soYdInputRef.current?.focus(), 50);
             }
             return 'ADDED';

        } else {
             // Found SO but Wrong Location -> Invalid
             if (fromScanner) {
                 // REJECT in scanner mode
                 return 'INVALID';
             }

             // Manual mode: Log as invalid
             const newRecord: ScannedRecord = {
                 id: Date.now().toString(),
                 SO: match.SO, 
                 YD: match.YD || '',
                 Location: match.Location,
                 ScanLocation: currentLoc,
                 Status: 'Invalid',
                 Timestamp: Date.now(),
             };
             setScannedRecords(prev => [newRecord, ...prev]);

             // Clear and Focus for Invalid as well
             setScanSoYd('');
             if (!fromScanner) {
                 setTimeout(() => soYdInputRef.current?.focus(), 100);
             }
             return 'INVALID';
        }
    } else {
        // Not in Excel
        if (!fromScanner) {
             showAlert('SO not found in Excel data.');
        }

        // Logic to clear and refocus
        setScanSoYd('');
        if (!fromScanner) {
             setTimeout(() => soYdInputRef.current?.focus(), 100);
        }
        return 'NOT_FOUND';
    }
  };

  // --- Helper ---
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '-';
    // Format: DD/MM/YYYY HH:mm:ss
    const date = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const handleVerifyReport = () => {
    // --- Location Specific Verification (Main View) ---
    const currentLoc = scanLocation.trim().toUpperCase();

    if (!currentLoc) {
        showAlert('Please enter a location to verify.');
        return;
    }

    // Filter Excel data for the entered location
    const expectedItems = excelData.filter(d => 
        d.Location && d.Location.toUpperCase() === currentLoc
    );

    if (expectedItems.length === 0) {
        showAlert(`No items found in Excel for location: ${currentLoc}`);
        return;
    }

    // Identify what has already been scanned as ACTIVE/VALID for this location
    const scannedValidSOs = new Set(
        scannedRecords
            .filter(r => r.Status === 'Valid')
            .map(r => r.SO)
    );

    // Filter expected items to find ones NOT in the scanned set
    const missingItems = expectedItems.filter(item => !scannedValidSOs.has(item.SO));

    if (missingItems.length === 0) {
        showAlert('All items for this location have been scanned!');
    } else {
        // Create "Missing" records
        const newMissingRecords: ScannedRecord[] = missingItems.map(item => ({
            id: `missing-${item.SO}-${Date.now()}`,
            SO: item.SO,
            YD: item.YD,
            Location: item.Location,
            ScanLocation: '',
            Status: 'Missing',
            Timestamp: 0 // Not scanned
        }));

        // Update scannedRecords to show these in the main table
        setScannedRecords(prev => {
            const clean = prev.filter(r => r.Status !== 'Missing');
            return [...newMissingRecords, ...clean]; 
        });

        showAlert(`Found ${missingItems.length} missing items for ${currentLoc}.`);
    }

    setIsVerified(true);
  };

  const handleGenerateReport = () => {
    // --- Automatic Global Verification ---
    // Identify all items that have been successfully scanned (Valid)
    const scannedValidSOs = new Set(
        scannedRecords
            .filter(r => r.Status === 'Valid')
            .map(r => r.SO)
    );

    // Find items in Excel that are NOT in the valid scanned list
    const globalMissing = excelData.filter(d => !scannedValidSOs.has(d.SO));

    const missingRecords: ScannedRecord[] = globalMissing.map(item => ({
        id: `global-missing-${item.SO}-${Date.now()}`,
        SO: item.SO,
        YD: item.YD,
        Location: item.Location,
        ScanLocation: '',
        Status: 'Missing',
        Timestamp: 0 // Not scanned
    }));

    // Display: All manually scanned items (Valid/Invalid) + All calculated Missing items
    const currentScannedWithoutMissing = scannedRecords.filter(r => r.Status !== 'Missing');
    
    setReportFiles([...currentScannedWithoutMissing, ...missingRecords]);
    setIsVerified(true);
    setIsReportView(true);
    
    // Optional: You can uncomment this if you want an alert upon entry
    // showAlert(`Report Generated. Found ${missingRecords.length} missing.`);
  };

  const handleExport = async () => {
    if (reportFiles.length === 0) {
      showAlert('No data to export.');
      return;
    }

    const sheetData = reportFiles.map(r => ({
      SO: r.SO,
      YD: r.YD,
      'System Location': r.Location,
      'Scanned Location': r.ScanLocation,
      Status: r.Status,
      'Date & Time': formatTimestamp(r.Timestamp)
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const filename = "LocationReport.xlsx";

    try {
      if (Platform.OS === 'android') {
        // Use StorageAccessFramework for Android to save directly to a folder
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          
          if (permissions.granted) {
            const uri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            
            await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
            showAlert('Report saved successfully!');
            return;
          } else {
             showAlert('Directory permission not granted.');
             return;
          }
        } catch (e) {
           console.log("SAF Error or Cancelled", e);
           // Fallback to Sharing if SAF fails or is cancelled/not supported
           showAlert('Saving cancelled or failed. Taking you to spread options...');
        }
      }

      // Fallback for iOS or if Android SAF flow was skipped/failed
      const uri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        showAlert('Sharing is not available on this device.');
      }
    } catch (err: any) {
        console.error("Export Error:", err);
        showAlert("Failed to export file.");
    }
  };

  // --- Scanner Logic ---


  const openScanner = async (field: 'LOCATION' | 'SO') => {
    try {
      if (!permission) {
        const res = await requestPermission();
        if (!res.granted) {
            showAlert("Allow camera access to scan QR codes.");
            return;
        }
      } else if (!permission.granted) {
          if (!permission.canAskAgain) {
             showAlert("Please enable camera access in your device settings.");
             return;
          }
          const res = await requestPermission();
          if (!res.granted) {
            showAlert("Camera permission is required.");
            return;
          }
      }
      
      // Reset session state
      sessionCodesRef.current.clear();
      setSessionCount(0);
      setLastScannedCode(null);
      setLastScanStatus(null);
      
      setActiveScanField(field);
      setScanModal(true);
    } catch (err) {
       console.log(err);
       showAlert("Failed to access camera permission.");
    }
  };

  const closeScanner = () => {
    setScanModal(false);
    setActiveScanField(null);
  };

  const handleScanned = (result: BarcodeScanningResult) => {
    const value = (result?.data ?? "").trim();
    if (!value) return;

    if (activeScanField === 'LOCATION') {
        // Single scan for Location
        Vibration.vibrate();
        // setScanLocation(value); // Handled by handleLockLocation now
        setLastScannedCode(value);
        setScanModal(false);
        setActiveScanField(null);

        // Auto lock and move focus
        // We pass the value directly to ensure it uses the scanned value immediately
        handleLockLocation(value);
    } else if (activeScanField === 'SO') {
        // Multi scan for SO
        
        // Check for session duplicate
        if (sessionCodesRef.current.has(value)) {
            return;
        }
        
        // Add to session set to prevent burst reading
        sessionCodesRef.current.add(value);
        
        // Always provide feedback
        setLastScannedCode(value);
        
        // Try to save
        // remove setScanSoYd(value) to prevent input box flickering/persistence

        const status = handleSaveEntry(value, true);
        setLastScanStatus(status);
        
        if (status === 'ADDED') {
             Vibration.vibrate();
             setSessionCount(prev => prev + 1);
        } else if (status === 'DUPLICATE') {
             // Maybe a different vibration or none?
             Vibration.vibrate([0, 50, 50, 50]); // Short double blip
        } else {
             // Invalid
             Vibration.vibrate([0, 200]); // Long buzz for error
        }
        
        // Do NOT close modal
    }
  };

  // --- Counts ---
  const activeList = isReportView ? reportFiles : scannedRecords;
  
  const stats = useMemo(() => {
    const total = activeList.length;
    const valid = activeList.filter(r => r.Status === 'Valid').length;
    const invalid = activeList.filter(r => r.Status === 'Invalid').length;
    const missing = activeList.filter(r => r.Status === 'Missing').length;
    return { total, valid, invalid, missing };
  }, [activeList]);

  // --- Render ---

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Valid': return { color: '#16A34A', bg: '#DCFCE7', border: '#16A34A' }; // Green
      case 'Missing': return { color: '#EA580C', bg: '#FFEDD5', border: '#F97316' }; // Orange
      case 'Invalid': return { color: '#DC2626', bg: '#FEE2E2', border: '#EF4444' }; // Red
      case 'Duplicate': return { color: '#7C3AED', bg: '#EDE9FE', border: '#8B5CF6' }; // Purple
      default: return { color: COLORS.text, bg: 'transparent', border: 'transparent' };
    }
  };

  const renderItem = ({ item }: { item: ScannedRecord }) => {
    const { color, bg, border } = getStatusColor(item.Status);

    return (
      <View style={{ 
          flexDirection: 'row', 
          paddingVertical: 10,
          paddingHorizontal: 4, 
          borderBottomWidth: 1, 
          borderBottomColor: '#F3F4F6',
          backgroundColor: 'white',
          alignItems: 'center'
      }}>
        <View style={{ width: 90 }}><Text style={{ fontSize: 10, color: '#1F2937' }} numberOfLines={1}>{item.SO || '-'}</Text></View>
        <View style={{ width: 90 }}><Text style={{ fontSize: 10, color: '#4B5563' }} numberOfLines={1}>{item.YD || '-'}</Text></View>
        <View style={{ width: 90 }}><Text style={{ fontSize: 10, color: '#4B5563' }} numberOfLines={1}>{item.Location || '-'}</Text></View>
        <View style={{ width: 90 }}><Text style={{ fontSize: 10, color: '#4B5563' }} numberOfLines={1}>{item.ScanLocation || '-'}</Text></View>
        <View style={{ width: 70, alignItems: 'center' }}>
            <View style={{ 
                backgroundColor: bg, 
                paddingHorizontal: 2, 
                paddingVertical: 2, 
                borderRadius: 4,
                borderWidth: 1,
                borderColor: border,
                width: '100%',
                alignItems: 'center'
            }}>
                <Text style={{ fontSize: 8, color: color, fontWeight: '700' }}>{item.Status}</Text>
            </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Main Content */}
      <View style={styles.content}>
        
        {!isReportView && excelData.length === 0 && (
            <TouchableOpacity 
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}
                onPress={handleUploadExcel}
            >
               <Ionicons name="folder-open-outline" size={80} color={COLORS.muted} style={{ marginBottom: 16, opacity: 0.5 }} />
               <Text style={{ color: COLORS.muted, fontSize: 18, fontWeight: '600' }}>
                  Open Local File Manager
               </Text>
               <Text style={{ color: COLORS.muted, fontSize: 14, marginTop: 8, opacity: 0.8 }}>
                  Select an Excel file to begin
               </Text>
            </TouchableOpacity>
        )}

        {/* --- Stats Header --- */}
        {isReportView && (
            <View style={styles.statsContainer}>
                 <Text style={styles.statsText}>
                    <Text style={{ color: '#0284C7', fontWeight: 'bold' }}>Total: {stats.total}</Text>
                    <Text style={{ color: COLORS.muted }}>{'  /  '}</Text>
                    <Text style={{ color: '#00E096', fontWeight: 'bold' }}>Valid: {stats.valid}</Text>
                    <Text style={{ color: COLORS.muted }}>{'  /  '}</Text>
                    <Text style={{ color: '#FF3B30', fontWeight: 'bold' }}>Invalid: {stats.invalid}</Text>
                    <Text style={{ color: COLORS.muted }}>{'  /  '}</Text>
                    <Text style={{ color: '#FFAA00', fontWeight: 'bold' }}>Missing: {stats.missing}</Text>
                </Text>
            </View>
        )}

        {/* The rest is shown ONLY if data matches */}
        {excelData.length > 0 && !isReportView && (
          <>
            {/* Stats Removed as per request */}
            
            {/* Scan Inputs */}
            <View style={styles.card}>
              <View style={styles.inputRow}>
                <View style={[styles.inputWrapper, isLocationLocked && styles.inputLocked]}>
                  <TextInput
                    ref={locationInputRef}
                    style={styles.inputInner}
                    placeholder="Enter location"
                    placeholderTextColor={COLORS.muted}
                    value={scanLocation}
                    onChangeText={setScanLocation}
                    editable={!isLocationLocked}
                    onSubmitEditing={() => handleLockLocation()}
                    autoCapitalize="characters"
                    showSoftInputOnFocus={!keyboardDisabled}
                  />
                   {!isLocationLocked && (
                      <TouchableOpacity onPress={() => openScanner('LOCATION')} style={styles.scanIconBtnInside}>
                          <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.muted} />
                      </TouchableOpacity>
                   )}
                </View>

                {!isLocationLocked ? (
                    <TouchableOpacity onPress={() => handleLockLocation()} style={styles.actionBtn}>
                         <Ionicons name="location-outline" size={20} color={COLORS.primaryText} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => setIsLocationLocked(false)} style={[styles.actionBtn, { backgroundColor: COLORS.muted }]}>
                        <Ionicons name="create-outline" size={20} color="white" />
                    </TouchableOpacity>
                )}
              </View>
              
              {isLocationLocked && (
                  <>
                    <View style={styles.inputRow}>
                        <View style={styles.inputWrapper}>
                          <TextInput
                          ref={soYdInputRef}
                          style={styles.inputInner}
                          placeholder="Scan SO or YD"
                          placeholderTextColor={COLORS.muted}
                          value={scanSoYd}
                          onChangeText={setScanSoYd}
                          onSubmitEditing={() => handleSaveEntry()}
                          autoFocus
                          autoCapitalize="characters"
                          showSoftInputOnFocus={!keyboardDisabled}
                          />
                           <TouchableOpacity onPress={() => openScanner('SO')} style={styles.scanIconBtnInside}>
                               <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.muted} />
                          </TouchableOpacity>
                        </View>

                         <TouchableOpacity onPress={() => handleSaveEntry()} style={[styles.actionBtn, { backgroundColor: COLORS.success }]}>
                             <Ionicons name="save-outline" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                  </>
              )}
            </View>
          </>
        )}

        {/* Action Buttons & Table - Visible Only if Data Loaded or Report View */}
        {(excelData.length > 0 || isReportView) && (
        <View style={{ flex: 1, marginTop: 0 }}>
            {!isReportView && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                 <TouchableOpacity onPress={handleClearSession} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleVerifyReport} style={[styles.reportBtn, { backgroundColor: COLORS.warning, flex: 1 }]}>
                    <Text style={[styles.reportBtnText, { color: '#000' }]}>Verify</Text>
                </TouchableOpacity>
            </View>
            )}

            {/* Table - ContentAccuracy Style */}
            <View style={{ flex: 1, marginTop: 0, backgroundColor: '#fff', borderRadius: 0, elevation: 0, marginHorizontal: -12, borderTopWidth: 1, borderTopColor: '#E5E7EB', overflow: 'hidden' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ minWidth: 360 }}>
                        <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', alignItems: 'center' }}>
                            <View style={{ width: 90 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>SO</Text></View>
                            <View style={{ width: 90 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>YD</Text></View>
                            <View style={{ width: 90 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Loc</Text></View>
                            <View style={{ width: 90 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Scan</Text></View>
                            <View style={{ width: 70, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Status</Text></View>
                        </View>
                        
                        <FlatList
                            data={activeList}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            ListEmptyComponent={
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: COLORS.muted }}>No records yet.</Text>
                                </View>
                            }
                        />
                    </View>
                </ScrollView>
            </View>
        </View>
        )}

      </View>
      
      {/* Camera Modal */}
      <Modal
        visible={scanModal}
        onRequestClose={closeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
      >
        <StatusBar hidden />
        <View style={styles.fullscreenCameraWrap}>
          <CameraView
            style={styles.fullscreenCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                "qr", "code128", "ean13", "ean8", "upc_a", "upc_e", 
                "code39", "codabar", "code93", "pdf417", "datamatrix", "aztec", "itf14"
              ],
            }}
            onBarcodeScanned={handleScanned}
          />
          
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenTitle}>Scan {activeScanField === 'LOCATION' ? 'Location' : 'SO / YD'}</Text>
            <TouchableOpacity onPress={closeScanner} style={styles.fullscreenCloseBtn}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          
          <View style={styles.fullscreenBottomBar}>
             <Text style={styles.fullscreenHint}>Align code within frame</Text>
             {lastScannedCode && activeScanField === 'SO' && (
                <View style={styles.scanFeedback}>
                   <Text style={styles.scanCounter}>
                        Scanned: {sessionCount}
                   </Text>
                   <Text style={styles.lastScanText} numberOfLines={1}>
                       {lastScannedCode}
                   </Text>
                </View>
             )}
          </View>
          
          <View style={styles.focusFrameContainer} pointerEvents="none">
             <View style={[
                 styles.focusFrame, 
                 lastScanStatus === 'ADDED' ? { borderColor: COLORS.success } : 
                 lastScanStatus ? { borderColor: COLORS.error } : null
             ]} />
          </View>
        </View>
      </Modal>

      {/* Dropdown Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
         <TouchableOpacity 
            style={styles.menuOverlay} 
            activeOpacity={1} 
            onPress={() => setMenuVisible(false)}
         >
            <View style={styles.menuContainer}>
                {/* Header for Menu */}
                <View style={styles.menuHeader}>
                    <Text style={styles.menuTitle}>Actions</Text>
                </View>

                {!isReportView && (
                    <TouchableOpacity onPress={() => { setMenuVisible(false); handleUploadExcel(); }} style={styles.menuItem}>
                         <MaterialCommunityIcons 
                             name={excelData.length > 0 ? "file-replace-outline" : "cloud-upload-outline"} 
                             size={20} 
                             color={excelData.length > 0 ? COLORS.text : '#10B981'} 
                         />
                         <Text style={styles.menuItemText}>{excelData.length > 0 ? "Replace Excel" : "Upload Excel"}</Text>
                    </TouchableOpacity>
                )}
                
                {!isReportView && excelData.length > 0 && (
                     <TouchableOpacity onPress={() => { setMenuVisible(false); handleGenerateReport(); }} style={styles.menuItem}>
                         <MaterialCommunityIcons name="file-document-multiple" size={20} color="#2196F3" />
                         <Text style={styles.menuItemText}>Generate Report</Text>
                     </TouchableOpacity>
                )}

                {isReportView && (
                     <TouchableOpacity onPress={() => { setMenuVisible(false); handleExport(); }} style={styles.menuItem}>
                         <MaterialCommunityIcons name="file-excel-outline" size={20} color={'#10B981'} />
                         <Text style={styles.menuItemText}>Export Report</Text>
                     </TouchableOpacity>
                )}
            </View>
         </TouchableOpacity>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        visible={alertConfig.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
                <Text style={styles.alertMessage}>{alertConfig.message}</Text>
                
                <View style={styles.alertButtonContainer}>
                    {alertConfig.buttons.map((btn, index) => {
                        const isDestructive = btn.style === 'destructive';
                        const isCancel = btn.style === 'cancel';
                        const isPrimary = !isDestructive && !isCancel;

                        return (
                            <TouchableOpacity 
                                key={index} 
                                style={[
                                    styles.alertButton, 
                                    isPrimary && styles.alertButtonPrimary,
                                    isDestructive && styles.alertButtonDestructive,
                                    isCancel && styles.alertButtonCancel
                                ]}
                                onPress={() => handleAlertAction(btn.onPress)}
                            >
                                <Text style={[
                                    styles.alertButtonText,
                                    isPrimary && styles.alertTextPrimary,
                                    isDestructive && styles.alertTextDestructive,
                                    isCancel && styles.alertTextCancel
                                ]}>{btn.text}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
      </Modal>


    </SafeAreaView>
  );
};

export default LocationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 4,
    paddingTop: 0,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 10,
    marginBottom: 4,
    // Borders removed for cleaner look
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  statsContainer: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statsText: {
    fontSize: 11,
    color: COLORS.text,
  },

  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingRight: 8,
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: COLORS.text,
    fontSize: 14,
  },
  scanIconBtnInside: {
      padding: 8,
  },
  inputLocked: {
      opacity: 0.7,
      backgroundColor: '#F3F4F6'
  },
  actionBtn: {
      width: 36,
      height: 36,
      backgroundColor: COLORS.primary,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
  },
  verifyBtn: {
      flex: 1,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
  },
  verifyBtnText: {
      color: COLORS.primary,
      fontWeight: '600',
      fontSize: 13,
  },
  clearBtn: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 8,
      paddingVertical: 6,
      alignItems: 'center',
  },
  clearBtnText: {
       color: COLORS.text,
       fontWeight: '600',
       fontSize: 12,
  },
  reportBtn: {
      flex: 1,
       backgroundColor: COLORS.primary,
      borderRadius: 8,
      paddingVertical: 6,
      alignItems: 'center',
  },
  reportBtnText: {
      color: COLORS.primaryText,
      fontWeight: '700',
      fontSize: 12,
  },
  
  // Table
  tableHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      paddingBottom: 4,
      marginBottom: 4,
  },
  tableHeadText: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '600',
  },
  row: {
      flexDirection: 'row',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      alignItems: 'center',
  },
  cell: {
      color: COLORS.text,
      fontSize: 12,
  },
  
  // Camera Styles
  focusFrameContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  focusFrame: {
    width: 260, height: 260, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24
  },
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 44 : 16,
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  fullscreenCloseBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    fontWeight: "700", color: "#000", fontSize: 14
  },
  fullscreenBottomBar: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
    alignItems: "center",
  },
  fullscreenHint: { color: "#ccc", fontSize: 13 },
  scanFeedback: {
     alignItems: "center",
     width: "100%",
     marginTop: 8
  },
  scanCounter: { color: "#4ADE80", fontWeight: "700", fontSize: 16 },
  lastScanText: { color: "#fff", fontSize: 14, marginTop: 2, textAlign: "center", width: "100%" },

  // Alert Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
        width: 0,
        height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  alertMessage: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  alertButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
    flexWrap: 'wrap-reverse', // To handle many buttons if needed
  },
  alertButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6', // Default for cancel/others
  },
  alertButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  alertButtonDestructive: {
    backgroundColor: '#FEE2E2',
  },
  alertButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  alertTextPrimary: {
    color: '#0B0F19',
  },
  alertTextDestructive: {
    color: '#EF4444',
  },
  alertTextCancel: {
    color: '#374151',
  },
  
  // Menu Styles
  menuOverlay: {
      flex: 1,
      backgroundColor: 'transparent',
  },
  menuContainer: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 100 : 56, // Adjust based on header height
      right: 12,
      backgroundColor: 'white',
      borderRadius: 12,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      paddingVertical: 4,
      minWidth: 180,
      borderWidth: 1,
      borderColor: '#E5E7EB',
  },
  menuHeader: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
  },
  menuTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.muted,
      textTransform: 'uppercase',
  },
  menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
  },
  menuItemText: {
      marginLeft: 12,
      fontSize: 14,
      fontWeight: '500',
      color: COLORS.text,
  },
});
