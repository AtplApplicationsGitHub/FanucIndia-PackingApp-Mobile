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
  Platform,
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
import { useKeyboardDisabled } from '../../utils/keyboard';
import PutAwayStorage, { type ScannedRecord } from '../../Storage/putaway_Storage';

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

// ScannedRecord type imported from storage

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

type GroupedRecord = {
    id: string; // Composite ID
    Location: string;
    SOs: string; // Comma separated
    Status: 'Valid' | 'Invalid' | 'Missing';
    Timestamp: number; // Latest timestamp
};

const PutAwayScreen = () => {
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
  
  const [keyboardDisabled] = useKeyboardDisabled();

  // --- Filter State ---
  const [filterType, setFilterType] = useState<'ALL' | 'Scanned' | 'Empty'>('Scanned');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // --- Storage ---
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Session on Mount
  useEffect(() => {
      const load = async () => {
          const session = await PutAwayStorage.getSession();
          if (session) {
              setExcelData(session.excelData || []);
              setFileName(session.fileName || null);
              setScannedRecords(session.scannedRecords || []);
              setReportFiles(session.reportFiles || []);
              setScanLocation(session.scanLocation || '');
              setIsLocationLocked(session.isLocationLocked || false);
              setScanSoYd(session.scanSoYd || '');
              setIsVerified(session.isVerified || false);
              setIsReportView(session.isReportView || false);
              setFilterType(session.filterType || 'Scanned');
          }
          setIsLoaded(true);
      };
      load();
  }, []);

  // Save Session on Change
  useEffect(() => {
      if (isLoaded) {
          PutAwayStorage.saveSession({
              excelData,
              fileName,
              scannedRecords,
              reportFiles,
              scanLocation,
              isLocationLocked,
              scanSoYd,
              isVerified,
              isReportView,
              filterType
          });
      }
  }, [
      isLoaded,
      excelData,
      fileName,
      scannedRecords,
      reportFiles,
      scanLocation,
      isLocationLocked,
      scanSoYd,
      isVerified,
      isReportView,
      filterType
  ]);
  
  // --- Alert State ---
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    message: '',
    buttons: [],
  });
  
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
        headerRight: () => {
             return (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!isReportView && (
                         <TouchableOpacity onPress={handleUploadExcel} style={{ marginRight: 16 }}>
                           <MaterialCommunityIcons 
                             name={excelData.length > 0 ? "file-replace-outline" : "cloud-upload-outline"} 
                             size={28}
                             color={excelData.length > 0 ? COLORS.text : '#10B981'} 
                           />
                         </TouchableOpacity>
                    )}

                    {!isReportView && excelData.length > 0 && (
                        <TouchableOpacity onPress={handleGenerateReport} style={{ marginRight: 8, padding: 4 }}>
                            <MaterialCommunityIcons
                              name="file-document-multiple"
                              size={20}
                              color="#2196F3"
                            />
                        </TouchableOpacity>
                    )}
                    
                    {isReportView && (
                        <TouchableOpacity onPress={handleExport} style={{ marginRight: 8, padding: 4 }}>
                          <MaterialCommunityIcons name="file-excel-outline" size={24} color={'#10B981'}/>
                        </TouchableOpacity>
                    )}
                </View>
             );
        },
    });
  }, [navigation, isReportView, excelData, scannedRecords, reportFiles]);

  // --- Refs ---
  const locationInputRef = useRef<TextInput>(null);
  const soYdInputRef = useRef<TextInput>(null);

  // --- Actions ---

  const handleUploadExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
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
      // Validate Headers
      const firstRow = jsonData[0];
      const hasLocation = 'Location' in firstRow;

      if (!hasLocation) {
        showAlert('Invalid Excel format. Required column: Location');
        return;
      }

      setFileName(file.name);

      // Basic Validation/Normalization
      const normalizedData = jsonData.map(row => ({
        SO: row.SO ? String(row.SO).trim() : '',
        YD: row.YD ? String(row.YD).trim() : undefined,
        Location: row.Location ? String(row.Location).trim() : '',
      })).filter(r => r.Location); // Must have Location

      setExcelData(normalizedData);
      
      // Auto focus the location input after data loads and UI renders
      setTimeout(() => {
        if (navigation.isFocused()) {
            locationInputRef.current?.focus();
        }
      }, 500);
    } catch (err) {
      console.error(err);
      showAlert('Failed to parse Excel file.');
    }
  };

  const handleLockLocation = (overrideValue?: string) => {
    const valueToCheck = overrideValue !== undefined ? overrideValue : scanLocation;
    
    if (!valueToCheck.trim()) {
      showAlert('Please scan a location first.');
      return;
    }

    // Validate Location against Excel Master List
    if (excelData.length > 0) {
        const locNorm = valueToCheck.trim().toUpperCase();
        const exists = excelData.some(d => d.Location.toUpperCase() === locNorm);
        if (!exists) {
            showAlert(`Location '${valueToCheck}' not found in the valid list.`);
            return;
        }
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
          setScanLocation('');
          setScanSoYd('');
          setIsLocationLocked(false);
          setScannedRecords([]);
          setReportFiles([]);
          setIsReportView(false);
          setIsVerified(false);
          setExcelData([]);
          setFileName(null);
          await PutAwayStorage.clearSession();
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
    
    // Check mode: Plan (has SOs) or Free (only Locations)
    const planRows = excelData.filter(d => d.SO && d.SO.trim().length > 0);
    const hasPlan = planRows.length > 0;

    // Find ALL matches in Plan (because same SO might be in multiple locations)
    const matches = planRows.filter(d => 
      (d.SO && d.SO.toUpperCase() === val) || 
      (d.YD && d.YD.toUpperCase() === val)
    );

    if (hasPlan) {
        if (matches.length > 0) {
            // Check if ANY match corresponds to the current location
            // We prioritize the match that fits the current location context
            const locMatch = matches.find(m => m.Location && m.Location.toUpperCase() === currentLoc);
            const anyMatch = matches[0]; // Fallback for data info if location mismatch

            if (locMatch) {
                 // Valid for THIS location - Check Duplicate AT THIS LOCATION
                 const isDuplicate = scannedRecords.some(r => 
                     r.SO === locMatch.SO && 
                     (r.Location || r.ScanLocation) === currentLoc &&
                     r.Status === 'Valid'
                 );
    
                 if (isDuplicate) {
                     showAlert('SO already added for this location');
                     setScanSoYd('');
                     if (!fromScanner) soYdInputRef.current?.focus();
                     return 'DUPLICATE';
                 }
     
                 const newRecord: ScannedRecord = {
                     id: Date.now().toString(),
                     SO: locMatch.SO, 
                     YD: locMatch.YD || '',
                     Location: locMatch.Location,
                     ScanLocation: currentLoc,
                     Status: 'Valid',
                     Timestamp: Date.now(),
                 };
     
                 setScannedRecords(prev => [newRecord, ...prev]);
                 
                 setScanSoYd('');
                 if (!fromScanner) soYdInputRef.current?.focus();
                 return 'ADDED';
    
            } else {
                 // Found SO matches but NONE at current Location -> Invalid
                 if (fromScanner) return 'INVALID';
    
                 const newRecord: ScannedRecord = {
                     id: Date.now().toString(),
                     SO: anyMatch.SO, 
                     YD: anyMatch.YD || '',
                     Location: anyMatch.Location, // Show expected location of first match
                     ScanLocation: currentLoc,
                     Status: 'Invalid',
                     Timestamp: Date.now(),
                 };
                 setScannedRecords(prev => [newRecord, ...prev]);
                 return 'INVALID';
            }
        } else {
            // Not in Plan
            if (!fromScanner) showAlert('SO not found in Excel data.');
            return 'NOT_FOUND';
        }
    } else {
        // --- Free Mode (Location List Only) ---
        // Verify ScanLocation is valid (should be covered by lock, but double check)
        const validLocEntry = excelData.find(d => d.Location.toUpperCase() === currentLoc);
        if (!validLocEntry) {
             if (!fromScanner) showAlert('Invalid Location context.');
             return 'INVALID';
        }

        // Check if SO duplicate AT THIS LOCATION
        const isDuplicate = scannedRecords.some(r => 
            r.SO === val && 
            (r.Location || r.ScanLocation) === currentLoc && 
            r.Status === 'Valid'
        );

        if (isDuplicate) {
             showAlert('SO already added for this location');
             setScanSoYd('');
             if (!fromScanner) soYdInputRef.current?.focus();
             return 'DUPLICATE';
        }

        const newRecord: ScannedRecord = {
             id: Date.now().toString(),
             SO: val,
             YD: '',
             Location: currentLoc,
             ScanLocation: currentLoc,
             Status: 'Valid',
             Timestamp: Date.now(),
        };

        setScannedRecords(prev => [newRecord, ...prev]);
        setScanSoYd('');
        if (!fromScanner) soYdInputRef.current?.focus();
        return 'ADDED';
    }
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
        d.Location && d.Location.toUpperCase() === currentLoc && d.SO
    );

    if (expectedItems.length === 0) {
        // Count just for feedback in free mode
        const scannedCount = scannedRecords.filter(r => r.ScanLocation === currentLoc && r.Status === 'Valid').length;
        showAlert(`No specific plan for ${currentLoc}. Items scanned here: ${scannedCount}`);
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
        const newMissingRecords: ScannedRecord[] = missingItems.map((item, index) => ({
            id: `missing-${item.SO}-${Date.now()}-${index}`,
            SO: item.SO,
            YD: item.YD,
            Location: item.Location,
            ScanLocation: '',
            Status: 'Missing',
            Timestamp: Date.now()
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
            .filter(r => r.Status === 'Valid' && r.SO)
            .map(r => r.SO)
    );

    // Identify all Locations that have been scanned (Valid) - For checking location-only coverage
    const scannedLocations = new Set(
        scannedRecords
            .filter(r => r.Status === 'Valid')
            .map(r => (r.Location || r.ScanLocation || '').trim().toUpperCase())
    );

    // Find items in Excel that are NOT in the valid scanned list
    const globalMissing = excelData.filter(d => {
        const soVal = d.SO ? d.SO.trim() : '';
        const locVal = (d.Location || '').trim().toUpperCase();

        if (soVal) {
             // Strict Plan: If the row has an SO, check if that SO was scanned
             return !scannedValidSOs.has(soVal);
        } else {
             // Free/Location Plan: If the row has NO SO (placeholder), 
             // check if the Location has been visited at least once.
             // If scanned, we consider the placeholder satisfied.
             return !scannedLocations.has(locVal);
        }
    });

    const missingRecords: ScannedRecord[] = globalMissing.map((item, index) => ({
        id: `global-missing-${item.SO || 'loc'}-${Date.now()}-${index}`,
        SO: item.SO,
        YD: item.YD,
        Location: item.Location,
        ScanLocation: '',
        Status: 'Missing',
        Timestamp: 0 // Set to 0 so they appear at the bottom of the list (sorted by time desc)
    }));

    // Display: All manually scanned items (Valid/Invalid) + All calculated Missing items
    const currentScannedWithoutMissing = scannedRecords.filter(r => r.Status !== 'Missing');
    
    setReportFiles([...currentScannedWithoutMissing, ...missingRecords]);
    setIsVerified(true);
    setIsReportView(true);
  };

  const handleExport = async () => {
      // Group for export as well
      const activeList = reportFiles.length > 0 ? reportFiles : scannedRecords;
      const groupedData = getGroupedRecords(activeList);

      if (groupedData.length === 0) {
          showAlert('No data to export.');
          return;
      }
      
      
      // Export based on IMPORTED Excel Data Order
      // Logic:
      // 1. If Excel Row has specific SO -> Strict Match (Show Scanned/Empty for that specific SO)
      // 2. If Excel Row has NO SO (Location Only) -> Find ALl scans for that location and expand them.
      
      let sheetData: any[] = [];

      if (excelData.length > 0) {
           // 1. Map for Strict Matching (SO + Location)
           const strictMap = new Map();
           // 2. Map for Location-Only Matching (Location -> List of Scans)
           const locMap = new Map<string, ScannedRecord[]>();

           scannedRecords.forEach(r => {
               // Strict Key
               if (r.SO && r.Status === 'Valid') {
                    const strictKey = `${r.SO.toUpperCase().trim()}|${(r.Location || '').toUpperCase().trim()}`;
                    strictMap.set(strictKey, r);
               }

               // Location Map (only valid scans)
               if (r.Status === 'Valid') {
                   const locKey = (r.Location || r.ScanLocation || '').toUpperCase().trim();
                   if (!locMap.has(locKey)) locMap.set(locKey, []);
                   locMap.get(locKey)?.push(r);
               }
           });

           let sno = 1;
           
           excelData.forEach((row) => {
               const soVal = row.SO ? row.SO.toString().trim() : '';
               const locVal = row.Location ? row.Location.toString().trim() : '';
               
               if (soVal) {
                   // --- STRICT PLAN MODE (Row has SO) ---
                   const strictKey = `${soVal.toUpperCase()}|${locVal.toUpperCase()}`;
                   const scannedRecord = strictMap.get(strictKey);
                   
                   sheetData.push({
                       'S/No': sno++,
                       'Location': locVal,
                       'SO': soVal,
                       'Status': scannedRecord ? 'Scanned' : 'Empty',
                       'Date and time': scannedRecord && scannedRecord.Timestamp ? new Date(scannedRecord.Timestamp).toLocaleString() : '-'
                   });
               } else {
                   // --- FREE / LOCATION ONLY MODE (Row is just a Location) ---
                   const locKey = locVal.toUpperCase();
                   const scansForLoc = locMap.get(locKey);

                   if (scansForLoc && scansForLoc.length > 0) {
                       // Expand: One row per scanned SO at this location
                       scansForLoc.forEach(scan => {
                           sheetData.push({
                               'S/No': sno++,
                               'Location': locVal,
                               'SO': scan.SO, // Use the ACTUAL scanned SO
                               'Status': 'Scanned',
                               'Date and time': scan.Timestamp ? new Date(scan.Timestamp).toLocaleString() : '-'
                           });
                       });
                   } else {
                       // No scans for this location placeholder
                       sheetData.push({
                           'S/No': sno++,
                           'Location': locVal,
                           'SO': '', 
                           'Status': 'Empty',
                           'Date and time': '-'
                       });
                   }
               }
           });

      } else {
           // Backward compatibility for completely Empty Plan (shouldn't happen with excelData check, but for safety)
          let sno = 1;
          groupedData.forEach(r => {
              const sos = r.SOs ? r.SOs.split(',') : [];

              if (sos.length > 0) {
                  sos.forEach(so => {
                      sheetData.push({
                          'S/No': sno++,
                          'Location': r.Location,
                          'SO': so.trim(),
                          'Status': r.Status === 'Valid' ? 'Scanned' : (r.Status === 'Invalid' ? 'Empty' : r.Status),
                          'Date and time': r.Timestamp ? new Date(r.Timestamp).toLocaleString() : '-'
                      });
                  });
              } else {
                  sheetData.push({
                      'S/No': sno++,
                      'Location': r.Location,
                      'SO': '',
                      'Status': r.Status === 'Valid' ? 'Scanned' : (r.Status === 'Invalid' ? 'Empty' : r.Status),
                      'Date and time': r.Timestamp ? new Date(r.Timestamp).toLocaleString() : '-'
                  });
              }
          });
      }
      
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const uri = FileSystem.cacheDirectory + 'PutAwayReport.xlsx';
      
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
      
      if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
      } else {
          showAlert('Sharing is not available on this device.');
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

  // --- Grouping Logic ---
  const getGroupedRecords = (records: ScannedRecord[]): GroupedRecord[] => {
      // Return flat list converted to GroupedRecord format for consistency
      // User request: "supprate SO one one" - No grouping by location
      return records.map(record => ({
              id: record.id,
              Location: record.Location || record.ScanLocation || 'Unknown',
              SOs: record.SO || '',
              Status: (record.Status === 'Invalid' ? 'Invalid' : (record.Status === 'Missing' ? 'Missing' : 'Valid')) as GroupedRecord['Status'],
              Timestamp: record.Timestamp
      })).sort((a, b) => b.Timestamp - a.Timestamp);
  };

  // --- Helper ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Valid': 
      case 'Scanned':
          return { color: '#16A34A', bg: '#DCFCE7', border: '#16A34A' }; // Green
      case 'Missing':
      case 'Empty': 
          return { color: '#EA580C', bg: '#FFEDD5', border: '#F97316' }; // Orange
      case 'Invalid': 
          return { color: '#DC2626', bg: '#FEE2E2', border: '#EF4444' }; // Red
      default: 
          return { color: COLORS.text, bg: 'transparent', border: 'transparent' };
    }
  };

  // --- Filtering & Grouping ---
  
  const groupedList = useMemo(() => {
      // Determine Source & Mode
      let sourceRecords = scannedRecords;
      let generateMissingFromPlan = true;
      let applyFilter = filterType;

      if (isReportView) {
          sourceRecords = reportFiles;
          generateMissingFromPlan = false; // Report already contains the calculated missing items
          applyFilter = 'ALL'; // Second screen shows all data by default
      }

      // 1. Process Source Records (Flat List)
      // We do NOT group by location anymore, as per user request to separate SOs
      const flatList: GroupedRecord[] = sourceRecords.map(record => ({
            id: record.id,
            Location: record.Location || record.ScanLocation || 'Unknown',
            SOs: record.SO || '',
            Status: (record.Status === 'Invalid' ? 'Invalid' : (record.Status === 'Missing' ? 'Missing' : 'Valid')) as GroupedRecord['Status'],
            Timestamp: record.Timestamp || 0
      }));

      // 2. Merge Missing/Empty Locations from Excel Plan (Only for Main View)
      if (generateMissingFromPlan && excelData.length > 0) {
           // Find locations that have ANY scan activity (Valid or Invalid)
           const scannedLocs = new Set(sourceRecords.map(r => 
               (r.Location || r.ScanLocation || '').trim().toUpperCase()
           ));

           // Filter Excel data to find rows where Location was NOT scanned at all
           const unscannedRows = excelData.filter(row => {
               const loc = (row.Location || '').trim().toUpperCase();
               return loc && !scannedLocs.has(loc);
           });

           // Add these as "Empty/Missing" records
           unscannedRows.forEach((row, idx) => {
               // One entry per SO - flattened
               flatList.push({
                   id: `plan-${row.Location}-${idx}`,
                   Location: row.Location,
                   SOs: row.SO || '', 
                   Status: 'Missing', 
                   Timestamp: 0 
               });
           });
      }

      const sortedList = flatList.sort((a, b) => b.Timestamp - a.Timestamp);
      
      if (applyFilter === 'ALL') return sortedList;
      
      return sortedList.filter(item => {
          const displayStatus = item.Status === 'Valid' ? 'Scanned' : (item.Status === 'Invalid' ? 'Empty' : 'Empty'); 
          
          if (applyFilter === 'Scanned') return displayStatus === 'Scanned';
          if (applyFilter === 'Empty') return displayStatus === 'Empty';
          
          return true;
      });
  }, [scannedRecords, excelData, filterType, isReportView, reportFiles]);

  // --- Counts ---
  const stats = useMemo(() => {
    // 1. Total Unique Locations in Excel Plan
    const planLocs = new Set(excelData
        .map(d => d.Location ? d.Location.toString().trim().toUpperCase() : '')
        .filter(l => l)
    );
    const total = planLocs.size;

    // 2. Locations that have at least one 'Valid' scan
    const scannedLocs = new Set(scannedRecords
        .filter(r => r.Status === 'Valid')
        .map(r => r.Location ? r.Location.toString().trim().toUpperCase() : '')
        .filter(l => planLocs.has(l)) // Only count if it is part of the plan
    );
    
    const valid = scannedLocs.size;
    const missing = Math.max(0, total - valid);

    return { total, valid, missing };
  }, [excelData, scannedRecords]);

  const renderItem = ({ item, index }: { item: GroupedRecord, index: number }) => {
    // Map internal status 'Valid' to 'Scanned' for display, 'Invalid' to 'Empty', 'Missing' to 'Empty'
    const displayStatus = item.Status === 'Valid' ? 'Scanned' : 'Missing';
    const { color, bg, border } = getStatusColor(displayStatus);

    return (
      <View style={{ 
          flexDirection: 'row', 
          paddingVertical: 6,
          paddingHorizontal: 4, 
          borderBottomWidth: 1, 
          borderBottomColor: '#F3F4F6',
          backgroundColor: 'white',
          alignItems: 'center'
      }}>
        <View style={{ width: 40, alignItems: 'center' }}><Text style={{ fontSize: 10, color: '#4B5563' }} numberOfLines={1}>{index + 1}</Text></View>
        <TouchableOpacity 
            style={{ width: 100 }} 
            onPress={() => item.Location && handleLockLocation(item.Location)}
        >
            <Text style={{ fontSize: 10, color: '#1F2937' }} numberOfLines={1}>{item.Location || '-'}</Text>
        </TouchableOpacity>
        <View style={{ width: 120 }}><Text style={{ fontSize: 10, color: '#4B5563' }} numberOfLines={1}>{item.SOs || '-'}</Text></View>
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
                <Text style={{ fontSize: 8, color: color, fontWeight: '700' }}>{displayStatus}</Text>
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
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ color: COLORS.muted, fontSize: 16, fontWeight: '500' }}>
                  Select Excel File to Begin
               </Text>
            </View>
        )}

        {/* --- Stats Header --- */}
        {isReportView && (
            <View style={styles.statsContainer}>
                 <Text style={styles.statsText}>
                    <Text style={{ color: '#0284C7', fontWeight: 'bold' }}>Total: {stats.total}</Text>
                    <Text style={{ color: COLORS.muted }}>{'  /  '}</Text>
                    <Text style={{ color: '#00E096', fontWeight: 'bold' }}>Scanned: {stats.valid}</Text>
                    <Text style={{ color: COLORS.muted }}>{'  /  '}</Text>
                    <Text style={{ color: '#FF3B30', fontWeight: 'bold' }}>Missing: {stats.missing}</Text>
                </Text>
            </View>
        )}

        {/* The rest is shown ONLY if data matches */}
        {excelData.length > 0 && !isReportView && (
          <>
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
                          placeholder="Scan SO"
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
                        {/* Main Screen Buttons: Clear and Verify Only (Report in Header) */}
                         <TouchableOpacity onPress={handleClearSession} style={styles.clearBtn}>
                            <Text style={styles.clearBtnText}>Clear</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterBtn}>
                            <Ionicons name="filter" size={16} color={COLORS.text} />
                            <Text style={styles.filterBtnText}>Filter: {filterType}</Text>
                        </TouchableOpacity>
            </View>
            )}

            {/* Table - ContentAccuracy Style */}
            {/* Table - ContentAccuracy Style */}
            <View style={{ flex: 1, marginTop: 0, backgroundColor: '#fff', borderRadius: 0, elevation: 0, marginHorizontal: -12, borderTopWidth: 1, borderTopColor: '#E5E7EB', overflow: 'hidden' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: '100%' }}>
                    <View style={{ minWidth: '100%' }}>
                        <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', alignItems: 'center' }}>
                            <View style={{ width: 40, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>S/No</Text></View>
                            <View style={{ width: 100 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Location</Text></View>
                            <View style={{ width: 120 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>SO</Text></View>
                            <View style={{ width: 70, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Status</Text></View>
                        </View>
                        
                        <FlatList
                            data={groupedList}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            ListEmptyComponent={<Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 20 }}>No records yet.</Text>}
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
            <Text style={styles.fullscreenTitle}>Scan {activeScanField === 'LOCATION' ? 'Location' : 'SO'}</Text>
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

      {/* Filter Options Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
         <TouchableOpacity 
            style={styles.alertOverlay} 
            activeOpacity={1} 
            onPress={() => setFilterModalVisible(false)}
         >
            <View style={[styles.alertBox, { width: 220, padding: 0, overflow: 'hidden' }]}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                     <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center' }}>Filter By Status</Text>
                </View>
                
                {['ALL', 'Scanned', 'Empty'].map((type) => (
                    <TouchableOpacity 
                        key={type}
                        style={{ 
                            paddingVertical: 14, 
                            width: '100%', 
                            alignItems: 'center',
                            borderBottomWidth: type !== 'Empty' ? 1 : 0,
                            borderBottomColor: '#F3F4F6',
                            backgroundColor: filterType === type ? '#F0FDFA' : 'white'
                        }}
                        onPress={() => {
                            setFilterType(type as any);
                            setFilterModalVisible(false);
                        }}
                    >
                        <Text style={{ 
                            fontSize: 16, 
                            fontWeight: filterType === type ? '700' : '400',
                            color: filterType === type ? COLORS.success : COLORS.text 
                        }}>
                            {type}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
         </TouchableOpacity>
      </Modal>


    </SafeAreaView>
  );
};

export default PutAwayScreen;

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
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: COLORS.text,
    fontSize: 14,
  },
  scanIconBtnInside: {
      padding: 6,
  },
  inputLocked: {
      opacity: 0.7,
      backgroundColor: '#F3F4F6'
  },
  actionBtn: {
      width: 38,
      height: 38,
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
       fontSize: 13,
  },
  filterBtn: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 8,
      paddingVertical: 6,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 4,
  },
  filterBtnText: {
      color: COLORS.text,
      fontWeight: '600',
      fontSize: 13,
  },
  reportBtn: {
      flex: 1,
       backgroundColor: COLORS.primary,
      borderRadius: 8,
      paddingVertical: 8,
      alignItems: 'center',
  },
  reportBtnText: {
      color: COLORS.primaryText,
      fontWeight: '700',
      fontSize: 13,
  },
  
  // Table
  tableHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      paddingBottom: 8,
      marginBottom: 8,
  },
  tableHeadText: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '600',
  },
  row: {
      flexDirection: 'row',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      alignItems: 'center',
  },
  cell: {
      color: COLORS.text,
      fontSize: 13,
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
});
