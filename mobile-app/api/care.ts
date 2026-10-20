import { apiClient } from './client';

export type TaskCategory = 'body' | 'nutrition' | 'mind';

export interface CareTask {
  key: string;
  title: string;
  subtitle: string;
  category: TaskCategory;
  done: boolean;
}

export interface TodayPlan {
  day: string;
  stage: 'pregnancy' | 'postpartum' | 'general';
  week: number;
  done: number;
  total: number;
  categories: Partial<Record<TaskCategory, { done: number; total: number }>>;
  tasks: CareTask[];
}

export interface CareOverview {
  stage: 'pregnancy' | 'postpartum' | 'general';
  week: number;
  today: { done: number; total: number };
  report: { headline: string; completion_pct: number };
  bag: { done: number; total: number };
  recent: { key: string; title: string; at: string }[];
}

export interface NutritionPlan {
  stage: 'pregnancy' | 'postpartum' | 'general';
  week: number;
  hydration: { title: string; goal_cups: number; liters: number; note: string };
  meals: { slot: string; name: string; description: string }[];
  snacks: { name: string; description: string; tags: string[] }[];
  avoid: string[];
}

export interface WeeklyReport {
  start: string;
  end: string;
  stage: 'pregnancy' | 'postpartum' | 'general';
  week: number;
  headline: string;
  completion_pct: number;
  observations: string[];
  activities: { key: string; title: string; days_done: number; of: number }[];
  missed: { key: string; title: string; note: string }[];
}

export interface HospitalBag {
  groups: { id: string; title: string; items: { key: string; title: string; checked: boolean }[] }[];
  done: number;
  total: number;
}

export interface LabourTopicSummary {
  slug: string;
  title: string;
  summary: string;
}

export interface LabourTopic extends LabourTopicSummary {
  intro: string;
  sections: { heading: string; body: string }[];
  disclaimer: string;
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

/** The device's local calendar day (YYYY-MM-DD), so "today" flips at the mother's midnight. */
export const localDay = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const careApi = {
  overview: async (): Promise<CareOverview> =>
    unwrap(await apiClient.get('/care/overview', { params: { day: localDay() } })),
  today: async (): Promise<TodayPlan> => unwrap(await apiClient.get('/care/today', { params: { day: localDay() } })),
  setTask: async (key: string, done: boolean): Promise<TodayPlan> =>
    unwrap(await apiClient.put(`/care/today/${key}`, { done }, { params: { day: localDay() } })),
  nutrition: async (): Promise<NutritionPlan> => unwrap(await apiClient.get('/care/nutrition')),
  weeklyReport: async (): Promise<WeeklyReport> =>
    unwrap(await apiClient.get('/care/weekly-report', { params: { day: localDay() } })),
  hospitalBag: async (): Promise<HospitalBag> => unwrap(await apiClient.get('/care/hospital-bag')),
  setBagItem: async (key: string, checked: boolean): Promise<HospitalBag> =>
    unwrap(await apiClient.put(`/care/hospital-bag/${key}`, { checked })),
  labourTopics: async (): Promise<{ topics: LabourTopicSummary[]; disclaimer: string }> =>
    unwrap(await apiClient.get('/care/labour-prep')),
  labourTopic: async (slug: string): Promise<LabourTopic> => unwrap(await apiClient.get(`/care/labour-prep/${slug}`)),
};
