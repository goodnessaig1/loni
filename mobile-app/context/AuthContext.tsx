import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../api/client';

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'pregnant' | 'newMom';
  trimester?: string;
  pregnancyWeek?: string;
  pregnancyStartDate?: string;
  babyAge?: string;
  profilePicture?: string;
  referralCode: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  loginUser: (token: string, user: User) => Promise<void>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  loginUser: async () => {},
  logoutUser: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        const res = await apiClient.get('/auth/me');
        setUser(res.data.data.user);
      }
    } catch (e) {
      console.log('Failed to load user', e);
      await SecureStore.deleteItemAsync('userToken');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loginUser = async (token: string, userData: User) => {
    await SecureStore.setItemAsync('userToken', token);
    setUser(userData);
  };

  const logoutUser = async () => {
    await SecureStore.deleteItemAsync('userToken');
    setUser(null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginUser, logoutUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
