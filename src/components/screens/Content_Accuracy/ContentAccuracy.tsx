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
import ContentAccuracyStorage from '../../Storage/ContentAccuracy_Storage';
import { useKeyboardDisabled } from '../../utils/keyboard';

// --- Types ---
type ExcelRow = {
  SO: string;
  YD?: string;
  Location: string; // System location
  Cert?: string;
  Avail?: string;
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

const PutAwayScreen = () => {
  const navigation = useNavigation();

  // --- State ---
  const [excelData, setExcelData] = useState<ExcelRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const [scanLocation, setScanLocation] = useState('');
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  
  const [scanSO, setScanSO] = useState('');
  const [isSOLocked, setIsSOLocked] = useState(false);

  const [scanMaterial, setScanMaterial] = useState('');
  
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
  const [activeScanField, setActiveScanField] = useState<'LOCATION' | 'SO' | 'MATERIAL' | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastScanStatus, setLastScanStatus] = useState<boolean | null>(null);

  // Multi-scan tracking
  const [sessionCount, setSessionCount] = useState(0);
  const sessionCodesRef = useRef<Set<string>>(new Set());

  // --- Filtered Data for Table ---
  const filteredData = useMemo(() => {
    if (!excelData.length) return [];
    
    // We only show rows that have been scanned at least once (or partially scanned)
    // Filter based on what has been scanned *at the current view location* (if locked)
    // or globally if not locked? Assuming user wants to see what they scanned.
    
    let activeScans = scannedRecords;

    if (scanLocation.trim() && isLocationLocked) {
        const currentLoc = scanLocation.trim().toUpperCase();
        activeScans = activeScans.filter(r => r.ScanLocation === currentLoc);
    }
    
    // Determine unique (SO, YD, Location) keys from these scans to pull from ExcelData
    // We strictly pull rows from ExcelData that match the items scanned.
    
    // Note: A scan record points to a system location (r.Location).
    // We want to show that system row.
    
    const relevantKeys = new Set(activeScans.map(r => `${r.SO}-${r.Location}-${r.YD}`));
    
    const data = excelData.filter(d => {
        const key = `${d.SO}-${d.Location}-${d.YD}`;
        return relevantKeys.has(key);
    });
    
    // If we have an SO lock on top of Location lock, further filter?
    // scanSO is used for input, but if we already scanned items, we might want to see them all.
    // Keep consistent with previous logic
    
    if (isSOLocked && scanSO.trim()) {
        const so = scanSO.trim().toUpperCase();
        return data.filter(d => d.SO.toUpperCase() === so || (d.Cert && d.Cert.toUpperCase() === so));
    }
    
    return data;
  }, [excelData, isLocationLocked, scanLocation, isSOLocked, scanSO, scannedRecords]);

  // --- Persistence ---
  
  // Load Session on Mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await ContentAccuracyStorage.getSession();
        if (data) {
          setExcelData(data.excelData || []);
          setFileName(data.fileName || null);
          setScannedRecords(data.scannedRecords || []);
          setReportFiles(data.reportFiles || []);
          
          setScanLocation(data.scanLocation || '');
          setIsLocationLocked(data.isLocationLocked || false);
          
          setScanSO(data.scanSO || '');
          setIsSOLocked(data.isSOLocked || false);
          
          setScanMaterial(data.scanMaterial || '');
          
          setIsVerified(data.isVerified || false);
          setIsReportView(data.isReportView || false);
        }
      } catch (e) {
        console.error("Error loading session", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSession();
  }, []);

  // Save Session on Change
  useEffect(() => {
    if (!isLoaded) return;

    const saveData = async () => {
      await ContentAccuracyStorage.saveSession({
        excelData,
        fileName,
        scannedRecords,
        reportFiles,
        scanLocation,
        isLocationLocked,
        scanSO,
        isSOLocked,
        scanMaterial,
        isVerified,
        isReportView
      });
    };
    
    // Debounce slightly to avoid excessive writes
    const timeout = setTimeout(saveData, 500);
    return () => clearTimeout(timeout);
    
  }, [
    excelData, 
    fileName, 
    scannedRecords, 
    reportFiles, 
    scanLocation, 
    isLocationLocked, 
    scanSO,
    isSOLocked,
    scanMaterial, 
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
      soInputRef.current?.blur();
      materialInputRef.current?.blur();
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
        title: isReportView ? 'Content Report' : 'Content Accuracy',
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
  }, [navigation, isReportView]);

  // --- Refs ---
  const locationInputRef = useRef<TextInput>(null);
  const soInputRef = useRef<TextInput>(null);
  const materialInputRef = useRef<TextInput>(null);

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
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      if (jsonData.length === 0) {
        showAlert('Excel file is empty.');
        return;
      }

      // Validate Headers & Identify Columns
      const firstRow = jsonData[0];
      const keys = Object.keys(firstRow);

      // Flexible Column Matching - Prioritize exact matches from user image
      const getColumnName = (candidates: string[]) => 
        keys.find(key => candidates.some(c => key.toLowerCase().trim().startsWith(c.toLowerCase())));

      const locKey = getColumnName(['Storage Bi', 'Storage Bin', 'Location']);
      const soKey = getColumnName(['Original S', 'SO', 'Serial', 'Order']);
      const ydKey = getColumnName(['Material', 'YD', 'Item']);

      const certKey = getColumnName(['Cert. No.', 'Cert', 'Certificate']);
      const availKey = getColumnName(['Avail', 'Qty', 'Quantity']);

      if (!locKey || !soKey) {
        showAlert('Invalid Excel format. Required columns: "Storage Bi" (Location) and "Original S" (SO).');
        return;
      }

      setFileName(file.name);

      // Basic Validation/Normalization
      const normalizedData = jsonData.map(row => ({
        SO: soKey && row[soKey] ? String(row[soKey]).trim() : '',
        YD: ydKey && row[ydKey] ? String(row[ydKey]).trim() : undefined,
        Location: row[locKey] ? String(row[locKey]).trim() : '',
        Cert: certKey && row[certKey] ? String(row[certKey]).trim() : '',
        Avail: availKey && row[availKey] ? String(row[availKey]).trim() : '',
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
      setScanLocation('');
      showAlert('Please scan a location first.', [
        {
          text: 'OK',
          onPress: () => {
             setTimeout(() => locationInputRef.current?.focus(), 100);
          }
        }
      ]);
      return;
    }

    // Allow any location to be scanned (Mismatch Logic)
    if (overrideValue !== undefined) {
        setScanLocation(overrideValue);
    }

    setIsLocationLocked(true);
    // Auto focus next field
    setTimeout(() => {
        if (navigation.isFocused()) {
            soInputRef.current?.focus();
        }
    }, 500);
  };

  const handleUnlockLocation = () => {
        setIsLocationLocked(false);
        setIsSOLocked(false);
        setScanSO('');
        setScanMaterial('');
        setTimeout(() => locationInputRef.current?.focus(), 100);
  };

  const handleLockSO = (overrideValue?: string) => {
    const valueToCheck = overrideValue !== undefined ? overrideValue : scanSO;
    
    if (!valueToCheck.trim()) {
      setScanSO('');
      showAlert('Please scan SO first.', [
        {
          text: 'OK',
          onPress: () => {
             setTimeout(() => soInputRef.current?.focus(), 100);
          }
        }
      ]);
      return;
    }

    // Check if SO exists anywhere in the plan
    const planRows = excelData.filter(d => d.SO && d.SO.trim().length > 0);
    const hasPlan = planRows.length > 0;
    
    if (hasPlan) {
        // Global search for SO or Cert
        const match = planRows.find(d => 
             d.SO.toUpperCase() === valueToCheck.trim().toUpperCase() ||
             (d.Cert && d.Cert.toUpperCase() === valueToCheck.trim().toUpperCase())
        );
        
        if (!match) {
             setScanSO('');
             showAlert(`SO or Cert '${valueToCheck}' not found in the plan.`, [
                {
                    text: 'OK',
                    onPress: () => setTimeout(() => soInputRef.current?.focus(), 100)
                }
             ]);
             return;
        }
    }

    if (overrideValue !== undefined) {
        setScanSO(overrideValue);
    }

    setIsSOLocked(true);
    // Auto focus next field (Material)
    setTimeout(() => {
        if (navigation.isFocused()) {
            materialInputRef.current?.focus();
        }
    }, 500);
  };

  const handleUnlockSO = () => {
        setIsSOLocked(false);
        setScanMaterial('');
        setTimeout(() => soInputRef.current?.focus(), 100);
  };

  const handleClearSession = () => {
    showAlert('Are you sure you want to clear the current session?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Clear', 
        style: 'destructive', 
        onPress: async () => {
          await ContentAccuracyStorage.clearSession();
          setScanLocation('');
          setScanSO('');
          setScanMaterial('');
          setIsLocationLocked(false);
          setIsSOLocked(false);
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

  const handleSaveEntry = (valueOverride?: string, fromScanner: boolean = false): boolean => {
    const rawValue = typeof valueOverride === 'string' ? valueOverride : scanMaterial;
    
    if (!rawValue.trim()) {
      if (!fromScanner) {
        setScanMaterial('');
        showAlert('Please scan Material.', [
          {
            text: 'OK',
            onPress: () => {
              setTimeout(() => materialInputRef.current?.focus(), 100);
            },
          },
        ]);
      }
      return false;
    }

    const matVal = rawValue.trim().toUpperCase();
    const currentLoc = scanLocation.trim().toUpperCase();
    const currentSO = scanSO.trim().toUpperCase();
    
    // Check mode
    const planRows = excelData.filter(d => d.SO && d.SO.trim().length > 0);
    const hasPlan = planRows.length > 0;

    if (hasPlan) {
        // Search for matches
        // Prioritize: Match on SO or Cert + Material + Current Location
        let specificMatch = planRows.find(d => 
            (d.SO.toUpperCase() === currentSO || (d.Cert && d.Cert.toUpperCase() === currentSO)) &&
            d.Location.toUpperCase() === currentLoc &&
            (d.YD && d.YD.toString().trim().toUpperCase() === matVal)
        );

        // Fallback: Match on SO or Cert + Material (Mismatch Location)
        if (!specificMatch) {
            specificMatch = planRows.find(d => 
                (d.SO.toUpperCase() === currentSO || (d.Cert && d.Cert.toUpperCase() === currentSO)) &&
                (d.YD && d.YD.toString().trim().toUpperCase() === matVal)
            );
        }

        if (specificMatch) {
            // Check for Mismatch Correction ("Rewrite")
            // If the current scan is a Vaild Match, check if we previously scanned this as a Mismatch.
            // If so, update the previous record instead of adding a new one.
            const isMatch = specificMatch.Location.toUpperCase() === currentLoc;
            
            if (isMatch) {
                 const mismatchIndex = scannedRecords.findIndex(r => 
                    r.SO === specificMatch?.SO && 
                    r.YD === matVal && 
                    r.ScanLocation !== r.Location // It was a mismatch
                 );

                 if (mismatchIndex !== -1) {
                     // Rewrite logic
                     const updatedRecords = [...scannedRecords];
                     updatedRecords[mismatchIndex] = {
                         ...updatedRecords[mismatchIndex],
                         ScanLocation: currentLoc, 
                         Location: specificMatch.Location,
                         Timestamp: Date.now(),
                     };
                     setScannedRecords(updatedRecords);
                     setScanMaterial('');
                     setTimeout(() => { if (navigation.isFocused()) materialInputRef.current?.focus(); }, 100);
                     return true;
                 }
            }

            // Normal Add
            const newRecord: ScannedRecord = {
                id: Date.now().toString() + Math.random().toString(),
                SO: specificMatch.SO, 
                YD: matVal,
                Location: specificMatch.Location, // System Location
                ScanLocation: currentLoc, // Where we actually scanned it
                Timestamp: Date.now(),
            };

            setScannedRecords(prev => [newRecord, ...prev]);
            setScanMaterial('');
            setTimeout(() => { if (navigation.isFocused()) materialInputRef.current?.focus(); }, 100);
            return true;

        } else {
            if (!fromScanner) showAlert(`Material mismatch. '${matVal}' is not valid for SO/Cert '${currentSO}'.`);
            setScanMaterial('');
            setTimeout(() => materialInputRef.current?.focus(), 100);
            return false;
        }
    } else {
        // Free Mode
        const newRecord: ScannedRecord = {
             id: Date.now().toString(),
             SO: currentSO,
             YD: matVal,
             Location: currentLoc,
             ScanLocation: currentLoc,
             Timestamp: Date.now(),
        };

        setScannedRecords(prev => [newRecord, ...prev]);
        setScanMaterial('');
        setTimeout(() => { if (navigation.isFocused()) materialInputRef.current?.focus(); }, 100);
        return true;
    }
  };



  const handleGenerateReport = () => {

    const missingRecords: ScannedRecord[] = []; // Calculate if needed, but for now just showing report

    setReportFiles([...scannedRecords]);
    setIsVerified(true);
    setIsReportView(true);
  };

  const handleExport = async () => {
      // Check if we have any data to work with
      if (excelData.length === 0 && scannedRecords.length === 0) {
          showAlert('No data to export.');
          return;
      }

      let sheetData: any[] = [];

      // Helper to generate key for matching
      const getKey = (so: string, loc: string, yd: string) => 
        `${so?.trim().toUpperCase()}|${loc?.trim().toUpperCase()}|${yd?.trim().toUpperCase()}`;

      if (excelData.length > 0) {
          // --- Plan Mode: Export All System Rows (including Missing) ---
          
          // Group scans by System Key (SO + System Location + Material)
          const scanMap = new Map<string, ScannedRecord[]>();
          scannedRecords.forEach(r => {
             const key = getKey(r.SO || '', r.Location || '', r.YD || '');
             if (!scanMap.has(key)) scanMap.set(key, []);
             scanMap.get(key)!.push(r);
          });

          sheetData = excelData.map(row => {
              const so = row.SO || '';
              const loc = row.Location || ''; 
              const mat = row.YD || '';
              const cert = row.Cert || ''; // Cert. No matching
              const avail = row.Avail ? String(row.Avail) : '0';
              const sysQty = parseFloat(avail) || 0;

              const key = getKey(so, loc, mat);
              const scans = scanMap.get(key) || [];
              const scannedQty = scans.length;
              
              let status = 'Missing';
              if (scannedQty === 0) {
                  status = 'Missing';
              } else if (scannedQty === sysQty) {
                  status = 'Valid';
              } else if (scannedQty > sysQty) {
                  status = 'Invalid';
              } else {
                  status = 'Processing';
              }

              // Check for Location Mismatch
              // If we have scans, check if the *actual* scan location differs from system loc
              const mismatch = scans.some(r => r.ScanLocation.toUpperCase() !== loc.trim().toUpperCase());
              if (scannedQty > 0 && mismatch) {
                  status = 'Mismatch';
              }

              // Scanned Location(s) - Join distinct locations
              const uniqueScanLocs = Array.from(new Set(scans.map(s => s.ScanLocation))).filter(Boolean).join(', ');
              
              // Date Time (Last scan timestamp)
              const lastScan = scans.length > 0 ? scans[scans.length-1] : null;
              const dateStr = lastScan ? new Date(lastScan.Timestamp).toLocaleString() : '';

              return {
                  'SO': so,
                  'Cert. No': cert,
                  'System Location': loc,
                  'Scanned Location': uniqueScanLocs,
                  'Material': mat,
                  'Actual Qty': avail,
                  'Scanned Qty': scannedQty,
                  'Status': status,
                  'DateTime': dateStr
              };
          });

      } else {
          // --- Free Mode: Just Export Scans ---
          sheetData = scannedRecords.map(r => ({
              'SO': r.SO,
              'Cert. No': '',
              'System Location': r.Location, // In free mode, matches scan
              'Scanned Location': r.ScanLocation,
              'Material': r.YD,
              'Actual Qty': '',
              'Scanned Qty': 1,
              'Status': 'Ad-hoc',
              'DateTime': new Date(r.Timestamp).toLocaleString()
          }));
      }

      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = 'ContentAccuracyReport.xlsx';
      
      try {
        if (Platform.OS === 'android') {
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
             console.log("SAF Error", e);
             showAlert('Saving cancelled. Opening share options...');
          }
        }
        
        const uri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
        
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri);
        } else {
            showAlert('Sharing is not available on this device.');
        }
      } catch (err) {
        console.error(err);
        showAlert('Failed to export file.');
      }
  };

  // --- Scanner Logic ---


  const openScanner = async (field: 'LOCATION' | 'SO' | 'MATERIAL') => {
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
        Vibration.vibrate();
        setLastScannedCode(value);
        setScanModal(false);
        setActiveScanField(null);
        handleLockLocation(value);
    } else if (activeScanField === 'SO') {
        Vibration.vibrate();
        setLastScannedCode(value);
        setScanModal(false);
        setActiveScanField(null);
        handleLockSO(value);
    } else if (activeScanField === 'MATERIAL') {
        if (sessionCodesRef.current.has(value)) {
            return;
        }
        sessionCodesRef.current.add(value);
        setLastScannedCode(value);
        
        const success = handleSaveEntry(value, true);
        setLastScanStatus(success);
        
        if (success) {
             Vibration.vibrate();
             setSessionCount(prev => prev + 1);
        } else {
             Vibration.vibrate([0, 200]); 
        }
    }
  };


  // --- Stats Calculation ---
  const stats = useMemo(() => {
     if (excelData.length === 0) return { total: 0, missing: 0, valid: 0, invalid: 0, mismatch: 0 };
     
     const total = excelData.length;
     let valid = 0;
     let missing = 0;
     let invalid = 0; 
     let mismatch = 0;
     
     excelData.forEach(item => {
         const avail = parseFloat(item.Avail || '0') || 0;
         
         // Get all scans for this Line Item
         const itemScans = scannedRecords.filter(r => 
             r.SO === item.SO && 
             r.Location === item.Location && 
             (!item.YD || r.YD === item.YD)
         );
         
         // 1. Check for Mismatch (Wrong Location) - Row Count
         const hasMismatch = itemScans.some(r => r.ScanLocation !== item.Location);
         if (hasMismatch) mismatch++;

         // 2. Count Valid Scans (Correct Location only)
         const correctScansCount = itemScans.filter(r => r.ScanLocation === item.Location).length;
         
         // Valid Row: Scanned >= Avail
         if (correctScansCount >= avail) {
             valid++;
         } else {
             missing++;
         }
         
         // Invalid Row: Scanned > Avail (Over/Excess)
         if (correctScansCount > avail) {
             invalid++;
         }
     });
     
     return { total, missing, valid, invalid, mismatch };
  }, [excelData, scannedRecords]);

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


        {/* The rest is shown ONLY if data matches */}
        {excelData.length > 0 && !isReportView && (
          <>


            {/* Scan Inputs */}
            <View style={styles.card}>
              
              {/* --- Location Input --- */}
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
                    <TouchableOpacity onPress={handleUnlockLocation} style={[styles.actionBtn, { backgroundColor: COLORS.muted }]}>
                        <Ionicons name="create-outline" size={20} color="white" />
                    </TouchableOpacity>
                )}
              </View>

              {/* --- SO Input (Visible if Location Locked) --- */}
              {isLocationLocked && (
              <View style={styles.inputRow}>
                <View style={[styles.inputWrapper, isSOLocked && styles.inputLocked]}>
                  <TextInput
                    ref={soInputRef}
                    style={styles.inputInner}
                    placeholder="Enter SO or Cert. No"
                    placeholderTextColor={COLORS.muted}
                    value={scanSO}
                    onChangeText={setScanSO}
                    editable={!isSOLocked}
                    onSubmitEditing={() => handleLockSO()}
                    autoCapitalize="characters"
                    showSoftInputOnFocus={!keyboardDisabled}
                    autoFocus={true}
                  />
                   {!isSOLocked && (
                      <TouchableOpacity onPress={() => openScanner('SO')} style={styles.scanIconBtnInside}>
                          <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.muted} />
                      </TouchableOpacity>
                   )}
                </View>

                {!isSOLocked ? (
                    <TouchableOpacity onPress={() => handleLockSO()} style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}>
                         <Ionicons name="cube-outline" size={20} color="white" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={handleUnlockSO} style={[styles.actionBtn, { backgroundColor: COLORS.muted }]}>
                        <Ionicons name="create-outline" size={20} color="white" />
                    </TouchableOpacity>
                )}
              </View>
              )}
              
              {/* --- Material Input (Visible if SO Locked) --- */}
              {isLocationLocked && isSOLocked && (
                  <>
                    <View style={styles.inputRow}>
                        <View style={styles.inputWrapper}>
                          <TextInput
                          ref={materialInputRef}
                          style={styles.inputInner}
                          placeholder="Material Code .."
                          placeholderTextColor={COLORS.muted}
                          value={scanMaterial}
                          onChangeText={setScanMaterial}
                          onSubmitEditing={() => handleSaveEntry()}
                          autoFocus
                          autoCapitalize="characters"
                          showSoftInputOnFocus={!keyboardDisabled}
                          blurOnSubmit={false}
                          />
                           <TouchableOpacity onPress={() => openScanner('MATERIAL')} style={styles.scanIconBtnInside}>
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

            {/* Table Section */}
            {excelData.length > 0 && !isReportView && (
                <View style={{ flex: 1, marginTop: 12, backgroundColor: '#fff', borderRadius: 8, elevation: 2, marginHorizontal: 4, overflow: 'hidden' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ minWidth: 400 }}>
                            <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', alignItems: 'center' }}>
                                <View style={{ width: 85 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>SO</Text></View>
                                <View style={{ width: 85 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Cert. No.</Text></View>
                                <View style={{ width: 40 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Loc</Text></View>
                                <View style={{ width: 40 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>ScnLoc</Text></View>
                                <View style={{ width: 85, paddingHorizontal: 2 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Mat Code</Text></View>
                                <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Qty</Text></View>
                                <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Scn</Text></View>
                                <View style={{ width: 55, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Status</Text></View>
                            </View>
                            <FlatList
                        data={filteredData}
                        keyExtractor={(item, index) => `row-${index}`}
                        renderItem={({ item }) => {
                            // Calculate Scanned Count
                            const relevantScans = scannedRecords.filter(r => 
                                r.SO === item.SO && 
                                r.Location === item.Location && 
                                (!item.YD || r.YD === item.YD) &&
                                (!isLocationLocked || r.ScanLocation === scanLocation)
                            );

                            const scannedQty = relevantScans.length;
                            const availQty = parseInt(item.Avail || '0') || 0;
                            
                            // Check Mismatch
                            const hasMismatch = relevantScans.some(r => r.ScanLocation !== item.Location);
                            const distinctLocations = [...new Set(relevantScans.map(s => s.ScanLocation))];
                            const mismatchScan = distinctLocations.find(l => l !== item.Location);
                            // Show mismatch if exists, otherwise show the valid scan location if available
                            const displayScnLoc = mismatchScan || distinctLocations[0] || '';
                            
                            // Determine Status
                            let status = 'MISSING';
                            let statusColor = '#EA580C'; // Orange
                            let badgeBg = '#FFEDD5';
                            let borderColor = '#F97316';
                            
                            if (hasMismatch) {
                                status = 'MISMATCH';
                                statusColor = '#CA8A04'; // Yellow-Dark
                                badgeBg = '#FEF9C3';
                                borderColor = '#EAB308';
                            } else if (scannedQty === 0) {
                                status = 'MISSING';
                                statusColor = '#EA580C';
                                badgeBg = '#FFEDD5';
                                borderColor = '#F97316';
                            } else if (scannedQty === availQty) {
                                status = 'VALID';
                                statusColor = '#16A34A'; // Green
                                badgeBg = '#DCFCE7';
                                borderColor = '#16A34A';
                            } else if (scannedQty < availQty) {
                                status = 'PROC'; // Processing
                                statusColor = '#2563EB'; // Blue
                                badgeBg = '#DBEAFE';
                                borderColor = '#3B82F6';
                            } else {
                                status = 'INVAL'; // Over
                                statusColor = '#DC2626'; // Red
                                badgeBg = '#FEE2E2';
                                borderColor = '#EF4444'; 
                            }

                            return (
                                <View style={{ 
                                    flexDirection: 'row', 
                                    paddingVertical: 10,
                                    paddingHorizontal: 2, 
                                    borderBottomWidth: 1, 
                                    borderBottomColor: '#F3F4F6',
                                    backgroundColor: 'white',
                                    alignItems: 'center'
                                }}>
                                    <View style={{ width: 85 }}><Text style={{ fontSize: 10, color: '#1F2937' }} numberOfLines={1}>{item.SO}</Text></View>
                                    <View style={{ width: 85 }}><Text style={{ fontSize: 10, color: '#4B5563' }}>{item.Cert || '-'}</Text></View>
                                    <View style={{ width: 40 }}><Text style={{ fontSize: 10, color: '#4B5563' }} numberOfLines={1}>{item.Location}</Text></View>
                                    <View style={{ width: 40 }}>
                                        <Text style={{ fontSize: 10, color: hasMismatch ? '#EF4444' : '#4B5563', fontWeight: '700' }} numberOfLines={1}>
                                            {displayScnLoc}
                                        </Text>
                                    </View>
                                    <View style={{ width: 85, paddingHorizontal: 2 }}><Text style={{ fontSize: 10, color: '#1F2937' }} numberOfLines={2}>{item.YD || '-'}</Text></View>
                                    <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontSize: 10, color: '#4B5563' }}>{item.Avail || '-'}</Text></View>
                                    <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontSize: 10, color: status === 'INVAL' ? '#EF4444' : '#10B981', fontWeight: 'bold' }}>{scannedQty}</Text></View>
                                    <View style={{ width: 55, alignItems: 'center' }}>
                                        <View style={{ 
                                            backgroundColor: badgeBg, 
                                            paddingHorizontal: 2, 
                                            paddingVertical: 2, 
                                            borderRadius: 4,
                                            borderWidth: 1,
                                            borderColor: borderColor,
                                            width: '100%',
                                            alignItems: 'center'
                                        }}>
                                            <Text style={{ fontSize: 8, color: statusColor, fontWeight: '700' }}>
                                                {status}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        }}
                        ListEmptyComponent={
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: COLORS.muted }}>No records scanned yet.</Text>
                            </View>
                        }
                    />
                        </View>
                    </ScrollView>
                </View>
            )}
            {/* Report View Section (Show ALL Excel Data + Status) */}
            {isReportView && (
              <>
                 <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ 
                        backgroundColor: '#F3F4F6', 
                        borderRadius: 8, 
                        marginBottom: 2,
                        flexGrow: 0,
                    }}
                    contentContainerStyle={{
                        flexDirection: 'row', 
                        alignItems: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 8, 
                        columnGap: 5,
                    }}
                >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Total: {stats.total}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '400', color: '#9CA3AF' }}>/</Text>
                    
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A' }}>Valid: {stats.valid}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '400', color: '#9CA3AF' }}>/</Text>

                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>Invalid: {stats.invalid}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '400', color: '#9CA3AF' }}>/</Text>

                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C' }}>Missing: {stats.missing}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '400', color: '#9CA3AF' }}>/</Text>

                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#CA8A04' }}>Mismatch: {stats.mismatch}</Text>
                </ScrollView>

                <View style={{ flex: 1, marginTop: 2, backgroundColor: '#fff', borderRadius: 8, elevation: 2, marginHorizontal: 4, overflow: 'hidden' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ minWidth: 400 }}>
                            <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', alignItems: 'center' }}>
                                <View style={{ width: 85 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>SO</Text></View>
                                <View style={{ width: 85 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Cert. No.</Text></View>
                                <View style={{ width: 40 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Loc</Text></View>
                                <View style={{ width: 40 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>ScnLoc</Text></View>
                                <View style={{ width: 85, paddingHorizontal: 2 }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Mat Code</Text></View>
                                <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Qty</Text></View>
                                <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Scn</Text></View>
                                <View style={{ width: 55, alignItems: 'center' }}><Text style={{ fontWeight: '700', fontSize: 10, color: '#374151' }}>Status</Text></View>
                            </View>
                            <FlatList
                        data={excelData}
                        keyExtractor={(item, index) => `rep-${index}`}
                        renderItem={({ item }) => {
                             // Matching Logic
                             const relevantScans = scannedRecords.filter(r => 
                                r.SO === item.SO && 
                                r.Location === item.Location && 
                                (!item.YD || r.YD === item.YD)
                             );
                             
                             const scannedQty = relevantScans.length;
                             const availQty = parseInt(item.Avail || '0') || 0;
                             
                             // Mismatch Check
                             const distinctLocations = [...new Set(relevantScans.map(s => s.ScanLocation))];
                             const mismatchScan = distinctLocations.find(l => l !== item.Location);
                             const hasMismatch = !!mismatchScan;
                             const displayScnLoc = mismatchScan || distinctLocations[0] || '-';

                             // Status Calculation
                             let status = 'MISSING';
                             let statusColor = '#EA580C'; // Orange
                             let badgeBg = '#FFEDD5';
                             let borderColor = '#F97316';
                             
                             if (hasMismatch && item.Location) {
                                // Mismatch in report view
                                status = 'MISMATCH';
                                statusColor = '#CA8A04'; // Yellow
                                badgeBg = '#FEF9C3';
                                borderColor = '#EAB308';
                                 borderColor = '#EAB308';
                             } else if (scannedQty === 0) {
                                  status = 'MISSING';
                                  statusColor = '#EA580C';
                                  badgeBg = '#FFEDD5';
                                  borderColor = '#F97316';
                             } else if (scannedQty === availQty) {
                                 status = 'VALID';
                                 statusColor = '#16A34A';
                                 badgeBg = '#DCFCE7';
                                 borderColor = '#16A34A';
                             } else if (scannedQty < availQty) {
                                 status = 'PROC'; 
                                 statusColor = '#2563EB';
                                 badgeBg = '#DBEAFE';
                                 borderColor = '#3B82F6';
                             } else {
                                 status = 'INVAL'; 
                                 statusColor = '#DC2626';
                                 badgeBg = '#FEE2E2';
                                 borderColor = '#EF4444'; 
                             }
                            return (
                                <View style={{ 
                                    flexDirection: 'row', 
                                    paddingVertical: 10,
                                    paddingHorizontal: 2, 
                                    borderBottomWidth: 1, 
                                    borderBottomColor: '#F3F4F6',
                                    backgroundColor: 'white',
                                    alignItems: 'center'
                                }}>
                                    <View style={{ width: 85 }}><Text style={{ fontSize: 10, color: '#1F2937' }} numberOfLines={1}>{item.SO}</Text></View>
                                    <View style={{ width: 85 }}><Text style={{ fontSize: 10, color: '#4B5563' }}>{item.Cert || '-'}</Text></View>
                                    <View style={{ width: 40 }}><Text style={{ fontSize: 10, color: '#4B5563' }} numberOfLines={1}>{item.Location}</Text></View>
                                    <View style={{ width: 40 }}>
                                         <Text style={{ fontSize: 10, color: hasMismatch ? '#EF4444' : '#4B5563', fontWeight: '700' }} numberOfLines={1}>
                                            {displayScnLoc}
                                        </Text>
                                    </View>
                                    <View style={{ width: 85, paddingHorizontal: 2 }}><Text style={{ fontSize: 10, color: '#1F2937' }} numberOfLines={2}>{item.YD || '-'}</Text></View>
                                    <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontSize: 10, color: '#4B5563' }}>{item.Avail || '-'}</Text></View>
                                    <View style={{ width: 30, alignItems: 'center' }}><Text style={{ fontSize: 10, color: status === 'MISS' ? '#EF4444' : '#10B981', fontWeight: 'bold' }}>{scannedQty}</Text></View>
                                    <View style={{ width: 55, alignItems: 'center' }}>
                                        <View style={{ 
                                            backgroundColor: badgeBg, 
                                            paddingHorizontal: 2, 
                                            paddingVertical: 2, 
                                            borderRadius: 4,
                                            borderWidth: 1,
                                            borderColor: borderColor,
                                            width: '100%',
                                            alignItems: 'center'
                                        }}>
                                            <Text style={{ fontSize: 8, color: statusColor, fontWeight: '700' }}>
                                                {status}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        }}
                    />
                        </View>
                    </ScrollView>
                </View>
              </>
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
                 lastScanStatus === true ? { borderColor: COLORS.success } : 
                 lastScanStatus === false ? { borderColor: COLORS.error } : null
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

                {excelData.length > 0 && (
                     <TouchableOpacity onPress={() => { setMenuVisible(false); handleClearSession(); }} style={styles.menuItem}>
                         <MaterialCommunityIcons name="refresh" size={20} color="#EF4444" />
                         <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Clear Session</Text>
                     </TouchableOpacity>
                )}

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
  // Table
  // Table styles removed (inline styles used)
  
  inputRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingRight: 4,
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: COLORS.text,
    fontSize: 13,
  },
  scanIconBtnInside: {
      padding: 4,
  },
  inputLocked: {
      opacity: 0.7,
      backgroundColor: '#F3F4F6'
  },
  actionBtn: {
      width: 36,
      height: 36,
      backgroundColor: COLORS.primary,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
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
