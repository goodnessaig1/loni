import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { markOffline, markOnline } from '../lib/connectivity';

// Use your machine's local IP for physical devices, or 10.0.2.2 for Android emulator
// ipconfig getifaddr en0
// Local development: this Mac's LAN address (scripts/update-lan-ip.sh rewrites it).
const LAN_API_URL = 'http://192.168.100.192:8000/api/v1';
// Staging / production builds set EXPO_PUBLIC_API_URL (e.g. https://api.lonimum.com/api/v1).
export const API_URL = process.env.EXPO_PUBLIC_API_URL || LAN_API_URL;

export const apiClient = axios.create({
  baseURL: API_URL,
  // Never leave a screen spinning forever on a weak connection; uploads get longer (see below).
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Photos and documents over mobile data can take a while.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.timeout = Math.max(config.timeout ?? 0, 60000);
  }
  return config;
});

// ---- expired login --------------------------------------------------------------------------
// The login token lasts 8 days. When the server says it is no longer valid, sign out once and
// go back to sign-in instead of letting every screen fail. AuthContext registers the handler.
let onSessionExpired: (() => void) | null = null;
let expiring = false;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

apiClient.interceptors.response.use(
  (response) => {
    markOnline();
    // If the backend returns 200 OK but with an explicit success: false flag
    if (response.data && response.data.success === false) {
      return Promise.reject(new Error(response.data.message || response.data.detail || 'API request failed'));
    }
    return response;
  },
  (error) => {
    const url: string = error?.config?.url ?? '';
    if (error?.response?.status === 401 && error?.config?.headers?.Authorization && !url.includes('/auth/') && !expiring) {
      expiring = true;
      try { onSessionExpired?.(); } finally { setTimeout(() => { expiring = false; }, 5000); }
    }
    // A cancelled request (navigated away) has no response either - that's not being offline.
    if (error?.response) markOnline();
    else if (!axios.isCancel(error) && error?.code !== 'ERR_CANCELED') markOffline();
    if (error?.code === 'ECONNABORTED') {
      error.message = 'The connection is slow. Please check your internet and try again.';
    } else if (!error?.response) {
      error.message = "Can't reach LONI right now. Please check your internet connection.";
    }
    // Handle standard HTTP errors (4xx, 5xx)
    if (error.response && error.response.data) {
      const data = error.response.data;
      error.message = data.message || data.detail || error.message;
    }
    return Promise.reject(error);
  }
);
