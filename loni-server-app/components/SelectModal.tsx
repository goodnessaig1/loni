import React from 'react';
import { 
  Modal, 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  TouchableWithoutFeedback 
} from 'react-native';
import { HelixaText } from './HelixaText';
import { Feather } from '@expo/vector-icons';

export interface SelectOption {
  label: string;
  value: string;
  colorHex?: string;
}

interface SelectModalProps {
  visible: boolean;
  onClose: () => void;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  title: string;
}

export function SelectModal({ visible, onClose, options, selectedValue, onSelect, title }: SelectModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableWithoutFeedback>
          <View style={styles.sheetContainer}>
            <View style={styles.header}>
              <HelixaText style={styles.title}>{title}</HelixaText>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.optionsList}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.optionRow}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <View style={styles.optionContent}>
                    {option.colorHex && (
                      <View style={[styles.colorSample, { backgroundColor: option.colorHex }]} />
                    )}
                    <HelixaText style={[
                      styles.optionText, 
                      selectedValue === option.value && styles.optionTextSelected
                    ]}>
                      {option.label}
                    </HelixaText>
                  </View>
                  <View style={[
                    styles.radioCircle,
                    selectedValue === option.value && styles.radioCircleSelected
                  ]}>
                    {selectedValue === option.value && (
                      <Feather name="check" size={14} color="#FFF" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    paddingTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorSample: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#D62D88',
    fontWeight: '500',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB', // grey outline
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#D62D88',
    backgroundColor: '#D62D88',
  },
});
