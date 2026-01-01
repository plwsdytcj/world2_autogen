import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../services/api';
import type { Credential, CreateCredentialPayload, SingleResponse, UpdateCredentialPayload } from '../types';
import { notifications } from '@mantine/notifications';
import { useI18n } from '../i18n';

// --- Create ---
const createCredential = async (data: CreateCredentialPayload): Promise<SingleResponse<Credential>> => {
  const response = await apiClient.post('/credentials', data);
  return response.data;
};

export const useCreateCredential = () => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: createCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      notifications.show({ title: t('creds.createdTitle'), message: t('creds.createdMsg'), color: 'green' });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({ title: t('common.error') || 'Error', message: `${t('creds.createFailed')}: ${error.response?.data?.detail || error.message}`, color: 'red' });
    },
  });
};

// --- Update ---
const updateCredential = async ({
  credentialId,
  data,
}: {
  credentialId: string;
  data: UpdateCredentialPayload;
}): Promise<SingleResponse<Credential>> => {
  const response = await apiClient.patch(`/credentials/${credentialId}`, data);
  return response.data;
};

export const useUpdateCredential = () => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: updateCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      notifications.show({ title: t('creds.updatedTitle'), message: t('creds.updatedMsg'), color: 'green' });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({ title: t('common.error') || 'Error', message: `${t('creds.updateFailed')}: ${error.response?.data?.detail || error.message}`, color: 'red' });
    },
  });
};

// --- Delete ---
const deleteCredential = async (credentialId: string): Promise<void> => {
  await apiClient.delete(`/credentials/${credentialId}`);
};

export const useDeleteCredential = () => {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  return useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      notifications.show({ title: t('creds.deletedTitle'), message: t('creds.deletedMsg'), color: 'green' });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      notifications.show({ title: t('common.error') || 'Error', message: `${t('creds.deleteFailed')}: ${error.response?.data?.detail || error.message}`, color: 'red' });
    },
  });
};
