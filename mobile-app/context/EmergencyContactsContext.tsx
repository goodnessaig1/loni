import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { emergencyContactsApi, EmergencyContact } from '../api/emergencyContacts';
import { useAuth } from '../hooks/useAuth';

interface EmergencyContactsContextType {
  contacts: EmergencyContact[];
  isLoading: boolean;
  error: string | null;
  refreshContacts: () => Promise<void>;
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

  useEffect(() => {
    refreshContacts();
  }, [user]);

  return (
    <EmergencyContactsContext.Provider value={{ contacts, isLoading, error, refreshContacts }}>
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
