import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Use your machine's local IP for physical devices, or 10.0.2.2 for Android emulator
// export const API_URL ='https://loni-1.onrender.com/api/v1';
export const API_URL = 'http://192.168.0.141:8000/api/v1';
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

apiClient.interceptors.response.use(
  (response) => {
    // If the backend returns 200 OK but with an explicit success: false flag
    if (response.data && response.data.success === false) {
      return Promise.reject(new Error(response.data.message || response.data.detail || 'API request failed'));
    }
    return response;
  },
  (error) => {
    // Handle standard HTTP errors (4xx, 5xx)
    if (error.response && error.response.data) {
      const data = error.response.data;
      error.message = data.message || data.detail || error.message;
    }
    return Promise.reject(error);
  }
);
