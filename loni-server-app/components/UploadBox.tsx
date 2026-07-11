import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { HelixaText } from './HelixaText';

interface UploadBoxProps {
  label: string;
  fileUri: string | null;
  fileName: string | null;
  setUri: (uri: string) => void;
  setName: (name: string) => void;
  defaultFileName?: string;
}

export const UploadBox: React.FC<UploadBoxProps> = ({
  label,
  fileUri,
  fileName,
  setUri,
  setName,
  defaultFileName = 'uploaded_file.jpg',
}) => {
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setUri(uri);
        const uriParts = uri.split('/');
        setName(uriParts[uriParts.length - 1] || defaultFileName);
      }
    } catch (error: any) {
      console.log('Image picker error:', error);
      const errMsg = error?.message?.toLowerCase() || '';
      
      if (errMsg.includes('space') || errMsg.includes('disk') || errMsg.includes('volume')) {
        setErrorMessage('Your device is out of storage space. Please free up some space and try again.');
        setShowErrorModal(true);
      } else {
        setErrorMessage('Failed to pick an image. Please try again.');
        setShowErrorModal(true);
      }
    }
  };

  return (
    <View style={styles.uploadSection}>
      <HelixaText style={styles.inputLabel} weight="bold">{label}</HelixaText>
      
      <TouchableOpacity 
        style={styles.uploadBox}
        onPress={pickImage}
        activeOpacity={0.7}
      >
        <Feather name="upload-cloud" size={24} color="#000000" style={styles.uploadIcon} />
        <HelixaText style={styles.uploadText}>Tap to upload photo</HelixaText>
        <View style={styles.uploadPlusButton}>
          <Feather name="plus" size={16} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {fileUri && (
        <View style={styles.uploadedFileBox}>
          <Feather name="file-text" size={20} color="#D62D88" style={{ marginRight: 12 }} />
          <View>
            <HelixaText style={styles.uploadedFileName} weight="bold">{fileName}</HelixaText>
            <HelixaText style={styles.uploadedFileSize}>200 KB</HelixaText>
          </View>
        </View>
      )}

      {/* Error Bottom Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showErrorModal}
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIndicator} />
            </View>
            <Feather name="alert-triangle" size={48} color="#EF4444" style={styles.modalIcon} />
            <HelixaText style={styles.modalTitle} weight="bold">Storage Error</HelixaText>
            <HelixaText style={styles.modalMessage}>{errorMessage}</HelixaText>
            
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowErrorModal(false)}
            >
              <HelixaText style={styles.modalButtonText} weight="bold">I Understand</HelixaText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  uploadSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 12,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#FAF8F8',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  uploadPlusButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  uploadedFileName: {
    fontSize: 14,
    color: '#D62D88',
    marginBottom: 2,
  },
  uploadedFileSize: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  modalHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: '#111827',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#D62D88',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  }
});
