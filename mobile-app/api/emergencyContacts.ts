import { apiClient } from './client';

export interface EmergencyContact {
  email: string;
  id: number;
  name: string;
  phone: string;
  relationship: string;
  status: 'pending' | 'connected';
  profile_picture: string | null;
  location: boolean;
  updates: boolean;
  emergency: boolean;
  created_at: string;
}

export const emergencyContactsApi = {
  getContacts: async () => {
    const response = await apiClient.get('/users/emergency-contacts');
    return response.data;
  },
  invitePartner: async (data: { fullname: string; email: string; message: string }) => {
    const response = await apiClient.post('/users/invite-partner', data);
    return response.data;
  },
  addContacts: async (contacts: any[]) => {
    const response = await apiClient.post('/users/emergency-contacts', { contacts });
    return response.data;
  }
};
