import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { emergencyContactsApi, EmergencyContact } from '../api/emergencyContacts';
import { useAuth } from 'hooks/useAuth';
import { onPartnerChange } from '../lib/partnerSync';
// import { useAuth } from './AuthContext';

interface EmergencyContactsContextType {
  contacts: EmergencyContact[];
  isLoading: boolean;
  error: string | null;
  refreshContacts: () => Promise<void>;
  removeContact: (contactId: number) => Promise<void>;
  updateContactPermissions: (contactId: number, permissions: { location?: boolean; updates?: boolean; emergency?: boolean }) => Promise<void>;
}

const EmergencyContactsContext = createContext<EmergencyContactsContextType | undefined>(undefined);

export const EmergencyContactsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshContacts = async () => {
    if (!user) {
      setContacts([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await emergencyContactsApi.getContacts();
      if (data.success && data.data?.contacts) {
        setContacts(data.data.contacts);
      } else {
        setContacts([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const removeContact = async (contactId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await emergencyContactsApi.removeContact(contactId);
      if (response.success) {
        await refreshContacts();
      } else {
        throw new Error(response.message || 'Failed to remove contact');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove contact');
      setIsLoading(false); // only set false on error, refreshContacts handles success
      throw err;
    }
  };

  const updateContactPermissions = async (contactId: number, permissions: { location?: boolean; updates?: boolean; emergency?: boolean }) => {
    try {
      const response = await emergencyContactsApi.updateContactPermissions(contactId, permissions);
      if (response.success) {
        // Soft update (mutate context) rather than a full refetch
        setContacts(prev => prev.map(contact => 
          contact.id === contactId ? { ...contact, ...permissions } : contact
        ));
      } else {
        throw new Error(response.message || 'Failed to update permissions');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update permissions');
      throw err;
    }
  };

  useEffect(() => {
    refreshContacts();
  }, [user]);

  // A partner finished setting up or left: the server tells us live (lib/partnerSync.ts).
  useEffect(() => onPartnerChange(() => { refreshContacts(); }), [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <EmergencyContactsContext.Provider value={{ contacts, isLoading, error, refreshContacts, removeContact, updateContactPermissions }}>
      {children}
    </EmergencyContactsContext.Provider>
  );
};

export const useEmergencyContacts = () => {
  const context = useContext(EmergencyContactsContext);
  if (context === undefined) {
    throw new Error('useEmergencyContacts must be used within an EmergencyContactsProvider');
  }
  return context;
};
