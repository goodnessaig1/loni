import React, { useState } from 'react';
import {
  View,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function EmergencyContactsScreen() {
  const [contacts, setContacts] = useState([{ name: '', phone: '', relationship: '' }]);

  const handleAddContact = () => {
    setContacts([...contacts, { name: '', phone: '', relationship: '' }]);
  };

  const updateContact = (index: number, field: string, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setContacts(newContacts);
  };

  const removeContact = (index: number) => {
    const newContacts = contacts.filter((_, i) => i !== index);
    setContacts(newContacts);
  };

  // Check if every contact has name, phone, and relationship filled
  const isFormComplete = contacts.length > 0 && contacts.every(c => c.name.trim() !== '' && c.phone.trim() !== '' && c.relationship.trim() !== '');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <CalText style={styles.heading}>Emergency Contacts</CalText>
          <HelixaText style={styles.subtext}>
            We'll notify these people if you request emergency help
          </HelixaText>

          {contacts.map((contact, index) => (
            <View key={index} style={styles.formContainer}>
              {contacts.length > 1 && (
                <Pressable onPress={() => removeContact(index)} style={styles.removeContactButton}>
                  <Feather name="trash-2" size={16} color="#EF4444" />
                </Pressable>
              )}
              <View style={styles.inputGroup}>
                <HelixaText style={styles.inputLabel} weight="bold">Name</HelixaText>
                <TextInput
                  style={styles.input}
                  placeholder="Enter name"
                  placeholderTextColor="#9CA3AF"
                  value={contact.name}
                  onChangeText={(val) => updateContact(index, 'name', val)}
                />
              </View>

              <View style={styles.inputGroup}>
                <HelixaText style={styles.inputLabel} weight="bold">Phone number</HelixaText>
                <TextInput
                  style={styles.input}
                  placeholder="Enter phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={contact.phone}
                  onChangeText={(val) => updateContact(index, 'phone', val)}
                />
              </View>

              <View style={styles.inputGroup}>
                <HelixaText style={styles.inputLabel} weight="bold">Relationship</HelixaText>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Partner, Mother"
                  placeholderTextColor="#9CA3AF"
                  value={contact.relationship}
                  onChangeText={(val) => updateContact(index, 'relationship', val)}
                />
              </View>
            </View>
          ))}

          <Pressable style={styles.addAnotherButton} onPress={handleAddContact}>
            <Feather name="plus" size={16} color="#D62D88" />
            <HelixaText style={styles.addAnotherText}>Add another contact</HelixaText>
          </Pressable>

          <View style={styles.footer}>
            <Pressable
              style={[styles.continueButton, isFormComplete ? styles.continueButtonActive : styles.continueButtonDisabled]}
              disabled={!isFormComplete}
              onPress={() => router.replace('/(auth)/success')}
            >
              <HelixaText style={styles.continueButtonText} weight="bold">Continue</HelixaText>
            </Pressable>

            <Pressable
              style={styles.skipButton}
              onPress={() => router.replace('/(auth)/success')}
            >
              <HelixaText style={styles.skipButtonText} weight="bold">Skip for now</HelixaText>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 26,
    lineHeight: 32,
    color: '#000000',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 32,
  },
  formContainer: {
    borderWidth: 1,
    backgroundColor: "#FAFAFA",
    borderColor: '#E5E5E5',
    borderStyle: 'solid',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 40,
  },
  addAnotherText: {
    color: '#D62D88',
    fontSize: 15,
  },
  footer: {
    gap: 16,
  },
  removeContactButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  continueButton: {
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonActive: {
    backgroundColor: '#D62D88',
  },
  continueButtonDisabled: {
    backgroundColor: '#F9C2D9',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 15,
  },
});
