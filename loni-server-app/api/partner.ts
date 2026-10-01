import { apiClient } from './client';

export interface PartnerDashboardUpdate {
  week: number;
  title: string;
}

export interface PartnerDashboardAlert {
  ride_id: number;
  status: string;
  pickup: { lat: number; lng: number };
  pickup_address: string | null;
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

export const partnerApi = {
  getDashboard: async (): Promise<PartnerDashboard> => {
    const response = await apiClient.get('/users/partner-dashboard');
    return response.data.data;
  },
};
