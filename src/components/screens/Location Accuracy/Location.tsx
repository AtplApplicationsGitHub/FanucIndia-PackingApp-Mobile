import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  FlatList,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import LocationStorage from '../../Storage/Location_Storage';

// --- Types ---
type ExcelRow = {
  SO: string;
  YD?: string;
  Location: string; // System location
};

type ScannedRecord = {
  id: string; // Unique ID for list
  SO?: string;
  YD?: string;
  Location: string; // System location (if matched) or Derived
  ScanLocation: string;
  Status: 'Valid' | 'Invalid' | 'Missing';
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
        Alert.alert('Error', 'Excel file is empty.');
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
        Alert.alert('Error', 'Invalid Excel format. Required columns: SO, Location, YD');
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
        locationInputRef.current?.focus();
      }, 500);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to parse Excel file.');
    }
  };

  const handleLockLocation = () => {
    if (!scanLocation.trim()) {
      Alert.alert('Validation', 'Please scan a location first.');
      return;
    }
    setIsLocationLocked(true);
    // Auto focus next field
    setTimeout(() => soYdInputRef.current?.focus(), 100);
  };

  const handleClearSession = () => {
    Alert.alert('Confirm Reset', 'Are you sure you want to clear the current session?', [
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

  const handleSaveEntry = () => {
    if (!scanSoYd.trim()) {
      Alert.alert('Validation', 'Please scan SO or YD.');
      return;
    }

    const val = scanSoYd.trim();
    const currentLoc = scanLocation.trim();
    
    // Check if match exists in Excel
    const match = excelData.find(d => d.SO === val || (d.YD && d.YD === val));

    if (match) {
        // Found in Excel. Now check Location Match.
        const isLocationMatch = match.Location === currentLoc;

        if (isLocationMatch) {
             // Valid Logic
             const isDuplicate = scannedRecords.some(r => r.SO === match.SO && r.Status === 'Valid');

             if (isDuplicate) {
                 Alert.alert('Duplicate', 'This item is already added.');
                 setScanSoYd('');
                 soYdInputRef.current?.focus();
                 return;
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
 
             setScannedRecords(prev => [newRecord, ...prev]);
        } else {
             // Found SO but Wrong Location -> Invalid
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
        }
    } else {
        // Not in Excel
        Alert.alert('Not Found', 'SO not found in Excel data.');
    }
    
    setScanSoYd('');
    soYdInputRef.current?.focus();
  };

  const handleVerifyReport = () => {
    const existingIds = new Set(scannedRecords.map(r => r.SO));
    const globalMissing: ScannedRecord[] = [];
    
    excelData.forEach(row => {
        if (!existingIds.has(row.SO)) {
            globalMissing.push({
                id: `global-missing-${row.SO}`,
                SO: row.SO,
                YD: row.YD,
                Location: row.Location,
                ScanLocation: '',
                Status: 'Missing',
                Timestamp: 0
            });
        }
    });

    setReportFiles([...scannedRecords, ...globalMissing]);
    setIsVerified(true);
    Alert.alert('Verification', `Found ${globalMissing.length} missing items.`);
  };

  const handleGenerateReport = () => {
    // Show scanned values only initially
    setReportFiles([...scannedRecords]);
    setIsVerified(false);
    setIsReportView(true);
  };

  const handleExport = async () => {
      if (reportFiles.length === 0) {
          Alert.alert('Export', 'No data to export.');
          return;
      }
      
      const sheetData = reportFiles.map(r => ({
          SO: r.SO,
          YD: r.YD,
          'System Location': r.Location,
          'Scanned Location': r.ScanLocation,
          Status: r.Status
      }));
      
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const uri = FileSystem.cacheDirectory + 'LocationReport.xlsx';
      
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' });
      
      if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
      } else {
          Alert.alert('Error', 'Sharing is not available on this device.');
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
      case 'Valid': return { color: '#00E096', bg: 'rgba(0, 224, 150, 0.15)' }; // Green
      case 'Missing': return { color: '#FFAA00', bg: 'rgba(255, 170, 0, 0.15)' }; // Orange
      case 'Invalid': return { color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.15)' }; // Red
      default: return { color: COLORS.text, bg: 'transparent' };
    }
  };

  const renderItem = ({ item }: { item: ScannedRecord }) => {
    const { color, bg } = getStatusColor(item.Status);

    return (
      <View style={styles.row}>
        <Text style={[styles.cell, { flex: 1 }]}>{item.SO || '-'}</Text>
        <Text style={[styles.cell, { flex: 1 }]}>{item.YD || '-'}</Text>
        <Text style={[styles.cell, { flex: 1 }]}>{item.Location || '-'}</Text>
        <Text style={[styles.cell, { flex: 1 }]}>{item.ScanLocation || '-'}</Text>
        <View style={{ flex: 1.2, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ 
                backgroundColor: bg, 
                paddingHorizontal: 12, 
                paddingVertical: 4, 
                borderRadius: 4,
                width: 80,
                alignItems: 'center'
            }}>
                <Text style={{ color: color, fontWeight: '600', fontSize: 13 }}>{item.Status}</Text>
            </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Main Content */}
      <View style={styles.content}>
        
        {/* Upload Section - Always Visible if needed? Or only when empty? User said "first only choose file button" */}
        {/* We keep it visible so they can change file, OR we hide it? 
            "enter the page fisrt only choose filr button"
            "after choose the excel file opion loction input box..."
            I will keep the upload section visible at top but maybe minimize it or just keep it. 
        */}
        {!isReportView && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <TouchableOpacity onPress={handleUploadExcel} style={styles.uploadBtn}>
                  <Text style={styles.uploadBtnText}>{excelData.length > 0 ? 'Change File' : 'Choose File'}</Text>
                </TouchableOpacity>
                <Text style={{ color: COLORS.muted, marginLeft: 12, flex: 1 }} numberOfLines={1}>
                  {fileName || 'No file chosen'}
                </Text>
              </View>
            </View>
        )}

        {/* The rest is shown ONLY if data matches */}
        {excelData.length > 0 && !isReportView && (
          <>
            {/* Stats Removed as per request */}
            
            {/* Scan Inputs */}
            <View style={styles.card}>
              <View style={styles.inputRow}>
                <TextInput
                  ref={locationInputRef}
                  style={[styles.input, isLocationLocked && styles.inputLocked]}
                  placeholder="Enter location"
                  placeholderTextColor={COLORS.muted}
                  value={scanLocation}
                  onChangeText={setScanLocation}
                  editable={!isLocationLocked}
                  onSubmitEditing={handleLockLocation}
                />
                {!isLocationLocked ? (
                    <TouchableOpacity onPress={handleLockLocation} style={styles.actionBtn}>
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
                        <TextInput
                        ref={soYdInputRef}
                        style={styles.input}
                        placeholder="Scan SO or YD"
                        placeholderTextColor={COLORS.muted}
                        value={scanSoYd}
                        onChangeText={setScanSoYd}
                        onSubmitEditing={handleSaveEntry}
                        autoFocus
                        />
                         <TouchableOpacity onPress={handleSaveEntry} style={[styles.actionBtn, { backgroundColor: COLORS.success }]}>
                             <Text style={{ fontWeight: '700', color: 'white' }}>Save</Text>
                        </TouchableOpacity>
                    </View>
                  </>
              )}
            </View>
          </>
        )}

        {/* Action Buttons & Table - Visible Only if Data Loaded or Report View */}
        {(excelData.length > 0 || isReportView) && (
        <View style={{ flex: 1, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                {!isReportView ? (
                    <>
                        {/* Main Screen Buttons: Verify removed, Table removed below */}
                         <TouchableOpacity onPress={handleClearSession} style={styles.clearBtn}>
                            <Text style={styles.clearBtnText}>Clear Session</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleGenerateReport} style={styles.reportBtn}>
                            <Text style={styles.reportBtnText}>Report</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity onPress={() => setIsReportView(false)} style={styles.verifyBtn}>
                            <Text style={styles.verifyBtnText}>Back to Scan</Text>
                        </TouchableOpacity>

                        {!isVerified ? (
                            <TouchableOpacity onPress={handleVerifyReport} style={[styles.reportBtn, { backgroundColor: COLORS.warning }]}>
                                <Text style={[styles.reportBtnText, { color: '#000' }]}>Verify</Text>
                            </TouchableOpacity>
                        ) : (
                             <TouchableOpacity onPress={handleExport} style={styles.reportBtn}>
                                <Text style={styles.reportBtnText}>Export Excel</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            {/* Table - Visible ONLY in Report View */}
            {isReportView && (
              <>
                <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeadText, { flex: 1 }]}>SO</Text>
                    <Text style={[styles.tableHeadText, { flex: 1 }]}>YD</Text>
                    <Text style={[styles.tableHeadText, { flex: 1 }]}>Loc</Text>
                    <Text style={[styles.tableHeadText, { flex: 1 }]}>Scan</Text>
                    <Text style={[styles.tableHeadText, { flex: 1.2, textAlign: 'center' }]}>Status</Text>
                </View>
                
                <FlatList
                    data={activeList}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={<Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 20 }}>No records yet.</Text>}
                />
              </>
            )}
        </View>
        )}

      </View>
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
    padding: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  uploadBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  uploadBtnText: {
    color: '#111827',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 16,
  },
  inputLocked: {
      opacity: 0.7,
      backgroundColor: '#F3F4F6'
  },
  actionBtn: {
      width: 44,
      height: 44,
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
      paddingVertical: 12,
      alignItems: 'center',
  },
  verifyBtnText: {
      color: COLORS.primary,
      fontWeight: '600',
  },
  clearBtn: {
       flex: 1,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
  },
  clearBtnText: {
       color: COLORS.text,
       fontWeight: '600',
  },
  reportBtn: {
      flex: 0.8,
       backgroundColor: COLORS.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
  },
  reportBtnText: {
      color: COLORS.primaryText,
      fontWeight: '700',
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
  }
});
