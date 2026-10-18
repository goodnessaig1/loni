import { apiClient } from './client';

export interface PartnerDashboardUpdate {
  week: number;
  title: string;
  body: string;
  expect: string[];
}

export interface PartnerDashboardAlert {
  ride_id: number;
  status: string;
  /** null when she does not share her location with this partner */
  pickup: { lat: number; lng: number } | null;
  pickup_address: string | null;
  location_shared?: boolean;
  dropoff_name: string | null;
  driver_name: string | null;
  /** Live driver position, once one has reported a GPS fix. */
  driver_location: { lat: number; lng: number; updated_at: string | null } | null;
  requested_at: string | null;
}

export interface PartnerDashboard {
  partner: { name: string; profile_picture: string | null };
  inviter: {
    id: string;
    name: string;
    profile_picture: string | null;
    status: 'pregnant' | 'newMom' | null;
    week: number | null;
  };
  sharing: { location: boolean; updates: boolean; emergency: boolean };
  updates: PartnerDashboardUpdate[];
  /** She's only ever located here while actually in an emergency ride. */
  active_alert: PartnerDashboardAlert | null;
}

export interface PartnerMilestone {
  week: number;
  title: string;
  body: string;
  expect: string[];
  state: 'done' | 'current' | 'upcoming';
}

export interface PartnerUpdates {
  inviter_name: string;
  status: 'pregnant' | 'newMom' | 'ttc' | 'general' | null;
  week: number | null;
  trimester?: string | null;
  /** false when she has turned off sharing updates with this partner */
  shared: boolean;
  milestones: PartnerMilestone[];
}

export const partnerApi = {
  getUpdates: async (): Promise<PartnerUpdates> => (await apiClient.get('/users/partner-updates')).data.data,
  /** Stop getting her alerts: removes the connection and this partner account. */
  leaveConnection: async () => (await apiClient.delete('/users/partner-connection')).data,
  getDashboard: async (): Promise<PartnerDashboard> => {
    const response = await apiClient.get('/users/partner-dashboard');
    return response.data.data;
  },
};
