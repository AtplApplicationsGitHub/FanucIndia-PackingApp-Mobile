import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  primary: '#FACC15', // Fanuc Yellow
  primaryText: '#0B0F19',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

interface RequiredField {
  key: string;
  label: string;
}

interface ColumnMappingModalProps {
  visible: boolean;
  onClose: () => void;
  headers: string[];
  requiredFields: RequiredField[];
  onConfirm: (mapping: Record<string, string>) => void;
  fileName: string | null;
}

const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  visible,
  onClose,
  headers,
  requiredFields,
  onConfirm,
  fileName,
}) => {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [activeSelectField, setActiveSelectField] = useState<string | null>(null);

  // Auto-Detection Logic
  useEffect(() => {
    if (visible && headers.length > 0) {
      const initialMapping: Record<string, string> = {};
      const upperHeaders = headers.map(h => h.toUpperCase().trim());

      requiredFields.forEach((field) => {
        // Find best match in headers
        const fieldKey = field.key.toUpperCase();
        const fieldLabel = field.label.toUpperCase();
        
        const matchIndex = upperHeaders.findIndex(h => 
           h === fieldKey || 
           h === fieldLabel ||
           h.includes(fieldKey) ||
           (fieldKey === 'LOCATION' && h === 'LOC')
        );

        if (matchIndex !== -1) {
          initialMapping[field.key] = headers[matchIndex];
        }
      });
      setMapping(initialMapping);
    }
  }, [visible, headers, requiredFields]);

  const handleConfirm = () => {
    // Basic validation
    onConfirm(mapping);
  };

  const isComplete = requiredFields.every(f => mapping[f.key]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Map Excel Columns</Text>
              <Text style={styles.filename} numberOfLines={1}>{fileName || 'Upload.xlsx'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={20} color="#92400E" />
            <Text style={styles.warningText}>
              We couldn't match some columns automatically. Please select them manually.
            </Text>
          </View>

          <ScrollView style={styles.fieldList} showsVerticalScrollIndicator={false}>
            {requiredFields.map((field) => (
              <View key={field.key} style={styles.fieldItem}>
                <View style={styles.fieldLabelRow}>
                   <Text style={styles.fieldLabel}>{field.label}</Text>
                   <Text style={styles.astrix}>*</Text>
                </View>
                
                <TouchableOpacity 
                  style={[
                    styles.dropdownTrigger,
                    activeSelectField === field.key && styles.dropdownTriggerActive,
                    !mapping[field.key] && styles.errorBorder
                  ]}
                  onPress={() => setActiveSelectField(activeSelectField === field.key ? null : field.key)}
                >
                  <Text style={[
                      styles.selectedText,
                      !mapping[field.key] && { color: COLORS.muted }
                  ]}>
                    {mapping[field.key] || 'Select Column Heading'}
                  </Text>
                  <Ionicons 
                    name={activeSelectField === field.key ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={COLORS.muted} 
                  />
                </TouchableOpacity>

                {activeSelectField === field.key && (
                  <View style={styles.optionsList}>
                    {headers.map((h, idx) => (
                      <TouchableOpacity 
                        key={`${h}-${idx}`}
                        style={[
                            styles.option,
                            mapping[field.key] === h && styles.optionSelected
                        ]}
                        onPress={() => {
                          setMapping({...mapping, [field.key]: h});
                          setActiveSelectField(null);
                        }}
                      >
                        <Text style={[
                            styles.optionText,
                            mapping[field.key] === h && styles.optionTextSelected
                        ]}>
                           {h}
                        </Text>
                        {mapping[field.key] === h && (
                            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.confirmBtn, !isComplete && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={!isComplete}
            >
              <Text style={styles.confirmBtnText}>Complete Import</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primaryText} style={{marginLeft: 8}} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  filename: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    padding: 12,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    alignItems: 'center',
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  fieldList: {
    paddingHorizontal: 16,
  },
  fieldItem: {
    marginBottom: 20,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  astrix: {
    color: COLORS.error,
    marginLeft: 4,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  dropdownTriggerActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  errorBorder: {
      borderColor: '#FCA5A5',
      backgroundColor: '#FEF2F2',
  },
  selectedText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  optionsList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionSelected: {
    backgroundColor: '#FEFCE8',
  },
  optionText: {
    fontSize: 15,
    color: COLORS.text,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: COLORS.primaryText,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#fff',
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  btnDisabled: {
    backgroundColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryText,
  },
});

export default ColumnMappingModal;
