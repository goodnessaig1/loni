import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  driverTrainingApi,
  type DriverPersonalInfo,
  type DriverVehicleInfo,
  type DriverDocuments,
} from '../api/driverTraining';

export const driverTrainingKeys = {
  onboarding: ['driver-training', 'onboarding'] as const,
  modules: ['driver-training', 'modules'] as const,
  aptitudeStatus: ['driver-training', 'aptitude', 'status'] as const,
  aptitudeQuestions: ['driver-training', 'aptitude', 'questions'] as const,
};

export const useOnboarding = () =>
  useQuery({
    queryKey: driverTrainingKeys.onboarding,
    queryFn: driverTrainingApi.getOnboarding,
  });

/** Shared success handler: onboarding + the auth `user` object both change. */
const useOnboardingRefetch = () => {
  const qc = useQueryClient();
  const { refreshUser } = useAuth();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: driverTrainingKeys.onboarding }),
      refreshUser(),
    ]);
  };
};

export const useStartOnboarding = () => {
  const onSuccess = useOnboardingRefetch();
  return useMutation({ mutationFn: driverTrainingApi.start, onSuccess });
};

export const useSavePersonalInfo = () => {
  const onSuccess = useOnboardingRefetch();
  return useMutation({
    mutationFn: (data: DriverPersonalInfo) => driverTrainingApi.savePersonalInfo(data),
    onSuccess,
  });
};

export const useSaveVehicleInfo = () => {
  const onSuccess = useOnboardingRefetch();
  return useMutation({
    mutationFn: (data: DriverVehicleInfo) => driverTrainingApi.saveVehicleInfo(data),
    onSuccess,
  });
};

export const useSaveDocuments = () => {
  const onSuccess = useOnboardingRefetch();
  return useMutation({
    mutationFn: (data: DriverDocuments) => driverTrainingApi.saveDocuments(data),
    onSuccess,
  });
};

export const useSubmitApplication = () => {
  const onSuccess = useOnboardingRefetch();
  return useMutation({ mutationFn: driverTrainingApi.submitApplication, onSuccess });
};

export const useTrainingModules = () =>
  useQuery({
    queryKey: driverTrainingKeys.modules,
    queryFn: driverTrainingApi.getModules,
  });

export const useCompleteModule = () => {
  const qc = useQueryClient();
  const refetchOnboarding = useOnboardingRefetch();
  return useMutation({
    mutationFn: (moduleId: string) => driverTrainingApi.completeModule(moduleId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: driverTrainingKeys.modules });
      await refetchOnboarding();
    },
  });
};

export const useAptitudeStatus = () =>
  useQuery({
    queryKey: driverTrainingKeys.aptitudeStatus,
    queryFn: driverTrainingApi.getAptitudeStatus,
  });

export const useAptitudeQuestions = (enabled = true) =>
  useQuery({
    queryKey: driverTrainingKeys.aptitudeQuestions,
    queryFn: driverTrainingApi.getAptitudeQuestions,
    enabled,
    gcTime: 0,
    staleTime: 0,
  });

export const useSubmitAptitude = () => {
  const qc = useQueryClient();
  const refetchOnboarding = useOnboardingRefetch();
  return useMutation({
    mutationFn: (answers: { question_id: number; selected_index: number }[]) =>
      driverTrainingApi.submitAptitude(answers),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: driverTrainingKeys.aptitudeStatus });
      await refetchOnboarding();
    },
  });
};
