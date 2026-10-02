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

export interface PartnerConnection {
  inviter_name: string;
  relationship: string;
  status: 'pending' | 'connected';
  connected_at: string | null;
  location: boolean;
  updates: boolean;
  emergency: boolean;
}

export const emergencyContactsApi = {
  getContacts: async () => {
    const response = await apiClient.get('/users/emergency-contacts');
    return response.data;
  },
  getPartnerConnection: async (): Promise<PartnerConnection> => {
    const response = await apiClient.get('/users/partner-connection');
    return response.data.data;
  },
  invitePartner: async (data: { fullname: string; email: string; message: string }) => {
    const response = await apiClient.post('/users/invite-partner', data);
    return response.data;
  },
  addContacts: async (contacts: any[]) => {
    const response = await apiClient.post('/users/emergency-contacts', { contacts });
    return response.data;
  },
  removeContact: async (contactId: number) => {
    const response = await apiClient.delete(`/users/emergency-contacts/${contactId}`);
    return response.data;
  },
  updateContactPermissions: async (contactId: number, permissions: { location?: boolean; updates?: boolean; emergency?: boolean }) => {
    const response = await apiClient.patch(`/users/emergency-contacts/${contactId}/permissions`, permissions);
    return response.data;
  }
};
