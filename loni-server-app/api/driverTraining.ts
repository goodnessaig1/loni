import { apiClient } from './client';
import type { DriverOnboarding } from '../lib/driverOnboarding';

export interface DriverPersonalInfo {
  full_name: string;
  date_of_birth: string;
  profile_photo?: string;
}

export interface DriverVehicleInfo {
  vehicle_type: string;
  has_ac: boolean;
  vehicle_brand: string;
  vehicle_year: string;
  vehicle_model: string;
  plate_number: string;
  vehicle_color: string;
  front_view: string;
  back_view: string;
  vin: string;
  interior: string;
}

export interface DriverDocuments {
  driver_license: string;
  government_id: string;
  vehicle_papers: string;
}

export interface TrainingSection {
  title: string;
  body?: string;
  bullets?: string[];
  note?: string;
}

export interface TrainingModule {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  icon: string;
  hero: string;
  layout: 'checklist' | 'reading';
  sections: TrainingSection[];
}

export interface TrainingProgress {
  completed_modules: string[];
  total_modules: number;
  completed: boolean;
}

export interface ModulesResponse {
  modules: TrainingModule[];
  progress: TrainingProgress;
}

export interface AptitudeStatus {
  attempts_used: number;
  attempts_remaining: number;
  max_attempts: number;
  question_count: number;
  pass_score: number;
  passed: boolean;
  best_score: number | null;
  can_attempt: boolean;
}

export interface PublicQuestion {
  id: number;
  question: string;
  options: string[];
  category: string | null;
}

export interface QuestionsResponse {
  questions: PublicQuestion[];
  status: AptitudeStatus;
}

export interface SubmitAttemptResponse {
  score: number;
  total: number;
  passed: boolean;
  breakdown: { question_id: number; selected_index: number | null; correct: boolean }[];
  status: AptitudeStatus;
}

export const driverTrainingApi = {
  start: async (): Promise<DriverOnboarding> => {
    const res = await apiClient.post('/driver-training/start');
    return res.data;
  },
  getOnboarding: async (): Promise<DriverOnboarding> => {
    const res = await apiClient.get('/driver-training/onboarding');
    return res.data;
  },
  savePersonalInfo: async (data: DriverPersonalInfo) => {
    const res = await apiClient.patch('/users/profile/driver/personal', data);
    return res.data;
  },
  saveVehicleInfo: async (data: DriverVehicleInfo) => {
    const res = await apiClient.patch('/users/profile/driver/vehicle', data);
    return res.data;
  },
  saveDocuments: async (data: DriverDocuments) => {
    const res = await apiClient.patch('/users/profile/driver/documents', data);
    return res.data;
  },
  submitApplication: async () => {
    const res = await apiClient.post('/users/profile/driver/submit');
    return res.data;
  },
  getModules: async (): Promise<ModulesResponse> => {
    const res = await apiClient.get('/driver-training/modules');
    return res.data;
  },
  completeModule: async (moduleId: string): Promise<TrainingProgress> => {
    const res = await apiClient.post('/driver-training/modules/complete', { module_id: moduleId });
    return res.data;
  },
  getAptitudeStatus: async (): Promise<AptitudeStatus> => {
    const res = await apiClient.get('/driver-training/aptitude/status');
    return res.data;
  },
  getAptitudeQuestions: async (): Promise<QuestionsResponse> => {
    const res = await apiClient.get('/driver-training/aptitude/questions');
    return res.data;
  },
  submitAptitude: async (
    answers: { question_id: number; selected_index: number }[]
  ): Promise<SubmitAttemptResponse> => {
    const res = await apiClient.post('/driver-training/aptitude/submit', { answers });
    return res.data;
  },
};
