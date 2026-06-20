import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use your machine's local IP for physical devices, or 10.0.2.2 for Android emulator
const API_URL = Platform.OS === 'android' ? 'http://192.168.100.109:8000/api/v1' : 'http://localhost:8000/api/v1';
// ipconfig getifaddr en0
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
