import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../api/client';
import { queryClient } from '../lib/queryClient';
import { unregisterPush } from '../lib/pushRegistration';
import { setSessionExpiredHandler } from '../api/client';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** pregnant, a new mom, trying to conceive, or just here for her general health. */
  status: 'pregnant' | 'newMom' | 'ttc' | 'general';
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
  /** Replace the cached user with a fresh copy a mutation already returned (no extra round trip). */
  updateUser: (user: User) => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  loginUser: async () => {},
  logoutUser: async () => {},
  refreshUser: async () => {},
  updateUser: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (token) {
        const res = await apiClient.get('/users/me');
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
    // Before the login token goes: this phone must stop getting this account's pushes.
    await unregisterPush();
    await SecureStore.deleteItemAsync('userToken');
    // Cached subscription / care / community data belongs to the account that just left.
    queryClient.clear();
    setUser(null);
  };

  // Login expired on the server (8 days): sign out once and go back to sign-in with a short note.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      (async () => {
        await unregisterPush({ skipServer: true });
        await SecureStore.deleteItemAsync('userToken');
        queryClient.clear();
        setUser(null);
        Toast.show({ type: 'info', text1: 'Please sign in again', text2: 'Your session has expired.' });
        router.replace('/(auth)/login');
      })().catch(() => {});
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginUser, logoutUser, refreshUser, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
