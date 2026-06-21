import { useContext } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';

export const useAuth = () => {
  return useContext(AuthContext);
};

export const useRegister = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      console.log(data)
      const res = await apiClient.post('/auth/register', data);
      console.log(res.data)
      return res.data;
    }
  });
};

export const useLogin = () => {
  const { loginUser, refreshUser } = useAuth();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/auth/login', data);
      await loginUser(res.data.data.token, res.data.data.user);
      // Fetch user details via auth/me
      await refreshUser();
      return res.data;
    }
  });
};

export const useVerifyEmail = () => {
  const { loginUser } = useAuth();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/auth/verify-email', data);
      if (res.data.data?.token) {
        await loginUser(res.data.data.token, res.data.data.user);
      }
      return res.data;
    }
  });
};

export const useResendOtp = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/auth/resend-otp', data);
      return res.data;
    }
  });
};

export const useAddPhone = () => {
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/auth/add-phone', data);
      await refreshUser();
      return res.data;
    }
  });
};

export const useVerifyPhone = () => {
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/auth/verify-phone', data);
      await refreshUser();
      return res.data;
    }
  });
};

export const useEmergencyContacts = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/users/emergency-contacts', data);
      return res.data;
    }
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/auth/forgot-password', data);
      return res.data;
    }
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/auth/reset-password', data);
      return res.data;
    }
  });
};

export const useUploadProfilePicture = () => {
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiClient.post('/users/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await refreshUser();
      return res.data;
    }
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.put('/users/me/password', data);
      return res.data;
    }
  });
};
